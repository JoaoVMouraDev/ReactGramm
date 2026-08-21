export const MAX_PINNED_POSTS = 3;

export const PIN_LIMIT_MESSAGE =
  "Você já atingiu o limite de posts fixados. Desafixe um post antes de fixar outro.";

export type PinnablePost = {
  id: number;
  userId: number;
  isPinned: boolean;
  pinnedAt: Date | null;
  createdAt: Date;
};

export function assertCanTogglePin(
  post: PinnablePost | undefined,
  actorUserId: number
): PinnablePost {
  if (!post) {
    throw new Error("POST_NOT_FOUND");
  }
  if (post.userId !== actorUserId) {
    throw new Error("FORBIDDEN");
  }
  return post;
}

export function nextPinState(
  post: PinnablePost,
  currentlyPinnedCount: number,
  now = new Date()
): { isPinned: boolean; pinnedAt: Date | null } {
  if (post.isPinned) {
    return { isPinned: false, pinnedAt: null };
  }

  if (currentlyPinnedCount >= MAX_PINNED_POSTS) {
    throw new Error("PIN_LIMIT");
  }

  return { isPinned: true, pinnedAt: now };
}

export function orderProfilePosts<
  T extends { isPinned: boolean; pinnedAt: Date | null; createdAt: Date },
>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.isPinned && b.isPinned) {
      return (b.pinnedAt?.getTime() ?? 0) - (a.pinnedAt?.getTime() ?? 0);
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
