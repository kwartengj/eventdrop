import { randomUUID } from "crypto";
import { and, count, desc, eq, gte, ilike, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { db } from "../db/client";
import { eventMembers, media, mediaCredits, uploads } from "../db/schema";
import type { AuthBag } from "./auth";
import { HttpError } from "./errors";
import {
  countsFor,
  guestCanSeeOthers,
  guestGalleryOpen,
  mustGetEvent,
  usedBytes,
  type EventRecord,
} from "./events";
import { assertAllowedUpload, assertMagic, inspectImage, inspectVideo, normalizeMime, sha256Buffer } from "./files";
import { safeFileName } from "./format";
import { activeProvider } from "./storage";

const presignSchema = z.object({
  eventId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  fileSize: z.number().int().positive(),
  fileHash: z.string().regex(/^[a-f0-9]{64}$/i, "File hash must be SHA-256 hex"),
});

const completeSchema = z.object({
  uploadId: z.string().uuid(),
});

const mediaQuerySchema = z.object({
  contributorId: z.string().uuid().optional(),
  type: z.enum(["photo", "video"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(120),
});

async function hostMember(eventId: string, userId: string) {
  const [member] = await db
    .select()
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);
  if (!member) throw new HttpError(403, "You do not host this event", "FORBIDDEN");
  return member;
}

export async function actorForUpload(auth: AuthBag, record: EventRecord) {
  if (auth.guest?.eventId === record.event.id) {
    const [member] = await db.select().from(eventMembers).where(eq(eventMembers.id, auth.guest.memberId)).limit(1);
    if (!member) throw new HttpError(401, "Join this event to continue", "AUTH");
    return member;
  }
  if (auth.user && (auth.user.role === "admin" || record.event.hostId === auth.user.id)) {
    return hostMember(record.event.id, auth.user.id);
  }
  throw new HttpError(401, "Join this event to add photos", "AUTH");
}

function assertOpen(record: EventRecord) {
  if (record.event.status !== "active" || !record.settings.uploadsEnabled) {
    throw new HttpError(403, "This event is not accepting uploads", "UPLOADS_CLOSED");
  }
}

async function assertRate(contributorId: string) {
  const since = new Date(Date.now() - 60_000);
  const [row] = await db
    .select({ n: count() })
    .from(uploads)
    .where(and(eq(uploads.contributorId, contributorId), gte(uploads.createdAt, since)));
  if (Number(row?.n ?? 0) >= 120) {
    throw new HttpError(429, "Too many uploads. Wait a moment and try again.", "RATE_LIMIT");
  }
}

async function readyByHash(eventId: string, hash: string) {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.eventId, eventId), eq(media.hash, hash), eq(media.status, "ready")))
    .limit(1);
  return row ?? null;
}

async function addCredit(mediaId: string, contributorId: string) {
  await db
    .insert(mediaCredits)
    .values({ mediaId, contributorId })
    .onConflictDoNothing({ target: [mediaCredits.mediaId, mediaCredits.contributorId] });
}

