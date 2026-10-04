import { count, desc, eq, gte, sql } from "drizzle-orm";
import { db, pool } from "../db/client";
import { events, media, uploads, users } from "../db/schema";
import { activeProvider } from "./storage";

export async function adminOverview() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [totalEvents] = await db.select({ n: count() }).from(events);
  const [activeEvents] = await db.select({ n: count() }).from(events).where(eq(events.status, "active"));
  const [userCount] = await db.select({ n: count() }).from(users);
  const [mediaCount] = await db.select({ n: count() }).from(media).where(eq(media.status, "ready"));
  const [storage] = await db
    .select({ n: sql<number>`coalesce(sum(${media.fileSize}), 0)` })
    .from(media)
    .where(eq(media.status, "ready"));
  const [recentUploads] = await db.select({ n: count() }).from(uploads).where(gte(uploads.createdAt, dayAgo));
  const [failed] = await db.select({ n: count() }).from(uploads).where(eq(uploads.status, "failed"));
  const eventRows = await db
    .select({
      id: events.id,
      name: events.name,
      joinCode: events.joinCode,
      status: events.status,
      createdAt: events.createdAt,
      hostName: users.name,
      hostEmail: users.email,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.hostId))
    .orderBy(desc(events.createdAt));
  const recentFailures = await db
    .select({
      id: uploads.id,
      fileName: uploads.fileName,
      error: uploads.error,
      createdAt: uploads.createdAt,
      eventId: uploads.eventId,
    })
    .from(uploads)
    .where(eq(uploads.status, "failed"))
    .orderBy(desc(uploads.createdAt))
    .limit(8);

  let database: "ok" | "down" = "ok";
  try {
    await pool.query("select 1");
  } catch {
    database = "down";
  }
  let storageHealth: "ok" | "down" = "ok";
  try {
    await activeProvider().head("health/ping");
  } catch {
    storageHealth = "down";
  }

  return {
    totalEvents: Number(totalEvents?.n ?? 0),
    activeEvents: Number(activeEvents?.n ?? 0),
    users: Number(userCount?.n ?? 0),
    media: Number(mediaCount?.n ?? 0),
    storageBytes: Number(storage?.n ?? 0),
    uploadsLast24h: Number(recentUploads?.n ?? 0),
    failedUploads: Number(failed?.n ?? 0),
    events: eventRows,
    recentFailures,
    health: { database, storage: storageHealth },
  };
}
