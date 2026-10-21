/**
 * Itens da paleta de comandos (puro; usado no cliente e nos testes).
 * Grupos: Páginas (rotas elegíveis + rotas de aplicação), Indicadores (observatório), Comandos.
 */
import { INDICATORS } from '@h1n1/core';
import { OBSERVATORY_INDICATORS } from '@/lib/observatory';

export interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  keywords: string[];
  action: { type: 'navigate'; href: string } | { type: 'open'; url: string } | { type: 'terminal' };
}

export interface PaletteGroup {
  heading: 'Páginas' | 'Indicadores' | 'Comandos';
  items: PaletteItem[];
}

export interface PalettePage {
  label: string;
  href: string;
}

/** Rotas de aplicação sempre presentes (sem depender do conteúdo editorial). */
export const APP_ROUTES: readonly PalettePage[] = [
  { label: 'Início', href: '/' },
  { label: 'Sala de dados', href: '/sala/' },
  { label: 'H1N1 no Brasil (observatório)', href: '/dados/brasil/' },
  { label: 'H1N1 no mundo', href: '/dados/mundo/' },
  { label: 'Fontes oficiais', href: '/dados/fontes/' },
  { label: 'Metodologia', href: '/dados/metodologia/' },
  { label: 'Terminal de consulta', href: '/terminal/' },
];

/** Indicadores do observatório enriquecidos com a ontologia do core (nome/fonte). */
export function paletteIndicators(): PaletteItem[] {
  return OBSERVATORY_INDICATORS.map((o) => {
    const core = INDICATORS.find((i) => i.id === o.id);
    return {
      id: `ind:${o.id}`,
      label: o.label,
      hint: core ? `${o.id} · ${core.source_id}` : o.id,
      keywords: [o.id, core?.name ?? '', core?.source_id ?? '', o.byState ? 'uf estado' : 'país'].filter(Boolean),
      action: { type: 'navigate', href: `/dados/brasil/?indicador=${encodeURIComponent(o.id)}` },
    };
  });
}

function apiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

/** URL do CSV do "indicador atual" a partir da query da página (indicador, uf); padrão: primeiro indicador, Brasil. */
export function currentCsvUrl(search: string): string {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const indicador = sp.get('indicador') ?? '';
  const ind = OBSERVATORY_INDICATORS.find((i) => i.id === indicador) ?? OBSERVATORY_INDICATORS[0]!;
  const uf = (sp.get('uf') ?? '').trim().toUpperCase();
  const q = new URLSearchParams({ indicator: ind.id });
  if (ind.byState && /^[A-Z]{2}$/.test(uf)) {
    q.set('geo_level', 'state');
    q.set('geo_code', `BR-${uf}`);
  } else {
    q.set('geo_level', 'country');
    q.set('geo_code', 'BRA');
  }
  return `${apiUrl()}/v1/series.csv?${q.toString()}`;
}

export function buildPaletteGroups(pages: readonly PalettePage[], search = ''): PaletteGroup[] {
  const seen = new Set<string>();
  const pageItems: PaletteItem[] = [];
  for (const p of [...APP_ROUTES, ...pages]) {
    if (seen.has(p.href)) continue;
    seen.add(p.href);
    pageItems.push({ id: `page:${p.href}`, label: p.label, hint: p.href, keywords: [p.href], action: { type: 'navigate', href: p.href } });
  }
  const commands: PaletteItem[] = [
    { id: 'cmd:terminal', label: 'Abrir terminal de consulta', hint: 'h1n1> series, top uf, nowcast…', keywords: ['terminal', 'console', 'comandos'], action: { type: 'navigate', href: '/terminal/' } },
    { id: 'cmd:csv', label: 'Baixar CSV do indicador atual', hint: '/v1/series.csv', keywords: ['csv', 'download', 'exportar', 'baixar'], action: { type: 'open', url: currentCsvUrl(search) } },
    { id: 'cmd:metodologia', label: 'Ir à metodologia', hint: '/dados/metodologia/', keywords: ['metodologia', 'método', 'dicionário'], action: { type: 'navigate', href: '/dados/metodologia/' } },
  ];
  return [
    { heading: 'Páginas', items: pageItems },
    { heading: 'Indicadores', items: paletteIndicators() },
    { heading: 'Comandos', items: commands },
  ];
}
