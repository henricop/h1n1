'use client';
/**
 * O vírion A(H1N1): envelope pleomórfico em duas metades (bicamada translúcida), camada M1 opaca e fosca logo
 * abaixo, espinhos HA (trímeros) e NA (tetrâmeros) instanciados com cor por instância, poucos canais M2 e 8 RNPs
 * em contas (7+1). Tudo lê `stateRef`/`ambientRef` dentro de useFrame (sem setState); o pai aplica yaw/posição/
 * escala. Posições vêm de lib/virus/pose.ts (fonte única com rótulos e anticorpos).
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { NUCLEUS } from '@/lib/virus/choreography';
import { clamp01, seededRandom, type Vec3 } from '@/lib/virus/geometry';
import { PART_COLORS, type PartId } from '@/lib/virus/parts';
import {
  HALF_SHIFT,
  M1_SHIFT,
  RNP_COUNT,
  RNP_FAN,
  driftMask,
  rnpFanCenter,
  rnpLength,
  rnpOpenT,
  rnpReleaseT,
  rnpRestCenter,
  spikeBaseInto,
  type Quality,
  type SpikeLayout,
} from '@/lib/virus/pose';
import { beadGeometry, envelopeHalves, haGeometry, m2Geometry, matrixHalves, naGeometry, seamGeometry } from './geometries';
import { UP, smooth, type AmbientRef, type StateRef } from './shared';

export interface VirionProps {
  stateRef: StateRef;
  ambientRef: AmbientRef;
  quality: Quality;
  /** `spikeLayout(quality)` calculado pelo pai e compartilhado com rótulos e anticorpos. */
  layout: SpikeLayout;
  hovered: PartId | null;
  selected: PartId | null;
  onHover: (p: PartId | null) => void;
  onSelect: (p: PartId) => void;
}

/** Tokens de globals.css usados só aqui (os demais vêm de PART_COLORS). */
const PRIMARY_500 = '#3b6cf0';
const ENVELOPE_TINT = '#dde6f3';
const ENVELOPE_ATTENUATION = '#b3c4ea';
const WHITE = new THREE.Color('#ffffff');
const EPS = 1e-3;

interface Pointer {
  over: (e: ThreeEvent<PointerEvent>) => void;
  out: () => void;
  click: (e: ThreeEvent<MouseEvent>) => void;
}

function usePointer(id: PartId, onHover: VirionProps['onHover'], onSelect: VirionProps['onSelect']): Pointer {
  return useMemo(
    () => ({
      over: (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(id);
      },
      out: () => onHover(null),
      click: (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(id);
      },
    }),
    [id, onHover, onSelect],
  );
}

function useDispose(...items: Array<{ dispose(): void }>): void {
  useEffect(
    () => () => items.forEach((i) => i.dispose()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    items,
  );
}

/** Rim fresnel discreto (sem dependência nova): emissivo += tom claro · (1 − |N·V|)³ · uRim. */
const RIM = { value: 0.24 };
function withRim(mat: THREE.Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = RIM;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ float rimF = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0); totalEmissiveRadiance += vec3(0.62, 0.71, 0.9) * rimF * uRim; }',
      );
  };
  mat.customProgramCacheKey = () => 'virion-rim';
}

function envelopeMaterial(quality: Quality): THREE.MeshPhysicalMaterial {
  const mat =
    quality === 'high'
      ? new THREE.MeshPhysicalMaterial({
          color: ENVELOPE_TINT,
          roughness: 0.42,
          metalness: 0,
          transmission: 0.75,
          thickness: 0.6,
          ior: 1.38,
          attenuationColor: new THREE.Color(ENVELOPE_ATTENUATION),
          attenuationDistance: 1.6,
          sheen: 0.5,
          sheenColor: WHITE,
          sheenRoughness: 0.7,
          clearcoat: 0.35,
          clearcoatRoughness: 0.4,
          specularIntensity: 0.7,
          iridescence: 0.12,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(PART_COLORS.primary),
          emissiveIntensity: 0,
        })
      : new THREE.MeshPhysicalMaterial({
          color: ENVELOPE_TINT,
          roughness: 0.5,
          metalness: 0,
          clearcoat: 0.2,
          clearcoatRoughness: 0.5,
          sheen: 0.3,
          sheenColor: WHITE,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(PART_COLORS.primary),
          emissiveIntensity: 0,
        });
  withRim(mat);
  return mat;
}

