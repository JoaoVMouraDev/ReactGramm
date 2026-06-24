import { z } from "zod";
import {
  createComment,
  createPost,
  deletePost,
  getFeedPosts,
  getFollowers,
  getFollowersCount,
  getFollowing,
  getFollowingCount,
  getLikesByPost,
  getPostById,
  getPostsByHashtag,
  getPostsCount,
  getUserById,
  getUserByUsername,
  getUserLikedPostIds,
  getUserPosts,
  isFollowing,
  searchUsers,
  toggleCommentLike,
  toggleFollow,
  toggleLike,
  updatePost,
  updateUserProfile,
  getCommentsByPost,
  getNotificationsForUser,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies.ts";       
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { hashPassword, verifyPassword, validatePasswordStrength, validateEmail, validateUsername } from "./auth.ts"; 
import { users } from "../drizzle/schema.ts";                      
import { eq } from "drizzle-orm";
import { getDb, getUserByEmail, getUserByUsername as getUserByUsernameDb, createUserWithEmail } from "./db.ts";
import { sdk } from "./_core/sdk.ts";                                
// IMPORTANTE: Ajuste o caminho abaixo para onde sua função de upload realmente está
import { storagePut } from "./storage.ts"; 

// Constantes necessárias para a sessão
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "app_session_id"; 

// ─── Upload Router ─────────────────────────────────────────────────────────────

const uploadRouter = router({
  image: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        base64: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `posts/${ctx.user.id}/${nanoid()}.${ext}`;
      const buffer = Buffer.from(input.base64, "base64");
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url, key };
    }),

  avatar: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        base64: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `avatars/${ctx.user.id}/${nanoid()}.${ext}`;
      const buffer = Buffer.from(input.base64, "base64");
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url, key };
    }),
});

// ─── Posts Router ──────────────────────────────────────────────────────────────

const postsRouter = router({
  feed: publicProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ input, ctx }) => {
      const feedPosts = await getFeedPosts(input.limit, input.offset);
      let likedPostIds: number[] = [];
      if (ctx.user) {
        const ids = feedPosts.map((p) => p.id);
        likedPostIds = await getUserLikedPostIds(ctx.user.id, ids);
      }
      return feedPosts.map((p) => ({
        ...p,
        hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
        isLiked: likedPostIds.includes(p.id),
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string(),
        imageKey: z.string(),
        caption: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const postId = await createPost({
        userId: ctx.user.id,
        imageUrl: input.imageUrl,
        imageKey: input.imageKey,
        caption: input.caption ?? null,
        hashtags: input.hashtags ? JSON.stringify(input.hashtags) : null,
      });
      return { id: postId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        caption: z.string().max(2200),
        hashtags: z.array(z.string().min(1).max(50)).max(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const updated = await updatePost(input.id, ctx.user.id, {
        caption: input.caption.trim() || null,
        hashtags: input.hashtags.length ? JSON.stringify(input.hashtags) : null,
      });
      if (!updated) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode editar este post" });
      }
      return { success: true };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const post = await getPostById(input.id);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      const likedPostIds = ctx.user
        ? await getUserLikedPostIds(ctx.user.id, [post.id])
        : [];
      return {
        ...post,
        hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
        isLiked: likedPostIds.includes(post.id),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deletePost(input.id, ctx.user.id, ctx.user.role === "admin");
      return { success: true };
    }),

  byUser: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        limit: z.number().default(30),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const userPosts = await getUserPosts(input.userId, input.limit, input.offset);
      let likedPostIds: number[] = [];
      if (ctx.user) {
        const ids = userPosts.map((p) => p.id);
        likedPostIds = await getUserLikedPostIds(ctx.user.id, ids);
      }
      return userPosts.map((p) => ({
        ...p,
        hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
        isLiked: likedPostIds.includes(p.id),
      }));
    }),

  byHashtag: publicProcedure
    .input(
      z.object({
        hashtag: z.string(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const tagPosts = await getPostsByHashtag(input.hashtag, input.limit, input.offset);
      return tagPosts.map((p) => ({
        ...p,
        hashtags: p.hashtags ? JSON.parse(p.hashtags) : [],
      }));
    }),
});

// ─── Likes Router ──────────────────────────────────────────────────────────────

const likesRouter = router({
  toggle: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return toggleLike(ctx.user.id, input.postId);
    }),

  getByPost: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ input }) => {
      return getLikesByPost(input.postId);
    }),
});

// ─── Comments Router ───────────────────────────────────────────────────────────

const commentsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        text: z.string().min(1).max(500),
        parentCommentId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = await createComment({
        postId: input.postId,
        userId: ctx.user.id,
        parentCommentId: input.parentCommentId ?? null,
        text: input.text,
      });
      return { id };
    }),

  getByPost: publicProcedure
    .input(
      z.object({
        postId: z.number(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      return getCommentsByPost(input.postId, ctx.user?.id);
    }),

  toggleLike: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return toggleCommentLike(ctx.user.id, input.commentId);
    }),
});

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
        username: z.string(),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!validateEmail(input.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email inválido" });
      }

      const passwordValidation = validatePasswordStrength(input.password);
      if (!passwordValidation.isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: passwordValidation.errors[0] });
      }

      const usernameValidation = validateUsername(input.username);
      if (!usernameValidation.isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: usernameValidation.errors[0] });
      }

      const existingEmail = await getUserByEmail(input.email);
      if (existingEmail) {
        throw new TRPCError({ code: "CONFLICT", message: "Email já cadastrado" });
      }

      const existingUsername = await getUserByUsernameDb(input.username);
      if (existingUsername) {
        throw new TRPCError({ code: "CONFLICT", message: "Username já cadastrado" });
      }

      const passwordHash = hashPassword(input.password);
      const user = await createUserWithEmail({
        email: input.email,
        passwordHash,
        username: input.username,
        name: input.name,
      });

      // Create session cookie
      const sessionToken = await sdk.createSessionToken(user.openId!, {
        name: user.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const foundUser = await getUserByEmail(input.email);

      if (!foundUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
      }

      if (!foundUser.passwordHash || !verifyPassword(input.password, foundUser.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
      }

      const db = await getDb();
      if (db) {
        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, foundUser.id));
      }

      // Create session cookie so the user is immediately authenticated
      const sessionToken = await sdk.createSessionToken(foundUser.openId!, {
        name: foundUser.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { success: true };
    }),
});

