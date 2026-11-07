'use client';
/**
 * O vírion A(H1N1): envelope pleomórfico em duas metades (bicamada translúcida), camada M1 opaca e fosca logo
 * abaixo, espinhos HA (trímeros) e NA (tetrâmeros) instanciados com cor por instância, poucos canais M2 e 8 RNPs
 * em contas (7+1). Tudo lê `stateRef`/`ambientRef`/`lookRef` dentro de useFrame (sem setState); o pai aplica
 * yaw/posição/escala. Posições vêm de lib/virus/pose.ts (fonte única com rótulos e anticorpos).
 *
 * v4: sem emissive em lugar nenhum. "Acende" (hover, seleção, realce do capítulo 1, encaixe) = realce FOSCO de
 * albedo; "pisca" dos M2 ≤ 1 Hz; no tema escuro as peças coloridas clareiam o albedo (`look.lift`) e o contorno
 * fresnel do envelope é mistura de albedo (iluminada), não luz própria. Cada espinho tem micro-variação de
 * inclinação, altura, largura e tom (`spikeJitter`), como proteínas reais.
 */
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { NUCLEUS, PULSE_HZ } from '@/lib/virus/choreography';
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
  spikeJitter,
  type Quality,
  type SpikeLayout,
} from '@/lib/virus/pose';
import { beadGeometry, envelopeHalves, haGeometry, m2Geometry, matrixHalves, naGeometry, seamGeometry } from './geometries';
import { UP, setSrgb, setTransparent, smooth, type AmbientRef, type LookRef, type StateRef } from './shared';

export interface VirionProps {
  stateRef: StateRef;
  ambientRef: AmbientRef;
  /** luz/cores do tema vivo (prioridade −11) */
  lookRef: LookRef;
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
/** realce fosco (albedo) do envelope e da M1 em hover/seleção: azul-cobalto claro, sem emissão */
const ENVELOPE_ACTIVE = '#b8cbf6';
const M1_ACTIVE = '#a3b8ee';
const WHITE = new THREE.Color('#ffffff');
const EPS = 1e-3;
/** quanto o realce fosco puxa o albedo das peças instanciadas */
const ACTIVE_MIX = 0.45;

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

/** Uniforms do contorno fresnel (por material; atualizados a cada quadro a partir de `look`). */
interface FresnelUniforms {
  [key: string]: THREE.IUniform;
  uFresnel: THREE.IUniform<number>;
  uFresnelColor: THREE.IUniform<THREE.Color>;
}

/**
 * Contorno fresnel como mistura de ALBEDO (sem dependência nova, sem emissão): a borda puxa a cor difusa para
 * `uFresnelColor` (fria e média no papel, clara no escuro) e continua sendo iluminada pelas luzes do palco.
 */
function withFresnel(mat: THREE.Material, u: FresnelUniforms): void {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFresnel;\nuniform vec3 uFresnelColor;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{ float frNv = abs( dot( normal, normalize( vViewPosition ) ) ); float frK = clamp( pow( 1.0 - frNv, 2.5 ) * uFresnel * 1.8, 0.0, 0.85 ); diffuseColor.rgb = mix( diffuseColor.rgb, uFresnelColor, frK ); }',
      );
  };
  // mesmo código injetado em todas as variantes → programas compartilhados por parâmetros
  mat.customProgramCacheKey = () => 'virion-fresnel-v4';
}