export async function presignUpload(auth: AuthBag, input: unknown) {
  const body = presignSchema.parse(input);
  const record = await mustGetEvent(body.eventId);
  const member = await actorForUpload(auth, record);
  assertOpen(record);
  const mimeType = normalizeMime(body.fileName, body.mimeType);
  assertAllowedUpload(body.fileName, mimeType, record.settings.videosAllowed);
  if (body.fileSize > record.settings.maxUploadBytes) {
    throw new HttpError(400, "That file is larger than this event allows", "TOO_LARGE");
  }
  await assertRate(member.id);
  const used = await usedBytes(record.event.id);
  if (used + body.fileSize > record.settings.quotaBytes) {
    throw new HttpError(
      413,
      "This event is out of storage. Uploads are paused until the host frees space or raises the quota.",
      "QUOTA",
    );
  }

  const hash = body.fileHash.toLowerCase();
  const existing = await readyByHash(record.event.id, hash);
  if (existing) {
    await addCredit(existing.id, member.id);
    const [upload] = await db
      .insert(uploads)
      .values({
        eventId: record.event.id,
        contributorId: member.id,
        mediaId: existing.id,
        fileName: body.fileName,
        mimeType,
        fileSize: body.fileSize,
        fileHash: hash,
        status: "duplicate",
        completedAt: new Date(),
      })
      .returning();
    return { duplicate: true, uploadId: upload!.id, mediaId: existing.id };
  }

  const storageKey = `events/${record.event.id}/originals/${randomUUID()}-${safeFileName(body.fileName)}`;
  const signed = await activeProvider().presignPut(storageKey, mimeType, body.fileSize);
  const [upload] = await db
    .insert(uploads)
    .values({
      eventId: record.event.id,
      contributorId: member.id,
      fileName: body.fileName,
      mimeType,
      fileSize: body.fileSize,
      fileHash: hash,
      storageKey,
      status: "presigned",
    })
    .returning();
  return {
    duplicate: false,
    uploadId: upload!.id,
    url: signed.url,
    headers: signed.headers,
    storageKey,
  };
}

export async function completeUpload(auth: AuthBag, input: unknown) {
  const body = completeSchema.parse(input);
  const [upload] = await db.select().from(uploads).where(eq(uploads.id, body.uploadId)).limit(1);
  if (!upload) throw new HttpError(404, "Upload not found", "NOT_FOUND");
  const record = await mustGetEvent(upload.eventId);
  const member = await actorForUpload(auth, record);
  if (member.id !== upload.contributorId && record.event.hostId !== auth.user?.id) {
    throw new HttpError(403, "That upload belongs to someone else", "FORBIDDEN");
  }
  if (upload.status === "complete" || upload.status === "duplicate") {
    return { mediaId: upload.mediaId, status: upload.status };
  }
  if (!upload.storageKey) throw new HttpError(400, "Upload has no storage key", "BAD_UPLOAD");

  const provider = activeProvider();
  try {
    const head = await provider.head(upload.storageKey);
    if (!head) throw new HttpError(400, "The file has not reached storage yet", "NOT_UPLOADED");
    if (head.size > record.settings.maxUploadBytes) {
      await provider.deleteObject(upload.storageKey);
      throw new HttpError(400, "That file is larger than this event allows", "TOO_LARGE");
    }
    const used = await usedBytes(record.event.id);
    if (used + head.size > record.settings.quotaBytes) {
      await provider.deleteObject(upload.storageKey);
      throw new HttpError(
        413,
        "This event is out of storage. The file was not kept. Nothing already in the gallery was deleted.",
        "QUOTA",
      );
    }
    const buf = await provider.getObject(upload.storageKey);
    assertMagic(buf, upload.mimeType);
    const hash = sha256Buffer(buf);
    const existing = await readyByHash(record.event.id, hash);
    if (existing) {
      await provider.deleteObject(upload.storageKey);
      await addCredit(existing.id, upload.contributorId);
      await db
        .update(uploads)
        .set({ status: "duplicate", mediaId: existing.id, fileHash: hash, completedAt: new Date(), fileSize: head.size })
        .where(eq(uploads.id, upload.id));
      return { mediaId: existing.id, status: "duplicate" as const };
    }

    let width: number | null = null;
    let height: number | null = null;
    let duration: number | null = null;
    let thumbKey: string | null = null;
    if (upload.mimeType.startsWith("image/")) {
      try {
        const inspected = await inspectImage(buf);
        width = inspected.width;
        height = inspected.height;
        thumbKey = `events/${record.event.id}/thumbs/${upload.id}.jpg`;
        await provider.putObject(thumbKey, inspected.thumb, "image/jpeg");
      } catch {
        // HEIC and other phone formats may not decode. Keep the original anyway.
        width = null;
        height = null;
        thumbKey = null;
      }
    } else {
      try {
        const inspected = await inspectVideo(buf);
        duration = inspected.duration;
        if (inspected.thumb) {
          thumbKey = `events/${record.event.id}/thumbs/${upload.id}.jpg`;
          await provider.putObject(thumbKey, inspected.thumb, "image/jpeg");
        }
      } catch {
        duration = null;
      }
    }

    const [item] = await db
      .insert(media)
      .values({
        eventId: record.event.id,
        contributorId: upload.contributorId,
        storageKey: upload.storageKey,
        thumbKey,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
        fileSize: head.size,
        width,
        height,
        duration,
        hash,
        uploadedAt: new Date(),
        status: "ready",
      })
      .returning();
    if (!item) throw new HttpError(500, "Could not save media");
    await addCredit(item.id, upload.contributorId);
    await db
      .update(uploads)
      .set({ status: "complete", mediaId: item.id, fileHash: hash, completedAt: new Date(), fileSize: head.size })
      .where(eq(uploads.id, upload.id));
    return { mediaId: item.id, status: "complete" as const };
  } catch (error) {
    if (!(error instanceof HttpError) || error.code !== "NOT_UPLOADED") {
      const message = error instanceof HttpError ? error.message : "Upload failed";
      await db.update(uploads).set({ status: "failed", error: message }).where(eq(uploads.id, upload.id));
    }
    throw error;
  }
}

const coverSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive().max(12 * 1024 * 1024),
});

export async function presignCover(auth: AuthBag, eventId: string, input: unknown) {
  if (!auth.user) throw new HttpError(401, "Sign in to continue", "AUTH");
  const record = await mustGetEvent(eventId);
  if (auth.user.role !== "admin" && record.event.hostId !== auth.user.id) {
    throw new HttpError(403, "You do not host this event", "FORBIDDEN");
  }
  const body = coverSchema.parse(input);
  assertAllowedUpload(body.fileName, body.mimeType, false);
  const storageKey = `events/${eventId}/cover-src-${randomUUID()}`;
  const signed = await activeProvider().presignPut(storageKey, body.mimeType, body.fileSize);
  return { url: signed.url, headers: signed.headers, storageKey };
}

export async function completeCover(auth: AuthBag, eventId: string, storageKey: string) {
  if (!auth.user) throw new HttpError(401, "Sign in to continue", "AUTH");
  const record = await mustGetEvent(eventId);
  if (auth.user.role !== "admin" && record.event.hostId !== auth.user.id) {
    throw new HttpError(403, "You do not host this event", "FORBIDDEN");
  }
  if (!storageKey.startsWith(`events/${eventId}/cover-src-`)) {
    throw new HttpError(400, "Invalid cover upload", "BAD_UPLOAD");
  }
  const provider = activeProvider();
  const buf = await provider.getObject(storageKey);
  const mime = sniffMime(buf);
  if (!mime) throw new HttpError(400, "Cover must be a photo", "BAD_TYPE");
  assertMagic(buf, mime);
  const thumb = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const key = `events/${eventId}/cover.jpg`;
  await provider.putObject(key, thumb, "image/jpeg");
  await provider.deleteObject(storageKey).catch(() => undefined);
  if (record.event.coverStorageKey && record.event.coverStorageKey !== key) {
    await provider.deleteObject(record.event.coverStorageKey).catch(() => undefined);
  }
  const { events } = await import("../db/schema");
  await db.update(events).set({ coverStorageKey: key, updatedAt: new Date() }).where(eq(events.id, eventId));
  return { coverUrl: await provider.presignGet(key) };
}

function sniffMime(buf: Buffer) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF") return "image/webp";
  return null;
}

