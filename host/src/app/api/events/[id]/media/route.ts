import { loadAuth } from "@/server/auth";
import { listMedia } from "@/server/uploads";
import { preferGuest, route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const view = preferGuest(req) ? "guest" : "host";
  const query = {
    contributorId: url.searchParams.get("contributorId") || undefined,
    type: url.searchParams.get("type") || undefined,
    date: url.searchParams.get("date") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  };
  return { body: await listMedia(await loadAuth(req), id, query, view) };
});
