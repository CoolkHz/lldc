CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`ref_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer DEFAULT unixepoch() NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_type` ON `audit_events` (`type`);--> statement-breakpoint
CREATE INDEX `idx_audit_ref` ON `audit_events` (`ref_id`);--> statement-breakpoint
CREATE TABLE `draws` (
	`draw_id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`sales_start_ts` integer NOT NULL,
	`sales_end_ts` integer NOT NULL,
	`winning` text,
	`gross_points` integer DEFAULT 0 NOT NULL,
	`linuxdo_fee_points` integer DEFAULT 0 NOT NULL,
	`net_points` integer DEFAULT 0 NOT NULL,
	`operator_fee_points` integer DEFAULT 0 NOT NULL,
	`p1_points` integer DEFAULT 0 NOT NULL,
	`p2_points` integer DEFAULT 0 NOT NULL,
	`p3_points` integer DEFAULT 0 NOT NULL,
	`carry_over_points` integer DEFAULT 0 NOT NULL,
	`seed_hash` text,
	`seed_reveal` text,
	`seed_pending` text,
	`tickets_hash` text,
	`created_at` integer DEFAULT unixepoch() NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_draws_status` ON `draws` (`status`);--> statement-breakpoint
CREATE INDEX `idx_draws_sales_end` ON `draws` (`sales_end_ts`);--> statement-breakpoint
CREATE TABLE `orders` (
	`out_trade_no` text PRIMARY KEY NOT NULL,
	`trade_no` text,
	`draw_id` text NOT NULL,
	`linuxdo_user_id` text NOT NULL,
	`user_nickname_snapshot` text NOT NULL,
	`user_avatar_snapshot` text NOT NULL,
	`ticket_count` integer NOT NULL,
	`unit_price_points` integer DEFAULT 10 NOT NULL,
	`money_points` integer NOT NULL,
	`numbers_json` text NOT NULL,
	`status` text NOT NULL,
	`bonus_points` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT unixepoch() NOT NULL,
	`paid_at` integer,
	`updated_at` integer DEFAULT unixepoch() NOT NULL,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`draw_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`linuxdo_user_id`) REFERENCES `users`(`linuxdo_user_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orders_trade_no` ON `orders` (`trade_no`);--> statement-breakpoint
CREATE INDEX `idx_orders_draw` ON `orders` (`draw_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_user` ON `orders` (`linuxdo_user_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draw_id` text NOT NULL,
	`ticket_id` integer NOT NULL,
	`out_trade_no` text NOT NULL,
	`linuxdo_user_id` text NOT NULL,
	`tier` integer NOT NULL,
	`amount_points` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT unixepoch() NOT NULL,
	`paid_at` integer,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`draw_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`out_trade_no`) REFERENCES `orders`(`out_trade_no`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linuxdo_user_id`) REFERENCES `users`(`linuxdo_user_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_payouts_draw` ON `payouts` (`draw_id`);--> statement-breakpoint
CREATE INDEX `idx_payouts_user` ON `payouts` (`linuxdo_user_id`);--> statement-breakpoint
CREATE INDEX `idx_payouts_status` ON `payouts` (`status`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`draw_id` text NOT NULL,
	`out_trade_no` text NOT NULL,
	`linuxdo_user_id` text NOT NULL,
	`number` text NOT NULL,
	`prize_tier` integer DEFAULT 0 NOT NULL,
	`payout_points` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT unixepoch() NOT NULL,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`draw_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`out_trade_no`) REFERENCES `orders`(`out_trade_no`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linuxdo_user_id`) REFERENCES `users`(`linuxdo_user_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_tickets_draw` ON `tickets` (`draw_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_order` ON `tickets` (`out_trade_no`);--> statement-breakpoint
CREATE INDEX `idx_tickets_user` ON `tickets` (`linuxdo_user_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_tier` ON `tickets` (`prize_tier`);--> statement-breakpoint
CREATE TABLE `users` (
	`linuxdo_user_id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`avatar_url` text NOT NULL,
	`created_at` integer DEFAULT unixepoch() NOT NULL,
	`updated_at` integer DEFAULT unixepoch() NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_nickname` ON `users` (`nickname`);