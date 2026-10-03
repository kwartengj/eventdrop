import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PresignPut, StorageKind, StorageProvider } from "./types";

function client(endpoint: string) {
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "eventdrop",
      secretAccessKey: process.env.S3_SECRET_KEY || "eventdrop-secret",
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

function bucket() {
  return process.env.S3_BUCKET || "eventdrop";
}

function missing(error: unknown) {
  const err = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const code = err.name || err.Code;
  return code === "NotFound" || code === "NoSuchKey" || err.$metadata?.httpStatusCode === 404;
}

export class S3StorageProvider implements StorageProvider {
  readonly directUpload = true;
  readonly unavailableReason = null;
  private internal: S3Client;
  private publicClient: S3Client;

  constructor(readonly kind: StorageKind = "minio") {
    const internalEndpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || internalEndpoint;
    this.internal = client(internalEndpoint);
    this.publicClient = publicEndpoint === internalEndpoint ? this.internal : client(publicEndpoint);
  }

  async presignPut(key: string, mime: string): Promise<PresignPut> {
    const url = await getSignedUrl(
      this.publicClient,
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime }),
      { expiresIn: 60 * 15 },
    );
    return { url, method: "PUT", headers: { "Content-Type": mime } };
  }

  async presignGet(key: string, opts?: { downloadName?: string }) {
    const command = new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts?.downloadName ? contentDisposition(opts.downloadName) : undefined,
    });
    return getSignedUrl(this.publicClient, command, { expiresIn: 60 * 10 });
  }

  async head(key: string) {
    try {
      const result = await this.internal.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { size: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async getObject(key: string) {
    const result = await this.internal.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object");
    return Buffer.from(bytes);
  }

  async putObject(key: string, body: Buffer, mime: string) {
    await this.internal.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: mime,
        ContentLength: body.length,
      }),
    );
  }

  async deleteObject(key: string) {
    await this.internal.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  }
}

function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

let ensured = false;

export async function ensureBucket() {
  if (ensured) return;
  const endpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
  const s3 = client(endpoint);
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket() }));
  } catch (error) {
    const code = (error as { name?: string; Code?: string }).name || (error as { Code?: string }).Code;
    if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") throw error;
  }
  // Browser uploads are cross-origin. This MinIO build rejects PutBucketCors
  // (NotImplemented), so Compose sets MINIO_API_CORS_ALLOW_ORIGIN instead.
  ensured = true;
}

export function resetBucketCache() {
  ensured = false;
}
