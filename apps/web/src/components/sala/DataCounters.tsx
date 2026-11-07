'use client';
import type { GlobeCountry } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { hudForWeek, weekTitle } from '@/lib/hud';
import { LABEL, META } from '@/components/charts/ui';
import { CountUp } from './CountUp';
import { useTimeline } from './TimelineContext';

type TileId = 'world' | 'countries' | 'brazil' | 'rank';

interface Props {
  countries: GlobeCountry[];
  /** Deslocamento da janela carregada em relação ao eixo do scrubber (0 = dataset completo). */
  offset?: number;
  dataAsOf: string | null;
  /** Contadores a omitir (ex.: o total mundial, quando já aparece como número gigante). */
  hide?: TileId[];
}

/**
 * Contadores da semana selecionada, num único painel de dado (todos derivados de /v1/globe, FluNet · OMS).
 * Números em serifa (`.value`), rótulos em 14 px, um rodapé com universo e "base de".
 * A contagem animada é só visual e acontece uma vez (ver CountUp); ao mover o scrubber os valores trocam sem animar.
 */
export function DataCounters({ countries, offset = 0, dataAsOf, hide = [] }: Props) {
  const t = useTimeline();
  const rel = t.index - offset;
  const h = rel >= 0 ? hudForWeek(countries, rel) : { worldTotal: null, countriesReporting: null, brazil: null, brazilRank: null, ranking: [] };
  const tiles: Array<{ id: TileId; label: string; value: number | null; suffix?: string; empty?: string; note: string; tone: string }> = [
    { id: 'world', label: 'Detecções no mundo', value: h.worldTotal, tone: 'text-h1n1-700', note: 'de A(H1N1)pdm09: soma dos países que reportaram na semana' },
    { id: 'countries', label: 'Países reportando', value: h.countriesReporting, tone: 'text-primary-600', note: 'com valor publicado na semana' },
    { id: 'brazil', label: 'Detecções no Brasil', value: h.brazil, empty: rel < 0 ? '…' : 'não reportou', tone: 'text-ink', note: 'em laboratórios que reportam à OMS na semana' },
    { id: 'rank', label: 'Posição do Brasil', value: h.brazilRank, suffix: h.brazilRank ? ` de ${h.ranking.length}` : '', empty: rel < 0 ? '…' : h.brazil === 0 ? 'zero na semana' : 'sem posição', tone: 'text-ink', note: 'ordem por detecções entre os países que reportaram; depende de quanto cada país testa e reporta' },
  ];
  const shown = tiles.filter((x) => !hide.includes(x.id));
  return (
    <section aria-label="Contadores da semana selecionada" className="card p-5 md:p-7">
      <p className={LABEL}>{weekTitle(t.week)}</p>
      <ul className="mt-5 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2">
        {shown.map((tile) => (
          <li key={tile.id} className="border-t border-line pt-4">
            <p className="text-[15px] font-medium leading-snug text-ink">{tile.label}</p>
            <p className={`value mt-1 ${tile.tone}`}>
              <CountUp value={tile.value} empty={tile.empty ?? '—'} />
              {tile.suffix && tile.value !== null && <span className="ml-1 font-sans text-[1rem] tracking-normal text-muted">{tile.suffix}</span>}
            </p>
            <p className="mt-1 text-[14px] leading-snug text-muted">{tile.note}</p>
          </li>
        ))}
      </ul>
      <p className={META}>Detecções laboratoriais reportadas à OMS (FluNet), não casos na população · base de {formatDateBR(dataAsOf)}</p>
    </section>
  );
}
