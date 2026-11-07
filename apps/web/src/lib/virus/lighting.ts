/**
 * Luz e materiais do palco 3D por tema (v4 · frente C). Função PURA, sem three: a partir da cor VIVA do fundo
 * (`ThemeRGB`, sRGB 0–255, lida por quadro de `getLiveTheme()`) devolve intensidades e cores (sRGB 0–1) para o
 * ambiente, as luzes diretas, o realce fresnel do envelope, a sombra de contato e as linhas-guia dos rótulos.
 *
 * Regras (docs/reformulacao-v4.md §6): sem glow/emissive. Legibilidade no tema `deep` vem de luz de recorte
 * (rim) mais forte, ambiente mais escuro e um leve clareamento de ALBEDO das peças (`lift`), nunca de emissão.
 * Tudo varia de forma CONTÍNUA com o fundo (o shell interpola o tema em ~0,7 s): nada "estala" na troca.
 * Testado em test/virus-lighting.test.ts.
 */
import { inkFor, relativeLuminance, type ThemeRGB } from '@/lib/motion/theme';

/** Cor sRGB em 0–1 (o palco converte para o espaço linear com `THREE.SRGBColorSpace`). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface StageLook {
  /** luminância relativa (WCAG) do fundo */
  luminance: number;
  /** claridade perceptual CIE L* (0–100) do fundo */
  lightness: number;
  /** 0 = papel/creme claro … 1 = azul profundo; contínuo durante a interpolação do tema */
  night: number;
  /** 0 = neutro … 1 = creme quente (tema `warm`, "esperança") */
  warmth: number;
  /** tinta do DOM sobre esse fundo (mesma regra do shell: limiar 0,18) */
  ink: 'light' | 'dark';
  /** fundo em 0–1 (o mesmo do `scene.background`) */
  background: Rgb;
  /** intensidade do mapa de ambiente (`scene.environmentIntensity`; com `flat` manter ≤ 2,5) */
  envIntensity: number;
  /** cor do "céu" do estúdio procedural (esfera de fundo do ambiente), derivada do fundo do tema */
  backdrop: Rgb;
  keyIntensity: number;
  keyColor: Rgb;
  /** hemisférica: céu (de cima) e chão (rebatimento do próprio fundo) */
  fillIntensity: number;
  skyColor: Rgb;
  groundColor: Rgb;
  /** luz de recorte (direcional por trás): separa a silhueta do fundo, sobretudo no escuro */
  rimIntensity: number;
  rimColor: Rgb;
  /** realce fresnel do envelope como mistura de ALBEDO (iluminado, não emissivo) */
  fresnel: number;
  fresnelColor: Rgb;
  /** clareamento de albedo das peças coloridas (HA, NA, RNPs) para leitura no escuro, 0–0,2 */
  lift: number;
  /** sombra de contato (blob estático): cor compatível com o fundo; desligada no escuro */
  shadowColor: Rgb;
  shadowOpacity: number;
  /** linha-guia dos rótulos (peça → cartão): ≥ 3:1 sobre o fundo em qualquer tema */
  guideColor: Rgb;
  guideOpacity: number;
}

const rgb = (r: number, g: number, b: number): Rgb => ({ r, g, b });

/** Tokens (sRGB 0–1) usados como extremos das misturas. */
const WHITE = rgb(1, 1, 1);
/** line-strong do papel (#8a8475): borda ≥ 3:1 sobre papel e creme */
const GUIDE_LIGHT_THEME = rgb(0x8a / 255, 0x84 / 255, 0x75 / 255);
/** muted do tema deep (#c9d2e3) */
const GUIDE_DEEP = rgb(0xc9 / 255, 0xd2 / 255, 0xe3 / 255);
/** borda fria do envelope no claro (contorno definido sobre papel) e clara no escuro (recorte) */
const FRESNEL_LIGHT_THEME = rgb(0.68, 0.75, 0.9);
const FRESNEL_DEEP = rgb(0.84, 0.9, 1);
const COOL = rgb(0.84, 0.89, 1);
const WARM = rgb(1, 0.94, 0.86);

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function mixInto(out: Rgb, a: Rgb, b: Rgb, t: number): Rgb {
  out.r = clamp01(lerp(a.r, b.r, t));
  out.g = clamp01(lerp(a.g, b.g, t));
  out.b = clamp01(lerp(a.b, b.b, t));
  return out;
}

/** Claridade CIE L* (0–100) a partir da luminância relativa. */
export function lightnessFromLuminance(y: number): number {
  const v = Number.isFinite(y) ? Math.max(0, y) : 0;
  const f = v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116;
  return 116 * f - 16;
}

/** "Noite" do palco a partir de L*: 0 acima de L* 80 (papel, creme), 1 abaixo de L* 12 (azul profundo). */
export function nightFromLightness(l: number): number {
  return 1 - smoothstep(12, 80, Number.isFinite(l) ? l : 100);
}

/** Calor do fundo: (R − B) acima do do papel; papel = 0, creme quente ≈ 1. */
export function warmthOf(bg: Readonly<ThemeRGB>): number {
  const w = ((bg.r - bg.b) / 255 - 0.045) / 0.085;
  return Number.isFinite(w) ? clamp01(w) : 0;
}

function safe(c: number): number {
  return Number.isFinite(c) ? Math.min(255, Math.max(0, c)) : 0;
}

