import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { storageProviders, users } from "./schema";

const DEMO = [
  {
    email: "host@eventdrop.app",
    password: "demo-host-1234",
    name: "Demo Host",
    role: "host",
  },
  {
    email: "admin@eventdrop.app",
    password: "demo-admin-1234",
    name: "App Owner",
    role: "admin",
  },
];

const PROVIDERS = [
  { kind: "minio", name: "EventDrop storage", enabled: true, isDefault: true },
  { kind: "s3", name: "Amazon S3", enabled: false, isDefault: false },
  { kind: "r2", name: "Cloudflare R2", enabled: false, isDefault: false },
  { kind: "local", name: "Local disk", enabled: false, isDefault: false },
  { kind: "google_drive", name: "Google Drive", enabled: false, isDefault: false },
  { kind: "dropbox", name: "Dropbox", enabled: false, isDefault: false },
];

export async function seed() {
  for (const user of DEMO) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, user.email)).limit(1);
    if (existing.length) continue;
    const passwordHash = await bcrypt.hash(user.password, 10);
    await db.insert(users).values({
      email: user.email,
      passwordHash,
      name: user.name,
      role: user.role,
    });
  }

  for (const provider of PROVIDERS) {
    const existing = await db
      .select({ id: storageProviders.id })
      .from(storageProviders)
      .where(eq(storageProviders.kind, provider.kind))
      .limit(1);
    if (existing.length) continue;
    await db.insert(storageProviders).values({
      kind: provider.kind,
      name: provider.name,
      enabled: provider.enabled,
      isDefault: provider.isDefault,
      config: {},
    });
  }
}
