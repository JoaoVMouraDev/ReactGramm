// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/db.ts
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
  uniqueIndex
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  googleId: varchar("googleId", { length: 255 }).unique(),
  githubId: varchar("githubId", { length: 255 }).unique(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  username: varchar("username", { length: 64 }).unique(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  avatarKey: text("avatarKey"),
  emailVerified: timestamp("emailVerified"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var posts = mysqlTable(
  "posts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    imageUrl: text("imageUrl").notNull(),
    imageKey: text("imageKey").notNull(),
    caption: text("caption"),
    hashtags: text("hashtags"),
    // JSON array stored as string
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [index("posts_userId_idx").on(table.userId)]
);
var likes = mysqlTable(
  "likes",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("likes_postId_userId_unique").on(table.postId, table.userId),
    index("likes_postId_idx").on(table.postId),
    index("likes_userId_idx").on(table.userId)
  ]
);
var comments = mysqlTable(
  "comments",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("postId").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [
    index("comments_postId_idx").on(table.postId),
    index("comments_userId_idx").on(table.userId)
  ]
);
var follows = mysqlTable(
  "follows",
  {
    id: int("id").autoincrement().primaryKey(),
    followerId: int("followerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: int("followingId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // OAuth providers
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? ""
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error("[Database] DATABASE_URL is not defined in .env file");
      return null;
    }
    try {
      _db = drizzle(connectionString);
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getUserById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}
async function getUserByUsername(username) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
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
  const result = await db.insert(posts).values(data);
  return Number(result[0].insertId);
}
async function deletePost(postId, userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, userId)));
}
async function getPostById(postId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
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
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS UNSIGNED)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS UNSIGNED)`,
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
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS UNSIGNED)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS UNSIGNED)`,
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
    likesCount: sql`CAST(COALESCE((SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id}), 0) AS UNSIGNED)`,
    commentsCount: sql`CAST(COALESCE((SELECT count(*) FROM ${comments} WHERE ${comments.postId} = ${posts.id}), 0) AS UNSIGNED)`,
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
  const result = await db.insert(comments).values(data);
  return Number(result[0].insertId);
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
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
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
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
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
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
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
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      await setSessionCookie(res, req, userInfo.openId, userInfo.name || "");
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Manus callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app.get("/api/auth/google", (_req, res) => {
    if (!ENV.googleClientId) {
      res.status(503).json({ error: "Google OAuth not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: `${_req.protocol}://${_req.get("host")}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline"
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    if (!code) {
      res.redirect("/?error=google_denied");
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
          redirect_uri: `${req.protocol}://${req.get("host")}/api/auth/google/callback`,
          grant_type: "authorization_code"
        })
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) throw new Error("No access_token from Google");
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const googleUser = await userRes.json();
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
  app.get("/api/auth/github", (_req, res) => {
    if (!ENV.githubClientId) {
      res.status(503).json({ error: "GitHub OAuth not configured" });
      return;
    }
    const params = new URLSearchParams({
      client_id: ENV.githubClientId,
      redirect_uri: `${_req.protocol}://${_req.get("host")}/api/auth/github/callback`,
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
          redirect_uri: `${req.protocol}://${req.get("host")}/api/auth/github/callback`
        })
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) throw new Error("No access_token from GitHub");
      const [userRes, emailsRes] = await Promise.all([
        fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/vnd.github+json" }
        }),
        fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/vnd.github+json" }
        })
      ]);
      const githubUser = await userRes.json();
      const emails = await emailsRes.json();
      const primaryEmail = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email : void 0;
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
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
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

// server/routers.ts
import { z as z2 } from "zod";

