import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadFacts } from '@/lib/content';
import { CHAPTERS, progressFromLayout } from '@/lib/virus/chapters';
import { BEATS, BLINK_HZ, CARRY_LEFT, CARRY_RIGHT, CHAPTER_COUNT, POSES, PULSE_HZ, START, STEPS_PER_CHAPTER, ambient, chapterFromProgress, drift, ease, fitDistance, openingFill, progressFromSteps, sceneAt, settledProgress, smootherstep01 } from '@/lib/virus/choreography';
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
    // violações acumuladas e conferidas uma vez (milhares de `expect` por passo ficam lentos em máquina carregada)
    const dp = 0.002;
    const problems: string[] = [];
    let prev = sceneAt(0);
    for (let p = dp; p <= CHAPTER_COUNT + 0.01; p += dp) {
      const s = sceneAt(p);
      for (const k of SCENE_KEYS) {
        const [lo, hi] = BOUNDS[k];
        const v = s[k];
        if (!(v >= lo - 1e-9 && v <= hi + 1e-9)) problems.push(`${k} em ${p.toFixed(3)} = ${v} fora de [${lo}, ${hi}]`);
        if (UNIT_KEYS.includes(k) && !(v >= -1e-9 && v <= 1 + 1e-9)) problems.push(`${k} em ${p.toFixed(3)} = ${v} fora de [0, 1]`);
        // nenhuma chave salta mais que ~8% do seu intervalo por passo de 0,002 (transições de ≥ 0,05 de largura)
        if (!(Math.abs(v - prev[k]) < (hi - lo) * 0.08)) problems.push(`salto em '${k}' perto de ${p.toFixed(3)}: ${prev[k]} → ${v}`);
        if (problems.length > 20) break;
      }
      prev = s;
    }
    expect(problems).toEqual([]);
    expect(sceneAt(99)).toBeDefined();
    expect(sceneAt(Number.NaN)).toEqual(sceneAt(0));
  }, 30000);

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
    expect(sceneAt(3.14).bud).toBeCloseTo(1, 3);
    expect(sceneAt(3.14).camZ).toBeCloseTo(POSES[2]!.camZ, 3);
    expect(sceneAt(3.5).people).toBeCloseTo(1, 3);
    expect(sceneAt(3.5).membrane).toBeCloseTo(0, 3);
    expect(sceneAt(3.5).virusX).toBeCloseTo(CARRY_LEFT.x, 3);
    expect(sceneAt(3.82).virusX).toBeCloseTo(CARRY_RIGHT.x, 3);
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

  it('texto em passos: contagem = STEPS_PER_CHAPTER, lead = 1.º passo, 1 a 3 frases e no máximo 3 fatos por passo', () => {
    // heurística de frase: termina em . ! ? seguido de espaço ou fim do texto
    const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0);
    CHAPTER_COPY.forEach((c, i) => {
      expect(c.steps.length, `${c.id}: passos`).toBe(STEPS_PER_CHAPTER[i]);
      expect(c.lead, `${c.id}: lead ≠ texto do 1.º passo`).toBe(c.steps[0]!.text);
      c.steps.forEach((st, k) => {
        const n = sentences(st.text).length;
        expect(n, `${c.id} passo ${k + 1}: ${n} frases`).toBeGreaterThanOrEqual(1);
        expect(n, `${c.id} passo ${k + 1}: ${n} frases`).toBeLessThanOrEqual(3);
        expect((st.factIds ?? []).length, `${c.id} passo ${k + 1}: fatos demais`).toBeLessThanOrEqual(3);
        expect(new Set(st.factIds ?? []).size, `${c.id} passo ${k + 1}: fato repetido`).toBe((st.factIds ?? []).length);
      });
    });
  });
});

