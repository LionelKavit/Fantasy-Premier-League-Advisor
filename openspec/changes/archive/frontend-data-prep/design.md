# Design

## Context

`runGameweekPlan` already builds an `AnalysisContext` once (squad analysis + bootstrap + fixtures + manager profile + gw flags) and fans out to the optimizer and captain pipelines. Everything the pitch needs is already inside that context — it's simply not surfaced in the returned `GameweekPlan`. This change projects that data into the response.

## Key Decisions

### 1. Enrich `GameweekPlan` rather than add a second endpoint/call
The UI needs squad + recommendations together. Adding the squad to `GameweekPlan` keeps it a single call and preserves the one-analysis-pass guarantee. A separate `/api/analysis` call would double the most expensive step.

### 2. Ship a trimmed display projection, not the raw `SquadAnalysisResult`
`analysis.rankedSquad` carries every signal (statistical/fixture/market/llm breakdowns) — far more than the pitch needs and heavy to serialize. Define a lean `SquadPlayerView` with only display fields, built from `analysis.picks` (for slot order) joined to `analysis.rankedSquad` (for scores/availability). v2 drill-downs can add a richer per-player endpoint later if needed.

### 3. Pick order comes from `picks`, recommendation flags are resolved server-side
`analysis.picks` gives the authoritative 1–15 slot order and starting/bench split (`position ≤ 11`). The view resolves `isCaptainRec`/`isViceRec` (from `captaincy`) and `isWeakSpot` (from `analysis.weakest3`) so the client renders armbands/highlights without cross-referencing multiple arrays. If the captain pipeline failed (null `captaincy`), those flags are simply false — the squad still renders.

### 4. Squad survives partial failure
`squad`, `bank`, `chipsRemaining`, and `manager` come from the shared analysis context, computed before fan-out — so they are present even when one (or both) sub-pipelines fail. The pitch always renders; only the recommendation flags degrade.

### 5. `teamCode` is a pass-through, not derived
The raw FPL player payload already has `team_code`; we just stopped mapping it. Add it to the normalizer and the `Player` type. No new fetch.

## Shapes (informative)

```
// Player gains:
teamCode: number

// GameweekPlan gains:
squad: SquadPlayerView[]          // 15, in pick-slot order
bank: number
chipsRemaining: ChipsRemaining
manager: { name: string; overallRank: number | null; teamName: string }

interface SquadPlayerView {
  id: number
  webName: string
  teamShortName: string
  teamCode: number
  position: Position                // GK | DEF | MID | FWD
  pickSlot: number                  // 1..15
  isStarting: boolean               // pickSlot <= 11
  price: number
  score: number                     // composite total
  availability: { status: AvailabilityStatus; chanceOfPlayingNext: number | null; news: string }
  isCaptainRec: boolean
  isViceRec: boolean
  isWeakSpot: boolean
}
```

## Reused
- `ctx.analysis` (`SquadAnalysisResult`: `picks`, `rankedSquad`, `weakest3`, `bank`, `chipsRemaining`), `ctx.managerProfile.entry` — all already populated in `lib/plan/context.ts`.
- Raw `team_code` in the FPL player payload consumed by `lib/fpl-api.ts`.
