# ZYVA Cloud IDE — container image (published to GHCR / GitHub Packages).
# Self-host: docker run -p 3000:3000 --env-file .env ghcr.io/titanxlayer/zyva:latest

# ── 1. Build stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm AS builder
WORKDIR /app

# Install deps (better-sqlite3 uses prebuilt binaries via prebuild-install)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

# Standalone output. Real secrets are injected at runtime, not build time.
ENV NEXT_STANDALONE=1
ENV CEREBRAS_API_KEY="" \
    DASHSCOPE_API_KEY="" \
    OG_PC_API_KEY="" \
    OG_PC_BASE_URL="https://pc.0g.ai/v1" \
    E2B_API_KEY="" \
    DATABASE_URL="postgresql://x:x@localhost:5432/x" \
    NEXTAUTH_SECRET="build-placeholder" \
    NEXTAUTH_URL="http://localhost:3000"
RUN npm run build

# ── 2. Runtime stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# git is needed for the in-IDE commit/push + clone features
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Next.js standalone server + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
