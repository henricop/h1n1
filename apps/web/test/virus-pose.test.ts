import { describe, expect, it } from 'vitest';
import { POSES } from '@/lib/virus/choreography';
import { length, seededRandom, type Vec3 } from '@/lib/virus/geometry';
import { createSimplex3, simplex3 } from '@/lib/virus/noise';
import { VIRUS_PARTS } from '@/lib/virus/parts';
import {
  BALD_PATCHES,
  DRIFT_FRACTION,
  DRIFT_SEED,
  HA_HEIGHT,
  NA_HEIGHT,
  RNP_COUNT,
  RNP_STAGGER,
  SPIKE_COUNTS,
  SPIKE_JITTER,
  SPIKE_LIFT,
  SPIKE_MIN_SEP,
  SPIKE_SINK,
  SPIKE_WAVE,
  driftMask,
  envelopeRadius,
  hemisphere,
  partAnchor,
  rnpFanCenter,
  rnpLength,
  rnpOpenT,
  rnpReleaseT,
  rnpRestCenter,
  spikeBase,
  spikeBaseInto,
  spikeJitter,
  spikeLayout,
  spikeLift,
  spikeTop,
  type Quality,
  type SpikeKind,
} from '@/lib/virus/pose';
import { REST } from '@/lib/virus/scenestate';

const QUALITIES: Quality[] = ['low', 'high'];
const KINDS: SpikeKind[] = ['ha', 'na', 'm2'];
const EXPLODED = POSES[1]!;

function angle(a: Vec3, b: Vec3): number {
  return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));
}

describe('ruído simplex (lib/virus/noise)', () => {
  it('é determinístico, limitado a [−1, 1] e contínuo', () => {
    const n1 = createSimplex3(5);
    const n2 = createSimplex3(5);
    expect(n1(0.3, 1.2, -0.7)).toBe(n2(0.3, 1.2, -0.7));
    expect(createSimplex3(6)(0.3, 1.2, -0.7)).not.toBe(n1(0.3, 1.2, -0.7));
    const rnd = seededRandom(99);
    let maxAbs = 0;
    for (let i = 0; i < 2000; i++) {
      const x = (rnd() - 0.5) * 20;
      const y = (rnd() - 0.5) * 20;
      const z = (rnd() - 0.5) * 20;
      const v = simplex3(x, y, z);
      expect(Number.isFinite(v)).toBe(true);
      maxAbs = Math.max(maxAbs, Math.abs(v));
      // continuidade: um passo pequeno muda pouco
      expect(Math.abs(simplex3(x + 1e-3, y, z) - v)).toBeLessThan(0.02);
    }
    expect(maxAbs).toBeLessThanOrEqual(1);
    expect(maxAbs).toBeGreaterThan(0.3);
  });
});

describe('envelopeRadius: envelope pleomórfico', () => {
  it('fica em ±6 % do raio nominal, é determinística e varia pela esfera', () => {
    const rnd = seededRandom(5);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 1500; i++) {
      const v = { x: rnd() - 0.5, y: rnd() - 0.5, z: rnd() - 0.5 };
      const l = length(v) || 1;
      const d = { x: v.x / l, y: v.y / l, z: v.z / l };
      const r = envelopeRadius(d);
      expect(r).toBe(envelopeRadius({ ...d }));
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    expect(min).toBeGreaterThanOrEqual(0.94);
    expect(max).toBeLessThanOrEqual(1.06);
    expect(max - min).toBeGreaterThan(0.03);
  });
});

