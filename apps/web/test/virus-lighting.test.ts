import { describe, expect, it } from 'vitest';
import { THEME_BG, type ThemeRGB } from '@/lib/motion/theme';
import {
  ENV_REBAKE_DELTA,
  ENV_REBAKE_INTERVAL,
  contrastRatio,
  createStageLook,
  lightnessFromLuminance,
  nightFromLightness,
  rgbDistance,
  shouldRebakeEnv,
  stageLook,
  warmthOf,
  type Rgb,
  type StageLook,
} from '@/lib/virus/lighting';

const PAPER = THEME_BG.paper;
const DEEP = THEME_BG.deep;
const WARM = THEME_BG.warm;

/** Interpolação sRGB igual à do shell (gsap.utils.interpolate em 0–255). */
function lerpRgb(a: ThemeRGB, b: ThemeRGB, t: number): ThemeRGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

const COLOR_KEYS = ['background', 'backdrop', 'keyColor', 'skyColor', 'groundColor', 'rimColor', 'fresnelColor', 'shadowColor', 'guideColor'] as const;
const NUMBER_KEYS = ['luminance', 'lightness', 'night', 'warmth', 'envIntensity', 'keyIntensity', 'fillIntensity', 'rimIntensity', 'fresnel', 'lift', 'shadowOpacity', 'guideOpacity'] as const;

/** Problemas de sanidade (lista vazia = ok): números finitos, cores em [0, 1], intensidades contidas (`flat`). */
function insane(l: StageLook): string[] {
  const out: string[] = [];
  for (const k of NUMBER_KEYS) if (!Number.isFinite(l[k])) out.push(`${k} não finito`);
  for (const k of COLOR_KEYS) {
    const c: Rgb = l[k];
    for (const ch of [c.r, c.g, c.b]) if (!(ch >= 0 && ch <= 1)) out.push(`${k} fora de [0, 1]`);
  }
  if (!(l.envIntensity <= 2.5 && l.keyIntensity <= 2.5 && l.rimIntensity <= 2.5)) out.push('intensidade > 2,5');
  if (!(l.night >= 0 && l.night <= 1)) out.push('night fora de [0, 1]');
  if (!(l.lift >= 0 && l.lift <= 0.2 + 1e-12)) out.push('lift fora de [0, 0,2]');
  return out;
}

function expectSane(l: StageLook): void {
  expect(insane(l)).toEqual([]);
}

