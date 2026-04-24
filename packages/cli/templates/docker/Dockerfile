# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Compiles src/ → dist/ and migrations/*.ts → dist/migrations/*.js
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

COPY --chown=appuser:appgroup docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER appuser

EXPOSE 3030

ENV NODE_ENV=production

# Runs migrations, optionally seeds (SEED_ON_START=true), then starts the server
ENTRYPOINT ["/entrypoint.sh"]
