/**
 * Contadores da semana a partir do globo (/v1/globe): soma, países reportando, Brasil. Puro e testável.
 * (O arquivo mantém o nome `hud.ts` por compatibilidade com os testes; nada aqui é interface de HUD.)
 */
import type { GlobeCountry } from './api';
import { parseWeek } from './timeline';

export interface HudWeek {
  /** Soma das detecções publicadas no mundo na semana (países com valor nulo não entram). */
  worldTotal: number;
  /** Países com valor publicado (não nulo) na semana. */
  countriesReporting: number;
  /** Valor do Brasil (null se não reportou). */
  brazil: number | null;
  /** Posição do Brasil entre os países que reportaram (1 = maior); null se não reportou ou reportou zero. */
  brazilRank: number | null;
  /** Ordem completa da semana (valor > 0), decrescente. */
  ranking: Array<{ iso3: string; name: string; value: number }>;
}

export function hudForWeek(countries: GlobeCountry[], weekIndex: number, brazilIso3 = 'BRA'): HudWeek {
  const rows: Array<{ iso3: string; name: string; value: number }> = [];
  let reporting = 0;
  let total = 0;
  let brazil: number | null = null;
  for (const c of countries) {
    const v = c.values[weekIndex];
    if (v === null || v === undefined) continue;
    reporting += 1;
    total += v;
    if (c.iso3 === brazilIso3) brazil = v;
    if (v > 0) rows.push({ iso3: c.iso3, name: c.name, value: v });
  }
  rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const rank = brazil !== null && brazil > 0 ? rows.findIndex((r) => r.iso3 === brazilIso3) + 1 : null;
  return { worldTotal: total, countriesReporting: reporting, brazil, brazilRank: rank && rank > 0 ? rank : null, ranking: rows };
}

/** Maior valor de qualquer país em qualquer semana (escala fixa do globo ao longo do tempo). */
export function globalMax(countries: GlobeCountry[]): number {
  let m = 0;
  for (const c of countries) for (const v of c.values) if (v !== null && v > m) m = v;
  return m;
}

/** Rótulo da semana em caixa normal para a tela: '2009-W17' → 'Semana ISO 17 · 2009' (caixa alta só em Big Shoulders). */
export function weekTitle(id: string): string {
  const p = parseWeek(id);
  return p ? `Semana ISO ${p.week} · ${p.year}` : id;
}
