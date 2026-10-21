import type { IndicatorDefinition } from './types.js';

const FLUNET_UNIVERSE =
  'Os números representam detecções de influenza em amostras processadas por laboratórios que reportam à OMS (FluNet), não todos os casos de H1N1 da população.';
const SIVEP_UNIVERSE =
  'Os números representam notificações de síndrome respiratória aguda grave (SRAG) hospitalizada registradas no SIVEP-Gripe e classificadas segundo o dicionário de dados, não todos os casos de H1N1 da população.';

const FLUNET_BASE = {
  source_id: 'INT-01',
  measurement: 'count',
  unit: 'detections',
  universe_note: FLUNET_UNIVERSE,
  methodology_version: 'flunet-v1',
  geo_levels: ['country'],
  period_type: 'isoweek',
  event_date_basis: 'specimen_processing',
  stratum_schema: { origin_source: ['SENTINEL', 'NONSENTINEL', 'NOTDEFINED'] },
  mirror_group: 'who_flu',
  suppression_threshold: 0,
  denominator_indicator_id: null,
  min_denominator: null,
} as const satisfies Partial<IndicatorDefinition>;

const SIVEP_BASE = {
  source_id: 'BR-03',
  measurement: 'count',
  unit: 'notifications',
  universe_note: SIVEP_UNIVERSE,
  methodology_version: 'sivep-v1',
  geo_levels: ['country', 'state'],
  period_type: 'epiweek',
  event_date_basis: 'symptom_onset',
  stratum_schema: { age_group: ['0-4', '5-14', '15-29', '30-49', '50-64', '65+', 'NA'] },
  mirror_group: 'br_srag',
  suppression_threshold: 5,
  denominator_indicator_id: null,
  min_denominator: null,
} as const satisfies Partial<IndicatorDefinition>;

const SIVEP_CAVEATS = [
  'Semanas recentes estão sujeitas a atraso de notificação e digitação; os valores são provisórios e tendem a subir em revisões.',
  'A base contém apenas SRAG hospitalizada ou óbito por SRAG; não mede infecções leves.',
  'A UF é a de residência do paciente (SG_UF); a semana é a dos primeiros sintomas (SEM_PRI).',
  'Registros com UF ignorada ou residência fora do Brasil ficam fora dos recortes por estado.',
];

const FLUNET_CAVEATS = [
  'Detecção laboratorial não é incidência populacional; depende de quantas amostras foram processadas.',
  'A semana é a de processamento da amostra, que pode diferir da semana da coleta.',
  'Sentinela e não sentinela têm universos diferentes e não devem ser comparados como se fossem a mesma rede.',
];

/**
 * Ontologia de indicadores do H1N1. Validada em 2026-10-20 contra o dicionário SIVEP 2019-2025
 * e os metadados VIW_FLU_METADATA do FluNet.
 */
