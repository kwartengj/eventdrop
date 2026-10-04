import { loadAuth, requireUser } from "@/server/auth";
import { listGuestMessages } from "@/server/messages";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  return { body: await listGuestMessages(user, id) };
});
