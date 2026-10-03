import { z } from "zod";
import { loadAuth } from "@/server/auth";
import { completeCover } from "@/server/uploads";
import { parse, readJson, route } from "@/server/http";

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const body = parse(z.object({ storageKey: z.string().min(1) }), await readJson(req));
  return { body: await completeCover(await loadAuth(req), id, body.storageKey) };
});
