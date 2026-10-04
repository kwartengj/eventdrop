import { and, count, desc, eq, gte, ilike, inArray, lt, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "../db/client";
import {
  attendeeSessions,
  downloadJobs,
  eventMembers,
  eventSettings,
  events,
  guestMessages,
  joinAttempts,
  media,
  mediaCredits,
  storageProviders,
  uploads,
} from "../db/schema";
import type { AuthBag, GuestContext } from "./auth";
import { issueToken } from "./auth";
import { HttpError } from "./errors";
import { generateJoinCode, joinUrl, normalizeCode, quotaLabel } from "./format";
import { activeProvider } from "./storage";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name the event").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date")
    .optional()
    .nullable(),
  hostName: z.string().trim().max(80).optional().nullable(),
  privacy: z.enum(["link", "private"]).default("link"),
  galleryVisibility: z.enum(["shared", "own_only", "host_only"]).default("shared"),
  maxUploadMb: z.number().min(1).max(200).default(50),
  videosAllowed: z.boolean().default(true),
  quotaGb: z.number().min(1).max(200).default(10),
});

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  hostName: z.string().trim().max(80).nullable().optional(),
  privacy: z.enum(["link", "private"]).optional(),
  status: z.enum(["active", "closed", "archived"]).optional(),
  galleryVisibility: z.enum(["shared", "own_only", "host_only"]).optional(),
  showContributorNames: z.boolean().optional(),
  uploadsEnabled: z.boolean().optional(),
  videosAllowed: z.boolean().optional(),
  maxUploadMb: z.number().min(1).max(200).optional(),
  quotaGb: z.number().min(1).max(200).optional(),
  galleryRetentionDays: z.number().int().min(1).max(3650).optional(),
  liveModeEnabled: z.boolean().optional(),
  storageDestination: z.enum(["minio", "s3", "r2", "local", "google_drive", "dropbox"]).optional(),
});

export type EventRecord = {
  event: typeof events.$inferSelect;
  settings: typeof eventSettings.$inferSelect;
};

async function defaultProviderId() {
  const [row] = await db
    .select({ id: storageProviders.id })
    .from(storageProviders)
    .where(eq(storageProviders.kind, "minio"))
    .limit(1);
  return row?.id ?? null;
}

export async function createEvent(host: { id: string; name: string }, input: unknown) {
  const body = createSchema.parse(input);
  const providerId = await defaultProviderId();
  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await db.select({ id: events.id }).from(events).where(eq(events.joinCode, joinCode)).limit(1);
    if (!clash.length) break;
    joinCode = generateJoinCode();
  }
  const galleryVisibility = body.privacy === "private" ? "own_only" : body.galleryVisibility;
  const [event] = await db
    .insert(events)
    .values({
      hostId: host.id,
      name: body.name,
      description: body.description || null,
      eventDate: body.eventDate || null,
      hostDisplayName: body.hostName || host.name,
      joinCode,
      privacy: body.privacy,
      status: "active",
      storageProviderId: providerId,
    })
    .returning();
  if (!event) throw new HttpError(500, "Could not create event");
  await db.insert(eventSettings).values({
    eventId: event.id,
    galleryVisibility,
    uploadsEnabled: true,
    videosAllowed: body.videosAllowed,
    maxUploadBytes: Math.round(body.maxUploadMb * 1024 * 1024),
    quotaBytes: Math.round(body.quotaGb * 1024 * 1024 * 1024),
    storageDestination: "minio",
  });
  await db.insert(eventMembers).values({
    eventId: event.id,
    userId: host.id,
    displayName: body.hostName || host.name,
    role: "host",
  });
  const full = await mustGetEvent(event.id);
  return presentEvent(full, true);
}

export async function listHostEvents(hostId: string) {
  const rows = await db.select().from(events).where(eq(events.hostId, hostId)).orderBy(desc(events.createdAt));
  const result = [];
  for (const event of rows) {
    const full = await mustGetEvent(event.id);
    result.push(await presentEvent(full, true));
  }
  return result;
}

export async function mustGetEvent(id: string): Promise<EventRecord> {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) throw new HttpError(404, "Event not found", "NOT_FOUND");
  const [settings] = await db.select().from(eventSettings).where(eq(eventSettings.eventId, id)).limit(1);
  if (!settings) throw new HttpError(500, "Event settings missing");
  return { event, settings };
}

