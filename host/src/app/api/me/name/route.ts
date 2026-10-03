import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { attendeeSessions, eventMembers } from "@/db/schema";
import { loadAuth } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { parse, readJson, route } from "@/server/http";

export const PATCH = route(async (req) => {
  const auth = await loadAuth(req);
  if (!auth.guest) throw new HttpError(401, "Join this event to continue", "AUTH");
  const body = parse(z.object({ displayName: z.string().trim().min(1).max(80) }), await readJson(req));
  await db.update(attendeeSessions).set({ displayName: body.displayName }).where(eq(attendeeSessions.id, auth.guest.sessionId));
  await db.update(eventMembers).set({ displayName: body.displayName }).where(eq(eventMembers.id, auth.guest.memberId));
  return { body: { displayName: body.displayName } };
});
