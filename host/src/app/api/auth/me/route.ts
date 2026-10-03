import { loadAuth } from "@/server/auth";
import { route } from "@/server/http";

export const GET = route(async (req) => {
  const auth = await loadAuth(req);
  return { body: { user: auth.user, guest: auth.guest } };
});
