// Canonical FPL / Premier League URL helpers. Kept in one module so hardcoded
// FPL URLs don't scatter across components.

/** The official FPL transfers screen — where a manager executes a move. */
export const FPL_TRANSFERS_URL = "https://fantasy.premierleague.com/transfers";

/** Lowercase, strip diacritics, collapse non-alphanumerics to single hyphens. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks (accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The player's official premierleague.com profile. FPL has no per-player page,
 * but the PL site is keyed by the player's Opta id, which FPL exposes as
 * `opta_code` (e.g. "p223094" → Haaland → /en/players/223094/erling-haaland/overview).
 * The slug is required (an id-only URL doesn't resolve), so it's derived from the
 * full name. Returns null when there's no usable Opta id (caller hides the link).
 */
export function plPlayerUrl(optaCode: string | null | undefined, fullName: string): string | null {
  if (!optaCode) return null;
  const digits = optaCode.replace(/^p/i, "");
  if (!/^\d+$/.test(digits)) return null;
  const slug = slugify(fullName);
  if (!slug) return null;
  return `https://www.premierleague.com/en/players/${digits}/${slug}/overview`;
}
