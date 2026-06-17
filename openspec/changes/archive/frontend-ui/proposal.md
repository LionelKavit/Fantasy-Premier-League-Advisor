# Frontend UI v1 — Pocket Scout

## Why

The backend is complete and returns everything the UI needs in a single `GET /api/plan` call — the full squad (`squad[]` with pitch slots and resolved captain/vice/weak flags), the transfer and captain recommendations, and manager/bank/chip meta. But the app is still Create-Next-App boilerplate.

This builds the first real interface — **Pocket Scout**: a personal FPL scout (the differentiator vs FPL's broadcast-to-millions "The Scout"). A manager enters their FPL ID and sees their team on a pitch — **styled to feel like the official FPL "Points"/"Pick Team" page** they already know — with the AI's tailored transfer, captain, and chip recommendations alongside. Goal: **simple but rich**, immediately familiar, and accessible.

Tagline: *"Your personal FPL scout — tailored transfers, captain picks, and chip strategy for your squad. Enter your Manager ID to get scouted."*

FPL manager data is public, so there is no auth — onboarding is just a manager ID plus a free-transfers toggle.

## Visual reference

The official FPL team page (e.g. `fantasy.premierleague.com/entry/<id>/event/<gw>`) is the design reference, especially for the pitch:
- **Palette:** FPL brand — deep purple `#37003C`, bright green `#00FF87`, cyan `#04F5FF`, magenta `#E90052`, on a green pitch, white text on purple.
- **Player token anatomy:** a **frosted, translucent card** (so the pitch shows through) — club **shirt** over a **purple footer** carrying the web name and the metric. Captain **(C)** / vice **(V)** circle top-right; weak/transfer-out chip top-left; availability flag bottom-left.
- **Bench:** a clearly separated "Substitutes" strip below the pitch, with a centred heading.
- **Header:** a purple summary bar, centre-aligned (team, manager, rank, gameweek, bank).

We adapt this rather than copy actual GW points: our headline per-player number is the **composite score** (a 0–10 projected rating) rendered as **coloured text** (not a filled box), shown alongside familiar FPL stats (price, PPG, projected points).

## What Changes

- **New capability `manager-onboarding`** — "Pocket Scout" branded entry: name + tagline, manager ID (with hint), free-transfers control, `localStorage` recall.
- **New capability `team-pitch`** — FPL-authentic pitch: formation from the starting XI with the formation label at the top-centre, real club shirts (stylized-jersey fallback) on **frosted translucent cards**, full names on one line, the rating as **coloured footer text** (not a filled box), (C)/(V) circle badges, small corner weak/transfer-out chips, availability flags with text/percentage, and a separated, centred "Substitutes" strip.
- **New capability `recommendation-panel`** — primary move (transfer/roll/hit + narrative + confidence), hit verdict, captain card (captain/vice/differential + reasons), merged alerts, "AI synthesis offline" indicator on fail-safe.
- **New capability `app-shell`** — **centre-aligned** FPL-purple header (team/manager/rank/GW/bank + free-transfers + Re-analyze + Reset), single `/api/plan` fetch + state machine, skeleton, error states, responsive layout, the FPL palette as CSS variables, and **accessibility** baked in (dual color+text encoding, WCAG-AA contrast, touch targets, alt text).
- **Small data add** (`SquadPlayerView`): include `form`, `pointsPerGame`, and `epNext` so tokens can show FPL-familiar stats (cheap pass-throughs already on `Player`).

## Scope

v1 = the core screen. **Out of scope** (later): player drill-down modals, chip-usage timeline, 5-GW horizon visualization, restructure UI, transfer what-if simulation.
