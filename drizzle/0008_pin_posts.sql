ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "isPinned" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "pinnedAt" timestamp;
--> statement-breakpoint
UPDATE "posts" SET "isPinned" = true WHERE "pinnedAt" IS NOT NULL AND "isPinned" = false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_userId_isPinned_idx" ON "posts" ("userId", "isPinned");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_userId_pinnedAt_idx" ON "posts" ("userId", "pinnedAt");
