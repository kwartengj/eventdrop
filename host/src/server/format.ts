import { networkInterfaces } from "os";
import { currentRequestHost, hostnameFromHost, isLoopback } from "./storage/request-endpoint";

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value >= 10 || index < 2 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export function quotaLabel(used: number, total: number) {
  return `${formatBytes(used)} / ${formatBytes(total)}`;
}

export function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
}

type Nic = { name: string; address: string; internal?: boolean };

/** Prefer a Wi-Fi/Ethernet address a phone on the same network can open. */
export function pickLanAddress(entries: Nic[]) {
  let best: { address: string; score: number } | null = null;
  for (const entry of entries) {
    const score = lanScore(entry.name, entry.address, entry.internal);
    if (score < 0) continue;
    if (!best || score > best.score) best = { address: entry.address, score };
  }
  return best?.address ?? null;
}

function lanScore(name: string, ip: string, internal?: boolean) {
  if (internal || isLoopback(ip) || ip.startsWith("169.254.")) return -1;
  if (/^(docker|br-|veth|cni|flannel|cali|virbr|tun|tap|utun|tailscale|zt|wg|lo)/i.test(name)) return -1;
  // Docker bridge and compose networks are not reachable from a phone.
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return -1;
  let score = 0;
  if (ip.startsWith("192.168.")) score += 50;
  else if (ip.startsWith("10.")) score += 40;
  else score += 10;
  if (/^(en|eth|wlan|wl|wi-?fi)/i.test(name)) score += 20;
  return score;
}

function thisMachineLanIp() {
  const found: Nic[] = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family !== "IPv4") continue;
      found.push({ name, address: address.address, internal: address.internal });
    }
  }
  return pickLanAddress(found);
}

/** Origin encoded in QR codes and share links. */
export function advertiseOrigin() {
  const configured = (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return configured;
  }
  if (!isLoopback(url.hostname)) return configured;

  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  const lan = thisMachineLanIp();
  if (lan) return `${url.protocol}//${lan}:${port}`;

  const seen = currentRequestHost();
  const hostname = hostnameFromHost(seen || "");
  if (hostname && !isLoopback(hostname)) {
    const hasPort = seen?.startsWith("[") ? seen.includes("]:") : (seen || "").includes(":");
    // A public host with no port arrived on 80 or 443. Do not append the
    // local dev port from PUBLIC_APP_URL, or share links miss the site.
    if (hasPort) return `${url.protocol}//${seen}`;
    return `${url.protocol}//${hostname}`;
  }
  return configured;
}

export function joinUrl(code: string) {
  return `${advertiseOrigin()}/e/${code}`;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

export function normalizeCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
