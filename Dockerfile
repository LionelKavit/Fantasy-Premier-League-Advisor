# syntax=docker/dockerfile:1

# ── Stage 1: deps — install the project's dependencies ───────────────────────
# A throwaway stage whose only job is `npm ci`. Kept separate so Docker can
# reuse this layer (and skip re-installing) whenever the code changes but the
# dependency list (package.json / lock file) does not.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: builder — produce the self-contained production server ──────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build      # emits .next/standalone (because output: "standalone")

# ── Stage 3: runner — the small final box that actually ships ────────────────
# A fresh, minimal image containing only what's needed to RUN (no source, no
# dev dependencies). This is what runs on the server.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user (safer: if the app is ever exploited, it isn't root).
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Static assets + the public folder (standalone does NOT include these).
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

# The self-contained server (server.js + a trimmed node_modules).
COPY --from=builder /app/.next/standalone ./

# The runtime knowledge files — copy the WHOLE folder so adding more markdown
# later "just works" on the next rebuild. Without this, the chip/rank grounding
# loader can't find them at runtime and silently degrades.
COPY --from=builder /app/lib/knowledge ./lib/knowledge

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# ANTHROPIC_API_KEY is NOT set here — it is injected at runtime (compose .env).
CMD ["node", "server.js"]
