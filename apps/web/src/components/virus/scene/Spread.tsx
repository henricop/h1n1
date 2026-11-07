'use client';
/**
 * Contágio (capítulo 4), em coordenadas de MUNDO: duas silhuetas frente a frente e a nuvem que sai da boca da
 * esquerda (CARRY_LEFT, diante da boca) rumo à da direita (CARRY_RIGHT).
 *  - gotículas (maiores): arco curto que cai antes de chegar à outra pessoa;
 *  - aerossóis (menores, azul mais claro): demoram mais, vão mais longe e ficam suspensos, ondulando;
 *  - gotícula portadora: uma bolha translúcida que envolve o vírion e refaz o MESMO arco dele (keyframes
 *    virusX/virusY do capítulo 4, local 0,55–0,8), reconstruído a partir de `droplets`.
 * Base: CDC/OMS/Krammer 2018 (docs/pesquisa/explicador-3d-ciclo-transmissao.md): gotículas e aerossóis.
 * v4: em `quality: 'high'` as gotículas e a portadora têm leve refração (transmissão física, IOR da água); em
 * 'low' continuam translúcidas simples (sem passe de transmissão extra).
 *
 * Fase do trajeto: no capítulo 4 `droplets` sobe 0→1 junto com o vírion; no capítulo 5 `droplets` volta a 0 com o
 * vírion JÁ na boca da direita. Para nada "voar de volta", o trajeto é max(droplets, posição do vírion no arco)
 * e só o fade acompanha a queda de `droplets` (ver `dropletTravel`/`dropletFade`).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARRY_LEFT, CARRY_RIGHT, MOUTH_RIGHT } from '@/lib/virus/choreography';
import { clamp01, seededRandom, smoothstep } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import type { SceneState } from '@/lib/virus/scenestate';
import { COUNTS, MOUTH_Y, PERSON_X, smooth, type AmbientRef, type StateRef } from './shared';

// ---------------------------------------------------------------------------------------------------------------
// Matemática pura (testada em test/virus-spread.test.ts, sem WebGL)
// ---------------------------------------------------------------------------------------------------------------

/** Altura extra do pico do arco do vírion (keyframe de virusY em local 0,675 do capítulo 4). */
export const CARRIER_PEAK = 0.7;
/** Raio da gotícula portadora em unidades do grupo micro (envolve o vírion com espinhos, com folga). */
export const CARRIER_RADIUS = 1.6;
const SPAN = CARRY_RIGHT.x - CARRY_LEFT.x;

/** Inversa de smoothstep(0, 1, ·) em [0, 1]. */
export function invSmooth(y: number): number {
  const v = clamp01(y);
  return 0.5 - Math.sin(Math.asin(1 - 2 * v) / 3);
}

/**
 * Posição (mundo) do vírion/gotícula portadora no arco do capítulo 4, dado o trajeto `travel` (= `droplets`).
 * Reproduz as batidas: virusX vai de CARRY_LEFT.x a CARRY_RIGHT.x com a MESMA janela suave de `droplets`; virusY
 * sobe até CARRY_LEFT.y + CARRIER_PEAK no meio do tempo e desce até CARRY_RIGHT.y (dois trechos suaves).
 */
export function carrierPosition(travel: number, out: { x: number; y: number }): { x: number; y: number } {
  const d = clamp01(travel);
  const u = invSmooth(d);
  const top = CARRY_LEFT.y + CARRIER_PEAK;
  out.x = CARRY_LEFT.x + SPAN * d;
  out.y = u <= 0.5 ? CARRY_LEFT.y + CARRIER_PEAK * smooth(u * 2) : top + (CARRY_RIGHT.y - top) * smooth(u * 2 - 1);
  return out;
}

/**
 * Trajeto 0..1 da nuvem: `droplets` no capítulo 4; no capítulo 5 o vírion já chegou (virusX = CARRY_RIGHT.x) e o
 * trajeto fica em 1 enquanto `droplets` cai (nada volta para a boca da esquerda).
 */
