PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`out_trade_no` text PRIMARY KEY NOT NULL,
	`trade_no` text,
	`draw_id` text NOT NULL,
	`linuxdo_user_id` text NOT NULL,
	`user_nickname_snapshot` text NOT NULL,
	`user_avatar_snapshot` text NOT NULL,
	`ticket_count` integer NOT NULL,
	`unit_price_points` integer DEFAULT 10 NOT NULL,
	`money_points` integer NOT NULL,
	`number` text DEFAULT '0' NOT NULL,
	`status` text NOT NULL,
	`bonus_points` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT unixepoch() NOT NULL,
	`paid_at` integer,
	`updated_at` integer DEFAULT unixepoch() NOT NULL,
	FOREIGN KEY (`draw_id`) REFERENCES `draws`(`draw_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`linuxdo_user_id`) REFERENCES `users`(`linuxdo_user_id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_orders`("out_trade_no", "trade_no", "draw_id", "linuxdo_user_id", "user_nickname_snapshot", "user_avatar_snapshot", "ticket_count", "unit_price_points", "money_points", "number", "status", "bonus_points", "created_at", "paid_at", "updated_at") SELECT "out_trade_no", "trade_no", "draw_id", "linuxdo_user_id", "user_nickname_snapshot", "user_avatar_snapshot", "ticket_count", "unit_price_points", "money_points", "number", "status", "bonus_points", "created_at", "paid_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_orders_trade_no` ON `orders` (`trade_no`);--> statement-breakpoint
CREATE INDEX `idx_orders_draw` ON `orders` (`draw_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_user` ON `orders` (`linuxdo_user_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`);