function envelopeMaterial(quality: Quality): { material: THREE.MeshPhysicalMaterial; u: FresnelUniforms } {
  const u: FresnelUniforms = { uFresnel: { value: 0.22 }, uFresnelColor: { value: new THREE.Color(0.68, 0.75, 0.9) } };
  const material =
    quality === 'high'
      ? new THREE.MeshPhysicalMaterial({
          color: ENVELOPE_TINT,
          roughness: 0.38,
          metalness: 0,
          transmission: 0.75,
          thickness: 0.6,
          ior: 1.38,
          attenuationColor: new THREE.Color(ENVELOPE_ATTENUATION),
          attenuationDistance: 1.6,
          // bicamada lipídica: brilho aveludado (sheen) + película fina (iridescência leve) + verniz fosco
          sheen: 0.55,
          sheenColor: WHITE,
          sheenRoughness: 0.6,
          clearcoat: 0.4,
          clearcoatRoughness: 0.32,
          specularIntensity: 0.7,
          iridescence: 0.14,
          iridescenceIOR: 1.35,
          // transparente desde o início (sem define OPAQUE): o esmaecimento do `uncoat` funciona sem trocar de shader
          transparent: true,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshPhysicalMaterial({
          color: ENVELOPE_TINT,
          roughness: 0.5,
          metalness: 0,
          clearcoat: 0.25,
          clearcoatRoughness: 0.45,
          sheen: 0.35,
          sheenColor: WHITE,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
  withFresnel(material, u);
  return { material, u };
}

/** Material dos espinhos: proteína fosca com leve verniz; HA um pouco mais lisa que a NA (cabeça compacta). */
function spikeMaterial(kind: 'ha' | 'na'): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: WHITE,
    vertexColors: true,
    roughness: kind === 'ha' ? 0.46 : 0.52,
    metalness: 0,
    clearcoat: kind === 'ha' ? 0.25 : 0.18,
    clearcoatRoughness: 0.42,
    sheen: 0.35,
    sheenColor: WHITE,
    sheenRoughness: 0.55,
  });
}

// ---------------------------------------------------------------------------------------------------------

/**
 * Realce fosco amortecido (hover/seleção, ~0,12 s): avança `k` rumo a 0/1 e pede quadro enquanto não assenta
 * (no modo `demand` do reduced-motion só há quadro quando alguém pede).
 */
function stepHighlight(k: number, active: boolean, delta: number, invalidate: () => void): number {
  const target = active ? 1 : 0;
  const next = k + (target - k) * (1 - Math.exp(-Math.min(0.05, Math.max(0, delta)) / 0.12));
  if (Math.abs(next - target) < 1e-3) return target;
  invalidate();
  return next;
}

/** Envelope lipídico pleomórfico em dois hemisférios + anel fino na costura (opacidade = openEnv). */
function Envelope({ stateRef, lookRef, quality, active, pointer }: { stateRef: StateRef; lookRef: LookRef; quality: Quality; active: boolean; pointer: Pointer }) {
  const halves = useMemo(() => envelopeHalves(quality), [quality]);
  const seam = useMemo(() => seamGeometry(quality), [quality]);
  const { material, u } = useMemo(() => envelopeMaterial(quality), [quality]);
  // costura iluminada (fosca), não "linha de luz"
  const seamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PART_COLORS.envelopeEdge, roughness: 0.7, metalness: 0, transparent: true, opacity: 0, depthWrite: false }), []);
  const tint = useMemo(() => ({ base: new THREE.Color(ENVELOPE_TINT), hot: new THREE.Color(ENVELOPE_ACTIVE), k: 0 }), []);
  const invalidate = useThree((st) => st.invalidate);
  useDispose(halves.top, halves.bottom, seam, material, seamMat);
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  const ringTop = useRef<THREE.Mesh>(null);
  const ringBottom = useRef<THREE.Mesh>(null);
  const baseOpacity = quality === 'high' ? 1 : 0.7;
  useFrame((_, delta) => {
    const s = stateRef.current;
    const look = lookRef.current;
    const y = s.openEnv * HALF_SHIFT;
    if (top.current) top.current.position.y = y;
    if (bottom.current) bottom.current.position.y = -y;
    const fade = 1 - 0.75 * s.uncoat;
    material.opacity = baseOpacity * fade;
    // realce fosco amortecido (hover/seleção): só muda o albedo
    tint.k = stepHighlight(tint.k, active, delta, invalidate);
    material.color.copy(tint.base).lerp(tint.hot, 0.6 * tint.k);
    u.uFresnel.value = look.fresnel;
    setSrgb(u.uFresnelColor.value, look.fresnelColor);
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

/** Camada M1: opaca (aparece através da transmissão do envelope), fosca e aveludada, com lacunas sutis; abre com openM1. */
function Matrix({ stateRef, quality, active, pointer }: { stateRef: StateRef; quality: Quality; active: boolean; pointer: Pointer }) {
  const halves = useMemo(() => matrixHalves(quality), [quality]);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: PART_COLORS.m1,
      roughness: 0.9,
      metalness: 0,
      sheen: 0.35,
      sheenColor: WHITE,
      sheenRoughness: 0.8,
      side: THREE.DoubleSide,
    });
    // opaca no resto da história, transparente no `uncoat`: o palco pré-compila as duas variantes
    m.userData.altTransparent = true;
    return m;
  }, []);
  const tint = useMemo(() => ({ base: new THREE.Color(PART_COLORS.m1), hot: new THREE.Color(M1_ACTIVE), k: 0 }), []);
  const invalidate = useThree((st) => st.invalidate);
  useDispose(halves.top, halves.bottom, material);
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    const s = stateRef.current;
    const y = s.openM1 * M1_SHIFT;
    if (top.current) top.current.position.y = y;
    if (bottom.current) bottom.current.position.y = -y;
    material.opacity = 1 - 0.75 * s.uncoat;
    setTransparent(material, s.uncoat > 0.005);
    tint.k = stepHighlight(tint.k, active, delta, invalidate);
    material.color.copy(tint.base).lerp(tint.hot, 0.65 * tint.k);
  });
  return (
    <>
      <mesh ref={top} geometry={halves.top} material={material} frustumCulled={false} onPointerOver={pointer.over} onPointerOut={pointer.out} onClick={pointer.click} />
      <mesh ref={bottom} geometry={halves.bottom} material={material} frustumCulled={false} onPointerOver={pointer.over} onPointerOut={pointer.out} onClick={pointer.click} />
    </>
  );
}

