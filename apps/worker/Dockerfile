# syntax=docker/dockerfile:1.7
FROM node:20.11.1-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++ \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont
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
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN pnpm install --frozen-lockfile

COPY apps/worker ./apps/worker
COPY packages ./packages
RUN pnpm --filter @kincare/db prisma generate
RUN pnpm --filter @kincare/worker build
RUN pnpm --filter @kincare/worker deploy --prod --legacy /out

# ─── runtime ────────────────────────────────────────────────────
FROM node:20.11.1-alpine AS runtime
RUN apk add --no-cache tini openssl ca-certificates \
      chromium nss freetype harfbuzz ttf-freefont && \
    addgroup -S kincare && adduser -S -G kincare kincare
WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_OPTIONS="--enable-source-maps"

COPY --from=builder --chown=kincare:kincare /out/node_modules ./node_modules
COPY --from=builder --chown=kincare:kincare /repo/apps/worker/dist ./dist
COPY --from=builder --chown=kincare:kincare /repo/apps/worker/package.json ./package.json

USER kincare
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