describe('v4 · abertura, curvas orgânicas e movimento ambiente', () => {
  it('pose de abertura: vírion inteiro em ~55–65 % da altura no desktop, girando devagar, e o capítulo 1 aproxima', () => {
    const fill = openingFill(Math.hypot(START.camY - START.lookY, START.camZ * fitDistance(1440 / 900)));
    expect(fill).toBeGreaterThanOrEqual(0.55);
    expect(fill).toBeLessThanOrEqual(0.65);
    expect(START.spin).toBeGreaterThan(0);
    expect(START.spin).toBeLessThanOrEqual(0.5);
    expect(START.camZ).toBeGreaterThan(POSES[0]!.camZ);
    // sem deslocamentos de cena na abertura: o enquadramento lateral é só `viewShift` (frente B)
    expect(START.virusX).toBe(0);
    expect(START.lookX).toBe(0);
  });

  it('palco em tela inteira (paisagem 16:9): vista explodida e vacina cabem na altura do quadro', () => {
    const fit = fitDistance(16 / 9);
    // meia-altura da explosão: envelope + metade aberta + espinho elevado + NA
    const exploded = 1 + 0.78 + 0.55 + 0.36;
    const h2 = 2 * POSES[1]!.camZ * fit * Math.tan((18 * Math.PI) / 180);
    expect((2 * exploded) / h2).toBeLessThanOrEqual(0.95);
    // vacina: vírion + anticorpos (≈ +0,4)
    const h5 = 2 * POSES[4]!.camZ * fit * Math.tan((18 * Math.PI) / 180);
    expect((2 * (1.36 + 0.4)) / h5).toBeLessThanOrEqual(0.9);
  });

  it('curvas: todas valem 0 e 1 nas pontas (continuidade independe da curva); smootherstep é C2 e monótona', () => {
    for (const k of ['smooth', 'smoother', 'linear'] as const) {
      expect(ease(k, 0)).toBe(0);
      expect(ease(k, 1)).toBe(1);
      expect(ease(k, -3)).toBe(0);
      expect(ease(k, 7)).toBe(1);
      let prev = -1;
      for (let x = 0; x <= 1.0001; x += 0.01) {
        const v = ease(k, x);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = v;
      }
    }
    expect(smootherstep01(0.5)).toBeCloseTo(0.5, 12);
    // derivada nula nas pontas (sem tranco ao começar/assentar)
    const h = 1e-4;
    expect(smootherstep01(h) / h).toBeLessThan(1e-6);
    expect((1 - smootherstep01(1 - h)) / h).toBeLessThan(1e-6);
    // batidas orgânicas declaradas onde o contrato pede (abrir espinhos, engolir, brotar)
    expect(BEATS[1]!.openSpikes!.ease).toBe('smoother');
    expect(BEATS[2]!.engulf!.ease).toBe('smoother');
    expect(BEATS[3]!.bud!.ease).toBe('smoother');
  });

  it('"pisca" e pulso ≤ 1 Hz (contrato v4 §6); blink fica em [0, 1]', () => {
    expect(BLINK_HZ).toBeLessThanOrEqual(1);
    expect(PULSE_HZ).toBeLessThanOrEqual(1);
    // período medido: dois máximos consecutivos de blink a ≥ 1 s de distância
    const peaks: number[] = [];
    let a = ambient(0).blink;
    let b = ambient(0.01).blink;
    for (let t = 0.02; t < 6; t += 0.01) {
      const c = ambient(t).blink;
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      if (b > a && b >= c) peaks.push(t - 0.01);
      a = b;
      b = c;
    }
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]! - peaks[i - 1]!).toBeGreaterThanOrEqual(1 - 0.02);
  });

  it('deriva ambiente: pequena, contínua e finita', () => {
    let prev = drift(0);
    for (let t = 0; t < 60; t += 0.05) {
      const d = drift(t);
      expect(Math.abs(d.tiltX)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(d.tiltZ)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(d.floatY)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(d.tiltX - prev.tiltX)).toBeLessThan(0.01);
      prev = d;
    }
    expect(drift(Number.NaN)).toEqual(drift(0));
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
    const ids = [
      'ms-subtipos-influenza-a-hemaglutinina-e-neuraminidase', 'krammer-2018-hemaglutinina-entrada-neuraminidase-saida', 'krammer-2018-neuraminidase-libera-novos-virus', 'krammer-2018-genoma-oito-segmentos-rna', 'krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2', 'krammer-2018-ha-e-na-alvos-principais-dos-anticorpos', 'nomenclatura-ah1n1pdm09',
      // explicador 3D v2 (docs/pesquisa/explicador-3d-virion.md e explicador-3d-ciclo-transmissao.md)
      'harris-2006-diametro-esferico-120nm', 'noda-2012-diametro-80-120nm-filamentoso', 'harris-2006-contagem-ha-na', 'harris-2006-na-em-grupos', 'harris-2006-ha-trimero-na-tetramero', 'harris-2006-altura-ha-na-haste', 'pdb101-na-tetramero-haste-longa', 'harris-2006-camada-m1-sob-envelope', 'noda-2012-rnp-bastonetes-comprimentos', 'noda-2012-arranjo-7-mais-1', 'harris-2006-polimerase-na-ponta-da-rnp',
      'dou-2018-ha-liga-acido-sialico', 'dou-2018-entrada-endocitose', 'dou-2018-m2-acidifica-solta-rnp-m1', 'krammer-2018-endossomo-acido-ha-fusao', 'krammer-2018-rnps-vao-ao-nucleo', 'krammer-2018-montagem-brotamento-membrana', 'dou-2018-na-corta-acido-sialico-libera', 'dou-2018-virus-100-nm', 'cdc-goticulas-tosse-espirro-fala', 'krammer-2018-transmissao-goticulas-aerossois-fomites', 'oms-goticulas-infectam-pessoas-proximas', 'krammer-2018-deriva-antigenica-vacina-anual', 'ms-vacinacao-anual-mudanca-virus',
    ];
    for (const id of ids) {
      const f = facts.get(id);
      expect(f, id).toBeDefined();
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(f!.source_url, id).toMatch(/^https:\/\//);
      expect(f!.quote && f!.quote.length >= 20, id).toBe(true);
      expect(f!.verified_by, id).toContain('Redação H1N1');
      expect(f!.verified_at, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // a citação remontada do CDC ("1 dia antes … 5–7 dias depois") não entra sem conferência manual
    for (const f of facts.values()) expect(f.quote ?? '', f.id).not.toMatch(/one day before symptoms develop and up to five to seven days/i);
  });

  it('facts.json não tem id duplicado', () => {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'facts.json'), 'utf8')) as Array<{ id: string }>;
    const ids = raw.map((f) => f.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup, dup.join(', ')).toEqual([]);
    expect(facts.size).toBe(ids.length);
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

  it('texto livre não traz números soltos de dias, horas, semanas, percentuais ou nanômetros (ficam só nos <Fato>); cobre kickers, títulos de ato, abertura e índice', () => {
    const re = /\d+\s*(%|por cento|dias?|horas?|h\b|semanas?|meses|mês|anos?|nm|nan[oô]metros?|µm|micr[oô]metros?|°C)\b/i;
    const all = allFreeText();
    for (const t of all) expect(t, t).not.toMatch(re);
    for (const t of all) expect(t.toLowerCase(), t).not.toContain('tempo real');
    // o detector reconhece as formas por extenso
    expect('mede 100 nanômetros').toMatch(re);
    expect('filamentos de 20 micrômetros').toMatch(re);
    // cobertura: kickers e títulos dos sete atos, abertura e índice final
    for (const c of CHAPTERS) {
      expect(all).toContain(c.kicker);
      expect(all).toContain(c.title);
    }
    expect(all).toContain('No Brasil');
    expect(all).toContain('Continue daqui');
    expect(all).toContain('E agora?');
    expect(all.some((t) => t.startsWith('Um dos vírus da gripe, visto de perto'))).toBe(true);
    expect(all).toContain('Sinais de alerta');
    expect(all).toContain('Fontes e metodologia');
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
