import { eq, sql } from "drizzle-orm"

import { users } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

export async function getUserById(db: DbClient, linuxdoUserId: string) {
  const row = await db.select().from(users).where(eq(users.linuxdoUserId, linuxdoUserId)).get()
  return row ?? null
}

export async function upsertUser(
  db: DbClient,
  params: { linuxdoUserId: string; nickname: string; avatarUrl: string },
) {
  await db
    .insert(users)
    .values({
      linuxdoUserId: params.linuxdoUserId,
      nickname: params.nickname,
      avatarUrl: params.avatarUrl,
      createdAt: sql`unixepoch()`,
      updatedAt: sql`unixepoch()`,
    })
    .onConflictDoUpdate({
      target: users.linuxdoUserId,
      set: {
        nickname: params.nickname,
        avatarUrl: params.avatarUrl,
        updatedAt: sql`unixepoch()`,
      },
    })

  return await getUserById(db, params.linuxdoUserId)
}

