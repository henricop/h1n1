'use client';
/**
 * Rótulos das peças (drei <Html>) ancorados a pontos 3D que acompanham o explode.
 */
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/lib/virus/geometry';
import { PART_BY_ID, type PartId } from '@/lib/virus/parts';
import { R_ENV, closestDir, toVector, type StateRef } from './shared';

const LABEL_IDS: readonly PartId[] = ['ha', 'na', 'rna', 'envelope', 'm1', 'm2'];

export function Labels({
  stateRef,
  haDirs,
  naDirs,
  m2Dirs,
  labelsOn,
  hovered,
  selected,
  onSelect,
}: {
  stateRef: StateRef;
  haDirs: readonly Vec3[];
  naDirs: readonly Vec3[];
  m2Dirs: readonly Vec3[];
  labelsOn: boolean;
  hovered: PartId | null;
  selected: PartId | null;
  onSelect: (p: PartId) => void;
}) {
  const refs = useRef<Record<PartId, THREE.Group | null>>({ ha: null, na: null, rna: null, envelope: null, m1: null, m2: null });
  const anchors = useMemo(() => {
    const ha = toVector(haDirs[closestDir(haDirs, { x: -0.55, y: 0.6, z: 0.55 })]!);
    const na = toVector(naDirs[closestDir(naDirs, { x: 0.7, y: -0.35, z: 0.6 })]!);
    const m2 = toVector(m2Dirs[closestDir(m2Dirs, { x: 0.6, y: 0.5, z: 0.6 })]!);
    return { ha, na, m2 };
  }, [haDirs, naDirs, m2Dirs]);
  useFrame(() => {
    const e = stateRef.current.explode;
    const r = refs.current;
    r.ha?.position.copy(anchors.ha).multiplyScalar(R_ENV + 0.5 + e * 0.8).setY(anchors.ha.y * (R_ENV + 0.5 + e * 0.8) + e * 0.35);
    r.na?.position.copy(anchors.na).multiplyScalar(R_ENV + 0.55 + e * 0.95).add(new THREE.Vector3(-e * 0.35, -e * 0.3, 0));
    r.rna?.position.set(0, -0.75, 0.4 + e * 1.25);
    r.envelope?.position.set(0, R_ENV + 0.12 + e * 0.78, 0);
    r.m1?.position.set(-0.55, e * 0.34 + 0.2, 0.7);
    r.m2?.position.copy(anchors.m2).multiplyScalar(R_ENV + 0.2 + e * 0.55).add(new THREE.Vector3(e * 0.3, 0, 0));
  });
  return (
    <>
      {LABEL_IDS.map((id) => {
        const part = PART_BY_ID.get(id)!;
        const forced = hovered === id || selected === id;
        const show = forced || (labelsOn && (id === 'ha' || id === 'na' || id === 'rna' || id === 'envelope'));
        return (
          <group
            key={id}
            ref={(g) => {
              refs.current[id] = g;
            }}
          >
            {show && (
              <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className={`pointer-events-auto max-w-[15rem] rounded-xl border bg-white/95 px-3 py-2 text-left text-[13px] leading-snug text-ink shadow-[0_8px_30px_-12px_rgba(11,18,32,.28)] backdrop-blur ${forced ? 'border-primary-600' : 'border-line'}`}
                >
                  <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${dotClass(id)}`} aria-hidden="true" />
                  {part.label}
                </button>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

function dotClass(id: PartId): string {
  switch (id) {
    case 'ha':
      return 'bg-primary-600';
    case 'na':
      return 'bg-h1n1';
    case 'rna':
      return 'bg-infb';
    default:
      return 'bg-line-strong';
  }
}
