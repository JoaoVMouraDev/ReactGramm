export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? process.env.DATABASE_URL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminUsernames: (process.env.ADMIN_USERNAMES ?? "carlos992")
    .split(",")
    .map((username) => username.trim().toLowerCase())
    .filter(Boolean),
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === "production",
  storageApiUrl:
    process.env.STORAGE_API_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  storageApiKey:
    process.env.STORAGE_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
};
