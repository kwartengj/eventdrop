import { HttpError } from "../errors";
import type { PresignPut, StorageKind, StorageProvider } from "./types";

/**
 * Host-only OAuth seams.
 *
 * Attendees never sign in to Drive or Dropbox. When a host connects an account
 * (not implemented in this build — there are no client credentials), files
 * would land in:
 *
 *   EventDrop/{Event Name}/Photos/{filename}
 *   EventDrop/{Event Name}/Videos/{filename}
 *
 * These classes fail closed so the app cannot pretend an upload reached Drive
 * or Dropbox.
 */
const LAYOUT = "EventDrop/{Event Name}/Photos and EventDrop/{Event Name}/Videos";

export class UnavailableStorage implements StorageProvider {
  readonly directUpload = false;
  constructor(
    readonly kind: StorageKind,
    readonly unavailableReason: string,
  ) {}

  private fail(): never {
    throw new HttpError(501, this.unavailableReason || "Storage is not connected", "STORAGE_UNAVAILABLE");
  }

  presignPut(): Promise<PresignPut> {
    return this.fail();
  }
  presignGet(): Promise<string> {
    return this.fail();
  }
  head(): Promise<{ size: number; contentType?: string } | null> {
    return this.fail();
  }
  readHead(): Promise<Buffer> {
    return this.fail();
  }
  openObject(): Promise<import("node:stream").Readable> {
    return this.fail();
  }
  getObject(): Promise<Buffer> {
    return this.fail();
  }
  putObject(): Promise<void> {
    return this.fail();
  }
  deleteObject(): Promise<void> {
    return this.fail();
  }
}

export function googleDriveStub() {
  return new UnavailableStorage(
    "google_drive",
    `Google Drive is not connected. OAuth needs host credentials that are not configured. Planned folders: ${LAYOUT}. Attendees do not need a Google account.`,
  );
}

export function dropboxStub() {
  return new UnavailableStorage(
    "dropbox",
    `Dropbox is not connected. OAuth needs host credentials that are not configured. Planned folders: ${LAYOUT}. Attendees do not need a Dropbox account.`,
  );
}

export function genericStub(kind: StorageKind, name: string) {
  return new UnavailableStorage(
    kind,
    `${name} is not configured in this build. Uploads stay on MinIO until that destination is connected.`,
  );
}
