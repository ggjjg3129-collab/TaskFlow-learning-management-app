import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { createPool } from "./database.js";
import { databaseErrorCode } from "./errors.js";
import { PostgresRepository } from "./repository.js";

const name = process.env.ADMIN_NAME?.trim();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!name || name.length > 100 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
  console.error("Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of 12–72 bytes for this command.");
  process.exit(1);
}

let pool: Pool | undefined;
try {
  pool = createPool();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await new PostgresRepository(pool).createAdmin(name, email, passwordHash);
  console.log(`Admin account ready for ${user.email}.`);
} catch (error) {
  if (databaseErrorCode(error) === "23505") {
    console.error("Admin account creation failed: an account with that email already exists.");
  } else {
    console.error("Admin account creation failed.");
  }
  process.exitCode = 1;
} finally {
  await pool?.end();
  delete process.env.ADMIN_PASSWORD;
}
