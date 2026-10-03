import { ZodError, ZodSchema } from "zod";
import { HttpError } from "./errors";

export function json(body: unknown, status = 200, cookies?: string[]) {
  const headers = new Headers();
  if (cookies) {
    for (const cookie of cookies) headers.append("set-cookie", cookie);
  }
  return Response.json(body, { status, headers });
}

export function readCookie(req: Request, name: string) {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "local";
}

export function preferGuest(req: Request) {
  return req.headers.get("x-eventdrop-view") === "guest";
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON", "BAD_JSON");
  }
}

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message || "Invalid input", "VALIDATION");
  }
  return result.data;
}

export function sessionCookie(kind: "host" | "guest", token: string) {
  const name = kind === "host" ? "ed_host" : "ed_guest";
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  const maxAge = 60 * 60 * 24 * Number(process.env.SESSION_DAYS || 30);
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookie(kind: "host" | "guest") {
  const name = kind === "host" ? "ed_host" : "ed_guest";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

type RouteContext = { params: Promise<Record<string, string>> };

export function route(
  fn: (req: Request, ctx: RouteContext) => Promise<Response | { status?: number; body: unknown; cookies?: string[] }>,
) {
  return async (req: Request, ctx: RouteContext) => {
    try {
      const { bootstrap } = await import("./bootstrap");
      await bootstrap();
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return json(result.body, result.status ?? 200, result.cookies);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message, code: error.code }, error.status);
      }
      if (error instanceof ZodError) {
        return json({ error: error.issues[0]?.message || "Invalid input", code: "VALIDATION" }, 400);
      }
      console.error(error);
      return json({ error: "Something went wrong" }, 500);
    }
  };
}
