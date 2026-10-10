import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { getDatabaseUrl } from "./database.js";

let pool: Pool | undefined;

try {
  pool = new Pool({ connectionString: getDatabaseUrl(), max: 2, application_name: "lms-migrations" });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version varchar(100) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const version = "001_initial";
  const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
  if (existing.rowCount) {
    console.log(`Migration ${version} already applied`);
  } else {
    const migration = await readFile(join(process.cwd(), "migrations", "001_initial.sql"), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`Applied migration ${version}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} catch (error) {
  console.error("Database migration failed", error instanceof Error ? error.message : "Unexpected error");
  process.exitCode = 1;
} finally {
  await pool?.end();
}
