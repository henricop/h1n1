'use client';
/**
 * Luz de estúdio 100% offline: ambiente procedural (Environment + Lightformer, gerado uma vez), uma key
 * direcional, hemisférica fraca e sombra estática (blob) sob o grupo micro, nas duas qualidades. Sem pós-processamento (DESIGN.md: fundo claro, sem neon).
 */
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PART_COLORS } from '@/lib/virus/parts';
import type { Quality } from '@/lib/virus/pose';
import type { StateRef } from './shared';

/** Altura do plano de sombra em relação ao centro do vírion (unidades de cena, quadro micro). */
const SHADOW_Y = -1.95;

/** Textura radial (alfa no canal verde) para o blob estático. */
function blobTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      const t = d >= 1 ? 0 : 1 - d * d * (3 - 2 * d);
      const a = Math.round(255 * t * t);
      const i = (y * size + x) * 4;
      data[i] = a;
      data[i + 1] = a;
      data[i + 2] = a;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Sombra que segue o grupo micro (virusX/virusY) e escala com virusScale. Só lê stateRef. */
function Shadow({ stateRef, quality }: { stateRef: StateRef; quality: Quality }) {
  const group = useRef<THREE.Group>(null);
  // blob estático nas duas qualidades: ContactShadows re-renderizaria a cena inteira a cada quadro
  const tex = useMemo(() => blobTexture(), []);
  useEffect(() => () => tex?.dispose(), [tex]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = stateRef.current;
    g.position.set(s.virusX, s.virusY + SHADOW_Y * s.virusScale, 0);
    g.scale.setScalar(s.virusScale);
    // some quando o vírion está "de longe" (capítulo 4) ou já engolido
    g.visible = s.virusScale > 0.5 && s.engulf < 0.5;
  });
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial color={PART_COLORS.ink} alphaMap={tex} transparent opacity={quality === 'high' ? 0.18 : 0.16} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Lighting({ stateRef, quality }: { stateRef: StateRef; quality: Quality }) {
  return (
    <>
      <Environment frames={1} resolution={256} environmentIntensity={0.9}>
        {/* backdrop claro: dá o "céu" cinza-azulado aos reflexos (clearcoat/transmissão) */}
        <mesh scale={50}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#eef1f7" side={THREE.BackSide} />
        </mesh>
        {/* key */}
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[2, 4, 3]} scale={[4, 3]} target={[0, 0, 0]} />
        {/* fill */}
        <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[-4, 1, 2]} scale={[3, 3]} target={[0, 0, 0]} />
        {/* rim (contorno frio, discreto) */}
        <Lightformer form="ring" intensity={1.6} color="#dfe8ff" position={[0, 2, -5]} scale={3} target={[0, 0, 0]} />
        {/* teto */}
        <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={4} />
      </Environment>
      <directionalLight position={[3, 5, 4]} intensity={1.4} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#dfe6f2', 0.35]} />
      <Shadow stateRef={stateRef} quality={quality} />
    </>
  );
}
