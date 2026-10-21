import type { ApiResult, RunsResult } from '@/lib/api';
import { formatDateTimeBR } from '@/lib/format';

const nf = new Intl.NumberFormat('pt-BR');
const STATUS_LABEL: Record<string, string> = { ok: 'concluída', failed: 'falhou', skipped: 'pulada' };

/**
 * Console de ingestão: últimas execuções dos conectores como lista limpa. Todas as linhas vão no SSR (sem estado);
 * a entrada escalonada é só CSS (.console-line com --delay) e some em prefers-reduced-motion.
 * Sempre "última execução", nunca um estado corrente.
 */
export function IngestConsole({ runs }: { runs: ApiResult<RunsResult> }) {
  if (!runs.ok) {
    return (
      <div className="console" role="status">
        <p>
          <span className="failed">✗</span> /v1/runs indisponível · última tentativa {formatDateTimeBR(runs.attemptedAt)}
        </p>
        <p className="text-faint">Nenhuma execução antiga é exibida como atual.</p>
      </div>
    );
  }
  const lines = runs.data.data;
  const last = lines[0];
  return (
    <div className="console">
      <p className="text-faint">
        {lines.length} execuções registradas · última: <span className="text-muted">{last ? formatDateTimeBR(last.finished_at ?? last.started_at) : '—'}</span>
      </p>
      <ol className="mt-2 max-h-72 overflow-auto scroll-thin" aria-label="Últimas execuções dos conectores">
        {lines.map((r, i) => (
          <li key={r.id} className="console-line grid grid-cols-[1.2rem_9.5rem_7rem_6rem_1fr] gap-x-2 whitespace-nowrap py-0.5" style={{ ['--delay' as string]: `${Math.min(i, 30) * 40}ms` }}>
            <span className={r.status} aria-hidden="true">
              {r.status === 'ok' ? '●' : r.status === 'failed' ? '✗' : '○'}
            </span>
            <span className="font-mono text-[12px] text-faint">{formatDateTimeBR(r.finished_at ?? r.started_at).replace(' (UTC)', 'Z')}</span>
            <span className="text-ink">{r.connector}</span>
            <span className={r.status}>{STATUS_LABEL[r.status] ?? r.status}</span>
            <span className="truncate">
              {r.error ? r.error : `${nf.format(r.rows_in ?? 0)} linhas lidas → ${nf.format(r.rows_out ?? 0)} publicadas`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
