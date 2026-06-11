import { defineConfig } from "vitest/config";
import path from "path";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
