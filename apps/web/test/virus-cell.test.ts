import { describe, expect, it } from 'vitest';
import { CONTACT_X, DOCK_GAP, NUCLEUS, POSES, VESICLE_RADIUS, sceneAt } from '@/lib/virus/choreography';
import { REST } from '@/lib/virus/scenestate';
import {
  BUD_RADIUS,
  CELL_RADIUS,
  NUCLEUS_RADIUS,
  RECEPTOR_CAP_SIN,
  SLIDE_IN,
  VIRION_OUTER,
  budOffset,
  budPhase,
  budSpots,
  cellCenterX,
  emptyBudPhase,
  emptyPlacement,
  placeReceptor,
  receptorDirs,
  vesiclePresence,
  wallFade,
  wallNearX,
} from '@/components/virus/scene/cell-geometry';

const docked = { membrane: 1, dock: 1, engulf: 0, bud: 0 };

describe('parede de membrana', () => {
  it('posição: entra pela direita, encaixa em CONTACT_X e abre a folga com dock = 0', () => {
    expect(wallNearX(docked)).toBeCloseTo(CONTACT_X, 9);
    expect(wallNearX({ ...docked, dock: 0 })).toBeCloseTo(CONTACT_X + DOCK_GAP, 9);
    expect(wallNearX({ ...docked, dock: 0, membrane: 0 })).toBeCloseTo(CONTACT_X + DOCK_GAP + SLIDE_IN, 9);
    expect(cellCenterX(docked)).toBeCloseTo(CONTACT_X + CELL_RADIUS, 9);
  });

  it('sem engulf a parede nunca atravessa o vírion', () => {
    for (let p = 0; p < 5; p += 0.01) {
      const s = sceneAt(p);
      if (s.engulf === 0 && s.membrane > 0.01) expect(wallNearX(s)).toBeGreaterThanOrEqual(CONTACT_X - 1e-9);
    }
  });

  it('fim do capítulo 3: a vesícula inteira (com o vírion) está dentro da célula e a parede está lisa', () => {
    const s = POSES[2]!;
    expect(vesiclePresence(s)).toBe(1);
    // parede além da vesícula: não há interseção (covinha fechada)
    expect(wallNearX(s)).toBeLessThan(-VESICLE_RADIUS);
    // vesícula contida na esfera da célula
    expect(Math.abs(cellCenterX(s)) + VESICLE_RADIUS).toBeLessThan(CELL_RADIUS);
  });

  it('brotamento: a parede fica onde está (engolida) e a vesícula permanece', () => {
    const s = { ...POSES[2]!, bud: 1 };
    expect(wallNearX(s)).toBeLessThan(-VESICLE_RADIUS);
    expect(vesiclePresence(s)).toBe(1);
  });

  it('o núcleo sugerido fica dentro da célula nas duas posições da parede', () => {
    for (const s of [POSES[2]!, { ...POSES[2]!, bud: 1 }, { ...REST, membrane: 1, dock: 1 }]) {
      const cx = cellCenterX(s);
      const d = Math.hypot(NUCLEUS.x - cx, NUCLEUS.y, NUCLEUS.z);
      expect(d + NUCLEUS_RADIUS).toBeLessThan(CELL_RADIUS);
    }
  });

  it('é contínua ao longo da rolagem (sem saltos) e esmaece no retorno do brotamento', () => {
    const h = 0.0001;
    let prev = wallNearX(sceneAt(0));
    for (let p = h; p < 5; p += h) {
      const x = wallNearX(sceneAt(p));
      expect(Math.abs(x - prev)).toBeLessThan(0.025);
      prev = x;
    }
    expect(wallFade(0)).toBe(1);
    expect(wallFade(1)).toBeCloseTo(1, 9);
    expect(Math.min(...[0.05, 0.1, 0.15, 0.2].map(wallFade))).toBeCloseTo(1, 9);
  });
});

