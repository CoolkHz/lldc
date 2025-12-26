ALTER TABLE `orders` ADD `number` text NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `numbers_json`;--> statement-breakpoint
ALTER TABLE `tickets` ADD `ticket_count` integer DEFAULT 1 NOT NULL;