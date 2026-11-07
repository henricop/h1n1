import type { FreshnessState } from '@/lib/api';
import { SITE } from '@/lib/site';
import { ALERT_SIGNS_TEXT, AlertSigns } from './AlertSigns';

export { ALERT_SIGNS_PATH, ALERT_SIGNS_TEXT } from './AlertSigns';
/** Aviso clínico completo e fixo: educativo + sinais de alerta (idêntico em todas as páginas que o usam). */
export const CLINICAL_NOTICE_TEXT = `${SITE.medicalDisclaimer} ${ALERT_SIGNS_TEXT}`;

/**
 * Avisos calmos: filete à esquerda e texto em tinta, sem fundo próprio nem cantos arredondados. Quem os agrupa
 * (faixa de papel `bg-bg-soft` no topo do artigo) dá o fundo. Texto ≥ 15 px.
 */
export function ReviewBanner() {
  const detail = SITE.reviewBanner.replace(/^Conteúdo em revisão clínica: /, '');
  return (
    <div role="status" className="border-l-2 border-attention-700 pl-4 text-[15px] leading-snug text-ink md:text-base">
      <p className="font-semibold">Conteúdo em revisão clínica</p>
      <p className="mt-1">{detail.charAt(0).toUpperCase() + detail.slice(1)}</p>
    </div>
  );
}

export function ClinicalNotice() {
  return (
    <p className="border-l-2 border-ink pl-4 text-[15px] leading-snug text-ink md:text-base">
      {SITE.medicalDisclaimer}{' '}
      <span>
        <AlertSigns />
      </span>
    </p>
  );
}

/**
 * API indisponível: mostra a hora real da tentativa registrada no ApiResult (nunca `new Date()` em render,
 * para o HTML do servidor ser determinístico e cacheável). Nenhum número antigo é exibido como atual.
 */
export function DataUnavailable({ attemptedAt, detail }: { attemptedAt: string; detail?: string }) {
  const d = new Date(attemptedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hora = Number.isNaN(d.getTime()) ? attemptedAt : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC de ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return (
    <div role="status" className="border-l-2 border-line-strong bg-bg-soft px-5 py-4">
      <p className="font-semibold text-ink">Dados indisponíveis no momento</p>
      <p className="mt-1 text-[15px] text-muted">Última tentativa: {hora}. Nenhum número antigo é exibido como se fosse atual.</p>
      {detail && process.env.NODE_ENV !== 'production' && <p className="mt-2 font-mono text-[14px] text-muted">{detail}</p>}
    </div>
  );
}

/** API respondeu, mas sem observações para o recorte: é "sem dado publicado", não falha. */
export function NoDataPublished({ what = 'este recorte' }: { what?: string }) {
  return (
    <div role="status" className="border-l-2 border-line-strong bg-bg-soft px-5 py-4">
      <p className="font-semibold text-ink">Sem dado publicado</p>
      <p className="mt-1 text-[15px] text-muted">A fonte respondeu, mas não há observações publicadas para {what}. Ausência de dado não é zero.</p>
    </div>
  );
}

export function StaleBadge({ ageDays }: { ageDays: number | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-attention-700/40 bg-attention-100 px-2.5 py-0.5 text-[14px] font-medium text-attention-700">
      Dado defasado{ageDays !== null ? ` (${ageDays} dias desde a última coleta)` : ''}
    </span>
  );
}

/**
 * Nota de frescor ao lado do valor: selo "Dado defasado" quando verificado e defasado; "frescor não verificado"
 * quando /v1/freshness falhou (nunca esconder o selo em silêncio); nada quando verificado e atual.
 */
export function FreshnessNote({ state }: { state: FreshnessState }) {
  if (!state.verified) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-line-strong bg-bg-soft px-2.5 py-0.5 text-[14px] font-medium text-ink"
        title="Não foi possível consultar /v1/freshness; a idade da base não pôde ser confirmada."
      >
        frescor não verificado
      </span>
    );
  }
  if (state.stale) return <StaleBadge ageDays={state.row?.age_days ?? null} />;
  return null;
}
