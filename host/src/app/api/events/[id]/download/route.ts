import { loadAuth, requireUser } from "@/server/auth";
import { startDownload } from "@/server/downloads";
import { readJson, route } from "@/server/http";

async function start(req: Request, id: string) {
  const user = requireUser(await loadAuth(req));
  const url = new URL(req.url);
  let scope = url.searchParams.get("scope");
  if (!scope && req.method === "POST") {
    const body = (await readJson(req).catch(() => ({}))) as { scope?: string };
    scope = body.scope ?? null;
  }
  const job = await startDownload(user, id, scope || "all");
  return { status: 202, body: { job } };
}

export const GET = route(async (req, ctx) => start(req, (await ctx.params).id));
export const POST = route(async (req, ctx) => start(req, (await ctx.params).id));
