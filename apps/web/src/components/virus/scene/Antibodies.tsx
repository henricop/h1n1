'use client';
/**
 * Anticorpos em "Y" (capítulo 5): chegam de fora e grudam nas cabeças de hemaglutinina.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { seededRandom, type Vec3 } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import { antibodyGeometry } from './geometries';
import { R_ENV, UP, smooth, toVector, type StateRef } from './shared';

/** Anticorpos em "Y" (verde) que chegam de fora e grudam nas cabeças de hemaglutinina. */
export function Antibodies({ haDirs, count, stateRef }: { haDirs: readonly Vec3[]; count: number; stateRef: StateRef }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => antibodyGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const applied = useRef(-1);
  const items = useMemo(() => {
    const rnd = seededRandom(7);
    const step = Math.max(1, Math.floor(haDirs.length / count));
    return Array.from({ length: count }, (_, i) => {
      const d = haDirs[(i * step) % haDirs.length]!;
      const dir = toVector(d);
      const rv = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
      const tangent = rv.sub(dir.clone().multiplyScalar(dir.dot(rv))).normalize();
      const start = dir.clone().multiplyScalar(R_ENV + 2.3).add(tangent.multiplyScalar(0.9 * rnd()));
      const end = dir.clone().multiplyScalar(R_ENV + 0.46);
      return { dir, start, end, delay: rnd() * 0.55, roll: rnd() * Math.PI * 2 };
    });
  }, [haDirs, count]);
  useEffect(() => () => geom.dispose(), [geom]);
  useFrame(() => {
    const a = stateRef.current.antibodies;
    const m = mesh.current;
    if (!m) return;
    m.visible = a > 0.01;
    if (Math.abs(a - applied.current) < 1e-4) return;
    applied.current = a;
    items.forEach((it, i) => {
      const t = smooth((a - it.delay) / 0.45);
      dummy.position.lerpVectors(it.start, it.end, t);
      dummy.quaternion.setFromUnitVectors(UP, it.dir.clone().negate());
      dummy.rotateY(it.roll);
      dummy.scale.setScalar(a < 0.01 ? 0.0001 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} frustumCulled={false} args={[geom, undefined, count]} visible={false}>
      <meshStandardMaterial color={PART_COLORS.ok} roughness={0.5} />
    </instancedMesh>
  );
}