describe('spikeLayout: distribuição dos espinhos', () => {
  it('é determinística e respeita as contagens e a razão ≈ 7 HA : 1 NA', () => {
    for (const q of QUALITIES) {
      const a = spikeLayout(q);
      const b = spikeLayout(q);
      expect(a).toEqual(b);
      expect(a.ha).toHaveLength(SPIKE_COUNTS[q].ha);
      expect(a.na).toHaveLength(SPIKE_COUNTS[q].na);
      expect(a.m2.length).toBeGreaterThanOrEqual(SPIKE_COUNTS[q].m2 - 1);
      expect(a.m2.length).toBeLessThanOrEqual(SPIKE_COUNTS[q].m2);
      const ratio = a.ha.length / a.na.length;
      expect(ratio).toBeGreaterThanOrEqual(5);
      expect(ratio).toBeLessThanOrEqual(9);
      expect(SPIKE_COUNTS[q].m2).toBeLessThanOrEqual(8);
    }
    expect(SPIKE_COUNTS.low.ha).toBeLessThan(SPIKE_COUNTS.high.ha);
  });

  it('direções unitárias, sem duplicatas e sem sobreposição entre espinhos', () => {
    for (const q of QUALITIES) {
      const l = spikeLayout(q);
      const all = [...l.ha, ...l.na];
      for (const d of all) expect(Math.abs(length(d) - 1)).toBeLessThan(1e-9);
      let minAng = Infinity;
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) minAng = Math.min(minAng, angle(all[i]!, all[j]!));
      // empacotamento denso mas sem colisão (cabeças ≈ 0,16 de largura a r ≈ 1,2 → ≈ 0,13 rad)
      expect(minAng).toBeGreaterThan(SPIKE_MIN_SEP - 0.01);
      // M2 no vão entre espinhos
      for (const m of l.m2) for (const d of all) expect(angle(m, d)).toBeGreaterThan(0.08);
    }
  });

  it('a NA forma ilhas (vizinho NA próximo) e as manchas calvas ficam sem espinhos', () => {
    for (const q of QUALITIES) {
      const l = spikeLayout(q);
      let clustered = 0;
      for (const d of l.na) if (l.na.some((o) => o !== d && angle(d, o) < 0.45)) clustered++;
      expect(clustered / l.na.length).toBeGreaterThanOrEqual(0.5);
      for (const p of BALD_PATCHES) for (const d of [...l.ha, ...l.na, ...l.m2]) expect(angle(d, p.dir)).toBeGreaterThanOrEqual(p.radius - 1e-9);
    }
  });

  it('não é uma esfera de Fibonacci pura (jitter irregular)', () => {
    const l = spikeLayout('high');
    const ys = l.ha.map((d) => d.y).sort((a, b) => a - b);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]!);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const varc = gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length;
    expect(Math.sqrt(varc) / mean).toBeGreaterThan(0.3);
  });
});

describe('spikeBase / spikeTop: ninguém abaixo do envelope; acompanham o hemisfério', () => {
  it('em repouso a base está enterrada SPIKE_SINK na bicamada e o topo na altura da família', () => {
    const l = spikeLayout('high');
    for (const kind of KINDS) {
      for (const d of l[kind]) {
        const b = spikeBase(kind, d, REST);
        expect(length(b)).toBeCloseTo(envelopeRadius(d) - SPIKE_SINK, 9);
        const t = spikeTop(kind, d, REST);
        const h = kind === 'ha' ? HA_HEIGHT : kind === 'na' ? NA_HEIGHT : 0.12;
        expect(length(t) - length(b)).toBeCloseTo(h, 9);
        const into = spikeBaseInto(kind, d, REST, { x: 0, y: 0, z: 0 });
        expect(into).toEqual(b);
      }
    }
    expect(NA_HEIGHT).toBeGreaterThan(HA_HEIGHT);
  });

  it('nunca fica abaixo do envelope para qualquer combinação de abertura', () => {
    const l = spikeLayout('low');
    for (const openSpikes of [0, 0.25, 0.5, 1]) {
      for (const openEnv of [0, 0.5, 1]) {
        const s = { openSpikes, openEnv };
        for (const kind of KINDS) {
          for (const d of l[kind]) {
            const b = spikeBase(kind, d, s);
            const radial = b.x * d.x + (b.y - hemisphere(d) * openEnv * 0.78) * d.y + b.z * d.z;
            expect(radial).toBeGreaterThanOrEqual(envelopeRadius(d) - SPIKE_SINK - 1e-9);
          }
        }
      }
    }
  });

  it('com openEnv os espinhos de cima sobem e os de baixo descem; com openSpikes todos se afastam', () => {
    const l = spikeLayout('high');
    for (const kind of KINDS) {
      for (const d of l[kind]) {
        const closed = spikeBase(kind, d, { openSpikes: 0, openEnv: 0 });
        const env = spikeBase(kind, d, { openSpikes: 0, openEnv: 1 });
        if (d.y >= 0) expect(env.y).toBeGreaterThan(closed.y + 0.5);
        else expect(env.y).toBeLessThan(closed.y - 0.5);
        expect(env.x).toBeCloseTo(closed.x, 9);
        expect(env.z).toBeCloseTo(closed.z, 9);
        const open = spikeBase(kind, d, { openSpikes: 1, openEnv: 0 });
        expect(length(open)).toBeGreaterThan(length(closed) + 0.3);
        // monotônico
        let prev = length(closed);
        for (const o of [0.2, 0.4, 0.6, 0.8, 1]) {
          const r = length(spikeBase(kind, d, { openSpikes: o, openEnv: 0 }));
          expect(r).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = r;
        }
      }
    }
    // NA sai com atraso e vai mais longe que a HA
    const d = { x: 0, y: 1, z: 0 };
    expect(length(spikeBase('na', d, { openSpikes: 0.1, openEnv: 0 }))).toBeCloseTo(length(spikeBase('na', d, REST)), 9);
    expect(length(spikeBase('ha', d, { openSpikes: 0.1, openEnv: 0 }))).toBeGreaterThan(length(spikeBase('ha', d, REST)));
    expect(length(spikeBase('na', d, { openSpikes: 1, openEnv: 0 }))).toBeGreaterThan(length(spikeBase('ha', d, { openSpikes: 1, openEnv: 0 })));
  });
});

