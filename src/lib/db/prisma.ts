import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Runtime-connectie van de applicatie: de gepoolde Supavisor-URL
// (DATABASE_URL, poort 6543, ?pgbouncer=true). Migraties lopen apart via
// DIRECT_URL, geconfigureerd in prisma.config.ts.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ontbreekt in de omgevingsvariabelen.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

declare global {
  var __veraPrisma: PrismaClient | undefined;
}

// In development hergebruiken we de client over hot-reloads heen, anders
// lopen we tegen "too many connections" aan.
export const prisma = globalThis.__veraPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__veraPrisma = prisma;
}