export function dropletTravel(s: Pick<SceneState, 'droplets' | 'virusX'>): number {
  const tau = clamp01((s.virusX - CARRY_LEFT.x) / SPAN);
  return Math.max(clamp01(s.droplets), tau);
}

/** Fator de fade 0..1: 1 durante o trajeto do capítulo 4; igual a `droplets` quando ela cai no capítulo 5. */
export function dropletFade(s: Pick<SceneState, 'droplets' | 'virusX'>): number {
  return clamp01(1 - (dropletTravel(s) - clamp01(s.droplets)));
}

export interface DropletSpec {
  /** false = gotícula (cai cedo), true = aerossol (flutua longe) */
  aerosol: boolean;
  /** início e duração, em unidades de trajeto (delay + dur ≤ 1) */
  delay: number;
  dur: number;
  /** fração da distância boca→boca percorrida */
  reach: number;
  /** gotícula: altura do arco; aerossol: deriva vertical total */
  lift: number;
  /** gotícula: queda total no fim do percurso (parábola) */
  droop: number;
  y0: number;
  z0: number;
  /** dispersão em z ao longo do percurso */
  zs: number;
  size: number;
  phase: number;
}

/** Nuvem determinística: ~55% gotículas e ~45% aerossóis, intercalados. */
export function makeDroplets(count: number, seed = 11): DropletSpec[] {
  const rnd = seededRandom(seed);
  const out: DropletSpec[] = [];
  for (let i = 0; i < count; i++) {
    const aerosol = i % 9 >= 5;
    if (!aerosol) {
      out.push({
        aerosol,
        delay: rnd() * 0.3,
        dur: 0.35 + rnd() * 0.3,
        reach: 0.2 + rnd() * 0.38,
        lift: 0.05 + rnd() * 0.35,
        droop: 1.7 + rnd() * 1.0,
        y0: (rnd() - 0.5) * 0.1,
        z0: (rnd() - 0.5) * 0.16,
        zs: (rnd() - 0.5) * 1.3,
        size: 0.045 + rnd() * 0.04,
        phase: rnd() * Math.PI * 2,
      });
    } else {
      const delay = 0.05 + rnd() * 0.4;
      out.push({
        aerosol,
        delay,
        dur: Math.min(1 - delay, 0.45 + rnd() * 0.5),
        reach: 0.5 + rnd() * 0.47,
        lift: -0.2 + rnd() * 0.75,
        droop: 0,
        y0: (rnd() - 0.5) * 0.1,
        z0: (rnd() - 0.5) * 0.12,
        zs: (rnd() - 0.5) * 2.6,
        size: 0.018 + rnd() * 0.02,
        phase: rnd() * Math.PI * 2,
      });
    }
  }
  return out;
}

export interface DropletPose {
  x: number;
  y: number;
  z: number;
  /** escala (raio); 0 = invisível */
  s: number;
}