describe('receptores', () => {
  it('girassol na calota voltada para o vírion, do centro para a borda', () => {
    for (const n of [24, 44]) {
      const dirs = receptorDirs(n);
      expect(dirs).toHaveLength(n);
      let prevR = -1;
      for (const d of dirs) {
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
        expect(d.x).toBeLessThan(-Math.sqrt(1 - RECEPTOR_CAP_SIN ** 2) + 1e-9);
        const r = Math.hypot(d.y, d.z);
        expect(r).toBeGreaterThan(prevR);
        prevR = r;
      }
    }
    expect(() => receptorDirs(-1)).toThrow();
  });

  it('no encaixe ficam na parede, visíveis, apontando para fora da célula', () => {
    const out = emptyPlacement();
    const cx = cellCenterX(docked);
    for (const d of receptorDirs(44)) {
      placeReceptor(d, cx, 0, out);
      expect(out.vis).toBe(1);
      expect(out.bound).toBe(0);
      expect(out.nx).toBeLessThan(0);
      expect(Math.hypot(out.x - cx, out.y, out.z)).toBeCloseTo(CELL_RADIUS, 9);
    }
  });

  it('com a vesícula fechada: os da coluna do vírion presos ao cálice, os demais longe do vírion', () => {
    const out = emptyPlacement();
    const s = POSES[2]!;
    const cx = cellCenterX(s);
    let bound = 0;
    for (const d of receptorDirs(44)) {
      placeReceptor(d, cx, vesiclePresence(s), out);
      const r = Math.hypot(out.x, out.y, out.z);
      if (Math.hypot(out.y, out.z) < VESICLE_RADIUS) {
        bound++;
        expect(r).toBeCloseTo(VESICLE_RADIUS, 6);
        // aponta para o vírion
        expect(out.nx * out.x + out.ny * out.y + out.nz * out.z).toBeLessThan(0);
      } else {
        expect(r).toBeGreaterThan(VIRION_OUTER);
      }
    }
    expect(bound).toBeGreaterThanOrEqual(3);
  });

  it('nunca aparecem dentro do vírion ao longo da rolagem', () => {
    const out = emptyPlacement();
    const dirs = receptorDirs(44);
    for (let p = 2; p < 5; p += 0.002) {
      const s = sceneAt(p);
      if (s.membrane <= 0.01) continue;
      const cx = cellCenterX(s);
      const pres = vesiclePresence(s);
      for (const d of dirs) {
        placeReceptor(d, cx, pres, out);
        if (out.vis > 0) expect(Math.hypot(out.x, out.y, out.z)).toBeGreaterThan(1.05);
      }
    }
  });
});

describe('brotos', () => {
  it('fases em [0, 1], escalonadas, nulas em bud = 0 e completas em bud = 1', () => {
    const ph = emptyBudPhase();
    for (const n of [4, 6]) {
      for (let j = 0; j < n; j++) {
        budPhase(0, j, n, ph);
        expect([ph.grow, ph.detach, ph.glow]).toEqual([0, 0, 0]);
        budPhase(1, j, n, ph);
        expect(ph.grow).toBe(1);
        expect(ph.detach).toBe(1);
        expect(ph.glow).toBe(0);
      }
      // o primeiro broto começa antes do último
      const a = budPhase(0.45, 0, n, emptyBudPhase()).grow;
      const b = budPhase(0.45, n - 1, n, emptyBudPhase()).grow;
      expect(a).toBeGreaterThan(b);
    }
  });

  it('o pulso rosa acontece durante a soltura', () => {
    const ph = emptyBudPhase();
    let peak = 0;
    for (let b = 0; b <= 1; b += 0.005) {
      budPhase(b, 0, 6, ph);
      for (const v of [ph.grow, ph.detach, ph.glow, ph.glowT]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      if (ph.glow > peak) peak = ph.glow;
      if (ph.glow > 0) expect(ph.detach).toBeGreaterThan(0);
    }
    expect(peak).toBeGreaterThan(0.9);
  });

  it('brotos soltos ficam fora da parede e longe do vírion original', () => {
    const cx = cellCenterX({ ...POSES[2]!, bud: 1 });
    for (const sp of budSpots(6)) {
      expect(Math.hypot(sp.n.x, sp.n.y, sp.n.z)).toBeCloseTo(1, 9);
      expect(sp.n.x).toBeLessThan(0);
      const off = budOffset(1, 1);
      const c = { x: cx - sp.off + sp.n.x * off, y: sp.y + sp.n.y * off, z: sp.z + sp.n.z * off };
      // centro fora da célula, a mais de um raio da parede
      expect(Math.hypot(c.x - cx, c.y, c.z) - CELL_RADIUS).toBeGreaterThan(BUD_RADIUS);
      expect(Math.hypot(c.x, c.y, c.z)).toBeGreaterThan(VIRION_OUTER + BUD_RADIUS);
    }
    expect(budSpots(4)).toHaveLength(4);
  });
});
