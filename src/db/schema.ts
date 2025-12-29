// lib/db/schema.ts
import {
    sqliteTable,
    text,
    integer,
    index,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable(
    "users",
    {
        linuxdoUserId: text("linuxdo_user_id").primaryKey(),
        nickname: text("nickname").notNull(),
        avatarUrl: text("avatar_url").notNull(),
        createdAt: integer("created_at").notNull().default(sql`unixepoch()`),
        updatedAt: integer("updated_at").notNull().default(sql`unixepoch()`),
    },
    (t) => [
        index("idx_users_nickname").on(t.nickname),
    ]
);

export const draws = sqliteTable(
    "draws",
    {
        drawId: text("draw_id").primaryKey(),
        status: text("status").notNull(),

        salesStartTs: integer("sales_start_ts").notNull(),
        salesEndTs: integer("sales_end_ts").notNull(),

        winning: text("winning"),

        grossPoints: integer("gross_points").notNull().default(0),
        linuxdoFeePoints: integer("linuxdo_fee_points").notNull().default(0),
        netPoints: integer("net_points").notNull().default(0),

        operatorFeePoints: integer("operator_fee_points").notNull().default(0),
        p1Points: integer("p1_points").notNull().default(0),
        p2Points: integer("p2_points").notNull().default(0),
        p3Points: integer("p3_points").notNull().default(0),

        carryOverPoints: integer("carry_over_points").notNull().default(0),

        seedHash: text("seed_hash"),
        seedReveal: text("seed_reveal"),
        seedPending: text("seed_pending"),
        ticketsHash: text("tickets_hash"),

        createdAt: integer("created_at").notNull().default(sql`unixepoch()`),
    },
    (t) => [
        index("idx_draws_status").on(t.status),
        index("idx_draws_sales_end").on(t.salesEndTs),
    ]
);

export const orders = sqliteTable(
    "orders",
    {
        outTradeNo: text("out_trade_no").primaryKey(),
        tradeNo: text("trade_no"),

        drawId: text("draw_id")
            .notNull()
            .references(() => draws.drawId, { onDelete: "restrict" }),

        linuxdoUserId: text("linuxdo_user_id")
            .notNull()
            .references(() => users.linuxdoUserId, { onDelete: "restrict" }),

        userNicknameSnapshot: text("user_nickname_snapshot").notNull(),
        userAvatarSnapshot: text("user_avatar_snapshot").notNull(),

        ticketCount: integer("ticket_count").notNull(),
        unitPricePoints: integer("unit_price_points").notNull().default(10),
        moneyPoints: integer("money_points").notNull(),

        number: text("number").notNull().default("0"),

        status: text("status").notNull(),

        bonusPoints: integer("bonus_points").notNull().default(0),

        createdAt: integer("created_at").notNull().default(sql`unixepoch()`),
        paidAt: integer("paid_at"),
        updatedAt: integer("updated_at").notNull().default(sql`unixepoch()`),
    },
    (t) => [
        uniqueIndex("uq_orders_trade_no").on(t.tradeNo),
        index("idx_orders_draw").on(t.drawId),
        index("idx_orders_user").on(t.linuxdoUserId),
        index("idx_orders_status").on(t.status),
    ]
);

export const tickets = sqliteTable(
    "tickets",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),

        drawId: text("draw_id")
            .notNull()
            .references(() => draws.drawId, { onDelete: "restrict" }),

        outTradeNo: text("out_trade_no")
            .notNull()
            .references(() => orders.outTradeNo, { onDelete: "cascade" }),

        linuxdoUserId: text("linuxdo_user_id")
            .notNull()
            .references(() => users.linuxdoUserId, { onDelete: "restrict" }),

        number: text("number").notNull(),
        ticketCount: integer("ticket_count").notNull().default(1),

        prizeTier: integer("prize_tier").notNull().default(0),
        payoutPoints: integer("payout_points").notNull().default(0),

        createdAt: integer("created_at").notNull().default(sql`unixepoch()`),
    },
    (t) => [
        uniqueIndex("uq_tickets_out_trade_no").on(t.outTradeNo),
        index("idx_tickets_draw").on(t.drawId),
        index("idx_tickets_order").on(t.outTradeNo),
        index("idx_tickets_user").on(t.linuxdoUserId),
        index("idx_tickets_tier").on(t.prizeTier),
    ]
);

export const payouts = sqliteTable(
    "payouts",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),

        drawId: text("draw_id")
            .notNull()
            .references(() => draws.drawId, { onDelete: "restrict" }),

        ticketId: integer("ticket_id")
            .notNull()
            .references(() => tickets.id, { onDelete: "cascade" }),

        outTradeNo: text("out_trade_no")
            .notNull()
            .references(() => orders.outTradeNo, { onDelete: "cascade" }),

        linuxdoUserId: text("linuxdo_user_id")
            .notNull()
            .references(() => users.linuxdoUserId, { onDelete: "restrict" }),

        tier: integer("tier").notNull(),
        amountPoints: integer("amount_points").notNull(),

        status: text("status").notNull(),

        createdAt: integer("created_at").notNull().default(sql`unixepoch()`),
        paidAt: integer("paid_at"),
    },
    (t) => [
        index("idx_payouts_draw").on(t.drawId),
        index("idx_payouts_user").on(t.linuxdoUserId),
        index("idx_payouts_status").on(t.status),
    ]
);

export const auditEvents = sqliteTable(
    "audit_events",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        type: text("type").notNull(),
        refId: text("ref_id").notNull(),
        payloadJson: text("payload_json").notNull(),
        createdAt: integer("created_at").notNull().default(sql`unixepoch()`),
    },
    (t) => [
        index("idx_audit_type").on(t.type),
        index("idx_audit_ref").on(t.refId),
    ]
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

export type DrawRow = typeof draws.$inferSelect;
export type NewDrawRow = typeof draws.$inferInsert;

export type OrderRow = typeof orders.$inferSelect;
export type NewOrderRow = typeof orders.$inferInsert;

export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;

export type PayoutRow = typeof payouts.$inferSelect;
export type NewPayoutRow = typeof payouts.$inferInsert;

export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