/** Posição e escala de uma partícula para o trajeto `travel`, com ondulação ambiente (wobble/breath em −1..1). */
export function dropletPose(it: DropletSpec, travel: number, wobble: number, breath: number, out: DropletPose): DropletPose {
  const raw = (travel - it.delay) / it.dur;
  if (!(raw > 0)) {
    out.x = CARRY_LEFT.x;
    out.y = CARRY_LEFT.y;
    out.z = 0;
    out.s = 0;
    return out;
  }
  const s = raw >= 1 ? 1 : raw;
  const c = Math.cos(it.phase);
  const sn = Math.sin(it.phase);
  if (!it.aerosol) {
    // arco curto com arrasto em x e queda parabólica ("droop"): cai antes de chegar à outra pessoa
    const k = 1 - s;
    const a = 0.015 * s;
    out.x = CARRY_LEFT.x + 0.04 + it.reach * SPAN * (1 - k * k) + a * wobble * c;
    out.y = CARRY_LEFT.y + it.y0 + 4 * it.lift * s * k - it.droop * s * s + a * breath * sn;
    out.z = it.z0 + it.zs * s;
    out.s = it.size * (1 - 0.4 * s) * smooth(s / 0.05) * (1 - smoothstep(0.78, 1, s));
  } else {
    // pluma lenta: vai mais longe, abre em y/z e fica suspensa, ondulando com o ambiente
    const a = 0.06 * s;
    out.x = CARRY_LEFT.x + 0.04 + it.reach * SPAN * (1 - Math.pow(1 - s, 1.6)) + a * 0.6 * wobble * c;
    out.y = CARRY_LEFT.y + it.y0 + it.lift * s + 0.1 * Math.sin(Math.PI * 1.3 * s + it.phase) * s + a * (breath * sn + 0.5 * wobble * c);
    out.z = it.z0 + it.zs * s + a * 0.5 * breath * c;
    out.s = it.size * (1 - 0.3 * s) * smooth(s / 0.08);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Silhuetas
// ---------------------------------------------------------------------------------------------------------------

export interface PersonShape {
  /** escala da cabeça */
  head: number;
  /** largura dos ombros (z) */
  width: number;
  /** altura do tronco */
  height: number;
  /** profundidade do peito (x, a direção do olhar) */
  depth: number;
  /** comprimento do pescoço */
  neck: number;
}

/** Duas pessoas parecidas, não clones: a da direita é mais larga, de cabeça um pouco maior e pescoço mais curto. */
export const PERSON_SHAPES: readonly [PersonShape, PersonShape] = [
  // bustos (tronco curto e mais profundo): de perfil leem como pessoa, não como pílula
  { head: 1, width: 0.94, height: 0.62, depth: 0.95, neck: 0.16 },
  { head: 1.05, width: 1.1, height: 0.66, depth: 1.05, neck: 0.12 },
];

/** Perfil do tronco (raio, altura a partir do topo dos ombros), girado em torno de y. */
const TORSO_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.001, 0],
  [0.16, -0.012],
  [0.3, -0.05],
  [0.4, -0.12],
  [0.455, -0.23],
  [0.47, -0.4],
  [0.455, -0.7],
  [0.42, -1.0],
  [0.43, -1.3],
  [0.44, -1.6],
  [0.43, -1.9],
  [0.36, -2.15],
  [0.2, -2.3],
  [0.001, -2.33],
];

/**
 * Silhueta (cabeça + nariz discreto + pescoço + ombros/tronco) num único BufferGeometry, olhando para +x, com o
 * eixo do tronco em x = 0 e a BOCA em (mouthDX, 0, 0) — na superfície do rosto, à altura y = 0.
 * Ordem de mescla: tronco, cabeça, nariz, pescoço (o que fica "dentro" por último), para o fade translúcido não
 * mostrar as sobreposições internas (depthWrite ligado).
 */
export function personGeometry(p: PersonShape, mouthDX: number): THREE.BufferGeometry {
  const rx = 0.33 * p.head;
  const ry = 0.4 * p.head;
  const rz = 0.31 * p.head;
  const hy = 0.15 * p.head; // centro da cabeça acima da boca
  const hx = mouthDX - rx * Math.sqrt(1 - (hy / ry) ** 2); // frente do rosto na altura da boca = mouthDX
  const shoulderTop = hy - ry - p.neck;

  const torso = new THREE.LatheGeometry(
    TORSO_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  )
    .scale(p.depth, p.height, 1.18 * p.width)
    .translate(0, shoulderTop, 0);
  const head = new THREE.SphereGeometry(1, 36, 26).scale(rx, ry, rz).translate(hx, hy, 0);
  const ny = 0.11 * p.head;
  const noseFront = hx + rx * Math.sqrt(1 - ((ny - hy) / ry) ** 2);
  const nose = new THREE.SphereGeometry(1, 14, 10)
    .scale(0.06 * p.head, 0.045 * p.head, 0.045 * p.head)
    .translate(noseFront - 0.012 * p.head, ny, 0);
  const neckTop = hy - 0.6 * ry;
  const neckBottom = shoulderTop - 0.12;
  const neck = new THREE.CylinderGeometry(0.12 * p.width, 0.135 * p.width, neckTop - neckBottom, 20, 1, true)
    .scale(0.92, 1, 1)
    .translate(hx * 0.45, (neckTop + neckBottom) / 2, 0);

  const parts = [torso, head, nose, neck];
  const merged = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!merged) throw new Error('personGeometry: mergeGeometries falhou');
  return merged;
}

