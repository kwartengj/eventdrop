import { loadAuth, requireUser } from "@/server/auth";
import { createEvent, listHostEvents } from "@/server/events";
import { readJson, route } from "@/server/http";

export const GET = route(async (req) => {
  const user = requireUser(await loadAuth(req));
  return { body: { events: await listHostEvents(user.id) } };
});

export const POST = route(async (req) => {
  const user = requireUser(await loadAuth(req));
  const event = await createEvent(user, await readJson(req));
  return { status: 201, body: { event } };
});
