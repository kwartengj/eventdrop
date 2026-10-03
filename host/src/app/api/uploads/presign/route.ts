import { loadAuth } from "@/server/auth";
import { presignUpload } from "@/server/uploads";
import { readJson, route } from "@/server/http";

export const POST = route(async (req) => {
  return { body: await presignUpload(await loadAuth(req), await readJson(req)) };
});
