import { describe, expect, it } from 'vitest';
import { CHAPTER_COUNT, STEPS_PER_CHAPTER, progressFromSteps } from '@/lib/virus/choreography';
import {
  AUTO_LABELS,
  LABEL_OFFSET,
  LOW_FPS,
  chapterWithHysteresis,
  dotFills,
  firstStepIndices,
  frameloopPolicy,
  labelPosition,
  labelTarget,
  referenceLine,
  shouldRenderFrame,
  transmissionScale,
} from '@/lib/virus/explainer';
import { VIRUS_PARTS } from '@/lib/virus/parts';
import { REST } from '@/lib/virus/scenestate';
import { partAnchor, spikeLayout } from '@/lib/virus/pose';

describe('frameloop: política por visibilidade, reduced-motion e qualidade', () => {
  it('fora da tela ou aba oculta → never, independentemente do resto', () => {
    expect(frameloopPolicy({ active: false, reducedMotion: false, quality: 'high' })).toBe('never');
    expect(frameloopPolicy({ active: false, reducedMotion: true, quality: 'low' })).toBe('never');
  });
  it('reduced-motion → demand; low → manual (~30 fps); high → always', () => {
    expect(frameloopPolicy({ active: true, reducedMotion: true, quality: 'high' })).toBe('demand');
    expect(frameloopPolicy({ active: true, reducedMotion: true, quality: 'low' })).toBe('demand');
    expect(frameloopPolicy({ active: true, reducedMotion: false, quality: 'low' })).toBe('manual');
    expect(frameloopPolicy({ active: true, reducedMotion: false, quality: 'high' })).toBe('always');
  });
  it('shouldRenderFrame limita a ~30 fps num monitor de 60 Hz (um quadro sim, um não) e aceita o primeiro', () => {
    expect(LOW_FPS).toBe(30);
    expect(shouldRenderFrame(0, -Infinity)).toBe(true);
    const frames = Array.from({ length: 12 }, (_, i) => i * (1000 / 60));
    let last = -Infinity;
    let rendered = 0;
    for (const t of frames) {
      if (shouldRenderFrame(t, last)) {
        rendered++;
        last = t;
      }
    }
    expect(rendered).toBe(6);
    // 120 Hz: um a cada quatro
    last = -Infinity;
    rendered = 0;
    for (let i = 0; i < 24; i++) {
      const t = i * (1000 / 120);
      if (shouldRenderFrame(t, last)) {
        rendered++;
        last = t;
      }
    }
    expect(rendered).toBe(6);
  });
  it('escala de transmissão: 0,5 em high e 0,35 em low', () => {
    expect(transmissionScale('high')).toBe(0.5);
    expect(transmissionScale('low')).toBe(0.35);
  });
});

describe('linha de referência por breakpoint', () => {
  it('desktop: meio da janela', () => {
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: false })).toBe(1400);
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: false, stageBottom: 500 })).toBe(1400);
  });
  it('mobile: meio da faixa visível abaixo do palco', () => {
    // palco de 64 px a 400 px: faixa visível 400..800 → meio em 600
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: true, stageBottom: 400 })).toBe(1600);
  });
  it('mobile sem medida do palco cai no meio da janela; palco maior que a janela satura na base', () => {
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: true })).toBe(1400);
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: true, stageBottom: NaN })).toBe(1400);
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: true, stageBottom: 900 })).toBe(1800);
    expect(referenceLine({ scrollY: 1000, innerHeight: 800, stacked: true, stageBottom: -50 })).toBe(1400);
  });
  it('integra com progressFromSteps: a mesma rolagem dá progresso maior no mobile (linha mais baixa)', () => {
    const steps = Array.from({ length: 22 }, (_, i) => ({ top: 2000 + i * 500, height: 500 }));
    const desk = progressFromSteps(referenceLine({ scrollY: 2000, innerHeight: 800, stacked: false }), steps, STEPS_PER_CHAPTER);
    const mob = progressFromSteps(referenceLine({ scrollY: 2000, innerHeight: 800, stacked: true, stageBottom: 400 }), steps, STEPS_PER_CHAPTER);
    expect(mob).toBeGreaterThan(desk);
    expect(desk).toBeCloseTo(0.8 / 3);
    expect(mob).toBeCloseTo((1 + 0.2) / 3);
  });
});

describe('capítulo atual com histerese', () => {
  it('dentro do capítulo devolve o próprio; saltos de 2+ são imediatos', () => {
    expect(chapterWithHysteresis(1.5, 1)).toBe(1);
    expect(chapterWithHysteresis(3.5, 1)).toBe(3);
    expect(chapterWithHysteresis(0.2, 3)).toBe(0);
  });
  it('não troca enquanto a fronteira não é ultrapassada pela margem', () => {
    expect(chapterWithHysteresis(2.01, 1)).toBe(1);
    expect(chapterWithHysteresis(2.05, 1)).toBe(2);
    expect(chapterWithHysteresis(1.99, 2)).toBe(2);
    expect(chapterWithHysteresis(1.95, 2)).toBe(1);
  });
  it('satura nas bordas e tolera entradas inválidas', () => {
    expect(chapterWithHysteresis(-1, 0)).toBe(0);
    expect(chapterWithHysteresis(99, 4)).toBe(4);
    expect(chapterWithHysteresis(99, 0)).toBe(CHAPTER_COUNT - 1);
    expect(chapterWithHysteresis(NaN, 2)).toBe(0);
  });
});