describe('v4 · onda de abertura e micro-variação dos espinhos', () => {
  it('a abertura corre em onda de cima para baixo, monótona, e todos chegam à elevação total em openSpikes = 1', () => {
    const top = { x: 0, y: 1, z: 0 };
    const bottom = { x: 0, y: -1, z: 0 };
    for (const kind of KINDS) {
      const full = spikeLift(kind, 1);
      expect(spikeLift(kind, 1, top)).toBeCloseTo(full, 9);
      expect(spikeLift(kind, 1, bottom)).toBeCloseTo(full, 9);
      expect(spikeLift(kind, 0, bottom)).toBe(0);
      // o de cima sai antes (ou junto) do de baixo em qualquer instante
      let pt = 0;
      let pb = 0;
      for (let o = 0; o <= 1.0001; o += 0.02) {
        const t = spikeLift(kind, o, top);
        const b = spikeLift(kind, o, bottom);
        expect(t).toBeGreaterThanOrEqual(b - 1e-12);
        expect(t).toBeGreaterThanOrEqual(pt - 1e-12);
        expect(b).toBeGreaterThanOrEqual(pb - 1e-12);
        pt = t;
        pb = b;
      }
    }
    // atraso real no polo de baixo: com pouca abertura ainda não saiu
    expect(spikeLift('ha', SPIKE_WAVE * 0.9, bottom)).toBe(0);
    expect(spikeLift('ha', SPIKE_WAVE * 0.9, top)).toBeGreaterThan(0);
    expect(spikeLift('ha', 1, top)).toBeCloseTo(SPIKE_LIFT, 9);
  });

  it('spikeJitter é determinística e limitada (inclinação ≤ 4°, altura/largura/tom pequenos)', () => {
    const a = spikeJitter(140, 31);
    const b = spikeJitter(140, 31);
    expect(Array.from(a.tilt)).toEqual(Array.from(b.tilt));
    expect(Array.from(a.height)).toEqual(Array.from(b.height));
    for (let i = 0; i < 140; i++) {
      expect(a.tilt[i]!).toBeGreaterThanOrEqual(0);
      expect(a.tilt[i]!).toBeLessThanOrEqual(SPIKE_JITTER.tilt + 1e-7);
      expect(Math.abs(a.height[i]! - 1)).toBeLessThanOrEqual(SPIKE_JITTER.height + 1e-6);
      expect(Math.abs(a.width[i]! - 1)).toBeLessThanOrEqual(SPIKE_JITTER.width + 1e-6);
      expect(Math.abs(a.tone[i]!)).toBeLessThanOrEqual(SPIKE_JITTER.tone + 1e-6);
    }
    // não é uniforme (há variação de fato)
    const hs = Array.from(a.height);
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(SPIKE_JITTER.height);
    expect(SPIKE_JITTER.tilt).toBeLessThanOrEqual((4.1 * Math.PI) / 180);
    // a cabeça inclinada desloca-se menos que a folga lateral do "V" do anticorpo (±0,1)
    expect(Math.sin(SPIKE_JITTER.tilt) * HA_HEIGHT * (1 + SPIKE_JITTER.height)).toBeLessThan(0.05);
    expect(spikeJitter(0, 1).tilt).toHaveLength(0);
  });
});

