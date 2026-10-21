import { createDb, migrate, seedAll } from '@h1n1/db';
import { buildApp } from './app.js';

async function main() {
  const db = await createDb();
  const applied = await migrate(db);
  const n = Number((await db.query<{ n: string }>('select count(*)::text as n from sources')).rows[0]?.n ?? 0);
  if (n === 0) {
    const seeded = await seedAll(db);
    console.log(`[api] seed: ${seeded.sources} fontes, ${seeded.indicators} indicadores, ${seeded.geo} geo`);
  }
  if (applied.length) console.log(`[api] migrações aplicadas: ${applied.join(', ')}`);

  const app = await buildApp({ db, rateLimit: process.env.API_RATE_LIMIT !== 'off', logger: true });
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
