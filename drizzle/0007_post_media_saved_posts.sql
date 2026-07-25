CREATE TABLE IF NOT EXISTS "post_media" (
  "id" serial PRIMARY KEY,
  "postId" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "key" text NOT NULL,
  "type" varchar(8) NOT NULL CHECK ("type" IN ('image', 'gif')),
  "position" integer NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "post_media_postId_position_unique"
  ON "post_media" ("postId", "position");
CREATE INDEX IF NOT EXISTS "post_media_postId_idx" ON "post_media" ("postId");

INSERT INTO "post_media" ("postId", "url", "key", "type", "position")
SELECT "id", "imageUrl", "imageKey",
  CASE WHEN lower("imageUrl") LIKE '%.gif%' THEN 'gif' ELSE 'image' END,
  0
FROM "posts"
ON CONFLICT ("postId", "position") DO NOTHING;

CREATE TABLE IF NOT EXISTS "saved_posts" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "postId" integer NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_posts_userId_postId_unique"
  ON "saved_posts" ("userId", "postId");
CREATE INDEX IF NOT EXISTS "saved_posts_userId_createdAt_idx"
  ON "saved_posts" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "saved_posts_postId_idx" ON "saved_posts" ("postId");

ALTER TABLE "post_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_posts" ENABLE ROW LEVEL SECURITY;
