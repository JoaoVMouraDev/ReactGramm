process.on("uncaughtException", (err) => {
  console.error("Startup crash:");
  console.error(err.stack || err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection:", promise);
  console.error("Reason:", reason);
});

import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { ensureDatabaseSchema } from "../db";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth.ts";
import { registerStorageProxy } from "./storageProxy";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  await ensureDatabaseSchema();

  const storageKey = ENV.storageApiKey;
  const isLocal =
    !storageKey ||
    storageKey.includes("placeholder") ||
    storageKey.includes("insira");

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  if (!isLocal) {
    registerStorageProxy(app);
  }

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    server.listen(preferredPort, "0.0.0.0", () => {
      console.log(`Server running in production mode on port ${preferredPort}`);
    });
  } else {
    const port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}/`);
    });
  }
}

startServer().catch(console.error);