describe('partAnchor: âncoras de rótulo finitas e coerentes', () => {
  it('é finita para toda peça, em repouso e na vista explodida, e acompanha a abertura', () => {
    for (const q of QUALITIES) {
      const layout = spikeLayout(q);
      for (const part of VIRUS_PARTS) {
        const a = partAnchor(part.id, REST, layout);
        const b = partAnchor(part.id, EXPLODED, layout);
        for (const v of [a, b]) {
          expect(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)).toBe(true);
          expect(length(v)).toBeGreaterThan(0.5);
          expect(length(v)).toBeLessThan(4);
        }
        expect(length(b)).toBeGreaterThan(length(a));
      }
      // o rótulo do envelope fica acima do topo da metade superior
      const env = partAnchor('envelope', EXPLODED, layout);
      expect(env.y).toBeGreaterThan(envelopeRadius({ x: 0, y: 1, z: 0 }) + 0.78);
    }
  });
});

describe('deriva antigênica e RNPs', () => {
  it('driftMask segue a regra compartilhada (i-ésimo valor de seededRandom(29) < 0,35)', () => {
    const mask = driftMask(140);
    const rnd = seededRandom(DRIFT_SEED);
    for (const m of mask) expect(m).toBe(rnd() < DRIFT_FRACTION);
    const frac = mask.filter(Boolean).length / mask.length;
    expect(frac).toBeGreaterThan(0.2);
    expect(frac).toBeLessThan(0.5);
    expect(driftMask(10)).toEqual(driftMask(140).slice(0, 10));
  });

  it('8 RNPs: 3 longas parecidas + 5 mais curtas, 7+1 com a central longa, cabem dentro da M1', () => {
    expect(RNP_COUNT).toBe(8);
    const lens = Array.from({ length: RNP_COUNT }, (_, k) => rnpLength(k));
    expect(lens[0]).toBeCloseTo(lens[1]!, 9);
    expect(Math.abs(lens[2]! - lens[0]!)).toBeLessThan(0.06);
    for (let k = 3; k < 8; k++) expect(lens[k]!).toBeLessThan(lens[2]! - 0.1);
    expect(lens[7]!).toBeGreaterThan(0.5);
    expect(rnpRestCenter(0)).toEqual({ x: 0, y: 0, z: 0 });
    for (let k = 0; k < RNP_COUNT; k++) {
      const c = rnpRestCenter(k);
      const half = lens[k]! / 2 + 0.1;
      expect(Math.hypot(Math.hypot(c.x, c.z), half)).toBeLessThan(0.9 + 0.08);
      const f = rnpFanCenter(k);
      expect(f.z).toBeGreaterThan(1);
      expect(Number.isFinite(f.x)).toBe(true);
    }
  });

  it('abertura em leque e saída em fila são escalonadas, monotônicas e completas', () => {
    for (let k = 0; k < RNP_COUNT; k++) {
      expect(rnpOpenT(0, k)).toBe(0);
      expect(rnpOpenT(1, k)).toBe(1);
      expect(rnpReleaseT(0, k)).toBe(0);
      expect(rnpReleaseT(1, k)).toBe(1);
      if (k > 0) {
        expect(rnpOpenT(k * RNP_STAGGER, k)).toBe(0);
        expect(rnpOpenT(k * RNP_STAGGER, k - 1)).toBeGreaterThan(0);
        expect(rnpReleaseT(0.2, k)).toBeLessThanOrEqual(rnpReleaseT(0.2, k - 1));
      }
      let prev = 0;
      for (let o = 0; o <= 1.0001; o += 0.05) {
        const t = rnpOpenT(o, k);
        expect(t).toBeGreaterThanOrEqual(prev);
        prev = t;
      }
    }
  });
});
