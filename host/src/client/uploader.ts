import { mimeFromName, mimeFromNameAndBytes, newId, sha256Hex } from "@/client/sha256";
import { api, ApiError } from "@/lib/api";

function hashInBackground(file: File): Promise<string> {
  const onThisThread = () => file.arrayBuffer().then((buffer) => sha256Hex(buffer));
  if (typeof Worker === "undefined") return onThisThread();
  return new Promise<string>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./sha256.worker.ts", import.meta.url));
    } catch {
      void onThisThread().then(resolve, reject);
      return;
    }
    let settled = false;
    const finish = (hash: string) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve(hash);
    };
    const failOver = () => {
      if (settled) return;
      settled = true;
      worker.terminate();
      void onThisThread().then(resolve, reject);
    };
    worker.onmessage = (event: MessageEvent<string | { error: string }>) => {
      if (typeof event.data === "string") finish(event.data);
      else failOver();
    };
    worker.onerror = () => failOver();
    worker.postMessage(file);
  });
}

export type UploadStatus = "review" | "queued" | "uploading" | "waiting" | "done" | "duplicate" | "error";

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  previewUrl?: string;
};

type Stored = { id: string; eventId: string; name: string; type: string; blob: Blob };

const PARALLEL = 3;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("eventdrop", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("queue")) {
        request.result.createObjectStore("queue", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(record: Stored) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbDelete(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    tx.objectStore("queue").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbAll(eventId: string) {
  const db = await openDb();
  const rows = await new Promise<Stored[]>((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const request = tx.objectStore("queue").getAll();
    request.onsuccess = () => resolve(request.result as Stored[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.filter((row) => row.eventId === eventId);
}

async function fileMime(file: File) {
  const declared = (file.type || "").toLowerCase();
  if (declared && declared !== "application/octet-stream") {
    return declared === "image/jpg" || declared === "image/pjpeg" ? "image/jpeg" : declared;
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const sniffed = mimeFromNameAndBytes(file.name, header);
  return sniffed === "application/octet-stream" ? mimeFromName(file.name) : sniffed;
}

function putFile(url: string, file: Blob, headers: Record<string, string>, onProgress: (ratio: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the file (${xhr.status})`));
    };
    xhr.onerror = () => {
      if (!navigator.onLine) {
        reject(Object.assign(new Error("Waiting for connection"), { offline: true }));
        return;
      }
      reject(new Error("This phone could not reach photo storage. Stay on the same Wi-Fi as the computer, and leave port 9000 open."));
    };
    xhr.send(file);
  });
}

export function createUploader(eventId: string, onChange: (items: UploadItem[]) => void) {
  const items: UploadItem[] = [];
  const files = new Map<string, File>();
  let active = 0;
  let stopped = false;

  function emit() {
    onChange(items.map((item) => ({ ...item })));
  }

  async function persist(item: UploadItem) {
    const file = files.get(item.id);
    if (!file) return;
    await idbPut({ id: item.id, eventId, name: item.name, type: item.type, blob: file });
  }

  async function run(item: UploadItem) {
    const file = files.get(item.id);
    if (!file) {
      item.status = "error";
      item.error = "File is no longer available";
      emit();
      return;
    }
    if (!navigator.onLine) {
      item.status = "waiting";
      item.error = "Waiting for connection";
      await persist(item);
      emit();
      return;
    }
    item.status = "uploading";
    item.error = undefined;
    emit();
    try {
      const mimeType = await fileMime(file);
      item.type = mimeType;
      const fileHash = await hashInBackground(file);
      const presign = await api<{
        duplicate: boolean;
        uploadId: string;
        mediaId?: string;
        url?: string;
        headers?: Record<string, string>;
      }>("/api/uploads/presign", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          fileName: item.name,
          mimeType,
          fileSize: item.size,
          fileHash,
        }),
      }, "guest");
      if (presign.duplicate) {
        item.status = "duplicate";
        item.progress = 1;
        await idbDelete(item.id);
        emit();
        return;
      }
      await putFile(presign.url!, file, presign.headers || {}, (ratio) => {
        item.progress = Math.min(0.9, ratio);
        emit();
      });
      await api("/api/uploads/complete", {
        method: "POST",
        body: JSON.stringify({ uploadId: presign.uploadId }),
      }, "guest");
      item.status = "done";
      item.progress = 1;
      await idbDelete(item.id);
    } catch (error) {
      const offline = !navigator.onLine || (error instanceof Error && "offline" in error);
      if (offline) {
        item.status = "waiting";
        item.error = "Waiting for connection";
        await persist(item);
      } else {
        item.status = "error";
        item.error = error instanceof ApiError || error instanceof Error ? error.message : "Upload failed";
        await idbDelete(item.id).catch(() => undefined);
      }
    } finally {
      emit();
    }
  }

  function pump() {
    if (stopped || !navigator.onLine) {
      for (const item of items) {
        if (item.status === "queued") {
          item.status = "waiting";
          item.error = "Waiting for connection";
          void persist(item);
        }
      }
      emit();
      return;
    }
    for (const item of items) {
      if (active >= PARALLEL) break;
      if (item.status !== "queued") continue;
      active += 1;
      void run(item).finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  function addFiles(list: File[]) {
    const hold = true;
    for (const file of list) {
      const id = newId();
      const previewUrl = URL.createObjectURL(file);
      files.set(id, file);
      items.push({
        id,
        name: file.name || "photo",
        size: file.size,
        type: file.type || "application/octet-stream",
        progress: 0,
        status: hold ? "review" : "queued",
        previewUrl,
      });
    }
    emit();
    if (!hold) pump();
  }

  function confirmReview() {
    for (const item of items) {
      if (item.status === "review") item.status = "queued";
    }
    emit();
    pump();
  }

  function remove(id: string) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const item = items[index]!;
    if (item.status === "uploading" || item.status === "done") return;
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    items.splice(index, 1);
    files.delete(id);
    void idbDelete(id);
    emit();
  }

  async function resume() {
    const stored = await idbAll(eventId);
    for (const row of stored) {
      if (items.some((item) => item.id === row.id)) continue;
      const file = new File([row.blob], row.name, { type: row.type });
      files.set(row.id, file);
      items.push({
        id: row.id,
        name: row.name,
        size: file.size,
        type: row.type,
        progress: 0,
        status: navigator.onLine ? "queued" : "waiting",
        error: navigator.onLine ? undefined : "Waiting for connection",
        previewUrl: URL.createObjectURL(file),
      });
    }
    emit();
    pump();
  }

  function onOnline() {
    for (const item of items) {
      if (item.status === "waiting") {
        item.status = "queued";
        item.error = undefined;
      }
    }
    emit();
    pump();
  }

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", () => pump());

  return {
    addFiles,
    confirmReview,
    remove,
    resume,
    dispose() {
      stopped = true;
      window.removeEventListener("online", onOnline);
    },
  };
}
