import { revokeToken } from "@/server/auth";
import { clearCookie, readCookie, route } from "@/server/http";

export const POST = route(async (req) => {
  await revokeToken(readCookie(req, "ed_host"));
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) await revokeToken(header.slice(7).trim());
  return { body: { ok: true }, cookies: [clearCookie("host")] };
});