// ─── Follows Router ────────────────────────────────────────────────────────────

const followsRouter = router({
  toggle: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
      }
      return toggleFollow(ctx.user.id, input.userId);
    }),

  isFollowing: publicProcedure
    .input(z.object({ followerId: z.number(), followingId: z.number() }))
    .query(async ({ input }) => {
      return { following: await isFollowing(input.followerId, input.followingId) };
    }),

  getFollowersCount: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return { count: await getFollowersCount(input.userId) };
    }),

  getFollowingCount: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      return { count: await getFollowingCount(input.userId) };
    }),

  followers: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      const people = await getFollowers(input.userId);
      return Promise.all(
        people.map(async (person) => ({
          id: person.id,
          username: person.username,
          name: person.name,
          avatarUrl: person.avatarUrl,
          isFollowing: ctx.user
            ? ctx.user.id === person.id || (await isFollowing(ctx.user.id, person.id))
            : false,
          isCurrentUser: ctx.user?.id === person.id,
        })),
      );
    }),

  following: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input, ctx }) => {
      const people = await getFollowing(input.userId);
      return Promise.all(
        people.map(async (person) => ({
          id: person.id,
          username: person.username,
          name: person.name,
          avatarUrl: person.avatarUrl,
          isFollowing: ctx.user
            ? ctx.user.id === person.id || (await isFollowing(ctx.user.id, person.id))
            : false,
          isCurrentUser: ctx.user?.id === person.id,
        })),
      );
    }),
});

// ─── Users Router ──────────────────────────────────────────────────────────────

const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input, ctx }) => {
      return getNotificationsForUser(ctx.user.id, input.limit);
    }),
});

const usersRouter = router({
  getProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await getUserByUsername(input.username);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const [followersCount, followingCount, postsCount] = await Promise.all([
        getFollowersCount(user.id),
        getFollowingCount(user.id),
        getPostsCount(user.id),
      ]);

      let isFollowingUser = false;
      let isFollowedByUser = false;
      if (ctx.user && ctx.user.id !== user.id) {
        [isFollowingUser, isFollowedByUser] = await Promise.all([
          isFollowing(ctx.user.id, user.id),
          isFollowing(user.id, ctx.user.id),
        ]);
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
        isFollowedBy: isFollowedByUser,
        isOwner: ctx.user?.id === user.id,
      };
    }),

  getProfileById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const user = await getUserById(input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const [followersCount, followingCount, postsCount] = await Promise.all([
        getFollowersCount(user.id),
        getFollowingCount(user.id),
        getPostsCount(user.id),
      ]);

      let isFollowingUser = false;
      let isFollowedByUser = false;
      if (ctx.user && ctx.user.id !== user.id) {
        [isFollowingUser, isFollowedByUser] = await Promise.all([
          isFollowing(ctx.user.id, user.id),
          isFollowing(user.id, ctx.user.id),
        ]);
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
        isFollowedBy: isFollowedByUser,
        isOwner: ctx.user?.id === user.id,
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
        bio: z.string().max(150).optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (input.username) {
        const existing = await getUserByUsername(input.username);
        if (existing && existing.id !== ctx.user.id) {
          throw new TRPCError({ code: "CONFLICT", message: "Username already taken" });
        }
      }
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const results = await searchUsers(input.query, input.limit);
      return results.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatarUrl: u.avatarUrl,
      }));
    }),

  // Unified search: users + hashtag posts
  unifiedSearch: publicProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().default(8) }))
    .query(async ({ input }) => {
      const [userResults, hashtagPosts] = await Promise.all([
        searchUsers(input.query, input.limit),
        getPostsByHashtag(input.query.replace(/^#/, ""), input.limit, 0),
      ]);
      return {
        users: userResults.map((u) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          avatarUrl: u.avatarUrl,
        })),
        hashtags: hashtagPosts.length > 0
          ? [{ tag: input.query.replace(/^#/, ""), postsCount: hashtagPosts.length }]
          : [],
      };
    }),

  getHoverCard: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await getUserByUsername(input.username);
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const [followersCount, followingCount, postsCount] = await Promise.all([
        getFollowersCount(user.id),
        getFollowingCount(user.id),
        getPostsCount(user.id),
      ]);

      let isFollowingUser = false;
      let isFollowedByUser = false;
      if (ctx.user && ctx.user.id !== user.id) {
        [isFollowingUser, isFollowedByUser] = await Promise.all([
          isFollowing(ctx.user.id, user.id),
          isFollowing(user.id, ctx.user.id),
        ]);
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
        isFollowedBy: isFollowedByUser,
      };
    }),
});

// ─── App Router ────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    signup: authRouter.signup,
    login: authRouter.login,
  }),
  upload: uploadRouter,
  posts: postsRouter,
  likes: likesRouter,
  comments: commentsRouter,
  follows: followsRouter,
  notifications: notificationsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
