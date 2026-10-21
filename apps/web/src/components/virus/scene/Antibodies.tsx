'use client';
/**
 * Vacina (capítulo 5), DENTRO do grupo do vírion (coordenadas locais; gira com o yaw e acompanha o `block`):
 *  - `antibodies`: anticorpos em "Y" (verde, PART_COLORS.ok) chegam de fora, cada um com seu atraso, e grudam nas
 *    cabeças da HA, cobrindo a esfera de modo uniforme;
 *  - `drift`: os que estão em HAs com deriva antigênica se soltam e flutuam para fora, sumindo;
 *  - `rebind`: uma segunda leva (verde-água, PART_COLORS.infb) gruda nas cabeças que ficaram vagas.
 * Base: Krammer 2018 — anticorpos contra a cabeça da HA neutralizam bloqueando a ligação ao receptor; a deriva
 * antigênica (mutações na HA) escapa deles (docs/pesquisa/explicador-3d-ciclo-transmissao.md).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seededRandom, smoothstep, type Vec3 } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import { driftMask, spikeTop, type Quality, type SpikeLayout } from '@/lib/virus/pose';
import { UP, smooth, type AmbientRef, type StateRef } from './shared';

// ---------------------------------------------------------------------------------------------------------------
// Regras puras (testadas em test/virus-spread.test.ts, sem WebGL)
// ---------------------------------------------------------------------------------------------------------------

/**
 * REGRA FIXA da deriva antigênica, compartilhada com o vírion (fonte única em lib/virus/pose.ts: `driftMask`):
 * gera-se UMA sequência `seededRandom(DRIFT_SEED = 29)` e a HA de índice i (em `layout.ha`) é "drifted" se o
 * i-ésimo valor sorteado for < DRIFT_FRACTION (0,35). O vírion muda o tom dessas cabeças com `drift`; aqui os
 * anticorpos presos a elas se soltam e a 2.ª leva ocupa as cabeças que ficaram vagas.
 */
/** Fração das HAs que recebem um anticorpo na 1.ª leva. */
export const ANTIBODY_SHARE: Record<Quality, number> = { high: 0.4, low: 0.3 };

/**
 * `count` índices de `dirs` espalhados uniformemente pela esfera (amostragem do ponto mais distante, determinística).
 * Escolher índices em passo fixo não serve: a esfera de Fibonacci é ordenada em y e, em passo fixo, os ângulos
 * formam espirais (faixas vazias) — ou deixam um polo vazio.
 */
export function spreadIndices(dirs: readonly Vec3[], count: number): number[] {
  const n = dirs.length;
  const k = Math.max(0, Math.min(n, Math.round(count)));
  if (k === 0) return [];
  const minD = new Float64Array(n).fill(Infinity);
  const out: number[] = [];
  let next = 0;
  for (let j = 0; j < k; j++) {
    out.push(next);
    const p = dirs[next]!;
    minD[next] = -1;
    let best = -1;
    let bestD = -Infinity;
    for (let i = 0; i < n; i++) {
      if (minD[i]! < 0) continue;
      const q = dirs[i]!;
      const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2;
      if (d < minD[i]!) minD[i] = d;
      if (minD[i]! > bestD) {
        bestD = minD[i]!;
        best = i;
      }
    }
    if (best < 0) break;
    next = best;
  }
  return out;
}

export interface AntibodyPlan {
  /** índices de HA com anticorpo da 1.ª leva (verde) */
  first: number[];
  /** índices de HA que ficam vagos com a deriva e recebem a 2.ª leva (verde-água) */
  second: number[];
}

export function antibodyPlan(haDirs: readonly Vec3[], quality: Quality): AntibodyPlan {
  const first = spreadIndices(haDirs, haDirs.length * ANTIBODY_SHARE[quality]);
  const drifted = driftMask(haDirs.length);
  return { first, second: first.filter((i) => drifted[i]) };
}

// ---------------------------------------------------------------------------------------------------------------
// Geometria e componente
// ---------------------------------------------------------------------------------------------------------------

/**
 * Deslocamento radial das pontas dos braços do Y em relação ao topo da HA (`spikeTop` = topo da cabeça): negativo
 * = as pontas descem um pouco além do topo e a cabeça fica dentro do "V", como um anticorpo agarrando a cabeça.
 */
export const TIP_OFFSET = -0.015;
/** Distância (radial) de onde os anticorpos partem e para onde os soltos flutuam. */
const APPROACH = 2.4;
const FLOAT_AWAY = 2.0;
/** Duração (em unidades do canal) da chegada e do desprendimento de cada anticorpo. */
const ARRIVE = 0.5;
const DETACH = 0.6;

/**
 * Anticorpo IgG em "Y": Fc (haste) + dobradiça + dois Fab (braços). +y local = sentido de ligação: as pontas dos
 * braços ficam em y ≈ 0 e a haste se estende para −y (para fora do vírion depois de orientado).
 */
