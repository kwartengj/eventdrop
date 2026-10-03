import { readdir, readFile } from "fs/promises";
import path from "path";
import { pool } from "./client";

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const dir = path.join(process.cwd(), "src/db/sql");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const done = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
      if (done.rowCount) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
