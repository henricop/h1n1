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
  it('DPR do palco segue a qualidade atual (≤ 1,5 high, ≤ 1,25 low) e o fator de desempenho', async () => {
    const { stageDpr, MAX_DPR } = await import('@/lib/virus/explainer');
    expect(MAX_DPR.high).toBe(1.5);
    expect(MAX_DPR.low).toBe(1.25);
    expect(stageDpr(2, 'high')).toBe(1.5);
    expect(stageDpr(2, 'low')).toBe(1.25);
    expect(stageDpr(3, 'low', 0.6)).toBeCloseTo(0.75, 9);
    expect(stageDpr(1, 'high')).toBe(1);
    expect(stageDpr(0.5, 'high')).toBe(1);
    expect(stageDpr(Number.NaN, 'low')).toBe(1);
    expect(stageDpr(2, 'high', Number.NaN)).toBe(1.5);
    expect(stageDpr(2, 'high', 5)).toBe(1.5);
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
    // palco baixo (celular): sem espaço vertical, resolve na horizontal
    const low = [{ x: 150, y: 112 }, { x: 160, y: 115 }];
    spreadLabels(low, 466, 341);
    expect(Math.abs(low[0]!.x - low[1]!.x) >= LABEL_CARD.w || Math.abs(low[0]!.y - low[1]!.y) >= LABEL_CARD.h).toBe(true);
    const { compactStage } = await import('@/lib/virus/explainer');
    expect(compactStage(466, 341)).toBe(true);
    expect(compactStage(625, 689)).toBe(false);
  });
});