// server/storage.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
function getForgeConfig() {
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL || ENV.forgeApiUrl;
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || ENV.forgeApiKey;
  const isLocal = !forgeKey || forgeKey.includes("insira_aqui") || forgeKey.includes("placeholder");
  console.log("[Storage] Verificando config:", {
    hasUrl: !!forgeUrl,
    mode: isLocal ? "LOCAL_DEV" : "FORGE_CLOUD"
  });
  if (!isLocal && (!forgeUrl || !forgeKey)) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey, isLocal };
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
  const { forgeUrl, forgeKey, isLocal } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  if (isLocal) {
    const storageDir = path.resolve(process.cwd(), "client", "public", "local-storage");
    const fullPath = path.join(storageDir, key);
    if (!fs.existsSync(path.dirname(fullPath))) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
    fs.writeFileSync(fullPath, Buffer.from(data));
    return { key, url: `/local-storage/${key}` };
  }
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
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
var uploadRouter = router({
  image: protectedProcedure.input(
    z2.object({
      filename: z2.string(),
      contentType: z2.string(),
      base64: z2.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const ext = input.filename.split(".").pop() ?? "jpg";
    const key = `posts/${ctx.user.id}/${nanoid()}.${ext}`;
    const buffer = Buffer.from(input.base64, "base64");
    const { url } = await storagePut(key, buffer, input.contentType);
    return { url, key };
  }),
  avatar: protectedProcedure.input(
    z2.object({
      filename: z2.string(),
      contentType: z2.string(),
      base64: z2.string()
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
  feed: publicProcedure.input(z2.object({ limit: z2.number().default(20), offset: z2.number().default(0) })).query(async ({ input, ctx }) => {
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
    z2.object({
      imageUrl: z2.string(),
      imageKey: z2.string(),
      caption: z2.string().optional(),
      hashtags: z2.array(z2.string()).optional()
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
  getById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input, ctx }) => {
    const post = await getPostById(input.id);
    if (!post) throw new TRPCError3({ code: "NOT_FOUND" });
    return {
      ...post,
      hashtags: post.hashtags ? JSON.parse(post.hashtags) : []
    };
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
    await deletePost(input.id, ctx.user.id);
    return { success: true };
  }),
  byUser: publicProcedure.input(
    z2.object({
      userId: z2.number(),
      limit: z2.number().default(30),
      offset: z2.number().default(0)
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
    z2.object({
      hashtag: z2.string(),
      limit: z2.number().default(20),
      offset: z2.number().default(0)
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
  toggle: protectedProcedure.input(z2.object({ postId: z2.number() })).mutation(async ({ input, ctx }) => {
    return toggleLike(input.postId, ctx.user.id);
  }),
  getByPost: publicProcedure.input(z2.object({ postId: z2.number() })).query(async ({ input }) => {
    return getLikesByPost(input.postId);
  })
});
var commentsRouter = router({
  create: protectedProcedure.input(z2.object({ postId: z2.number(), text: z2.string().min(1).max(500) })).mutation(async ({ input, ctx }) => {
    const id = await createComment({
      postId: input.postId,
      userId: ctx.user.id,
      text: input.text
    });
    return { id };
  }),
  getByPost: publicProcedure.input(
    z2.object({
      postId: z2.number(),
      limit: z2.number().default(20),
      offset: z2.number().default(0)
    })
  ).query(async ({ input }) => {
    return getCommentsByPost(input.postId);
  })
});
var authRouter = router({
  signup: publicProcedure.input(
    z2.object({
      email: z2.string().email(),
      password: z2.string(),
      username: z2.string(),
      name: z2.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    if (!validateEmail(input.email)) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Email inv\xE1lido" });
    }
    const passwordValidation = validatePasswordStrength(input.password);
    if (!passwordValidation.isValid) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: passwordValidation.errors[0] });
    }
    const usernameValidation = validateUsername(input.username);
    if (!usernameValidation.isValid) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: usernameValidation.errors[0] });
    }
    const existingEmail = await getUserByEmail(input.email);
    if (existingEmail) {
      throw new TRPCError3({ code: "CONFLICT", message: "Email j\xE1 cadastrado" });
    }
    const existingUsername = await getUserByUsername(input.username);
    if (existingUsername) {
      throw new TRPCError3({ code: "CONFLICT", message: "Username j\xE1 cadastrado" });
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
      expiresInMs: ONE_YEAR_MS
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    return { success: true };
  }),
  login: publicProcedure.input(
    z2.object({
      email: z2.string().email(),
      password: z2.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const foundUser = await getUserByEmail(input.email);
    if (!foundUser) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Email ou senha inv\xE1lidos" });
    }
    if (!foundUser.passwordHash || !verifyPassword(input.password, foundUser.passwordHash)) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Email ou senha inv\xE1lidos" });
    }
    const db = await getDb();
    if (db) {
      await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq2(users.id, foundUser.id));
    }
    const sessionToken = await sdk.createSessionToken(foundUser.openId, {
      name: foundUser.name ?? "",
      expiresInMs: ONE_YEAR_MS
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    return { success: true };
  })
});
var followsRouter = router({
  toggle: protectedProcedure.input(z2.object({ userId: z2.number() })).mutation(async ({ input, ctx }) => {
    if (input.userId === ctx.user.id) {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
    }
    return toggleFollow(ctx.user.id, input.userId);
  }),
  isFollowing: publicProcedure.input(z2.object({ followerId: z2.number(), followingId: z2.number() })).query(async ({ input }) => {
    return { following: await isFollowing(input.followerId, input.followingId) };
  }),
  getFollowersCount: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
    return { count: await getFollowersCount(input.userId) };
  }),
  getFollowingCount: publicProcedure.input(z2.object({ userId: z2.number() })).query(async ({ input }) => {
    return { count: await getFollowingCount(input.userId) };
  })
});
var usersRouter = router({
  getProfile: publicProcedure.input(z2.object({ username: z2.string() })).query(async ({ input, ctx }) => {
    const user = await getUserByUsername(input.username);
    if (!user) throw new TRPCError3({ code: "NOT_FOUND", message: "User not found" });
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
  getProfileById: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input, ctx }) => {
    const user = await getUserById(input.id);
    if (!user) throw new TRPCError3({ code: "NOT_FOUND", message: "User not found" });
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
    z2.object({
      username: z2.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
      bio: z2.string().max(150).optional(),
      avatarUrl: z2.string().optional(),
      avatarKey: z2.string().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    if (input.username) {
      const existing = await getUserByUsername(input.username);
      if (existing && existing.id !== ctx.user.id) {
        throw new TRPCError3({ code: "CONFLICT", message: "Username already taken" });
      }
    }
    await updateUserProfile(ctx.user.id, input);
    return { success: true };
  }),
  search: publicProcedure.input(z2.object({ query: z2.string().min(1), limit: z2.number().default(10) })).query(async ({ input }) => {
    const results = await searchUsers(input.query, input.limit);
    return results.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      avatarUrl: u.avatarUrl
    }));
  }),
  // Unified search: users + hashtag posts
  unifiedSearch: publicProcedure.input(z2.object({ query: z2.string().min(1), limit: z2.number().default(8) })).query(async ({ input }) => {
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
  getHoverCard: publicProcedure.input(z2.object({ username: z2.string() })).query(async ({ input, ctx }) => {
    const user = await getUserByUsername(input.username);
    if (!user) throw new TRPCError3({ code: "NOT_FOUND" });
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
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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

// server/_core/vite.ts
import express from "express";
import fs3 from "fs";
import { nanoid as nanoid2 } from "nanoid";
import path3 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs2 from "node:fs";
import path2 from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path2.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs2.existsSync(LOG_DIR)) {
    fs2.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs2.existsSync(logPath) || fs2.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs2.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs2.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path2.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs2.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path2.resolve(import.meta.dirname),
  root: path2.resolve(import.meta.dirname, "client"),
  publicDir: path2.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path3.resolve(import.meta.dirname, "../..", "dist", "public") : path3.resolve(import.meta.dirname, "public");
  if (!fs3.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
  const isLocal = !forgeKey || forgeKey.includes("placeholder") || forgeKey.includes("insira");
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  if (!isLocal) {
    registerStorageProxy(app);
  }
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
