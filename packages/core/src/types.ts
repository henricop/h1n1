/**
 * Tipos de domínio do H1N1.
 * Regra central (plano estratégico 10.4): H1N1 confirmado ≠ influenza A não subtipada ≠ SRAG ≠ síndrome gripal.
 */
export type Priority = 'P0' | 'P1' | 'P2';
export type AccessType = 'api' | 'open_data' | 'portal';
export type GeoLevel = 'world' | 'country' | 'region' | 'state';
export type PeriodType = 'epiweek' | 'isoweek' | 'month' | 'year';
export type Measurement = 'count' | 'rate' | 'percent';
export type UpdateStatus = 'provisional' | 'final';
export type SnapshotStatus = 'ok' | 'failed' | 'quarantined';
export type PublicationStatus = 'current' | 'superseded' | 'rejected';
export type EventDateBasis =
  | 'symptom_onset'
  | 'notification'
  | 'specimen_processing'
  | 'specimen_collection'
  | 'reference_year';

export interface Source {
  id: string; // ex.: BR-03
  slug: string; // ex.: br_sivep_gripe
  name: string;
  agency: string;
  country: string;
  region: string;
  category: string;
  access: string;
  access_type: AccessType;
  h1n1_scope: string;
  update_cadence: string;
  priority: Priority;
  url: string;
  notes: string;
  license: string;
  /** Fontes que reapresentam os mesmos dados (não somar): ex. 'who_flu', 'insdc', 'br_srag' */
  mirror_group: string | null;
  api_tested_at: string | null;
}

export interface Snapshot {
  id: string;
  source_id: string;
  url: string;
  fetched_at: string;
  sha256: string;
  bytes: number | null;
  content_type: string | null;
  license: string | null;
  storage_path: string | null;
  data_as_of: string | null;
  status: SnapshotStatus;
  notes: string | null;
}

export interface StratumSchema {
  /** chaves de estrato permitidas e valores possíveis; '' = total */
  [dimension: string]: readonly string[];
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  description: string;
  source_id: string;
  case_definition: string;
  measurement: Measurement;
  unit: string;
  /** Texto obrigatório de universo (plano 5.2), exibido junto ao indicador */
  universe_note: string;
  methodology_version: string;
  geo_levels: readonly GeoLevel[];
  period_type: PeriodType;
  event_date_basis: EventDateBasis;
  stratum_schema: StratumSchema;
  mirror_group: string | null;
  /** 0 = sem supressão. Aplicada a recortes subnacionais e/ou estratificados. */
  suppression_threshold: number;
  /** Para percentuais: id do indicador denominador e n mínimo para publicar a razão */
  denominator_indicator_id: string | null;
  min_denominator: number | null;
  /** Limites interpretativos exibidos na UI (o que o número NÃO permite concluir) */
  caveats: readonly string[];
}

export interface Observation {
  indicator_id: string;
  snapshot_id: string;
  geo_level: GeoLevel;
  geo_code: string;
  period_type: PeriodType;
  period: string; // ex.: 2026-W41, 2026-M09, 2026
  period_start: string; // ISO date
  period_end: string; // ISO date
  value: number | null;
  denominator: number | null;
  stratum: Record<string, string>;
  update_status: UpdateStatus;
  quality_flags: string[];
}

export interface PublishedObservation extends Omit<Observation, 'value'> {
  value: number | null;
  suppressed: boolean;
}
