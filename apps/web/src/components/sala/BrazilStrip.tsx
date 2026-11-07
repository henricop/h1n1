'use client';
import { useMemo, useState, type ReactNode } from 'react';
import type { ApiResult, BrazilMapResult } from '@/lib/api';
import { formatDateBR, formatPeriod, UNIT_LABEL } from '@/lib/format';
import { maxPublished } from '@/lib/map-scale';
import { coverage } from '@/lib/timeline';
import { LABEL, META, NOTE } from '@/components/charts/ui';
import { DataUnavailable, NoDataPublished } from '@/components/Notices';
import { BrazilMap } from './BrazilMap';
import { CountUp } from './CountUp';
import { useTimeline } from './TimelineContext';
import type { UfPath } from './uf-paths';

export interface MapOption { id: string; label: string; unit: string }

interface Props {
  options: MapOption[];
  datasets: Record<string, ApiResult<BrazilMapResult>>;
  threshold: number;
  /** Sinais EARS (server component). */
  ears: ReactNode;
  /** Caminhos das UFs calculados no servidor (SVG no HTML inicial). */
  paths?: UfPath[];
}

/** Faixa "Brasil": seletor de indicador, mapa de UFs sincronizado com o scrubber, total do Brasil na semana e sinais EARS. Sem ranking de UFs. */
export function BrazilStrip({ options, datasets, threshold, ears, paths }: Props) {
  const t = useTimeline();
  const [id, setId] = useState(options[0]?.id ?? '');
  const opt = options.find((o) => o.id === id) ?? options[0];
  const res = opt ? datasets[opt.id] : undefined;
  const data = res?.ok ? res.data : null;
  const cov = coverage(data?.weeks ?? [], t.week);
  const shownIndex = data && cov.shown ? data.weeks.indexOf(cov.shown) : -1;
  const max = useMemo(() => (data ? Math.max(...data.states.map((s) => maxPublished(s.values, s.suppressed))) : 0), [data]);
  const provisional = data && shownIndex >= 0 ? (data.national.provisional[shownIndex] ?? false) : false;
  const national = data && shownIndex >= 0 ? (data.national.values[shownIndex] ?? null) : null;
  const unit = opt?.unit ?? 'notifications';

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="card p-5 md:p-7 lg:col-span-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={LABEL}>Brasil por UF · SIVEP-Gripe</p>
            <h3 className="mt-2 font-display text-[1.75rem] font-normal leading-[1.1] tracking-[-0.01em] text-ink">{opt?.label}</h3>
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
          <div className="mt-4">
            <NoDataPublished />
          </div>
        ) : !res.ok ? (
          <div className="mt-4">
            <DataUnavailable attemptedAt={res.attemptedAt} detail={res.error} />
          </div>
        ) : (
          <>
            {!cov.covered && cov.shown && (
              <p role="status" className="mt-4 rounded-2xl border border-attention-700/30 bg-attention-100 px-4 py-3 text-[14px] text-attention-700">
                {formatPeriod(t.week, 'isoweek')} fora da cobertura carregada ({cov.first && formatPeriod(cov.first)} a {cov.last && formatPeriod(cov.last)}); exibindo {formatPeriod(cov.shown)}.
              </p>
            )}
            <div className="mt-5">
              <BrazilMap
                states={data!.states}
                weekIndex={shownIndex}
                week={cov.shown ?? t.week}
                max={max}
                unit={unit}
                threshold={threshold}
                indicatorName={data!.indicator.name}
                provisional={provisional}
                paths={paths}
                ufForm={{ action: '/dados/brasil/', hidden: { indicador: opt?.id ?? '', intervalo: 'ultimas-52-semanas' }, label: 'Abrir uma UF no observatório', submitLabel: 'Abrir no observatório' }}
              />
            </div>
          </>
        )}
      </div>
      <div className="grid content-start gap-6 lg:col-span-5">
        {data && (
          <section aria-labelledby="h-br-semana" className="card p-5 md:p-7">
            <p id="h-br-semana" className={LABEL}>
              Brasil na semana {cov.shown ? formatPeriod(cov.shown) : ''}
            </p>
            <p className="value mt-2">
              <CountUp value={national} unit={unit} />{' '}
              <span className="font-sans text-[1rem] tracking-normal text-muted">{UNIT_LABEL[unit] ?? unit}</span>
            </p>
            <p className={`mt-3 text-[16px] leading-snug ${provisional ? 'font-medium text-attention-700' : 'text-muted'}`}>
              {shownIndex < 0 ? 'Sem semana publicada para esta seleção.' : provisional ? 'Provisório: a semana ainda recebe registros e o valor tende a subir em revisões.' : 'Consolidado: a fonte não marca esta semana como provisória.'}
            </p>
            <p className={META}>
              {data.meta.universe_note} · fonte {data.meta.source_id} · licença {data.meta.license ?? 'verificar'} · base de {formatDateBR(data.meta.data_as_of)}
            </p>
          </section>
        )}
        {ears}
      </div>
    </div>
  );
}
