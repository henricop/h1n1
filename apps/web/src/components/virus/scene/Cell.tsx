'use client';
/**
 * Célula-alvo (capítulo 3): esfera grande translúcida com receptores voltados para o vírus.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fibonacciSphere } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import { receptorGeometry } from './geometries';
import { CELL_CENTER, CELL_RADIUS, UP, toVector, type StateRef } from './shared';

/** Célula-alvo (capítulo 3): esfera grande translúcida com receptores voltados para o vírus. */
export function Cell({ stateRef, receptors }: { stateRef: StateRef; receptors: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const recMat = useRef<THREE.MeshStandardMaterial>(null);
  const inst = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => receptorGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dirs = useMemo(() => fibonacciSphere(receptors * 5).filter((d) => d.x < -0.55).slice(0, receptors), [receptors]);
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => {
    const m = inst.current;
    if (!m) return;
    dirs.forEach((d, i) => {
      const v = toVector(d);
      dummy.position.copy(v).multiplyScalar(CELL_RADIUS);
      dummy.quaternion.setFromUnitVectors(UP, v);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [dirs, dummy]);
  useFrame(() => {
    const c = stateRef.current.cell;
    if (group.current) group.current.visible = c > 0.01;
    if (mat.current) mat.current.opacity = 0.82 * c;
    if (recMat.current) recMat.current.opacity = c;
  });
  return (
    <group ref={group} position={CELL_CENTER} visible={false}>
      <mesh>
        <sphereGeometry args={[CELL_RADIUS, 64, 40]} />
        <meshPhysicalMaterial ref={mat} color={PART_COLORS.cell} roughness={0.7} clearcoat={0.2} transparent opacity={0} depthWrite={false} />
      </mesh>
      <instancedMesh ref={inst} frustumCulled={false} args={[geom, undefined, dirs.length]}>
        <meshStandardMaterial ref={recMat} color="#7b96e8" roughness={0.6} transparent opacity={0} />
      </instancedMesh>
    </group>
  );
}

