import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NavItem } from '@/lib/content';
import { resolvePrimaryNav, siteChrome } from '@/lib/nav';
import {
  INK_KEYS,
  INK_SWITCH_LUMINANCE,
  THEME_BG,
  THEME_KEYS,
  THEME_META,
  THEMES,
  createThemeMix,
  hexToRgb,
  inkFor,
  isThemeName,
  relativeLuminance,
  type ThemeName,
} from '@/lib/motion/theme';
import { LENIS_OPTIONS, getLenis, scrollToEl, setLenis } from '@/lib/motion/lenis';
import { shouldSmoothScroll } from '@/lib/motion/prefs';
import { SIMPLE_KEY, SIMPLE_MODE_BOOT_SCRIPT } from '@/lib/motion/simple-mode';
import { footerRevealOn, FOOTER_STATIC_QUERY } from '@/components/shell/FooterReveal';
import { actAccessibleName, actNumeral, actsProgress } from '@/components/shell/rail';
import { institutionalLinks, menuDestinations, shortTitle, topShortcuts, footerSections, isCurrentPath } from '@/components/shell/destinations';
import { Footer } from '@/components/Footer';
import { Menu } from '@/components/shell/Menu';
import { ProgressRail } from '@/components/shell/ProgressRail';
import { Brand } from '@/components/shell/Brand';

const WEB = process.cwd();
const css = readFileSync(path.join(WEB, 'src/app/globals.css'), 'utf8');

