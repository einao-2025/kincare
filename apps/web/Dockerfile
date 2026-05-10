# syntax=docker/dockerfile:1.7
FROM node:20.11.1-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
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

COPY apps/web ./apps/web
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @kincare/web build

# ─── runtime ────────────────────────────────────────────────────
FROM node:20.11.1-alpine AS runtime
RUN apk add --no-cache tini ca-certificates curl && \
    addgroup -S kincare && adduser -S -G kincare kincare
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output bundles only what's needed for runtime.
COPY --from=builder --chown=kincare:kincare /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=kincare:kincare /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=kincare:kincare /repo/apps/web/public ./apps/web/public

USER kincare
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
