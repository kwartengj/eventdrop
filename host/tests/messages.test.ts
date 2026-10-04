import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, expect, test } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { DELETE as deleteRoute, GET as eventRoute } from "@/app/api/events/[id]/route";
import { GET as exportRoute } from "@/app/api/events/[id]/messages/export/route";
import { GET as messagesRoute } from "@/app/api/events/[id]/messages/route";
import { POST as createRoute } from "@/app/api/events/route";
import { POST as joinRoute } from "@/app/api/join/[code]/route";
import { pool } from "@/db/client";
import { createUser } from "@/server/auth";
import { bootstrap } from "@/server/bootstrap";

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

async function download(
  url: string,
  token: string,
  params: Record<string, string>,
) {
  const response = await exportRoute(
    new Request(url, { headers: { authorization: `Bearer ${token}` } }),
    { params: Promise.resolve(params) },
  );
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    bytes,
    type: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
  };
}

async function login(email: string, password: string) {
  const { status, data } = await call(loginRoute, "POST", "http://localhost/api/auth/login", undefined, { email, password });
  expect(status).toBe(200);
  return data.token as string;
}

test("guests must leave a name, and the host can print or export the guestbook", async () => {
  const host = await login("host@eventdrop.app", "demo-host-1234");
  const created = await call(createRoute, "POST", "http://localhost/api/events", host, {
    name: "KB's 50th Birthday",
    eventDate: "2026-10-04",
    hostName: "Admin",
  });
  expect(created.status).toBe(201);
  const event = created.data.event as Json;
  const eventId = event.id as string;
  const code = event.joinCode as string;

  const missing = await call(joinRoute, "POST", `http://localhost/api/join/${code}`, undefined, { message: "Hello" }, { code });
  expect(missing.status).toBe(400);

  const blank = await call(joinRoute, "POST", `http://localhost/api/join/${code}`, undefined, { displayName: "   " }, { code });
  expect(blank.status).toBe(400);

  const unknown = await call(joinRoute, "POST", "http://localhost/api/join/ZZZZZZ", undefined, {}, { code: "ZZZZZZ" });
  expect(unknown.status).toBe(404);

  const ama = await call(
    joinRoute,
    "POST",
    `http://localhost/api/join/${code}`,
    undefined,
    { displayName: "Ama", message: "Fifty years of grace, and many more." },
    { code },
  );
  expect(ama.status, JSON.stringify(ama.data)).toBe(200);
  const amaToken = ama.data.token as string;

  const kojo = await call(joinRoute, "POST", `http://localhost/api/join/${code}`, undefined, { displayName: "Kojo" }, { code });
  expect(kojo.status).toBe(200);

  const listed = await call(messagesRoute, "GET", `http://localhost/api/events/${eventId}/messages`, host, undefined, { id: eventId });
  expect(listed.status).toBe(200);
  const first = (listed.data.messages as Json[]).map((row) => ({ name: row.name, message: row.message }));
  expect(first).toEqual([{ name: "Ama", message: "Fifty years of grace, and many more." }]);

  const outsider = await createUser({
    email: `outsider-${Date.now()}@eventdrop.test`,
    password: "outsider-pass-1234",
    name: "Outsider",
  });
  const other = await login(outsider.email, "outsider-pass-1234");
  const denied = await call(messagesRoute, "GET", `http://localhost/api/events/${eventId}/messages`, other, undefined, { id: eventId });
  expect(denied.status).toBe(403);
  const deniedFile = await download(`http://localhost/api/events/${eventId}/messages/export?format=pdf`, other, { id: eventId });
  expect(deniedFile.status).toBe(403);

  const revised = "A framed note for the wall.";
  const again = await call(
    joinRoute,
    "POST",
    `http://localhost/api/join/${code}`,
    amaToken,
    { displayName: "Ama Boateng", message: `${revised} 🎂` },
    { code },
  );
  expect(again.status).toBe(200);

  const efua = await call(
    joinRoute,
    "POST",
    `http://localhost/api/join/${code}`,
    undefined,
    { displayName: "Efua", message: "Thank you for the years of faith." },
    { code },
  );
  expect(efua.status).toBe(200);

  const notes = await call(messagesRoute, "GET", `http://localhost/api/events/${eventId}/messages`, host, undefined, { id: eventId });
  const rows = (notes.data.messages as Json[]).map((row) => ({ name: row.name, message: row.message }));
  expect(rows).toEqual([
    { name: "Ama Boateng", message: `${revised} 🎂` },
    { name: "Efua", message: "Thank you for the years of faith." },
  ]);

  const shown = await call(eventRoute, "GET", `http://localhost/api/events/${eventId}`, host, undefined, { id: eventId });
  expect((shown.data.event as Json).counts).toMatchObject({ messages: 2 });

  const pdf = await download(`http://localhost/api/events/${eventId}/messages/export?format=pdf`, host, { id: eventId });
  expect(pdf.status).toBe(200);
  expect(pdf.type).toBe("application/pdf");
  expect(pdf.disposition).toContain("KB-s-50th-Birthday-guestbook.pdf");
  expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const doc = await PDFDocument.load(pdf.bytes);
  expect(doc.getPageCount()).toBeGreaterThan(0);

  const sheetFile = await download(
    `http://localhost/api/events/${eventId}/messages/export?format=xlsx`,
    host,
    { id: eventId },
  );
  expect(sheetFile.status).toBe(200);
  expect(sheetFile.type).toContain("spreadsheetml.sheet");
  expect(sheetFile.disposition).toContain("KB-s-50th-Birthday-guestbook.xlsx");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(sheetFile.bytes);
  const sheet = book.getWorksheet("Messages");
  expect(sheet?.getRow(1).getCell(1).value).toBe("Name");
  expect(sheet?.getRow(1).getCell(2).value).toBe("Message");
  expect(sheet?.getRow(2).getCell(1).value).toBe("Ama Boateng");
  expect(sheet?.getRow(2).getCell(2).value).toBe(`${revised} 🎂`);
  expect(sheet?.getRow(3).getCell(1).value).toBe("Efua");
  expect(sheet?.getRow(3).getCell(2).value).toBe("Thank you for the years of faith.");
  expect(sheet?.getRow(4).getCell(1).value).toBeNull();

  const removed = await call(deleteRoute, "DELETE", `http://localhost/api/events/${eventId}`, host, undefined, { id: eventId });
  expect(removed.status, JSON.stringify(removed.data)).toBe(200);
});
