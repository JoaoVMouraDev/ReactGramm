import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  getUserByUsername: vi.fn(async (username: string) => {
    if (username === "testuser") {
      return {
        id: 1,
        openId: "openid-1",
        username: "testuser",
        name: "Test User",
        bio: "Hello!",
        avatarUrl: null,
        avatarKey: null,
        email: "test@example.com",
        loginMethod: "email",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
    }
    return undefined;
  }),
  updateUserProfile: vi.fn(async () => {}),
  searchUsers: vi.fn(async (query: string) => {
    if (query === "test") {
      return [
        {
          id: 1,
          username: "testuser",
          name: "Test User",
          avatarUrl: null,
          openId: "openid-1",
          email: null,
          loginMethod: null,
          role: "user",
          bio: null,
          avatarKey: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      ];
    }
    return [];
  }),
  createPost: vi.fn(async () => 42),
  updatePost: vi.fn(async () => true),
  deletePost: vi.fn(async () => {}),
  getPostById: vi.fn(async (id: number) => {
    if (id === 1) {
      return {
        id: 1,
        userId: 1,
        imageUrl: "https://example.com/img.jpg",
        imageKey: "posts/1/img.jpg",
        caption: "Test caption",
        hashtags: JSON.stringify(["test"]),
        likesCount: 1,
        commentsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 1,
          openId: "openid-1",
          username: "testuser",
          name: "Test User",
          avatarUrl: null,
          avatarKey: null,
          email: "test@example.com",
          loginMethod: "email",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        },
      };
    }
    return undefined;
  }),
  getFeedPosts: vi.fn(async () => []),
  getUserPosts: vi.fn(async () => []),
  getPostsByHashtag: vi.fn(async () => []),
  getUserLikedPostIds: vi.fn(async () => []),
  toggleLike: vi.fn(async () => ({ liked: true })),
  getLikesByPost: vi.fn(async () => []),
  createComment: vi.fn(async () => 99),
  getCommentsByPost: vi.fn(async () => []),
  getNotificationsForUser: vi.fn(async () => []),
  toggleFollow: vi.fn(async () => ({ following: true })),
  isFollowing: vi.fn(async () => false),
  getFollowersCount: vi.fn(async () => 5),
  getFollowers: vi.fn(async () => []),
  getFollowingCount: vi.fn(async () => 3),
  getFollowing: vi.fn(async () => []),
  getPostsCount: vi.fn(async () => 10),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({
    key,
    url: `/media/${key}`,
  })),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthCtx(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "openid-1",
      username: "testuser",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "email",
      role: "user",
      bio: "Hello!",
      avatarUrl: null,
      avatarKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth", () => {
  it("me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.auth.me();
    expect(result?.username).toBe("testuser");
  });

  it("logout clears session cookie", async () => {
    const ctx = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect((ctx.res.clearCookie as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});

describe("posts", () => {
  it("feed returns empty array when no posts", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.posts.feed({ limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("getById returns post with parsed hashtags", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.posts.getById({ id: 1 });
    expect(result.id).toBe(1);
    expect(Array.isArray(result.hashtags)).toBe(true);
    expect(result.hashtags).toContain("test");
  });

  it("getById throws NOT_FOUND for missing post", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.posts.getById({ id: 9999 })).rejects.toThrow();
  });

  it("create post requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.posts.create({
        imageUrl: "https://example.com/img.jpg",
        imageKey: "posts/1/img.jpg",
      })
    ).rejects.toThrow();
  });

  it("create post succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.posts.create({
      imageUrl: "https://example.com/img.jpg",
      imageKey: "posts/1/img.jpg",
      caption: "Hello world",
      hashtags: ["test"],
    });
    expect(result.id).toBe(42);
  });

  it("delete post requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.posts.delete({ id: 1 })).rejects.toThrow();
  });

  it("update post requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.posts.update({ id: 1, caption: "Atualizado", hashtags: ["teste"] }),
    ).rejects.toThrow();
  });

  it("update post succeeds for its owner", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.posts.update({
      id: 1,
      caption: "Atualizado",
      hashtags: ["teste"],
    });
    expect(result.success).toBe(true);
  });
});

describe("likes", () => {
  it("toggle like requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.likes.toggle({ postId: 1 })).rejects.toThrow();
  });

  it("toggle like returns liked status", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.likes.toggle({ postId: 1 });
    expect(typeof result.liked).toBe("boolean");
  });
});

describe("comments", () => {
  it("create comment requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.comments.create({ postId: 1, text: "Hello" })
    ).rejects.toThrow();
  });

  it("create comment succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.comments.create({ postId: 1, text: "Great post!" });
    expect(result.id).toBe(99);
  });

  it("getByPost returns array", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.comments.getByPost({ postId: 1, limit: 10, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("follows", () => {
  it("toggle follow requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.follows.toggle({ userId: 2 })).rejects.toThrow();
  });

  it("toggle follow returns following status", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.follows.toggle({ userId: 2 });
    expect(typeof result.following).toBe("boolean");
  });

  it("cannot follow yourself", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    await expect(caller.follows.toggle({ userId: 1 })).rejects.toThrow();
  });
});

describe("users", () => {
  it("search returns matching users", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.users.search({ query: "test", limit: 10 });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].username).toBe("testuser");
  });

  it("search returns empty for no match", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.users.search({ query: "xyz_no_match", limit: 10 });
    expect(result).toEqual([]);
  });

  it("getProfile returns user stats", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.users.getProfile({ username: "testuser" });
    expect(result.username).toBe("testuser");
    expect(typeof result.followersCount).toBe("number");
    expect(typeof result.followingCount).toBe("number");
    expect(typeof result.postsCount).toBe("number");
  });

  it("getProfile throws NOT_FOUND for unknown user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.users.getProfile({ username: "nobody" })).rejects.toThrow();
  });

  it("updateProfile requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.users.updateProfile({ username: "newname" })
    ).rejects.toThrow();
  });

  it("updateProfile succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.users.updateProfile({ bio: "New bio" });
    expect(result.success).toBe(true);
  });
});
