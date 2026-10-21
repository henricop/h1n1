import Fastify, { type FastifyInstance, type FastifyError, type FastifyServerOptions, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createHash } from 'node:crypto';
import type { Db } from '@h1n1/db';
import { ApiError, errorBody } from './errors.js';
import { TEXT_MAX } from './schemas.js';
import { healthRoutes } from './routes/health.js';
import { sourcesRoutes } from './routes/sources.js';
import { indicatorsRoutes } from './routes/indicators.js';
import { seriesRoutes } from './routes/series.js';
import { freshnessRoutes } from './routes/freshness.js';
import { snapshotsRoutes } from './routes/snapshots.js';
import { geoRoutes } from './routes/geo.js';

export const API_VERSION = '0.1.0';

/** Políticas de cache por rota (CONTRATO_API.md §4). Cada rota declara a sua em `config.cache`. */
export const CACHE = {
  none: 'no-store',
  catalog: 'public, max-age=3600, stale-while-revalidate=86400',
  series: 'public, max-age=300, stale-while-revalidate=3600',
  freshness: 'public, max-age=60',
  snapshots: 'public, max-age=300',
} as const;
export type CachePolicy = keyof typeof CACHE;
/** @deprecated use CACHE.series — mantido para compatibilidade de import */
export const CACHE_CONTROL = CACHE.series;

export const RATE_LIMIT_DEFAULT = 120;
export const CSV_RATE_LIMIT_DEFAULT = 20;

declare module 'fastify' {
  interface FastifyContextConfig {
    /** política de Cache-Control aplicada em respostas 200 */
    cache?: CachePolicy;
    /** calcula ETag (hash do corpo) e honra If-None-Match → 304 */
    etag?: boolean;
  }
}

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
  A supressão complementar é calculada sobre o grupo completo (total + todos os estratos) mesmo quando só um estrato é pedido.
- \`/v1/diff\` só compara células nacionais sem estrato (\`geo_level = country\`, \`stratum_key = ''\`) de snapshots com \`status = ok\`.
- Fontes do mesmo \`mirror_group\` reapresentam os mesmos dados e nunca devem ser somadas.
- Nada aqui é "tempo real": use \`data_as_of\` e \`/v1/freshness\`.`;

export interface BuildAppOptions {
  db: Db;
  /** desligue em testes (default: true) */
  rateLimit?: boolean;
  /** limite global por IP por minuto (default: 120) */
  rateLimitMax?: number;
  /** limite por IP por minuto em /v1/series.csv (default: 20; 0 desliga o limite específico) */
  csvRateLimitMax?: number;
  /** logger do Fastify (default: false) */
  logger?: boolean;
  /** confiança em X-Forwarded-* (default: false). Aceita boolean ou lista de IPs/CIDRs separados por vírgula. */
  trustProxy?: FastifyServerOptions['trustProxy'];
}

/** Interpreta TRUST_PROXY: vazio/false/0 → false; true/1 → true; outro → lista de IPs/CIDRs (ex. "10.0.0.0/8,127.0.0.1"). */
export function parseTrustProxy(raw: string | undefined): FastifyServerOptions['trustProxy'] {
  const v = (raw ?? '').trim();
  if (v === '' || v.toLowerCase() === 'false' || v === '0') return false;
  if (v.toLowerCase() === 'true' || v === '1') return true;
  return v;
}

/** ETag forte derivada do corpo serializado (sha256 truncado). */
export function etagOf(payload: string | Buffer): string {
  return `"${createHash('sha256').update(payload).digest('hex').slice(0, 32)}"`;
}