/**
 * Orientação e escala FIXAS de cada espinho (a direção não muda; só a base anda com openSpikes/openEnv):
 * eixo levemente inclinado em torno da normal, giro próprio, altura/largura e tom de `spikeJitter`.
 */
function useInstanceJitter(dirs: readonly Vec3[], seed: number): { q: THREE.Quaternion[]; scale: THREE.Vector3[]; tone: Float32Array } {
  return useMemo(() => {
    const j = spikeJitter(dirs.length, seed);
    const n = new THREE.Vector3();
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const roll = new THREE.Quaternion();
    const q: THREE.Quaternion[] = [];
    const scale: THREE.Vector3[] = [];
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i]!;
      n.set(d.x, d.y, d.z).normalize();
      t1.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
      t2.crossVectors(n, t1);
      const a = j.tiltDir[i]!;
      const tl = j.tilt[i]!;
      axis
        .copy(n)
        .multiplyScalar(Math.cos(tl))
        .addScaledVector(t1, Math.sin(tl) * Math.cos(a))
        .addScaledVector(t2, Math.sin(tl) * Math.sin(a))
        .normalize();
      q.push(new THREE.Quaternion().setFromUnitVectors(UP, axis).multiply(roll.setFromAxisAngle(UP, j.roll[i]!)));
      scale.push(new THREE.Vector3(j.width[i]!, j.height[i]!, j.width[i]!));
    }
    return { q, scale, tone: j.tone };
  }, [dirs, seed]);
}

/** Cache dos últimos valores aplicados aos espinhos (−1 = nunca aplicado). */
function freshSpikeCache() {
  return { openSpikes: -1, openEnv: -1, pulse: -1, drift: -1, dock: -1, active: -1, lift: -1, colored: false };
}

