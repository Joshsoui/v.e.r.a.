import { defineConfig } from "vitest/config";
import path from "node:path";

// Laadt .env.test zodat DATABASE_URL/DIRECT_URL etc. beschikbaar zijn voor
// de (kleine set) tests die echt tegen een testdatabase draaien.
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.test"));
} catch {
  // geen .env.test aanwezig (bv. in een CI-omgeving met echte env vars)
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
