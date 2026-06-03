import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
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
  comments,
  follows,
  likes,
  posts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("[Database] DATABASE_URL is not defined in .env file");
      return null;
    }
    try {
      _db = drizzle(postgres(connectionString, { max: 5 }));
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
  return result[0];
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
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

export async function deletePost(postId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, userId)));
}

export async function getPostById(postId: number): Promise<Post | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return result[0];
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
): Promise<Post[]> {
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
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
  return result as any;
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
  const [created] = await db
    .insert(comments)
    .values(data)
    .returning({ id: comments.id });
  return created.id;
}

export async function getCommentsByPost(
  postId: number
): Promise<(Comment & { user: User })[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      userId: comments.userId,
      text: comments.text,
      createdAt: comments.createdAt,
      user: USER_SELECT,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(comments.createdAt);
  return result as (Comment & { user: User })[];
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

export async function getFollowingCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return Number(result[0]?.count ?? 0);
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
