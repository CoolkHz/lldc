export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, credentials: "include" })
  if (res.status === 401) {
    window.location.replace("/login")
    throw new Error("未登录")
  }

  const text = await res.text()
  if (!res.ok) {
    let structured: { error?: unknown; code?: unknown } | null = null
    try {
      structured = JSON.parse(text) as { error?: unknown; code?: unknown }
    } catch {
      structured = null
    }
    if (structured && typeof structured === "object" && typeof structured.error === "string" && typeof structured.code === "string") {
      throw new Error(`${structured.error} (${structured.code})`)
    }
    throw new Error(text.slice(0, 300) || `HTTP ${res.status}`)
  }

  return JSON.parse(text) as T
}