describe('trilho de progresso e índices de passo', () => {
  it('dotFills: passados cheios, atual parcial, futuros vazios', () => {
    expect(dotFills(0)).toEqual([0, 0, 0, 0, 0]);
    expect(dotFills(2.25)).toEqual([1, 1, 0.25, 0, 0]);
    expect(dotFills(4.9999)[4]).toBeCloseTo(0.9999);
    expect(dotFills(7)).toEqual([1, 1, 1, 1, 1]);
    expect(dotFills(NaN)).toEqual([0, 0, 0, 0, 0]);
  });
  it('firstStepIndices acumula os passos por capítulo (3·5·5·4·5 → 0,3,8,13,17)', () => {
    expect(firstStepIndices(STEPS_PER_CHAPTER)).toEqual([0, 3, 8, 13, 17]);
    expect(firstStepIndices([])).toEqual([]);
  });
});

describe('rótulos: alvo de opacidade e posição', () => {
  it('hover/seleção força 1 para qualquer peça; o canal labels só acende as 4 principais', () => {
    expect(labelTarget('m1', 1, null, null)).toBe(0);
    expect(labelTarget('m1', 1, 'm1', null)).toBe(1);
    expect(labelTarget('m2', 0, null, 'm2')).toBe(1);
    expect(labelTarget('ha', 0.4, null, null)).toBeCloseTo(0.4);
    expect(labelTarget('ha', 2, null, null)).toBe(1);
    for (const p of VIRUS_PARTS) expect(labelTarget(p.id, 1, null, null)).toBe(AUTO_LABELS.has(p.id) ? 1 : 0);
  });
  it('labelPosition empurra o cartão para fora ao longo do raio (ou para cima no centro)', () => {
    const layout = spikeLayout('low');
    for (const p of VIRUS_PARTS) {
      const a = partAnchor(p.id, REST, layout);
      const l = labelPosition(p.id, a);
      const ra = Math.hypot(a.x, a.y, a.z);
      const rl = Math.hypot(l.x, l.y, l.z);
      expect(rl - ra).toBeCloseTo(LABEL_OFFSET[p.id], 6);
    }
    expect(labelPosition('rna', { x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: LABEL_OFFSET.rna, z: 0 });
  });
});

describe('rótulos DOM: limite dentro do palco', () => {
  it('clampToStage mantém o cartão inteiro dentro do retângulo útil e tolera NaN', async () => {
    const { clampToStage, LABEL_CARD, LABEL_PAD, LABEL_IDS } = await import('@/lib/virus/explainer');
    const W = 800;
    const H = 600;
    const inside = clampToStage(400, 300, W, H);
    expect(inside).toEqual({ x: 400, y: 300, z: 0 });
    const tl = clampToStage(-50, -50, W, H);
    expect(tl.x).toBeCloseTo(LABEL_PAD.side + LABEL_CARD.w / 2);
    expect(tl.y).toBeCloseTo(LABEL_PAD.top + LABEL_CARD.h / 2);
    const br = clampToStage(5000, 5000, W, H);
    expect(br.x).toBeCloseTo(W - LABEL_PAD.side - LABEL_CARD.w / 2);
    expect(br.y).toBeCloseTo(H - LABEL_PAD.bottom - LABEL_CARD.h / 2);
    const nan = clampToStage(Number.NaN, Number.NaN, W, H);
    expect(Number.isFinite(nan.x) && Number.isFinite(nan.y)).toBe(true);
    // palco minúsculo: não inverte os limites
    const tiny = clampToStage(10, 10, 100, 100);
    expect(tiny.x).toBeGreaterThanOrEqual(0);
    expect(tiny.y).toBeGreaterThanOrEqual(0);
    expect(LABEL_IDS).toHaveLength(6);
  });

  it('spreadLabels separa cartões sobrepostos sem sair do palco', async () => {
    const { spreadLabels, LABEL_CARD, LABEL_PAD } = await import('@/lib/virus/explainer');
    const pts = [
      { x: 300, y: 112 },
      { x: 310, y: 115 },
      { x: 305, y: 118 },
    ];
    spreadLabels(pts, 800, 600);
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const overlap = Math.abs(pts[i]!.x - pts[j]!.x) < LABEL_CARD.w && Math.abs(pts[i]!.y - pts[j]!.y) < LABEL_CARD.h;
        expect(overlap, `${i} × ${j}`).toBe(false);
      }
    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(LABEL_PAD.top + LABEL_CARD.h / 2 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(600 - LABEL_PAD.bottom - LABEL_CARD.h / 2 + 1e-9);
    }
    const apart = [{ x: 100, y: 200 }, { x: 600, y: 200 }];
    spreadLabels(apart, 800, 600);
    expect(apart[1]!.y).toBe(200);
  });
});
