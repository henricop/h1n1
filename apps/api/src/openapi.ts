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

// ---------------------------------------------------------------------------------------------------------
// Visualização e análise (CONTRATO_API.md §3.13)
// ---------------------------------------------------------------------------------------------------------

const PERIOD_PATTERN = { pattern: '^\\d{4}(-(W\\d{2}|M\\d{2}))?$' } as const;
const INDICATOR_PARAM = str('Id do indicador (obrigatório)', { ...TEXT, maxLength: 64 });
const GEO_CODE_PARAM = str('Código geográfico (BRA, BR-SP...)', { ...TEXT, maxLength: 16 });

/** meta compacta das rotas de visualização/análise */
export const VIZ_META = {
  type: 'object',
  description: 'Metadados obrigatórios: exiba universe_note e data_as_of junto a qualquer número.',
  properties: {
    data_as_of: { type: 'string', nullable: true },
    universe_note: { type: 'string' },
    license: { type: 'string', nullable: true },
    source_id: { type: 'string' },
    case_definition: { type: 'string' },
    caveats: { type: 'array', items: { type: 'string' } },
    truncated: {
      type: 'boolean',
      description:
        'true quando a leitura atingiu o limite de linhas (resultado possivelmente incompleto; refine from/to). ' +
        'Só globo e mapa chegam a responder 200 com truncated=true; as rotas de análise respondem 400 too_many_rows.',
    },
  },
} as const;

const INDICATOR_REF = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } as const;
const NULLABLE_NUMBERS = { type: 'array', items: { type: 'number', nullable: true } } as const;
const BOOLEANS = { type: 'array', items: { type: 'boolean' } } as const;

export const GLOBE_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: str('Id de um indicador flunet_* de contagem (measurement=count) com nível country (400 caso contrário), ex. flunet_ah1n1pdm09_detections', { ...TEXT, maxLength: 64 }),
    from: str(`Período inicial, inclusive. ${PERIOD_DOC}`, PERIOD_PATTERN),
    to: str(`Período final, inclusive. ${PERIOD_DOC}`, PERIOD_PATTERN),
    origin: str('Estrato origin_source do FluNet; all = total (padrão)', { enum: ['all', 'SENTINEL', 'NONSENTINEL', 'NOTDEFINED'] }),
  },
};

export const GLOBE_RESPONSE = {
  type: 'object',
  description: 'Matriz país × semana para o globo. Só países com centroide conhecido e com ao menos um valor.',
  properties: {
    indicator: INDICATOR_REF,
    meta: VIZ_META,
    weeks: { type: 'array', items: { type: 'string' } },
    countries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          iso3: { type: 'string' }, name: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' },
          who_region: { type: 'string', nullable: true }, values: NULLABLE_NUMBERS,
        },
      },
    },
  },
};

export const MAP_BRAZIL_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: str('Id de um indicador com geo_levels contendo state (400 caso contrário)', { ...TEXT, maxLength: 64 }),
    from: str(`Período inicial, inclusive. ${PERIOD_DOC}`, PERIOD_PATTERN),
    to: str(`Período final, inclusive. ${PERIOD_DOC}`, PERIOD_PATTERN),
  },
};

export const MAP_BRAZIL_RESPONSE = {
  type: 'object',
  description: 'Matriz UF × semana com supressão aplicada (value null + suppressed true) e total nacional.',
  properties: {
    indicator: INDICATOR_REF,
    meta: VIZ_META,
    weeks: { type: 'array', items: { type: 'string' } },
    states: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' }, uf: { type: 'string' }, name: { type: 'string' }, ibge: { type: 'string' },
          values: NULLABLE_NUMBERS, suppressed: BOOLEANS,
        },
      },
    },
    national: { type: 'object', properties: { values: NULLABLE_NUMBERS, provisional: BOOLEANS } },
  },
};

export const EARS_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: INDICATOR_PARAM,
    geo_level: str('state (todas as UFs quando geo_code ausente) ou country; padrão inferido de geo_code, senão country', { enum: ['state', 'country'] }),
    geo_code: GEO_CODE_PARAM,
    weeks: { type: 'integer', minimum: 1, maximum: 52, default: 12, description: 'Semanas mais recentes avaliadas por geo' },
    baseline: { type: 'integer', minimum: 2, maximum: 52, default: 8, description: 'Semanas da baseline' },
    guard: { type: 'integer', minimum: 0, maximum: 8, default: 2, description: 'Semanas de guarda (C2/C3)' },
  },
};

export const EARS_RESPONSE = {
  type: 'object',
  description: 'Sinal estatístico (CDC EARS C1/C2/C3), não surto confirmado. Células suprimidas entram como null.',
  properties: {
    indicator: INDICATOR_REF,
    meta: VIZ_META,
    method: {
      type: 'object',
      properties: {
        name: { type: 'string' }, baseline: { type: 'integer' }, guard: { type: 'integer' },
        thresholds: { type: 'object', properties: { c1: { type: 'number' }, c2: { type: 'number' }, c3: { type: 'number' } } },
        note: { type: 'string' },
      },
    },
    results: {
      type: 'array',
      description: 'Ordenado por c2 desc (null por último)',
      items: {
        type: 'object',
        properties: {
          geo_code: { type: 'string' }, name: { type: 'string' }, period: { type: 'string' },
          value: { type: 'number', nullable: true }, provisional: { type: 'boolean' },
          c1: { type: 'number', nullable: true }, c2: { type: 'number', nullable: true }, c3: { type: 'number', nullable: true },
          flags: { type: 'array', items: { type: 'string', enum: ['C1', 'C2', 'C3'] } },
        },
      },
    },
  },
};

