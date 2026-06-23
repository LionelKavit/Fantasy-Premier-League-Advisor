import { describe, it, expect } from "vitest";
import { plPlayerUrl, slugify, FPL_TRANSFERS_URL } from "../../client/fpl-links";

describe("slugify", () => {
  it("lowercases, strips diacritics, and hyphenates", () => {
    expect(slugify("Erling Haaland")).toBe("erling-haaland");
    expect(slugify("Heung-min Son")).toBe("heung-min-son");
    expect(slugify("João Pedro")).toBe("joao-pedro");
    expect(slugify("N'Golo Kanté")).toBe("n-golo-kante");
  });
});

describe("plPlayerUrl", () => {
  it("maps a valid opta_code + name to the premierleague.com profile", () => {
    expect(plPlayerUrl("p223094", "Erling Haaland")).toBe(
      "https://www.premierleague.com/en/players/223094/erling-haaland/overview"
    );
  });

  it("accepts a bare numeric opta id (no leading p)", () => {
    expect(plPlayerUrl("223094", "Erling Haaland")).toBe(
      "https://www.premierleague.com/en/players/223094/erling-haaland/overview"
    );
  });

  it("returns null for missing or malformed opta_code", () => {
    expect(plPlayerUrl(null, "Erling Haaland")).toBeNull();
    expect(plPlayerUrl(undefined, "Erling Haaland")).toBeNull();
    expect(plPlayerUrl("", "Erling Haaland")).toBeNull();
    expect(plPlayerUrl("abc", "Erling Haaland")).toBeNull();
  });

  it("returns null when the name yields an empty slug", () => {
    expect(plPlayerUrl("p223094", "—")).toBeNull();
  });
});

describe("FPL_TRANSFERS_URL", () => {
  it("points at the official transfers screen", () => {
    expect(FPL_TRANSFERS_URL).toBe("https://fantasy.premierleague.com/transfers");
  });
});
