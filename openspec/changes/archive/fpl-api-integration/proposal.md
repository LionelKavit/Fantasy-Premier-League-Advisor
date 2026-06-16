## Why

The FPL AI Transfer Advisor needs a reliable data layer that fetches, caches, and normalizes all player, fixture, and manager data from the Fantasy Premier League public API. Every downstream pipeline (scoring, optimization, captain pick, chip strategy) depends on this data. Without a well-defined API integration layer, each pipeline would make redundant calls, handle its own parsing, and drift on data shape assumptions.

## What Changes

- Introduce a server-side FPL API client that proxies all requests through Next.js API routes (required due to CORS policy — FPL API blocks browser-origin requests)
- Fetch and cache data from 8 public FPL endpoints with 1-hour TTL
- Normalize raw API responses into typed, consistent data structures (e.g., `now_cost` ÷ 10 → price in £m, `bank` ÷ 10 → budget in £m)
- Expose internal API routes (`/api/bootstrap`, `/api/squad`, `/api/fixtures`) that the frontend consumes
- Detect current gameweek, blank gameweeks (BGW), and double gameweeks (DGW) from fixture data

## Capabilities

### New Capabilities
- `fpl-data-fetcher`: Server-side client for all FPL API endpoints with response caching (1hr TTL). Handles 8 endpoints: bootstrap-static, entry, picks, history, fixtures, element-summary, event-live, set-piece-notes.
- `fpl-data-models`: TypeScript type definitions and normalization functions for all FPL data entities — players (73+ fields), teams (22 fields), fixtures, gameweeks, manager entries, picks, and transfer history.
- `fpl-api-routes`: Next.js API route layer that proxies FPL data to the frontend and serves as the entry point for pipeline execution. Routes: /api/bootstrap, /api/squad, /api/fixtures, /api/transfers, /api/advice.
- `fpl-gameweek-detection`: Logic to determine current gameweek, detect BGW (≥4 teams with 0 fixtures) and DGW (≥4 teams with 2 fixtures), and compute per-team fixture counts per gameweek.

### Modified Capabilities

## Impact

- **Code**: Creates `lib/fpl-api.ts`, `lib/types.ts`, and 5 files under `app/api/`
- **APIs**: All FPL endpoints are public (no auth). CORS restriction means all calls must originate server-side (Next.js API routes), never from browser JavaScript
- **Dependencies**: `next` (API routes), no additional HTTP libraries needed (native `fetch` in Node 18+)
- **Rate limiting**: FPL API has no documented rate limits, but caching at 1hr TTL keeps request volume minimal (API updates once daily during the season)
