import { loadAuth, requireUser } from "@/server/auth";
import { getEventForHost, updateEvent } from "@/server/events";
import { readJson, route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  return { body: { event: await getEventForHost(user, id) } };
});

export const PATCH = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  return { body: { event: await updateEvent(user, id, await readJson(req)) } };
});
