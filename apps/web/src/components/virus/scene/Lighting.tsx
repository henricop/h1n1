'use client';
/**
 * Luz de estúdio 100% offline, guiada pelo tema VIVO (lib/virus/lighting.ts → `lookRef`, prioridade −11):
 *  - ambiente procedural próprio: cena virtual (esfera de fundo + 4 Lightformers) fotografada por uma CubeCamera
 *    e usada como `scene.environment`. A esfera de fundo é derivada do papel do tema; quando o tema muda (papel →
 *    azul profundo → creme), o mapa é refeito SOB DEMANDA (limiar de cor + intervalo mínimo + um último quadro ao
 *    assentar), sem trocar de textura nem recompilar shaders;
 *  - key direcional, hemisférica (céu + rebatimento do fundo) e recorte (direcional por trás), com intensidade e
 *    cor do tema a cada quadro; o número de luzes é fixo (mudar intensidade não troca programa);
 *  - sombra de contato estática (blob) na cor do fundo escurecido; some no escuro.
 * Sem pós-processamento, sem emissive, sem bloom (DESIGN.md).
 */
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Lightformer } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ENV_REBAKE_INTERVAL, rgbDistance, shouldRebakeEnv, type Rgb } from '@/lib/virus/lighting';
import type { Quality } from '@/lib/virus/pose';
import { setSrgb, type LookRef, type StateRef } from './shared';

/** Altura do plano de sombra em relação ao centro do vírion (unidades de cena, quadro micro). */
const SHADOW_Y = -1.95;
/** Resolução das faces do cubo de ambiente. */
const ENV_RESOLUTION = 256;

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

/** Sombra que segue o grupo micro (virusX/virusY) e escala com virusScale; cor/opacidade do tema. */
function Shadow({ stateRef, lookRef, quality }: { stateRef: StateRef; lookRef: LookRef; quality: Quality }) {
  const group = useRef<THREE.Group>(null);
  // blob estático nas duas qualidades: ContactShadows re-renderizaria a cena inteira a cada quadro
  const tex = useMemo(() => blobTexture(), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [tex]);
  useEffect(
    () => () => {
      tex.dispose();
      material.dispose();
    },
    [tex, material],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = stateRef.current;
    const look = lookRef.current;
    g.position.set(s.virusX, s.virusY + SHADOW_Y * s.virusScale, 0);
    g.scale.setScalar(s.virusScale);
    setSrgb(material.color, look.shadowColor);
    material.opacity = look.shadowOpacity * (quality === 'high' ? 1 : 0.9);
    // some quando o vírion está "de longe" (capítulo 4), já engolido ou com o fundo escuro
    g.visible = s.virusScale > 0.5 && s.engulf < 0.5 && material.opacity > 0.004;
  });
  return (
    <group ref={group} visible={false}>
      <mesh rotation-x={-Math.PI / 2} material={material}>
        <circleGeometry args={[1.7, 32]} />
      </mesh>
    </group>
  );
}

/**
 * Ambiente procedural refeito sob demanda (equivale ao `<Environment frames={1}>` do drei, que só fotografa uma
 * vez). A textura (`fbo.texture`) é a mesma do começo ao fim: refazer só incrementa a versão do PMREM.
 */
