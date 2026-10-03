import { loadAuth, requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { listDestinations } from "@/server/storage";

export const GET = route(async (req) => {
  requireUser(await loadAuth(req));
  return { body: { destinations: listDestinations() } };
});
