# syntax=docker/dockerfile:1

# ---- Build stage: install all deps, build the SPA, prune to prod deps ----
FROM node:20-bookworm AS build
WORKDIR /app
# We use the distro's Chromium at runtime, so don't download puppeteer's copy.
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Runtime stage: slim image + Chromium for server-side export ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Chromium (Phase 2 PDF/PNG render) + fonts + init for clean signal/zombie handling.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-dejavu-core ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Reuse the native modules (better-sqlite3) compiled in the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# Backend source (no settings.json — config is injected via env at runtime).
COPY server.js db.js auth.js email.js settings.js billing.js entitlements.js export.js ./
COPY ingredients.seed.json ./
# SQLite lives here; mount a volume at /app/data so it persists.
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3060
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
