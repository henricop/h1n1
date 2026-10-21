/**
 * Tipos, constantes e utilitários compartilhados pelos módulos da cena 3D (scene/*).
 */
import type { MutableRefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneState } from '@/lib/virus/chapters';
import type { Vec3 } from '@/lib/virus/geometry';

export type StateRef = MutableRefObject<SceneState>;

export const R_ENV = 1;
export const UP = new THREE.Vector3(0, 1, 0);
export const CELL_CENTER = new THREE.Vector3(3.3, 0, 0);
export const CELL_RADIUS = 2.2;
export const PERSON_X = 2.8;
export const MOUTH_Y = 0.95;

export const COUNTS = {
  high: { ha: 90, na: 16, m2: 8, antibodies: 36, droplets: 80, receptors: 44 },
  low: { ha: 50, na: 10, m2: 6, antibodies: 20, droplets: 44, receptors: 24 },
} as const;

export interface PartProps {
  stateRef: StateRef;
  active: boolean;
  onOver: (e: ThreeEvent<PointerEvent>) => void;
  onOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
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