describe('luz do palco por tema (lib/virus/lighting, função pura)', () => {
  it('papel e creme são "dia", azul profundo é "noite"; creme é quente; tinta segue o limiar do shell', () => {
    const p = stageLook(PAPER);
    const d = stageLook(DEEP);
    const w = stageLook(WARM);
    expect(p.night).toBe(0);
    expect(w.night).toBe(0);
    expect(d.night).toBe(1);
    expect(p.warmth).toBe(0);
    expect(w.warmth).toBeGreaterThan(0.9);
    expect(d.warmth).toBe(0);
    expect(p.ink).toBe('dark');
    expect(w.ink).toBe('dark');
    expect(d.ink).toBe('light');
    for (const l of [p, d, w]) expectSane(l);
    // fundo devolvido = cor do tema em 0–1
    expect(p.background.r).toBeCloseTo(244 / 255, 9);
    expect(d.background.b).toBeCloseTo(46 / 255, 9);
  });

  it('no escuro: recorte mais forte, albedo clareado, sombra desligada e ambiente mais baixo (sem emissão)', () => {
    const p = stageLook(PAPER);
    const d = stageLook(DEEP);
    expect(d.rimIntensity).toBeGreaterThan(p.rimIntensity * 2);
    expect(d.lift).toBeGreaterThan(0.15);
    expect(p.lift).toBe(0);
    expect(d.shadowOpacity).toBe(0);
    expect(p.shadowOpacity).toBeGreaterThan(0.1);
    expect(d.envIntensity).toBeLessThan(p.envIntensity);
    expect(d.fresnel).toBeGreaterThan(p.fresnel);
  });

  it('cores derivadas do tema: estúdio a partir do papel, sombra mais escura que o fundo e no mesmo matiz', () => {
    const p = stageLook(PAPER);
    // "céu" do estúdio = papel clareado (mais claro que o fundo, ainda quente: R ≥ B)
    expect(p.backdrop.r).toBeGreaterThan(p.background.r);
    expect(p.backdrop.r).toBeGreaterThanOrEqual(p.backdrop.b);
    // sem o azul frio antigo (#eef1f7): o estúdio do papel não é mais azul que vermelho
    expect(p.backdrop.b - p.backdrop.r).toBeLessThanOrEqual(0);
    for (const bg of [PAPER, WARM]) {
      const l = stageLook(bg);
      expect(contrastRatio(l.shadowColor, l.background)).toBeGreaterThan(3);
      // matiz preservado: sombra quente sobre papel/creme
      expect(l.shadowColor.r).toBeGreaterThanOrEqual(l.shadowColor.b);
    }
    const d = stageLook(DEEP);
    // no escuro o estúdio é ardósia escura (reflexos coerentes com o fundo)
    expect(d.backdrop.r + d.backdrop.g + d.backdrop.b).toBeLessThan(1.2);
  });

  it('linha-guia dos rótulos com contraste ≥ 3:1 sobre o fundo nos três temas', () => {
    for (const bg of [PAPER, DEEP, WARM]) {
      const l = stageLook(bg);
      expect(contrastRatio(l.guideColor, l.background), JSON.stringify(bg)).toBeGreaterThanOrEqual(3);
    }
    // no papel é exatamente o token line-strong (#8a8475)
    const p = stageLook(PAPER);
    expect(Math.round(p.guideColor.r * 255)).toBe(0x8a);
    expect(Math.round(p.guideColor.g * 255)).toBe(0x84);
    expect(Math.round(p.guideColor.b * 255)).toBe(0x75);
  });

  it('contínua e monótona durante a interpolação papel → azul profundo (nada "estala")', () => {
    const problems: string[] = [];
    let prev = stageLook(PAPER);
    for (let i = 1; i <= 200; i++) {
      const t = i / 200;
      const l = stageLook(lerpRgb(PAPER, DEEP, t));
      problems.push(...insane(l).map((m) => `${t}: ${m}`));
      if (l.night < prev.night - 1e-12) problems.push(`${t}: night caiu`);
      if (l.rimIntensity < prev.rimIntensity - 1e-12) problems.push(`${t}: rim caiu`);
      if (l.shadowOpacity > prev.shadowOpacity + 1e-12) problems.push(`${t}: sombra subiu`);
      // passos de 0,5 % da transição → mudanças pequenas em tudo que vai para a GPU
      if (!(Math.abs(l.rimIntensity - prev.rimIntensity) < 0.05)) problems.push(`${t}: salto no rim`);
      if (!(Math.abs(l.envIntensity - prev.envIntensity) < 0.02)) problems.push(`${t}: salto no ambiente`);
      if (!(rgbDistance(l.backdrop, prev.backdrop) < 0.03)) problems.push(`${t}: salto no estúdio`);
      if (!(rgbDistance(l.keyColor, prev.keyColor) < 0.02)) problems.push(`${t}: salto na key`);
      prev = l;
    }
    // papel → creme: continua "dia", esquenta aos poucos
    let w = 0;
    for (let i = 0; i <= 50; i++) {
      const l = stageLook(lerpRgb(PAPER, WARM, i / 50));
      if (l.night !== 0) problems.push(`creme ${i}: night ${l.night}`);
      if (l.warmth < w - 1e-12) problems.push(`creme ${i}: calor caiu`);
      w = l.warmth;
    }
    expect(problems).toEqual([]);
  });

  it('reaproveita o objeto de saída (zero alocação por quadro) e tolera entradas inválidas', () => {
    const out = createStageLook();
    const a = stageLook(PAPER, out);
    expect(a).toBe(out);
    const b = stageLook(DEEP, out);
    expect(b).toBe(out);
    expect(out.night).toBe(1);
    const bad = stageLook({ r: Number.NaN, g: Infinity, b: -40 });
    expectSane(bad);
    expect(warmthOf({ r: Number.NaN, g: 0, b: 0 })).toBe(0);
    expect(nightFromLightness(Number.NaN)).toBe(0);
    expect(lightnessFromLuminance(1)).toBeCloseTo(100, 6);
    expect(lightnessFromLuminance(0)).toBeCloseTo(0, 6);
  });

  it('ambiente refeito sob demanda: limiar + intervalo durante a transição e um último quadro ao assentar', () => {
    const iv = ENV_REBAKE_INTERVAL.high;
    // sem mudança relevante: nunca refaz
    expect(shouldRebakeEnv(0, 10, 10, iv)).toBe(false);
    expect(shouldRebakeEnv(0.003, 10, 10, iv)).toBe(false);
    // mudança grande, mas cedo demais desde o último: espera
    expect(shouldRebakeEnv(ENV_REBAKE_DELTA * 2, iv / 2, 0, iv)).toBe(false);
    expect(shouldRebakeEnv(ENV_REBAKE_DELTA * 2, iv, 0, iv)).toBe(true);
    // mudança pequena ainda em curso: espera; quando o tema assenta, refaz
    expect(shouldRebakeEnv(0.01, 1, 0.05, iv)).toBe(false);
    expect(shouldRebakeEnv(0.01, 1, 0.3, iv)).toBe(true);
    expect(ENV_REBAKE_INTERVAL.low).toBeGreaterThan(ENV_REBAKE_INTERVAL.high);
    // uma transição completa papel → azul profundo em 0,7 s a 60 fps refaz poucas vezes (custo controlado)
    const bake = { at: -Infinity, color: stageLook(PAPER).backdrop };
    let lastColor = bake.color;
    let changedAt = 0;
    let bakes = 0;
    for (let f = 0; f <= 90; f++) {
      const t = f / 60;
      const k = Math.min(1, t / 0.7);
      const c = stageLook(lerpRgb(PAPER, DEEP, k)).backdrop;
      if (rgbDistance(c, lastColor) > 1e-4) changedAt = t;
      lastColor = c;
      if (shouldRebakeEnv(rgbDistance(c, bake.color), t - bake.at, t - changedAt, iv)) {
        bake.at = t;
        bake.color = c;
        bakes++;
      }
    }
    expect(bakes).toBeGreaterThanOrEqual(2);
    expect(bakes).toBeLessThanOrEqual(8);
    // terminou na cor final
    expect(rgbDistance(bake.color, stageLook(DEEP).backdrop)).toBeLessThanOrEqual(0.004);
  });
});
