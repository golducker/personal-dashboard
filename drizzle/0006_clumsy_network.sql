CREATE TABLE "daily_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_log" (
	"item_id" uuid NOT NULL,
	"day" text NOT NULL,
	CONSTRAINT "daily_log_item_id_day_pk" PRIMARY KEY("item_id","day")
);
