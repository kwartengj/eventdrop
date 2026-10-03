import { migrate } from "../db/migrate";
import { seed } from "../db/seed";
import { ensureBucket } from "./storage";

let started: Promise<void> | null = null;

export function bootstrap() {
  if (!started) started = run();
  return started;
}

async function run() {
  const deadline = Date.now() + 90_000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      await migrate();
      await seed();
      await ensureBucket();
      return;
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw last;
}
