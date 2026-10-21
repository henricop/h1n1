import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // PGlite em memória + seed + migrações por arquivo de teste: sob carga (ingestão em paralelo) passa de 10 s
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
