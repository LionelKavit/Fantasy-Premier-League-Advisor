## 1. Subordinate knowledge to the committed chip plan

- [x] 1.1 In `lib/scout/system-prompt.ts`, frame `expertKnowledgeBlock()`'s intro as *general* principles (not a license to override the committed plan's chip decision)
- [x] 1.2 Add an explicit authority clause — placed *after* the knowledge block (recency) and only when a `chipPlan` is present — stating the committed chip plan is authoritative for the chip decision: the Scout MUST NOT recommend playing a different chip this gameweek than the plan's play-now (nor recommend a chip when the plan holds); use the principles only to explain the committed call
- [x] 1.3 Keep `chipPlanBlock`'s existing "treat as authoritative / defend THIS plan" instruction, and keep the full knowledge (no per-consumer trimming)

## 2. Tests

- [x] 2.1 In `lib/__tests__/scout/ask.test.ts`, assert that with both a `chipPlan` and the curated knowledge, the prompt contains the subordination clause (committed plan authoritative over principles for the chip decision)
- [x] 2.2 Assert the clause is omitted when no `chipPlan` is supplied, and that general knowledge is still present in both cases

## 3. Verify

- [x] 3.1 Green gate: `tsc`, eslint, `vitest` pass
- [x] 3.2 Manually verify in the running app (GW38 team, plan = Bench Boost play-now): ask "Is Triple Captain better than Bench Boost this week?" → the Scout backs Bench Boost and explains why, and does NOT recommend playing Triple Captain instead; confirm a general question ("when should I Wildcard?") still answers from the principles
