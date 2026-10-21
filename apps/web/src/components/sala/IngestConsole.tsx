'use client';
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { ApiResult, RunsResult } from '@/lib/api';
import { formatDateTimeBR } from '@/lib/format';

const nf = new Intl.NumberFormat('pt-BR');

/** Console de ingestão: últimas execuções dos conectores (estilo terminal). Sempre "última execução", nunca um estado corrente. */
export function IngestConsole({ runs }: { runs: ApiResult<RunsResult> }) {
  const reduced = useReducedMotion();
  const lines = runs.ok ? runs.data.data : [];
  const [shown, setShown] = useState(() => (reduced ? lines.length : 0));

  useEffect(() => {
    if (reduced || shown >= lines.length) return;
    const id = window.setTimeout(() => setShown((s) => s + 1), 55);
    return () => window.clearTimeout(id);
  }, [reduced, shown, lines.length]);

  useEffect(() => {
    if (reduced) setShown(lines.length);
  }, [reduced, lines.length]);

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
  const last = lines[0];
  return (
    <div className="console" aria-live="off">
      <p className="text-faint">
        $ h1n1 runs --limit {lines.length} <span className="text-muted">· última execução registrada: {last ? formatDateTimeBR(last.finished_at ?? last.started_at) : '—'}</span>
      </p>
      <ol className="mt-1 max-h-72 overflow-auto hud-scroll" aria-label="Últimas execuções dos conectores">
        {lines.slice(0, shown).map((r) => (
          <li key={r.id} className="grid grid-cols-[1.2rem_9.5rem_7rem_6rem_1fr] gap-x-2 whitespace-nowrap">
            <span className={r.status} aria-hidden="true">
              {r.status === 'ok' ? '●' : r.status === 'failed' ? '✗' : '○'}
            </span>
            <span className="text-faint">{formatDateTimeBR(r.finished_at ?? r.started_at).replace(' (UTC)', 'Z')}</span>
            <span className="text-ink">{r.connector}</span>
            <span className={r.status}>{r.status}</span>
            <span className="truncate">
              {r.error ? r.error : `${nf.format(r.rows_in ?? 0)} linhas lidas → ${nf.format(r.rows_out ?? 0)} publicadas`}
            </span>
          </li>
        ))}
      </ol>
      {shown < lines.length && <p className="cursor-blink" aria-hidden="true" />}
    </div>
  );
}
