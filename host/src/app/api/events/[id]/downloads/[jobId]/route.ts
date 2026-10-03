import { loadAuth, requireUser } from "@/server/auth";
import { getDownload } from "@/server/downloads";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id, jobId } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  return { body: { job: await getDownload(user, id, jobId) } };
});
