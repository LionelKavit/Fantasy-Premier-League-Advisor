/**
 * player-nationality-map — seeding / provenance.
 *
 * FPL's `element.region` is FPL's own numeric id scheme (e.g. 200 = Spain,
 * 241 = England) and there is NO public lookup mapping those ids to country
 * names. This script fetches live bootstrap, buckets every distinct `region`
 * id to a few example player names, and prints them — so the curated table in
 * `lib/fpl-regions.ts` is seeded from observed data (recognise the players →
 * map the id), not guessed.
 *
 * Dev-only: never imported by application/runtime code.
 *
 * Run:  npx tsx scripts/dump-regions.ts
 */

interface BootstrapElement {
  first_name: string;
  second_name: string;
  web_name: string;
  region: number | null;
  total_points: number;
}

async function main(): Promise<void> {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    headers: { "User-Agent": "FPL-Advisor/1.0" },
  });
  if (!res.ok) {
    throw new Error(`bootstrap fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { elements: BootstrapElement[] };

  // region id → players (most-pointed first, so the examples are recognisable)
  const byRegion = new Map<number, BootstrapElement[]>();
  let missing = 0;
  for (const el of data.elements) {
    if (el.region == null) {
      missing++;
      continue;
    }
    const list = byRegion.get(el.region) ?? [];
    list.push(el);
    byRegion.set(el.region, list);
  }

  const ids = [...byRegion.keys()].sort((a, b) => a - b);
  console.log(`# ${ids.length} distinct region ids across ${data.elements.length} players` +
    (missing ? ` (${missing} with null region)` : ""));
  console.log("# region id : count : example players (by total points)\n");

  for (const id of ids) {
    const players = (byRegion.get(id) ?? []).sort((a, b) => b.total_points - a.total_points);
    const examples = players
      .slice(0, 4)
      .map((p) => `${p.first_name} ${p.second_name}`.trim() || p.web_name)
      .join(", ");
    console.log(`${String(id).padStart(4)} : ${String(players.length).padStart(3)} : ${examples}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
