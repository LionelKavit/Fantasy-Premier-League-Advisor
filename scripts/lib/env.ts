import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// The standalone runners (deadline brief, live-eval tick) run outside Next.js, so
// .env.local is not auto-loaded. Dotenv-style tolerance (Next accepts these forms):
// whitespace around `=`, single/double quotes around the value. Never overrides a
// variable already present in the environment.
export function loadEnvLocal(root: string): void {
  const envFile = join(root, ".env.local");
  if (!existsSync(envFile)) return;
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
