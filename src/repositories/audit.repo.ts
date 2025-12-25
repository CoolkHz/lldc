import { sql } from "drizzle-orm"

import { auditEvents } from "@/db/schema"
import type { DbClient } from "@/lib/db/client"

export async function addAuditEvent(db: DbClient, params: { type: string; refId: string; payload: unknown }) {
  await db.insert(auditEvents).values({
    type: params.type,
    refId: params.refId,
    payloadJson: JSON.stringify(params.payload),
    createdAt: sql`unixepoch()`,
  })
}

