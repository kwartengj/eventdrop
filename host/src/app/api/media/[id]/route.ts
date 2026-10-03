import { loadAuth } from "@/server/auth";
import { deleteMedia } from "@/server/uploads";
import { route } from "@/server/http";

export const DELETE = route(async (req, ctx) => {
  const { id } = await ctx.params;
  return { body: await deleteMedia(await loadAuth(req), id) };
});