export const NOWCAST_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: str(
      'Só indicadores cuja população coincide com a da CDF de atraso (SRAG por influenza, CLASSI_FIN = 1): ' +
      'sivep_srag_influenza_confirmed, sivep_srag_ah1n1pdm09_confirmed, sivep_srag_ah3n2_confirmed, ' +
      'sivep_srag_inf_a_not_subtyped, sivep_srag_influenza_icu, sivep_srag_influenza_deaths, sivep_srag_ah1n1pdm09_deaths. ' +
      'Outros → 400 nowcast_not_applicable.',
      { ...TEXT, maxLength: 64 },
    ),
    geo_code: str('BRA (padrão) ou BR-UF', { ...TEXT, maxLength: 16 }),
    weeks: { type: 'integer', minimum: 1, maximum: 13, default: 8, description: 'Semanas mais recentes estimadas' },
  },
};

export const NOWCAST_RESPONSE = {
  type: 'object',
  description: 'Estimativa (não contagem) do total final das últimas semanas a partir da CDF empírica de atraso.',
  properties: {
    indicator: INDICATOR_REF,
    meta: VIZ_META,
    delay: {
      type: 'object',
      properties: {
        period: { type: 'string' }, n: { type: 'integer', nullable: true },
        cdf: { type: 'array', items: { type: 'number' }, minItems: 13, maxItems: 13 },
        source_indicator: { type: 'string' },
      },
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          period: { type: 'string' }, weeks_ago: { type: 'integer' }, observed: { type: 'number', nullable: true },
          reported_share: { type: 'number', nullable: true }, estimated: { type: 'number', nullable: true },
          lower: { type: 'number', nullable: true }, upper: { type: 'number', nullable: true },
        },
      },
    },
    note: { type: 'string' },
  },
};

export const SEASONS_QUERY = {
  type: 'object',
  required: ['indicator'],
  properties: {
    indicator: INDICATOR_PARAM,
    geo_code: str('Código geográfico (padrão BRA)', { ...TEXT, maxLength: 16 }),
    from_year: { type: 'integer', minimum: 1990, maximum: 2100, description: 'Primeiro ano incluído (ano civil da semana)' },
    group: str(
      'calendar (padrão): uma linha por ano, semanas 1..53. season: uma linha por temporada, da SE 27 à SE 26 do ano ' +
      'seguinte (weeks = 27..53,1..26), rótulo 2025/26 e year = ano inicial',
      { enum: ['calendar', 'season'] },
    ),
  },
};

export const SEASONS_RESPONSE = {
  type: 'object',
  properties: {
    indicator: INDICATOR_REF,
    meta: VIZ_META,
    geo_code: { type: 'string' },
    group: { type: 'string', enum: ['calendar', 'season'] },
    weeks: { type: 'array', items: { type: 'integer' }, description: '53 posições: 1..53 (calendar) ou 27..53,1..26 (season)' },
    seasons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          year: { type: 'integer', description: 'ano civil ou ano inicial da temporada' },
          label: { type: 'string', description: '2025 (calendar) ou 2025/26 (season)' },
          values: NULLABLE_NUMBERS,
        },
      },
    },
  },
};

export const RUNS_QUERY = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
    source_id: str('Filtra execuções de uma fonte (ex. BR-03)', { ...TEXT, maxLength: 32 }),
  },
};

export const RUNS_RESPONSE = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' }, connector: { type: 'string' }, source_id: { type: 'string' },
          started_at: { type: 'string' }, finished_at: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['running', 'ok', 'failed', 'quarantined'] },
          rows_in: { type: 'integer' }, rows_out: { type: 'integer' },
          error: { type: 'string', nullable: true, maxLength: 200, description: 'Truncado a 200 caracteres; URLs → [url], credenciais → [redigido], caminhos de disco → [caminho]' },
        },
      },
    },
  },
};

export const LATEST_QUERY = {
  type: 'object',
  properties: { geo_code: str('Código geográfico (padrão BRA); o nível inferido precisa constar em geo_levels do indicador (400 caso contrário)', { ...TEXT, maxLength: 16 }) },
};

export const LATEST_RESPONSE = {
  type: 'object',
  description: 'Último período publicado com valor (não suprimido) e variação vs as 4 semanas anteriores.',
  properties: {
    indicator: INDICATOR_REF,
    meta: VIZ_META,
    geo_code: { type: 'string' },
    latest: {
      type: 'object', nullable: true,
      properties: {
        period: { type: 'string' }, period_start: { type: 'string' }, period_end: { type: 'string' },
        value: { type: 'number' }, provisional: { type: 'boolean' }, update_status: { type: 'string' },
      },
    },
    trend: {
      type: 'object',
      properties: {
        k: { type: 'integer' },
        change_pct: { type: 'number', nullable: true, description: 'Variação % entre a média das últimas k semanas e das k anteriores' },
        recent_mean: { type: 'number', nullable: true },
        previous_mean: { type: 'number', nullable: true },
      },
    },
  },
};
