import { loadAuth, requireUser } from "@/server/auth";
import { closeEvent } from "@/server/events";
import { route } from "@/server/http";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  return { body: { event: await closeEvent(user, id) } };
});
