import { describe, expect, it } from "vitest";
import { sha256Bytes } from "@/client/sha256";
import { normalizeMime } from "@/server/files";
import { clientFacingStorageEndpoint, runWithRequestStorage } from "@/server/storage/request-endpoint";

describe("phone uploads", () => {
  it("hashes without Web Crypto", () => {
    const bytes = new TextEncoder().encode("abc");
    expect(sha256Bytes(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("treats a phone photo with no mime as a photo", () => {
    expect(normalizeMime("IMG_2044.HEIC", "application/octet-stream")).toBe("image/heic");
    expect(normalizeMime("photo.jpg", "image/jpg")).toBe("image/jpeg");
    expect(normalizeMime("clip.mov", "")).toBe("video/quicktime");
  });

  it("signs storage urls for the host the phone used", async () => {
    const phone = new Request("http://192.168.1.20:3000/api/uploads/presign", {
      headers: { host: "192.168.1.20:3000" },
    });
    const rewritten = await runWithRequestStorage(phone, async () => clientFacingStorageEndpoint("http://localhost:9000"));
    expect(rewritten).toBe("http://192.168.1.20:9000");

    const desktop = new Request("http://localhost:3000/api/uploads/presign", { headers: { host: "localhost:3000" } });
    const local = await runWithRequestStorage(desktop, async () => clientFacingStorageEndpoint("http://localhost:9000"));
    expect(local).toBe("http://localhost:9000");

    const configured = await runWithRequestStorage(phone, async () => clientFacingStorageEndpoint("https://files.example.com"));
    expect(configured).toBe("https://files.example.com");
  });
});
