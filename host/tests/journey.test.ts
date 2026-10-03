import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import jsQR from "jsqr";
import JSZip from "jszip";
import { PNG } from "pngjs";
import sharp from "sharp";
import { afterAll, beforeAll, expect, test } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as downloadRoute, POST as startDownloadRoute } from "@/app/api/events/[id]/download/route";
import { GET as jobRoute } from "@/app/api/events/[id]/downloads/[jobId]/route";
import { POST as closeRoute } from "@/app/api/events/[id]/close/route";
import { GET as mediaRoute } from "@/app/api/events/[id]/media/route";
import { POST as createRoute } from "@/app/api/events/route";
import { POST as joinRoute } from "@/app/api/join/[code]/route";
import { POST as completeRoute } from "@/app/api/uploads/complete/route";
import { POST as presignRoute } from "@/app/api/uploads/presign/route";
import { db, pool } from "@/db/client";
import { eventSettings } from "@/db/schema";
import { bootstrap } from "@/server/bootstrap";

type Json = Record<string, unknown>;

beforeAll(async () => {
  await bootstrap();
});

afterAll(async () => {
  await pool.end();
});

function decodeQr(dataUrl: string) {
  const png = PNG.sync.read(Buffer.from(dataUrl.split(",")[1] || "", "base64"));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
}

async function call(
  handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
  method: string,
  url: string,
  token?: string,
  body?: unknown,
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const response = await handler(
    new Request(url, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve(params) },
  );
  const data = (await response.json()) as Json;
  return { status: response.status, data };
}

async function photo(n: number) {
  return sharp({
    create: {
      width: 48,
      height: 36,
      channels: 3,
      background: { r: n % 256, g: (n * 13) % 256, b: (n * 29) % 256 },
    },
  })
    .png()
    .toBuffer();
}

async function login() {
  const { status, data } = await call(loginRoute, "POST", "http://localhost/api/auth/login", undefined, {
    email: "host@eventdrop.app",
    password: "demo-host-1234",
  });
  expect(status).toBe(200);
  return data.token as string;
}

async function upload(token: string, eventId: string, body: Buffer, fileName: string) {
  const fileHash = createHash("sha256").update(body).digest("hex");
  const presign = await call(presignRoute, "POST", "http://localhost/api/uploads/presign", token, {
    eventId,
    fileName,
    mimeType: "image/png",
    fileSize: body.length,
    fileHash,
  });
  if (presign.data.duplicate) return presign;
  expect(presign.status, JSON.stringify(presign.data)).toBe(200);
  const put = await fetch(presign.data.url as string, {
    method: "PUT",
    headers: presign.data.headers as Record<string, string>,
    body,
  });
  expect(put.ok, await put.text()).toBe(true);
  const done = await call(completeRoute, "POST", "http://localhost/api/uploads/complete", token, {
    uploadId: presign.data.uploadId,
  });
  expect(done.status, JSON.stringify(done.data)).toBe(200);
  expect(done.data.status).toBe("complete");
  return done;
}