export function antibodyGeometry(quality: Quality): THREE.BufferGeometry {
  const rs = quality === 'high' ? 10 : 6;
  const cs = quality === 'high' ? 3 : 2;
  const hingeY = -0.15;
  const tipX = 0.1;
  const armLen = Math.hypot(tipX, -hingeY);
  const armAngle = Math.atan2(tipX, -hingeY);
  const parts: THREE.BufferGeometry[] = [
    new THREE.CapsuleGeometry(0.034, 0.1, cs, rs).translate(0, hingeY - 0.085, 0),
    new THREE.SphereGeometry(0.036, rs, Math.max(4, rs - 2)).translate(0, hingeY, 0),
  ];
  for (const side of [-1, 1]) {
    parts.push(
      new THREE.CapsuleGeometry(0.03, armLen - 0.06, cs, rs)
        .rotateZ(-side * armAngle)
        .translate((side * tipX) / 2, hingeY / 2, 0),
    );
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw new Error('antibodyGeometry: mergeGeometries falhou');
  return merged;
}

interface AbItem {
  /** índice da HA em layout.ha */
  ha: number;
  dir: THREE.Vector3;
  /** dois vetores perpendiculares a `dir` (curva de chegada e balanço) */
  tan: THREE.Vector3;
  bin: THREE.Vector3;
  /** orientação presa: +y local → −dir, com giro próprio em torno do eixo */
  qBound: THREE.Quaternion;
  axis: THREE.Vector3;
  tumble: number;
  swing: number;
  delay: number;
  drifted: boolean;
  dDelay: number;
  away: THREE.Vector3;
  spin: number;
  phase: number;
}

function buildItems(haDirs: readonly Vec3[], indices: readonly number[], drifted: readonly boolean[], seed: number, swingSign: 1 | -1, maxDelay: number): AbItem[] {
  const rnd = seededRandom(seed);
  const rv = () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
  return indices.map((h) => {
    const d = haDirs[h]!;
    const dir = new THREE.Vector3(d.x, d.y, d.z).normalize();
    const tan = rv();
    tan.addScaledVector(dir, -dir.dot(tan));
    if (tan.lengthSq() < 1e-8) tan.set(1, 0, 0).addScaledVector(dir, -dir.x);
    tan.normalize();
    const bin = new THREE.Vector3().crossVectors(dir, tan).normalize();
    const roll = rnd() * Math.PI * 2;
    const qBound = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().negate()).multiply(new THREE.Quaternion().setFromAxisAngle(UP, roll));
    const axis = rv();
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0);
    axis.normalize();
    const away = dir.clone().addScaledVector(tan, (rnd() - 0.5) * 1.1).addScaledVector(bin, (rnd() - 0.5) * 1.1).normalize();
    return {
      ha: h,
      dir,
      tan,
      bin,
      qBound,
      axis,
      tumble: (rnd() < 0.5 ? -1 : 1) * (2 + rnd() * 2.5),
      swing: swingSign * (0.7 + rnd() * 0.6),
      delay: rnd() * maxDelay,
      drifted: drifted[h] === true,
      dDelay: rnd() * 0.4,
      away,
      spin: (rnd() - 0.5) * 5,
      phase: rnd() * Math.PI * 2,
    };
  });
}

interface Scratch {
  pos: THREE.Vector3;
  q: THREE.Quaternion;
  qt: THREE.Quaternion;
  scl: THREE.Vector3;
  m: THREE.Matrix4;
}

