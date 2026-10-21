import { BR_STATES, INDICATORS } from '@h1n1/core';
import { isIntervalKey, type IntervalKey } from './series';

/** Lista fixa de indicadores do observatório (sivep_* e flunet_* com série para BRA). */
export const OBSERVATORY_INDICATORS: ReadonlyArray<{ id: string; label: string; byState: boolean }> = [
  { id: 'sivep_srag_ah1n1pdm09_confirmed', label: 'SRAG por A(H1N1)pdm09 confirmada por RT-PCR', byState: true },
  { id: 'sivep_srag_ah1n1pdm09_deaths', label: 'Óbitos entre SRAG por A(H1N1)pdm09 confirmada', byState: true },
  { id: 'sivep_srag_influenza_confirmed', label: 'SRAG por influenza (qualquer tipo/subtipo)', byState: true },
  { id: 'sivep_srag_ah3n2_confirmed', label: 'SRAG por A(H3N2) confirmada por RT-PCR', byState: true },
  { id: 'sivep_srag_inf_a_not_subtyped', label: 'SRAG por influenza A sem subtipo definido (não é H1N1)', byState: true },
  { id: 'sivep_srag_influenza_deaths', label: 'Óbitos entre SRAG por influenza', byState: true },
  { id: 'sivep_srag_influenza_icu', label: 'SRAG por influenza com UTI', byState: true },
  { id: 'sivep_srag_notifications', label: 'Notificações de SRAG hospitalizada (todos os agentes)', byState: true },
  { id: 'flunet_ah1n1pdm09_detections', label: 'Detecções de A(H1N1)pdm09 (FluNet, Brasil)', byState: false },
  { id: 'flunet_inf_a_detections', label: 'Detecções de influenza A (FluNet, Brasil)', byState: false },
  { id: 'flunet_inf_a_not_subtyped', label: 'Influenza A não subtipada (FluNet, Brasil; não é H1N1)', byState: false },
  { id: 'flunet_inf_b_detections', label: 'Detecções de influenza B (FluNet, Brasil)', byState: false },
  { id: 'flunet_specimens_processed', label: 'Amostras processadas (FluNet, Brasil)', byState: false },
  { id: 'flunet_ah1n1pdm09_share_of_inf_a', label: 'Participação de A(H1N1)pdm09 entre influenza A (FluNet)', byState: false },
  { id: 'flunet_influenza_positivity', label: 'Positividade para influenza (FluNet, Brasil)', byState: false },
];


/** Nome legível de um indicador (rótulo do observatório, senão nome da ontologia do core, senão o id). */
export function indicatorLabel(id: string): string {
  return OBSERVATORY_INDICATORS.find((i) => i.id === id)?.label ?? INDICATORS.find((i) => i.id === id)?.name ?? id;
}

export type SearchParamsLike = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export interface ObservatoryQuery {
  indicador: (typeof OBSERVATORY_INDICATORS)[number];
  /** UF válida selecionada (null = Brasil, UF inválida ou indicador sem recorte por UF). */
  state: (typeof BR_STATES)[number] | null;
  /** UF informada mas ignorada porque o indicador (FluNet) só existe para o país. */
  ufIgnored: boolean;
  intervalo: IntervalKey;
}

/**
 * Resolve os searchParams do observatório de forma tolerante: valores inválidos ou desconhecidos
 * caem no padrão (primeiro indicador, Brasil, últimas 12 semanas) sem lançar.
 */
export function resolveObservatoryQuery(sp: SearchParamsLike): ObservatoryQuery {
  const indicadorParam = one(sp.indicador);
  const indicador = OBSERVATORY_INDICATORS.find((i) => i.id === indicadorParam) ?? OBSERVATORY_INDICATORS[0]!;
  const ufParam = one(sp.uf).trim().toUpperCase();
  const state = indicador.byState ? (BR_STATES.find((s) => s.uf === ufParam) ?? null) : null;
  const ufIgnored = !indicador.byState && ufParam !== '';
  const intervaloParam = one(sp.intervalo);
  const intervalo: IntervalKey = isIntervalKey(intervaloParam) && intervaloParam !== 'ultimas-8-semanas' ? intervaloParam : 'ultimas-12-semanas';
  return { indicador, state, ufIgnored, intervalo };
}
