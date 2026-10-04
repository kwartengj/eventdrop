import { z } from "zod";
import { loadAuth } from "@/server/auth";
import { joinById } from "@/server/events";
import { clientIp, parse, readJson, route, sessionCookie } from "@/server/http";

const schema = z.object({
  displayName: z.string().trim().max(80).optional(),
  message: z.string().trim().max(400).optional(),
});

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const auth = await loadAuth(req);
  const body = parse(schema, await readJson(req).catch(() => ({})));
  const result = await joinById(id, body.displayName, clientIp(req), auth.guest, body.message);
  return {
    body: result,
    cookies: result.token ? [sessionCookie("guest", result.token)] : undefined,
  };
});
