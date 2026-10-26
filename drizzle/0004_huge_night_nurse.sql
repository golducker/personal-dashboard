ALTER TABLE "deadlines" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "last_ok_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "failures" integer DEFAULT 0 NOT NULL;