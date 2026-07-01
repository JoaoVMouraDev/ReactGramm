CREATE TABLE IF NOT EXISTS "conversations" (
  "id" serial PRIMARY KEY,
  "directKey" varchar(64) NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_directKey_unique" ON "conversations" ("directKey");

CREATE TABLE IF NOT EXISTS "conversation_members" (
  "id" serial PRIMARY KEY,
  "conversationId" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lastReadAt" timestamp DEFAULT now() NOT NULL,
  "joinedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_members_conversation_user_unique" ON "conversation_members" ("conversationId", "userId");
CREATE INDEX IF NOT EXISTS "conversation_members_userId_idx" ON "conversation_members" ("userId");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" serial PRIMARY KEY,
  "conversationId" integer NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "senderId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "text" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages" ("senderId");
