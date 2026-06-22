---
name: run-for-review
description: Start the local dev server and hand the user a localhost link to review in their own browser. Use this whenever the user wants to run, start, load, or "check" the app, asks for "the port link" / "the localhost link", or says they'll review it themselves in the browser. It starts the Next.js dev server on :3000 detached, confirms it's serving, and prints the link. Critically, it does NOT drive or screenshot the app via the preview/Chrome MCP tools — the user reviews it themselves, and using those tools wastes their tokens. Prefer this over `preview_start`/Chrome automation for any "let me see it" request.
license: MIT
compatibility: Requires npm (Next.js), curl, lsof.
metadata:
  author: fpl-advisor
  version: "1.0"
---

Start the dev server and give the user the port link — then get out of the way. The user reviews in **their own browser**; your job is to make sure the server is up and hand over the URL.

**Do NOT use the preview or Chrome MCP tools** (`mcp__Claude_Preview__*`, `mcp__Claude_in_Chrome__*`, `mcp__computer-use__*`) to load, click, or screenshot the app. The user has explicitly preferred reviewing it themselves — driving a headless browser here just burns their tokens for no benefit. Verify the server with a single `curl`, not a browser tool.

**Steps**

1. **Free the port** (kill any stale server so the new one binds to 3000):
   ```bash
   lsof -ti:3000 | xargs kill -9 2>/dev/null || true
   ```

2. **Start the dev server detached** so it keeps running after the command returns, with logs to a file:
   ```bash
   (npx next dev -p 3000 > /tmp/fpl-dev.log 2>&1 &) ; sleep 6
   cat /tmp/fpl-dev.log
   ```
   The `sleep` gives Turbopack time to boot; the log shows the "Ready" line (and any startup error).

3. **Confirm it's serving** with a plain HTTP check (not a browser tool):
   ```bash
   curl -s -o /dev/null -w "GET / -> HTTP %{http_code}\n" http://localhost:3000/
   ```
   Expect `200`. If it's not ready yet, wait a couple seconds and retry; if it stays down, read `/tmp/fpl-dev.log` for the error and report it.

4. **Hand over the link.** Tell the user plainly:
   > → http://localhost:3000

   Mention that `.env.local` is loaded if present (so the full LLM pipeline runs, not the keyless fallback), and that logs are at `/tmp/fpl-dev.log`. If the change you want them to look at is on a specific screen, point them to it in one line.

5. **Offer to stop it** when they're done. To stop the server later:
   ```bash
   lsof -ti:3000 | xargs kill -9 2>/dev/null
   ```

**When this skill applies vs not:** use it for "let me look at it" / "give me the link" — i.e. the human is the reviewer. If the user instead asks *you* to verify a change worked (and hasn't said they'll check it themselves), that's a different job — read the logs / curl specific routes, or use the project's own `verify` flow, still without driving a browser unless they ask for it.
