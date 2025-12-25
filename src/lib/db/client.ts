import { drizzle } from "drizzle-orm/d1"

import * as schema from "@/db/schema"

export function getDb(db: D1Database) {
  return drizzle(db, { schema })
}

export type DbClient = ReturnType<typeof getDb>

