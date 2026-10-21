'use client';
/**
 * Célula-alvo (capítulos 3 a 5), no quadro micro (vírion na origem; este grupo não gira):
 * parede de membrana com receptores, covinha + vesícula (endocitose), tom âmbar da acidificação, núcleo sugerido
 * e brotamento. Tudo lido de `stateRef.current` dentro de useFrame; recomputa só quando os canais mudam.
 * Geometria pura em ./cell-geometry.ts (ver o modelo da endocitose lá).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NUCLEUS, VESICLE_RADIUS } from '@/lib/virus/choreography';
import { fibonacciSphere } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import {
  BUD_RADIUS,
  CELL_RADIUS,
  NUCLEUS_RADIUS,
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
} from './cell-geometry';
import { COUNTS, UP, type AmbientRef, type StateRef } from './shared';

// ---------- cores (tema claro; derivadas de PART_COLORS) ----------
const C_CELL = new THREE.Color(PART_COLORS.cell);
const C_RIM = new THREE.Color(PART_COLORS.cellEdge).lerp(new THREE.Color(PART_COLORS.primary), 0.22);
/** tom quente bem suave da acidificação (sem vermelho) */
const C_ACID = new THREE.Color('#fff1d6');
const C_RECEPTOR = new THREE.Color(PART_COLORS.cellEdge).lerp(new THREE.Color(PART_COLORS.primary), 0.35);
const C_RECEPTOR_HOT = new THREE.Color(PART_COLORS.primary);
const C_NUCLEUS = new THREE.Color(PART_COLORS.cellEdge).lerp(new THREE.Color(PART_COLORS.m2), 0.4);
const C_NUCLEUS_RIM = new THREE.Color(PART_COLORS.cellEdge).lerp(new THREE.Color(PART_COLORS.m2), 0.7);
const C_NUCLEOLUS = new THREE.Color(PART_COLORS.cellEdge).lerp(new THREE.Color(PART_COLORS.m2), 0.62);
const C_HA = new THREE.Color(PART_COLORS.primary);
const C_NA = new THREE.Color(PART_COLORS.h1n1);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// ---------- opacidades máximas ----------
const WALL_OPACITY = 0.9;
const VESICLE_OPACITY = 0.85;
const LUMEN_OPACITY = 0.3;
const NUCLEUS_OPACITY = 0.7;
const NUCLEOLUS_OPACITY = 0.5;
/** receptores que brilham/engrossam no encaixe (os mais próximos do ponto de contato) */
const HOT_RECEPTORS = 3;

// ---------- material de membrana: físico claro + borda fresnel + recorte esférico (onBeforeCompile) ----------
interface MembraneUniforms {
  [key: string]: THREE.IUniform;
  uRimColor: THREE.IUniform<THREE.Color>;
  uRimMix: THREE.IUniform<number>;
  uRimPower: THREE.IUniform<number>;
  uFaceAlpha: THREE.IUniform<number>;
  /** 0 = sem recorte; 1 = buraco (esmaece dentro da esfera, por uCsgAmount); 2 = mantém só dentro da esfera */
  uCsgMode: THREE.IUniform<number>;
  /** centro da esfera de recorte, no espaço LOCAL da malha */
  uCsgCenter: THREE.IUniform<THREE.Vector3>;
  uCsgRadius: THREE.IUniform<number>;
  uCsgAmount: THREE.IUniform<number>;
}
interface Membrane {
  material: THREE.MeshPhysicalMaterial;
  u: MembraneUniforms;
}

const MEMBRANE_FRAG_DECL = /* glsl */ `
varying vec3 vCsgPos;
uniform vec3 uRimColor;
uniform float uRimMix;
uniform float uRimPower;
uniform float uFaceAlpha;
uniform float uCsgMode;
uniform vec3 uCsgCenter;
uniform float uCsgRadius;
uniform float uCsgAmount;`;

const MEMBRANE_FRAG_BODY = /* glsl */ `
	float memNv = abs( dot( normal, normalize( vViewPosition ) ) );
	float memRim = pow( 1.0 - memNv, uRimPower );
	diffuseColor.rgb = mix( diffuseColor.rgb, uRimColor, memRim * uRimMix );
	diffuseColor.a *= mix( uFaceAlpha, 1.0, memRim );
	float memD = length( vCsgPos - uCsgCenter ) - uCsgRadius;
	if ( uCsgMode > 1.5 ) {
		if ( memD > 0.0 ) discard;
	} else if ( uCsgMode > 0.5 ) {
		if ( memD < 0.0 ) diffuseColor.a *= 1.0 - uCsgAmount;
	}
	if ( diffuseColor.a < 0.003 ) discard;`;

