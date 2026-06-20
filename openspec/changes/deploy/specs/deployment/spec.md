## ADDED Requirements

### Requirement: The app ships as a self-hosted Node-server container behind Caddy
The app SHALL be deployable as a single long-running Node-server container, fronted by Caddy for HTTPS and access control, with no serverless/edge dependency and no database.

#### Scenario: Production build is self-contained
- **WHEN** the app is built for deployment
- **THEN** `next.config` uses `output: "standalone"` so `next build` emits a self-contained server runnable via `node server.js`

#### Scenario: The container includes the runtime knowledge files
- **WHEN** the Docker image is built
- **THEN** `lib/knowledge/*.md` is copied into the image at the path `process.cwd()/lib/knowledge` so the chip/rank grounding loader resolves them at runtime (not silently degrading to "")
- **AND** the container runs as a non-root user and does not contain the `ANTHROPIC_API_KEY`

#### Scenario: Secrets are injected at runtime
- **WHEN** the container runs
- **THEN** `ANTHROPIC_API_KEY` is supplied via a host-only `.env` (gitignored), never baked into the image or committed

#### Scenario: Caddy provides HTTPS, access control, and a long timeout
- **WHEN** Caddy fronts the app
- **THEN** it terminates HTTPS (auto-certificate when a domain is set), gates access with basic-auth, and uses a read-timeout of ≥120s so the 30–60s insights request completes

#### Scenario: Single stateful instance
- **WHEN** the app is deployed
- **THEN** exactly one app instance runs (in-memory caches are per-process); it is not horizontally scaled

#### Scenario: Verified locally before any server
- **WHEN** `docker compose up --build` is run on the developer machine
- **THEN** the app behaves identically to dev — pitch + insights render, knowledge grounding is present, the insights request does not time out — confirming the image before deploying to a host
