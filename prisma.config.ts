// Prisma 7 configuratiebestand.
//
// Migraties (prisma migrate dev/deploy) lopen via DIRECT_URL — de directe,
// niet-gepoolde Supabase-connectie (poort 5432). De applicatie zelf gebruikt
// op runtime DATABASE_URL (de gepoolde Supavisor-connectie, poort 6543) via
// een expliciete driver-adapter — zie src/lib/db/prisma.ts.
import { defineConfig, env } from "prisma/config";

// Laad .env lokaal (development/test). Op Render worden env vars al direct
// door het platform geïnjecteerd, dus als er geen .env-bestand is negeren we
// dat stilzwijgend.
try {
  process.loadEnvFile();
} catch {
  // geen .env-bestand aanwezig — verwacht in productie (Render)
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    seed: "node --env-file=.env --import tsx prisma/seed.ts",
  },
});
