CREATE TYPE "public"."meter_scope" AS ENUM('key', 'project');--> statement-breakpoint
DROP INDEX "usage_key_meter_window_idx";--> statement-breakpoint
ALTER TABLE "usage" ALTER COLUMN "api_key_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meters" ADD COLUMN "scope" "meter_scope" DEFAULT 'key' NOT NULL;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "usage" ADD CONSTRAINT "usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_scope_window_idx" ON "usage" USING btree ("meter_id","window_start",coalesce("api_key_id", "project_id"));