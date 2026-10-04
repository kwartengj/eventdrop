import { asc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { db } from "../db/client";
import { guestMessages } from "../db/schema";
import { assertHost, mustGetEvent } from "./events";

export type GuestNote = { id: string; name: string; message: string; createdAt: Date };

export async function listGuestMessages(user: { id: string; role: string }, eventId: string) {
  const record = await mustGetEvent(eventId);
  assertHost(user, record);
  const rows = await db
    .select()
    .from(guestMessages)
    .where(eq(guestMessages.eventId, eventId))
    .orderBy(asc(guestMessages.createdAt));
  return {
    event: {
      name: record.event.name,
      eventDate: record.event.eventDate,
      hostName: record.event.hostDisplayName,
    },
    messages: rows.map((row) => ({
      id: row.id,
      name: row.displayName,
      message: row.body,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

async function notesFor(user: { id: string; role: string }, eventId: string) {
  const record = await mustGetEvent(eventId);
  assertHost(user, record);
  const rows = await db
    .select()
    .from(guestMessages)
    .where(eq(guestMessages.eventId, eventId))
    .orderBy(asc(guestMessages.createdAt));
  return { record, notes: rows };
}

export async function messagesWorkbook(user: { id: string; role: string }, eventId: string) {
  const { record, notes } = await notesFor(user, eventId);
  const book = new ExcelJS.Workbook();
  book.creator = "EventDrop";
  const sheet = book.addWorksheet("Messages");
  sheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Message", key: "message", width: 88 },
  ];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF3A2A1C" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E6D4" } };
  for (const note of notes) sheet.addRow({ name: note.displayName, message: note.body });
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  const buffer = await book.xlsx.writeBuffer();
  return { filename: fileSlug(record.event.name, "xlsx"), body: Buffer.from(buffer) };
}

export async function messagesPrint(user: { id: string; role: string }, eventId: string) {
  const { record, notes } = await notesFor(user, eventId);
  const when = record.event.eventDate ? formatPrintDate(record.event.eventDate) : "";
  const body = await drawGuestbook({
    title: record.event.name,
    when,
    hostName: record.event.hostDisplayName,
    notes: notes.map((note) => ({ name: note.displayName, message: note.body })),
  });
  return { filename: fileSlug(record.event.name, "pdf"), body };
}

function fileSlug(name: string, ext: string) {
  const base = name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "guestbook";
  return `${base}-guestbook.${ext}`;
}

function formatPrintDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const paper = rgb(0.973, 0.945, 0.9);
const ink = rgb(0.145, 0.1, 0.07);
const gold = rgb(0.58, 0.4, 0.18);
const mute = rgb(0.4, 0.33, 0.26);

type Note = { name: string; message: string };

async function drawGuestbook(input: { title: string; when: string; hostName: string | null; notes: Note[] }) {
  const doc = await PDFDocument.create();
  const roman = await doc.embedFont(StandardFonts.TimesRoman);
  const romanBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const romanItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const pageWidth = 612;
  const pageHeight = 792;
  const notes = input.notes.length ? input.notes : [{ name: "", message: "The first note will appear here." }];

  let page = addSheet(doc, pageWidth, pageHeight);
  let y = drawMast(page, pageWidth, pageHeight, input, roman, romanBold, romanItalic, false);
  const contentLeft = 64;
  const contentWidth = pageWidth - 128;

  for (const note of notes) {
    const lines = wrap(note.message, romanItalic, 13, contentWidth - 28);
    const block = 22 + lines.length * 17 + (note.name ? 22 : 8);
    if (y - block < 58) {
      page = addSheet(doc, pageWidth, pageHeight);
      y = drawMast(page, pageWidth, pageHeight, input, roman, romanBold, romanItalic, true);
    }
    y = drawNote(page, contentLeft, y, contentWidth, note, lines, romanItalic, romanBold);
  }

  const pages = doc.getPages();
  pages.forEach((sheet, index) => {
    const label = pages.length > 1 ? `${index + 1}  /  ${pages.length}` : "EventDrop";
    sheet.drawText(label, {
      x: pageWidth / 2 - roman.widthOfTextAtSize(label, 8) / 2,
      y: 40,
      size: 8,
      font: roman,
      color: mute,
    });
  });

  return Buffer.from(await doc.save());
}

function addSheet(doc: PDFDocument, width: number, height: number) {
  const page = doc.addPage([width, height]);
  page.drawRectangle({ x: 0, y: 0, width, height, color: paper });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: gold, borderWidth: 1.6 });
  page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderColor: ink, borderWidth: 0.6 });
  return page;
}

