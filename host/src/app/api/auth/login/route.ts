import { z } from "zod";
import { login } from "@/server/auth";
import { parse, readJson, route, sessionCookie } from "@/server/http";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const POST = route(async (req) => {
  const body = parse(schema, await readJson(req));
  const result = await login(body.email, body.password);
  return { body: result, cookies: [sessionCookie("host", result.token)] };
});
