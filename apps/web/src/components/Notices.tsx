import type { FreshnessState } from '@/lib/api';
import { SITE } from '@/lib/site';

export function ReviewBanner() {
  return (
    <div role="status" className="rounded-md border-l-4 border-attention-700 bg-attention-100 p-4 text-attention-700">
      <p className="font-semibold">Conteúdo em revisão clínica</p>
      <p className="mt-1 text-sm">{SITE.reviewBanner.replace(/^Conteúdo em revisão clínica: /, '')}</p>
    </div>
  );
}

export function ClinicalNotice() {
  return (
    <p className="rounded-md border border-line bg-navy-50 px-4 py-3 text-sm text-navy-900">{SITE.medicalDisclaimer}</p>
  );
}

export function DataUnavailable({ attemptedAt, detail }: { attemptedAt: string; detail?: string }) {
  const d = new Date(attemptedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hora = Number.isNaN(d.getTime()) ? attemptedAt : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC de ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return (
    <div role="status" className="rounded-md border border-line bg-paper p-4">
      <p className="font-semibold text-navy-900">Dados indisponíveis no momento</p>
      <p className="mt-1 text-sm text-muted">Última tentativa: {hora}. Nenhum número antigo é exibido como se fosse atual.</p>
      {detail && process.env.NODE_ENV !== 'production' && <p className="mt-2 font-mono text-xs text-muted">{detail}</p>}
    </div>
  );
}

export function StaleBadge({ ageDays }: { ageDays: number | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-attention-700/40 bg-attention-100 px-2 py-0.5 text-xs font-medium text-attention-700">
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
        className="inline-flex items-center rounded-full border border-line bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-900"
        title="Não foi possível consultar /v1/freshness; a idade da base não pôde ser confirmada."
      >
        frescor não verificado
      </span>
    );
  }
  if (state.stale) return <StaleBadge ageDays={state.row?.age_days ?? null} />;
  return null;
}