function spikeMaterial(base: string): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: WHITE,
    vertexColors: true,
    roughness: 0.45,
    metalness: 0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.45,
    sheen: 0.3,
    sheenColor: WHITE,
    sheenRoughness: 0.6,
    emissive: new THREE.Color(base),
    emissiveIntensity: 0,
  });
}

// ---------------------------------------------------------------------------------------------------------

/** Envelope lipídico pleomórfico em dois hemisférios + anel fino na costura (opacidade = openEnv). */
function Envelope({ stateRef, quality, active, pointer }: { stateRef: StateRef; quality: Quality; active: boolean; pointer: Pointer }) {
  const halves = useMemo(() => envelopeHalves(quality), [quality]);
  const seam = useMemo(() => seamGeometry(quality), [quality]);
  const material = useMemo(() => envelopeMaterial(quality), [quality]);
  const seamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PART_COLORS.envelopeEdge, transparent: true, opacity: 0, depthWrite: false }), []);
  useDispose(halves.top, halves.bottom, seam, material, seamMat);
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  const ringTop = useRef<THREE.Mesh>(null);
  const ringBottom = useRef<THREE.Mesh>(null);
  const baseOpacity = quality === 'high' ? 1 : 0.7;
  useFrame(() => {
    const s = stateRef.current;
    const y = s.openEnv * HALF_SHIFT;
    if (top.current) top.current.position.y = y;
    if (bottom.current) bottom.current.position.y = -y;
    const fade = 1 - 0.75 * s.uncoat;
    material.opacity = baseOpacity * fade;
    material.transparent = quality === 'low' || s.uncoat > 0.005;
    material.emissiveIntensity = active ? 0.14 : 0;
    const ring = s.openEnv > 0.005;
    seamMat.opacity = s.openEnv * fade;
    if (ringTop.current) {
      ringTop.current.visible = ring;
      ringTop.current.position.y = y;
    }
    if (ringBottom.current) {
      ringBottom.current.visible = ring;
      ringBottom.current.position.y = -y;
    }
  });
  return (
    <>
      <mesh ref={top} geometry={halves.top} material={material} frustumCulled={false} onPointerOver={pointer.over} onPointerOut={pointer.out} onClick={pointer.click} />
      <mesh ref={bottom} geometry={halves.bottom} material={material} frustumCulled={false} onPointerOver={pointer.over} onPointerOut={pointer.out} onClick={pointer.click} />
      <mesh ref={ringTop} geometry={seam} material={seamMat} frustumCulled={false} visible={false} />
      <mesh ref={ringBottom} geometry={seam} material={seamMat} frustumCulled={false} visible={false} />
    </>
  );
}

/** Camada M1: opaca (aparece através da transmissão do envelope), fosca, com lacunas sutis; abre com openM1. */
function Matrix({ stateRef, quality, active, pointer }: { stateRef: StateRef; quality: Quality; active: boolean; pointer: Pointer }) {
  const halves = useMemo(() => matrixHalves(quality), [quality]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PART_COLORS.m1,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(PART_COLORS.primary),
        emissiveIntensity: 0,
      }),
    [],
  );
  useDispose(halves.top, halves.bottom, material);
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = stateRef.current;
    const y = s.openM1 * M1_SHIFT;
    if (top.current) top.current.position.y = y;
    if (bottom.current) bottom.current.position.y = -y;
    material.opacity = 1 - 0.75 * s.uncoat;
    material.transparent = s.uncoat > 0.005;
    material.emissiveIntensity = active ? 0.16 : 0;
  });
  return (
    <>
      <mesh ref={top} geometry={halves.top} material={material} frustumCulled={false} onPointerOver={pointer.over} onPointerOut={pointer.out} onClick={pointer.click} />
      <mesh ref={bottom} geometry={halves.bottom} material={material} frustumCulled={false} onPointerOver={pointer.over} onPointerOut={pointer.out} onClick={pointer.click} />
    </>
  );
}

