import { dropboxStub, genericStub, googleDriveStub } from "./stubs";
import { ensureBucket, S3StorageProvider } from "./s3";
import type { DestinationInfo, StorageKind, StorageProvider } from "./types";

export { ensureBucket };

const minio = new S3StorageProvider("minio");

export function activeProvider(): StorageProvider {
  return minio;
}

export function providerFor(kind: string): StorageProvider {
  if (kind === "minio") return minio;
  if (kind === "google_drive") return googleDriveStub();
  if (kind === "dropbox") return dropboxStub();
  if (kind === "s3") return genericStub("s3", "Amazon S3");
  if (kind === "r2") return genericStub("r2", "Cloudflare R2");
  if (kind === "local") return genericStub("local", "Local disk");
  return genericStub("local", kind);
}

export function listDestinations(): DestinationInfo[] {
  return [
    {
      kind: "minio",
      name: "EventDrop storage",
      connected: true,
      detail: "Private S3-compatible object storage (MinIO). This is the working destination.",
    },
    {
      kind: "s3",
      name: "Amazon S3",
      connected: false,
      detail: "Uses the same StorageProvider interface as MinIO. Not configured in this build.",
    },
    {
      kind: "r2",
      name: "Cloudflare R2",
      connected: false,
      detail: "S3-compatible. Not configured in this build.",
    },
    {
      kind: "local",
      name: "Local disk",
      connected: false,
      detail: "Single-server files. Not enabled in this build.",
    },
    {
      kind: "google_drive",
      name: "Google Drive",
      connected: false,
      detail: "Host-only OAuth seam. Not connected — no client credentials are configured.",
      folderLayout: "EventDrop/{Event Name}/Photos and EventDrop/{Event Name}/Videos",
    },
    {
      kind: "dropbox",
      name: "Dropbox",
      connected: false,
      detail: "Host-only OAuth seam. Not connected — no client credentials are configured.",
      folderLayout: "EventDrop/{Event Name}/Photos and EventDrop/{Event Name}/Videos",
    },
  ];
}

export function isStorageKind(value: string): value is StorageKind {
  return ["minio", "s3", "r2", "google_drive", "dropbox", "local"].includes(value);
}
