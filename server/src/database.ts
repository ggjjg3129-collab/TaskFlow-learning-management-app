import "dotenv/config";
import { Pool } from "pg";

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required. Configure it in server/.env.");
  return url;
}

export function getVerifiedDatabaseUrl(connectionString = getDatabaseUrl()): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function createPool(): Pool {
  return new Pool({
    connectionString: getVerifiedDatabaseUrl(),
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    application_name: "learning-management-app",
  });
}
