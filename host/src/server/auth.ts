import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { attendeeSessions, eventMembers, sessions, users } from "../db/schema";
import { HttpError } from "./errors";
import { preferGuest, readCookie } from "./http";

export type PublicUser = { id: string; email: string; name: string; role: string };

export type GuestContext = {
  sessionId: string;
  eventId: string;
  memberId: string;
  displayName: string;
};

export type AuthBag = {
  user: PublicUser | null;
  guest: GuestContext | null;
  token: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUser(input: { email: string; password: string; name: string; role?: string }) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, name: input.name.trim(), role: input.role || "host" })
    .returning();
  if (!user) throw new HttpError(500, "Could not create user");
  return toPublic(user);
}

export async function login(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) throw new HttpError(401, "Email or password is wrong", "AUTH");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Email or password is wrong", "AUTH");
  const token = await issueToken({ userId: user.id });
  return { token, user: toPublic(user) };
}

export async function issueToken(input: { userId?: string; attendeeSessionId?: string }) {
  const token = randomBytes(32).toString("base64url");
  const days = Number(process.env.SESSION_DAYS || 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId: input.userId,
    attendeeSessionId: input.attendeeSessionId,
    expiresAt,
  });
  return token;
}

export async function revokeToken(token: string | null) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

async function userFromToken(token: string): Promise<PublicUser | null> {
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ? toPublic(row.user) : null;
}

async function guestFromToken(token: string): Promise<GuestContext | null> {
  const [row] = await db
    .select({
      sessionId: attendeeSessions.id,
      eventId: attendeeSessions.eventId,
      displayName: attendeeSessions.displayName,
      memberId: eventMembers.id,
      memberName: eventMembers.displayName,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(attendeeSessions, eq(attendeeSessions.id, sessions.attendeeSessionId))
    .innerJoin(eventMembers, eq(eventMembers.attendeeSessionId, attendeeSessions.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return {
    sessionId: row.sessionId,
    eventId: row.eventId,
    memberId: row.memberId,
    displayName: row.memberName || row.displayName || "Guest",
  };
}

export async function loadAuth(req: Request): Promise<AuthBag> {
  const header = req.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  if (bearer) {
    const user = await userFromToken(bearer);
    if (user) return { user, guest: null, token: bearer };
    const guest = await guestFromToken(bearer);
    if (guest) return { user: null, guest, token: bearer };
    return { user: null, guest: null, token: bearer };
  }

  const hostToken = readCookie(req, "ed_host");
  const guestToken = readCookie(req, "ed_guest");
  const guestOnly = preferGuest(req);
  const user = !guestOnly && hostToken ? await userFromToken(hostToken) : null;
  const guest = guestToken ? await guestFromToken(guestToken) : null;
  return { user, guest, token: hostToken || guestToken };
}

export function requireUser(auth: AuthBag) {
  if (!auth.user) throw new HttpError(401, "Sign in to continue", "AUTH");
  return auth.user;
}

export function requireAdmin(auth: AuthBag) {
  const user = requireUser(auth);
  if (user.role !== "admin") throw new HttpError(403, "Admin only", "FORBIDDEN");
  return user;
}

function toPublic(user: { id: string; email: string; name: string; role: string }): PublicUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
