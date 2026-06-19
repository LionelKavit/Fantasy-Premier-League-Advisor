/**
 * squad-eval-transfer-replay — Task 0: cache the FULL player universe + transfer history.
 *
 * The transfer optimizer scans every player for the best affordable upgrade, so we need
 * point-in-time state for all ~841 elements (not just the manager's 56). Same time-sensitive
 * 2025-26 window. Resumable: skips element-summaries already cached by fetch-cache.ts.
 *
 * Run:  npx tsx research/squad-eval/fetch-universe.ts [managerId]
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const CACHE = join(import.meta.dirname, "cache");
const MANAGER_ID = Number(process.argv[2] ?? 10815578);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (squad-eval research)" },
  });
  if (!res.ok) throw new Error(`${res.status} for ${path}`);
  return res.json();
}
async function cached(name: string, path: string): Promise<unknown> {
  const file = join(CACHE, `${name}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const data = await fetchJson(path);
  writeFileSync(file, JSON.stringify(data));
  await sleep(120);
  return data;
}

async function main() {
  await cached("manager-transfers", `/entry/${MANAGER_ID}/transfers/`);
  console.log("transfers cached");

  const bootstrap = JSON.parse(readFileSync(join(CACHE, "bootstrap.json"), "utf8"));
  const ids: number[] = bootstrap.elements.map((e: { id: number }) => e.id);
  console.log(`caching element-summary for ${ids.length} players...`);

  let fetched = 0;
  for (let i = 0; i < ids.length; i++) {
    const file = join(CACHE, `element-${ids[i]}.json`);
    if (!existsSync(file)) {
      await cached(`element-${ids[i]}`, `/element-summary/${ids[i]}/`);
      fetched++;
    }
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${ids.length} (${fetched} newly fetched)`);
  }
  console.log(`Done. ${fetched} newly fetched; ${ids.length} total cached. Universe ready.`);
}

main().catch((e) => { console.error("fetch-universe failed:", e); process.exit(1); });