/** Variação determinística por instância (giro em torno do próprio eixo e tamanho ±5 %). */
function useInstanceJitter(dirs: readonly Vec3[], seed: number): { roll: Float32Array; size: Float32Array } {
  return useMemo(() => {
    const rnd = seededRandom(seed);
    const roll = new Float32Array(dirs.length);
    const size = new Float32Array(dirs.length);
    for (let i = 0; i < dirs.length; i++) {
      roll[i] = rnd() * Math.PI * 2;
      size[i] = 0.95 + rnd() * 0.1;
    }
    return { roll, size };
  }, [dirs, seed]);
}

/** Espinhos HA ou NA instanciados: pose por `spikeBaseInto`, cor por instância (realce, deriva, hover). */
function Spikes({
  kind,
  dirs,
  stateRef,
  ambientRef,
  quality,
  active,
  pointer,
}: {
  kind: 'ha' | 'na';
  dirs: readonly Vec3[];
  stateRef: StateRef;
  ambientRef: AmbientRef;
  quality: Quality;
  active: boolean;
  pointer: Pointer;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => (kind === 'ha' ? haGeometry(quality) : naGeometry(quality)), [kind, quality]);
  const baseHex = kind === 'ha' ? PART_COLORS.primary : PART_COLORS.h1n1;
  const material = useMemo(() => spikeMaterial(baseHex), [baseHex]);
  useDispose(geom, material);
  const jitter = useInstanceJitter(dirs, kind === 'ha' ? 31 : 37);
  const drift = useMemo(() => (kind === 'ha' ? driftMask(dirs.length) : null), [kind, dirs.length]);
  const scratch = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      dir: new THREE.Vector3(),
      base: { x: 0, y: 0, z: 0 } as Vec3,
      c: new THREE.Color(),
      baseC: new THREE.Color(baseHex),
      hiC: kind === 'ha' ? new THREE.Color(PRIMARY_500) : new THREE.Color(PART_COLORS.h1n1).lerp(WHITE, 0.42),
      driftC: new THREE.Color(PART_COLORS.h3),
    }),
    [baseHex, kind],
  );
  const applied = useRef({ openSpikes: -1, openEnv: -1, pulse: -1, drift: -1, dock: -1, active: false, colored: false });
  // caches `applied` resetados quando layout/qualidade mudam (a malha é remontada pela `key`)
  useEffect(() => {
    applied.current = { openSpikes: -1, openEnv: -1, pulse: -1, drift: -1, dock: -1, active: false, colored: false };
  }, [dirs, geom]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = stateRef.current;
    const a = ambientRef.current;
    const ap = applied.current;
    const { dummy, dir, base, c, baseC, hiC, driftC } = scratch;

    if (Math.abs(s.openSpikes - ap.openSpikes) > EPS * 0.1 || Math.abs(s.openEnv - ap.openEnv) > EPS * 0.1) {
      ap.openSpikes = s.openSpikes;
      ap.openEnv = s.openEnv;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i]!;
        spikeBaseInto(kind, d, s, base);
        dir.set(d.x, d.y, d.z);
        dummy.position.set(base.x, base.y, base.z);
        dummy.quaternion.setFromUnitVectors(UP, dir);
        dummy.rotateY(jitter.roll[i]!);
        dummy.scale.setScalar(jitter.size[i]!);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      // a esfera de colisão do InstancedMesh é calculada uma vez no raycast: invalida ao mover os espinhos
      m.boundingSphere = null;
    }

    const hl = kind === 'ha' ? s.hlHa : s.hlNa;
    const pulse = hl > 0.001 ? hl * (0.72 + 0.28 * Math.sin(a.t * 7 + (kind === 'ha' ? 0 : 1.1))) : 0;
    const driftK = kind === 'ha' ? s.drift : 0;
    // encaixe (capítulo 3): as HAs voltadas para a membrana (+x no quadro micro; yaw já assentado) acendem
    const dockK = kind === 'ha' ? s.dock * (1 - s.engulf) : 0;
    if (!ap.colored || Math.abs(pulse - ap.pulse) > EPS || Math.abs(driftK - ap.drift) > EPS || Math.abs(dockK - ap.dock) > EPS || active !== ap.active) {
      ap.pulse = pulse;
      ap.drift = driftK;
      ap.dock = dockK;
      ap.active = active;
      ap.colored = true;
      for (let i = 0; i < dirs.length; i++) {
        c.copy(baseC);
        if (drift && drift[i]) c.lerp(driftC, driftK);
        if (pulse > 0) c.lerp(hiC, pulse);
        if (dockK > 0) {
          const facing = (dirs[i]!.x - 0.78) / 0.22;
          if (facing > 0) c.lerp(hiC, Math.min(1, facing) * dockK * 0.9);
        }
        if (active) c.lerp(WHITE, 0.14);
        m.setColorAt(i, c);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      material.emissiveIntensity = (active ? 0.22 : 0) + pulse * 0.12;
    }
  });

  return (
    <instancedMesh
      key={`${kind}-${quality}-${dirs.length}`}
      ref={mesh}
      args={[geom, material, dirs.length]}
      frustumCulled={false}
      onPointerOver={pointer.over}
      onPointerOut={pointer.out}
      onClick={pointer.click}
    />
  );
}

