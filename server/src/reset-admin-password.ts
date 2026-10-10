import "dotenv/config";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { createPool } from "./database.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email) {
  console.error("ADMIN_EMAIL is required for this command.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("ADMIN_EMAIL must be a valid email address.");
  process.exit(1);
}
if (!password) {
  console.error("ADMIN_PASSWORD is required for this command.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("ADMIN_PASSWORD must contain at least 12 characters.");
  process.exit(1);
}
if (Buffer.byteLength(password, "utf8") > 72) {
  console.error("ADMIN_PASSWORD must be no more than 72 UTF-8 bytes.");
  process.exit(1);
}

let pool: Pool | undefined;
try {
  pool = createPool();
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `WITH updated_admin AS (
       UPDATE users SET password_hash = $1
       WHERE email = $2 AND role = 'admin'
       RETURNING id
     ),
     revoked_sessions AS (
       DELETE FROM user_sessions
       WHERE sess->>'userId' IN (SELECT id::text FROM updated_admin)
       RETURNING sid
     )
     SELECT id FROM updated_admin`,
    [passwordHash, email],
  );
  if (result.rows.length !== 1) {
    console.error("Admin password reset failed: no matching admin account was found.");
    process.exitCode = 1;
  } else {
    console.log("Admin password reset successfully.");
  }
} catch {
  console.error("Admin password reset failed. Check database configuration and connectivity.");
  process.exitCode = 1;
} finally {
  await pool?.end();
  delete process.env.ADMIN_PASSWORD;
}
