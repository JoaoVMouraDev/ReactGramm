import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    imageUrl: text("imageUrl").notNull(),
    imageKey: text("imageKey").notNull(),
    caption: text("caption"),
    hashtags: text("hashtags"), // JSON array stored as string
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [index("posts_userId_idx").on(table.userId)]
);

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export const likes = pgTable(
  "likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("likes_postId_userId_unique").on(table.postId, table.userId),
    index("likes_postId_idx").on(table.postId),
    index("likes_userId_idx").on(table.userId),
  ]
);

export type Like = typeof likes.$inferSelect;
export type InsertLike = typeof likes.$inferInsert;

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("comments_postId_idx").on(table.postId),
    index("comments_userId_idx").on(table.userId),
  ]
);

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("followerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("followingId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("follows_follower_following_unique").on(
      table.followerId,
      table.followingId
    ),
    index("follows_followerId_idx").on(table.followerId),
    index("follows_followingId_idx").on(table.followingId),
  ]
);

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = typeof follows.$inferInsert;
