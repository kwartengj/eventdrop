import { loadAuth } from "@/server/auth";
import { presignCover } from "@/server/uploads";
import { readJson, route } from "@/server/http";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  return { body: await presignCover(await loadAuth(req), id, await readJson(req)) };
});
