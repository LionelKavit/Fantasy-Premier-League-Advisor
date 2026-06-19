/**
 * squad-eval-captain-replay — Task 0: fetch + cache the 2025-26 data (TIME-SENSITIVE).
 *
 * The 2025-26 season is still served by the FPL API during the 2026-27 rollover, but
 * that window will close. This script caches every raw response to disk so the rest of
 * the harness can run offline against the cache. Resumable: skips files already cached.
 *
 * Run:  npx tsx research/squad-eval/fetch-cache.ts [managerId]
 */
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const CACHE = join(import.meta.dirname, "cache");
const MANAGER_ID = Number(process.argv[2] ?? 10815578);
const GWS = Array.from({ length: 36 }, (_, i) => i + 3); // GW3..38 (GW1-2 absent)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 (squad-eval research)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

/** Fetch `path`, write to `cache/<name>.json`, return parsed. Skips network if cached. */
async function cached(name: string, path: string): Promise<unknown> {
  const file = join(CACHE, `${name}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const data = await fetchJson(path);
  writeFileSync(file, JSON.stringify(data));
  await sleep(150); // be polite to the API
  return data;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  console.log(`Caching 2025-26 data for manager ${MANAGER_ID} -> ${CACHE}`);

  await cached("bootstrap", "/bootstrap-static/");
  await cached("fixtures", "/fixtures/");
  await cached("manager-history", `/entry/${MANAGER_ID}/history/`);
  console.log("  reference data cached (bootstrap, fixtures, history)");

  // Picks per GW; collect every element that appears in any squad.
  const elementIds = new Set<number>();
  let gwOk = 0;
  for (const gw of GWS) {
    try {
      const picks = (await cached(`picks-${gw}`, `/entry/${MANAGER_ID}/event/${gw}/picks/`)) as {
        picks: { element: number }[];
      };
      picks.picks.forEach((p) => elementIds.add(p.element));
      gwOk++;
    } catch (e) {
      console.log(`  GW${gw} picks unavailable: ${(e as Error).message}`);
    }
  }
  console.log(`  picks cached for ${gwOk}/${GWS.length} GWs; ${elementIds.size} distinct players`);

  let n = 0;
  for (const id of elementIds) {
    await cached(`element-${id}`, `/element-summary/${id}/`);
    if (++n % 10 === 0) console.log(`  element-summary ${n}/${elementIds.size}`);
  }
  console.log(`  element-summary cached for ${elementIds.size} players`);
  console.log("Done. Cache is complete and offline-ready.");
}

main().catch((e) => {
  console.error("fetch-cache failed:", e);
  process.exit(1);
});
