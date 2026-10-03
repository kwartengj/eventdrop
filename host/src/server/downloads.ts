import { createReadStream, createWriteStream } from "fs";
import { mkdtemp, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import archiver from "archiver";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client";
import { downloadJobs, eventMembers, media } from "../db/schema";
import type { PublicUser } from "./auth";
import { HttpError } from "./errors";
import { assertHost, mustGetEvent } from "./events";
import { safeFileName } from "./format";
import { activeProvider } from "./storage";

const scopeSchema = z.enum(["photos", "videos", "all"]);

const jobs = new Map<string, Promise<void>>();

export async function startDownload(user: PublicUser, eventId: string, scopeInput: unknown) {
  const scope = scopeSchema.parse(scopeInput);
  const record = await mustGetEvent(eventId);
  assertHost(user, record);
  const [job] = await db
    .insert(downloadJobs)
    .values({ eventId, requestedBy: user.id, scope, status: "pending" })
    .returning();
  if (!job) throw new HttpError(500, "Could not start download");
  const work = processJob(job.id).finally(() => jobs.delete(job.id));
  jobs.set(job.id, work);
  return presentJob(job.id);
}

export async function getDownload(user: PublicUser, eventId: string, jobId: string) {
  const record = await mustGetEvent(eventId);
  assertHost(user, record);
  return presentJob(jobId, eventId);
}

export async function listDownloads(user: PublicUser, eventId: string) {
  const record = await mustGetEvent(eventId);
  assertHost(user, record);
  const rows = await db
    .select()
    .from(downloadJobs)
    .where(eq(downloadJobs.eventId, eventId))
    .orderBy(desc(downloadJobs.createdAt))
    .limit(20);
  const result = [];
  for (const row of rows) result.push(await presentJob(row.id, eventId));
  return result;
}

async function presentJob(jobId: string, eventId?: string) {
  const [job] = await db.select().from(downloadJobs).where(eq(downloadJobs.id, jobId)).limit(1);
  if (!job || (eventId && job.eventId !== eventId)) throw new HttpError(404, "Download not found", "NOT_FOUND");
  let downloadUrl: string | null = null;
  if (job.status === "ready" && job.storageKey) {
    const record = await mustGetEvent(job.eventId);
    const filename = `${safeFileName(record.event.name)}-${job.scope}.zip`;
    downloadUrl = await activeProvider().presignGet(job.storageKey, { downloadName: filename });
  }
  return {
    id: job.id,
    eventId: job.eventId,
    scope: job.scope,
    status: job.status,
    fileCount: job.fileCount,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    downloadUrl,
  };
}

async function processJob(jobId: string) {
  const [job] = await db.select().from(downloadJobs).where(eq(downloadJobs.id, jobId)).limit(1);
  if (!job) return;
  await db.update(downloadJobs).set({ status: "processing" }).where(eq(downloadJobs.id, jobId));
  const dir = await mkdtemp(path.join(os.tmpdir(), "eventdrop-zip-"));
  const zipPath = path.join(dir, "archive.zip");
  try {
    const filters = [eq(media.eventId, job.eventId), eq(media.status, "ready")];
    if (job.scope === "photos") filters.push(ilike(media.mimeType, "image/%"));
    if (job.scope === "videos") filters.push(ilike(media.mimeType, "video/%"));
    const rows = await db
      .select({ item: media, name: eventMembers.displayName })
      .from(media)
      .innerJoin(eventMembers, eq(eventMembers.id, media.contributorId))
      .where(and(...filters));
    const provider = activeProvider();
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 1 } });
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
      archive.pipe(output);
      void (async () => {
        try {
          const used = new Set<string>();
          for (const row of rows) {
            const folder = row.item.mimeType.startsWith("video/") ? "Videos" : "Photos";
            let name = `${folder}/${safeFileName(row.name)}-${safeFileName(row.item.fileName)}`;
            if (used.has(name)) name = `${folder}/${row.item.id.slice(0, 8)}-${safeFileName(row.item.fileName)}`;
            used.add(name);
            const body = await provider.getObject(row.item.storageKey);
            archive.append(body, { name });
          }
          await archive.finalize();
        } catch (error) {
          reject(error);
        }
      })();
    });
    const info = await stat(zipPath);
    const key = `events/${job.eventId}/zips/${job.id}.zip`;
    const stream = createReadStream(zipPath);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { S3Client } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "eventdrop",
        secretAccessKey: process.env.S3_SECRET_KEY || "eventdrop-secret",
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET || "eventdrop",
        Key: key,
        Body: stream,
        ContentLength: info.size,
        ContentType: "application/zip",
      }),
    );
    await db
      .update(downloadJobs)
      .set({ status: "ready", storageKey: key, fileCount: rows.length, completedAt: new Date() })
      .where(eq(downloadJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Zip failed";
    await db.update(downloadJobs).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(downloadJobs.id, jobId));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function downloadScopeFromRequest(value: string | null) {
  return scopeSchema.parse(value || "all");
}