export async function getEventForHost(user: { id: string; role: string }, id: string) {
  const record = await mustGetEvent(id);
  assertHost(user, record);
  return presentEvent(record, true);
}

export function assertHost(user: { id: string; role: string }, record: EventRecord) {
  if (user.role === "admin") return;
  if (record.event.hostId !== user.id) throw new HttpError(403, "You do not host this event", "FORBIDDEN");
}

export async function updateEvent(user: { id: string; role: string }, id: string, input: unknown) {
  const record = await mustGetEvent(id);
  assertHost(user, record);
  const body = settingsSchema.parse(input);
  const eventPatch: Partial<typeof events.$inferInsert> = { updatedAt: new Date() };
  if (body.name) eventPatch.name = body.name;
  if (body.description !== undefined) eventPatch.description = body.description;
  if (body.eventDate !== undefined) eventPatch.eventDate = body.eventDate;
  if (body.hostName !== undefined) eventPatch.hostDisplayName = body.hostName;
  if (body.privacy) eventPatch.privacy = body.privacy;
  if (body.status) {
    eventPatch.status = body.status;
    if (body.status === "active") {
      eventPatch.closedAt = null;
      eventPatch.galleryVisibleUntil = null;
    }
    if (body.status === "closed") {
      eventPatch.closedAt = new Date();
      const days = body.galleryRetentionDays ?? record.settings.galleryRetentionDays;
      eventPatch.galleryVisibleUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    if (body.status === "archived") {
      eventPatch.closedAt = record.event.closedAt ?? new Date();
    }
  }
  await db.update(events).set(eventPatch).where(eq(events.id, id));

  const settingsPatch: Partial<typeof eventSettings.$inferInsert> = {};
  if (body.galleryVisibility) settingsPatch.galleryVisibility = body.galleryVisibility;
  if (body.showContributorNames !== undefined) settingsPatch.showContributorNames = body.showContributorNames;
  if (body.uploadsEnabled !== undefined) settingsPatch.uploadsEnabled = body.uploadsEnabled;
  if (body.videosAllowed !== undefined) settingsPatch.videosAllowed = body.videosAllowed;
  if (body.maxUploadMb) settingsPatch.maxUploadBytes = Math.round(body.maxUploadMb * 1024 * 1024);
  if (body.quotaGb) settingsPatch.quotaBytes = Math.round(body.quotaGb * 1024 * 1024 * 1024);
  if (body.galleryRetentionDays) settingsPatch.galleryRetentionDays = body.galleryRetentionDays;
  if (body.liveModeEnabled !== undefined) settingsPatch.liveModeEnabled = body.liveModeEnabled;
  if (body.storageDestination) settingsPatch.storageDestination = body.storageDestination;
  if (body.status === "active" && body.uploadsEnabled === undefined) settingsPatch.uploadsEnabled = true;
  if (body.status === "closed" || body.status === "archived") settingsPatch.uploadsEnabled = false;
  if (Object.keys(settingsPatch).length) {
    await db.update(eventSettings).set(settingsPatch).where(eq(eventSettings.eventId, id));
  }
  return presentEvent(await mustGetEvent(id), true);
}

export async function deleteEvent(user: { id: string; role: string }, id: string) {
  const record = await mustGetEvent(id);
  assertHost(user, record);

  const keys = new Set<string>();
  await db.transaction(async (tx) => {
    const [locked] = await tx.select({ id: events.id }).from(events).where(eq(events.id, id)).for("update");
    if (!locked) throw new HttpError(404, "Event not found", "NOT_FOUND");

    if (record.event.coverStorageKey) keys.add(record.event.coverStorageKey);
    const files = await tx
      .select({ storageKey: media.storageKey, thumbKey: media.thumbKey })
      .from(media)
      .where(eq(media.eventId, id));
    const pending = await tx.select({ storageKey: uploads.storageKey }).from(uploads).where(eq(uploads.eventId, id));
    const jobs = await tx.select({ storageKey: downloadJobs.storageKey }).from(downloadJobs).where(eq(downloadJobs.eventId, id));
    for (const file of files) {
      keys.add(file.storageKey);
      if (file.thumbKey) keys.add(file.thumbKey);
    }
    for (const row of pending) if (row.storageKey) keys.add(row.storageKey);
    for (const job of jobs) if (job.storageKey) keys.add(job.storageKey);

    const members = await tx.select({ id: eventMembers.id }).from(eventMembers).where(eq(eventMembers.eventId, id));
    const memberIds = members.map((member) => member.id);
    if (memberIds.length) await tx.delete(mediaCredits).where(inArray(mediaCredits.contributorId, memberIds));
    await tx.delete(uploads).where(eq(uploads.eventId, id));
    await tx.delete(media).where(eq(media.eventId, id));
    await tx.delete(eventMembers).where(eq(eventMembers.eventId, id));
    await tx.delete(events).where(eq(events.id, id));
  });

  const provider = activeProvider();
  await Promise.all([...keys].map((key) => provider.deleteObject(key).catch(() => undefined)));
  return { ok: true };
}

export async function closeEvent(user: { id: string; role: string }, id: string) {
  const record = await mustGetEvent(id);
  assertHost(user, record);
  const until = new Date(Date.now() + record.settings.galleryRetentionDays * 24 * 60 * 60 * 1000);
  await db
    .update(events)
    .set({ status: "closed", closedAt: new Date(), galleryVisibleUntil: until, updatedAt: new Date() })
    .where(eq(events.id, id));
  await db.update(eventSettings).set({ uploadsEnabled: false }).where(eq(eventSettings.eventId, id));
  return presentEvent(await mustGetEvent(id), true);
}

async function tooManyAttempts(ip: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(joinAttempts)
    .where(and(eq(joinAttempts.ip, ip), gte(joinAttempts.createdAt, since)));
  return Number(row?.n ?? 0) >= 20;
}

async function recordAttempt(ip: string) {
  await db.insert(joinAttempts).values({ ip });
  await db.delete(joinAttempts).where(lt(joinAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export async function findByCode(code: string, ip: string) {
  if (await tooManyAttempts(ip)) {
    throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.", "RATE_LIMIT");
  }
  const normalized = normalizeCode(code);
  if (!/^[A-Z0-9]{6}$/.test(normalized)) {
    await recordAttempt(ip);
    throw new HttpError(404, "That code does not match an event", "NOT_FOUND");
  }
  const [event] = await db.select().from(events).where(eq(events.joinCode, normalized)).limit(1);
  if (!event) {
    await recordAttempt(ip);
    throw new HttpError(404, "That code does not match an event", "NOT_FOUND");
  }
  return mustGetEvent(event.id);
}

export async function previewByCode(code: string, ip: string, guest: GuestContext | null) {
  const record = await findByCode(code, ip);
  const joined = guest?.eventId === record.event.id;
  return { event: await presentPublic(record), joined, displayName: joined ? guest?.displayName : null };
}

export async function joinByCode(
  code: string,
  displayName: string | undefined,
  ip: string,
  guest: GuestContext | null,
  message?: string,
) {
  const record = await findByCode(code, ip);
  if (record.event.status === "archived") throw new HttpError(403, "This event has been archived", "ARCHIVED");
  const name = displayName?.trim() ?? "";
  if (!name) throw new HttpError(400, "Add your name", "VALIDATION");
  if (guest?.eventId === record.event.id) {
    await renameGuest(guest, name);
    await keepMessage(record.event.id, guest.sessionId, name, message);
    return {
      alreadyJoined: true,
      token: null as string | null,
      event: await presentPublic(record),
      displayName: name,
    };
  }
  const [session] = await db
    .insert(attendeeSessions)
    .values({ eventId: record.event.id, displayName: name })
    .returning();
  if (!session) throw new HttpError(500, "Could not join");
  await db.insert(eventMembers).values({
    eventId: record.event.id,
    attendeeSessionId: session.id,
    displayName: name,
    role: "attendee",
  });
  await keepMessage(record.event.id, session.id, name, message);
  const token = await issueToken({ attendeeSessionId: session.id });
  return { alreadyJoined: false, token, event: await presentPublic(record), displayName: name };
}

export async function joinById(
  eventId: string,
  displayName: string | undefined,
  ip: string,
  guest: GuestContext | null,
  message?: string,
) {
  const record = await mustGetEvent(eventId);
  return joinByCode(record.event.joinCode, displayName, ip, guest, message);
}

async function keepMessage(eventId: string, sessionId: string, name: string, message: string | undefined) {
  const body = message?.trim();
  if (!body) return;
  const [existing] = await db
    .select({ id: guestMessages.id })
    .from(guestMessages)
    .where(eq(guestMessages.attendeeSessionId, sessionId))
    .limit(1);
  if (existing) {
    await db.update(guestMessages).set({ displayName: name, body }).where(eq(guestMessages.id, existing.id));
    return;
  }
  await db.insert(guestMessages).values({
    eventId,
    attendeeSessionId: sessionId,
    displayName: name,
    body,
  });
}

async function renameGuest(guest: GuestContext, name: string) {
  await db.update(attendeeSessions).set({ displayName: name }).where(eq(attendeeSessions.id, guest.sessionId));
  await db.update(eventMembers).set({ displayName: name }).where(eq(eventMembers.id, guest.memberId));
}

export async function leaveEvent(guest: GuestContext, eventId: string) {
  if (guest.eventId !== eventId) throw new HttpError(403, "You are not in this event", "FORBIDDEN");
  await db.delete(attendeeSessions).where(eq(attendeeSessions.id, guest.sessionId));
}

export async function usedBytes(eventId: string) {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${media.fileSize}), 0)` })
    .from(media)
    .where(and(eq(media.eventId, eventId), eq(media.status, "ready")));
  return Number(row?.n ?? 0);
}

export async function countsFor(eventId: string) {
  const [photos] = await db
    .select({ n: count() })
    .from(media)
    .where(and(eq(media.eventId, eventId), eq(media.status, "ready"), ilike(media.mimeType, "image/%")));
  const [videos] = await db
    .select({ n: count() })
    .from(media)
    .where(and(eq(media.eventId, eventId), eq(media.status, "ready"), ilike(media.mimeType, "video/%")));
  const [people] = await db
    .select({ n: sql<number>`count(distinct ${mediaCredits.contributorId})` })
    .from(mediaCredits)
    .innerJoin(media, eq(media.id, mediaCredits.mediaId))
    .where(and(eq(media.eventId, eventId), eq(media.status, "ready")));
  const [notes] = await db.select({ n: count() }).from(guestMessages).where(eq(guestMessages.eventId, eventId));
  return {
    photos: Number(photos?.n ?? 0),
    videos: Number(videos?.n ?? 0),
    contributors: Number(people?.n ?? 0),
    messages: Number(notes?.n ?? 0),
  };
}

async function coverUrl(key: string | null) {
  if (!key) return null;
  try {
    return await activeProvider().presignGet(key);
  } catch {
    return null;
  }
}

export async function presentEvent(record: EventRecord, hostView: boolean) {
  const used = await usedBytes(record.event.id);
  const counts = await countsFor(record.event.id);
  const url = joinUrl(record.event.joinCode);
  const base = {
    id: record.event.id,
    name: record.event.name,
    description: record.event.description,
    eventDate: record.event.eventDate,
    hostName: record.event.hostDisplayName,
    joinCode: record.event.joinCode,
    joinUrl: url,
    privacy: record.event.privacy,
    status: record.event.status,
    coverUrl: await coverUrl(record.event.coverStorageKey),
    closedAt: record.event.closedAt,
    galleryVisibleUntil: record.event.galleryVisibleUntil,
    counts,
    quota: {
      usedBytes: used,
      quotaBytes: record.settings.quotaBytes,
      label: quotaLabel(used, record.settings.quotaBytes),
    },
    settings: {
      galleryVisibility: record.settings.galleryVisibility,
      showContributorNames: record.settings.showContributorNames,
      uploadsEnabled: record.settings.uploadsEnabled && record.event.status === "active",
      videosAllowed: record.settings.videosAllowed,
      maxUploadBytes: record.settings.maxUploadBytes,
      quotaBytes: record.settings.quotaBytes,
      galleryRetentionDays: record.settings.galleryRetentionDays,
      liveModeEnabled: record.settings.liveModeEnabled,
      storageDestination: record.settings.storageDestination,
      activeStorage: "minio" as const,
    },
    createdAt: record.event.createdAt,
  };
  if (!hostView) return base;
  const qrDataUrl = await QRCode.toDataURL(url, {
    margin: 1,
    width: 640,
    color: { dark: "#231D17", light: "#FFFFFF" },
  });
  return { ...base, qrDataUrl };
}

export async function presentPublic(record: EventRecord) {
  const uploadsOpen = record.settings.uploadsEnabled && record.event.status === "active";
  return {
    id: record.event.id,
    name: record.event.name,
    description: record.event.description,
    eventDate: record.event.eventDate,
    hostName: record.event.hostDisplayName,
    joinCode: record.event.joinCode,
    privacy: record.event.privacy,
    status: record.event.status,
    coverUrl: await coverUrl(record.event.coverStorageKey),
    uploadsOpen,
    videosAllowed: record.settings.videosAllowed,
    galleryVisibility: record.settings.galleryVisibility,
    showContributorNames: record.settings.showContributorNames,
    galleryVisibleUntil: record.event.galleryVisibleUntil,
  };
}

export async function qrPng(user: { id: string; role: string }, id: string) {
  const record = await mustGetEvent(id);
  assertHost(user, record);
  const url = joinUrl(record.event.joinCode);
  return QRCode.toBuffer(url, {
    margin: 1,
    width: 800,
    color: { dark: "#231D17", light: "#FFFFFF" },
  });
}

export function guestCanSeeOthers(record: EventRecord) {
  if (record.event.status === "archived") return false;
  if (
    record.event.status === "closed" &&
    record.event.galleryVisibleUntil &&
    record.event.galleryVisibleUntil.getTime() < Date.now()
  ) {
    return false;
  }
  return record.settings.galleryVisibility === "shared";
}

export function guestGalleryOpen(record: EventRecord) {
  if (record.event.status === "archived") return false;
  if (
    record.event.status === "closed" &&
    record.event.galleryVisibleUntil &&
    record.event.galleryVisibleUntil.getTime() < Date.now()
  ) {
    return false;
  }
  return true;
}

export async function listContributors(eventId: string) {
  const rows = await db
    .select({
      id: eventMembers.id,
      name: eventMembers.displayName,
      role: eventMembers.role,
      photos: sql<number>`count(distinct ${media.id}) filter (where ${media.mimeType} ilike 'image/%')`,
      videos: sql<number>`count(distinct ${media.id}) filter (where ${media.mimeType} ilike 'video/%')`,
    })
    .from(eventMembers)
    .leftJoin(mediaCredits, eq(mediaCredits.contributorId, eventMembers.id))
    .leftJoin(media, and(eq(media.id, mediaCredits.mediaId), eq(media.status, "ready")))
    .where(eq(eventMembers.eventId, eventId))
    .groupBy(eventMembers.id)
    .orderBy(desc(sql`count(distinct ${media.id})`));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    photos: Number(row.photos ?? 0),
    videos: Number(row.videos ?? 0),
  }));
}

export async function listActivity(eventId: string) {
  const rows = await db
    .select({
      id: uploads.id,
      fileName: uploads.fileName,
      mimeType: uploads.mimeType,
      status: uploads.status,
      createdAt: uploads.createdAt,
      name: eventMembers.displayName,
    })
    .from(uploads)
    .innerJoin(eventMembers, eq(eventMembers.id, uploads.contributorId))
    .where(eq(uploads.eventId, eventId))
    .orderBy(desc(uploads.createdAt))
    .limit(40);
  return rows;
}

export async function setCover(user: { id: string; role: string }, eventId: string, key: string) {
  const record = await mustGetEvent(eventId);
  assertHost(user, record);
  await db.update(events).set({ coverStorageKey: key, updatedAt: new Date() }).where(eq(events.id, eventId));
}

export function resolveActor(auth: AuthBag, record: EventRecord, view: "host" | "guest") {
  if (view === "host") {
    if (!auth.user) throw new HttpError(401, "Sign in to continue", "AUTH");
    assertHost(auth.user, record);
    return { kind: "host" as const, user: auth.user };
  }
  if (!auth.guest || auth.guest.eventId !== record.event.id) {
    throw new HttpError(401, "Join this event to continue", "AUTH");
  }
  return { kind: "guest" as const, guest: auth.guest };
}
