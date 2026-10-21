import { createDb, migrate } from './client.js';
import { seedAll } from './seed.js';

const cmd = process.argv[2];
const db = await createDb();
try {
  if (cmd === 'migrate') {
    const done = await migrate(db);
    console.log(`migrações aplicadas: ${done.length ? done.join(', ') : 'nenhuma nova'} (${db.kind})`);
  } else if (cmd === 'seed') {
    await migrate(db);
    const r = await seedAll(db);
    console.log(`seed: ${r.sources} fontes, ${r.indicators} indicadores, ${r.geo} geografias (${db.kind})`);
  } else {
    console.error('uso: cli.ts <migrate|seed>');
    process.exitCode = 1;
  }
} finally {
  await db.close();
}
