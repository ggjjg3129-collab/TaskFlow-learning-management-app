import "dotenv/config";
import { createApp, createPostgresSessionStore } from "./app.js";
import { getServerConfig } from "./config.js";
import { createPool } from "./database.js";
import { PostgresRepository } from "./repository.js";

async function start(): Promise<void> {
  const config = getServerConfig();
  const pool = createPool();
  pool.on("error", (error: NodeJS.ErrnoException) => {
    console.error("Unexpected idle database connection error", error.code ?? "DATABASE_ERROR");
  });
  await pool.query("SELECT 1");

  const app = createApp(
    new PostgresRepository(pool),
    createPostgresSessionStore(pool),
    config,
  );
  const server = app.listen(config.port, () => {
    console.log(`LMS API listening on port ${config.port}`);
  });
  const shutdown = () => {
    server.close(() => {
      void pool.end();
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void start().catch((error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : "STARTUP_ERROR";
  console.error("LMS API startup failed. Check server configuration and database connectivity.", code);
  process.exitCode = 1;
});
