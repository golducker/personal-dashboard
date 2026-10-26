ALTER TABLE "grade_events" ADD COLUMN "score_hash" text NOT NULL;--> statement-breakpoint
CREATE INDEX "ftu_snapshots_kind_fetched_idx" ON "ftu_snapshots" USING btree ("kind","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "grade_events_course_sem_hash_idx" ON "grade_events" USING btree ("course_code","semester","score_hash");