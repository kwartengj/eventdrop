import { loadAuth, requireUser } from "@/server/auth";
import { getEventForHost, listActivity } from "@/server/events";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  await getEventForHost(user, id);
  return { body: { activity: await listActivity(id) } };
});
