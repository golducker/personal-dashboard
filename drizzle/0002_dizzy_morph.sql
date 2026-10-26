ALTER TABLE "deadlines" ALTER COLUMN "due_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "row_key" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "group_label" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "group_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "assignee" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "done" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deadlines" ADD COLUMN "link" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_row_key_unique" UNIQUE("row_key");