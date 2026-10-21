import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadFacts } from '@/lib/content';
import { CHAPTERS, CHAPTER_COUNT, SCENE_KEYS, chapterFromProgress, progressFromLayout, sceneState, sceneStateFromProgress } from '@/lib/virus/chapters';
import { CHAPTER_COPY, HOME_FACT_IDS, allFreeText, copyForChapter } from '@/lib/virus/copy';
import { distance, fibonacciSphere, helixPoints, length, seededRandom, smoothstep } from '@/lib/virus/geometry';
import { PART_BY_ID, VIRUS_PARTS, nextPart } from '@/lib/virus/parts';

describe('fibonacciSphere', () => {
  it('gera n pontos únicos na esfera unitária, razoavelmente espaçados', () => {
    for (const n of [1, 8, 16, 50, 90]) {
      const pts = fibonacciSphere(n);
      expect(pts).toHaveLength(n);
      for (const p of pts) expect(Math.abs(length(p) - 1)).toBeLessThan(1e-9);
      const keys = new Set(pts.map((p) => `${p.x.toFixed(9)},${p.y.toFixed(9)},${p.z.toFixed(9)}`));
      expect(keys.size).toBe(n);
      let min = Infinity;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, distance(pts[i]!, pts[j]!));
      // distância mínima esperada para distribuição quase uniforme: ~ 3,2/sqrt(n) com folga
      if (n > 1) expect(min).toBeGreaterThan(2 / Math.sqrt(n));
    }
    expect(fibonacciSphere(0)).toEqual([]);
    expect(() => fibonacciSphere(-1)).toThrow();
  });

  it('é determinística', () => {
    expect(fibonacciSphere(30)).toEqual(fibonacciSphere(30));
    const r1 = seededRandom(3);
    const r2 = seededRandom(3);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it('helixPoints respeita altura e raio', () => {
    const pts = helixPoints(3, 0.1, 2, 20);
    expect(pts).toHaveLength(20);
    expect(pts[0]!.y).toBeCloseTo(-1);
    expect(pts[19]!.y).toBeCloseTo(1);
    for (const p of pts) expect(Math.hypot(p.x, p.z)).toBeCloseTo(0.1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});

describe('capítulos: rolagem → capítulo/explode', () => {
  it('chapterFromProgress mapeia e satura nas bordas', () => {
    expect(chapterFromProgress(0)).toEqual({ index: 0, local: 0 });
    expect(chapterFromProgress(-3)).toEqual({ index: 0, local: 0 });
    expect(chapterFromProgress(1.5)).toEqual({ index: 1, local: 0.5 });
    expect(chapterFromProgress(4.25).index).toBe(4);
    expect(chapterFromProgress(CHAPTER_COUNT)).toEqual({ index: CHAPTER_COUNT - 1, local: 1 });
    expect(chapterFromProgress(Number.NaN)).toEqual({ index: 0, local: 0 });
  });

  it('explode: inteiro no capítulo 1, aberto no 2, fechado de novo no 3', () => {
    expect(sceneStateFromProgress(0).explode).toBe(0);
    expect(sceneStateFromProgress(0.9).explode).toBe(0);
    expect(sceneStateFromProgress(1.5).explode).toBe(1);
    expect(sceneStateFromProgress(1.5).labels).toBe(1);
    expect(sceneStateFromProgress(2.6).explode).toBe(0);
    expect(sceneStateFromProgress(2.9).approach).toBe(1);
    expect(sceneStateFromProgress(3.95).droplets).toBe(1);
    expect(sceneStateFromProgress(4.95).antibodies).toBe(1);
    expect(sceneStateFromProgress(4.95).people).toBe(0);
  });

  it('todos os campos normalizados ficam em [0, 1] e a cena é contínua ao longo da rolagem', () => {
    const unit = ['explode', 'spin', 'labels', 'cell', 'approach', 'people', 'droplets', 'antibodies'] as const;
    let prev = sceneStateFromProgress(0);
    for (let p = 0; p <= CHAPTER_COUNT; p += 0.005) {
      const s = sceneStateFromProgress(p);
      for (const k of unit) {
        expect(s[k], `${k} em ${p}`).toBeGreaterThanOrEqual(0);
        expect(s[k], `${k} em ${p}`).toBeLessThanOrEqual(1);
      }
      for (const k of SCENE_KEYS) expect(Math.abs(s[k] - prev[k]), `salto em ${k} perto de ${p.toFixed(3)}`).toBeLessThan(0.2);
      prev = s;
    }
    expect(sceneState(99, 0.5)).toBeDefined();
  });

  it('progressFromLayout: antes do primeiro capítulo é 0; dentro, índice + fração; depois, satura', () => {
    const tops = [1000, 2000, 3000];
    const heights = [1000, 1000, 1000];
    expect(progressFromLayout(0, tops, heights)).toBe(0);
    expect(progressFromLayout(1000, tops, heights)).toBe(0);
    expect(progressFromLayout(1500, tops, heights)).toBeCloseTo(0.5);
    expect(progressFromLayout(2250, tops, heights)).toBeCloseTo(1.25);
    expect(progressFromLayout(3999, tops, heights)).toBeCloseTo(2.999);
    expect(progressFromLayout(9000, tops, heights)).toBeLessThan(3);
    expect(progressFromLayout(9000, tops, heights)).toBeGreaterThan(2.99);
    expect(progressFromLayout(5, [], [])).toBe(0);
  });

  it('cada capítulo 3D tem texto e âncora única', () => {
    expect(CHAPTERS).toHaveLength(5);
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(5);
    expect(CHAPTER_COPY.map((c) => c.id)).toEqual(CHAPTERS.map((c) => c.id));
    for (const c of CHAPTERS) expect(copyForChapter(c.id).lead.length).toBeGreaterThan(20);
    expect(() => copyForChapter('nao-existe')).toThrow();
    expect(CHAPTERS.some((c) => c.id === 'por-dentro')).toBe(true); // alvo do botão "Explorar o vírus"
  });
});

describe('peças e fatos', () => {
  const facts = loadFacts();

  it('todo fato referenciado na home (capítulos e peças) existe em content/facts.json', () => {
    expect(HOME_FACT_IDS.length).toBeGreaterThan(5);
    for (const id of HOME_FACT_IDS) expect(facts.has(id), `fato '${id}' ausente`).toBe(true);
    for (const p of VIRUS_PARTS) {
      expect(p.factIds.length).toBeGreaterThan(0);
      for (const id of p.factIds) expect(facts.has(id), `${p.id}: fato '${id}' ausente`).toBe(true);
    }
    for (const c of CHAPTER_COPY) for (const id of c.factIds) expect(facts.has(id), `${c.id}: fato '${id}' ausente`).toBe(true);
  });

  it('fatos novos de virologia têm fonte, citação e verificação datada', () => {
    const ids = ['ms-subtipos-influenza-a-hemaglutinina-e-neuraminidase', 'krammer-2018-hemaglutinina-entrada-neuraminidase-saida', 'krammer-2018-neuraminidase-libera-novos-virus', 'krammer-2018-genoma-oito-segmentos-rna', 'krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2', 'krammer-2018-ha-e-na-alvos-principais-dos-anticorpos', 'nomenclatura-ah1n1pdm09'];
    for (const id of ids) {
      const f = facts.get(id);
      expect(f, id).toBeDefined();
      expect(f!.source_url).toMatch(/^https:\/\//);
      expect(f!.quote && f!.quote.length > 20).toBe(true);
      expect(f!.verified_by).toContain('Redação H1N1');
    }
  });

  it('as seis peças são únicas, com 2 a 5 frases, e a navegação circular funciona', () => {
    expect(VIRUS_PARTS).toHaveLength(6);
    expect(new Set(VIRUS_PARTS.map((p) => p.id)).size).toBe(6);
    for (const p of VIRUS_PARTS) {
      expect(p.explanation.length).toBeGreaterThanOrEqual(2);
      expect(p.explanation.length).toBeLessThanOrEqual(5);
      expect(PART_BY_ID.get(p.id)).toBe(p);
    }
    expect(nextPart('ha', 1)).toBe('na');
    expect(nextPart('ha', -1)).toBe('m2');
    expect(PART_BY_ID.get('ha')!.label).toContain('Hemaglutinina');
    expect(PART_BY_ID.get('na')!.label).toContain('Neuraminidase');
    expect(PART_BY_ID.get('rna')!.label).toContain('8 segmentos');
    expect(PART_BY_ID.get('envelope')!.label).toContain('Envelope');
  });

  it('texto livre não traz números soltos de dias, horas, semanas ou percentuais (ficam só nos <Fato>)', () => {
    const re = /\d+\s*(%|por cento|dias?|horas?|h\b|semanas?|meses|mês|anos?)\b/i;
    for (const t of allFreeText()) expect(t, t).not.toMatch(re);
    for (const t of allFreeText()) expect(t.toLowerCase(), t).not.toContain('tempo real');
  });

  it('pôster SVG existe com as cores dos tokens', () => {
    const file = path.join(process.cwd(), 'public', 'virus', 'poster.svg');
    expect(existsSync(file)).toBe(true);
    const svg = readFileSync(file, 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('#2451d6');
    expect(svg).toContain('#d6007f');
    expect(svg).toContain('<title');
  });
});