/** Extrai `--var: valor;` de um bloco CSS (primeiro bloco cujo seletor bate). */
function cssBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`bloco ${selector} não encontrado em globals.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');

const NAV_FULL: NavItem[] = [
  { label: 'Sintomas e cuidados', href: '/sintomas/', children: [{ label: 'Sintomas', href: '/sintomas/' }, { label: 'Sinais de alerta', href: '/sintomas/sinais-de-alerta/' }] },
  { label: 'Vacina e prevenção', href: '/vacina/', children: [{ label: 'Vacina', href: '/vacina/' }] },
  { label: 'H1N1 hoje', href: '/dados/brasil/', children: [] },
  { label: 'Dados e pesquisas', href: '/dados/fontes/', children: [] },
  { label: 'Entenda o H1N1', href: '/o-que-e-h1n1/', children: [{ label: 'O que é', href: '/o-que-e-h1n1/' }, { label: 'Transmissão', href: '/transmissao/' }] },
];
const NAV_MIN: NavItem[] = [
  { label: 'H1N1 hoje', href: '/dados/brasil/', children: [] },
  { label: 'Dados e pesquisas', href: '/dados/fontes/', children: [] },
];

afterEach(() => {
  setLenis(null);
  vi.restoreAllMocks();
});

describe('tema: valores iguais aos de globals.css', () => {
  const root = cssBlock('@theme {');
  it('paper = @theme', () => {
    for (const k of THEME_KEYS) {
      expect(root[k], `${k} ausente no @theme`).toBeDefined();
      expect(norm(THEMES.paper[k]!), k).toBe(norm(root[k]!));
    }
  });
  for (const name of ['deep', 'warm'] as const) {
    it(`${name} = html[data-theme-current='${name}'] (ou herda do @theme)`, () => {
      const block = cssBlock(`html[data-theme-current='${name}']`);
      for (const k of THEME_KEYS) {
        const expected = block[k] ?? root[k];
        expect(norm(THEMES[name][k]!), `${name} ${k}`).toBe(norm(expected!));
      }
      // nenhuma variável de cor do bloco fica de fora de THEMES (senão a interpolação deixaria resto)
      for (const k of Object.keys(block).filter((k) => k.startsWith('--color-'))) expect(THEME_KEYS, `${name}: ${k} fora de THEMES`).toContain(k);
    });
  }
  it('THEME_BG e THEME_META batem com --color-bg de cada tema', () => {
    for (const name of ['paper', 'deep', 'warm'] as ThemeName[]) {
      expect(hexToRgb(THEMES[name]['--color-bg']!)).toEqual(THEME_BG[name]);
      expect(THEME_META[name]).toBe(THEMES[name]['--color-bg']);
    }
    expect(isThemeName('deep')).toBe(true);
    expect(isThemeName('dark')).toBe(false);
  });
});

describe('tema: luminância e troca da tinta', () => {
  it('relativeLuminance / inkFor: paper e warm → tinta escura; deep → tinta clara', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(INK_SWITCH_LUMINANCE).toBe(0.18);
    expect(inkFor(THEME_BG.paper)).toBe('dark');
    expect(inkFor(THEME_BG.warm)).toBe('dark');
    expect(inkFor(THEME_BG.deep)).toBe('light');
  });

  it('paper → deep: o fundo interpola; tinta/muted/primary/linhas trocam DE UMA VEZ no cruzamento do limiar', () => {
    const mix = createThemeMix(THEMES.paper, THEME_BG.paper, 'deep');
    let switches = 0;
    let prevInk: string | undefined;
    let sawIntermediateBg = false;
    for (let i = 0; i <= 100; i++) {
      const f = mix(i / 100);
      for (const k of INK_KEYS) {
        if (f.vars[k] === undefined) continue;
        // nunca valor intermediário
        expect([THEMES.paper[k], THEMES.deep[k]], `${k} em t=${i / 100}`).toContain(f.vars[k]);
        // lado da tinta coerente com a luminância do fundo interpolado
        expect(f.vars[k], `${k} em t=${i / 100}`).toBe(f.ink === 'light' ? THEMES.deep[k] : THEMES.paper[k]);
      }
      const ink = f.vars['--color-ink'];
      if (prevInk !== undefined && ink !== prevInk) switches++;
      prevInk = ink;
      const bg = f.vars['--color-bg']!;
      if (norm(bg) !== norm(THEMES.paper['--color-bg']!) && norm(bg) !== norm(THEMES.deep['--color-bg']!)) sawIntermediateBg = true;
    }
    expect(switches).toBe(1);
    expect(sawIntermediateBg).toBe(true);
    const end = mix(1);
    for (const k of Object.keys(end.vars)) expect(end.vars[k], k).toBe(THEMES.deep[k]);
    expect(end.bg).toEqual(THEME_BG.deep);
  });

  it('paper → warm (sem cruzar o limiar): tudo interpola e só as variáveis que diferem entram', () => {
    const mix = createThemeMix(THEMES.paper, THEME_BG.paper, 'warm');
    const mid = mix(0.5);
    expect(Object.keys(mid.vars).sort()).toEqual(THEME_KEYS.filter((k) => THEMES.paper[k] !== THEMES.warm[k]).sort());
    expect(mid.vars['--color-ink']).toBeUndefined();
    expect(mid.ink).toBe('dark');
    expect([THEMES.paper['--color-line'], THEMES.warm['--color-line']]).not.toContain(mid.vars['--color-line']);
  });

  it('interrupção no meio (deep → warm a partir de um estado misto) continua coerente', () => {
    const a = createThemeMix(THEMES.paper, THEME_BG.paper, 'deep')(0.8);
    const from = { ...THEMES.paper, ...a.vars };
    const b = createThemeMix(from, a.bg, 'warm');
    for (let i = 0; i <= 20; i++) {
      const f = b(i / 20);
      const ink = f.vars['--color-ink'] ?? from['--color-ink'];
      expect(ink).toBe(f.ink === 'light' ? THEMES.deep['--color-ink'] : THEMES.warm['--color-ink']);
    }
    expect(b(1).bg).toEqual(THEME_BG.warm);
  });
});

describe('rolagem', () => {
  it('scrollToEl sem Lenis chama scrollIntoView (suave; instantâneo com reduced)', () => {
    expect(getLenis()).toBeNull();
    const scrollIntoView = vi.fn();
    const el = { scrollIntoView } as unknown as Element;
    scrollToEl(el);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    scrollToEl(el, { reduced: true });
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
    scrollToEl(null);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('scrollToEl com Lenis usa lenis.scrollTo com force (funciona com o Lenis parado)', () => {
    const scrollTo = vi.fn();
    setLenis({ scrollTo } as unknown as Parameters<typeof setLenis>[0]);
    const el = { scrollIntoView: vi.fn() } as unknown as Element;
    scrollToEl(el);
    expect(scrollTo).toHaveBeenCalledWith(el, { duration: 1.1, force: true });
    scrollToEl(el, { reduced: true });
    expect((el as unknown as { scrollIntoView: ReturnType<typeof vi.fn> }).scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('Lenis só com no-preference + ponteiro fino + fora da versão simples; opções do contrato', () => {
    expect(shouldSmoothScroll({ noMotionPreference: true, finePointer: true, simple: false })).toBe(true);
    expect(shouldSmoothScroll({ noMotionPreference: false, finePointer: true, simple: false })).toBe(false);
    expect(shouldSmoothScroll({ noMotionPreference: true, finePointer: false, simple: false })).toBe(false);
    expect(shouldSmoothScroll({ noMotionPreference: true, finePointer: true, simple: true })).toBe(false);
    expect(LENIS_OPTIONS).toMatchObject({ autoRaf: false, anchors: false });
    expect(LENIS_OPTIONS.lerp).toBeLessThanOrEqual(0.1);
  });

  it('script da versão simples: síncrono, só localStorage, sem rede', () => {
    expect(SIMPLE_MODE_BOOT_SCRIPT).toContain(SIMPLE_KEY);
    expect(SIMPLE_MODE_BOOT_SCRIPT).toContain("setAttribute('data-simple','1')");
    expect(SIMPLE_MODE_BOOT_SCRIPT).not.toMatch(/fetch|https?:|import\(|src=/);
  });

  it('rodapé revelado só quando cabe (< 70 % da janela) e fora de telas pequenas/reduced/simples', () => {
    const base = { footerHeight: 400, viewportHeight: 900, staticMedia: false, reducedMotion: false, simple: false };
    expect(footerRevealOn(base)).toBe(true);
    expect(footerRevealOn({ ...base, footerHeight: 700 })).toBe(false);
    expect(footerRevealOn({ ...base, staticMedia: true })).toBe(false);
    expect(footerRevealOn({ ...base, reducedMotion: true })).toBe(false);
    expect(footerRevealOn({ ...base, simple: true })).toBe(false);
    expect(FOOTER_STATIC_QUERY).toBe('(max-width: 767px), (max-height: 640px)');
  });
});

describe('navegação do shell', () => {
  it('resolvePrimaryNav continua funcionando (de @/lib/nav)', () => {
    expect(resolvePrimaryNav(NAV_FULL)).toEqual([
      { label: 'Entenda', href: '/o-que-e-h1n1/' },
      { label: 'Sintomas e cuidados', href: '/sintomas/' },
      { label: 'Vacina e prevenção', href: '/vacina/' },
      { label: 'Dados do Brasil', href: '/dados/brasil/' },
      { label: 'Sala de dados', href: '/sala/' },
      { label: 'Fontes', href: '/dados/fontes/' },
    ]);
    expect(resolvePrimaryNav(NAV_MIN).map((i) => i.label)).toEqual(['Entenda', 'Dados do Brasil', 'Sala de dados', 'Fontes']);
  });

  it('Menu: ordem por necessidade, Sinais de alerta primeiro, itens sem página somem, sem hrefs repetidos', () => {
    expect(menuDestinations(NAV_FULL).map((d) => d.label)).toEqual([
      'Sinais de alerta',
      'Sintomas e cuidados',
      'Vacina e prevenção',
      'Como se transmite',
      'Entenda o H1N1',
      'Dados do Brasil',
      'Sala de dados',
      'Fontes e metodologia',
    ]);
    const min = menuDestinations(NAV_MIN).map((d) => d.label);
    expect(min).toEqual(['Entenda o H1N1', 'Dados do Brasil', 'Sala de dados', 'Fontes e metodologia']);
    // "Sintomas e cuidados" apontando para a própria lista de alerta não duplica
    const onlyAlert: NavItem[] = [{ label: 'Sintomas e cuidados', href: '/sintomas/sinais-de-alerta/', children: [{ label: 'Sinais', href: '/sintomas/sinais-de-alerta/' }] }, ...NAV_MIN];
    expect(menuDestinations(onlyAlert).filter((d) => d.href === '/sintomas/sinais-de-alerta/').map((d) => d.label)).toEqual(['Sinais de alerta']);
    expect(topShortcuts(NAV_FULL)).toEqual([
      { label: 'Sinais de alerta', href: '/sintomas/sinais-de-alerta/' },
      { label: 'Vacina', href: '/vacina/' },
      { label: 'Dados', href: '/dados/brasil/' },
    ]);
    expect(footerSections(NAV_FULL).map((d) => d.label)).toContain('H1N1 no mundo');
    expect(footerSections(NAV_FULL).map((d) => d.label)).not.toContain('Fontes e metodologia');
  });

  it('conteúdo real: destinos únicos e Sinais de alerta primeiro quando a página é elegível', () => {
    const { nav, institutional } = siteChrome();
    const d = menuDestinations(nav);
    expect(new Set(d.map((x) => x.href)).size).toBe(d.length);
    if (nav.some((n) => n.children.some((c) => c.href === '/sintomas/sinais-de-alerta/'))) expect(d[0]).toEqual({ label: 'Sinais de alerta', href: '/sintomas/sinais-de-alerta/' });
    for (const i of institutionalLinks(institutional)) expect(i.label).not.toContain(':');
  });

  it('shortTitle e isCurrentPath', () => {
    expect(shortTitle('Equipe e revisão: quem faz o H1N1')).toBe('Equipe e revisão');
    expect(shortTitle('Contato')).toBe('Contato');
    expect(isCurrentPath('/sala', '/sala/')).toBe(true);
    expect(isCurrentPath('/', '/')).toBe(true);
    expect(isCurrentPath(null, '/')).toBe(false);
  });
});

describe('componentes do shell (SSR)', () => {
  const TEMPO_REAL = ['tempo', ' real'].join('');

  it('Footer: aviso clínico fixo, nota dos números e nada de imediatismo ou lista de sintomas', () => {
    const html = renderToStaticMarkup(createElement(Footer, { nav: NAV_FULL, institutional: [{ label: 'Equipe e revisão: quem faz', href: '/sobre/equipe-e-revisao/' }] }));
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).toContain('Este conteúdo é educativo e não substitui avaliação médica.');
    expect(text).toContain('Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em /sintomas/sinais-de-alerta/.');
    // fora do Next o next/link não aplica `trailingSlash`: aceita com ou sem a barra final
    expect(html).toMatch(/href="\/sintomas\/sinais-de-alerta\/?"/);
    expect(text).toContain('Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.');
    expect(text.toLowerCase()).not.toContain(TEMPO_REAL);
    expect(text.toLowerCase()).not.toMatch(/falta de ar|febre persistente|dor no peito|lábios arroxeados/);
    expect(html).toContain('id="rodape"');
    expect(html).toContain('Equipe e revisão</a>');
    expect(html).toMatch(/href="\/dados\/mundo\/?"/);
    // texto do rodapé nunca abaixo de 14 px
    expect(html).not.toMatch(/text-(xs|\[1[0-3]px\]|\[\d px\])/);
  });

  it('Menu fechado no SSR: só a pílula "Menu" (sem links duplicados escondidos)', () => {
    const html = renderToStaticMarkup(
      createElement(Menu, { destinations: menuDestinations(NAV_FULL), institutional: [{ label: 'Contato', href: '/contato/' }] }),
    );
    expect(html).toMatch(/^<button[^>]*>Menu<\/button>$/);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toMatch(/aria-controls="menu-[\w-]+"/);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<dialog');
  });

  it('ProgressRail: nav "Atos", links reais, numeral decorativo e nome "Ato N de T: rótulo"', () => {
    const acts = [
      { id: 'ato-01', index: '01', label: 'O que é' },
      { id: 'ato-02', index: '02', label: 'Por dentro' },
      { id: 'ato-03', index: '03', label: 'Como entra' },
    ];
    expect(actAccessibleName(acts[0]!, 1, 7)).toBe('Ato 1 de 7: O que é');
    expect(actNumeral(acts[2]!)).toBe('( 03 )');
    const html = renderToStaticMarkup(createElement(ProgressRail, { acts }));
    expect(html).toContain('<nav aria-label="Atos"');
    expect(html).toContain('href="#ato-01"');
    expect(html).toContain('aria-label="Ato 3 de 3: Como entra"');
    expect(html).toContain('<span aria-hidden="true" class="tabular-nums">( 01 )</span>');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('aria-current="step"');
    expect(html).toMatch(/<dialog[^>]*aria-label="Atos"/);
    expect(html).not.toMatch(/<dialog[^>]*\sopen/);
    expect(renderToStaticMarkup(createElement(ProgressRail, { acts: [] }))).toBe('');
  });

  it('actsProgress: 0 antes do primeiro ato, 1 depois do último', () => {
    expect(actsProgress(500, 1500, 400)).toBe(0);
    expect(actsProgress(0, 1000, 500)).toBeCloseTo(0.5);
    expect(actsProgress(-2000, -100, 400)).toBe(1);
    expect(actsProgress(0, 0, 0)).toBe(0);
  });

  it('Brand: link para a home com nome acessível que contém o texto visível', () => {
    const html = renderToStaticMarkup(createElement(Brand));
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="H1N1, informação clara, dados oficiais: página inicial"');
    expect(html).toContain('font-condensed');
    expect(html).toContain('md:inline');
  });

  it('layout: sem Header, page-root envolve main e rodapé, main sem max-w/padding e html com suppressHydrationWarning', () => {
    const src = readFileSync(path.join(WEB, 'src/app/layout.tsx'), 'utf8');
    expect(src).not.toMatch(/components\/Header/);
    expect(src).toContain('suppressHydrationWarning');
    expect(src).toMatch(/<div id="page-root"/);
    const main = src.match(/<main id=[^>]*>/)?.[0] ?? '';
    expect(main).toContain('id="conteudo"');
    expect(main).toContain('bg-bg');
    expect(main).not.toMatch(/max-w|px-\d|py-\d/);
    expect(src.indexOf('<SmoothScroll />')).toBeLessThan(src.indexOf('{children}'));
    expect(src.indexOf('</main>')).toBeLessThan(src.indexOf('<Footer'));
  });
});
