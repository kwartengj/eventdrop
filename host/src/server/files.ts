import { execFile } from "child_process";
import { createHash, randomUUID } from "crypto";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";
import { HttpError } from "./errors";

const execFileAsync = promisify(execFile);

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const BLOCKED = /\.(exe|bat|cmd|com|sh|bash|js|mjs|cjs|html|htm|php|dll|msi|apk|jar|svg|scr|ps1|dmg|app)$/i;

export function normalizeMime(fileName: string, mime: string) {
  const lower = mime.toLowerCase().split(";")[0]!.trim();
  if (lower === "image/jpg" || lower === "image/pjpeg") return "image/jpeg";
  if (lower === "image/heic-sequence" || lower === "image/heif-sequence" || lower === "image/heif") return "image/heic";
  if (lower && lower !== "application/octet-stream") return lower;
  const name = fileName.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "video/mp4";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return lower || "application/octet-stream";
}

export function assertAllowedUpload(fileName: string, mime: string, videosAllowed: boolean) {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  if (BLOCKED.test(base) || mime === "image/svg+xml" || mime.startsWith("application/") || mime.startsWith("text/")) {
    throw new HttpError(400, "This file type is not allowed", "BAD_TYPE");
  }
  const image = IMAGE_MIMES.has(mime);
  const video = VIDEO_MIMES.has(mime);
  if (!image && !video) throw new HttpError(400, "Only photos and videos can be added", "BAD_TYPE");
  if (video && !videosAllowed) throw new HttpError(400, "This event is not accepting videos", "VIDEOS_DISABLED");
  return image ? "image" : "video";
}

export function assertMagic(buf: Buffer, mime: string) {
  const ok = matchesMagic(buf, mime);
  if (!ok) throw new HttpError(400, "The file contents do not match its type", "BAD_TYPE");
}

function matchesMagic(buf: Buffer, mime: string) {
  if (buf.length < 12) return false;
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === "image/png") return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === "image/gif") return buf.subarray(0, 4).toString("ascii") === "GIF8";
  if (mime === "image/webp") return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (mime === "image/heic" || mime === "image/heif") return buf.subarray(4, 8).toString("ascii") === "ftyp";
  if (mime === "video/webm") return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
  if (mime === "video/mp4" || mime === "video/quicktime") return buf.subarray(4, 8).toString("ascii") === "ftyp";
  return false;
}

export function sha256Buffer(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

export async function inspectImage(buf: Buffer) {
  const image = sharp(buf, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  const thumb = await image.clone().resize({ width: 960, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
  return { width: meta.width ?? null, height: meta.height ?? null, thumb };
}

export async function inspectVideo(buf: Buffer) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "eventdrop-"));
  const file = path.join(dir, `${randomUUID()}.bin`);
  const thumbPath = path.join(dir, "frame.jpg");
  try {
    await writeFile(file, buf);
    let duration: number | null = null;
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        file,
      ]);
      const parsed = Number.parseFloat(stdout.trim());
      if (Number.isFinite(parsed)) duration = parsed;
    } catch {
      duration = null;
    }
    let thumb: Buffer | null = null;
    try {
      await execFileAsync("ffmpeg", ["-y", "-i", file, "-ss", "0", "-frames:v", "1", "-vf", "scale=960:-1", thumbPath]);
      thumb = await readFile(thumbPath);
    } catch {
      thumb = null;
    }
    return { duration, thumb };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
