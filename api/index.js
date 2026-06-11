// server/_core/app.ts
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";

// server/db.ts
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var userRole = pgEnum("role", ["user", "admin"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  googleId: varchar("googleId", { length: 255 }).unique(),
  githubId: varchar("githubId", { length: 255 }).unique(),
  role: userRole("role").default("user").notNull(),
  username: varchar("username", { length: 64 }).unique(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  avatarKey: text("avatarKey"),
  emailVerified: timestamp("emailVerified"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    imageUrl: text("imageUrl").notNull(),
    imageKey: text("imageKey").notNull(),
    caption: text("caption"),
    hashtags: text("hashtags"),
    // JSON array stored as string
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull()
  },
  (table) => [index("posts_userId_idx").on(table.userId)]
);
var likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("likes_postId_userId_unique").on(table.postId, table.userId),
    index("likes_postId_idx").on(table.postId),
    index("likes_userId_idx").on(table.userId)
  ]
);
var comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    index("comments_postId_idx").on(table.postId),
    index("comments_userId_idx").on(table.userId)
  ]
);
var follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("followerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("followingId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("follows_follower_following_unique").on(
      table.followerId,
      table.followingId
    ),
    index("follows_followerId_idx").on(table.followerId),
    index("follows_followingId_idx").on(table.followingId)
  ]
);

// server/_core/env.ts
var ENV = {
  cookieSecret: process.env.JWT_SECRET ?? process.env.DATABASE_URL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminUsernames: (process.env.ADMIN_USERNAMES ?? "carlos992").split(",").map((username) => username.trim().toLowerCase()).filter(Boolean),
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  isProduction: process.env.NODE_ENV === "production",
  storageApiUrl: process.env.STORAGE_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  storageApiKey: process.env.STORAGE_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  vercelBlobToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",
  vercelBlobStoreId: process.env.BLOB_STORE_ID ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? ""
};

