ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "postId" integer;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_postId_posts_id_fk'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_postId_posts_id_fk"
      FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "messages_postId_idx" ON "messages" ("postId");
