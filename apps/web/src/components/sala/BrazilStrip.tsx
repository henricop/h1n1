'use client';
import { useMemo, useState, type ReactNode } from 'react';
import type { ApiResult, BrazilMapResult } from '@/lib/api';
import { formatDateBR, formatNumberBR } from '@/lib/format';
import { maxPublished } from '@/lib/map-scale';
import { coverage, shortWeek } from '@/lib/timeline';
import { BrazilMap } from './BrazilMap';
import { useTimeline } from './TimelineContext';
import { DataUnavailable, NoDataPublished } from '@/components/Notices';

export interface MapOption { id: string; label: string; unit: string }

interface Props {
  options: MapOption[];
  datasets: Record<string, ApiResult<BrazilMapResult>>;
  threshold: number;
  /** Sinais EARS (server component). */
  ears: ReactNode;
}

/** Faixa "Brasil": seletor de indicador, mapa de UFs sincronizado com o scrubber, ranking da semana e sinais EARS. */
export function BrazilStrip({ options, datasets, threshold, ears }: Props) {
  const t = useTimeline();
  const [id, setId] = useState(options[0]?.id ?? '');
  const opt = options.find((o) => o.id === id) ?? options[0];
  const res = opt ? datasets[opt.id] : undefined;
  const data = res?.ok ? res.data : null;
  const cov = coverage(data?.weeks ?? [], t.week);
  const shownIndex = data && cov.shown ? data.weeks.indexOf(cov.shown) : -1;
  const max = useMemo(() => (data ? Math.max(...data.states.map((s) => maxPublished(s.values, s.suppressed))) : 0), [data]);
  const ranking = useMemo(() => {
    if (!data || shownIndex < 0) return [];
    return data.states
      .map((s) => ({ uf: s.uf, name: s.name, value: s.values[shownIndex] ?? null, suppressed: s.suppressed[shownIndex] ?? false }))
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name));
  }, [data, shownIndex]);
  const provisional = data && shownIndex >= 0 ? (data.national.provisional[shownIndex] ?? false) : false;
  const national = data && shownIndex >= 0 ? (data.national.values[shownIndex] ?? null) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="card p-5 lg:col-span-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Brasil por UF · SIVEP-Gripe</p>
            <h3 className="mt-1 font-display text-xl font-bold tracking-[-0.01em] text-ink">{opt?.label}</h3>
          </div>
          <div>
            <label htmlFor="mapa-indicador" className="sr-only">
              Indicador do mapa
            </label>
            <select id="mapa-indicador" className="select-field" value={opt?.id} onChange={(e) => setId(e.target.value)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!res ? (
          <div className="mt-3">
            <NoDataPublished />
          </div>
        ) : !res.ok ? (
          <div className="mt-3">
            <DataUnavailable attemptedAt={res.attemptedAt} detail={res.error} />
          </div>
        ) : (
          <>
            {!cov.covered && cov.shown && (
              <p role="status" className="mt-3 rounded-2xl border border-attention-700/20 bg-attention-100 px-4 py-2 text-[13px] text-attention-700">
                Semana {shortWeek(t.week)} fora da cobertura carregada ({cov.first && shortWeek(cov.first)} a {cov.last && shortWeek(cov.last)}); exibindo {shortWeek(cov.shown)}.
              </p>
            )}
            <div className="mt-3">
              <BrazilMap states={data!.states} weekIndex={shownIndex} week={cov.shown ?? t.week} max={max} unit={opt?.unit ?? ''} threshold={threshold} indicatorName={data!.indicator.name} provisional={provisional} />
            </div>
            <p className="meta">
              Brasil na semana: <span className="text-ink">{formatNumberBR(national, opt?.unit)}</span>
              {provisional ? <span className="text-attention-700"> (provisório)</span> : null} · {data!.meta.universe_note} · fonte {data!.meta.source_id} · licença {data!.meta.license ?? 'verificar'} · base de {formatDateBR(data!.meta.data_as_of)}
            </p>
          </>
        )}
      </div>
      <div className="grid gap-4 lg:col-span-5">
        <div className="card p-5">
          <p className="label">Ranking de UFs · {cov.shown ? shortWeek(cov.shown) : '—'}</p>
          {ranking.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sem dados para esta semana.</p>
          ) : (
            <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-[13px] scroll-thin" aria-label="Ranking de UFs na semana">
              {ranking.map((r, i) => {
                const pct = max > 0 && r.value ? (r.value / max) * 100 : 0;
                return (
                  <li key={r.uf} className="grid grid-cols-[1.5rem_2.2rem_1fr_4.5rem] items-center gap-2">
                    <span className="text-faint">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-ink">{r.uf}</span>
                    <span className="h-2 rounded-full bg-bg-tint" aria-hidden="true">
                      <span className="block h-2 rounded-full bg-h1n1" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="text-right font-mono text-[12px] tabular-nums text-ink">{r.suppressed ? `<${threshold}` : formatNumberBR(r.value, opt?.unit)}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="meta">{'<'}{threshold}: célula suprimida (regra 9). Semanas provisórias sobem em revisões.</p>
        </div>
        {ears}
      </div>
    </div>
  );
}