async function uploadMany(token: string, eventId: string, count: number, offset: number) {
  const images = await Promise.all(Array.from({ length: count }, (_, index) => photo(offset + index)));
  let cursor = 0;
  async function worker() {
    while (cursor < images.length) {
      const index = cursor;
      cursor += 1;
      await upload(token, eventId, images[index]!, `guest-${offset}-${index}.png`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
}

test("host creates a wedding, three guests upload 50 photos, and download returns them", async () => {
  const host = await login();
  const created = await call(createRoute, "POST", "http://localhost/api/events", host, {
    name: "Sarah & John's Wedding",
    eventDate: "2026-06-20",
    hostName: "Sarah",
    description: "Garden ceremony",
    privacy: "link",
    videosAllowed: true,
  });
  expect(created.status).toBe(201);
  const event = created.data.event as Json;
  expect(event.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  expect(Number.isInteger(Number(event.joinCode))).toBe(false);
  const url = event.joinUrl as string;
  expect(url).toBe(`http://localhost:3000/e/${event.joinCode}`);
  expect(decodeQr(event.qrDataUrl as string)).toBe(url);

  const second = await call(createRoute, "POST", "http://localhost/api/events", host, { name: "Other" });
  expect((second.data.event as Json).joinCode).not.toBe(event.joinCode);

  async function join(name: string) {
    const result = await call(
      joinRoute,
      "POST",
      `http://localhost/api/join/${event.joinCode}`,
      undefined,
      { displayName: name },
      { code: event.joinCode as string },
    );
    expect(result.status, JSON.stringify(result.data)).toBe(200);
    expect(result.data.token).toBeTruthy();
    return result.data.token as string;
  }

  const guest1 = await join("Alex");
  const guest2 = await join("Sam");
  const guest3 = await join("Jordan");
  await uploadMany(guest1, event.id as string, 15, 1);
  await uploadMany(guest2, event.id as string, 30, 100);
  await uploadMany(guest3, event.id as string, 5, 200);

  const media = await call(
    mediaRoute,
    "GET",
    `http://localhost/api/events/${event.id}/media`,
    host,
    undefined,
    { id: event.id as string },
  );
  expect(media.status).toBe(200);
  const items = media.data.items as unknown[];
  expect(items).toHaveLength(50);
  const names = new Set(items.map((item) => (item as { contributor: { name: string } }).contributor.name));
  expect(names).toEqual(new Set(["Alex", "Sam", "Jordan"]));

  const started = await call(
    startDownloadRoute,
    "POST",
    `http://localhost/api/events/${event.id}/download`,
    host,
    { scope: "all" },
    { id: event.id as string },
  );
  expect(started.status).toBe(202);
  const jobId = (started.data.job as Json).id as string;
  let ready: Json | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await call(
      jobRoute,
      "GET",
      `http://localhost/api/events/${event.id}/downloads/${jobId}`,
      host,
      undefined,
      { id: event.id as string, jobId },
    );
    const current = job.data.job as Json;
    if (current.status === "failed") throw new Error(String(current.error));
    if (current.status === "ready") {
      ready = current;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  expect(ready?.status).toBe("ready");
  expect(ready?.fileCount).toBe(50);
  const archive = await fetch(ready?.downloadUrl as string);
  expect(archive.ok).toBe(true);
  const zip = await JSZip.loadAsync(Buffer.from(await archive.arrayBuffer()));
  const files = Object.values(zip.files).filter((file) => !file.dir);
  expect(files).toHaveLength(50);
  const bytes = await files[0]!.async("nodebuffer");
  expect(bytes.subarray(0, 4).toString("hex")).toBe("89504e47");

  const getDownload = await call(
    downloadRoute,
    "GET",
    `http://localhost/api/events/${event.id}/download?scope=photos`,
    host,
    undefined,
    { id: event.id as string },
  );
  expect(getDownload.status).toBe(202);
});

test("blocks bad files, full storage, closed events, duplicates, and hidden galleries", async () => {
  const host = await login();
  const created = await call(createRoute, "POST", "http://localhost/api/events", host, {
    name: "Rules",
    privacy: "private",
  });
  const event = created.data.event as { id: string; joinCode: string };
  const join = async (name: string) => {
    const result = await call(joinRoute, "POST", `http://localhost/api/join/${event.joinCode}`, undefined, { displayName: name }, {
      code: event.joinCode,
    });
    return result.data.token as string;
  };
  const alex = await join("Alex");
  const blocked = await call(presignRoute, "POST", "http://localhost/api/uploads/presign", alex, {
    eventId: event.id,
    fileName: "run.exe",
    mimeType: "application/octet-stream",
    fileSize: 20,
    fileHash: "a".repeat(64),
  });
  expect(blocked.status).toBe(400);

  const image = await photo(7);
  await upload(alex, event.id, image, "one.png");
  const again = await call(presignRoute, "POST", "http://localhost/api/uploads/presign", await join("Sam"), {
    eventId: event.id,
    fileName: "copy.png",
    mimeType: "image/png",
    fileSize: image.length,
    fileHash: createHash("sha256").update(image).digest("hex"),
  });
  expect(again.status).toBe(200);
  expect(again.data.duplicate).toBe(true);

  const sam = again; // token was consumed; join again for the gallery check
  void sam;
  const samToken = await join("Sam");
  await db.update(eventSettings).set({ galleryVisibility: "own_only" }).where(eq(eventSettings.eventId, event.id));
  const hidden = await call(
    mediaRoute,
    "GET",
    `http://localhost/api/events/${event.id}/media`,
    samToken,
    undefined,
    { id: event.id },
    { "x-eventdrop-view": "guest" },
  );
  expect(hidden.status).toBe(200);
  expect(hidden.data.items).toEqual([]);

  await db.update(eventSettings).set({ quotaBytes: 100 }).where(eq(eventSettings.eventId, event.id));
  const full = await call(presignRoute, "POST", "http://localhost/api/uploads/presign", alex, {
    eventId: event.id,
    fileName: "more.png",
    mimeType: "image/png",
    fileSize: image.length,
    fileHash: createHash("sha256").update(await photo(8)).digest("hex"),
  });
  expect(full.status).toBe(413);
  expect(String(full.data.error)).toMatch(/storage/i);

  await call(closeRoute, "POST", `http://localhost/api/events/${event.id}/close`, host, {}, { id: event.id });
  const closed = await call(presignRoute, "POST", "http://localhost/api/uploads/presign", alex, {
    eventId: event.id,
    fileName: "late.png",
    mimeType: "image/png",
    fileSize: image.length,
    fileHash: "b".repeat(64),
  });
  expect(closed.status).toBe(403);
});

test("rate limits join-code guesses", async () => {
  const ip = `guess-${Date.now()}`;
  let limited = 0;
  for (let i = 0; i < 25; i += 1) {
    const result = await call(
      joinRoute,
      "POST",
      "http://localhost/api/join/ZZZZZZ",
      undefined,
      { displayName: "Nope" },
      { code: "ZZZZZZ" },
      { "x-forwarded-for": ip },
    );
    if (result.status === 429) limited += 1;
  }
  expect(limited).toBeGreaterThan(0);
});
