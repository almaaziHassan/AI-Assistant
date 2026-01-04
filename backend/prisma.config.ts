// Prisma configuration for Supabase PostgreSQL
import "dotenv/config";
import { defineConfig } from "prisma/config";

// For Supabase:
// - DATABASE_URL should use port 6543 (Transaction Pooler) for app queries
// - DIRECT_URL should use port 5432 (Direct connection) for migrations
// If DIRECT_URL is not set, we'll modify DATABASE_URL to use direct connection
function getDirectUrl(): string {
  const directUrl = process.env["DIRECT_URL"];
  if (directUrl) return directUrl;

  // If no DIRECT_URL, try to convert DATABASE_URL from pooler to direct
  const dbUrl = process.env["DATABASE_URL"] || "";
  // Supabase pooler uses port 6543, direct uses 5432
  return dbUrl.replace(":6543/", ":5432/").replace("?pgbouncer=true", "");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct connection for migrations (required for Supabase)
    url: getDirectUrl(),
  },
});
