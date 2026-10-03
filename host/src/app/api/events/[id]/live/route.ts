import { z } from "zod";
import { loadAuth, requireUser } from "@/server/auth";
import { getEventForHost, updateEvent } from "@/server/events";
import { parse, readJson, route } from "@/server/http";
import { listMedia } from "@/server/uploads";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  const event = await getEventForHost(user, id);
  const media = await listMedia(await loadAuth(req), id, { limit: 80 }, "host");
  return { body: { enabled: event.settings.liveModeEnabled, items: media.items } };
});

export const POST = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  const body = parse(z.object({ enabled: z.boolean() }), await readJson(req));
  const event = await updateEvent(user, id, { liveModeEnabled: body.enabled });
  return { body: { enabled: event.settings.liveModeEnabled } };
});