/** Escreve as matrizes de uma leva: `channel` = chegada (antibodies/rebind), `detach` = drift (0 = presos). */
function writeWave(
  mesh: THREE.InstancedMesh,
  items: readonly AbItem[],
  tops: Float32Array,
  channel: number,
  detach: number,
  wobble: number,
  breath: number,
  t: Scratch,
): void {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const e = smooth((channel - it.delay) / ARRIVE);
    const f = it.drifted && detach > 0 ? smooth((detach - it.dDelay) / DETACH) : 0;
    const sc = e <= 0 ? 0 : smooth(e / 0.35) * (1 - smoothstep(0.35, 1, f));
    if (sc < 1e-4) {
      t.m.makeScale(1e-5, 1e-5, 1e-5);
      mesh.setMatrixAt(i, t.m);
      continue;
    }
    const u = 1 - e;
    const free = u + f;
    const sway = 0.05 * free;
    t.pos
      .set(tops[3 * i]!, tops[3 * i + 1]!, tops[3 * i + 2]!)
      .addScaledVector(it.dir, TIP_OFFSET + APPROACH * u + FLOAT_AWAY * f)
      .addScaledVector(it.tan, it.swing * u * u + sway * wobble * Math.cos(it.phase))
      .addScaledVector(it.bin, sway * breath * Math.sin(it.phase))
      .addScaledVector(it.away, FLOAT_AWAY * 0.35 * f);
    t.qt.setFromAxisAngle(it.axis, it.tumble * u + it.spin * f);
    t.q.copy(it.qBound).multiply(t.qt);
    t.scl.setScalar(sc);
    t.m.compose(t.pos, t.q, t.scl);
    mesh.setMatrixAt(i, t.m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Anticorpos em "Y" que grudam nas cabeças da HA, soltam com a deriva e são substituídos por uma nova leva. */
export function Antibodies({ stateRef, ambientRef, quality, layout }: { stateRef: StateRef; ambientRef: AmbientRef; quality: Quality; layout: SpikeLayout }) {
  const group = useRef<THREE.Group>(null);
  const firstRef = useRef<THREE.InstancedMesh>(null);
  const secondRef = useRef<THREE.InstancedMesh>(null);

  const waves = useMemo(() => {
    const plan = antibodyPlan(layout.ha, quality);
    const drifted = driftMask(layout.ha.length);
    const first = buildItems(layout.ha, plan.first, drifted, 7, 1, 0.45);
    // 2.ª leva: não se solta (drifted = false para a regra de desprendimento) e chega pelo lado oposto
    const second = buildItems(layout.ha, plan.second, [], 41, -1, 0.4);
    return { first, second, tops1: new Float32Array(first.length * 3), tops2: new Float32Array(second.length * 3) };
  }, [layout.ha, quality]);

  const geom = useMemo(() => antibodyGeometry(quality), [quality]);
  const mats = useMemo(() => {
    const base = { roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') };
    return { first: new THREE.MeshPhysicalMaterial({ ...base, color: PART_COLORS.ok }), second: new THREE.MeshPhysicalMaterial({ ...base, color: PART_COLORS.infb }) };
  }, []);
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const scratch = useMemo<Scratch>(() => ({ pos: new THREE.Vector3(), q: new THREE.Quaternion(), qt: new THREE.Quaternion(), scl: new THREE.Vector3(), m: new THREE.Matrix4() }), []);
  // cache por valor; malhas e levas entram na chave (reset ao mudar quality/layout)
  const cache = useRef({ a: NaN, dr: NaN, rb: NaN, wobble: NaN, breath: NaN, first: null as THREE.InstancedMesh | null, second: null as THREE.InstancedMesh | null, waves: null as unknown });
  const topsKey = useRef({ openSpikes: NaN, openEnv: NaN, waves: null as unknown });

  useFrame(() => {
    const s = stateRef.current;
    const g = group.current;
    const m1 = firstRef.current;
    const m2 = secondRef.current;
    if (!g || !m1 || !m2) return;
    const a = s.antibodies;
    const visible = a > 0.01;
    g.visible = visible;
    if (!visible) return;
    const rb = s.rebind;
    m2.visible = rb > 0.01 && waves.second.length > 0;

    // topos das HAs: só mudam com openSpikes/openEnv (fixos no capítulo 5) — recalculados fora do caminho quente
    const tk = topsKey.current;
    const topsChanged = tk.waves !== waves || tk.openSpikes !== s.openSpikes || tk.openEnv !== s.openEnv;
    if (topsChanged) {
      tk.waves = waves;
      tk.openSpikes = s.openSpikes;
      tk.openEnv = s.openEnv;
      const fill = (items: readonly AbItem[], out: Float32Array) => {
        for (let i = 0; i < items.length; i++) {
          const top = spikeTop('ha', layout.ha[items[i]!.ha]!, s);
          out[3 * i] = top.x;
          out[3 * i + 1] = top.y;
          out[3 * i + 2] = top.z;
        }
      };
      fill(waves.first, waves.tops1);
      fill(waves.second, waves.tops2);
    }

    const dr = s.drift;
    const amb = ambientRef.current;
    // a ondulação só importa enquanto há anticorpos soltos (chegando, soltando ou regrudando)
    const moving = (a > 0 && a < 1) || (dr > 0 && dr < 1) || (rb > 0 && rb < 1);
    const wobble = moving ? amb.wobble : 0;
    const breath = moving ? amb.breath : 0;
    const c = cache.current;
    if (!topsChanged && c.first === m1 && c.second === m2 && c.waves === waves && c.a === a && c.dr === dr && c.rb === rb && c.wobble === wobble && c.breath === breath) return;
    c.first = m1;
    c.second = m2;
    c.waves = waves;
    c.a = a;
    c.dr = dr;
    c.rb = rb;
    c.wobble = wobble;
    c.breath = breath;

    m1.count = waves.first.length;
    m2.count = waves.second.length;
    writeWave(m1, waves.first, waves.tops1, a, dr, wobble, breath, scratch);
    if (m2.visible) writeWave(m2, waves.second, waves.tops2, rb, 0, wobble, breath, scratch);
  });

  return (
    <group ref={group} visible={false}>
      <instancedMesh key={`ab1-${quality}-${waves.first.length}`} ref={firstRef} args={[geom, mats.first, Math.max(1, waves.first.length)]} frustumCulled={false} />
      <instancedMesh key={`ab2-${quality}-${waves.second.length}`} ref={secondRef} args={[geom, mats.second, Math.max(1, waves.second.length)]} frustumCulled={false} visible={false} />
    </group>
  );
}
