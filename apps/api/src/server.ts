import { createDb, migrate, seedAll } from '@h1n1/db';
import { buildApp, parseTrustProxy } from './app.js';

async function main() {
  const db = await createDb();
  const applied = await migrate(db);
  const n = Number((await db.query<{ n: string }>('select count(*)::text as n from sources')).rows[0]?.n ?? 0);
  if (n === 0) {
    const seeded = await seedAll(db);
    console.log(`[api] seed: ${seeded.sources} fontes, ${seeded.indicators} indicadores, ${seeded.geo} geo`);
  }
  if (applied.length) console.log(`[api] migrações aplicadas: ${applied.join(', ')}`);

  const intEnv = (name: string): number | undefined => {
    const v = process.env[name];
    return v !== undefined && /^\d+$/.test(v) ? Number(v) : undefined;
  };
  const rateLimitMax = intEnv('API_RATE_LIMIT_MAX');
  const csvRateLimitMax = intEnv('API_CSV_RATE_LIMIT_MAX');
  const app = await buildApp({
    db,
    rateLimit: process.env.API_RATE_LIMIT !== 'off',
    ...(rateLimitMax !== undefined ? { rateLimitMax } : {}),
    ...(csvRateLimitMax !== undefined ? { csvRateLimitMax } : {}),
    logger: true,
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  });
  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'encerrando');
    await app.close();
    await db.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port, host });
  app.log.info(`H1N1 API (${db.kind}) em http://${host}:${port} — docs em /docs`);
}

main().catch((err) => {
  console.error('[api] falha ao iniciar:', err);
  process.exit(1);
});
