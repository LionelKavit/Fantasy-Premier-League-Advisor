# Design — self-hosted Docker + Caddy deployment

## Constraints (from the app's shape)
- **Node server runtime** (not edge/serverless): server-side Anthropic SDK, `fs` reads, in-memory caches.
- **Long requests** (~30–60s insights = 3 LLM calls) → proxy/read timeouts must be generous.
- **Single stateful instance** — per-process caches (context, insights, team-news, FPL HTTP). Do **not** horizontally scale.
- **Runtime `fs` read** of `lib/knowledge/*.md` via `process.cwd()/lib/knowledge` → the files must be present on disk in the image.
- **One secret** (`ANTHROPIC_API_KEY`) — runtime env only.
- **No database**; **no auth layer** → access must be gated at the proxy.

## The standalone build
`output: "standalone"` makes `next build` emit `.next/standalone/` — a minimal self-contained server (`server.js` + a trimmed `node_modules`) that runs with `node server.js`. Static assets (`.next/static`, `public/`) are copied alongside it. This is what we containerize.

## Dockerfile (multi-stage)
- **deps**: `npm ci` from `package.json` + lockfile (cached layer).
- **builder**: copy source, `npm run build` → produces `.next/standalone`.
- **runner** (`node:22-alpine`): `WORKDIR /app`; copy `public/`, `.next/standalone` → `./`, `.next/static` → `./.next/static`, **and `lib/knowledge` → `./lib/knowledge`** (so `readFileSync(process.cwd()/lib/knowledge/*.md)` resolves at `/app/lib/knowledge`). Non-root user; `EXPOSE 3000`; `CMD ["node", "server.js"]`. `ANTHROPIC_API_KEY` is **not** set here — it arrives at runtime.

## docker-compose.yml
Two services:
- `app`: built from the Dockerfile; `env_file: .env` (host-only, gitignored) for `ANTHROPIC_API_KEY`; `restart: unless-stopped`; not published to the host directly (only Caddy talks to it).
- `caddy`: official Caddy image; publishes ports 80/443; mounts the `Caddyfile`; persists its certs in a volume; `depends_on: app`.

## Caddyfile (the receptionist)
- `reverse_proxy app:3000` — forward visitors to the app container.
- **Automatic HTTPS** (Caddy fetches/renews the certificate by itself) when a domain is set; a local/dev block for testing.
- `basicauth` — a username + hashed password gate (mandatory before any public exposure, since each request costs Anthropic credits).
- `reverse_proxy { transport http { read_timeout 120s } }` — so the 30–60s insights call completes.

## Secrets
`.env` lives only on the host (and the Mac for local testing), already gitignored. It is never copied into the image or committed. Compose reads it via `env_file`.

## Local-first verification
On the Mac: `docker compose up --build`. Confirm the pitch + insights work in-container, the chip/rank knowledge grounding is present (proves the `lib/knowledge` copy), and the insights request finishes (proves the timeout). For local testing, Caddy can serve over `http://localhost` (no real cert needed) or be skipped to hit the app container directly.

## Pitfalls
- **Forgetting to copy `lib/knowledge`** → grounding silently degrades to "" (the #1 gotcha).
- **Default proxy timeout** cutting off insights → set `read_timeout`.
- **Baking the API key into the image** → never; runtime env only.
- **Scaling to >1 instance** → breaks the in-memory caches; keep it single.
