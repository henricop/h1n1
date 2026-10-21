# Pesquisa · realismo e fluidez em r3f (three 0.186 / r3f 9.8 / drei 10.7.9, tema claro)

Levantamento de 2026-10-21 (sub-agente de pesquisa; versões conferidas no lockfile). Já instalados (transitivos do
drei): `maath 0.10.8`, `camera-controls 3.1.2`, `three-mesh-bvh 0.8.3`, `three-stdlib`. Não instalados e NÃO
adotados: `@react-three/postprocessing` (sem bloom; N8AO opcional só desktop), `three-custom-shader-material`
(rim via `onBeforeCompile` resolve sem dependência).

## Receita recomendada (impacto ÷ custo)
1. **Fundo opaco na cena**: `gl={{ alpha: false }}` + `<color attach="background" args={['#f5f7fb']} />` (mesmo tom
   do contêiner). Corrige transmissão escura, poupa blending. Custo zero.
2. **Ambiente procedural, 100% offline**: `<Environment frames={1} resolution={256} environmentIntensity={0.9}>`
   com backdrop claro (esfera `BackSide` `#eef1f7`, scale 50) + 4 `<Lightformer>` (key rect 2.2 em [2,4,3];
   fill rect 0.9 em [-4,1,2]; rim ring 1.6 `#dfe8ff` em [0,2,-5]; teto circle 0.6). Conferido no fonte do drei:
   com `children` e sem `files/preset` nada é baixado. Com `flat` (sem tone mapping) manter intensidades ≤ 2.5.
   Luzes diretas: 1 `directionalLight` (key) + `hemisphereLight` fraca.
3. **Materiais**: envelope `meshPhysicalMaterial` com `transmission 0.75, thickness 0.6, ior 1.38,
   attenuationColor #cfdcff, attenuationDistance 1.6, sheen 0.5, clearcoat 0.35, specularIntensity 0.7,
   iridescence 0.12, roughness 0.42, color #e9eef7, side FrontSide`; `gl.transmissionResolutionScale = 0.5`
   (r186) corta 4× o custo. Só objetos OPACOS aparecem através da transmissão → camada M1 opaca. Espinhos em
   `meshPhysicalMaterial` roughness 0.45, clearcoat 0.2, sheen 0.3. Rim fresnel no envelope/célula via
   `onBeforeCompile` (`emissive += rim * pow(1 - dot(N, V), 3) * 0.35`).
4. **Envelope pleomórfico**: deslocamento por ruído UMA vez na CPU (`maath/random` `noise.simplex3`, 1,7×/4×,
   amplitudes 0,06/0,02) em `SphereGeometry(1, 64, 32)` (heightSegments PAR → anel exato no equador);
   `computeVertexNormals` na esfera inteira; depois separar índices por sinal de y em duas geometrias (mesma
   costura, mesmas normais). Usar a MESMA função de raio `r(dir)` para posicionar HA/NA/M2, senão flutuam.
   Anel fino (`Line`/torus) no equador com opacidade = abertura.
5. **Suavização**: `maath/easing` `damp`/`damp3` (SmoothDamp, sem overshoot, `smoothTime` em s) ou equivalente
   próprio (lib/virus/damping.ts). `PerformanceMonitor` (`flipflops={3}` → `quality='low'`), `AdaptiveDpr` +
   `performance.regress()` durante a rolagem; `invalidate(2)` após mudar DPR.
6. **Instancing**: cor por instância (`setColorAt` + `instanceColor.needsUpdate`, material `color="white"`),
   `e.instanceId` no hover; `<Outlines>` do drei funciona em `InstancedMesh`. `<Bvh>` do drei PULA
   InstancedMesh: usar `geom.computeBoundsTree()` + `Mesh.prototype.raycast = acceleratedRaycast` +
   `raycaster.firstHitOnly = true`. LOD por `quality` (HA "low": cilindro 6 seg + esfera 8×6).
7. **Sombras**: manter `ContactShadows` (resolution 256) ou blob estático; `AccumulativeShadows` só para cena
   parada; sem bloom.
8. **Rótulos**: `Html` padrão (não `transform`), sempre montados, opacidade por ref; `occlude={[refs]}` só se
   necessário; linhas-guia com `<Line>` (drei) atualizando `geometry.setPositions`.
9. **Endocitose**: morph target "covinha" na esfera da célula (CPU: `p -= n * prof * w`, `w = smoothstep(cos r,
   1, dot(n, dirVírus))`, lábio no bordo) com `morphTargetInfluences[0] = engulf`; vesícula translúcida (mesmo
   material físico) crescendo ao redor do vírus. Zero shader, normais corretas.
10. **Perfil mobile** (`quality='low'`): LOD baixa, `dpr ≤ 1.25`, `transmissionResolutionScale 0.35` ou
    fallback para `opacity`, sem AO/SoftShadows.

## Armadilhas (Next 15 + r3f 9)
- `transpilePackages: ['three']` recomendado ao importar `three/examples/jsm/*`.
- `reactStrictMode` duplica efeitos em dev (dispose de geometria memoizada é inofensivo; `onReady` 2×).
- Nunca `setState` dentro de `useFrame` sem histerese. `frustumCulled={false}` nos instanced está correto.
- `flat` = `NoToneMapping`: realces não comprimem → intensidades baixas.

## Referências open source
pmndrs/examples (building-live-envmaps, instanced-vertex-colors, html-annotations, mixing-html-and-webgl-w-occlusion,
bvh, soft-shadows, frosted-glass, camera-scroll), three.js examples (webgl_materials_physical_transmission,
webgl_materials_modified, webgl_morphtargets_sphere, webgl_instancing_raycast), pmndrs/drei (Environment,
Lightformer, Outlines, PerformanceMonitor, AdaptiveDpr, Html, Line), pmndrs/maath, gkjohnson/three-mesh-bvh,
molstar/molstar (AO suave + contorno fino em fundo claro), nglviewer/ngl e 3dmol/3Dmol.js (impostores).
