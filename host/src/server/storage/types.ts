export type StorageKind = "minio" | "s3" | "r2" | "google_drive" | "dropbox" | "local";

export interface PresignPut {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface StorageProvider {
  kind: StorageKind;
  /** Browser can PUT bytes straight to storage. */
  directUpload: boolean;
  /** Set when this destination cannot accept uploads in the current build. */
  unavailableReason: string | null;
  presignPut(key: string, mime: string, size: number): Promise<PresignPut>;
  presignGet(key: string, opts?: { downloadName?: string }): Promise<string>;
  head(key: string): Promise<{ size: number; contentType?: string } | null>;
  getObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, mime: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export interface DestinationInfo {
  kind: StorageKind;
  name: string;
  connected: boolean;
  detail: string;
  folderLayout?: string;
}
