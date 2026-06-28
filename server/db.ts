import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  Comment,
  Follow,
  InsertComment,
  InsertFollow,
  InsertLike,
  InsertPost,
  InsertUser,
  Like,
  Post,
  User,
  commentLikes,
  comments,
  follows,
  likes,
  posts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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

export async function getDb() {
  if (!_db) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      console.error("[Database] DATABASE_URL is not defined in .env file");
      return null;
    }
    try {
      const connectionUrl = new URL(connectionString);
      const usesTransactionPooler =
        connectionUrl.hostname.endsWith(".pooler.supabase.com") && connectionUrl.port === "6543";

      _db = drizzle(
        postgres(connectionString, {
          max: process.env.VERCEL ? 1 : 5,
          connect_timeout: 10,
          idle_timeout: 20,
          prepare: !usesTransactionPooler,
        }),
      );
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function ensureDatabaseSchema(): Promise<void> {
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
      "parentCommentId" integer REFERENCES comments(id) ON DELETE CASCADE,
      text text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`ALTER TABLE comments ADD COLUMN IF NOT EXISTS "parentCommentId" integer;`);
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'comments_parentCommentId_comments_id_fk'
      ) THEN
        ALTER TABLE comments
          ADD CONSTRAINT "comments_parentCommentId_comments_id_fk"
          FOREIGN KEY ("parentCommentId") REFERENCES comments(id) ON DELETE CASCADE;
      END IF;
    END $$;
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
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comments_parentCommentId_idx" ON comments ("parentCommentId");`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id serial PRIMARY KEY,
      "commentId" integer NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      "userId" integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "createdAt" timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "comment_likes_commentId_userId_unique" ON comment_likes ("commentId", "userId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comment_likes_commentId_idx" ON comment_likes ("commentId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comment_likes_userId_idx" ON comment_likes ("userId");`);

  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "follows_follower_following_unique" ON follows ("followerId", "followingId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "follows_followerId_idx" ON follows ("followerId");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "follows_followingId_idx" ON follows ("followingId");`);
}

// ─── Shared Selects ──────────────────────────────────────────────────────────

const USER_SELECT = {
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
  lastSignedIn: users.lastSignedIn,
};

function shouldBeAdmin(user: Pick<User, "openId" | "username" | "email">): boolean {
  const username = user.username?.toLowerCase();
  const email = user.email?.toLowerCase();
  return (
    user.openId === ENV.ownerOpenId ||
    Boolean(username && ENV.adminUsernames.includes(username)) ||
    Boolean(email && ENV.adminEmails.includes(email))
  );
}

async function applyAdminRole(user: User | undefined): Promise<User | undefined> {
  if (!user || user.role === "admin" || !shouldBeAdmin(user)) return user;

  const db = await getDb();
  if (!db) return user;

  await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  return { ...user, role: "admin" };
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const val = user[field];
    if (val === undefined) continue;
    values[field] = updateSet[field] = val ?? null;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  // Ensure lastSignedIn is always updated on upsert
  const now = new Date();
  values.lastSignedIn = now;
  updateSet.lastSignedIn = now;

  // If for some reason we have an empty update, we still want to touch the record
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = now;

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return applyAdminRole(result[0]);
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return applyAdminRole(result[0]);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return applyAdminRole(result[0]);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return applyAdminRole(result[0]);
}

export async function getUserByGoogleId(googleId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return result[0];
}

export async function getUserByGithubId(githubId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
  return result[0];
}