function StageEnvironment({ lookRef, quality }: { lookRef: LookRef; quality: Quality }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [virtual] = useState(() => new THREE.Scene());
  const fbo = useMemo(() => {
    const f = new THREE.WebGLCubeRenderTarget(ENV_RESOLUTION);
    f.texture.type = THREE.HalfFloatType;
    return f;
  }, []);
  const cube = useMemo(() => new THREE.CubeCamera(0.1, 100, fbo), [fbo]);
  const backdrop = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f9f8f4', side: THREE.BackSide }), []);
  const track = useRef({ time: 0, bakedAt: -Infinity, changedAt: 0, baked: { r: -1, g: -1, b: -1 } as Rgb, last: { r: -1, g: -1, b: -1 } as Rgb });

  const bake = () => {
    const look = lookRef.current;
    setSrgb(backdrop.color, look.backdrop);
    const autoClear = gl.autoClear;
    gl.autoClear = true;
    cube.update(gl, virtual);
    gl.autoClear = autoClear;
    const t = track.current;
    t.baked.r = look.backdrop.r;
    t.baked.g = look.backdrop.g;
    t.baked.b = look.backdrop.b;
    t.bakedAt = t.time;
  };

  // fotografa já na montagem (antes da pré-compilação dos shaders, que precisa do envMap definido)
  useLayoutEffect(() => {
    bake();
    const prevEnv = scene.environment;
    const prevIntensity = scene.environmentIntensity;
    scene.environment = fbo.texture;
    scene.environmentIntensity = lookRef.current.envIntensity;
    return () => {
      scene.environment = prevEnv;
      scene.environmentIntensity = prevIntensity;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, fbo, cube, virtual]);
  useEffect(
    () => () => {
      fbo.dispose();
      backdrop.dispose();
    },
    [fbo, backdrop],
  );

  useFrame((_, delta) => {
    const look = lookRef.current;
    const t = track.current;
    t.time += Number.isFinite(delta) ? Math.min(Math.max(0, delta), 0.1) : 0;
    scene.environmentIntensity = look.envIntensity;
    if (rgbDistance(look.backdrop, t.last) > 1e-4) {
      t.changedAt = t.time;
      t.last.r = look.backdrop.r;
      t.last.g = look.backdrop.g;
      t.last.b = look.backdrop.b;
    }
    const d = rgbDistance(look.backdrop, t.baked);
    if (shouldRebakeEnv(d, t.time - t.bakedAt, t.time - t.changedAt, ENV_REBAKE_INTERVAL[quality])) bake();
    // no modo `demand`, garante os quadros até o último refazimento (tema assentado)
    else if (d > 0.004) invalidate();
  }, -9);

  return createPortal(
    <>
      {/* "céu" do estúdio: derivado do papel do tema (clareado no claro; ardósia escura no fundo profundo) */}
      <mesh scale={50} material={backdrop}>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      {/* key */}
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[2, 4, 3]} scale={[4, 3]} target={[0, 0, 0]} />
      {/* fill */}
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[-4, 1, 2]} scale={[3, 3]} target={[0, 0, 0]} />
      {/* rim (contorno frio, discreto) */}
      <Lightformer form="ring" intensity={1.6} color="#dfe8ff" position={[0, 2, -5]} scale={3} target={[0, 0, 0]} />
      {/* teto */}
      <Lightformer form="circle" intensity={0.6} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={4} />
    </>,
    virtual,
  );
}

/** Luzes diretas com intensidade/cor do tema a cada quadro (contagem fixa: sem trocar de programa). */
function StageLights({ lookRef }: { lookRef: LookRef }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const look = lookRef.current;
    if (key.current) {
      key.current.intensity = look.keyIntensity;
      setSrgb(key.current.color, look.keyColor);
    }
    if (hemi.current) {
      hemi.current.intensity = look.fillIntensity;
      setSrgb(hemi.current.color, look.skyColor);
      setSrgb(hemi.current.groundColor, look.groundColor);
    }
    if (rim.current) {
      rim.current.intensity = look.rimIntensity;
      setSrgb(rim.current.color, look.rimColor);
    }
  }, -9);
  return (
    <>
      <directionalLight ref={key} position={[3, 5, 4]} intensity={1.4} color="#ffffff" />
      <hemisphereLight ref={hemi} args={['#ffffff', '#e8e3d8', 0.35]} />
      {/* recorte: por trás e um pouco acima, desenha a borda da silhueta contra o fundo (forte no tema escuro) */}
      <directionalLight ref={rim} position={[-1.5, 2.5, -5]} intensity={0.35} color="#d6e3ff" />
    </>
  );
}

export function Lighting({ stateRef, lookRef, quality }: { stateRef: StateRef; lookRef: LookRef; quality: Quality }) {
  return (
    <>
      <StageEnvironment lookRef={lookRef} quality={quality} />
      <StageLights lookRef={lookRef} />
      <Shadow stateRef={stateRef} lookRef={lookRef} quality={quality} />
    </>
  );
}