function makeMembrane(o: {
  color: THREE.Color;
  rimColor: THREE.Color;
  side: THREE.Side;
  faceAlpha: number;
  rimMix: number;
  rimPower: number;
  mode: 0 | 1 | 2;
  sheen?: number;
  clearcoat?: number;
}): Membrane {
  const u: MembraneUniforms = {
    uRimColor: { value: o.rimColor.clone() },
    uRimMix: { value: o.rimMix },
    uRimPower: { value: o.rimPower },
    uFaceAlpha: { value: o.faceAlpha },
    uCsgMode: { value: o.mode },
    uCsgCenter: { value: new THREE.Vector3() },
    uCsgRadius: { value: 1 },
    uCsgAmount: { value: 0 },
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: o.color.clone(),
    roughness: 0.45,
    metalness: 0,
    clearcoat: o.clearcoat ?? 0.3,
    clearcoatRoughness: 0.4,
    sheen: o.sheen ?? 0.6,
    sheenColor: new THREE.Color('#ffffff'),
    sheenRoughness: 0.5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: o.side,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCsgPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvCsgPos = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${MEMBRANE_FRAG_DECL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${MEMBRANE_FRAG_BODY}`);
  };
  // mesmo código injetado em todas as membranas → um único programa compartilhado (uniforms por material)
  material.customProgramCacheKey = () => 'h1n1-cell-membrane-v1';
  return { material, u };
}

// ---------- geometrias ----------
function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // mergeGeometries exige que todas as peças sejam indexadas ou nenhuma: normaliza para não indexadas
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const g = mergeGeometries(flat, false);
  parts.forEach((p) => p.dispose());
  flat.forEach((p) => p.dispose());
  if (!g) throw new Error('mergeGeometries falhou');
  return g;
}

/** Receptor com ácido siálico: haste fina + cabecinha (comprimento ≈ 0,23). */
function receptorGeometry(hi: boolean): THREE.BufferGeometry {
  return mergeAll([
    new THREE.CylinderGeometry(0.016, 0.018, 0.18, hi ? 6 : 5, 1, true).translate(0, 0.09, 0),
    new THREE.SphereGeometry(0.042, hi ? 8 : 6, hi ? 6 : 5).translate(0, 0.19, 0),
  ]);
}

/** Espinho simplificado de broto (para raio 0,45): haste + cabeça low-poly. */
function budSpikeGeometry(): THREE.BufferGeometry {
  return mergeAll([
    new THREE.CylinderGeometry(0.012, 0.016, 0.13, 5, 1, true).translate(0, 0.065, 0),
    new THREE.IcosahedronGeometry(0.036, 0).translate(0, 0.15, 0),
  ]);
}

/** Célula-alvo: parede, receptores, vesícula, núcleo sugerido e brotos (quadro micro). */
export function Cell({ stateRef, ambientRef, quality }: { stateRef: StateRef; ambientRef: AmbientRef; quality: 'low' | 'high' }) {
  const hi = quality === 'high';
  const nReceptors = COUNTS[quality].receptors;
  const nBuds = hi ? 6 : 4;
  const spikesPerBud = hi ? 16 : 10;

  const wallGroup = useRef<THREE.Group>(null);
  const wall = useRef<THREE.Mesh>(null);
  const receptors = useRef<THREE.InstancedMesh>(null);
  const vesicle = useRef<THREE.Mesh>(null);
  const lumen = useRef<THREE.Mesh>(null);
  const nucleus = useRef<THREE.Group>(null);
  const buds = useRef<THREE.Group>(null);
  const budBodies = useRef<THREE.InstancedMesh>(null);
  const budSpikes = useRef<THREE.InstancedMesh>(null);
  const budRings = useRef<THREE.InstancedMesh>(null);

  const geoms = useMemo(
    () => ({
      // polo da esfera voltado para −x (ponto de contato): anéis concêntricos ao redor da covinha
      wall: new THREE.SphereGeometry(CELL_RADIUS, hi ? 96 : 64, hi ? 64 : 40).rotateZ(Math.PI / 2),
      vesicle: new THREE.SphereGeometry(VESICLE_RADIUS, hi ? 64 : 40, hi ? 40 : 28),
      lumen: new THREE.SphereGeometry(VESICLE_RADIUS * 0.97, hi ? 32 : 24, hi ? 24 : 16),
      nucleus: new THREE.SphereGeometry(NUCLEUS_RADIUS, hi ? 40 : 28, hi ? 28 : 20),
      nucleolus: new THREE.SphereGeometry(0.3, 16, 12),
      receptor: receptorGeometry(hi),
      budBody: new THREE.SphereGeometry(1, hi ? 20 : 14, hi ? 14 : 10),
      budSpike: budSpikeGeometry(),
      ring: new THREE.TorusGeometry(1, 0.07, 6, hi ? 28 : 20),
    }),
    [hi],
  );
  useEffect(() => () => Object.values(geoms).forEach((g) => g.dispose()), [geoms]);

  const mats = useMemo(() => {
    const wallM = makeMembrane({ color: C_CELL, rimColor: C_RIM, side: THREE.FrontSide, faceAlpha: 0.16, rimMix: 0.75, rimPower: 2.2, mode: 1 });
    wallM.u.uCsgRadius.value = VESICLE_RADIUS;
    const vesicleM = makeMembrane({ color: C_CELL, rimColor: C_RIM, side: THREE.DoubleSide, faceAlpha: 0.2, rimMix: 0.7, rimPower: 2.2, mode: 2 });
    vesicleM.u.uCsgRadius.value = CELL_RADIUS;
    const lumenM = makeMembrane({ color: C_ACID, rimColor: C_ACID, side: THREE.BackSide, faceAlpha: 1, rimMix: 0, rimPower: 2, mode: 2, sheen: 0, clearcoat: 0 });
    lumenM.u.uCsgRadius.value = CELL_RADIUS;
    const nucleusM = makeMembrane({ color: C_NUCLEUS, rimColor: C_NUCLEUS_RIM, side: THREE.FrontSide, faceAlpha: 0.5, rimMix: 0.55, rimPower: 2, mode: 0, sheen: 0.4, clearcoat: 0.15 });
    const nucleolusM = makeMembrane({ color: C_NUCLEOLUS, rimColor: C_NUCLEUS_RIM, side: THREE.FrontSide, faceAlpha: 0.7, rimMix: 0.3, rimPower: 2, mode: 0, sheen: 0, clearcoat: 0 });
    const receptor = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0 });
    const budBody = new THREE.MeshPhysicalMaterial({ color: PART_COLORS.envelope, roughness: 0.5, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
    const budSpike = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.48, metalness: 0.05 });
    const ring = new THREE.MeshBasicMaterial({ color: PART_COLORS.h1n1, transparent: true, opacity: 0.45, depthWrite: false });
    return { wallM, vesicleM, lumenM, nucleusM, nucleolusM, receptor, budBody, budSpike, ring };
  }, []);
  useEffect(
    () => () => {
      const { wallM, vesicleM, lumenM, nucleusM, nucleolusM, receptor, budBody, budSpike, ring } = mats;
      [wallM, vesicleM, lumenM, nucleusM, nucleolusM].forEach((m) => m.material.dispose());
      [receptor, budBody, budSpike, ring].forEach((m) => m.dispose());
    },
    [mats],
  );

  const recDirs = useMemo(() => receptorDirs(nReceptors), [nReceptors]);
  const spots = useMemo(() => budSpots(nBuds), [nBuds]);
  const budStatic = useMemo(
    () => ({
      ringQ: spots.map((s) => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, new THREE.Vector3(s.n.x, s.n.y, s.n.z))),
      spikeDirs: fibonacciSphere(spikesPerBud).map((d) => new THREE.Vector3(d.x, d.y, d.z)),
      spikeQ: fibonacciSphere(spikesPerBud).map((d) => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(d.x, d.y, d.z))),
    }),
    [spots, spikesPerBud],
  );

  // rascunhos reutilizados (zero alocação por quadro)
  const scratch = useMemo(
    () => ({
      dummy: new THREE.Object3D(),
      dir: new THREE.Vector3(),
      color: new THREE.Color(),
      place: emptyPlacement(),
      phase: emptyBudPhase(),
    }),
    [],
  );
  /** últimos valores aplicados: membrane, dock, engulf, bud, uncoat, release */
  const applied = useRef<number[]>([NaN, NaN, NaN, NaN, NaN, NaN]);
  const lumenAmount = useRef(0);
  // cores por instância criadas já na montagem (o programa nasce com USE_INSTANCING_COLOR: sem recompilar depois)
  useLayoutEffect(() => {
    applied.current.fill(NaN);
    const rec = receptors.current;
    if (rec) {
      for (let i = 0; i < rec.count; i++) rec.setColorAt(i, C_RECEPTOR);
      if (rec.instanceColor) rec.instanceColor.needsUpdate = true;
    }
    const spikes = budSpikes.current;
    if (spikes) {
      for (let i = 0; i < spikes.count; i++) spikes.setColorAt(i, (i % spikesPerBud) % 4 === 3 ? C_NA : C_HA);
      if (spikes.instanceColor) spikes.instanceColor.needsUpdate = true;
    }
  }, [quality, nReceptors, nBuds, spikesPerBud]);

  useFrame(() => {
    const s = stateRef.current;
    const { lumenM } = mats;

    // único efeito por tempo: o âmbar da vesícula "respira" de leve durante a acidificação
    if (lumenAmount.current > 0.004) {
      const b = 0.5 + 0.5 * ambientRef.current.breath;
      lumenM.material.opacity = LUMEN_OPACITY * lumenAmount.current * (0.82 + 0.18 * b);
    }

    const last = applied.current;
    if (same(last[0], s.membrane) && same(last[1], s.dock) && same(last[2], s.engulf) && same(last[3], s.bud) && same(last[4], s.uncoat) && same(last[5], s.release)) return;
    last[0] = s.membrane;
    last[1] = s.dock;
    last[2] = s.engulf;
    last[3] = s.bud;
    last[4] = s.uncoat;
    last[5] = s.release;

    const { wallM, vesicleM, nucleusM, nucleolusM } = mats;
    const { dummy, dir, color, place, phase } = scratch;
    const membrane = s.membrane;
    const cx = cellCenterX(s);
    const presence = vesiclePresence(s);

    // ---- parede + receptores ----
    const showWall = membrane > 0.01;
    if (wallGroup.current) wallGroup.current.visible = showWall;
    if (showWall) {
      if (wall.current) wall.current.position.set(cx, 0, 0);
      const fade = wallFade(s.bud);
      wallM.material.opacity = WALL_OPACITY * membrane * fade;
      // buraco da parede = esfera da vesícula (no espaço local da parede)
      wallM.u.uCsgCenter.value.set(-cx, 0, 0);
      wallM.u.uCsgAmount.value = presence;

      const rec = receptors.current;
      if (rec) {
        const grow = (0.15 + 0.85 * smoothUnit((membrane - 0.25) / 0.75)) * smoothUnit(fade / 0.6);
        const hot = s.dock * (1 - s.release) * membrane;
        const n = Math.min(recDirs.length, rec.count);
        for (let i = 0; i < n; i++) {
          placeReceptor(recDirs[i]!, cx, presence, place);
          const h = i < HOT_RECEPTORS ? hot * (i === HOT_RECEPTORS - 1 ? 0.75 : 1) : 0;
          const k = grow * place.vis;
          dummy.position.set(place.x, place.y, place.z);
          dir.set(place.nx, place.ny, place.nz);
          dummy.quaternion.setFromUnitVectors(UP, dir);
          // engrossa no encaixe; encurta quando preso à vesícula (cabeça encosta na HA)
          dummy.scale.set(k * (1 + 0.7 * h), k * (1 - 0.45 * Math.max(place.bound, 0.5 * h)), k * (1 + 0.7 * h));
          dummy.updateMatrix();
          rec.setMatrixAt(i, dummy.matrix);
          color.copy(C_RECEPTOR).lerp(C_RECEPTOR_HOT, h);
          rec.setColorAt(i, color);
        }
        rec.instanceMatrix.needsUpdate = true;
        if (rec.instanceColor) rec.instanceColor.needsUpdate = true;
      }
    }

    // ---- vesícula (só a parte dentro da célula) + tom âmbar ----
    const vesOpacity = VESICLE_OPACITY * presence * membrane * (1 - 0.3 * s.release);
    if (vesicle.current) vesicle.current.visible = vesOpacity > 0.004;
    vesicleM.material.opacity = vesOpacity;
    vesicleM.u.uCsgCenter.value.set(cx, 0, 0);
    vesicleM.material.color.copy(C_CELL).lerp(C_ACID, 0.85 * s.uncoat);
    const closed = smoothUnit((s.engulf - 0.9) / 0.1);
    const lum = s.uncoat * closed * (1 - smoothUnit(s.bud / 0.12)) * membrane;
    lumenAmount.current = lum;
    if (lumen.current) lumen.current.visible = lum > 0.004;
    lumenM.u.uCsgCenter.value.set(cx, 0, 0);
    if (lum > 0.004) {
      const b = 0.5 + 0.5 * ambientRef.current.breath;
      lumenM.material.opacity = LUMEN_OPACITY * lum * (0.82 + 0.18 * b);
    }

    // ---- núcleo sugerido ----
    const showNucleus = s.release > 0.01;
    if (nucleus.current) nucleus.current.visible = showNucleus;
    nucleusM.material.opacity = NUCLEUS_OPACITY * s.release;
    nucleolusM.material.opacity = NUCLEOLUS_OPACITY * s.release;

    // ---- brotos ----
    const showBuds = s.bud > 0.01;
    if (buds.current) buds.current.visible = showBuds;
    const bodies = budBodies.current;
    const spikes = budSpikes.current;
    const rings = budRings.current;
    if (showBuds && bodies && spikes && rings) {
      const { ringQ, spikeDirs, spikeQ } = budStatic;
      for (let j = 0; j < spots.length; j++) {
        const sp = spots[j]!;
        budPhase(s.bud, j, spots.length, phase);
        const r = BUD_RADIUS * phase.grow;
        const ax = cx - sp.off;
        const off = budOffset(phase.grow, phase.detach);
        const px = ax + sp.n.x * off;
        const py = sp.y + sp.n.y * off;
        const pz = sp.z + sp.n.z * off;
        dummy.position.set(px, py, pz);
        dummy.quaternion.identity();
        dummy.scale.setScalar(Math.max(r, 1e-4));
        dummy.updateMatrix();
        bodies.setMatrixAt(j, dummy.matrix);
        const sk = Math.max(r / BUD_RADIUS, 1e-4);
        for (let i = 0; i < spikesPerBud; i++) {
          const d = spikeDirs[i]!;
          dummy.position.set(px + d.x * r * 0.96, py + d.y * r * 0.96, pz + d.z * r * 0.96);
          dummy.quaternion.copy(spikeQ[i]!);
          dummy.scale.setScalar(sk);
          dummy.updateMatrix();
          spikes.setMatrixAt(j * spikesPerBud + i, dummy.matrix);
        }
        // anel rosa curto no pescoço quando a NA solta o broto
        const ringScale = phase.glow > 0.001 ? (0.16 + 0.3 * phase.glowT) * Math.min(1, 3 * phase.glow) : 1e-4;
        dummy.position.set(ax + sp.n.x * 0.03, sp.y + sp.n.y * 0.03, sp.z + sp.n.z * 0.03);
        dummy.quaternion.copy(ringQ[j]!);
        dummy.scale.setScalar(ringScale);
        dummy.updateMatrix();
        rings.setMatrixAt(j, dummy.matrix);
      }
      bodies.instanceMatrix.needsUpdate = true;
      spikes.instanceMatrix.needsUpdate = true;
      rings.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* parede (transparente, desenhada antes da vesícula) + receptores opacos */}
      <group ref={wallGroup} visible={false}>
        <mesh ref={wall} geometry={geoms.wall} material={mats.wallM.material} renderOrder={1} />
        <instancedMesh key={`rec-${quality}`} ref={receptors} args={[geoms.receptor, mats.receptor, nReceptors]} frustumCulled={false} />
      </group>

      {/* vesícula na origem (envolve o vírion) e o lúmen que fica âmbar na acidificação */}
      <mesh ref={lumen} geometry={geoms.lumen} material={mats.lumenM.material} renderOrder={-1} visible={false} />
      <mesh ref={vesicle} geometry={geoms.vesicle} material={mats.vesicleM.material} renderOrder={2} visible={false} />

      {/* núcleo sugerido, destino das RNPs */}
      <group ref={nucleus} position={[NUCLEUS.x, NUCLEUS.y, NUCLEUS.z]} visible={false}>
        <mesh geometry={geoms.nucleolus} material={mats.nucleolusM.material} position={[0.28, 0.18, 0.1]} renderOrder={-2} />
        <mesh geometry={geoms.nucleus} material={mats.nucleusM.material} renderOrder={-1} />
      </group>

      {/* brotos: corpos, espinhos (HA azul / NA rosa) e anel rosa de soltura */}
      <group ref={buds} visible={false}>
        <instancedMesh key={`bb-${quality}`} ref={budBodies} args={[geoms.budBody, mats.budBody, nBuds]} frustumCulled={false} />
        <instancedMesh key={`bs-${quality}`} ref={budSpikes} args={[geoms.budSpike, mats.budSpike, nBuds * spikesPerBud]} frustumCulled={false} />
        <instancedMesh key={`br-${quality}`} ref={budRings} args={[geoms.ring, mats.ring, nBuds]} frustumCulled={false} renderOrder={3} />
      </group>
    </group>
  );
}

/** mesmo valor aplicado (NaN = nunca aplicado → sempre diferente) */
function same(a: number | undefined, b: number): boolean {
  return a !== undefined && Math.abs(a - b) < 1e-5;
}

function smoothUnit(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}
