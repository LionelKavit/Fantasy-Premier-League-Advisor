import { describe, it, expect } from "vitest";
import { region } from "../fpl-regions";

describe("region", () => {
  it("maps a known id to name + flag computed from ISO alpha-2", () => {
    expect(region(200)).toEqual({ name: "Spain", flag: "🇪🇸" });
  });

  it("computes the flag from regional-indicator codepoints", () => {
    // 🇪🇸 = U+1F1EA U+1F1F8
    expect([...(region(200)!.flag)].map((c) => c.codePointAt(0))).toEqual([0x1f1ea, 0x1f1f8]);
  });

  it("special-cases UK home nations with a subdivision flag", () => {
    const england = region(241);
    expect(england?.name).toBe("England");
    // 🏴 + tag('gbeng') + cancel tag
    expect(england?.flag).toBe("\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}");
  });

  it("returns null for an unknown id (graceful omit, no throw)", () => {
    expect(region(999999)).toBeNull();
    // an intentionally-unmapped single-player id
    expect(region(217)).toBeNull();
  });

  it("returns null for null / undefined input", () => {
    expect(region(null)).toBeNull();
    expect(region(undefined)).toBeNull();
  });
});