/** Duas silhuetas foscas em ±PERSON_X, de frente uma para a outra, boca em MOUTH_Y; opacidade = `people`. */
export function People({ stateRef }: { stateRef: StateRef }) {
  const group = useRef<THREE.Group>(null);
  // distância do eixo do tronco à boca (PERSON_X − |MOUTH_RIGHT.x| = 0,45): a boca cai exatamente em MOUTH_LEFT/RIGHT;
  // o vírion estaciona em CARRY_*, 0,45 à frente do rosto
  const mouthDX = PERSON_X - MOUTH_RIGHT.x;
  const geoms = useMemo(() => [personGeometry(PERSON_SHAPES[0], mouthDX), personGeometry(PERSON_SHAPES[1], mouthDX)] as const, [mouthDX]);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: PART_COLORS.person,
        roughness: 0.86,
        metalness: 0,
        sheen: 0.55,
        sheenRoughness: 0.75,
        sheenColor: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: 0,
        depthWrite: true,
      }),
    [],
  );
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  useEffect(() => () => material.dispose(), [material]);
  const applied = useRef(-1);

  useFrame(() => {
    const p = clamp01(stateRef.current.people);
    const g = group.current;
    if (!g) return;
    g.visible = p > 0.01;
    if (p === applied.current) return;
    applied.current = p;
    material.opacity = p > 0.995 ? 1 : p;
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={geoms[0]} material={material} position={[-PERSON_X, MOUTH_Y, 0]} />
      <mesh geometry={geoms[1]} material={material} position={[PERSON_X, MOUTH_Y, 0]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Gotículas, aerossóis e gotícula portadora
// ---------------------------------------------------------------------------------------------------------------

const EPS = 1e-5;

/** Gotículas e aerossóis da boca esquerda para a direita, mais a gotícula portadora no arco do vírion. */
export function Droplets({ stateRef, ambientRef, quality }: { stateRef: StateRef; ambientRef: AmbientRef; quality: 'low' | 'high' }) {
  const group = useRef<THREE.Group>(null);
  const bigRef = useRef<THREE.InstancedMesh>(null);
  const fineRef = useRef<THREE.InstancedMesh>(null);
  const carrierRef = useRef<THREE.Mesh>(null);

  const count = COUNTS[quality].droplets;
  const { big, fine } = useMemo(() => {
    const all = makeDroplets(count);
    return { big: all.filter((d) => !d.aerosol), fine: all.filter((d) => d.aerosol) };
  }, [count]);

  const geo = useMemo(() => {
    const hi = quality === 'high';
    return {
      big: new THREE.SphereGeometry(1, hi ? 14 : 10, hi ? 10 : 7),
      fine: new THREE.IcosahedronGeometry(1, hi ? 1 : 0),
      carrier: new THREE.SphereGeometry(1, hi ? 44 : 26, hi ? 30 : 18),
    };
  }, [quality]);
  const mat = useMemo(() => {
    const aerosolColor = new THREE.Color(PART_COLORS.droplet).lerp(new THREE.Color('#ffffff'), 0.32);
    const hi = quality === 'high';
    // água: IOR 1,33; transmissão parcial para a gotícula continuar azulada e visível sobre o papel
    const water = hi ? { transmission: 0.55, thickness: 0.35, ior: 1.33, attenuationColor: new THREE.Color(PART_COLORS.droplet), attenuationDistance: 0.6 } : {};
    return {
      big: new THREE.MeshPhysicalMaterial({ color: PART_COLORS.droplet, roughness: hi ? 0.1 : 0.18, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, specularIntensity: 0.9, ...water, transparent: true, opacity: 0.85, depthWrite: false }),
      fine: new THREE.MeshStandardMaterial({ color: aerosolColor, roughness: 0.5, metalness: 0, transparent: true, opacity: 0.6, depthWrite: false }),
      carrier: new THREE.MeshPhysicalMaterial({
        color: PART_COLORS.droplet,
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        ...(hi ? { transmission: 0.35, thickness: 0.5, ior: 1.33, attenuationColor: new THREE.Color('#dfe8ff'), attenuationDistance: 2.5 } : {}),
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    };
  }, [quality]);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useEffect(() => () => Object.values(mat).forEach((m) => m.dispose()), [mat]);

  // objetos reutilizados a cada quadro (zero alocação no useFrame)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), pose: { x: 0, y: 0, z: 0, s: 0 } as DropletPose, c: { x: 0, y: 0 } }), []);
  // cache por valor; as malhas entram na chave para resetar quando `quality` recria as InstancedMesh
  const cache = useRef({ travel: NaN, fade: NaN, wobble: NaN, breath: NaN, scale: NaN, big: null as THREE.InstancedMesh | null, fine: null as THREE.InstancedMesh | null });

  useFrame(() => {
    const s = stateRef.current;
    const g = group.current;
    const bm = bigRef.current;
    const fm = fineRef.current;
    const car = carrierRef.current;
    if (!g || !bm || !fm || !car) return;
    const visible = s.droplets > 0.01;
    g.visible = visible;
    if (!visible) return;

    const travel = dropletTravel(s);
    const fade = dropletFade(s);
    const amb = ambientRef.current;
    const c = cache.current;
    if (
      c.big === bm &&
      c.fine === fm &&
      Math.abs(c.travel - travel) < EPS &&
      Math.abs(c.fade - fade) < EPS &&
      Math.abs(c.wobble - amb.wobble) < EPS &&
      Math.abs(c.breath - amb.breath) < EPS &&
      Math.abs(c.scale - s.virusScale) < EPS
    )
      return;
    if (c.big !== bm) bm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (c.fine !== fm) fm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    c.big = bm;
    c.fine = fm;
    c.travel = travel;
    c.fade = fade;
    c.wobble = amb.wobble;
    c.breath = amb.breath;
    c.scale = s.virusScale;

    const shrink = 0.5 + 0.5 * fade;
    const { m, pose } = tmp;
    for (let i = 0; i < big.length; i++) {
      dropletPose(big[i]!, travel, amb.wobble, amb.breath, pose);
      const r = Math.max(EPS, pose.s * shrink);
      m.makeScale(r, r, r).setPosition(pose.x, pose.y, pose.z);
      bm.setMatrixAt(i, m);
    }
    bm.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < fine.length; i++) {
      dropletPose(fine[i]!, travel, amb.wobble, amb.breath, pose);
      const r = Math.max(EPS, pose.s * shrink);
      m.makeScale(r, r, r).setPosition(pose.x, pose.y, pose.z);
      fm.setMatrixAt(i, m);
    }
    fm.instanceMatrix.needsUpdate = true;
    mat.big.opacity = 0.85 * fade;
    mat.fine.opacity = 0.6 * fade;

    // gotícula portadora: envolve o vírion (raio acompanha virusScale) e nasce na boca nos primeiros 8% do trajeto
    const at = carrierPosition(travel, tmp.c);
    const rad = Math.max(EPS, CARRIER_RADIUS * s.virusScale * smooth(travel / 0.08));
    car.position.set(at.x, at.y, 0);
    car.scale.set(rad * (1 + 0.025 * amb.wobble), rad * (1 - 0.025 * amb.wobble), rad);
    mat.carrier.opacity = 0.26 * fade;
  });

  return (
    <group ref={group} visible={false}>
      <instancedMesh key={`big-${quality}`} ref={bigRef} args={[geo.big, mat.big, big.length]} frustumCulled={false} renderOrder={1} />
      <instancedMesh key={`fine-${quality}`} ref={fineRef} args={[geo.fine, mat.fine, fine.length]} frustumCulled={false} renderOrder={1} />
      <mesh key={`car-${quality}`} ref={carrierRef} geometry={geo.carrier} material={mat.carrier} renderOrder={2} />
    </group>
  );
}
