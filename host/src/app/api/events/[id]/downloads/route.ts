import { loadAuth, requireUser } from "@/server/auth";
import { listDownloads } from "@/server/downloads";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  return { body: { jobs: await listDownloads(user, id) } };
});
