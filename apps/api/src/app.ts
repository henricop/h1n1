import Fastify, { type FastifyInstance, type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Db } from '@h1n1/db';
import { ApiError, errorBody } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { sourcesRoutes } from './routes/sources.js';
import { indicatorsRoutes } from './routes/indicators.js';
import { seriesRoutes } from './routes/series.js';
import { freshnessRoutes } from './routes/freshness.js';
import { snapshotsRoutes } from './routes/snapshots.js';
import { geoRoutes } from './routes/geo.js';

export const API_VERSION = '0.1.0';
export const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600';

const DESCRIPTION = `API pública do H1N1 — portal público de referência e observatório de influenza A(H1N1).

Todos os números servidos aqui vêm de **snapshots versionados** (sha256, url, data de captura e licença) de fontes oficiais
(SIVEP-Gripe, OMS FluNet, IBGE, etc.) e só são expostos depois de publicados como vigentes para o indicador
(\`indicator_publications.status = 'current'\`). A API nunca calcula nem inventa valores: sem publicação vigente,
\`/v1/series\` devolve \`observations: []\` e \`meta.data_as_of: null\`.

Regras de integridade que o consumidor deve respeitar:
- **\`meta.universe_note\` deve ser exibido junto a qualquer número** (o que a contagem representa e o que ela não representa:
  H1N1 confirmado ≠ influenza A não subtipada ≠ SRAG ≠ síndrome gripal).
- \`meta.case_definition\`, \`meta.data_as_of\`, \`meta.license\` e \`meta.caveats\` acompanham toda série.
- Células pequenas em recortes subnacionais/estratificados saem com \`value: null\` e \`suppressed: true\`; o valor bruto nunca é exposto.
- Fontes do mesmo \`mirror_group\` reapresentam os mesmos dados e nunca devem ser somadas.
- Nada aqui é "tempo real": use \`data_as_of\` e \`/v1/freshness\`.`;

export interface BuildAppOptions {
  db: Db;
  /** desligue em testes (default: true) */
  rateLimit?: boolean;
  /** logger do Fastify (default: false) */
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { db } = opts;
  const app = Fastify({
    logger: opts.logger ?? false,
    routerOptions: { ignoreTrailingSlash: true },
  });

  // Validação é feita com zod nas rotas; os JSON Schemas servem só para a documentação OpenAPI.
  app.setValidatorCompiler(() => () => true);
  // Serialização integral (sem fast-json-stringify podando campos).
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'H1N1 API', version: API_VERSION, description: DESCRIPTION },
      tags: [
        { name: 'séries', description: 'Séries temporais publicadas' },
        { name: 'indicadores', description: 'Ontologia de indicadores' },
        { name: 'fontes', description: 'Catálogo de fontes oficiais' },
        { name: 'snapshots', description: 'Snapshots imutáveis e diffs' },
        { name: 'geo', description: 'Unidades geográficas' },
        { name: 'infra', description: 'Saúde e frescor' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(cors, { origin: true, methods: ['GET', 'HEAD', 'OPTIONS'] });

  if (opts.rateLimit !== false) {
    await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  }

  app.addHook('onSend', async (req, reply) => {
    if (req.method === 'GET' && req.url.startsWith('/v1/') && reply.statusCode === 200) {
      reply.header('Cache-Control', CACHE_CONTROL);
    }
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send(errorBody('not_found', `Rota não encontrada: ${req.method} ${req.url}`));
  });

  app.setErrorHandler((err: FastifyError | ApiError, req, reply) => {
    if (err instanceof ApiError) {
      reply.code(err.statusCode).send(errorBody(err.code, err.message));
      return;
    }
    const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (status === 429) {
      reply.code(429).send(errorBody('rate_limited', 'Limite de 120 requisições por minuto excedido; tente novamente em instantes.'));
      return;
    }
    if (status === 400 || status === 415 || status === 413) {
      reply.code(status).send(errorBody('validation_error', err.message));
      return;
    }
    if (status === 404) {
      reply.code(404).send(errorBody('not_found', err.message));
      return;
    }
    req.log.error({ err, url: req.url }, 'erro interno');
    reply.code(status >= 500 ? status : 500).send(errorBody('internal_error', 'Erro interno ao processar a requisição.'));
  });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  await app.register(healthRoutes, { db });
  await app.register(sourcesRoutes, { db });
  await app.register(indicatorsRoutes, { db });
  await app.register(seriesRoutes, { db });
  await app.register(freshnessRoutes, { db });
  await app.register(snapshotsRoutes, { db });
  await app.register(geoRoutes, { db });

  return app;
}
