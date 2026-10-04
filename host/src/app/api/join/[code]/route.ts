import { z } from "zod";
import { loadAuth } from "@/server/auth";
import { joinByCode, previewByCode } from "@/server/events";
import { clientIp, parse, readJson, route, sessionCookie } from "@/server/http";

const schema = z.object({
  displayName: z.string().trim().max(80).optional(),
  message: z.string().trim().max(400).optional(),
});

export const GET = route(async (req, ctx) => {
  const { code } = await ctx.params;
  const auth = await loadAuth(req);
  return { body: await previewByCode(code, clientIp(req), auth.guest) };
});

export const POST = route(async (req, ctx) => {
  const { code } = await ctx.params;
  const auth = await loadAuth(req);
  const raw = await req.text();
  const body = raw ? parse(schema, JSON.parse(raw)) : {};
  const result = await joinByCode(code, body.displayName, clientIp(req), auth.guest, body.message);
  return {
    body: result,
    cookies: result.token ? [sessionCookie("guest", result.token)] : undefined,
  };
});
