ALTER TABLE "conversations"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "conversation_members"
  ALTER COLUMN "lastReadAt" TYPE timestamptz USING "lastReadAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "joinedAt" TYPE timestamptz USING "joinedAt" AT TIME ZONE 'UTC';

ALTER TABLE "messages"
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC';