export async function listMedia(auth: AuthBag, eventId: string, query: unknown, view: "host" | "guest") {
  const record = await mustGetEvent(eventId);
  const parsed = mediaQuerySchema.parse(query);
  let asHost = false;
  let memberId: string | null = null;
  if (view === "host") {
    if (!auth.user) throw new HttpError(401, "Sign in to continue", "AUTH");
    if (auth.user.role !== "admin" && record.event.hostId !== auth.user.id) {
      throw new HttpError(403, "You do not host this event", "FORBIDDEN");
    }
    asHost = true;
  } else {
    if (!auth.guest || auth.guest.eventId !== eventId) throw new HttpError(401, "Join this event to continue", "AUTH");
    if (!guestGalleryOpen(record)) {
      return { items: [], galleryClosed: true, counts: await countsFor(eventId) };
    }
    memberId = auth.guest.memberId;
  }

  const filters = [eq(media.eventId, eventId), eq(media.status, "ready")];
  if (parsed.type === "photo") filters.push(ilike(media.mimeType, "image/%"));
  if (parsed.type === "video") filters.push(ilike(media.mimeType, "video/%"));
  if (parsed.date) {
    filters.push(sql`${media.uploadedAt}::date = ${parsed.date}::date`);
  }
  if (!asHost && memberId && !guestCanSeeOthers(record)) {
    filters.push(eq(media.contributorId, memberId));
  }
  if (parsed.contributorId && (asHost || guestCanSeeOthers(record))) {
    filters.push(
      sql`exists (select 1 from media_credits mc where mc.media_id = ${media.id} and mc.contributor_id = ${parsed.contributorId})`,
    );
  }

  const rows = await db
    .select({
      item: media,
      contributorName: eventMembers.displayName,
    })
    .from(media)
    .innerJoin(eventMembers, eq(eventMembers.id, media.contributorId))
    .where(and(...filters))
    .orderBy(desc(media.uploadedAt))
    .limit(parsed.limit);

  const provider = activeProvider();
  const showNames = asHost || record.settings.showContributorNames;
  const items = [];
  for (const row of rows) {
    const credits = asHost ? await creditsFor(row.item.id) : [];
    const thumbKey = row.item.thumbKey || row.item.storageKey;
    items.push({
      id: row.item.id,
      fileName: row.item.fileName,
      mimeType: row.item.mimeType,
      fileSize: row.item.fileSize,
      width: row.item.width,
      height: row.item.height,
      duration: row.item.duration,
      createdAt: row.item.createdAt,
      uploadedAt: row.item.uploadedAt,
      contributor: showNames ? { id: row.item.contributorId, name: row.contributorName } : null,
      mine: memberId === row.item.contributorId || asHost,
      canDelete: asHost || memberId === row.item.contributorId,
      thumbUrl: await provider.presignGet(thumbKey),
      url: await provider.presignGet(row.item.storageKey),
      downloadUrl: await provider.presignGet(row.item.storageKey, { downloadName: row.item.fileName }),
      credits: asHost ? credits : undefined,
    });
  }
  return { items, galleryClosed: false, counts: await countsFor(eventId) };
}

async function creditsFor(mediaId: string) {
  const rows = await db
    .select({ id: eventMembers.id, name: eventMembers.displayName })
    .from(mediaCredits)
    .innerJoin(eventMembers, eq(eventMembers.id, mediaCredits.contributorId))
    .where(eq(mediaCredits.mediaId, mediaId));
  return rows;
}

export async function deleteMedia(auth: AuthBag, mediaId: string) {
  const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!item || item.status === "deleted") throw new HttpError(404, "Photo not found", "NOT_FOUND");
  const record = await mustGetEvent(item.eventId);
  const isHost = !!auth.user && (auth.user.role === "admin" || record.event.hostId === auth.user.id);
  const isOwner = !!auth.guest && auth.guest.memberId === item.contributorId && auth.guest.eventId === item.eventId;
  if (!isHost && !isOwner) throw new HttpError(403, "You can only remove your own uploads", "FORBIDDEN");
  const provider = activeProvider();
  await provider.deleteObject(item.storageKey).catch(() => undefined);
  if (item.thumbKey) await provider.deleteObject(item.thumbKey).catch(() => undefined);
  await db.update(media).set({ status: "deleted", deletedAt: new Date() }).where(eq(media.id, mediaId));
  return { ok: true };
}
