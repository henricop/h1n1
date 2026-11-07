'use client';
/**
 * Bloco do globo em /sala/ com carga preguiçosa do histórico (achado m):
 * o servidor envia só a janela recente (últimas GLOBE_WINDOW_WEEKS semanas) no payload RSC; o eixo do scrubber
 * continua completo (2009-W01 → hoje). Quando o usuário leva o scrubber para antes da janela (replay de 2009,
 * reprodução desde o início), buscamos o dataset completo em /api/globe (proxy do /v1/globe da API) uma única vez.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GlobeCountry, GlobeResult } from '@/lib/api';
import { GLOBE_WINDOW_WEEKS } from '@/lib/timeline';
import { GlobePanel } from './GlobePanel';
import { DataCounters } from './DataCounters';
import { useTimeline } from './TimelineContext';

interface Props {
  indicator: string;
  /** Países com `values` só da janela recente. */
  countries: GlobeCountry[];
  /** Posição da primeira semana da janela no eixo completo. */
  offset: number;
  /** Primeira semana do eixo completo (para o fetch do histórico). */
  axisStart: string;
  max: number;
  dataAsOf: string | null;
  universeNote: string;
  poster: ReactNode;
}

export function GlobeHero({ indicator, countries, offset, axisStart, max, dataAsOf, universeNote, poster }: Props) {
  const t = useTimeline();
  const [win, setWin] = useState({ countries, offset });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);

  const needsHistory = t.index < win.offset;

  useEffect(() => {
    if (!needsHistory || requested.current) return;
    requested.current = true;
    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/globe?indicator=${encodeURIComponent(indicator)}&from=${encodeURIComponent(axisStart)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: GlobeResult) => {
        // alinha ao eixo do scrubber: o dataset completo começa em axisStart (offset 0)
        const start = d.weeks.indexOf(t.weeks[0] ?? axisStart);
        const s = start < 0 ? 0 : start;
        setWin({ offset: 0, countries: d.countries.map((c) => ({ ...c, values: c.values.slice(s) })) });
      })
      .catch(() => {
        setFailed(true);
        requested.current = false;
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [needsHistory, indicator, axisStart, t.weeks]);

  return (
    <>
      <div className="lg:col-span-7">
        <GlobePanel countries={win.countries} offset={win.offset} loadingHistory={loading} max={max} dataAsOf={dataAsOf} universeNote={universeNote} poster={poster} />
      </div>
      <div className="grid content-start gap-4 lg:col-span-5">
        <DataCounters countries={win.countries} offset={win.offset} dataAsOf={dataAsOf} />
        {failed && needsHistory && (
          <p role="status" className="rounded-2xl border border-attention-700/30 bg-attention-100 px-4 py-3 text-[14px] text-attention-700">
            Histórico anterior a {t.weeks[win.offset]} indisponível no momento; o globo mostra só as últimas {GLOBE_WINDOW_WEEKS} semanas.
          </p>
        )}
      </div>
    </>
  );
}
