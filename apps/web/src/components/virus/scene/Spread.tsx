'use client';
/**
 * Contágio (capítulo 4): duas silhuetas e gotículas que saem de uma e alcançam a outra.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seededRandom } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import { MOUTH_Y, PERSON_X, smooth, type StateRef } from './shared';

/** Duas silhuetas (capítulo 4). */
export function People({ stateRef }: { stateRef: StateRef }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const p = stateRef.current.people;
    if (group.current) group.current.visible = p > 0.01;
    mats.current.forEach((m) => {
      m.opacity = 0.95 * p;
    });
  });
  const setMat = (m: THREE.MeshStandardMaterial | null) => {
    if (m && !mats.current.includes(m)) mats.current.push(m);
  };
  const person = (x: number, flip: boolean) => (
    <group position={[x, 0, 0]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.42, 28, 20]} />
        <meshStandardMaterial ref={setMat} color={PART_COLORS.person} roughness={0.9} transparent opacity={0} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <capsuleGeometry args={[0.6, 1.1, 6, 14]} />
        <meshStandardMaterial ref={setMat} color={PART_COLORS.person} roughness={0.9} transparent opacity={0} />
      </mesh>
    </group>
  );
  return (
    <group ref={group} visible={false}>
      {person(-PERSON_X, false)}
      {person(PERSON_X, true)}
    </group>
  );
}

/** Gotículas que saem de uma silhueta e alcançam a outra. */
export function Droplets({ stateRef, count }: { stateRef: StateRef; count: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const applied = useRef(-1);
  const items = useMemo(() => {
    const rnd = seededRandom(11);
    return Array.from({ length: count }, () => ({ delay: rnd() * 0.6, arc: 0.25 + rnd() * 0.9, z: (rnd() - 0.5) * 1.1, y: (rnd() - 0.5) * 0.3, size: 0.03 + rnd() * 0.055, droop: rnd() * 0.9 }));
  }, [count]);
  useFrame(() => {
    const d = stateRef.current.droplets;
    const m = mesh.current;
    if (!m) return;
    m.visible = d > 0.01;
    if (Math.abs(d - applied.current) < 1e-4) return;
    applied.current = d;
    const x0 = -PERSON_X + 0.5;
    const x1 = PERSON_X - 0.5;
    items.forEach((it, i) => {
      const t = smooth((d * 1.55 - it.delay) / 0.95);
      const x = x0 + (x1 - x0) * t;
      const y = MOUTH_Y + it.y + it.arc * 4 * t * (1 - t) - it.droop * t * t;
      dummy.position.set(x, y, it.z * t);
      dummy.scale.setScalar(d < 0.01 ? 0.0001 : it.size * (0.6 + 0.4 * (1 - t)));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} frustumCulled={false} args={[undefined, undefined, count]} visible={false}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial color={PART_COLORS.droplet} roughness={0.3} transparent opacity={0.85} />
    </instancedMesh>
  );
}
