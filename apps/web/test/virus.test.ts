import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadFacts } from '@/lib/content';
import { CHAPTERS, progressFromLayout } from '@/lib/virus/chapters';
import { BEATS, CHAPTER_COUNT, MOUTH_LEFT, MOUTH_RIGHT, POSES, START, STEPS_PER_CHAPTER, ambient, chapterFromProgress, fitDistance, progressFromSteps, sceneAt, settledProgress } from '@/lib/virus/choreography';
import { dampTo, expDamp } from '@/lib/virus/damping';
import { BOUNDS, REST, SCENE_KEYS, UNIT_KEYS } from '@/lib/virus/scenestate';
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

describe('coreografia: rolagem → estado da cena (função pura)', () => {
  it('chapterFromProgress mapeia e satura nas bordas', () => {
    expect(chapterFromProgress(0)).toEqual({ index: 0, local: 0 });
    expect(chapterFromProgress(-3)).toEqual({ index: 0, local: 0 });
    expect(chapterFromProgress(1.5)).toEqual({ index: 1, local: 0.5 });
    expect(chapterFromProgress(4.25).index).toBe(4);
    expect(chapterFromProgress(CHAPTER_COUNT)).toEqual({ index: CHAPTER_COUNT - 1, local: 1 });
    expect(chapterFromProgress(Number.NaN)).toEqual({ index: 0, local: 0 });
  });

  it('poses e batidas cobrem todas as chaves; toda chave que muda tem batida explícita e keyframes casam com as poses', () => {
    expect(POSES).toHaveLength(CHAPTER_COUNT);
    expect(BEATS).toHaveLength(CHAPTER_COUNT);
    expect(STEPS_PER_CHAPTER).toHaveLength(CHAPTER_COUNT);
    expect(Object.keys(REST).sort()).toEqual([...SCENE_KEYS].sort());
    for (let i = 0; i < CHAPTER_COUNT; i++) {
      const prev = i === 0 ? START : POSES[i - 1]!;
      const next = POSES[i]!;
      const beats = BEATS[i]!;
      for (const k of SCENE_KEYS) {
        expect(Object.keys(next)).toContain(k);
        const b = beats[k];
        if (prev[k] !== next[k]) expect(b, `cap ${i + 1}: '${k}' muda (${prev[k]} → ${next[k]}) sem batida explícita`).toBeDefined();
        if (!b) continue;
        if ('w' in b) {
          expect(b.w[0]).toBeGreaterThanOrEqual(0);
          expect(b.w[1]).toBeLessThanOrEqual(1);
          expect(b.w[1]).toBeGreaterThan(b.w[0]);
        } else {
          expect(b.k.length).toBeGreaterThanOrEqual(2);
          expect(b.k[0]![1], `cap ${i + 1}: 1.º keyframe de '${k}' ≠ pose anterior`).toBeCloseTo(prev[k], 9);
          expect(b.k[b.k.length - 1]![1], `cap ${i + 1}: último keyframe de '${k}' ≠ pose do capítulo`).toBeCloseTo(next[k], 9);
          for (let j = 1; j < b.k.length; j++) expect(b.k[j]![0]).toBeGreaterThanOrEqual(b.k[j - 1]![0]);
          expect(b.k[0]![0]).toBeGreaterThanOrEqual(0);
          expect(b.k[b.k.length - 1]![0]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('junções: o fim de cada capítulo é exatamente a pose assentada e o início do seguinte', () => {
    for (let i = 0; i < CHAPTER_COUNT; i++) {
      const settled = sceneAt(settledProgress(i));
      for (const k of SCENE_KEYS) expect(settled[k], `cap ${i + 1} '${k}'`).toBeCloseTo(POSES[i]![k], 6);
      if (i + 1 < CHAPTER_COUNT) {
        const startNext = sceneAt(i + 1);
        for (const k of SCENE_KEYS) expect(startNext[k], `início cap ${i + 2} '${k}'`).toBeCloseTo(POSES[i]![k], 9);
      }
    }
    const s0 = sceneAt(0);
    for (const k of SCENE_KEYS) expect(s0[k]).toBeCloseTo(START[k], 9);
  });

  it('limites por chave e continuidade (Lipschitz) ao longo de toda a rolagem', () => {
    const dp = 0.002;
    let prev = sceneAt(0);
    for (let p = dp; p <= CHAPTER_COUNT + 0.01; p += dp) {
      const s = sceneAt(p);
      for (const k of SCENE_KEYS) {
        const [lo, hi] = BOUNDS[k];
        expect(s[k], `${k} em ${p.toFixed(3)} fora de [${lo}, ${hi}]`).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(s[k], `${k} em ${p.toFixed(3)}`).toBeLessThanOrEqual(hi + 1e-9);
        if (UNIT_KEYS.includes(k)) {
          expect(s[k]).toBeGreaterThanOrEqual(-1e-9);
          expect(s[k]).toBeLessThanOrEqual(1 + 1e-9);
        }
        // nenhuma chave salta mais que ~8% do seu intervalo por passo de 0,002 (transições de ≥ 0,05 de largura)
        const span = hi - lo;
        expect(Math.abs(s[k] - prev[k]), `salto em '${k}' perto de ${p.toFixed(3)}`).toBeLessThan(span * 0.08);
      }
      prev = s;
    }
    expect(sceneAt(99)).toBeDefined();
    expect(sceneAt(Number.NaN)).toEqual(sceneAt(0));
  });

  it('batidas-chave acontecem onde o texto está: assentadas antes do fim do passo correspondente', () => {
    // cap. 2: desmontagem escalonada na ordem envelope → espinhos → M1 → RNPs → rótulos
    expect(sceneAt(1.12).openEnv).toBeCloseTo(1, 3);
    expect(sceneAt(1.12).openSpikes).toBeCloseTo(0, 3);
    expect(sceneAt(1.33).openSpikes).toBeCloseTo(1, 3);
    expect(sceneAt(1.33).openM1).toBeCloseTo(0, 3);
    expect(sceneAt(1.52).openM1).toBeCloseTo(1, 3);
    expect(sceneAt(1.75).openRnp).toBeCloseTo(1, 3);
    expect(sceneAt(1.8).labels).toBeCloseTo(1, 3);
    // cap. 3: remontado antes do encaixe; engole depois do encaixe; abre depois de engolir; libera por último
    expect(sceneAt(2.2).openEnv + sceneAt(2.2).openRnp).toBeCloseTo(0, 3);
    expect(sceneAt(2.2).membrane).toBeCloseTo(1, 3);
    expect(sceneAt(2.36).dock).toBeCloseTo(1, 3);
    expect(sceneAt(2.36).engulf).toBeCloseTo(0, 3);
    expect(sceneAt(2.55).engulf).toBeCloseTo(1, 3);
    expect(sceneAt(2.55).uncoat).toBeCloseTo(0, 3);
    expect(sceneAt(2.75).uncoat).toBeCloseTo(1, 3);
    expect(sceneAt(2.95).release).toBeCloseTo(1, 3);
    expect(sceneAt(2.95).spin).toBe(0);
    // cap. 4: brota com a câmera ainda perto; pessoas só depois de afastar; o vírion viaja até a boca direita
    expect(sceneAt(3.15).bud).toBeCloseTo(1, 3);
    expect(sceneAt(3.15).camZ).toBeCloseTo(POSES[2]!.camZ, 3);
    expect(sceneAt(3.5).people).toBeCloseTo(1, 3);
    expect(sceneAt(3.5).membrane).toBeCloseTo(0, 3);
    expect(sceneAt(3.5).virusX).toBeCloseTo(MOUTH_LEFT.x, 3);
    expect(sceneAt(3.82).virusX).toBeCloseTo(MOUTH_RIGHT.x, 3);
    expect(sceneAt(3.82).droplets).toBeCloseTo(1, 3);
    // cap. 5: pessoas somem ao aproximar; anticorpos antes do bloqueio; deriva antes de regrudar
    expect(sceneAt(4.2).people).toBeCloseTo(0, 3);
    expect(sceneAt(4.2).virusScale).toBeCloseTo(1, 3);
    expect(sceneAt(4.36).antibodies).toBeCloseTo(1, 3);
    expect(sceneAt(4.36).block).toBeCloseTo(0, 3);
    expect(sceneAt(4.58).block).toBeCloseTo(1, 3);
    expect(sceneAt(4.76).drift).toBeCloseTo(1, 3);
    expect(sceneAt(4.76).rebind).toBeCloseTo(0, 3);
    expect(sceneAt(4.95).rebind).toBeCloseTo(1, 3);
    // ordem narrativa: nunca "sem nada na tela": membrana ou pessoas ou vírion grande
    for (let p = 2; p < 5; p += 0.01) {
      const s = sceneAt(p);
      expect(Math.max(s.membrane, s.people, s.virusScale), `vazio em ${p.toFixed(2)}`).toBeGreaterThan(0.3);
    }
  });

  it('progressFromSteps: antes do primeiro passo é 0; dentro, capítulo + (passo + fração)/n; depois, satura', () => {
    const spc = [2, 3];
    const steps = [
      { top: 1000, height: 400 },
      { top: 1500, height: 400 },
      { top: 2000, height: 300 },
      { top: 2400, height: 300 },
      { top: 2800, height: 300 },
    ];
    expect(progressFromSteps(0, steps, spc)).toBe(0);
    expect(progressFromSteps(1000, steps, spc)).toBe(0);
    expect(progressFromSteps(1250, steps, spc)).toBeCloseTo(0.25);
    expect(progressFromSteps(1500, steps, spc)).toBeCloseTo(0.5);
    expect(progressFromSteps(2000, steps, spc)).toBeCloseTo(1);
    expect(progressFromSteps(2200, steps, spc)).toBeCloseTo(1 + 0.5 / 3);
    expect(progressFromSteps(2950, steps, spc)).toBeCloseTo(1 + (2 + 0.5) / 3);
    expect(progressFromSteps(9000, steps, spc)).toBeLessThan(2);
    expect(progressFromSteps(9000, steps, spc)).toBeGreaterThan(1.99);
    expect(progressFromSteps(5, [], spc)).toBe(0);
    // monotônico
    let last = -1;
    for (let y = 0; y < 4000; y += 7) {
      const v = progressFromSteps(y, steps, spc);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    expect(progressFromLayout(1500, [1000, 2000, 3000], [1000, 1000, 1000])).toBeCloseTo(0.5);
  });

  it('dampTo converge sem ultrapassar, respeita o limite de velocidade e é estável em dt grandes/NaN', () => {
    const d = { value: 0, velocity: 0 };
    let maxV = 0;
    let prev = 0;
    for (let i = 0; i < 600; i++) {
      dampTo(d, 1, 1 / 60, { smoothTime: 0.3, maxSpeed: 2 });
      expect(d.value).toBeLessThanOrEqual(1 + 1e-9);
      expect(d.value).toBeGreaterThanOrEqual(prev - 1e-9);
      maxV = Math.max(maxV, (d.value - prev) * 60);
      prev = d.value;
    }
    expect(d.value).toBeCloseTo(1, 4);
    expect(maxV).toBeLessThanOrEqual(2.05);
    const far = { value: 0, velocity: 0 };
    dampTo(far, 5, 0.5, { smoothTime: 0.3, maxSpeed: 2 });
    expect(far.value).toBeLessThan(1.2); // limite de velocidade: não atravessa capítulos num só quadro
    const nan = { value: Number.NaN, velocity: 0 };
    dampTo(nan, 2, 0.016);
    expect(nan.value).toBe(2);
    const stay = { value: 1, velocity: 0 };
    dampTo(stay, Number.NaN, 0.016);
    expect(stay.value).toBe(1);
    expect(expDamp(0, 1, 0.15, 0.15)).toBeCloseTo(1 - Math.exp(-1), 6);
    expect(fitDistance(1.8)).toBe(1);
    expect(fitDistance(0.6)).toBeGreaterThan(1);
    expect(ambient(0).breath).toBeCloseTo(0);
    expect(Math.abs(ambient(1.7).wobble)).toBeLessThanOrEqual(1);
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
    for (const c of CHAPTER_COPY) for (const st of c.steps) for (const id of st.factIds ?? []) expect(facts.has(id), `${c.id}: fato '${id}' ausente`).toBe(true);
    CHAPTER_COPY.forEach((c, i) => expect(c.steps.length, `${c.id}: passos`).toBe(STEPS_PER_CHAPTER[i]));
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