function drawMast(
  page: PDFPage,
  width: number,
  height: number,
  input: { title: string; when: string; hostName: string | null },
  roman: PDFFont,
  romanBold: PDFFont,
  romanItalic: PDFFont,
  continued: boolean,
) {
  const kicker = continued ? "GUESTBOOK  ·  CONTINUED" : "A GUESTBOOK FOR THE WALL";
  page.drawText(kicker, {
    x: width / 2 - roman.widthOfTextAtSize(kicker, 9) / 2,
    y: height - 78,
    size: 9,
    font: roman,
    color: gold,
  });
  const titleSize = input.title.length > 28 ? 26 : 32;
  const titleLines = wrap(input.title, romanBold, titleSize, width - 150);
  let y = height - 112;
  for (const line of titleLines) {
    page.drawText(line, {
      x: width / 2 - romanBold.widthOfTextAtSize(line, titleSize) / 2,
      y,
      size: titleSize,
      font: romanBold,
      color: ink,
    });
    y -= titleSize + 4;
  }
  const sub = winAnsi([input.when, input.hostName ? `Hosted by ${input.hostName}` : ""].filter(Boolean).join("   ·   "));
  if (sub && !continued) {
    page.drawText(sub, {
      x: width / 2 - romanItalic.widthOfTextAtSize(sub, 11) / 2,
      y: y - 4,
      size: 11,
      font: romanItalic,
      color: mute,
    });
    y -= 22;
  }
  page.drawLine({ start: { x: width / 2 - 36, y: y }, end: { x: width / 2 + 36, y: y }, thickness: 0.6, color: gold });
  return y - 28;
}

function drawNote(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  note: Note,
  lines: string[],
  italic: PDFFont,
  bold: PDFFont,
) {
  page.drawText("\u201C", { x, y: y - 4, size: 22, font: italic, color: gold });
  let cursor = y - 8;
  for (const line of lines) {
    page.drawText(line, { x: x + 18, y: cursor, size: 13, font: italic, color: ink });
    cursor -= 17;
  }
  if (note.name) {
    const signature = winAnsi(note.name).toUpperCase();
    page.drawText(signature, { x: x + 18, y: cursor - 4, size: 9, font: bold, color: mute });
    cursor -= 18;
  }
  return cursor - 16;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = winAnsi(text).split(" ").flatMap((word) => splitWord(word, font, size, maxWidth));
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function splitWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  if (!word) return [];
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const parts: string[] = [];
  let chunk = "";
  for (const char of word) {
    const next = chunk + char;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) chunk = next;
    else {
      if (chunk) parts.push(chunk);
      chunk = char;
    }
  }
  if (chunk) parts.push(chunk);
  return parts;
}

function winAnsi(text: string) {
  const mapped: Record<string, string> = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": '"',
    "\u201D": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2026": "...",
    "\u00A0": " ",
  };
  let out = "";
  for (const char of text.replace(/\s+/g, " ").trim()) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code <= 126) out += char;
    else if (mapped[char]) out += mapped[char];
    else if (code >= 0xa1 && code <= 0xff && code !== 0xad) out += char;
    else out += "?";
  }
  return out;
}
