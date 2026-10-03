import { loadAuth } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { leaveEvent } from "@/server/events";
import { clearCookie, route } from "@/server/http";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const auth = await loadAuth(req);
  if (!auth.guest) throw new HttpError(401, "Join this event to continue", "AUTH");
  await leaveEvent(auth.guest, id);
  return { body: { ok: true }, cookies: [clearCookie("guest")] };
});
