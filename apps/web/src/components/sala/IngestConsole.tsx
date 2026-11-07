import type { ApiResult, RunsResult } from '@/lib/api';
import { formatDateTimeBR } from '@/lib/format';

const nf = new Intl.NumberFormat('pt-BR');
const STATUS_LABEL: Record<string, string> = { ok: 'concluída', failed: 'falhou', skipped: 'pulada' };
/** Sem vermelho fora do aviso de emergência: falha em âmbar escuro, em negrito e com símbolo. */
const STATUS_CLASS: Record<string, string> = { ok: 'text-ok-700', failed: 'font-semibold text-attention-700', skipped: 'text-muted' };

/**
 * Execuções dos conectores: lista limpa das últimas execuções. Todas as linhas vão no SSR (sem estado); a entrada
 * escalonada é só CSS (`.console-line` com `--delay`) e some em prefers-reduced-motion. Estado em texto e símbolo
 * (não só cor). Sempre "última execução", nunca um estado corrente.
 */
export function IngestConsole({ runs }: { runs: ApiResult<RunsResult> }) {
  if (!runs.ok) {
    return (
      <div className="console text-[14px]!" role="status">
        <p>
          <span className="text-attention-700">✗</span> /v1/runs indisponível · última tentativa {formatDateTimeBR(runs.attemptedAt)}
        </p>
        <p className="text-faint">Nenhuma execução antiga é exibida como atual.</p>
      </div>
    );
  }
  const lines = runs.data.data;
  const last = lines[0];
  return (
    <div className="console text-[14px]!">
      <p className="text-faint">
        {lines.length} execuções registradas · última: <span className="text-muted">{last ? formatDateTimeBR(last.finished_at ?? last.started_at) : '—'}</span>
      </p>
      <ol className="mt-3 max-h-96 divide-y divide-line overflow-auto scroll-thin" aria-label="Últimas execuções dos conectores">
        {lines.map((r, i) => (
          <li
            key={r.id}
            className="console-line flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 md:grid md:grid-cols-[1.25rem_11.5rem_9rem_6.5rem_1fr] md:gap-x-3"
            style={{ ['--delay' as string]: `${Math.min(i, 30) * 40}ms` }}
          >
            <span className={STATUS_CLASS[r.status]} aria-hidden="true">
              {r.status === 'ok' ? '●' : r.status === 'failed' ? '✗' : '○'}
            </span>
            <span className="text-faint">{formatDateTimeBR(r.finished_at ?? r.started_at).replace(' (UTC)', ' UTC')}</span>
            <span className="text-ink">{r.connector}</span>
            <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</span>
            <span className="min-w-0 basis-full md:basis-auto">{r.error ? r.error : `${nf.format(r.rows_in ?? 0)} linhas lidas → ${nf.format(r.rows_out ?? 0)} publicadas`}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