/** Aloca um `StageLook` (use uma vez e reaproveite com `stageLook(bg, out)` a cada quadro). */
export function createStageLook(): StageLook {
  return {
    luminance: 0,
    lightness: 0,
    night: 0,
    warmth: 0,
    ink: 'dark',
    background: rgb(0, 0, 0),
    envIntensity: 0,
    backdrop: rgb(0, 0, 0),
    keyIntensity: 0,
    keyColor: rgb(0, 0, 0),
    fillIntensity: 0,
    skyColor: rgb(0, 0, 0),
    groundColor: rgb(0, 0, 0),
    rimIntensity: 0,
    rimColor: rgb(0, 0, 0),
    fresnel: 0,
    fresnelColor: rgb(0, 0, 0),
    lift: 0,
    shadowColor: rgb(0, 0, 0),
    shadowOpacity: 0,
    guideColor: rgb(0, 0, 0),
    guideOpacity: 0,
  };
}

/**
 * Luz do palco para um fundo. Sem alocação quando `out` é passado (chamado por quadro).
 * paper (#f4f1ea) e warm (#f7e8d5): estúdio claro, sombra de contato suave, contorno frio do envelope.
 * deep (#0b1a2e): ambiente escurecido, key um pouco mais forte, recorte frio forte, albedo das peças
 * levemente clareado, sombra desligada (escuro sobre escuro não lê), linhas-guia claras.
 */
export function stageLook(bgIn: Readonly<ThemeRGB>, out: StageLook = createStageLook()): StageLook {
  const bg = { r: safe(bgIn.r), g: safe(bgIn.g), b: safe(bgIn.b) };
  const lum = relativeLuminance(bg);
  const l = lightnessFromLuminance(lum);
  const night = nightFromLightness(l);
  const warmth = warmthOf(bg) * (1 - night);
  out.luminance = lum;
  out.lightness = l;
  out.night = night;
  out.warmth = warmth;
  out.ink = inkFor(bg);
  out.background.r = bg.r / 255;
  out.background.g = bg.g / 255;
  out.background.b = bg.b / 255;

  // ambiente: estúdio derivado do próprio fundo (papel clareado; no escuro, ardósia escura)
  out.envIntensity = lerp(0.9, 0.62, night);
  mixInto(out.backdrop, out.background, WHITE, lerp(0.5, 0.2, night));

  // key: branca no papel, levemente quente no creme, levemente fria no escuro
  out.keyIntensity = lerp(1.4, 1.6, night);
  mixInto(out.keyColor, WHITE, WARM, 0.45 * warmth);
  if (night > 0) mixInto(out.keyColor, out.keyColor, COOL, 0.35 * night);

  // hemisférica: céu claro (frio no escuro), chão = rebatimento do fundo
  out.fillIntensity = lerp(0.35, 0.5, night);
  mixInto(out.skyColor, WHITE, COOL, 0.25 + 0.5 * night);
  if (warmth > 0) mixInto(out.skyColor, out.skyColor, WARM, 0.5 * warmth);
  mixInto(out.groundColor, out.background, WHITE, lerp(0.35, 0.14, night));

  // recorte: discreto no claro, forte no escuro (é o que separa o vírion do azul profundo)
  out.rimIntensity = lerp(0.35, 1.35, night);
  mixInto(out.rimColor, COOL, WARM, 0.6 * warmth);

  // contorno fresnel do envelope (albedo): frio e médio no claro, claro no escuro
  out.fresnel = lerp(0.22, 0.36, night);
  mixInto(out.fresnelColor, FRESNEL_LIGHT_THEME, FRESNEL_DEEP, night);

  out.lift = 0.2 * night;

  // sombra: o próprio fundo escurecido (quente no creme); some antes de o fundo ficar escuro
  mixInto(out.shadowColor, out.background, rgb(0, 0, 0), 0.72);
  out.shadowOpacity = 0.18 * (1 - smoothstep(0.05, 0.55, night));

  mixInto(out.guideColor, GUIDE_LIGHT_THEME, GUIDE_DEEP, smoothstep(0.35, 0.65, night));
  out.guideOpacity = 0.9;
  return out;
}

/** Razão de contraste WCAG entre duas cores sRGB 0–1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance({ r: a.r * 255, g: a.g * 255, b: a.b * 255 });
  const lb = relativeLuminance({ r: b.r * 255, g: b.g * 255, b: b.b * 255 });
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Maior diferença por canal (0–1) entre duas cores: decide quando refazer o mapa de ambiente. */
export function rgbDistance(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

/** Diferença mínima da cor do estúdio para refazer o ambiente durante a transição de tema. */
export const ENV_REBAKE_DELTA = 0.03;
/** Intervalo mínimo (s) entre dois refazimentos do ambiente, por qualidade. */
export const ENV_REBAKE_INTERVAL = { high: 0.12, low: 0.3 } as const;

/**
 * Decide se o mapa de ambiente deve ser refeito: mudou o bastante e já passou o intervalo, OU mudou pouco mas o
 * tema assentou (sem mudança por `settle` s) — o último quadro da transição sempre é refeito.
 */
export function shouldRebakeEnv(delta: number, sinceBake: number, sinceChange: number, interval: number, settle = 0.25): boolean {
  if (!(delta > 0.004)) return false;
  if (delta >= ENV_REBAKE_DELTA && sinceBake >= interval) return true;
  return sinceChange >= settle && sinceBake >= interval;
}