/** If-None-Match: lista separada por vírgula, com ou sem prefixo W/, ou `*`. */
export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const bare = etag.replace(/^W\//, '');
  return ifNoneMatch
    .split(',')
    .map((t) => t.trim())
    .some((t) => t === '*' || t.replace(/^W\//, '') === bare);
}

export async function buildApp(opts: BuildAppOptions): Promise<FastifyInstance> {
  const { db } = opts;
  const rateLimitMax = opts.rateLimitMax ?? RATE_LIMIT_DEFAULT;
  const csvRateLimitMax = opts.csvRateLimitMax ?? CSV_RATE_LIMIT_DEFAULT;

  /**
   * Mapeia qualquer erro para { error: { code, message } }. 400/413/415 → validation_error; 404 → not_found;
   * 429 → rate_limited; demais 4xx mantêm o status original com código client_error; 5xx → internal_error sem detalhes.
   */
  const sendError = (err: FastifyError | ApiError, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof ApiError) {
      reply.code(err.statusCode).send(errorBody(err.code, err.message));
      return;
    }
    const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (status === 429) {
      reply.code(429).send(errorBody('rate_limited', `Limite de ${rateLimitMax} requisições por minuto excedido; tente novamente em instantes.`));
      return;
    }
    if (status === 400 || status === 415 || status === 413) {
      const message = (err as FastifyError).code === 'FST_ERR_BAD_URL' ? 'URL inválida.' : err.message;
      reply.code(status).send(errorBody('validation_error', message));
      return;
    }
    if (status === 404) {
      reply.code(404).send(errorBody('not_found', 'Recurso não encontrado.'));
      return;
    }
    if (status >= 400 && status < 500) {
      // 4xx não mapeado: mantém o status original com código genérico; nunca ecoa a URL
      const message = (err as FastifyError).code === 'FST_ERR_MAX_PARAM_LENGTH'
        ? `Parâmetro de caminho excede o tamanho máximo (${TEXT_MAX} caracteres).`
        : err.message || 'Requisição inválida.';
      reply.code(status).send(errorBody('client_error', message));
      return;
    }
    req.log.error({ err, url: req.url }, 'erro interno');
    reply.code(status >= 500 ? status : 500).send(errorBody('internal_error', 'Erro interno ao processar a requisição.'));
  };

  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: opts.trustProxy ?? false,
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: TEXT_MAX },
    // erros do roteador (URL inválida, parâmetro de caminho longo demais) também saem no formato padrão
    frameworkErrors: (err, req, reply) => sendError(err, req, reply),
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
    await app.register(rateLimit, {
      max: rateLimitMax,
      timeWindow: '1 minute',
      enableDraftSpec: true, // RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset
      errorResponseBuilder: (_req, ctx) =>
        new ApiError(
          ctx.statusCode,
          'rate_limited',
          `Limite de ${ctx.max} requisições por minuto excedido; tente novamente em ${ctx.after}.`,
        ),
    });
  }

  // Cache-Control por rota e ETag/304 nas séries (CONTRATO_API.md §4).
  app.addHook('onSend', async (req, reply, payload) => {
    const cfg = req.routeOptions?.config;
    const policy = cfg?.cache;
    if (!policy) return payload;
    if (policy === 'none') {
      reply.header('Cache-Control', CACHE.none);
      return payload;
    }
    if (reply.statusCode !== 200 || (req.method !== 'GET' && req.method !== 'HEAD')) return payload;
    reply.header('Cache-Control', CACHE[policy]);
    if (cfg?.etag && (typeof payload === 'string' || Buffer.isBuffer(payload))) {
      const etag = etagOf(payload);
      reply.header('ETag', etag);
      if (etagMatches(req.headers['if-none-match'], etag)) {
        reply.code(304);
        reply.removeHeader('content-length');
        return '';
      }
    }
    return payload;
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send(errorBody('not_found', 'Rota não encontrada.'));
  });

  app.setErrorHandler((err: FastifyError | ApiError, req, reply) => sendError(err, req, reply));

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  await app.register(healthRoutes, { db });
  await app.register(sourcesRoutes, { db });
  await app.register(indicatorsRoutes, { db });
  await app.register(seriesRoutes, { db, csvRateLimitMax });
  await app.register(freshnessRoutes, { db });
  await app.register(snapshotsRoutes, { db });
  await app.register(geoRoutes, { db });

  return app;
}
