import { readFileSync } from "fs";
import path from "path";

try {
  const text = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]!]) continue;
    process.env[match[1]!] = match[2]!;
  }
} catch {
  // Docker injects the environment directly.
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  const { bootstrap } = await import("../server/bootstrap");
  await bootstrap();
  console.log("database ready");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
