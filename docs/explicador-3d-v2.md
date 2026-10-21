# Explicador 3D v2 — "mais realista, mais fluido, mais coerente"

Direção consolidada em 2026-10-21 a partir de quatro relatórios de sub-agentes (biologia estrutural, render r3f,
coreografia de scrollytelling, validador de arquitetura). Este documento é o contrato entre as frentes de
implementação. Fatos biológicos exibidos só via `content/facts.json` (regras do plano, §10.4).

## Decisões de arquitetura (validador + coreografia concordam)
1. **Manter** rolagem nativa → `useScroll` (framer-motion) → `MotionValue` → função pura → quadro. Sem Lenis,
   GSAP, ScrollControls ou Theatre.
2. **Suavizar um único escalar** `pAnim` (progresso animado) com amortecimento crítico e **limite de velocidade**
   (≈ 2 capítulos/s), e avaliar `sceneAt(pAnim)` a cada quadro. Todo escalonamento vive na timeline
   (`lib/virus/choreography.ts`), testável sem WebGL. Amortecimento por canal só para hover/opacidade de rótulo.
3. **Um driver** `useFrame` com prioridade `-10` escreve em `stateRef`; `Labels` em `-1`; o resto em `0` só lê.
   Ninguém chama `setState` dentro de `useFrame` sem histerese; rótulos sempre montados, opacidade por ref.
4. **`frameloop`**: `always` enquanto a seção está visível (IntersectionObserver permanente + `visibilitychange`),
   `never` fora da tela; `demand` em `prefers-reduced-motion`. Em `quality: 'low'`, limitar a ~30 fps.
5. **Sem pós-processamento** (bloom contradiz DESIGN.md). Realismo vem de: ambiente procedural (`Environment` +
   `Lightformer`, 100% offline, gerado uma vez), materiais físicos (clearcoat/sheen/transmissão fina), sombra
   estática barata, geometria mais fiel (ver `docs/pesquisa/`).
6. **Pose** (rolagem) separada de **ambiente** (tempo): `ambient(t)` → `{ yaw, breath, wobble }`.
7. Pré-compilar shaders (`gl.compileAsync`) antes de `onReady`; resetar caches `applied` quando `dirs`/`count` mudam.
8. Progresso por **passos de texto** (`[data-step]`), não por capítulo inteiro: `progress = i + (k + frac)/n_i`.
   Linha de referência: desktop = meio da janela; mobile = meio da faixa visível abaixo do palco.

## Estado da cena (`lib/virus/scenestate.ts`)
Chaves numéricas; canais unitários em [0, 1]. Transições contínuas por construção: `POSES[i]` é a pose
assentada do capítulo i e `sceneAt(i + 1) === POSES[i]`.

| grupo | chaves |
|---|---|
| câmera | `camX camY camZ lookX lookY lookZ` |
| vírion | `virusX virusY virusScale spin` |
| desmontagem escalonada | `openEnv openSpikes openM1 openRnp labels hlHa hlNa` |
| célula | `membrane dock engulf uncoat release bud` |
| pessoas | `people droplets` |
| vacina | `antibodies block drift rebind` |

## Beat sheet (passos por capítulo: 3 · 5 · 5 · 4 · 5)
Cada passo = um bloco curto de texto; a batida acontece nos primeiros ~40% do passo e assenta no resto.

**Cap. 1 · O que é** — vírion inteiro. (1) aproxima, girando; (2) "hemaglutinina" → HA pulsa azul; (3)
"neuraminidase" → NA pulsa rosa; assenta girando devagar.

**Cap. 2 · Por dentro** — (1) envelope abre em duas metades; (2) HA sobe e NA desce com atraso; (3) M1 descola e
M2 destacam; (4) 8 RNPs abrem em leque (uma a uma) e rótulos surgem em fade; (5) assentado: hover/clique.

**Cap. 3 · Como entra** — (1) remonta em ordem inversa enquanto uma parede curva de membrana entra pela direita
com receptores; (2) vírus desliza e encosta, spin → 0, HAs em contato brilham (dock); (3) a membrana envolve o
vírus numa vesícula (engulf); (4) acidificação: M2 piscam, envelope/M1 esmaecem (uncoat); (5) RNPs saem em fila
rumo ao núcleo sugerido (release).

**Cap. 4 · Como se espalha** — (1) brotamento: novos vírions inflam na membrana e a NA os solta (bud); (2) zoom-out
contínuo: o grupo micro encolhe até a boca da silhueta 1, membrana esmaece, pessoas ganham opacidade (people);
(3) gotículas e aerossóis viajam; o vírus pega carona numa gotícula até a boca da silhueta 2 (droplets +
virusX/virusY em arco); (4) assentado.

**Cap. 5 · Vacina** — (1) zoom-in contínuo na gotícula da silhueta 2, que vira o vírion (sem mudar de lugar na
tela); (2) anticorpos em Y grudam nas cabeças da HA (antibodies); (3) uma membrana surge à direita, o vírus
tenta encostar e não encaixa (block); (4) deriva antigênica: cabeças da HA mudam de tom e parte dos anticorpos
solta (drift); (5) novos anticorpos (outro tom) regrudam (rebind); assentado.

## Divisão de trabalho
- **Núcleo (feito primeiro)**: `scenestate.ts`, `choreography.ts`, `damping.ts`, `chapters.ts`, `scene/shared.ts`.
- **A · Vírion**: `scene/Virion.tsx`, `scene/geometries.ts`, `lib/virus/pose.ts` (geometria fiel, materiais,
  explode escalonado, uncoat, drift).
- **B · Célula**: `scene/Cell.tsx` (parede de membrana, receptores, vesícula, núcleo sugerido, brotamento).
- **C · Contágio e vacina**: `scene/Spread.tsx`, `scene/Antibodies.tsx`.
- **D · Driver, luz, rótulos, explainer**: `VirusCanvas.tsx`, `scene/Driver.tsx`, `scene/Lighting.tsx`,
  `scene/Labels.tsx`, `VirusExplainer.tsx`.
- **E · Texto, fatos e testes**: `lib/virus/copy.ts`, `parts.ts`, `content/facts.json`, `test/virus.test.ts`.
