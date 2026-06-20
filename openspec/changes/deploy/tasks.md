## Tasks — deploy (Docker + Caddy, self-hosted)

> Steps 1–4 are entirely on the developer Mac (no server, no cost). Steps 5–6 need a host.

### Task 1: Standalone production build
**Capability:** deployment
- `next.config.ts` → `output: "standalone"`. Verify `next build` emits `.next/standalone/`.

### Task 2: Containerize (the "box")
**Capability:** deployment
- `Dockerfile` — multi-stage (deps → builder → runner on `node:22-alpine`); copy `public/`, `.next/standalone`, `.next/static`, **and `lib/knowledge`**; non-root user; `CMD node server.js`.
- `.dockerignore` — exclude `node_modules`, `.next`, `.git`, `research`, `historical_data`, `.env*`, `.claude`.

### Task 3: Orchestrate (app + receptionist)
**Capability:** deployment
- `docker-compose.yml` — `app` (env_file `.env`, `restart: unless-stopped`) + `caddy` (ports 80/443, mounts `Caddyfile`, cert volume).
- `Caddyfile` — `reverse_proxy app:3000`, basic-auth, `read_timeout 120s`, auto-HTTPS (domain) + a local block for testing.

### Task 4: Local proof (on the Mac)
**Capability:** deployment
- `docker compose up --build`; confirm pitch + insights work, knowledge grounding present (proves the `lib/knowledge` copy), insights don't time out. Fix anything before touching a host.

### Task 5: Host + deploy (needs the Decide answers)
**Capability:** deployment
- Provision the host (VPS or home machine), install Docker, copy the project + `.env`, `docker compose up -d`. Point a domain or a private link; Caddy provisions TLS.

### Task 6: Runbook
**Capability:** deployment
- `DEPLOY.md` — plain-language steps to build, run, update, and view logs.

### Decide
- [ ] Host: rented VPS vs. always-on home machine.
- [ ] Audience: public (domain + basic-auth) vs. private (Tailscale).

---

## As-built — Steps 1–4 complete (verified locally 2026-06-20)

- **Step 1** `next.config.ts` → `output: "standalone"`; build emits `.next/standalone` (38 MB).
- **Step 2** `Dockerfile` (multi-stage) + `.dockerignore`; image `pocket-scout:local` bakes (~70 MB content); verified `lib/knowledge/*.md` is **inside** the image.
- **Step 3** `docker-compose.yml` (app + caddy, gitignored `.env.docker` secrets) + `Caddyfile` (env-driven address, basic_auth, `read_timeout 180s`).
- **Step 4** `docker compose up -d` runs the full stack on the Mac. Verified through Caddy: base API returns the real squad; password gate works (no pass → 401, right → 200, wrong → 401); knowledge files readable in the running container.

**Gotcha recorded for the server step:** bcrypt password hashes contain `$`, which Docker Compose interpolates. Escape every `$` as `$$` in `.env.docker`'s `BASIC_AUTH_HASH` (`interpolate: false` is NOT supported by the installed Compose version). The `.env.docker` filename keeps it out of git (`.env*`) and avoids the root-`.env` auto-load.

Remaining: **Step 5** (provision host + deploy) and **Step 6** (`DEPLOY.md`) — both gated on the two Decide answers.
