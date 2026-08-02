import type { ManagerTransfer, ChipUsage } from "./types";

// Free-transfer banking (deadline-brief-email): derive the count a manager holds
// going into `targetGw` from public transfer + chip history, using the standard
// rules — 1 FT after GW1, +1 per gameweek, banked to a cap of 5, each transfer
// consumes one (floor 0 — extra moves are hits and never go negative), and
// Wildcard / Free Hit gameweeks consume nothing (the balance carries through).
// GW1 has no free-transfer concept (initial squad building is unlimited) → 0.
export function deriveFreeTransfers(
  transfers: ManagerTransfer[],
  chipPlays: ChipUsage[],
  targetGw: number
): number {
  if (targetGw <= 1) return 0;

  const chipGws = new Set(
    chipPlays
      .filter((c) => c.name === "wildcard" || c.name === "freehit")
      .map((c) => c.event)
  );
  const madeFor = new Map<number, number>();
  for (const t of transfers) {
    madeFor.set(t.event, (madeFor.get(t.event) ?? 0) + 1);
  }

  let ft = 0;
  for (let gw = 2; gw <= targetGw; gw++) {
    const prev = gw - 1;
    const usedPrev = chipGws.has(prev) ? 0 : madeFor.get(prev) ?? 0;
    // Entering GW2 the balance is exactly 1 — GW1 neither banks nor consumes.
    const carried = prev === 1 ? 0 : Math.max(0, ft - usedPrev);
    ft = Math.min(5, carried + 1);
  }
  return ft;
}
