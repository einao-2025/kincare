# syntax=docker/dockerfile:1.7
# ─── Kincare API — production image ─────────────────────────────
FROM node:20.11.1-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /repo

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/e2e/package.json apps/e2e/
COPY packages ./packages
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter @kincare/db prisma generate
RUN pnpm --filter @kincare/api build
RUN pnpm --filter @kincare/api deploy --prod --legacy /out

# ─── runtime ────────────────────────────────────────────────────
FROM node:20.11.1-alpine AS runtime
RUN apk add --no-cache tini openssl ca-certificates curl && \
    addgroup -S kincare && adduser -S -G kincare kincare
WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000
ENV NODE_OPTIONS="--enable-source-maps"

COPY --from=builder --chown=kincare:kincare /out/node_modules ./node_modules
COPY --from=builder --chown=kincare:kincare /repo/apps/api/dist ./dist
COPY --from=builder --chown=kincare:kincare /repo/apps/api/package.json ./package.json
COPY --from=builder --chown=kincare:kincare /repo/packages/db/prisma ./prisma

USER kincare
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