describe('v4 · palco: fundo, enquadramento, região dos rótulos e ponteiro', () => {
  it('fundo inicial do canvas = papel v3 (#f4f1ea), igual ao THEME_BG.paper do shell', async () => {
    const { CANVAS_BACKGROUND } = await import('@/lib/virus/explainer');
    const { THEME_BG, hexToRgb } = await import('@/lib/motion/theme');
    expect(CANVAS_BACKGROUND).toBe('#f4f1ea');
    expect(hexToRgb(CANVAS_BACKGROUND)).toEqual(THEME_BG.paper);
  });

  it('viewOffsetFor: px de setViewOffset com o sinal certo (+x conteúdo à direita, +y para cima) e null sem deslocamento', async () => {
    const { viewOffsetFor, VIEW_SHIFT_MAX } = await import('@/lib/virus/explainer');
    expect(viewOffsetFor({ x: 0.18, y: 0 }, 1440, 900)).toEqual({ x: -259, y: 0 });
    expect(viewOffsetFor({ x: 0, y: 0.25 }, 390, 844)).toEqual({ x: 0, y: 211 });
    expect(viewOffsetFor({ x: -0.1, y: -0.1 }, 1000, 500)).toEqual({ x: 100, y: -50 });
    expect(viewOffsetFor({ x: 0, y: 0 }, 1440, 900)).toBeNull();
    expect(viewOffsetFor({ x: 0.0001, y: 0 }, 1440, 900)).toBeNull(); // arredonda a 0 px
    expect(viewOffsetFor(undefined, 1440, 900)).toBeNull();
    expect(viewOffsetFor({ x: 0.2, y: 0 }, 0, 900)).toBeNull();
    expect(viewOffsetFor({ x: Number.NaN, y: Infinity }, 1000, 1000)).toBeNull();
    expect(viewOffsetFor({ x: 3, y: -3 }, 1000, 1000)).toEqual({ x: Math.round(-VIEW_SHIFT_MAX * 1000), y: Math.round(-VIEW_SHIFT_MAX * 1000) });
    // sem −0
    expect(Object.is(viewOffsetFor({ x: 0, y: 0.1 }, 100, 100)!.x, 0)).toBe(true);
  });

  it('viewOffsetFor é coerente com a projeção real do three (o centro do quadro anda shift·tamanho; unproject volta ao ponto)', async () => {
    const { viewOffsetFor } = await import('@/lib/virus/explainer');
    const THREE = await import('three');
    for (const [sx, sy, w, h] of [
      [0.18, 0, 1440, 900],
      [0, 0.25, 390, 844],
      [-0.07, 0.12, 1280, 720],
    ] as const) {
      const cam = new THREE.PerspectiveCamera(36, w / h, 0.1, 60);
      cam.position.set(0, 0.15, 6.9);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      const off = viewOffsetFor({ x: sx, y: sy }, w, h)!;
      cam.setViewOffset(w, h, off.x, off.y, w, h);
      const p = new THREE.Vector3(0, 0, 0).project(cam);
      const screenX = ((p.x + 1) / 2) * w;
      const screenY = ((1 - p.y) / 2) * h;
      // o alvo do lookAt (centro do vírion) cai em (0,5 + sx; 0,5 − sy) da viewport
      expect(screenX / w).toBeCloseTo(0.5 + sx, 2);
      expect(screenY / h).toBeCloseTo(0.5 - sy, 2);
      // picking/rótulos: unproject do ponto de tela devolve o raio que passa pelo alvo
      const back = new THREE.Vector3(p.x, p.y, p.z).unproject(cam);
      expect(back.distanceTo(new THREE.Vector3(0, 0, 0))).toBeLessThan(1e-6);
    }
  });

  it('labelBounds/clampToStage: com `labelRegion`, o cartão inteiro fica na região livre de texto (e nas margens do palco)', async () => {
    const { clampToStage, labelBounds, LABEL_CARD, LABEL_PAD } = await import('@/lib/virus/explainer');
    const W = 1440;
    const H = 900;
    const region = { left: 0.44, top: 0.08, right: 0.98, bottom: 0.88 };
    const b = labelBounds(W, H, region);
    expect(b.minX).toBeCloseTo(0.44 * W + LABEL_CARD.w / 2);
    expect(b.maxX).toBeCloseTo(Math.min(0.98 * W, W - LABEL_PAD.side) - LABEL_CARD.w / 2);
    expect(b.minY).toBeCloseTo(Math.max(0.08 * H, LABEL_PAD.top) + LABEL_CARD.h / 2);
    expect(b.maxY).toBeCloseTo(Math.min(0.88 * H, H - LABEL_PAD.bottom) - LABEL_CARD.h / 2);
    // peça à esquerda (sob o texto) → cartão empurrado para a borda esquerda da região
    const left = clampToStage(100, 450, W, H, LABEL_CARD, LABEL_PAD, region);
    expect(left.x - LABEL_CARD.w / 2).toBeGreaterThanOrEqual(0.44 * W - 1e-9);
    for (const [x, y] of [
      [-100, -100],
      [5000, 5000],
      [700, 450],
      [Number.NaN, Number.NaN],
    ]) {
      const c = clampToStage(x!, y!, W, H, LABEL_CARD, LABEL_PAD, region);
      expect(c.x - LABEL_CARD.w / 2).toBeGreaterThanOrEqual(0.44 * W - 1e-9);
      expect(c.x + LABEL_CARD.w / 2).toBeLessThanOrEqual(0.98 * W + 1e-9);
      expect(c.y - LABEL_CARD.h / 2).toBeGreaterThanOrEqual(0.08 * H - 1e-9);
      expect(c.y + LABEL_CARD.h / 2).toBeLessThanOrEqual(0.88 * H + 1e-9);
    }
    // sem região = comportamento antigo (palco inteiro com LABEL_PAD)
    expect(labelBounds(W, H)).toEqual(labelBounds(W, H, null));
    expect(clampToStage(-50, -50, 800, 600)).toEqual(clampToStage(-50, -50, 800, 600, LABEL_CARD, LABEL_PAD, undefined));
    // região inválida (vazia/invertida) cai no palco inteiro; região menor que um cartão colapsa no centro dela
    expect(labelBounds(W, H, { left: 0.8, top: 0.5, right: 0.2, bottom: 0.1 })).toEqual(labelBounds(W, H));
    const tiny = labelBounds(W, H, { left: 0.5, top: 0.5, right: 0.55, bottom: 0.52 });
    expect(tiny.minX).toBe(tiny.maxX);
    expect(tiny.minX).toBeCloseTo(0.525 * W);
    expect(tiny.minY).toBe(tiny.maxY);
  });

  it('spreadLabels respeita a região (os cartões separados continuam dentro dela)', async () => {
    const { spreadLabels, LABEL_CARD, LABEL_PAD } = await import('@/lib/virus/explainer');
    const W = 1440;
    const H = 900;
    const region = { left: 0.44, top: 0.08, right: 0.98, bottom: 0.88 };
    const pts = [
      { x: 0.44 * W + 92, y: 300 },
      { x: 0.44 * W + 95, y: 305 },
      { x: 0.44 * W + 98, y: 310 },
      { x: 0.44 * W + 92, y: 312 },
    ];
    spreadLabels(pts, W, H, LABEL_CARD, LABEL_PAD, 6, region);
    for (const p of pts) {
      expect(p.x - LABEL_CARD.w / 2).toBeGreaterThanOrEqual(0.44 * W - 1e-9);
      expect(p.x + LABEL_CARD.w / 2).toBeLessThanOrEqual(0.98 * W + 1e-9);
      expect(p.y - LABEL_CARD.h / 2).toBeGreaterThanOrEqual(0.08 * H - 1e-9);
      expect(p.y + LABEL_CARD.h / 2).toBeLessThanOrEqual(0.88 * H + 1e-9);
    }
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const overlap = Math.abs(pts[i]!.x - pts[j]!.x) < LABEL_CARD.w && Math.abs(pts[i]!.y - pts[j]!.y) < LABEL_CARD.h;
        expect(overlap, `${i} × ${j}`).toBe(false);
      }
  });

  it('isDomControl: botões, links, diálogos e `data-canvas-ignore` bloqueiam a cena; o próprio canvas e texto comum não', async () => {
    const { isDomControl, DOM_CONTROL_SELECTOR } = await import('@/lib/virus/explainer');
    // elemento falso: `closest` procura por tag/atributo numa cadeia de ancestrais
    type Fake = { tagName: string; attrs?: Record<string, string>; parent?: Fake | null; closest?: (sel: string) => Fake | null };
    const matches = (el: Fake, sel: string) =>
      sel.split(',').some((raw) => {
        const s = raw.trim();
        const attr = /^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(s);
        if (attr) return attr[2] === undefined ? attr[1]! in (el.attrs ?? {}) : el.attrs?.[attr[1]!] === attr[2];
        return el.tagName.toLowerCase() === s;
      });
    const make = (tagName: string, attrs?: Record<string, string>, parent: Fake | null = null): Fake => {
      const el: Fake = { tagName, attrs, parent };
      el.closest = (sel: string) => {
        for (let n: Fake | null | undefined = el; n; n = n.parent) if (matches(n, sel)) return n;
        return null;
      };
      return el;
    };
    const film = make('DIV');
    const button = make('BUTTON', {}, film);
    const span = make('SPAN', {}, button);
    const p = make('P', {}, film);
    const link = make('A', { href: '/x' }, film);
    const panel = make('ASIDE', { 'data-canvas-ignore': '' }, film);
    const inPanel = make('P', {}, panel);
    const roleBtn = make('DIV', { role: 'button' }, film);
    const canvas = make('CANVAS', {}, film);
    expect(isDomControl(span)).toBe(true);
    expect(isDomControl(button)).toBe(true);
    expect(isDomControl(link)).toBe(true);
    expect(isDomControl(inPanel)).toBe(true);
    expect(isDomControl(roleBtn)).toBe(true);
    expect(isDomControl(p)).toBe(false);
    expect(isDomControl(film)).toBe(false);
    expect(isDomControl(canvas)).toBe(false);
    expect(isDomControl(null)).toBe(false);
    expect(isDomControl({})).toBe(false);
    expect(isDomControl({ closest: () => { throw new Error('x'); } })).toBe(false);
    expect(DOM_CONTROL_SELECTOR).toContain('[data-canvas-ignore]');
  });
});
