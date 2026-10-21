import { describe, expect, it } from 'vitest';
import { CARRY_LEFT as MOUTH_LEFT, CARRY_RIGHT as MOUTH_RIGHT, sceneAt } from '@/lib/virus/choreography';
import { seededRandom } from '@/lib/virus/geometry';
import { DRIFT_FRACTION, DRIFT_SEED, driftMask, spikeLayout } from '@/lib/virus/pose';
import { ANTIBODY_SHARE, antibodyPlan, spreadIndices } from '@/components/virus/scene/Antibodies';
import { CARRIER_PEAK, carrierPosition, dropletFade, dropletPose, dropletTravel, invSmooth, makeDroplets } from '@/components/virus/scene/Spread';

const smoothstep01 = (x: number) => x * x * (3 - 2 * x);

describe('contágio (capítulo 4) — matemática pura', () => {
  it('invSmooth inverte smoothstep', () => {
    for (let x = 0; x <= 1.0001; x += 0.05) expect(invSmooth(smoothstep01(Math.min(1, x)))).toBeCloseTo(Math.min(1, x), 6);
  });

  it('a gotícula portadora refaz exatamente o arco do vírion (virusX/virusY) a partir de `droplets`', () => {
    const out = { x: 0, y: 0 };
    let peak = -Infinity;
    for (let l = 0.55; l <= 0.8 + 1e-9; l += 0.005) {
      const s = sceneAt(3 + l);
      expect(dropletTravel(s)).toBeCloseTo(s.droplets, 9);
      expect(dropletFade(s)).toBeCloseTo(1, 9);
      carrierPosition(s.droplets, out);
      expect(out.x).toBeCloseTo(s.virusX, 5);
      expect(out.y).toBeCloseTo(s.virusY, 4);
      peak = Math.max(peak, out.y);
    }
    expect(peak).toBeCloseTo(MOUTH_LEFT.y + CARRIER_PEAK, 4);
  });

  it('no capítulo 5 a nuvem não volta: trajeto fica em 1 e só o fade cai com `droplets`', () => {
    for (let l = 0; l <= 0.2; l += 0.01) {
      const s = sceneAt(4 + l);
      expect(dropletTravel(s)).toBe(1);
      expect(dropletFade(s)).toBeCloseTo(s.droplets, 9);
    }
  });

  it('gotículas caem antes da outra pessoa; aerossóis vão mais longe e ficam suspensos', () => {
    const items = makeDroplets(80);
    const big = items.filter((d) => !d.aerosol);
    const fine = items.filter((d) => d.aerosol);
    expect(big.length).toBeGreaterThan(30);
    expect(fine.length).toBeGreaterThan(25);
    const pose = { x: 0, y: 0, z: 0, s: 0 };
    for (const d of items) {
      expect(d.delay + d.dur).toBeLessThanOrEqual(1 + 1e-9);
      // ainda não saiu: invisível na boca
      dropletPose(d, d.delay * 0.5, 0, 0, pose);
      expect(pose.s).toBe(0);
    }
    let bigX = 0;
    let fineX = 0;
    for (const d of big) {
      dropletPose(d, d.delay + d.dur * 0.7, 0, 0, pose);
      expect(pose.x).toBeLessThan(MOUTH_RIGHT.x - 1);
      dropletPose(d, 1, 0, 0, pose);
      expect(pose.s).toBe(0); // caiu (sumiu) antes do fim
      expect(pose.y).toBeLessThan(MOUTH_LEFT.y - 1);
      bigX += pose.x;
    }
    for (const d of fine) {
      dropletPose(d, 1, 0.7, -0.4, pose);
      expect(pose.s).toBeGreaterThan(0); // suspenso
      expect(pose.x).toBeLessThan(MOUTH_RIGHT.x);
      expect(pose.y).toBeGreaterThan(MOUTH_LEFT.y - 0.6);
      fineX += pose.x;
    }
    expect(fineX / fine.length).toBeGreaterThan(bigX / big.length + 0.8);
    // aerossóis demoram mais
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(fine.map((d) => d.delay + d.dur))).toBeGreaterThan(avg(big.map((d) => d.delay + d.dur)));
  });
});

describe('vacina (capítulo 5) — anticorpos', () => {
  it('regra fixa da deriva: i-ésimo valor de seededRandom(29) < 0,35', () => {
    const n = 90;
    const rnd = seededRandom(29);
    const expected = Array.from({ length: n }, () => rnd() < 0.35);
    expect(driftMask(n)).toEqual(expected);
    expect(DRIFT_SEED).toBe(29);
    expect(DRIFT_FRACTION).toBe(0.35);
    // prefixo estável: low (50) é prefixo de high (90)
    expect(driftMask(50)).toEqual(expected.slice(0, 50));
  });

  it('cobre a esfera inteira (inclusive o polo inferior) com ~40% (high) e ~30% (low) das HAs', () => {
    for (const q of ['high', 'low'] as const) {
      const ha = spikeLayout(q).ha;
      const plan = antibodyPlan(ha, q);
      expect(plan.first.length).toBe(Math.round(ha.length * ANTIBODY_SHARE[q]));
      expect(new Set(plan.first).size).toBe(plan.first.length);
      const ys = plan.first.map((i) => ha[i]!.y);
      expect(Math.min(...ys)).toBeLessThan(-0.8);
      expect(Math.max(...ys)).toBeGreaterThan(0.8);
      // equilíbrio entre hemisférios e raio de cobertura pequeno (nenhuma região grande vazia)
      const below = ys.filter((y) => y < 0).length;
      expect(Math.abs(below - plan.first.length / 2)).toBeLessThanOrEqual(plan.first.length * 0.15);
      let cover = 0;
      for (const d of ha) {
        let best = Infinity;
        for (const i of plan.first) best = Math.min(best, Math.hypot(d.x - ha[i]!.x, d.y - ha[i]!.y, d.z - ha[i]!.z));
        cover = Math.max(cover, best);
      }
      expect(cover).toBeLessThan(2.8 / Math.sqrt(plan.first.length));
      // 2.ª leva = exatamente as cabeças vagas (drifted ∩ 1.ª leva)
      const drifted = driftMask(ha.length);
      expect(plan.second).toEqual(plan.first.filter((i) => drifted[i]));
      expect(plan.second.length).toBeGreaterThan(0);
    }
  });

  it('spreadIndices é determinística e respeita limites', () => {
    const ha = spikeLayout('high').ha;
    expect(spreadIndices(ha, 10)).toEqual(spreadIndices(ha, 10));
    expect(spreadIndices(ha, 0)).toEqual([]);
    expect(spreadIndices(ha, 500)).toHaveLength(ha.length);
  });
});