/** Canais M2: poucos cilindros discretos; piscam (ambient.blink) durante `uncoat`. */
function Channels({
  dirs,
  stateRef,
  ambientRef,
  quality,
  active,
  pointer,
}: {
  dirs: readonly Vec3[];
  stateRef: StateRef;
  ambientRef: AmbientRef;
  quality: Quality;
  active: boolean;
  pointer: Pointer;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => m2Geometry(quality), [quality]);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: PART_COLORS.m2,
        roughness: 0.6,
        metalness: 0,
        clearcoat: 0.15,
        emissive: new THREE.Color(PART_COLORS.primary),
        emissiveIntensity: 0,
      }),
    [],
  );
  useDispose(geom, material);
  const jitter = useInstanceJitter(dirs, 43);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), dir: new THREE.Vector3(), base: { x: 0, y: 0, z: 0 } as Vec3, baseC: new THREE.Color(PART_COLORS.m2), hiC: new THREE.Color(PART_COLORS.primary) }), []);
  const applied = useRef({ openSpikes: -1, openEnv: -1 });
  useEffect(() => {
    applied.current = { openSpikes: -1, openEnv: -1 };
  }, [dirs, geom]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = stateRef.current;
    const a = ambientRef.current;
    const ap = applied.current;
    const { dummy, dir, base, baseC, hiC } = scratch;
    if (Math.abs(s.openSpikes - ap.openSpikes) > EPS * 0.1 || Math.abs(s.openEnv - ap.openEnv) > EPS * 0.1) {
      ap.openSpikes = s.openSpikes;
      ap.openEnv = s.openEnv;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i]!;
        spikeBaseInto('m2', d, s, base);
        dir.set(d.x, d.y, d.z);
        dummy.position.set(base.x, base.y, base.z);
        dummy.quaternion.setFromUnitVectors(UP, dir);
        dummy.scale.setScalar(jitter.size[i]!);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      m.boundingSphere = null;
    }
    const blink = s.uncoat * a.blink;
    material.color.copy(baseC).lerp(hiC, blink * 0.85);
    material.emissiveIntensity = blink * 0.35 + (active ? 0.3 : 0);
  });
  return (
    <instancedMesh
      key={`m2-${quality}-${dirs.length}`}
      ref={mesh}
      args={[geom, material, dirs.length]}
      frustumCulled={false}
      onPointerOver={pointer.over}
      onPointerOut={pointer.out}
      onClick={pointer.click}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------
// RNPs: contas de NP numa hélice ao longo de um eixo levemente curvo; alça numa ponta, polimerase na outra.

interface RnpBeads {
  count: number;
  /** matriz local de cada conta (posição + escala) dentro do quadro da sua RNP */
  local: THREE.Matrix4[];
  /** índice da RNP de cada conta */
  owner: Uint8Array;
  /** cor base de cada conta */
  color: THREE.Color[];
  rest: THREE.Vector3[];
  fan: THREE.Vector3[];
  target: THREE.Vector3[];
  roll: number[];
  tiltX: number[];
  tiltZ: number[];
}

function buildRnpBeads(quality: Quality): RnpBeads {
  const rnd = seededRandom(41);
  const spacing = quality === 'high' ? 0.05 : 0.062;
  const beadR = quality === 'high' ? 0.042 : 0.05;
  const helixR = 0.03;
  const local: THREE.Matrix4[] = [];
  const owner: number[] = [];
  const color: THREE.Color[] = [];
  const rest: THREE.Vector3[] = [];
  const fan: THREE.Vector3[] = [];
  const target: THREE.Vector3[] = [];
  const roll: number[] = [];
  const tiltX: number[] = [];
  const tiltZ: number[] = [];
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const ink = new THREE.Color(PART_COLORS.ink);
  const push = (k: number, x: number, y: number, z: number, r: number, col: THREE.Color) => {
    local.push(new THREE.Matrix4().compose(p.set(x, y, z), q, sc.setScalar(r)));
    owner.push(k);
    color.push(col);
  };
  for (let k = 0; k < RNP_COUNT; k++) {
    const L = rnpLength(k);
    const n = Math.max(8, Math.round(L / spacing));
    const turns = L / 0.11;
    const bow = 0.05 * L;
    const phase = k * 1.7;
    const base = new THREE.Color(k % 2 === 0 ? PART_COLORS.infb : PART_COLORS.h3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const ang = phase + t * turns * Math.PI * 2;
      push(k, bow * Math.sin(Math.PI * t) + helixR * Math.cos(ang), (t - 0.5) * L, helixR * Math.sin(ang), beadR, base);
    }
    // alça numa ponta (5 contas num anel pequeno)
    const loopC = base.clone().lerp(WHITE, 0.18);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      push(k, Math.cos(ang) * 0.045, L / 2 + 0.05, Math.sin(ang) * 0.045, beadR * 0.8, loopC);
    }
    // polimerase (nódulo) na outra ponta
    push(k, 0, -L / 2 - 0.05, 0, beadR * 1.9, base.clone().lerp(ink, 0.45));
    const r0 = rnpRestCenter(k);
    const f0 = rnpFanCenter(k);
    rest.push(new THREE.Vector3(r0.x, r0.y, r0.z));
    fan.push(new THREE.Vector3(f0.x, f0.y, f0.z));
    target.push(new THREE.Vector3(NUCLEUS.x + (k % 2) * 0.15, NUCLEUS.y + ((k % 3) - 1) * 0.14, NUCLEUS.z + (((k * 5) % 4) - 1.5) * 0.12));
    roll.push(rnd() * Math.PI * 2);
    tiltX.push((rnd() - 0.5) * 0.2);
    tiltZ.push((rnd() - 0.5) * 0.2);
  }
  return { count: local.length, local, owner: Uint8Array.from(owner), color, rest, fan, target, roll, tiltX, tiltZ };
}

