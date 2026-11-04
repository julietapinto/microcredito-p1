import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Defina DATABASE_URL.");
  const pool = new Pool({ connectionString });
  try {
    const sql = await readFile(path.resolve("src/persistencia/migrations/001_init.sql"), "utf8");
    await pool.query(sql);
    console.log("Migración 001 aplicada correctamente.");
  } finally { await pool.end(); }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
