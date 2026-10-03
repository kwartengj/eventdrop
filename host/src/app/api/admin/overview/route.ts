import { adminOverview } from "@/server/admin";
import { loadAuth, requireAdmin } from "@/server/auth";
import { route } from "@/server/http";

export const GET = route(async (req) => {
  requireAdmin(await loadAuth(req));
  return { body: await adminOverview() };
});
