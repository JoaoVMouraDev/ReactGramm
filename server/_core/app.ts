import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { ensureDatabaseSchema } from "../db";
import { seedLocalDevIfEmpty } from "../seedLocal";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";

const schemaReady = ensureDatabaseSchema()
  .then(() => seedLocalDevIfEmpty())
  .catch((error) => {
    console.error("[Database] Schema initialization failed:", error);
    throw error;
  });

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const storageKey = ENV.storageApiKey;
  const isLocalStorage =
    !storageKey ||
    storageKey.includes("placeholder") ||
    storageKey.includes("insira");

  if (!isLocalStorage) {
    registerStorageProxy(app);
  }

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/trpc",
    async (_req, _res, next) => {
      try {
        await schemaReady;
        next();
      } catch (error) {
        next(error);
      }
    },
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
