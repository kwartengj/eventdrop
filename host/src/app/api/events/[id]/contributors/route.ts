import { loadAuth } from "@/server/auth";
import { HttpError } from "@/server/errors";
import { listContributors, mustGetEvent } from "@/server/events";
import { preferGuest, route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const auth = await loadAuth(req);
  const record = await mustGetEvent(id);
  const guestView = preferGuest(req);
  const isHost = !!auth.user && (auth.user.role === "admin" || record.event.hostId === auth.user.id);
  const isGuest = auth.guest?.eventId === id;
  if (guestView || !isHost) {
    if (!isGuest) throw new HttpError(401, "Join this event to continue", "AUTH");
    if (!record.settings.showContributorNames) return { body: { contributors: [] } };
  } else if (!isHost) {
    throw new HttpError(403, "You do not host this event", "FORBIDDEN");
  }
  return { body: { contributors: await listContributors(id) } };
});
