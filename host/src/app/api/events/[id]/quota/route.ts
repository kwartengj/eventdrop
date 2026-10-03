import { loadAuth, requireUser } from "@/server/auth";
import { getEventForHost } from "@/server/events";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  const event = await getEventForHost(user, id);
  return { body: { quota: event.quota, counts: event.counts } };
});