/** Espinhos HA ou NA instanciados: pose por `spikeBaseInto`, cor por instância (realce, deriva, hover). */
function Spikes({
  kind,
  dirs,
  stateRef,
  ambientRef,
  lookRef,
  quality,
  active,
  pointer,
}: {
  kind: 'ha' | 'na';
  dirs: readonly Vec3[];
  stateRef: StateRef;
  ambientRef: AmbientRef;
  lookRef: LookRef;
  quality: Quality;
  active: boolean;
  pointer: Pointer;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => (kind === 'ha' ? haGeometry(quality) : naGeometry(quality)), [kind, quality]);
  const baseHex = kind === 'ha' ? PART_COLORS.primary : PART_COLORS.h1n1;
  const material = useMemo(() => spikeMaterial(kind), [kind]);
  useDispose(geom, material);
  const jitter = useInstanceJitter(dirs, kind === 'ha' ? 31 : 37);
  const drift = useMemo(() => (kind === 'ha' ? driftMask(dirs.length) : null), [kind, dirs.length]);
  const scratch = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      base: { x: 0, y: 0, z: 0 } as Vec3,
      c: new THREE.Color(),
      baseC: new THREE.Color(baseHex),
      hiC: kind === 'ha' ? new THREE.Color(PRIMARY_500) : new THREE.Color(PART_COLORS.h1n1).lerp(WHITE, 0.42),
      driftC: new THREE.Color(PART_COLORS.h3),
    }),
    [baseHex, kind],
  );
  const applied = useRef(freshSpikeCache());
  // cores por instância já na montagem: o programa nasce com USE_INSTANCING_COLOR e a pré-compilação vale
  useLayoutEffect(() => {
    applied.current = freshSpikeCache();
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < dirs.length; i++) m.setColorAt(i, scratch.baseC);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [dirs, geom, scratch]);
  // realce fosco amortecido (sem saltos de cor no hover)
  const hot = useRef(0);
  const invalidate = useThree((st) => st.invalidate);

  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m) return;
    const s = stateRef.current;
    const a = ambientRef.current;
    const ap = applied.current;
    const { dummy, base, c, baseC, hiC, driftC } = scratch;

    if (Math.abs(s.openSpikes - ap.openSpikes) > EPS * 0.1 || Math.abs(s.openEnv - ap.openEnv) > EPS * 0.1) {
      ap.openSpikes = s.openSpikes;
      ap.openEnv = s.openEnv;
      for (let i = 0; i < dirs.length; i++) {
        spikeBaseInto(kind, dirs[i]!, s, base);
        dummy.position.set(base.x, base.y, base.z);
        dummy.quaternion.copy(jitter.q[i]!);
        dummy.scale.copy(jitter.scale[i]!);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      // a esfera de colisão do InstancedMesh é calculada uma vez no raycast: invalida ao mover os espinhos
      m.boundingSphere = null;
    }

    const hl = kind === 'ha' ? s.hlHa : s.hlNa;
    // pulso do capítulo 1 a PULSE_HZ (≤ 1 Hz), só no albedo
    const pulse = hl > 0.001 ? hl * (0.7 + 0.3 * Math.sin(a.t * Math.PI * 2 * PULSE_HZ + (kind === 'ha' ? 0 : 1.1))) : 0;
    const driftK = kind === 'ha' ? s.drift : 0;
    // encaixe (capítulo 3): as HAs voltadas para a membrana (+x no quadro micro; yaw já assentado) acendem
    const dockK = kind === 'ha' ? s.dock * (1 - s.engulf) : 0;
    hot.current = stepHighlight(hot.current, active, delta, invalidate);
    const act = hot.current;
    const lift = lookRef.current.lift;
    if (!ap.colored || Math.abs(pulse - ap.pulse) > EPS || Math.abs(driftK - ap.drift) > EPS || Math.abs(dockK - ap.dock) > EPS || Math.abs(act - ap.active) > EPS || Math.abs(lift - ap.lift) > EPS) {
      ap.pulse = pulse;
      ap.drift = driftK;
      ap.dock = dockK;
      ap.active = act;
      ap.lift = lift;
      ap.colored = true;
      for (let i = 0; i < dirs.length; i++) {
        c.copy(baseC);
        if (drift && drift[i]) c.lerp(driftC, driftK);
        // no escuro, cobalto/rosa mais claros (albedo), nunca brilho próprio
        if (lift > 0) c.lerp(hiC, Math.min(1, lift * 2.5));
        if (pulse > 0) c.lerp(hiC, pulse);
        if (dockK > 0) {
          const facing = (dirs[i]!.x - 0.78) / 0.22;
          if (facing > 0) c.lerp(hiC, Math.min(1, facing) * dockK * 0.9);
        }
        if (act > 0) c.lerp(hiC, ACTIVE_MIX * act).lerp(WHITE, 0.1 * act);
        c.multiplyScalar(1 + jitter.tone[i]!);
        m.setColorAt(i, c);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
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
        sheen: 0.2,
        sheenColor: WHITE,
      }),
    [],
  );
  useDispose(geom, material);
  const jitter = useInstanceJitter(dirs, 43);
  const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), base: { x: 0, y: 0, z: 0 } as Vec3, baseC: new THREE.Color(PART_COLORS.m2), hiC: new THREE.Color(PART_COLORS.primary), activeC: new THREE.Color(PRIMARY_500) }), []);
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
    const { dummy, base, baseC, hiC, activeC } = scratch;
    if (Math.abs(s.openSpikes - ap.openSpikes) > EPS * 0.1 || Math.abs(s.openEnv - ap.openEnv) > EPS * 0.1) {
      ap.openSpikes = s.openSpikes;
      ap.openEnv = s.openEnv;
      for (let i = 0; i < dirs.length; i++) {
        spikeBaseInto('m2', dirs[i]!, s, base);
        dummy.position.set(base.x, base.y, base.z);
        dummy.quaternion.copy(jitter.q[i]!);
        dummy.scale.copy(jitter.scale[i]!);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      m.boundingSphere = null;
    }
    // "pisca" do uncoat a BLINK_HZ (≤ 1 Hz) e realce do hover: só albedo
    const blink = s.uncoat * a.blink;
    material.color.copy(baseC).lerp(hiC, blink * 0.85);
    if (active) material.color.lerp(activeC, ACTIVE_MIX);
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
function Rnps({ stateRef, lookRef, quality, active, pointer }: { stateRef: StateRef; lookRef: LookRef; quality: Quality; active: boolean; pointer: Pointer }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => beadGeometry(quality), [quality]);
  const beads = useMemo(() => buildRnpBeads(quality), [quality]);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: WHITE,
        roughness: 0.55,
        metalness: 0,
        clearcoat: 0.12,
        sheen: 0.4,
        sheenColor: WHITE,
        sheenRoughness: 0.6,
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
  const applied = useRef({ openRnp: -1, release: -1, active: false, lift: -1 });
  // cores por instância já na montagem (programa com USE_INSTANCING_COLOR desde a pré-compilação)
  useLayoutEffect(() => {
    applied.current = { openRnp: -1, release: -1, active: false, lift: -1 };
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < beads.count; i++) m.setColorAt(i, beads.color[i]!);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [beads, geom]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const s = stateRef.current;
    const ap = applied.current;
    const lift = lookRef.current.lift;
    if (Math.abs(s.openRnp - ap.openRnp) < EPS * 0.1 && Math.abs(s.release - ap.release) < EPS * 0.1 && active === ap.active && Math.abs(lift - ap.lift) < EPS) return;
    ap.openRnp = s.openRnp;
    ap.release = s.release;
    ap.active = active;
    ap.lift = lift;
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
      if (lift > 0) c.lerp(WHITE, lift);
      const f = fade[k]!;
      if (f > 0) c.lerp(fadeC, f);
      if (active) c.lerp(WHITE, 0.22);
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    m.boundingSphere = null;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
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
export function Virion({ stateRef, ambientRef, lookRef, quality, layout, hovered, selected, onHover, onSelect }: VirionProps) {
  useCursor(hovered !== null);
  const breath = useRef<THREE.Group>(null);
  const isActive = (id: PartId) => hovered === id || selected === id;
  const pEnv = usePointer('envelope', onHover, onSelect);
  const pM1 = usePointer('m1', onHover, onSelect);
  const pHa = usePointer('ha', onHover, onSelect);
  const pNa = usePointer('na', onHover, onSelect);
  const pM2 = usePointer('m2', onHover, onSelect);
  const pRna = usePointer('rna', onHover, onSelect);

  // respiração: anisotrópica e lenta (≈ ±1 %, ~0,25 Hz + oscilação a ~0,17 Hz) enquanto o vírion gira livre
  // (spin > 0,05): a partícula "pulsa" como membrana, não como balão; espinhos acompanham (mesmo grupo)
  useFrame(() => {
    const g = breath.current;
    if (!g) return;
    const s = stateRef.current;
    const a = ambientRef.current;
    const k = clamp01((s.spin - 0.05) / 0.1);
    g.scale.set(1 + (0.009 * a.breath + 0.003 * a.wobble) * k, 1 + (-0.007 * a.breath + 0.004 * a.wobble) * k, 1 + (0.006 * a.breath - 0.004 * a.wobble) * k);
  });

  return (
    <group ref={breath}>
      <Envelope stateRef={stateRef} lookRef={lookRef} quality={quality} active={isActive('envelope')} pointer={pEnv} />
      <Matrix stateRef={stateRef} quality={quality} active={isActive('m1')} pointer={pM1} />
      <Spikes kind="ha" dirs={layout.ha} stateRef={stateRef} ambientRef={ambientRef} lookRef={lookRef} quality={quality} active={isActive('ha')} pointer={pHa} />
      <Spikes kind="na" dirs={layout.na} stateRef={stateRef} ambientRef={ambientRef} lookRef={lookRef} quality={quality} active={isActive('na')} pointer={pNa} />
      <Channels dirs={layout.m2} stateRef={stateRef} ambientRef={ambientRef} quality={quality} active={isActive('m2')} pointer={pM2} />
      <Rnps stateRef={stateRef} lookRef={lookRef} quality={quality} active={isActive('rna')} pointer={pRna} />
    </group>
  );
}
