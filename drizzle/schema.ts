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
  table => [index("posts_userId_idx").on(table.userId)]
);

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

export const postMedia = pgTable(
  "post_media",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    key: text("key").notNull(),
    type: varchar("type", { length: 8 }).notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("post_media_postId_position_unique").on(
      table.postId,
      table.position
    ),
    index("post_media_postId_idx").on(table.postId),
  ]
);

export const savedPosts = pgTable(
  "saved_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: integer("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("saved_posts_userId_postId_unique").on(
      table.userId,
      table.postId
    ),
    index("saved_posts_userId_createdAt_idx").on(table.userId, table.createdAt),
    index("saved_posts_postId_idx").on(table.postId),
  ]
);

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
  table => [
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
    parentCommentId: integer("parentCommentId"),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("comments_postId_idx").on(table.postId),
    index("comments_userId_idx").on(table.userId),
    index("comments_parentCommentId_idx").on(table.parentCommentId),
  ]
);

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: serial("id").primaryKey(),
    commentId: integer("commentId")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("comment_likes_commentId_userId_unique").on(
      table.commentId,
      table.userId
    ),
    index("comment_likes_commentId_idx").on(table.commentId),
    index("comment_likes_userId_idx").on(table.userId),
  ]
);

export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = typeof commentLikes.$inferInsert;

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
  table => [
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

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    directKey: varchar("directKey", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [uniqueIndex("conversations_directKey_unique").on(table.directKey)]
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversationId")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("lastReadAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
    joinedAt: timestamp("joinedAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [
    uniqueIndex("conversation_members_conversation_user_unique").on(
      table.conversationId,
      table.userId
    ),
    index("conversation_members_userId_idx").on(table.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversationId")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: integer("senderId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: integer("postId").references(() => posts.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt
    ),
    index("messages_senderId_idx").on(table.senderId),
    index("messages_postId_idx").on(table.postId),
  ]
);
