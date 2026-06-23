/**
 * FPL `element.region` → country name + flag emoji.
 *
 * FPL's `region` is its own numeric id scheme (e.g. 200 = Spain, 241 = England)
 * and there is NO public lookup for it. This table is hand-curated from observed
 * data: `scripts/dump-regions.ts` buckets every distinct region id to example
 * players, and each id is mapped to a country by recognising those players'
 * nationalities. Re-run that script if flags ever go missing after a season
 * rollover, then add the new id here.
 *
 * Flags are computed from an ISO alpha-2 code (no hand-typed glyphs); the three
 * UK home nations (England/Scotland/Wales), which have no ISO alpha-2, carry a
 * `subdiv` tag sequence instead. Unknown / unmapped ids resolve to `null` so
 * consumers omit nationality rather than render a wrong or broken flag.
 *
 * A few single-player, hard-to-verify ids are intentionally left unmapped
 * (they degrade to `null`): 118, 203, 217. Add them once confirmed.
 */

interface RegionEntry {
  name: string;
  /** ISO 3166-1 alpha-2. Present for all entries except UK home nations. */
  iso2?: string;
  /** Region subtag code (e.g. "gbeng") for nations with no ISO alpha-2. */
  subdiv?: string;
}

const REGIONS: Record<number, RegionEntry> = {
  2: { name: "Albania", iso2: "AL" },
  3: { name: "Algeria", iso2: "DZ" },
  6: { name: "Angola", iso2: "AO" },
  10: { name: "Argentina", iso2: "AR" },
  13: { name: "Australia", iso2: "AU" },
  14: { name: "Austria", iso2: "AT" },
  21: { name: "Belgium", iso2: "BE" },
  30: { name: "Brazil", iso2: "BR" },
  34: { name: "Bulgaria", iso2: "BG" },
  35: { name: "Burkina Faso", iso2: "BF" },
  38: { name: "Cameroon", iso2: "CM" },
  39: { name: "Canada", iso2: "CA" },
  48: { name: "Colombia", iso2: "CO" },
  50: { name: "DR Congo", iso2: "CD" },
  54: { name: "Côte d'Ivoire", iso2: "CI" },
  57: { name: "Czechia", iso2: "CZ" },
  58: { name: "Denmark", iso2: "DK" },
  62: { name: "Ecuador", iso2: "EC" },
  63: { name: "Egypt", iso2: "EG" },
  67: { name: "Estonia", iso2: "EE" },
  73: { name: "France", iso2: "FR" },
  78: { name: "Gambia", iso2: "GM" },
  79: { name: "Georgia", iso2: "GE" },
  80: { name: "Germany", iso2: "DE" },
  81: { name: "Ghana", iso2: "GH" },
  83: { name: "Greece", iso2: "GR" },
  90: { name: "Guinea-Bissau", iso2: "GW" },
  92: { name: "Haiti", iso2: "HT" },
  97: { name: "Croatia", iso2: "HR" },
  98: { name: "Hungary", iso2: "HU" },
  99: { name: "Iceland", iso2: "IS" },
  104: { name: "Republic of Ireland", iso2: "IE" },
  105: { name: "Israel", iso2: "IL" },
  106: { name: "Italy", iso2: "IT" },
  107: { name: "Jamaica", iso2: "JM" },
  108: { name: "Japan", iso2: "JP" },
  114: { name: "South Korea", iso2: "KR" },
  132: { name: "Mali", iso2: "ML" },
  139: { name: "Mexico", iso2: "MX" },
  145: { name: "Morocco", iso2: "MA" },
  146: { name: "Mozambique", iso2: "MZ" },
  152: { name: "Netherlands", iso2: "NL" },
  154: { name: "New Zealand", iso2: "NZ" },
  157: { name: "Nigeria", iso2: "NG" },
  161: { name: "Norway", iso2: "NO" },
  168: { name: "Paraguay", iso2: "PY" },
  169: { name: "Peru", iso2: "PE" },
  172: { name: "Poland", iso2: "PL" },
  173: { name: "Portugal", iso2: "PT" },
  177: { name: "Romania", iso2: "RO" },
  189: { name: "Senegal", iso2: "SN" },
  190: { name: "Serbia", iso2: "RS" },
  194: { name: "Slovakia", iso2: "SK" },
  195: { name: "Slovenia", iso2: "SI" },
  198: { name: "South Africa", iso2: "ZA" },
  200: { name: "Spain", iso2: "ES" },
  206: { name: "Sweden", iso2: "SE" },
  207: { name: "Switzerland", iso2: "CH" },
  218: { name: "Tunisia", iso2: "TN" },
  219: { name: "Türkiye", iso2: "TR" },
  225: { name: "Ukraine", iso2: "UA" },
  229: { name: "United States", iso2: "US" },
  230: { name: "Uruguay", iso2: "UY" },
  231: { name: "Uzbekistan", iso2: "UZ" },
  233: { name: "Venezuela", iso2: "VE" },
  239: { name: "Zimbabwe", iso2: "ZW" },
  241: { name: "England", subdiv: "gbeng" },
  242: { name: "Northern Ireland", iso2: "GB" }, // no RGI 'gbnir' flag → UK flag
  243: { name: "Scotland", subdiv: "gbsct" },
  244: { name: "Wales", subdiv: "gbwls" },
};

/** ISO alpha-2 → emoji via regional-indicator codepoints (e.g. "ES" → 🇪🇸). */
function flagFromIso2(iso2: string): string {
  return String.fromCodePoint(
    ...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** Subdivision flag (e.g. "gbeng" → 🏴󠁧󠁢󠁥󠁮󠁧󠁿) via tag-sequence codepoints. */
function subdivisionFlag(code: string): string {
  const tags = [...code].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("");
  return `\u{1F3F4}${tags}\u{E007F}`;
}

/**
 * Resolve an FPL `region` id to a display country name + flag emoji.
 * Returns `null` for unknown / unmapped ids and for `null`/`undefined` input,
 * so callers omit the nationality rather than render a wrong value. Never throws.
 */
export function region(id: number | null | undefined): { name: string; flag: string } | null {
  if (id == null) return null;
  const entry = REGIONS[id];
  if (!entry) return null;
  const flag = entry.subdiv ? subdivisionFlag(entry.subdiv) : flagFromIso2(entry.iso2 ?? "");
  return { name: entry.name, flag };
}
