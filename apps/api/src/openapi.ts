/**
 * Fragmentos de JSON Schema usados só para documentação OpenAPI.
 * A validação real é feita com zod (src/schemas.ts); a serialização usa JSON.stringify.
 */
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });

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
    country: str('Código de país do catálogo (ex. BR, US, INT)'),
    access_type: str('Tipo de acesso', { enum: ['api', 'open_data', 'portal'] }),
  },
};

export const INDICATORS_QUERY = {
  type: 'object',
  properties: { source_id: str('Filtra indicadores de uma fonte (ex. BR-03)') },
};

export const SERIES_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: str('Id do indicador (obrigatório), ex. sivep_srag_ah1n1pdm09_confirmed'),
    geo_level: str('Nível geográfico', { enum: ['world', 'country', 'region', 'state'] }),
    geo_code: str('Código geográfico (BRA, BR-SP, WLD...)'),
    from: str('Período inicial, inclusive (ex. 2025-W01)'),
    to: str('Período final, inclusive (ex. 2026-W52)'),
    include_strata: str('Inclui estratos além do total', { enum: ['true', 'false'] }),
    limit: { type: 'integer', minimum: 1, maximum: 100000, default: 20000, description: 'Máximo de observações' },
    'stratum.age_group': str('Exemplo de filtro de estrato: stratum.<dimensão>=<valor> (ex. stratum.age_group=0-4)'),
  },
};

export const SNAPSHOTS_QUERY = {
  type: 'object',
  properties: {
    source_id: str('Filtra snapshots de uma fonte'),
    limit: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
  },
};

export const DIFF_QUERY = {
  type: 'object',
  required: ['indicator', 'a', 'b'],
  properties: {
    indicator: str('Id do indicador'),
    a: str('Id (UUID) da snapshot A'),
    b: str('Id (UUID) da snapshot B'),
    limit: { type: 'integer', minimum: 1, maximum: 100000, default: 5000 },
  },
};

export const GEO_QUERY = {
  type: 'object',
  properties: { level: str('Nível geográfico', { enum: ['world', 'country', 'region', 'state'] }) },
};

export const SERIES_RESPONSE = {
  type: 'object',
  description:
    'Série publicada. Todos os valores vêm da snapshot vigente; células suprimidas saem com value=null e suppressed=true. ' +
    'meta.universe_note DEVE ser exibido junto a qualquer número.',
  properties: {
    indicator: ANY_OBJECT,
    source: ANY_OBJECT,
    publication: { ...ANY_OBJECT, nullable: true },
    snapshot: { ...ANY_OBJECT, nullable: true },
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
      },
    },
  },
};
