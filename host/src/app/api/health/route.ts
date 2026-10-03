import { pool } from "@/db/client";
import { route } from "@/server/http";
import { activeProvider } from "@/server/storage";

export const GET = route(async () => {
  let database: "ok" | "down" = "ok";
  try {
    await pool.query("select 1");
  } catch {
    database = "down";
  }
  let storage: "ok" | "down" = "ok";
  try {
    await activeProvider().head("health/ping");
  } catch {
    storage = "down";
  }
  const ok = database === "ok" && storage === "ok";
  return { status: ok ? 200 : 503, body: { ok, database, storage } };
});
