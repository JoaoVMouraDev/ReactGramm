import { hashPassword } from "./auth";
import {
  createPost,
  getPostsCount,
  getUserByEmail,
  createUserWithEmail,
} from "./db";

const TEST_EMAIL = "teste@reactgram.local";
const TEST_PASSWORD = "teste123";
const TEST_USERNAME = "teste";

const SAMPLE_POSTS = [
  {
    imageUrl: "/test-posts/1.svg",
    imageKey: "local/test-1.svg",
    caption: "Primeiro post de teste — use o menu ⋯ para fixar",
    hashtags: JSON.stringify(["teste", "fixar"]),
  },
  {
    imageUrl: "/test-posts/2.svg",
    imageKey: "local/test-2.svg",
    caption: "Segundo post para o perfil",
    hashtags: JSON.stringify(["reactgram"]),
  },
  {
    imageUrl: "/test-posts/3.svg",
    imageKey: "local/test-3.svg",
    caption: "Terceiro post — dá para fixar até 3",
    hashtags: JSON.stringify(["perfil"]),
  },
  {
    imageUrl: "/test-posts/4.svg",
    imageKey: "local/test-4.svg",
    caption: "Quarto post extra",
    hashtags: JSON.stringify(["extra"]),
  },
];

export async function seedLocalDevIfEmpty(): Promise<void> {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) return;

  const existing = await getUserByEmail(TEST_EMAIL);
  if (existing) {
    const count = await getPostsCount(existing.id);
    if (count > 0) return;
    for (const post of SAMPLE_POSTS) {
      await createPost({ ...post, userId: existing.id });
    }
    console.log(
      `[Database] Seeded posts for ${TEST_USERNAME} / ${TEST_PASSWORD}`
    );
    return;
  }

  const user = await createUserWithEmail({
    email: TEST_EMAIL,
    passwordHash: hashPassword(TEST_PASSWORD),
    username: TEST_USERNAME,
    name: "Perfil de teste",
  });

  for (const post of SAMPLE_POSTS) {
    await createPost({ ...post, userId: user.id });
  }

  console.log(
    `[Database] Test user ready → email ${TEST_EMAIL} / senha ${TEST_PASSWORD}`
  );
}
