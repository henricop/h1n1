'use client';
import type { GlobeCountry } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { hudForWeek } from '@/lib/hud';
import { CountUp } from './CountUp';
import { useTimeline } from './TimelineContext';

interface Props {
  countries: GlobeCountry[];
  /** Deslocamento da janela carregada em relação ao eixo do scrubber (0 = dataset completo). */
  offset?: number;
  dataAsOf: string | null;
}

/** Quatro contadores da semana selecionada (todos derivados de /v1/globe, FluNet · OMS). */
export function HudCounters({ countries, offset = 0, dataAsOf }: Props) {
  const t = useTimeline();
  const rel = t.index - offset;
  const h = rel >= 0 ? hudForWeek(countries, rel) : { worldTotal: null, countriesReporting: null, brazil: null, brazilRank: null, ranking: [] };
  const foot = `FluNet · OMS · base de ${formatDateBR(dataAsOf)}`;
  const tiles: Array<{ label: string; value: number | null; suffix?: string; empty?: string; note?: string; className?: string }> = [
    { label: 'Detecções A(H1N1)pdm09 no mundo', value: h.worldTotal, className: 'text-h1n1', note: 'soma dos países que reportaram na semana' },
    { label: 'Países reportando', value: h.countriesReporting, className: 'text-primary-600', note: 'com valor publicado na semana' },
    { label: 'Brasil na semana', value: h.brazil, empty: rel < 0 ? '…' : 'não reportou', className: 'text-ink', note: 'detecções em laboratórios que reportam à OMS' },
    { label: 'Posição do Brasil', value: h.brazilRank, suffix: h.brazilRank ? ` de ${h.ranking.length}` : '', empty: rel < 0 ? '…' : h.brazil === 0 ? 'zero na semana' : 'sem ranking', className: 'text-ink', note: 'ranking por detecções entre países que reportaram' },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3" aria-label="Contadores da semana selecionada">
      {tiles.map((tile) => (
        <li key={tile.label} className="card p-4">
          <p className="label">{tile.label}</p>
          <p className={`value mt-1 ${tile.className ?? ''}`}>
            <CountUp value={tile.value} empty={tile.empty ?? '—'} />
            {tile.suffix && tile.value !== null && <span className="text-sm font-normal text-muted">{tile.suffix}</span>}
          </p>
          {tile.note && <p className="mt-1 text-[12px] leading-snug text-faint">{tile.note}</p>}
          <p className="meta">{foot}</p>
        </li>
      ))}
    </ul>
  );
}