export async function createUserWithEmail(data: {
  email: string;
  passwordHash: string;
  username: string;
  name?: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Generate a unique openId for email-based users
  const openId = `email_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await db.insert(users).values({
    openId,
    email: data.email,
    passwordHash: data.passwordHash,
    username: data.username,
    name: data.name ?? data.username,
    loginMethod: "email",
    role: shouldBeAdmin({ openId, username: data.username, email: data.email })
      ? "admin"
      : "user",
    lastSignedIn: new Date(),
  });

  const created = await getUserByEmail(data.email);
  if (!created) throw new Error("Failed to retrieve created user");
  return created;
}

export async function upsertOAuthUser(data: {
  provider: "google" | "github";
  providerId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Check if user already exists for this provider
  const existing =
    data.provider === "google"
      ? await getUserByGoogleId(data.providerId)
      : await getUserByGithubId(data.providerId);

  if (existing) {
    await db
      .update(users)
      .set({ lastSignedIn: new Date() })
      .where(eq(users.id, existing.id));
    return existing;
  }

  // Check if email is already registered (link accounts)
  if (data.email) {
    const byEmail = await getUserByEmail(data.email);
    if (byEmail) {
      const providerField = data.provider === "google" ? { googleId: data.providerId } : { githubId: data.providerId };
      await db
        .update(users)
        .set({ ...providerField, lastSignedIn: new Date() })
        .where(eq(users.id, byEmail.id));
      return byEmail;
    }
  }

  // Create new user
  const openId = `${data.provider}_${data.providerId}`;
  const baseUsername = (data.email?.split("@")[0] ?? data.name ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 20);
  const username = `${baseUsername}_${Date.now().toString(36)}`;

  const providerField = data.provider === "google"
    ? { googleId: data.providerId }
    : { githubId: data.providerId };

  await db.insert(users).values({
    openId,
    email: data.email ?? null,
    name: data.name ?? username,
    username,
    avatarUrl: data.avatarUrl ?? null,
    loginMethod: data.provider,
    role: shouldBeAdmin({ openId, username, email: data.email ?? null })
      ? "admin"
      : "user",
    lastSignedIn: new Date(),
    ...providerField,
  });

  const created = data.email
    ? await getUserByEmail(data.email)
    : await getUserByOpenId(openId);
  if (!created) throw new Error("Failed to retrieve created user");
  return created;
}

export async function updateUserProfile(
  userId: number,
  data: { username?: string; bio?: string; avatarUrl?: string; avatarKey?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function searchUsers(query: string, limit = 10): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(
      or(
        like(users.username, `%${query}%`),
        like(users.name, `%${query}%`)
      )
    )
    .limit(limit);
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function createPost(data: InsertPost): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const [created] = await db.insert(posts).values(data).returning({ id: posts.id });
  return created.id;
}

export async function updatePost(
  postId: number,
  userId: number,
  data: { caption: string | null; hashtags: string | null },
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  const updated = await db
    .update(posts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .returning({ id: posts.id });
  return updated.length > 0;
}

export async function deletePost(
  postId: number,
  userId: number,
  isAdmin = false
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(posts)
    .where(isAdmin ? eq(posts.id, postId) : and(eq(posts.id, postId), eq(posts.userId, userId)));
}

export async function getPostById(
  postId: number
): Promise<(Post & { user: User; likesCount: number; commentsCount: number }) | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      caption: posts.caption,
      hashtags: posts.hashtags,
      likesCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
      commentsCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: USER_SELECT,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.id, postId))
    .limit(1);
  return result[0] as any;
}

export async function getFeedPosts(
  limit: number,
  offset: number
): Promise<(Post & { user: User })[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      caption: posts.caption,
      hashtags: posts.hashtags,
      likesCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
      commentsCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: USER_SELECT,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
  return result as any;
}

export async function getUserPosts(
  userId: number,
  limit: number,
  offset: number
): Promise<(Post & { likesCount: number; commentsCount: number })[]> {
  const db = await getDb();
  if (!db) return [];
  const userPosts = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      caption: posts.caption,
      hashtags: posts.hashtags,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);

  const postIds = userPosts.map((post) => post.id);
  if (postIds.length === 0) return [];

  const [likeCounts, commentCounts] = await Promise.all([
    db
      .select({
        postId: likes.postId,
        count: sql<number>`CAST(count(*) AS INTEGER)`,
      })
      .from(likes)
      .where(inArray(likes.postId, postIds))
      .groupBy(likes.postId),
    db
      .select({
        postId: comments.postId,
        count: sql<number>`CAST(count(*) AS INTEGER)`,
      })
      .from(comments)
      .where(inArray(comments.postId, postIds))
      .groupBy(comments.postId),
  ]);

  const likesByPost = new Map(likeCounts.map((row) => [row.postId, Number(row.count)]));
  const commentsByPost = new Map(
    commentCounts.map((row) => [row.postId, Number(row.count)]),
  );

  return userPosts.map((post) => ({
    ...post,
    likesCount: likesByPost.get(post.id) ?? 0,
    commentsCount: commentsByPost.get(post.id) ?? 0,
  }));
}

export async function getPostsByHashtag(
  hashtag: string,
  limit: number,
  offset: number
): Promise<(Post & { user: User })[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: posts.id,
      userId: posts.userId,
      imageUrl: posts.imageUrl,
      imageKey: posts.imageKey,
      caption: posts.caption,
      hashtags: posts.hashtags,
      likesCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS INTEGER)`,
      commentsCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS INTEGER)`,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      user: USER_SELECT,
    })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(like(posts.hashtags, `%"${hashtag}"%`))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
  return result as any;
}

export async function toggleLike(
  userId: number,
  postId: number
): Promise<{ liked: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const existing = await db
    .select()
    .from(likes)
    .where(and(eq(likes.userId, userId), eq(likes.postId, postId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.postId, postId)));
    return { liked: false };
  } else {
    await db.insert(likes).values({ userId, postId });
    return { liked: true };
  }
}

export async function getLikesByPost(postId: number): Promise<Like[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(likes).where(eq(likes.postId, postId));
}

export async function getUserLikedPostIds(
  userId: number,
  postIds: number[]
): Promise<number[]> {
  if (postIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(eq(likes.userId, userId), inArray(likes.postId, postIds)));
  return result.map((r) => r.postId);
}

export async function createComment(data: InsertComment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  if (data.parentCommentId) {
    const [parent] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, data.parentCommentId), eq(comments.postId, data.postId)))
      .limit(1);

    if (!parent) throw new Error("Comentário original não encontrado");
  }

  const [created] = await db
    .insert(comments)
    .values(data)
    .returning({ id: comments.id });
  return created.id;
}

export async function getCommentsByPost(
  postId: number,
  currentUserId?: number
): Promise<(Comment & { user: User; likesCount: number; isLiked: boolean })[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      parentCommentId: comments.parentCommentId,
      text: comments.text,
      createdAt: comments.createdAt,
      likesCount: sql<number>`CAST(COALESCE((SELECT count(*) FROM ${commentLikes} WHERE ${commentLikes.commentId} = ${comments.id}), 0) AS INTEGER)`,
      isLiked: currentUserId
        ? sql<boolean>`EXISTS(SELECT 1 FROM ${commentLikes} WHERE ${commentLikes.commentId} = ${comments.id} AND ${commentLikes.userId} = ${currentUserId})`
        : sql<boolean>`false`,
      user: USER_SELECT,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);
  return result as (Comment & { user: User; likesCount: number; isLiked: boolean })[];
}

export async function toggleCommentLike(
  userId: number,
  commentId: number
): Promise<{ liked: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const existing = await db
    .select()
    .from(commentLikes)
    .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.userId, userId), eq(commentLikes.commentId, commentId)));
    return { liked: false };
  }

  await db.insert(commentLikes).values({ userId, commentId });
  return { liked: true };
}

export type AppNotification = {
  id: string;
  type: "follow" | "like" | "comment" | "reply" | "comment_like";
  actor: Pick<User, "id" | "username" | "name" | "avatarUrl">;
  postId: number | null;
  text: string | null;
  createdAt: Date;
};

export async function getNotificationsForUser(
  userId: number,
  limit = 20
): Promise<AppNotification[]> {
  const db = await getDb();
  if (!db) return [];
  const parentComments = alias(comments, "parent_comments");

  const [followEvents, likeEvents, commentEvents, replyEvents, commentLikeEvents] = await Promise.all([
    db
      .select({
        id: follows.id,
        createdAt: follows.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(and(eq(follows.followingId, userId), sql`${follows.followerId} <> ${userId}`))
      .orderBy(desc(follows.createdAt))
      .limit(limit),

    db
      .select({
        id: likes.id,
        postId: likes.postId,
        createdAt: likes.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(likes)
      .innerJoin(posts, eq(likes.postId, posts.id))
      .innerJoin(users, eq(likes.userId, users.id))
      .where(and(eq(posts.userId, userId), sql`${likes.userId} <> ${userId}`))
      .orderBy(desc(likes.createdAt))
      .limit(limit),

    db
      .select({
        id: comments.id,
        postId: comments.postId,
        text: comments.text,
        createdAt: comments.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(users, eq(comments.userId, users.id))
      .where(and(eq(posts.userId, userId), sql`${comments.userId} <> ${userId}`))
      .orderBy(desc(comments.createdAt))
      .limit(limit),

    db
      .select({
        id: comments.id,
        postId: comments.postId,
        text: comments.text,
        createdAt: comments.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(comments)
      .innerJoin(parentComments, eq(comments.parentCommentId, parentComments.id))
      .innerJoin(posts, eq(comments.postId, posts.id))
      .innerJoin(users, eq(comments.userId, users.id))
      .where(
        and(
          eq(parentComments.userId, userId),
          sql`${posts.userId} <> ${userId}`,
          sql`${comments.userId} <> ${userId}`,
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(limit),

    db
      .select({
        id: commentLikes.id,
        commentId: commentLikes.commentId,
        postId: comments.postId,
        createdAt: commentLikes.createdAt,
        actor: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(commentLikes)
      .innerJoin(comments, eq(commentLikes.commentId, comments.id))
      .innerJoin(users, eq(commentLikes.userId, users.id))
      .where(and(eq(comments.userId, userId), sql`${commentLikes.userId} <> ${userId}`))
      .orderBy(desc(commentLikes.createdAt))
      .limit(limit),
  ]);

  return [
    ...followEvents.map((event) => ({
      id: `follow-${event.id}`,
      type: "follow" as const,
      actor: event.actor,
      postId: null,
      text: null,
      createdAt: event.createdAt,
    })),
    ...likeEvents.map((event) => ({
      id: `like-${event.id}`,
      type: "like" as const,
      actor: event.actor,
      postId: event.postId,
      text: null,
      createdAt: event.createdAt,
    })),
    ...commentEvents.map((event) => ({
      id: `comment-${event.id}`,
      type: "comment" as const,
      actor: event.actor,
      postId: event.postId,
      text: event.text,
      createdAt: event.createdAt,
    })),
    ...replyEvents.map((event) => ({
      id: `reply-${event.id}`,
      type: "reply" as const,
      actor: event.actor,
      postId: event.postId,
      text: event.text,
      createdAt: event.createdAt,
    })),
    ...commentLikeEvents.map((event) => ({
      id: `comment-like-${event.id}`,
      type: "comment_like" as const,
      actor: event.actor,
      postId: event.postId,
      text: null,
      createdAt: event.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function toggleFollow(
  followerId: number,
  followingId: number
): Promise<{ following: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const existing = await db
    .select()
    .from(follows)
    .where(
      and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(follows)
      .where(
        and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
      );
    return { following: false };
  } else {
    await db.insert(follows).values({ followerId, followingId });
    return { following: true };
  }
}

export async function getFollowersCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return Number(result[0]?.count ?? 0);
}

export async function getFollowers(userId: number): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ user: USER_SELECT })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt));
  return result.map((row) => row.user as User);
}

export async function getFollowingCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return Number(result[0]?.count ?? 0);
}

export async function getFollowing(userId: number): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ user: USER_SELECT })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt));
  return result.map((row) => row.user as User);
}

export async function isFollowing(
  followerId: number,
  followingId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(follows)
    .where(
      and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
    )
    .limit(1);
  return result.length > 0;
}

export async function getPostsCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.userId, userId));
  return Number(result[0]?.count ?? 0);
}
