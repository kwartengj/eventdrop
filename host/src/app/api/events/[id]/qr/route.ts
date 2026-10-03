import { loadAuth, requireUser } from "@/server/auth";
import { qrPng } from "@/server/events";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  const png = await qrPng(user, id);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "attachment; filename=eventdrop-qr.png",
    },
  });
});
