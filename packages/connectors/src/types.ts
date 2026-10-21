import type { Observation } from '@h1n1/core';
import type { Db } from '@h1n1/db';

/** Opções de linha de comando repassadas aos conectores. */
export interface ConnectorOptions {
  /** sivep: ano do arquivo INFLUD */
  year?: number;
  /** flunet: lista de ISO3 */
  countries?: string[];
  /** ibge: intervalo de anos */
  years?: number[];
  /** limite de linhas de microdados (desenvolvimento) */
  maxRows?: number;
  force?: boolean;
  dryRun?: boolean;
}

/** Linha da tabela geo a garantir antes da validação (países fora do seed inicial). */
export interface GeoEntry {
  code: string;
  level: 'world' | 'country' | 'region' | 'state';
  name: string;
  parent_code: string | null;
  iso2?: string | null;
  ibge_id?: string | null;
}

/**
 * Snapshot bruto: o arquivo original já gravado em disco (streaming, nunca em memória para microdados),
 * com os metadados exigidos pela orientação 1 do catálogo (timestamp, URL, hash, licença).
 */
export interface RawSnapshot {
  /** URL principal (ou primeira URL quando o arquivo é um envelope de várias requisições) */
  url: string;
  /** Todas as URLs requisitadas */
  urls: string[];
  /** Caminho do arquivo bruto em disco (temporário até o pipeline renomear) */
  path: string;
  ext: string;
  sha256: string;
  bytes: number;
  content_type: string | null;
  license: string;
  data_as_of: string | null;
  fetched_at: string;
  /** Metadados adicionais gravados no sidecar .meta.json */
  extra?: Record<string, unknown>;
}

export interface NormalizeContext {
  snapshotId: string;
  options: ConnectorOptions;
  log: (msg: string) => void;
  /** Linhas geo a garantir na tabela geo (upsert) antes da validação */
  ensureGeo: (entries: GeoEntry[]) => void;
  /** Contadores e notas que vão para o validation_report / ingestion_runs */
  report: Record<string, unknown>;
  /** Linhas lidas da origem (microdados ou registros de API) */
  countRowsIn: (n: number) => void;
  /**
   * Cobertura temporal da snapshot por indicador (períodos [from, to] inclusive).
   * Observações da publicação anterior fora desse intervalo são carregadas adiante (carry-forward),
   * permitindo que arquivos anuais (SIVEP 2025 e 2026) componham uma única série vigente.
   */
  setCoverage: (indicatorId: string, from: string, to: string) => void;
}

export interface FetchContext {
  options: ConnectorOptions;
  log: (msg: string) => void;
  /** Diretório onde o conector deve gravar o arquivo bruto temporário */
  tmpDir: string;
}

export interface Connector {
  id: string;
  sourceId: string;
  indicators: string[];
  fetch(ctx: FetchContext): Promise<RawSnapshot>;
  normalize(raw: RawSnapshot, ctx: NormalizeContext): Promise<Observation[]> | AsyncIterable<Observation[]>;
}

export interface PipelineDeps {
  db: Db;
  snapshotRoot: string;
  log?: (msg: string) => void;
  now?: () => Date;
}

export interface IngestResult {
  connector: string;
  sourceId: string;
  status: 'ok' | 'quarantined' | 'failed' | 'unchanged' | 'dry-run';
  snapshotId: string | null;
  storagePath: string | null;
  sha256: string;
  rowsIn: number;
  rowsOut: number;
  dataAsOf: string | null;
  publishedIndicators: string[];
  rejectedIndicators: string[];
  validation: Record<string, unknown>;
  error?: string;
}
