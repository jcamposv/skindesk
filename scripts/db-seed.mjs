#!/usr/bin/env node
/**
 * Run every SQL file in supabase/seeds/ (sorted) against the linked Supabase
 * project, using the `pg` Node driver — no `psql` system dependency required.
 *
 * Required env (loaded from .env.local):
 *   SUPABASE_DB_URL    Postgres connection string. Get it from Dashboard →
 *                      Connect → Session pooler (or Direct connection) and
 *                      substitute your DB password.
 *
 * Usage:
 *   npm run db:seed
 *
 * Notes:
 *   - Each file runs inside a single transaction. If any statement fails, the
 *     file is rolled back and the script aborts.
 *   - Seeds must be IDEMPOTENT (use `on conflict do nothing`, etc.) so this
 *     can be re-run safely.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

// --------- Load .env.local without extra deps -------------------------------
function loadEnv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnv(".env.local");

// --------- Validate ---------------------------------------------------------
const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("\n✗ SUPABASE_DB_URL is missing.\n");
  console.error("  Add it to .env.local. Example:");
  console.error(
    '  SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"\n',
  );
  process.exit(1);
}

// --------- Discover seed files ---------------------------------------------
const seedsDir = "supabase/seeds";
let files;
try {
  files = readdirSync(seedsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
} catch {
  console.error(`✗ No directory at ${seedsDir}`);
  process.exit(1);
}
if (files.length === 0) {
  console.error(`✗ No .sql files in ${seedsDir}`);
  process.exit(1);
}

// --------- Run ---------------------------------------------------------------
console.log(
  `→ Applying ${files.length} seed file(s) against the linked Supabase project:\n`,
);

const client = new Client({
  connectionString: dbUrl,
  // Supabase requires SSL. The cert is signed by AWS and validates fine,
  // but pooler endpoints sometimes need rejectUnauthorized=false in dev.
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  for (const file of files) {
    const path = join(seedsDir, file);
    process.stdout.write(`  · ${file} ... `);
    const sql = readFileSync(path, "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log("ok");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      console.log("FAILED");
      console.error(`\n  ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log("\n✓ Seeds applied");
} finally {
  await client.end().catch(() => {});
}
