import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { writeFileSync } from "node:fs"

function stripJsonc(input) {
  let out = ""
  let inString = false
  let stringQuote = ""
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const next = input[i + 1]

    if (inString) {
      out += ch
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === "\\") {
        escaped = true
        continue
      }
      if (ch === stringQuote) {
        inString = false
        stringQuote = ""
      }
      continue
    }

    if (ch === '"' || ch === "'") {
      inString = true
      stringQuote = ch
      out += ch
      continue
    }

    if (ch === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n") i++
      out += "\n"
      continue
    }

    if (ch === "/" && next === "*") {
      i += 2
      while (i < input.length) {
        if (input[i] === "*" && input[i + 1] === "/") {
          i++
          break
        }
        i++
      }
      continue
    }

    out += ch
  }

  return out
}

function loadWranglerJsoncConfig() {
  const path = join(process.cwd(), "wrangler.jsonc")
  const raw = readFileSync(path, "utf8")
  const json = stripJsonc(raw)
  return JSON.parse(json)
}

function resolveD1DatabaseName() {
  const preferredBinding = process.env.WRANGLER_D1_BINDING || "DB"
  const override = process.env.WRANGLER_D1_DATABASE || process.env.WRANGLER_D1_NAME
  if (override) return { name: override, source: "env" }

  try {
    const cfg = loadWranglerJsoncConfig()
    const list = Array.isArray(cfg?.d1_databases) ? cfg.d1_databases : []
    if (list.length === 0) return { name: preferredBinding, source: "fallback" }

    const exact = list.find((d) => d?.binding === preferredBinding) || list[0]
    const name = exact?.database_name || exact?.database_id
    if (!name) return { name: preferredBinding, source: "fallback" }

    const usedBinding = exact?.binding
    if (usedBinding && usedBinding !== preferredBinding) {
      // eslint-disable-next-line no-console
      console.warn(`[db-apply-d1] WRANGLER_D1_BINDING=${preferredBinding} 未匹配，已使用 wrangler.jsonc 中的 binding=${usedBinding}`)
    }
    return { name, source: "wrangler.jsonc" }
  } catch {
    return { name: preferredBinding, source: "fallback" }
  }
}

function pickLatestDrizzleSqlFile() {
  const dir = join(process.cwd(), "drizzle")
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".sql"))
    .map((d) => d.name)
    .sort()

  if (files.length === 0) {
    throw new Error('No .sql files found in "./drizzle". Run `pnpm db:generate` first.')
  }

  return join("drizzle", files[files.length - 1])
}

function sanitizeSqlForD1(sql) {
  // 1) Drizzle statement breakpoints are emitted as `--> ...` which is NOT a SQLite comment (SQLite requires `-- `).
  // 2) D1/SQLite expects expression defaults wrapped in parentheses: `DEFAULT (unixepoch())`.
  return sql
    .replaceAll("--> statement-breakpoint", "-- statement-breakpoint")
    .replaceAll("DEFAULT unixepoch()", "DEFAULT (unixepoch())")
}

function writeTempSqlFile(originalPath, sql) {
  const baseName = originalPath.replaceAll("/", "_").replaceAll("\\", "_")
  const out = join(tmpdir(), `lldc-d1-${Date.now()}-${baseName}`)
  writeFileSync(out, sql, "utf8")
  return out
}

function main() {
  const args = process.argv.slice(2)
  const isRemote = args.includes("--remote")
  const isLocal = args.includes("--local")
  const { name: databaseName } = resolveD1DatabaseName()
  const file = process.env.DRIZZLE_SQL_FILE || pickLatestDrizzleSqlFile()

  if (isRemote === isLocal) {
    throw new Error('Usage: `pnpm db:apply:remote` or `pnpm db:apply:local` (exactly one of --remote/--local).')
  }

  const rawSql = readFileSync(join(process.cwd(), file), "utf8")
  const sanitizedSql = sanitizeSqlForD1(rawSql)
  const fileToExecute = sanitizedSql === rawSql ? file : writeTempSqlFile(file, sanitizedSql)

  // NOTE: `wrangler d1 execute` expects the D1 database name/id, not the binding name.
  const wranglerArgs = ["d1", "execute", databaseName, isRemote ? "--remote" : "--local", "--file", fileToExecute]
  const res = spawnSync("wrangler", wranglerArgs, { stdio: "inherit", shell: process.platform === "win32" })
  process.exit(res.status ?? 1)
}

main()