// server/db.ts
var _db = null;
function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !process.env.VERCEL) return connectionString;
  try {
    const url = new URL(connectionString);
    if (/^dpg-[a-z0-9]+-a$/.test(url.hostname)) {
      url.hostname = `${url.hostname}.ohio-postgres.render.com`;
      url.searchParams.set("sslmode", "require");
      return url.toString();
    }
  } catch {
    return connectionString;
  }
  return connectionString;
}
async function getDb() {
  if (!_db) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      console.error("[Database] DATABASE_URL is not defined in .env file");
      return null;
    }
    try {
      _db = drizzle(
        postgres(connectionString, {
          max: process.env.VERCEL ? 1 : 5,
          connect_timeout: 10,
          idle_timeout: 20
        })
      );
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function ensureDatabaseSchema() {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE TYPE role AS ENUM ('user', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      "openId" varchar(64) UNIQUE,
      name text,
      email varchar(320) UNIQUE,
      "passwordHash" text,
      "loginMethod" varchar(64),
      "googleId" varchar(255) UNIQUE,
      "githubId" varchar(255) UNIQUE,
      role role NOT NULL DEFAULT 'user',
      username varchar(64) UNIQUE,
      bio text,
      "avatarUrl" text,
      "avatarKey" text,
      "emailVerified" timestamp,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "lastSignedIn" timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS posts (
      id serial PRIMARY KEY,
      "userId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "imageUrl" text NOT NULL,
      "imageKey" text NOT NULL,
      caption text,
      hashtags text,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS likes (
      id serial PRIMARY KEY,
      "postId" integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      "userId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comments (
      id serial PRIMARY KEY,
      "postId" integer NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      "userId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS follows (
      id serial PRIMARY KEY,
      "followerId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "followingId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "posts_userId_idx" ON posts ("userId");`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "likes_postId_userId_unique" ON likes ("postId", "userId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "likes_postId_idx" ON likes ("postId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "likes_userId_idx" ON likes ("userId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comments_postId_idx" ON comments ("postId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comments_userId_idx" ON comments ("userId");`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "follows_follower_following_unique" ON follows ("followerId", "followingId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "follows_followerId_idx" ON follows ("followerId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "follows_followingId_idx" ON follows ("followingId");`);
}
var USER_SELECT = {
  id: users.id,
  openId: users.openId,
  name: users.name,
  email: users.email,
  passwordHash: users.passwordHash,
  loginMethod: users.loginMethod,
  googleId: users.googleId,
  githubId: users.githubId,
  role: users.role,
  username: users.username,
  bio: users.bio,
  avatarUrl: users.avatarUrl,
  avatarKey: users.avatarKey,
  emailVerified: users.emailVerified,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  lastSignedIn: users.lastSignedIn
};
function shouldBeAdmin(user) {
  const username = user.username?.toLowerCase();
  const email = user.email?.toLowerCase();
  return user.openId === ENV.ownerOpenId || Boolean(username && ENV.adminUsernames.includes(username)) || Boolean(email && ENV.adminEmails.includes(email));
}
async function applyAdminRole(user) {
  if (!user || user.role === "admin" || !shouldBeAdmin(user)) return user;
  const db = await getDb();
  if (!db) return user;
  await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  return { ...user, role: "admin" };
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    const val = user[field];
    if (val === void 0) continue;
    values[field] = updateSet[field] = val ?? null;
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  const now = /* @__PURE__ */ new Date();
  values.lastSignedIn = now;
  updateSet.lastSignedIn = now;
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = now;
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return applyAdminRole(result[0]);
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return applyAdminRole(result[0]);
}
async function getUserByUsername(username) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return applyAdminRole(result[0]);
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return applyAdminRole(result[0]);
}
async function getUserByGoogleId(googleId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return result[0];
}
async function getUserByGithubId(githubId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
  return result[0];
}
async function createUserWithEmail(data) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await db.insert(users).values({
    openId,
    email: data.email,
    passwordHash: data.passwordHash,
    username: data.username,
    name: data.name ?? data.username,
    loginMethod: "email",
    role: shouldBeAdmin({ openId, username: data.username, email: data.email }) ? "admin" : "user",
    lastSignedIn: /* @__PURE__ */ new Date()
  });
  const created = await getUserByEmail(data.email);
  if (!created) throw new Error("Failed to retrieve created user");
  return created;
}
async function upsertOAuthUser(data) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const existing = data.provider === "google" ? await getUserByGoogleId(data.providerId) : await getUserByGithubId(data.providerId);
  if (existing) {
    await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, existing.id));
    return existing;
  }
  if (data.email) {
    const byEmail = await getUserByEmail(data.email);
    if (byEmail) {
      const providerField2 = data.provider === "google" ? { googleId: data.providerId } : { githubId: data.providerId };
      await db.update(users).set({ ...providerField2, lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, byEmail.id));
      return byEmail;
    }
  }
  const openId = `${data.provider}_${data.providerId}`;
  const baseUsername = (data.email?.split("@")[0] ?? data.name ?? "user").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 20);
  const username = `${baseUsername}_${Date.now().toString(36)}`;
  const providerField = data.provider === "google" ? { googleId: data.providerId } : { githubId: data.providerId };
  await db.insert(users).values({
    openId,
    email: data.email ?? null,
    name: data.name ?? username,
    username,
    avatarUrl: data.avatarUrl ?? null,
    loginMethod: data.provider,
    role: shouldBeAdmin({ openId, username, email: data.email ?? null }) ? "admin" : "user",
    lastSignedIn: /* @__PURE__ */ new Date(),
    ...providerField
  });
  const created = data.email ? await getUserByEmail(data.email) : await getUserByOpenId(openId);
  if (!created) throw new Error("Failed to retrieve created user");
  return created;
}
async function updateUserProfile(userId, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}
async function searchUsers(query, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(
    or(
      like(users.username, `%${query}%`),
      like(users.name, `%${query}%`)
    )
  ).limit(limit);
}
async function createPost(data) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const [created] = await db.insert(posts).values(data).returning({ id: posts.id });
  return created.id;
}
async function deletePost(postId, userId, isAdmin = false) {
  const db = await getDb();
  if (!db) return;
  await db.delete(posts).where(isAdmin ? eq(posts.id, postId) : and(eq(posts.id, postId), eq(posts.userId, userId)));
}
async function getPostById(postId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    imageUrl: posts.imageUrl,
    imageKey: posts.imageKey,
    caption: posts.caption,
    hashtags: posts.hashtags,
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    user: USER_SELECT
  }).from(posts).innerJoin(users, eq(posts.userId, users.id)).where(eq(posts.id, postId)).limit(1);
  return result[0];
}
async function getFeedPosts(limit, offset) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    imageUrl: posts.imageUrl,
    imageKey: posts.imageKey,
    caption: posts.caption,
    hashtags: posts.hashtags,
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    user: USER_SELECT
  }).from(posts).innerJoin(users, eq(posts.userId, users.id)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
  return result;
}
async function getUserPosts(userId, limit, offset) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    imageUrl: posts.imageUrl,
    imageKey: posts.imageKey,
    caption: posts.caption,
    hashtags: posts.hashtags,
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt
  }).from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
  return result;
}
async function getPostsByHashtag(hashtag, limit, offset) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: posts.id,
    userId: posts.userId,
    imageUrl: posts.imageUrl,
    imageKey: posts.imageKey,
    caption: posts.caption,
    hashtags: posts.hashtags,
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
    createdAt: posts.createdAt,
    updatedAt: posts.updatedAt,
    user: USER_SELECT
  }).from(posts).innerJoin(users, eq(posts.userId, users.id)).where(like(posts.hashtags, `%"${hashtag}"%`)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
  return result;
}
async function toggleLike(userId, postId) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const existing = await db.select().from(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId))).limit(1);
  if (existing.length > 0) {
    await db.delete(likes).where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    return { liked: false };
  } else {
    await db.insert(likes).values({ userId, postId });
    return { liked: true };
  }
}
async function getLikesByPost(postId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(likes).where(eq(likes.postId, postId));
}
async function getUserLikedPostIds(userId, postIds) {
  if (postIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ postId: likes.postId }).from(likes).where(and(eq(likes.userId, userId), inArray(likes.postId, postIds)));
  return result.map((r) => r.postId);
}
async function createComment(data) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const [created] = await db.insert(comments).values(data).returning({ id: comments.id });
  return created.id;
}
async function getCommentsByPost(postId) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    id: comments.id,
    postId: comments.postId,
    userId: comments.userId,
    text: comments.text,
    createdAt: comments.createdAt,
    user: USER_SELECT
  }).from(comments).innerJoin(users, eq(comments.userId, users.id)).where(eq(comments.postId, postId)).orderBy(comments.createdAt);
  return result;
}
async function getNotificationsForUser(userId, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const [followEvents, likeEvents, commentEvents] = await Promise.all([
    db.select({
      id: follows.id,
      createdAt: follows.createdAt,
      actor: {
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl
      }
    }).from(follows).innerJoin(users, eq(follows.followerId, users.id)).where(and(eq(follows.followingId, userId), sql`${follows.followerId} <> ${userId}`)).orderBy(desc(follows.createdAt)).limit(limit),
    db.select({
      id: likes.id,
      postId: likes.postId,
      createdAt: likes.createdAt,
      actor: {
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl
      }
    }).from(likes).innerJoin(posts, eq(likes.postId, posts.id)).innerJoin(users, eq(likes.userId, users.id)).where(and(eq(posts.userId, userId), sql`${likes.userId} <> ${userId}`)).orderBy(desc(likes.createdAt)).limit(limit),
    db.select({
      id: comments.id,
      postId: comments.postId,
      text: comments.text,
      createdAt: comments.createdAt,
      actor: {
        id: users.id,
        username: users.username,
        name: users.name,
        avatarUrl: users.avatarUrl
      }
    }).from(comments).innerJoin(posts, eq(comments.postId, posts.id)).innerJoin(users, eq(comments.userId, users.id)).where(and(eq(posts.userId, userId), sql`${comments.userId} <> ${userId}`)).orderBy(desc(comments.createdAt)).limit(limit)
  ]);
  return [
    ...followEvents.map((event) => ({
      id: `follow-${event.id}`,
      type: "follow",
      actor: event.actor,
      postId: null,
      text: null,
      createdAt: event.createdAt
    })),
    ...likeEvents.map((event) => ({
      id: `like-${event.id}`,
      type: "like",
      actor: event.actor,
      postId: event.postId,
      text: null,
      createdAt: event.createdAt
    })),
    ...commentEvents.map((event) => ({
      id: `comment-${event.id}`,
      type: "comment",
      actor: event.actor,
      postId: event.postId,
      text: event.text,
      createdAt: event.createdAt
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
async function toggleFollow(followerId, followingId) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const existing = await db.select().from(follows).where(
    and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
  ).limit(1);
  if (existing.length > 0) {
    await db.delete(follows).where(
      and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
    );
    return { following: false };
  } else {
    await db.insert(follows).values({ followerId, followingId });
    return { following: true };
  }
}
async function getFollowersCount(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(follows).where(eq(follows.followingId, userId));
  return Number(result[0]?.count ?? 0);
}
async function getFollowingCount(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(follows).where(eq(follows.followerId, userId));
  return Number(result[0]?.count ?? 0);
}
async function isFollowing(followerId, followingId) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(follows).where(
    and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
  ).limit(1);
  return result.length > 0;
}
async function getPostsCount(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql`count(*)` }).from(posts).where(eq(posts.userId, userId));
  return Number(result[0]?.count ?? 0);
}

// server/routers.ts
import { z } from "zod";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// server/_core/trpc.ts
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  }))
});

// server/routers.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
import { nanoid } from "nanoid";

// server/auth.ts
import crypto2 from "crypto";
function hashPassword(password) {
  return crypto2.createHash("sha256").update(password).digest("hex");
}
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}
function validatePasswordStrength(password) {
  const errors = [];
  if (!password) {
    errors.push("Senha \xE9 obrigat\xF3ria");
  } else if (password.length < 6) {
    errors.push("Senha deve ter no m\xEDnimo 6 caracteres");
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
function validateUsername(username) {
  const errors = [];
  if (!username) {
    errors.push("Username \xE9 obrigat\xF3rio");
  } else if (username.length < 3) {
    errors.push("Username deve ter no m\xEDnimo 3 caracteres");
  } else if (username.length > 30) {
    errors.push("Username deve ter no m\xE1ximo 30 caracteres");
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push("Username pode conter apenas letras, n\xFAmeros e underscore");
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}

// server/routers.ts
import { eq as eq2 } from "drizzle-orm";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var SessionService = class {
  parseCookies(cookieHeader) {
    if (!cookieHeader) return /* @__PURE__ */ new Map();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) {
      throw new Error("JWT_SECRET or DATABASE_URL is required for sessions");
    }
    return new TextEncoder().encode(secret);
  }
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) return null;
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, name } = payload;
      if (!isNonEmptyString(openId)) return null;
      return {
        openId,
        name: typeof name === "string" ? name : ""
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const signedInAt = /* @__PURE__ */ new Date();
    const user = await getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SessionService();

// server/storage.ts
import "dotenv/config";
import { put } from "@vercel/blob";
import fs from "node:fs";
import path from "node:path";
function getStorageConfig() {
  const serviceUrl = ENV.storageApiUrl;
  const serviceKey = ENV.storageApiKey;
  const isLocal = !serviceKey || serviceKey.includes("insira_aqui") || serviceKey.includes("placeholder");
  console.log("[Storage] Config:", {
    hasUrl: Boolean(serviceUrl),
    mode: isLocal ? "LOCAL_DEV" : "REMOTE_STORAGE"
  });
  if (!isLocal && (!serviceUrl || !serviceKey)) {
    throw new Error("Storage config missing: set STORAGE_API_URL and STORAGE_API_KEY");
  }
  return {
    serviceUrl: serviceUrl.replace(/\/+$/, ""),
    serviceKey,
    isLocal
  };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { serviceUrl, serviceKey, isLocal } = getStorageConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  if (ENV.vercelBlobToken || ENV.vercelBlobStoreId) {
    const body = typeof data === "string" ? data : Buffer.from(data);
    const blob2 = await put(key, body, {
      access: "public",
      contentType,
      ...ENV.vercelBlobToken ? { token: ENV.vercelBlobToken } : {}
    });
    return { key, url: blob2.url };
  }
  if (isLocal) {
    if (ENV.isProduction) {
      const encoded = Buffer.from(data).toString("base64");
      return { key, url: `data:${contentType};base64,${encoded}` };
    }
    const storageDir = path.resolve(
      process.cwd(),
      "client",
      "public",
      "local-storage"
    );
    const fullPath = path.join(storageDir, key);
    if (!fs.existsSync(path.dirname(fullPath))) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
    fs.writeFileSync(fullPath, Buffer.from(data));
    return { key, url: `/local-storage/${key}` };
  }
  const presignUrl = new URL("v1/storage/presign/put", `${serviceUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${serviceKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: uploadUrl } = await presignResp.json();
  if (!uploadUrl) {
    throw new Error("Storage service returned an empty upload URL");
  }
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload failed (${uploadResp.status})`);
  }
  return { key, url: `/media/${key}` };
}

// server/routers.ts
var ONE_YEAR_MS2 = 365 * 24 * 60 * 60 * 1e3;
var COOKIE_NAME2 = "app_session_id";
var uploadRouter = router({
  image: protectedProcedure.input(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      base64: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const ext = input.filename.split(".").pop() ?? "jpg";
    const key = `posts/${ctx.user.id}/${nanoid()}.${ext}`;
    const buffer = Buffer.from(input.base64, "base64");
    const { url } = await storagePut(key, buffer, input.contentType);
    return { url, key };
  }),
  avatar: protectedProcedure.input(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      base64: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const ext = input.filename.split(".").pop() ?? "jpg";
    const key = `avatars/${ctx.user.id}/${nanoid()}.${ext}`;
    const buffer = Buffer.from(input.base64, "base64");
    const { url } = await storagePut(key, buffer, input.contentType);
    return { url, key };
  })
});
var postsRouter = router({
  feed: publicProcedure.input(z.object({ limit: z.number().default(20), offset: z.number().default(0) })).query(async ({ input, ctx }) => {
    const feedPosts = await getFeedPosts(input.limit, input.offset);
    let likedPostIds = [];
    if (ctx.user) {
      const ids = feedPosts.map((p) => p.id);
      likedPostIds = await getUserLikedPostIds(ctx.user.id, ids);
    }
    return feedPosts.map((p) => ({
      ...p,
      hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
      isLiked: likedPostIds.includes(p.id)
    }));
  }),
  create: protectedProcedure.input(
    z.object({
      imageUrl: z.string(),
      imageKey: z.string(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const postId = await createPost({
      userId: ctx.user.id,
      imageUrl: input.imageUrl,
      imageKey: input.imageKey,
      caption: input.caption ?? null,
      hashtags: input.hashtags ? JSON.stringify(input.hashtags) : null
    });
    return { id: postId };
  }),
  getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const post = await getPostById(input.id);
    if (!post) throw new TRPCError2({ code: "NOT_FOUND" });
    const likedPostIds = ctx.user ? await getUserLikedPostIds(ctx.user.id, [post.id]) : [];
    return {
      ...post,
      hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
      isLiked: likedPostIds.includes(post.id)
    };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await deletePost(input.id, ctx.user.id, ctx.user.role === "admin");
    return { success: true };
  }),
  byUser: publicProcedure.input(
    z.object({
      userId: z.number(),
      limit: z.number().default(30),
      offset: z.number().default(0)
    })
  ).query(async ({ input, ctx }) => {
    const userPosts = await getUserPosts(input.userId, input.limit, input.offset);
    let likedPostIds = [];
    if (ctx.user) {
      const ids = userPosts.map((p) => p.id);
      likedPostIds = await getUserLikedPostIds(ctx.user.id, ids);
    }
    return userPosts.map((p) => ({
      ...p,
      hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
      isLiked: likedPostIds.includes(p.id)
    }));
  }),
  byHashtag: publicProcedure.input(
    z.object({
      hashtag: z.string(),
      limit: z.number().default(20),
      offset: z.number().default(0)
    })
  ).query(async ({ input }) => {
    const tagPosts = await getPostsByHashtag(input.hashtag, input.limit, input.offset);
    return tagPosts.map((p) => ({
      ...p,
      hashtags: p.hashtags ? JSON.parse(p.hashtags) : []
    }));
  })
});
var likesRouter = router({
  toggle: protectedProcedure.input(z.object({ postId: z.number() })).mutation(async ({ input, ctx }) => {
    return toggleLike(ctx.user.id, input.postId);
  }),
  getByPost: publicProcedure.input(z.object({ postId: z.number() })).query(async ({ input }) => {
    return getLikesByPost(input.postId);
  })
});
var commentsRouter = router({
  create: protectedProcedure.input(z.object({ postId: z.number(), text: z.string().min(1).max(500) })).mutation(async ({ input, ctx }) => {
    const id = await createComment({
      postId: input.postId,
      userId: ctx.user.id,
      text: input.text
    });
    return { id };
  }),
  getByPost: publicProcedure.input(
    z.object({
      postId: z.number(),
      limit: z.number().default(20),
      offset: z.number().default(0)
    })
  ).query(async ({ input }) => {
    return getCommentsByPost(input.postId);
  })
});
var authRouter = router({
  signup: publicProcedure.input(
    z.object({
      email: z.string().email(),
      password: z.string(),
      username: z.string(),
      name: z.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    if (!validateEmail(input.email)) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "Email inv\xE1lido" });
    }
    const passwordValidation = validatePasswordStrength(input.password);
    if (!passwordValidation.isValid) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: passwordValidation.errors[0] });
    }
    const usernameValidation = validateUsername(input.username);
    if (!usernameValidation.isValid) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: usernameValidation.errors[0] });
    }
    const existingEmail = await getUserByEmail(input.email);
    if (existingEmail) {
      throw new TRPCError2({ code: "CONFLICT", message: "Email j\xE1 cadastrado" });
    }
    const existingUsername = await getUserByUsername(input.username);
    if (existingUsername) {
      throw new TRPCError2({ code: "CONFLICT", message: "Username j\xE1 cadastrado" });
    }
    const passwordHash = hashPassword(input.password);
    const user = await createUserWithEmail({
      email: input.email,
      passwordHash,
      username: input.username,
      name: input.name
    });
    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name ?? "",
      expiresInMs: ONE_YEAR_MS2
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME2, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS2 });
    return { success: true };
  }),
  login: publicProcedure.input(
    z.object({
      email: z.string().email(),
      password: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const foundUser = await getUserByEmail(input.email);
    if (!foundUser) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: "Email ou senha inv\xE1lidos" });
    }
    if (!foundUser.passwordHash || !verifyPassword(input.password, foundUser.passwordHash)) {
      throw new TRPCError2({ code: "UNAUTHORIZED", message: "Email ou senha inv\xE1lidos" });
    }
    const db = await getDb();
    if (db) {
      await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq2(users.id, foundUser.id));
    }
    const sessionToken = await sdk.createSessionToken(foundUser.openId, {
      name: foundUser.name ?? "",
      expiresInMs: ONE_YEAR_MS2
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME2, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS2 });
    return { success: true };
  })
});
var followsRouter = router({
  toggle: protectedProcedure.input(z.object({ userId: z.number() })).mutation(async ({ input, ctx }) => {
    if (input.userId === ctx.user.id) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
    }
    return toggleFollow(ctx.user.id, input.userId);
  }),
  isFollowing: publicProcedure.input(z.object({ followerId: z.number(), followingId: z.number() })).query(async ({ input }) => {
    return { following: await isFollowing(input.followerId, input.followingId) };
  }),
  getFollowersCount: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
    return { count: await getFollowersCount(input.userId) };
  }),
  getFollowingCount: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
    return { count: await getFollowingCount(input.userId) };
  })
});
var notificationsRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().min(1).max(50).default(20) })).query(async ({ input, ctx }) => {
    return getNotificationsForUser(ctx.user.id, input.limit);
  })
});
var usersRouter = router({
  getProfile: publicProcedure.input(z.object({ username: z.string() })).query(async ({ input, ctx }) => {
    const user = await getUserByUsername(input.username);
    if (!user) throw new TRPCError2({ code: "NOT_FOUND", message: "User not found" });
    const [followersCount, followingCount, postsCount] = await Promise.all([
      getFollowersCount(user.id),
      getFollowingCount(user.id),
      getPostsCount(user.id)
    ]);
    let isFollowingUser = false;
    if (ctx.user && ctx.user.id !== user.id) {
      isFollowingUser = await isFollowing(ctx.user.id, user.id);
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount,
      followingCount,
      postsCount,
      isFollowing: isFollowingUser,
      isOwner: ctx.user?.id === user.id
    };
  }),
  getProfileById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const user = await getUserById(input.id);
    if (!user) throw new TRPCError2({ code: "NOT_FOUND", message: "User not found" });
    const [followersCount, followingCount, postsCount] = await Promise.all([
      getFollowersCount(user.id),
      getFollowingCount(user.id),
      getPostsCount(user.id)
    ]);
    let isFollowingUser = false;
    if (ctx.user && ctx.user.id !== user.id) {
      isFollowingUser = await isFollowing(ctx.user.id, user.id);
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount,
      followingCount,
      postsCount,
      isFollowing: isFollowingUser,
      isOwner: ctx.user?.id === user.id
    };
  }),
  updateProfile: protectedProcedure.input(
    z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
      bio: z.string().max(150).optional(),
      avatarUrl: z.string().optional(),
      avatarKey: z.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    if (input.username) {
      const existing = await getUserByUsername(input.username);
      if (existing && existing.id !== ctx.user.id) {
        throw new TRPCError2({ code: "CONFLICT", message: "Username already taken" });
      }
    }
    await updateUserProfile(ctx.user.id, input);
    return { success: true };
  }),
  search: publicProcedure.input(z.object({ query: z.string().min(1), limit: z.number().default(10) })).query(async ({ input }) => {
    const results = await searchUsers(input.query, input.limit);
    return results.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatarUrl: u.avatarUrl
    }));
  }),
  // Unified search: users + hashtag posts
  unifiedSearch: publicProcedure.input(z.object({ query: z.string().min(1), limit: z.number().default(8) })).query(async ({ input }) => {
    const [userResults, hashtagPosts] = await Promise.all([
      searchUsers(input.query, input.limit),
      getPostsByHashtag(input.query.replace(/^#/, ""), input.limit, 0)
    ]);
    return {
      users: userResults.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatarUrl: u.avatarUrl
      })),
      hashtags: hashtagPosts.length > 0 ? [{ tag: input.query.replace(/^#/, ""), postsCount: hashtagPosts.length }] : []
    };
  }),
  getHoverCard: publicProcedure.input(z.object({ username: z.string() })).query(async ({ input, ctx }) => {
    const user = await getUserByUsername(input.username);
    if (!user) throw new TRPCError2({ code: "NOT_FOUND" });
    const [followersCount, followingCount, postsCount] = await Promise.all([
      getFollowersCount(user.id),
      getFollowingCount(user.id),
      getPostsCount(user.id)
    ]);
    let isFollowingUser = false;
    if (ctx.user && ctx.user.id !== user.id) {
      isFollowingUser = await isFollowing(ctx.user.id, user.id);
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      followersCount,
      followingCount,
      postsCount,
      isFollowing: isFollowingUser
    };
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME2, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    signup: authRouter.signup,
    login: authRouter.login
  }),
  upload: uploadRouter,
  posts: postsRouter,
  likes: likesRouter,
  comments: commentsRouter,
  follows: followsRouter,
  notifications: notificationsRouter,
  users: usersRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() || req.protocol || "https";
  return `${proto}://${req.get("host")}`;
}
async function setSessionCookie(res, req, openId, name) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}
function registerOAuthRoutes(app) {
  app.get("/api/auth/google", (req, res) => {
    if (!ENV.googleClientId) {
      res.status(503).json({ error: "Google OAuth not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline"
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    if (!code) {
      res.redirect("/login?error=google_denied");
      return;
    }
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: `${getBaseUrl(req)}/api/auth/google/callback`,
          grant_type: "authorization_code"
        })
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) throw new Error("No access_token from Google");
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const googleUser = await userRes.json();
      if (!googleUser.id) throw new Error("No user id from Google");
      const user = await upsertOAuthUser({
        provider: "google",
        providerId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.picture
      });
      await setSessionCookie(res, req, user.openId, user.name ?? "");
      res.redirect("/");
    } catch (err) {
      console.error("[OAuth] Google callback failed", err);
      res.redirect("/login?error=google_failed");
    }
  });
  app.get("/api/auth/github", (req, res) => {
    if (!ENV.githubClientId) {
      res.status(503).json({ error: "GitHub OAuth not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id: ENV.githubClientId,
      redirect_uri: `${getBaseUrl(req)}/api/auth/github/callback`,
      scope: "read:user user:email"
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });
  app.get("/api/auth/github/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    if (!code) {
      res.redirect("/login?error=github_denied");
      return;
    }
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          client_id: ENV.githubClientId,
          client_secret: ENV.githubClientSecret,
          code,
          redirect_uri: `${getBaseUrl(req)}/api/auth/github/callback`
        })
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) throw new Error("No access_token from GitHub");
      const [userRes, emailsRes] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/vnd.github+json"
          }
        }),
        fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Accept: "application/vnd.github+json"
          }
        })
      ]);
      const githubUser = await userRes.json();
      const emails = await emailsRes.json();
      const primaryEmail = Array.isArray(emails) ? emails.find((email) => email.primary && email.verified)?.email ?? emails[0]?.email : void 0;
      if (!githubUser.id) throw new Error("No user id from GitHub");
      const user = await upsertOAuthUser({
        provider: "github",
        providerId: String(githubUser.id),
        email: primaryEmail ?? githubUser.email ?? void 0,
        name: githubUser.name ?? githubUser.login,
        avatarUrl: githubUser.avatar_url
      });
      await setSessionCookie(res, req, user.openId, user.name ?? "");
      res.redirect("/");
    } catch (err) {
      console.error("[OAuth] GitHub callback failed", err);
      res.redirect("/login?error=github_failed");
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get(["/media/*", "/manus-storage/*"], async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.storageApiUrl || !ENV.storageApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const storageUrl = new URL(
        "v1/storage/presign/get",
        ENV.storageApiUrl.replace(/\/+$/, "") + "/"
      );
      storageUrl.searchParams.set("path", key);
      const storageResp = await fetch(storageUrl, {
        headers: { Authorization: `Bearer ${ENV.storageApiKey}` }
      });
      if (!storageResp.ok) {
        const body = await storageResp.text().catch(() => "");
        console.error(`[StorageProxy] storage error: ${storageResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await storageResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/app.ts
ensureDatabaseSchema().catch((error) => {
  console.error("[Database] Schema initialization failed:", error);
});
function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const storageKey = ENV.storageApiKey;
  const isLocalStorage = !storageKey || storageKey.includes("placeholder") || storageKey.includes("insira");
  if (!isLocalStorage) {
    registerStorageProxy(app);
  }
  registerOAuthRoutes(app);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/_core/vercel.ts
var vercel_default = createApp();
export {
  vercel_default as default
};
