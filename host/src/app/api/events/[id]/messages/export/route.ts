import { loadAuth, requireUser } from "@/server/auth";
import { messagesPrint, messagesWorkbook } from "@/server/messages";
import { route } from "@/server/http";

export const GET = route(async (req, ctx) => {
  const { id } = await ctx.params;
  const user = requireUser(await loadAuth(req));
  const format = new URL(req.url).searchParams.get("format");
  if (format === "xlsx") {
    const file = await messagesWorkbook(user, id);
    return fileResponse(
      file.body,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      file.filename,
    );
  }
  const file = await messagesPrint(user, id);
  return fileResponse(file.body, "application/pdf", file.filename);
});

function fileResponse(body: Buffer, type: string, filename: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
