process.on("uncaughtException", (err) => {
  console.error("❌ CRASH DETECTADO NA INICIALIZAÇÃO:");
  console.error(err.stack || err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ REJEIÇÃO NÃO TRATADA EM:", promise);
  console.error("Razão:", reason);
});

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.ts";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";            
import { createContext } from "./context";   
import { serveStatic, setupVite } from "./vite";


function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
  const isLocal = !forgeKey || forgeKey.includes("placeholder") || forgeKey.includes("insira");

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  if (!isLocal) {
    registerStorageProxy(app);
  }

  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // --- CONFIGURAÇÃO DA PORTA ADAPTADA PARA O RENDER ---
  const preferredPort = parseInt(process.env.PORT || "3000");
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    // Em produção (Render), escuta diretamente na porta designada e aceita conexões externas (0.0.0.0)
    server.listen(preferredPort, "0.0.0.0", () => {
      console.log(`Server running in production mode on port ${preferredPort}`);
    });
  } else {
    // Em desenvolvimento local, mantém a busca de portas livres se a 3000 estiver ocupada
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
