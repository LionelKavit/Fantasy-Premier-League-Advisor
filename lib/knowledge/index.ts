import { readFileSync } from "node:fs";
import { join } from "node:path";

// Curated, repo-authored expert-knowledge markdown loaded into LLM synthesis prompts
// (chip-strategist, later rank-aware-advice). Trusted content — no untrusted-input handling.
// Cached in-process; returns "" if the file is unavailable so grounding is strictly additive
// (a missing file degrades to no extra context and never throws).

const cache = new Map<string, string>();

export function loadKnowledge(name: string): string {
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  let text = "";
  try {
    text = readFileSync(join(process.cwd(), "lib", "knowledge", `${name}.md`), "utf8").trim();
  } catch {
    // grounding is optional — fall through to "" (narrative still works)
  }
  cache.set(name, text);
  return text;
}

/** Test-only: clear the knowledge cache. */
export function _clearKnowledgeCache(): void {
  cache.clear();
}
