import { describe, expect, it, vi, beforeEach } from "vitest";
import * as db from "./db";
import { appRouter } from "./routers";
import { orderProfilePosts } from "./pinPost";
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
        passwordHash: "sensitive-hash",
        loginMethod: "email",
        googleId: "google-secret",
        githubId: "github-secret",
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
  togglePinPost: vi.fn(async () => ({ pinned: true })),
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
  getUserSavedPostIds: vi.fn(async () => []),
  getSavedPosts: vi.fn(async () => []),
  toggleSavedPost: vi.fn(async () => ({ bookmarked: true })),
  toggleLike: vi.fn(async () => ({ liked: true })),
  getLikesByPost: vi.fn(async () => []),
  createComment: vi.fn(async () => 99),
  getCommentsByPost: vi.fn(async () => []),
  toggleCommentLike: vi.fn(async () => ({ liked: true })),
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

function createAuthCtx(
  overrides: Partial<TrpcContext["user"]> = {}
): TrpcContext {
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
    const caller = appRouter.createCaller(
      createAuthCtx({
        passwordHash: "sensitive-hash",
        googleId: "google-secret",
        githubId: "github-secret",
      })
    );
    const result = await caller.auth.me();
    expect(result?.username).toBe("testuser");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("googleId");
    expect(result).not.toHaveProperty("githubId");
  });

  it("logout clears session cookie", async () => {
    const ctx = createAuthCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(
      (ctx.res.clearCookie as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBe(1);
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

  it("getById never exposes sensitive author fields", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.posts.getById({ id: 1 });

    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("googleId");
    expect(result.user).not.toHaveProperty("githubId");
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
      caller.posts.update({ id: 1, caption: "Atualizado", hashtags: ["teste"] })
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

  it("toggle pin requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.posts.togglePin({ postId: 1 })).rejects.toThrow();
  });

  it("toggle pin succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.posts.togglePin({ postId: 1 });
    expect(result.pinned).toBe(true);
  });

  it("user can pin and unpin their own post", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    vi.mocked(db.togglePinPost)
      .mockResolvedValueOnce({ pinned: true })
      .mockResolvedValueOnce({ pinned: false });

    await expect(caller.posts.togglePin({ postId: 11 })).resolves.toEqual({
      pinned: true,
    });
    await expect(caller.posts.togglePin({ postId: 11 })).resolves.toEqual({
      pinned: false,
    });
  });

  it("user cannot pin another person's post", async () => {
    const caller = appRouter.createCaller(createAuthCtx({ id: 2 }));
    vi.mocked(db.togglePinPost).mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(caller.posts.togglePin({ postId: 99 })).rejects.toThrow(
      "Você só pode fixar os seus próprios posts."
    );
  });

  it("reaches the pin limit with clear error for a fourth post", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    vi.mocked(db.togglePinPost).mockRejectedValueOnce(new Error("PIN_LIMIT"));

    await expect(caller.posts.togglePin({ postId: 4 })).rejects.toThrow(
      "Você já atingiu o limite de posts fixados. Desafixe um post antes de fixar outro."
    );
  });

  it("orders pinned posts before regular posts on profile", () => {
    const posts = [
      { id: 1, isPinned: false, pinnedAt: null, createdAt: new Date("2024-01-01T00:00:00.000Z") },
      { id: 2, isPinned: true, pinnedAt: new Date("2024-01-08T00:00:00.000Z"), createdAt: new Date("2024-01-02T00:00:00.000Z") },
      { id: 3, isPinned: true, pinnedAt: new Date("2024-01-09T00:00:00.000Z"), createdAt: new Date("2024-01-03T00:00:00.000Z") },
      { id: 4, isPinned: false, pinnedAt: null, createdAt: new Date("2024-01-04T00:00:00.000Z") },
    ] as const;

    expect(orderProfilePosts(posts as any).map(post => post.id)).toEqual([3, 2, 4, 1]);
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
    const result = await caller.comments.create({
      postId: 1,
      text: "Great post!",
    });
    expect(result.id).toBe(99);
  });

  it("getByPost returns array", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.comments.getByPost({
      postId: 1,
      limit: 10,
      offset: 0,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("toggle comment like requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.comments.toggleLike({ commentId: 1 })
    ).rejects.toThrow();
  });

  it("toggle comment like returns liked status", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.comments.toggleLike({ commentId: 1 });
    expect(typeof result.liked).toBe("boolean");
  });
});

describe("bookmarks", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.bookmarks.list()).rejects.toThrow();
  });

  it("toggles a saved post", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    await expect(caller.bookmarks.toggle({ postId: 1 })).resolves.toEqual({
      bookmarked: true,
    });
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
    const result = await caller.users.search({
      query: "xyz_no_match",
      limit: 10,
    });
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
    await expect(
      caller.users.getProfile({ username: "nobody" })
    ).rejects.toThrow();
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
