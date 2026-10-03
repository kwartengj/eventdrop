import { loadAuth } from "@/server/auth";
import { completeUpload } from "@/server/uploads";
import { readJson, route } from "@/server/http";

export const POST = route(async (req) => {
  return { body: await completeUpload(await loadAuth(req), await readJson(req)) };
});