export const INDICATORS: readonly IndicatorDefinition[] = [
  // ---------- FluNet (OMS / GISRS) ----------
  {
    ...FLUNET_BASE,
    id: 'flunet_specimens_processed',
    name: 'Amostras processadas para influenza (FluNet)',
    description: 'Número de amostras processadas para influenza por qualquer método (SPEC_PROCESSED_NB).',
    case_definition: 'SPEC_PROCESSED_NB por país e semana ISO, com estrato por ORIGIN_SOURCE.',
    unit: 'specimens',
    caveats: FLUNET_CAVEATS,
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_ah1n1pdm09_detections',
    name: 'Detecções de A(H1N1)pdm09 (FluNet)',
    description: 'Número de detecções de influenza A(H1N1)pdm09 (AH1N12009).',
    case_definition: 'AH1N12009 por país e semana ISO.',
    caveats: FLUNET_CAVEATS,
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_ah3_detections',
    name: 'Detecções de A(H3) (FluNet)',
    description: 'Número de detecções de influenza A(H3) (AH3).',
    case_definition: 'AH3 por país e semana ISO.',
    caveats: FLUNET_CAVEATS,
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_inf_a_detections',
    name: 'Detecções de influenza A, todos os subtipos (FluNet)',
    description: 'Número de detecções de influenza A, todos os subtipos (INF_A).',
    case_definition: 'INF_A por país e semana ISO.',
    caveats: FLUNET_CAVEATS,
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_inf_a_not_subtyped',
    name: 'Influenza A não subtipada (FluNet)',
    description: 'Detecções de influenza A não subtipadas, isto é, sem teste de subtipo (ANOTSUBTYPED). Não é H1N1.',
    case_definition: 'ANOTSUBTYPED por país e semana ISO.',
    caveats: [...FLUNET_CAVEATS, 'Não subtipada significa que o subtipo não foi testado; não deve ser contada como H1N1.'],
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_inf_a_not_subtypable',
    name: 'Influenza A não subtipável (FluNet)',
    description: 'Detecções de influenza A testadas sem resultado de subtipo (ANOTSUBTYPABLE). Não é H1N1.',
    case_definition: 'ANOTSUBTYPABLE por país e semana ISO.',
    caveats: [...FLUNET_CAVEATS, 'Não subtipável significa testada sem resultado; não deve ser contada como H1N1.'],
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_inf_b_detections',
    name: 'Detecções de influenza B (FluNet)',
    description: 'Número de detecções de influenza B (INF_B).',
    case_definition: 'INF_B por país e semana ISO.',
    caveats: FLUNET_CAVEATS,
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_inf_all_detections',
    name: 'Detecções de influenza, A e B (FluNet)',
    description: 'Número total de detecções de influenza (INF_ALL).',
    case_definition: 'INF_ALL por país e semana ISO.',
    caveats: FLUNET_CAVEATS,
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_ah1n1pdm09_share_of_inf_a',
    name: 'Participação de A(H1N1)pdm09 entre influenza A (FluNet)',
    description: 'AH1N12009 dividido por INF_A, em percentual. Publicado apenas quando INF_A >= 20.',
    case_definition: '100 × AH1N12009 / INF_A por país e semana ISO.',
    measurement: 'percent',
    unit: 'percent',
    denominator_indicator_id: 'flunet_inf_a_detections',
    min_denominator: 20,
    caveats: [
      ...FLUNET_CAVEATS,
      'Depende da estratégia de subtipagem; semanas com poucas detecções de influenza A são suprimidas.',
    ],
  },
  {
    ...FLUNET_BASE,
    id: 'flunet_influenza_positivity',
    name: 'Positividade para influenza (FluNet)',
    description: 'INF_ALL dividido por SPEC_PROCESSED_NB, em percentual. Publicado apenas quando SPEC_PROCESSED_NB >= 20.',
    case_definition: '100 × INF_ALL / SPEC_PROCESSED_NB por país e semana ISO.',
    measurement: 'percent',
    unit: 'percent',
    denominator_indicator_id: 'flunet_specimens_processed',
    min_denominator: 20,
    caveats: [...FLUNET_CAVEATS, 'Positividade depende de quem é testado; não é prevalência na população.'],
  },

  // ---------- SIVEP-Gripe (Ministério da Saúde / DATASUS) ----------
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_notifications',
    name: 'Notificações de SRAG hospitalizada (SIVEP-Gripe)',
    description: 'Todas as notificações de SRAG hospitalizada ou óbito por SRAG, independentemente do agente.',
    case_definition: 'Registros do arquivo INFLUD por SG_UF (residência) e SEM_PRI (semana dos primeiros sintomas).',
    caveats: SIVEP_CAVEATS,
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_influenza_confirmed',
    name: 'SRAG por influenza (SIVEP-Gripe)',
    description: 'SRAG com classificação final "SRAG por influenza" (CLASSI_FIN = 1), qualquer tipo ou subtipo.',
    case_definition: 'CLASSI_FIN = 1.',
    caveats: [...SIVEP_CAVEATS, 'Inclui influenza A e B, subtipadas ou não; não é exclusivo de H1N1.'],
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_ah1n1pdm09_confirmed',
    name: 'SRAG por influenza A(H1N1)pdm09 confirmada por RT-PCR (SIVEP-Gripe)',
    description:
      'SRAG classificada como influenza (CLASSI_FIN = 1) com subtipo A(H1N1)pdm09 por RT-PCR (PCR_FLUASU = 1).',
    case_definition: 'CLASSI_FIN = 1 AND PCR_FLUASU = 1.',
    caveats: [
      ...SIVEP_CAVEATS,
      'Depende de coleta e subtipagem por RT-PCR; casos de influenza A sem subtipo não entram aqui.',
    ],
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_ah3n2_confirmed',
    name: 'SRAG por influenza A(H3N2) confirmada por RT-PCR (SIVEP-Gripe)',
    description: 'SRAG classificada como influenza (CLASSI_FIN = 1) com subtipo A(H3N2) por RT-PCR (PCR_FLUASU = 2).',
    case_definition: 'CLASSI_FIN = 1 AND PCR_FLUASU = 2.',
    caveats: SIVEP_CAVEATS,
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_inf_a_not_subtyped',
    name: 'SRAG por influenza A sem subtipo definido (SIVEP-Gripe)',
    description:
      'SRAG por influenza (CLASSI_FIN = 1) com influenza A por RT-PCR não subtipada ou não subtipável (PCR_FLUASU = 3 ou 4). Não é H1N1.',
    case_definition: 'CLASSI_FIN = 1 AND PCR_FLUASU IN (3, 4).',
    caveats: [...SIVEP_CAVEATS, 'Não deve ser somado a H1N1; subtipo desconhecido.'],
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_influenza_deaths',
    name: 'Óbitos entre SRAG por influenza (SIVEP-Gripe)',
    description: 'Registros com CLASSI_FIN = 1 e evolução "óbito" (EVOLUCAO = 2). Exclui "óbito por outras causas" (3).',
    case_definition: 'CLASSI_FIN = 1 AND EVOLUCAO = 2.',
    unit: 'deaths',
    caveats: [
      ...SIVEP_CAVEATS,
      'O SIVEP não registra causa básica do óbito; trata-se de óbitos entre casos de SRAG por influenza, não de "mortes causadas por influenza".',
    ],
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_ah1n1pdm09_deaths',
    name: 'Óbitos entre SRAG por A(H1N1)pdm09 confirmada (SIVEP-Gripe)',
    description: 'CLASSI_FIN = 1, PCR_FLUASU = 1 e EVOLUCAO = 2.',
    case_definition: 'CLASSI_FIN = 1 AND PCR_FLUASU = 1 AND EVOLUCAO = 2.',
    unit: 'deaths',
    caveats: [
      ...SIVEP_CAVEATS,
      'Óbitos entre casos de SRAG com H1N1 confirmado por RT-PCR, não "mortes causadas por H1N1".',
    ],
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_influenza_icu',
    name: 'SRAG por influenza com internação em UTI (SIVEP-Gripe)',
    description: 'CLASSI_FIN = 1 e UTI = 1.',
    case_definition: 'CLASSI_FIN = 1 AND UTI = 1.',
    caveats: SIVEP_CAVEATS,
  },
  {
    ...SIVEP_BASE,
    id: 'sivep_srag_influenza_subtype_completeness',
    name: 'Completude de subtipagem entre SRAG por influenza A (SIVEP-Gripe)',
    description:
      'Percentual de SRAG por influenza A por RT-PCR (CLASSI_FIN = 1, TP_FLU_PCR = 1) com subtipo definido (PCR_FLUASU IN (1, 2)).',
    case_definition: '100 × (PCR_FLUASU IN (1,2)) / (TP_FLU_PCR = 1), ambos com CLASSI_FIN = 1.',
    measurement: 'percent',
    unit: 'percent',
    stratum_schema: {},
    suppression_threshold: 0,
    min_denominator: 20,
    caveats: ['Indicador de qualidade de dado; semanas com menos de 20 casos de influenza A por RT-PCR são suprimidas.'],
  },

  // ---------- Denominadores ----------
  {
    id: 'ibge_population_estimate',
    name: 'População residente estimada (IBGE)',
    description: 'Estimativas populacionais anuais por UF e Brasil (agregado 6579, variável 9324).',
    source_id: 'BR-14',
    case_definition: 'População residente estimada em 1º de julho.',
    measurement: 'count',
    unit: 'persons',
    universe_note: 'Estimativa populacional oficial usada como denominador; fixar a versão do denominador em cada taxa.',
    methodology_version: 'ibge-6579-v1',
    geo_levels: ['country', 'state'],
    period_type: 'year',
    event_date_basis: 'reference_year',
    stratum_schema: {},
    mirror_group: null,
    suppression_threshold: 0,
    denominator_indicator_id: null,
    min_denominator: null,
    caveats: ['Estimativa, não contagem censitária.'],
  },
  {
    id: 'worldbank_population_total',
    name: 'População total (Banco Mundial, SP.POP.TOTL)',
    description: 'População total anual por país, série SP.POP.TOTL.',
    source_id: 'INT-11',
    case_definition: 'SP.POP.TOTL por país e ano.',
    measurement: 'count',
    unit: 'persons',
    universe_note: 'Denominador demográfico para comparações internacionais; não é dado epidemiológico.',
    methodology_version: 'wb-v1',
    geo_levels: ['country'],
    period_type: 'year',
    event_date_basis: 'reference_year',
    stratum_schema: {},
    mirror_group: null,
    suppression_threshold: 0,
    denominator_indicator_id: null,
    min_denominator: null,
    caveats: ['Séries podem ser revisadas retroativamente pelo Banco Mundial.'],
  },

  // ---------- UKHSA ----------
  {
    id: 'ukhsa_influenza_testing_positivity',
    name: 'Positividade de testes para influenza, Inglaterra (UKHSA)',
    description: 'Percentual de testes PCR positivos para influenza por semana (influenza_testing_positivityByWeek).',
    source_id: 'UK-01',
    case_definition: 'metric influenza_testing_positivityByWeek, geography England, stratum default, por semana.',
    measurement: 'percent',
    unit: 'percent',
    universe_note:
      'Os números representam a positividade de testes laboratoriais reportados à UKHSA na Inglaterra, não casos de H1N1 nem incidência populacional.',
    methodology_version: 'ukhsa-v1',
    geo_levels: ['country'],
    period_type: 'isoweek',
    event_date_basis: 'specimen_processing',
    stratum_schema: { age: ['all', '0-4', '5-14', '15-44', '45-64', '65+'] },
    mirror_group: null,
    suppression_threshold: 0,
    denominator_indicator_id: null,
    min_denominator: null,
    caveats: ['Influenza geral, sem subtipo; não é H1N1.', 'Semanas em período de atraso de notificação são marcadas como provisórias.'],
  },
];

export const INDICATOR_BY_ID: ReadonlyMap<string, IndicatorDefinition> = new Map(
  INDICATORS.map((i) => [i.id, i]),
);

export function getIndicator(id: string): IndicatorDefinition {
  const def = INDICATOR_BY_ID.get(id);
  if (!def) throw new Error(`Indicador desconhecido: ${id}`);
  return def;
}

/** Grupos espelhados: fontes do mesmo grupo nunca devem ser somadas (catálogo, orientação 3). */
export const MIRROR_GROUPS: Readonly<Record<string, readonly string[]>> = {
  who_flu: ['INT-01', 'INT-02', 'INT-06'],
  br_srag: ['BR-01', 'BR-02', 'BR-03', 'BR-04', 'BR-12'],
  insdc: ['EU-01', 'US-12', 'US-13', 'US-14', 'US-15'],
  cdc_fluview: ['US-01', 'US-03', 'US-07', 'US-08', 'US-09'],
  usda_swine: ['US-18', 'US-19'],
};

export function mirrorGroupOf(sourceId: string): string | null {
  for (const [group, ids] of Object.entries(MIRROR_GROUPS)) if (ids.includes(sourceId)) return group;
  return null;
}
