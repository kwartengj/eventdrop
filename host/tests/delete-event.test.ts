import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, expect, test } from "vitest";
import { GET as overviewRoute } from "@/app/api/admin/overview/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { DELETE as deleteRoute, GET as getRoute } from "@/app/api/events/[id]/route";
import { POST as createRoute, GET as listRoute } from "@/app/api/events/route";
import { POST as joinRoute } from "@/app/api/join/[code]/route";
import { POST as completeRoute } from "@/app/api/uploads/complete/route";
import { POST as presignRoute } from "@/app/api/uploads/presign/route";
import { db, pool } from "@/db/client";
import { media } from "@/db/schema";
import { bootstrap } from "@/server/bootstrap";
import { activeProvider } from "@/server/storage";

type Json = Record<string, unknown>;

beforeAll(async () => {
  await bootstrap();
});

afterAll(async () => {
  await pool.end();
});

async function call(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  method: string,
  url: string,
  token?: string,
  body?: unknown,
  params: Record<string, string> = {},
) {
  const response = await handler(
    new Request(url, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve(params) },
  );
  const data = (await response.json()) as Json;
  return { status: response.status, data };
}

async function login(email: string, password: string) {
  const { status, data } = await call(loginRoute, "POST", "http://localhost/api/auth/login", undefined, { email, password });
  expect(status).toBe(200);
  return data.token as string;
}

async function photo() {
  return sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 20, g: 80, b: 140 } },
  })
    .png()
    .toBuffer();
}

test("a host or admin can delete a mistaken event and its files", async () => {
  const host = await login("host@eventdrop.app", "demo-host-1234");
  const admin = await login("admin@eventdrop.app", "demo-admin-1234");
  const created = await call(createRoute, "POST", "http://localhost/api/events", host, { name: "Mistake" });
  expect(created.status).toBe(201);
  const event = created.data.event as Json;
  const eventId = event.id as string;
  const kept = await call(createRoute, "POST", "http://localhost/api/events", admin, { name: "Keep me" });
  const keptId = (kept.data.event as Json).id as string;

  const body = await photo();
  const fileHash = createHash("sha256").update(body).digest("hex");
  const presign = await call(presignRoute, "POST", "http://localhost/api/uploads/presign", host, {
    eventId,
    fileName: "oops.png",
    mimeType: "image/png",
    fileSize: body.length,
    fileHash,
  });
  expect(presign.status).toBe(200);
  const put = await fetch(presign.data.url as string, {
    method: "PUT",
    headers: presign.data.headers as Record<string, string>,
    body,
  });
  expect(put.ok).toBe(true);
  const done = await call(completeRoute, "POST", "http://localhost/api/uploads/complete", host, {
    uploadId: presign.data.uploadId,
  });
  expect(done.status).toBe(200);
  const [stored] = await db.select().from(media).where(eq(media.eventId, eventId));
  expect(stored?.storageKey).toBeTruthy();

  const forbidden = await call(deleteRoute, "DELETE", `http://localhost/api/events/${keptId}`, host, undefined, { id: keptId });
  expect(forbidden.status).toBe(403);

  const removed = await call(deleteRoute, "DELETE", `http://localhost/api/events/${eventId}`, host, undefined, { id: eventId });
  expect(removed.status).toBe(200);

  const missing = await call(getRoute, "GET", `http://localhost/api/events/${eventId}`, host, undefined, { id: eventId });
  expect(missing.status).toBe(404);
  const listed = await call(listRoute, "GET", "http://localhost/api/events", host);
  const names = ((listed.data.events as Json[]) || []).map((item) => item.id);
  expect(names).not.toContain(eventId);
  const join = await call(joinRoute, "POST", `http://localhost/api/join/${event.joinCode}`, undefined, {}, { code: event.joinCode as string });
  expect(join.status).toBe(404);
  const leftover = await db.select().from(media).where(eq(media.eventId, eventId));
  expect(leftover).toHaveLength(0);
  expect(await activeProvider().head(stored!.storageKey)).toBeNull();
  if (stored?.thumbKey) expect(await activeProvider().head(stored.thumbKey)).toBeNull();

  const overview = await call(overviewRoute, "GET", "http://localhost/api/admin/overview", admin);
  expect(overview.status).toBe(200);
  const ids = ((overview.data.events as Json[]) || []).map((item) => item.id);
  expect(ids).not.toContain(eventId);
  expect(ids).toContain(keptId);

  const adminRemoved = await call(deleteRoute, "DELETE", `http://localhost/api/events/${keptId}`, admin, undefined, { id: keptId });
  expect(adminRemoved.status).toBe(200);
  const gone = await call(getRoute, "GET", `http://localhost/api/events/${keptId}`, admin, undefined, { id: keptId });
  expect(gone.status).toBe(404);
});
