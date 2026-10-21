'use client';
/**
 * O vírion: envelope (2 hemisférios), camada M1, espinhos HA/NA instanciados, canais M2 e 8 RNPs.
 * Cada peça lê `stateRef.current.explode` por quadro.
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RNA_SEGMENTS, helixPoints, type Vec3 } from '@/lib/virus/geometry';
import { PART_COLORS } from '@/lib/virus/parts';
import { haGeometry, naGeometry } from './geometries';
import { R_ENV, UP, toVector, type PartProps } from './shared';

/** Envelope lipídico em dois hemisférios, que se afastam no explode. */
export function Envelope({ stateRef, active, onOver, onOut, onClick }: PartProps) {
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(() => {
    const e = stateRef.current.explode;
    if (top.current) {
      top.current.position.y = e * 0.78;
      top.current.rotation.x = -e * 0.22;
    }
    if (bottom.current) {
      bottom.current.position.y = -e * 0.78;
      bottom.current.rotation.x = e * 0.22;
    }
  });
  const mat = (
    <meshPhysicalMaterial
      color={PART_COLORS.envelope}
      roughness={0.55}
      metalness={0}
      clearcoat={0.35}
      clearcoatRoughness={0.5}
      sheen={0.4}
      sheenColor="#ffffff"
      transparent
      opacity={0.72}
      depthWrite={false}
      side={THREE.DoubleSide}
      emissive={PART_COLORS.primary}
      emissiveIntensity={active ? 0.12 : 0}
    />
  );
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      setHover(true);
      onOver(e);
    },
    onPointerOut: () => {
      setHover(false);
      onOut();
    },
    onClick,
  };
  return (
    <>
      <mesh ref={top} {...handlers}>
        <sphereGeometry args={[R_ENV, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh ref={bottom} {...handlers}>
        <sphereGeometry args={[R_ENV, 56, 28, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {mat}
      </mesh>
    </>
  );
}

/** Camada M1: dois hemisférios foscos logo abaixo do envelope. */
export function Matrix({ stateRef, active, onOver, onOut, onClick }: PartProps) {
  const top = useRef<THREE.Mesh>(null);
  const bottom = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(() => {
    const e = stateRef.current.explode;
    if (top.current) top.current.position.y = e * 0.34;
    if (bottom.current) bottom.current.position.y = -e * 0.34;
  });
  const mat = <meshStandardMaterial color={PART_COLORS.m1} roughness={0.95} transparent opacity={0.9} side={THREE.DoubleSide} emissive={PART_COLORS.primary} emissiveIntensity={active ? 0.18 : 0} />;
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      setHover(true);
      onOver(e);
    },
    onPointerOut: () => {
      setHover(false);
      onOut();
    },
    onClick,
  };
  return (
    <>
      <mesh ref={top} {...handlers}>
        <sphereGeometry args={[0.86, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh ref={bottom} {...handlers}>
        <sphereGeometry args={[0.86, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        {mat}
      </mesh>
    </>
  );
}

/** Espinhos instanciados (HA azul ou NA rosa) distribuídos pela esfera de Fibonacci. */
export function Spikes({ kind, dirs, stateRef, active, onOver, onOut, onClick }: PartProps & { kind: 'ha' | 'na'; dirs: readonly Vec3[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => (kind === 'ha' ? haGeometry() : naGeometry()), [kind]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const applied = useRef(-1);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useEffect(() => () => geom.dispose(), [geom]);
  useFrame(() => {
    const e = stateRef.current.explode;
    const m = mesh.current;
    if (!m || Math.abs(e - applied.current) < 1e-4) return;
    applied.current = e;
    dirs.forEach((d, i) => {
      tmp.set(d.x, d.y, d.z);
      const r = kind === 'ha' ? R_ENV - 0.02 + e * 0.8 : R_ENV - 0.02 + e * 0.95;
      dummy.position.copy(tmp).multiplyScalar(r);
      if (kind === 'ha') dummy.position.y += e * 0.35;
      else {
        dummy.position.y -= e * 0.3;
        dummy.position.x -= e * 0.35;
      }
      dummy.quaternion.setFromUnitVectors(UP, tmp);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  const color = kind === 'ha' ? PART_COLORS.primary : PART_COLORS.h1n1;
  return (
    <instancedMesh
      ref={mesh}
      frustumCulled={false}
      args={[geom, undefined, dirs.length]}
      onPointerOver={(e) => {
        setHover(true);
        onOver(e);
      }}
      onPointerOut={() => {
        setHover(false);
        onOut();
      }}
      onClick={onClick}
    >
      <meshStandardMaterial color={color} roughness={0.48} metalness={0.05} emissive={color} emissiveIntensity={active ? 0.45 : 0} />
    </instancedMesh>
  );
}

/** Canais M2: pequenos cilindros cinza. */
export function Channels({ dirs, stateRef, active, onOver, onOut, onClick }: PartProps & { dirs: readonly Vec3[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const applied = useRef(-1);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  useFrame(() => {
    const e = stateRef.current.explode;
    const m = mesh.current;
    if (!m || Math.abs(e - applied.current) < 1e-4) return;
    applied.current = e;
    dirs.forEach((d, i) => {
      tmp.set(d.x, d.y, d.z);
      dummy.position.copy(tmp).multiplyScalar(R_ENV + 0.03 + e * 0.55);
      dummy.position.x += e * 0.3;
      dummy.quaternion.setFromUnitVectors(UP, tmp);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      frustumCulled={false}
      args={[undefined, undefined, dirs.length]}
      onPointerOver={(e) => {
        setHover(true);
        onOver(e);
      }}
      onPointerOut={() => {
        setHover(false);
        onOut();
      }}
      onClick={onClick}
    >
      <cylinderGeometry args={[0.034, 0.034, 0.2, 8]} />
      <meshStandardMaterial color={PART_COLORS.m2} roughness={0.7} emissive={PART_COLORS.primary} emissiveIntensity={active ? 0.5 : 0} />
    </instancedMesh>
  );
}

/** 8 ribonucleoproteínas (hélices), arranjo 7+1 por dentro; em leque no explode. */
export function Rnps({ stateRef, active, onOver, onOut, onClick }: PartProps) {
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useCursor(hover);
  const items = useMemo(
    () =>
      RNA_SEGMENTS.map((seg, k) => {
        const len = 1.2 * seg.relLength + 0.15;
        const pts = helixPoints(2.6 * seg.relLength + 1.2, 0.07, len, 56, k * 0.8).map(toVector);
        const curve = new THREE.CatmullRomCurve3(pts);
        const geometry = new THREE.TubeGeometry(curve, 72, 0.032, 7, false);
        const inner = k === 0 ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(Math.cos(((k - 1) / 7) * Math.PI * 2) * 0.42, 0, Math.sin(((k - 1) / 7) * Math.PI * 2) * 0.42);
        const outer = new THREE.Vector3((k - 3.5) * 0.4, -0.1, 1.45);
        const color = k % 2 === 0 ? PART_COLORS.infb : PART_COLORS.h3;
        return { geometry, inner, outer, color, tilt: (k - 3.5) * 0.11 };
      }),
    [],
  );
  useEffect(() => () => items.forEach((i) => i.geometry.dispose()), [items]);
  useFrame(() => {
    const e = stateRef.current.explode;
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, k) => {
      const it = items[k];
      if (!it) return;
      child.position.lerpVectors(it.inner, it.outer, e);
      child.rotation.z = it.tilt * e;
    });
  });
  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        setHover(true);
        onOver(e);
      }}
      onPointerOut={() => {
        setHover(false);
        onOut();
      }}
      onClick={onClick}
    >
      {items.map((it, k) => (
        <mesh key={k} geometry={it.geometry} position={it.inner}>
          <meshStandardMaterial color={it.color} roughness={0.5} emissive={it.color} emissiveIntensity={active ? 0.4 : 0} />
        </mesh>
      ))}
    </group>
  );
}