/** 8 RNPs em contas instanciadas: leque escalonado (openRnp) e saída em fila rumo ao núcleo (release). */
function Rnps({ stateRef, quality, active, pointer }: { stateRef: StateRef; quality: Quality; active: boolean; pointer: Pointer }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => beadGeometry(quality), [quality]);
  const beads = useMemo(() => buildRnpBeads(quality), [quality]);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: WHITE,
        roughness: 0.5,
        metalness: 0,
        clearcoat: 0.15,
        sheen: 0.2,
        sheenColor: WHITE,
        emissive: new THREE.Color(PART_COLORS.infb),
        emissiveIntensity: 0,
      }),
    [],
  );
  useDispose(geom, material);
  const scratch = useMemo(
    () => ({
      obj: new THREE.Object3D(),
      m: new THREE.Matrix4(),
      c: new THREE.Color(),
      fadeC: new THREE.Color(PART_COLORS.cell),
      pos: new THREE.Vector3(),
      rnpM: Array.from({ length: RNP_COUNT }, () => new THREE.Matrix4()),
      fade: new Float32Array(RNP_COUNT),
    }),
    [],
  );
  const applied = useRef({ openRnp: -1, release: -1, active: false });
  useEffect(() => {
    applied.current = { openRnp: -1, release: -1, active: false };
  }, [beads, geom]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = stateRef.current;
    const ap = applied.current;
    if (Math.abs(s.openRnp - ap.openRnp) < EPS * 0.1 && Math.abs(s.release - ap.release) < EPS * 0.1 && active === ap.active) return;
    ap.openRnp = s.openRnp;
    ap.release = s.release;
    ap.active = active;
    const { obj, m: tmp, c, fadeC, rnpM, fade } = scratch;
    for (let k = 0; k < RNP_COUNT; k++) {
      const t = rnpOpenT(s.openRnp, k);
      const rt = smooth(rnpReleaseT(s.release, k));
      obj.position.lerpVectors(beads.rest[k]!, beads.fan[k]!, t);
      obj.rotation.set(beads.tiltX[k]! * (1 - t), beads.roll[k]!, beads.tiltZ[k]! * (1 - t) + RNP_FAN.tilt * (k - (RNP_COUNT - 1) / 2) * t);
      let shrink = 1;
      if (rt > 0) {
        obj.position.lerp(beads.target[k]!, rt);
        obj.position.y += Math.sin(Math.PI * rt) * 0.3;
        obj.rotation.z += -Math.PI / 2 * rt;
        shrink = 1 - smooth((rt - 0.72) / 0.28);
      }
      obj.scale.setScalar(Math.max(1e-4, shrink));
      obj.updateMatrix();
      rnpM[k]!.copy(obj.matrix);
      fade[k] = smooth((rt - 0.45) / 0.55);
    }
    for (let i = 0; i < beads.count; i++) {
      const k = beads.owner[i]!;
      tmp.multiplyMatrices(rnpM[k]!, beads.local[i]!);
      m.setMatrixAt(i, tmp);
      c.copy(beads.color[i]!);
      const f = fade[k]!;
      if (f > 0) c.lerp(fadeC, f);
      if (active) c.lerp(WHITE, 0.16);
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    m.boundingSphere = null;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    material.emissiveIntensity = active ? 0.2 : 0;
  });

  return (
    <instancedMesh
      key={`rnp-${quality}-${beads.count}`}
      ref={mesh}
      args={[geom, material, beads.count]}
      frustumCulled={false}
      onPointerOver={pointer.over}
      onPointerOut={pointer.out}
      onClick={pointer.click}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------

/** Todas as peças do vírion, dentro do grupo que gira (o pai aplica yaw/posição/escala). */
export function Virion({ stateRef, ambientRef, quality, layout, hovered, selected, onHover, onSelect }: VirionProps) {
  useCursor(hovered !== null);
  const breath = useRef<THREE.Group>(null);
  const isActive = (id: PartId) => hovered === id || selected === id;
  const pEnv = usePointer('envelope', onHover, onSelect);
  const pM1 = usePointer('m1', onHover, onSelect);
  const pHa = usePointer('ha', onHover, onSelect);
  const pNa = usePointer('na', onHover, onSelect);
  const pM2 = usePointer('m2', onHover, onSelect);
  const pRna = usePointer('rna', onHover, onSelect);

  // respiração: ±0,8 % de escala com ambient.breath enquanto o vírion gira livre (spin > 0,05)
  useFrame(() => {
    const g = breath.current;
    if (!g) return;
    const s = stateRef.current;
    const a = ambientRef.current;
    const k = clamp01((s.spin - 0.05) / 0.1);
    g.scale.setScalar(1 + 0.008 * a.breath * k);
  });

  return (
    <group ref={breath}>
      <Envelope stateRef={stateRef} quality={quality} active={isActive('envelope')} pointer={pEnv} />
      <Matrix stateRef={stateRef} quality={quality} active={isActive('m1')} pointer={pM1} />
      <Spikes kind="ha" dirs={layout.ha} stateRef={stateRef} ambientRef={ambientRef} quality={quality} active={isActive('ha')} pointer={pHa} />
      <Spikes kind="na" dirs={layout.na} stateRef={stateRef} ambientRef={ambientRef} quality={quality} active={isActive('na')} pointer={pNa} />
      <Channels dirs={layout.m2} stateRef={stateRef} ambientRef={ambientRef} quality={quality} active={isActive('m2')} pointer={pM2} />
      <Rnps stateRef={stateRef} quality={quality} active={isActive('rna')} pointer={pRna} />
    </group>
  );
}
