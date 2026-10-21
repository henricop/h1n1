'use client';
/**
 * Vírion A(H1N1) procedural em react-three-fiber. O estado da cena (explode, câmera, célula, gotículas,
 * anticorpos) é lido a cada quadro de `progress` (MotionValue) ou de `chapterOverride` e suavizado por
 * lerp; `frameloop="demand"` + invalidate só enquanto algo se move. Peças em scene/*.
 * Carregado com next/dynamic (ssr: false); o pôster SVG cobre o carregamento e o fallback.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import { SCENE_KEYS, sceneState, sceneStateFromProgress, type SceneState } from '@/lib/virus/chapters';
import { fibonacciSphere } from '@/lib/virus/geometry';
import { PART_COLORS, type PartId } from '@/lib/virus/parts';
import { Antibodies } from './scene/Antibodies';
import { Cell } from './scene/Cell';
import { Labels } from './scene/Labels';
import { Droplets, People } from './scene/Spread';
import { Channels, Envelope, Matrix, Rnps, Spikes } from './scene/Virion';
import { COUNTS, rotateY } from './scene/shared';

export interface VirusCanvasProps {
  /** progresso contínuo [0, 5) vindo da rolagem */
  progress: MotionValue<number>;
  /** capítulo fixo (reduced-motion / botões); null = seguir `progress` */
  chapterOverride: number | null;
  reducedMotion: boolean;
  quality: 'low' | 'high';
  hovered: PartId | null;
  selected: PartId | null;
  onHover: (p: PartId | null) => void;
  onSelect: (p: PartId) => void;
  onReady?: () => void;
}

// ---------- cena ----------
function Scene(props: VirusCanvasProps) {
  const { invalidate, camera } = useThree();
  const stateRef = useRef<SceneState>({ ...sceneState(0, 0) });
  const spin = useRef(0);
  const virusGroup = useRef<THREE.Group>(null);
  const labelsRef = useRef(false);
  const contactRef = useRef(false);
  const [labelsOn, setLabelsOn] = useState(false);
  const [contact, setContact] = useState(false);
  const { progress, chapterOverride, reducedMotion, onReady } = props;

  useEffect(() => progress.on('change', () => invalidate()), [progress, invalidate]);
  useEffect(() => {
    invalidate();
  }, [chapterOverride, props.hovered, props.selected, invalidate]);
  useEffect(() => {
    onReady?.();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = chapterOverride !== null ? sceneState(chapterOverride, 1) : sceneStateFromProgress(progress.get());
    const cur = stateRef.current;
    const k = reducedMotion ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const key of SCENE_KEYS) {
      const diff = target[key] - cur[key];
      if (Math.abs(diff) > 0.0006) {
        cur[key] += diff * k;
        moving = true;
      } else {
        cur[key] = target[key];
      }
    }
    if (!reducedMotion && cur.spin > 0.01) {
      spin.current += dt * 0.22 * cur.spin;
      moving = true;
    }
    const g = virusGroup.current;
    if (g) {
      g.rotation.y = spin.current;
      g.position.set(cur.virusX, cur.virusY, 0);
      g.scale.setScalar(cur.virusScale);
    }
    camera.position.set(cur.cameraX, cur.cameraY, cur.cameraZ);
    camera.lookAt(cur.cameraX * 0.55, 0.05, 0);
    const lab = cur.labels > 0.5;
    if (lab !== labelsRef.current) {
      labelsRef.current = lab;
      setLabelsOn(lab);
    }
    const c = cur.approach > 0.9;
    if (c !== contactRef.current) {
      contactRef.current = c;
      setContact(c);
    }
    if (moving) invalidate();
  });

  const counts = COUNTS[props.quality];
  const haDirs = useMemo(() => fibonacciSphere(counts.ha), [counts.ha]);
  const naDirs = useMemo(() => fibonacciSphere(counts.na).map((d) => rotateY(d, 0.9)), [counts.na]);
  const m2Dirs = useMemo(() => fibonacciSphere(counts.m2).map((d) => rotateY(d, 2.1)), [counts.m2]);

  const isActive = (id: PartId) => props.hovered === id || props.selected === id;
  const pointer = {
    over: (id: PartId) => (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      props.onHover(id);
    },
    out: () => props.onHover(null),
    click: (id: PartId) => (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      props.onSelect(id);
    },
  };

  return (
    <>
      <hemisphereLight args={['#ffffff', '#dfe6f2', 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.7} />
      <directionalLight position={[-4, 2, -3]} intensity={0.55} color="#dbe5ff" />
      <ambientLight intensity={0.3} />

      <group ref={virusGroup}>
        <Envelope stateRef={stateRef} active={isActive('envelope')} onOver={pointer.over('envelope')} onOut={pointer.out} onClick={pointer.click('envelope')} />
        <Matrix stateRef={stateRef} active={isActive('m1')} onOver={pointer.over('m1')} onOut={pointer.out} onClick={pointer.click('m1')} />
        <Spikes
          kind="ha"
          dirs={haDirs}
          stateRef={stateRef}
          active={isActive('ha') || contact}
          onOver={pointer.over('ha')}
          onOut={pointer.out}
          onClick={pointer.click('ha')}
        />
        <Spikes kind="na" dirs={naDirs} stateRef={stateRef} active={isActive('na')} onOver={pointer.over('na')} onOut={pointer.out} onClick={pointer.click('na')} />
        <Channels dirs={m2Dirs} stateRef={stateRef} active={isActive('m2')} onOver={pointer.over('m2')} onOut={pointer.out} onClick={pointer.click('m2')} />
        <Rnps stateRef={stateRef} active={isActive('rna')} onOver={pointer.over('rna')} onOut={pointer.out} onClick={pointer.click('rna')} />
        <Antibodies haDirs={haDirs} count={counts.antibodies} stateRef={stateRef} />
        <Labels stateRef={stateRef} haDirs={haDirs} naDirs={naDirs} m2Dirs={m2Dirs} labelsOn={labelsOn} hovered={props.hovered} selected={props.selected} onSelect={props.onSelect} />
      </group>

      <Cell stateRef={stateRef} receptors={counts.receptors} />
      <People stateRef={stateRef} />
      <Droplets stateRef={stateRef} count={counts.droplets} />

      {props.quality === 'high' && <ContactShadows position={[0, -1.95, 0]} opacity={0.22} scale={10} blur={2.6} far={3.2} color={PART_COLORS.ink} />}
    </>
  );
}

// ---------- Canvas ----------
export default function VirusCanvas(props: VirusCanvasProps) {
  return (
    <Canvas
      aria-hidden="true"
      dpr={[1, 1.5]}
      frameloop="demand"
      flat
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 36, near: 0.1, far: 60, position: [0, 0.15, 5.4] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      onPointerMissed={() => props.onHover(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
