# Deploy — self-hosted, open-source (Docker + Caddy on a server)

## Why
The app currently only runs via `next dev` on a laptop. To "ship" it, it needs to run on an always-on, internet-reachable computer. It is a **long-running, stateful Node server** (server-side LLM calls, in-memory caches, `fs` reads, 30–60s insights requests) — so it must run as a *server*, not as serverless functions. Chosen path: **fully open-source, self-hosted** — Docker + Caddy on a rented VPS (or an always-on home machine).

## What changes
Infrastructure only (no app logic change beyond one build setting):
- `next.config.ts` → `output: "standalone"` — a self-contained production server that can be packaged.
- `Dockerfile` — multi-stage build that packages the standalone server into a container; **copies `lib/knowledge/*.md` into the image** (the known runtime-`fs` gotcha) and runs as a non-root user.
- `.dockerignore` — keeps the build context clean and secrets out of the image.
- `docker-compose.yml` — runs two containers: the app + **Caddy** (reverse proxy). `restart: unless-stopped`; `ANTHROPIC_API_KEY` injected from a host `.env` (never baked into the image/git).
- `Caddyfile` — automatic HTTPS, basic-auth gate, and a **long read-timeout (~120s)** so the insights call isn't cut off.
- `DEPLOY.md` — a plain-language runbook.

## How we'll verify (test locally first)
Build and run the container **on the Mac** with `docker compose up` and confirm the app behaves identically — knowledge grounding works in-container, insights don't time out — *before* any server exists. Zero cost, zero risk.

## Out of scope
- The actual VPS purchase/provisioning (manual, one-time).
- CI/CD pipelines, multiple instances/autoscaling, any database (there is none).
- Buying a domain name (optional; can start with the server's IP or a private link).

## Decide (only affects the final Caddy config — not the local work)
- **Host:** rented VPS vs. an always-on home machine.
- **Audience:** public (real domain + basic-auth) vs. private (e.g. Tailscale, just you).
