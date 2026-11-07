/**
 * Tipos, constantes e utilitários compartilhados pelos módulos da cena 3D (scene/*).
 * Contrato: só o Driver (VirusCanvas.tsx) escreve em `stateRef`/`ambientRef`; os módulos leem dentro de useFrame.
 */
import type { MutableRefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneState } from '@/lib/virus/scenestate';
import type { Vec3 } from '@/lib/virus/geometry';
import type { Rgb, StageLook } from '@/lib/virus/lighting';

export type StateRef = MutableRefObject<Readonly<SceneState>>;
/** Luz/cores do palco derivadas da cor viva do tema (lib/virus/lighting.ts), escritas a cada quadro em prioridade −11. */
export type LookRef = MutableRefObject<Readonly<StageLook>>;

/** Movimento ambiente (tempo): yaw integrado do `spin`, respiração, oscilação e piscar. */
export interface AmbientState {
  t: number;
  yaw: number;
  breath: number;
  wobble: number;
  blink: number;
}
export type AmbientRef = MutableRefObject<AmbientState>;

/** Raio nominal do envelope (unidades de cena; ≈ 55 nm). */
export const R_ENV = 1;
export const UP = new THREE.Vector3(0, 1, 0);
/** Silhuetas (capítulos 4 e 5), em coordenadas de mundo. */
export const PERSON_X = 2.8;
export const MOUTH_Y = 0.95;

/** Contagens de partículas fora do vírion (as de espinhos vivem em lib/virus/pose.ts, SPIKE_COUNTS). */
export const COUNTS = {
  high: { droplets: 80, receptors: 44 },
  low: { droplets: 44, receptors: 24 },
} as const;

export interface PartProps {
  stateRef: StateRef;
  active: boolean;
  onOver: (e: ThreeEvent<PointerEvent>) => void;
  onOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/** Copia uma cor sRGB 0–1 (lib/virus/lighting.ts) para um THREE.Color no espaço de trabalho (linear). */
export function setSrgb(c: THREE.Color, rgb: Readonly<Rgb>): THREE.Color {
  return c.setRGB(rgb.r, rgb.g, rgb.b, THREE.SRGBColorSpace);
}

/**
 * Liga/desliga `transparent` trocando de programa sem engasgo: three só troca o shader (define OPAQUE) com
 * `needsUpdate`; a variante alternativa é pré-compilada pelo palco (materiais com `userData.altTransparent`).
 */
export function setTransparent(m: THREE.Material, on: boolean): void {
  if (m.transparent === on) return;
  m.transparent = on;
  m.needsUpdate = true;
}

export function toVector(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.y, v.z);
}

export function closestDir(dirs: readonly Vec3[], target: Vec3): number {
  let best = 0;
  let bestDot = -Infinity;
  dirs.forEach((d, i) => {
    const dot = d.x * target.x + d.y * target.y + d.z * target.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  });
  return best;
}

export function rotateY(d: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: d.x * c + d.z * s, y: d.y, z: -d.x * s + d.z * c };
}

export function smooth(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}
