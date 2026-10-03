import { AsyncLocalStorage } from "node:async_hooks";

const current = new AsyncLocalStorage<string | null>();

function hostnameFromHost(host: string): string {
  const trimmed = host.trim();
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end > 1 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.replace(/:\d+$/, "");
}

function isLoopback(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
}

/**
 * Signed URLs default to localhost, which a phone cannot open.
 * When storage is configured on loopback and the browser reached the app
 * by another host, sign for that same host on the storage port.
 */
export function clientFacingStorageEndpoint(configured: string): string {
  const seen = current.getStore();
  if (!seen) return configured;
  let base: URL;
  try {
    base = new URL(configured);
  } catch {
    return configured;
  }
  if (!isLoopback(base.hostname) || isLoopback(seen)) return configured;
  base.hostname = seen;
  return base.toString().replace(/\/$/, "");
}

export function runWithRequestStorage<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const header = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0] || "";
  return current.run(hostnameFromHost(header) || null, fn);
}
