/**
 * Fragmentos de JSON Schema usados só para documentação OpenAPI.
 * A validação real é feita com zod (src/schemas.ts); a serialização usa JSON.stringify.
 */
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });

/** Todo parâmetro textual: até 200 caracteres, sem caracteres de controle (400 caso contrário). */
const TEXT = { maxLength: 200, pattern: '^[^\\u0000-\\u001F\\u007F-\\u009F]*$' } as const;

export const ERROR_RESPONSE = {
  type: 'object',
  description: 'Erro padronizado',
  properties: {
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
} as const;

export const ANY_OBJECT = { type: 'object', additionalProperties: true } as const;

export const errorResponses = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [String(c), ERROR_RESPONSE]));

export const SOURCES_QUERY = {
  type: 'object',
  properties: {
    priority: str('Prioridade do catálogo', { enum: ['P0', 'P1', 'P2'] }),
    country: str('Código de país do catálogo (ex. BR, US, INT)', { ...TEXT, maxLength: 8 }),
    access_type: str('Tipo de acesso', { enum: ['api', 'open_data', 'portal'] }),
  },
};

export const INDICATORS_QUERY = {
  type: 'object',
  properties: { source_id: str('Filtra indicadores de uma fonte (ex. BR-03)', { ...TEXT, maxLength: 32 }) },
};

const PERIOD_DOC =
  'Formatos: AAAA, AAAA-Www ou AAAA-Mnn (ex. 2025-W01). AAAA é expandido conforme o period_type do indicador: ' +
  'em from para o primeiro período do ano (AAAA-W01 / AAAA-M01 / AAAA) e em to para o último (AAAA-W53 / AAAA-M12 / AAAA). ' +
  'from > to responde 400.';

export const SERIES_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: str('Id do indicador (obrigatório), ex. sivep_srag_ah1n1pdm09_confirmed', { ...TEXT, maxLength: 64 }),
    geo_level: str('Nível geográfico', { enum: ['world', 'country', 'region', 'state'] }),
    geo_code: str('Código geográfico (BRA, BR-SP, WLD...)', { ...TEXT, maxLength: 16 }),
    from: str(`Período inicial, inclusive. ${PERIOD_DOC}`, { pattern: '^\\d{4}(-(W\\d{2}|M\\d{2}))?$' }),
    to: str(`Período final, inclusive. ${PERIOD_DOC}`, { pattern: '^\\d{4}(-(W\\d{2}|M\\d{2}))?$' }),
    include_strata: str('Inclui estratos além do total', { enum: ['true', 'false'] }),
    limit: {
      type: 'integer', minimum: 1, maximum: 100000, default: 20000,
      description: 'Máximo de observações; meta.truncated=true (JSON) ou X-Truncated: true (CSV) quando atingido',
    },
    'stratum.age_group': str(
      'Exemplo de filtro de estrato: stratum.<dimensão>=<valor> (ex. stratum.age_group=0-4). ' +
      "<dimensão> em ^[a-z][a-z0-9_]{0,31}$; <valor> 1–64 caracteres, sem ';' nem '=' e sem caracteres de controle. " +
      'A supressão complementar é calculada sobre o grupo completo (total + todos os estratos) antes de filtrar.',
      { ...TEXT, maxLength: 64 },
    ),
  },
};

export const SNAPSHOTS_QUERY = {
  type: 'object',
  properties: {
    source_id: str('Filtra snapshots de uma fonte', { ...TEXT, maxLength: 32 }),
    limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
  },
};

export const DIFF_QUERY = {
  type: 'object',
  required: ['indicator', 'a', 'b'],
  description:
    "Restrição desta versão: só snapshots com status = 'ok' da fonte do indicador; o resultado contém apenas " +
    "células com geo_level = 'country' e stratum_key = '' (total nacional).",
  properties: {
    indicator: str('Id do indicador', { ...TEXT, maxLength: 64 }),
    a: str("Id (UUID) da snapshot A; deve ter status 'ok' (400 caso contrário, 404 se não existir)", { format: 'uuid' }),
    b: str("Id (UUID) da snapshot B; deve ter status 'ok' (400 caso contrário, 404 se não existir)", { format: 'uuid' }),
    limit: { type: 'integer', minimum: 1, maximum: 100000, default: 5000 },
  },
};

export const GEO_QUERY = {
  type: 'object',
  properties: { level: str('Nível geográfico', { enum: ['world', 'country', 'region', 'state'] }) },
};

/** Snapshot pública: sem storage_path (caminho interno de armazenamento nunca é exposto). */
export const SNAPSHOT_SCHEMA = {
  type: 'object',
  description: 'Snapshot imutável de uma fonte. storage_path (caminho interno) nunca é exposto.',
  properties: {
    id: { type: 'string', format: 'uuid' },
    source_id: { type: 'string' },
    url: { type: 'string' },
    fetched_at: { type: 'string' },
    sha256: { type: 'string' },
    bytes: { type: 'integer', nullable: true },
    content_type: { type: 'string', nullable: true },
    license: { type: 'string', nullable: true },
    data_as_of: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['ok', 'failed', 'quarantined'] },
    notes: { type: 'string', nullable: true },
  },
} as const;

export const SERIES_RESPONSE = {
  type: 'object',
  description:
    'Série publicada. Todos os valores vêm da snapshot vigente; células suprimidas saem com value=null e suppressed=true. ' +
    'meta.universe_note DEVE ser exibido junto a qualquer número.',
  properties: {
    indicator: ANY_OBJECT,
    source: ANY_OBJECT,
    publication: { ...ANY_OBJECT, nullable: true },
    snapshot: { ...SNAPSHOT_SCHEMA, nullable: true },
    observations: { type: 'array', items: ANY_OBJECT },
    meta: {
      type: 'object',
      properties: {
        data_as_of: { type: 'string', nullable: true },
        fetched_at: { type: 'string', nullable: true },
        universe_note: { type: 'string' },
        case_definition: { type: 'string' },
        license: { type: 'string', nullable: true },
        suppression_threshold: { type: 'integer' },
        caveats: { type: 'array', items: { type: 'string' } },
        count: { type: 'integer' },
        truncated: { type: 'boolean', description: 'true quando o número de observações atingiu limit; refine a consulta' },
      },
    },
  },
};
