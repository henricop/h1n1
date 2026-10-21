'use client';
import type { GlobeCountry } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { hudForWeek } from '@/lib/hud';
import { CountUp } from './CountUp';
import { useTimeline } from './TimelineContext';

interface Props {
  countries: GlobeCountry[];
  dataAsOf: string | null;
}

/** Quatro contadores do HUD para a semana selecionada (todos derivados de /v1/globe, FluNet · OMS). */
export function HudCounters({ countries, dataAsOf }: Props) {
  const t = useTimeline();
  const h = hudForWeek(countries, t.index);
  const foot = `FluNet · OMS · base de ${formatDateBR(dataAsOf)}`;
  const tiles: Array<{ label: string; value: number | null; suffix?: string; empty?: string; note?: string; className?: string }> = [
    { label: 'Detecções A(H1N1)pdm09 · mundo', value: h.worldTotal, className: 'text-h1n1 glow-h1n1', note: 'soma dos países que reportaram na semana' },
    { label: 'Países reportando', value: h.countriesReporting, className: 'text-signal glow-signal', note: 'com valor publicado na semana' },
    { label: 'Brasil · semana', value: h.brazil, empty: 'não reportou', className: 'text-ink', note: 'detecções em laboratórios que reportam à OMS' },
    { label: 'Posição do Brasil', value: h.brazilRank, suffix: h.brazilRank ? ` de ${h.ranking.length}` : '', empty: h.brazil === 0 ? 'zero na semana' : 'sem ranking', className: 'text-ink', note: 'ranking por detecções entre países que reportaram' },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3" aria-label="Contadores da semana selecionada">
      {tiles.map((tile) => (
        <li key={tile.label} className="hud-panel hud-corner p-3 md:p-4">
          <p className="hud-label">{tile.label}</p>
          <p className={`hud-value mt-1 ${tile.className ?? ''}`}>
            <CountUp value={tile.value} empty={tile.empty ?? '—'} />
            {tile.suffix && tile.value !== null && <span className="font-mono text-sm text-muted">{tile.suffix}</span>}
          </p>
          {tile.note && <p className="mt-1 text-[11px] leading-snug text-faint">{tile.note}</p>}
          <p className="hud-meta">{foot}</p>
        </li>
      ))}
    </ul>
  );
}
