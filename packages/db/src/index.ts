import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __kincarePrisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __kincarePrismaRead: PrismaClient | undefined;
}

/**
 * Primary (read+write) Prisma client.
 *
 * In production, point `DATABASE_URL` at PgBouncer in **transaction** pool
 * mode with `?pgbouncer=true&connection_limit=1` so Prisma disables prepared
 * statements (PgBouncer transaction pooling can't share them across sessions).
 * Use `DIRECT_DATABASE_URL` for `prisma migrate` / `prisma db push` to bypass
 * the pooler — those commands need session-mode features.
 */
export const prisma: PrismaClient =
  globalThis.__kincarePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

/**
 * Optional read replica. When `DATABASE_REPLICA_URL` is set, this is a second
 * Prisma client routed at the replica (still through PgBouncer). Falls back
 * to the primary so call sites don't need to branch.
 *
 * Use for: large list/search endpoints, analytics, audit-tail scans.
 * Do **not** use inside the same logical transaction as a write — replicas
 * are eventually consistent.
 */
export const prismaRead: PrismaClient =
  globalThis.__kincarePrismaRead ??
  (process.env.DATABASE_REPLICA_URL
    ? new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_REPLICA_URL } },
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      })
    : prisma);

if (process.env.NODE_ENV !== 'production') {
  globalThis.__kincarePrisma = prisma;
  globalThis.__kincarePrismaRead = prismaRead;
}

export * from '@prisma/client';
