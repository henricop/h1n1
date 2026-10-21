# Reformulação v4 — "Pequeno demais para ver"

Direção definida em 2026-10-21 a partir de três referências indicadas pelo usuário como o **patamar** de
disrupção e inovação esperado:

| Referência | O que a torna disruptiva (observado ao vivo) | Técnica (observada no código servido) |
|---|---|---|
| [plastic-ocean.com](https://plastic-ocean.com/) | **Um protagonista** (a garrafa) atravessa a página inteira e muda com a rolagem: flutua, afunda, se desfaz, vira peixe, entra no corpo. Tipografia enorme, fundo de tela inteira, números como momentos ("5.25 trn"), tema escuro→claro entre capítulos, zero cromo (só um botão "Menu"). | Lenis 1.0 + GSAP 3.12 ScrollTrigger (pin + scrub), seções `data-scroll-anim="scale-bg | scale-mask | middle-text"`, imagens em sequência por rolagem. |
| [coloniazacamil.com](https://coloniazacamil.com/) | **O mundo é a interface**: um bairro 3D pintado à mão que se explora; modos "present/past", dia/noite, rotas, pontos de interesse; loader com vídeo embutido *dentro* do título ("FLY [vídeo] TO ZACAMIL"); tipografia condensada gigante + serifa + mono. | Nuxt + Three.js (GLTF+Draco+KTX2, shaders próprios `uTransition`, `uNightMode`), Lenis, GSAP. |
| [opportunity.waltonfamilyfoundation.org](https://opportunity.waltonfamilyfoundation.org/) | **Jornalismo de dados editorial**: capítulos numerados "( 01 )", título em serifa condensada com fotos flutuando por cima, rastro de imagens que segue a rolagem, "cinematic-scroll" (700svh de pista com slides e números animados), tema de fundo que muda por seção (branco↔amarelo), rolagem horizontal, rodapé fixo que se revela, textura de papel. | Next.js (Turbopack) + Lenis + Lottie (números) + blocos `data-block="cinematic-scroll | background-theme | section-waypoint | horizontal-content-scroll"`. |

**Diagnóstico do site atual (v3):** o conteúdo 3D já é forte, mas a *moldura* é de landing page comum:
barra de navegação, contêiner `max-w-6xl`, cartão arredondado com o palco à esquerda e coluna de texto à
direita, fatos com citação longa inline. É isso que fica abaixo do patamar. A reformulação troca a moldura,
não a integridade: fatos com fonte, "base de", universo, sem "tempo real", sem conexão externa.

## 1. Conceito

**O vírus é o protagonista. A página é um filme.** Uma única viagem contínua de câmera, de 100 nanômetros até o
mapa do Brasil, em que cada capítulo termina onde o seguinte começa (já parcialmente garantido pelo contrato
v2: `sceneAt(i + 1) === POSES[i]`).

Título do filme: **"Pequeno demais para ver. Grande demais para ignorar."**

### Atos

| # | Ato | O que o leitor vê | Tema |
|---|---|---|---|
| 0 | **Abertura** | Papel claro com grão. "H1N1" em condensada gigante; subtítulo em serifa itálica; o vírion 3D flutua *por cima e por trás* das letras (como as fotos sobre o título da Walton e a garrafa do Plastic Ocean). Etiqueta mono `[ explicador visual · fontes em cada afirmação ]`. Indicação "role para começar". | `paper` |
| 1 | **100 nanômetros** (O que é) | Palco em tela inteira. Texto flutua à esquerda em blocos curtos (passos). Momento de número gigante: "100 nm" (fato `dou-2018-virus-100-nm`). | `paper` |
| 2 | **Por dentro** | Desmontagem escalonada; rótulos; modo "explorar" (hover/toque nas peças, painel lateral). | `paper` |
| 3 | **Como entra** | Mergulho: o fundo escurece para azul profundo enquanto a célula engole o vírus (endossomo ácido). Único trecho escuro do site: cinematográfico, sem HUD, sem neon. Volta à luz quando as RNPs saem. | `deep` |
| 4 | **Como se espalha** | Zoom-out contínuo para as duas silhuetas e as gotículas. Número gigante a partir de fato (`transmissibilidade-adultos-24h-antes-pico-24-72h`). | `paper` |
| 5 | **Vacina** | Anticorpos; tema esquenta (tint quente) como "esperança". Número/fato da vacinação anual. | `warm` |
| 6 | **O Brasil, em números** | O palco 3D some em fade e entra o mapa do Brasil por UF (SVG) + último valor oficial em número gigante com contagem (período, provisório, universo, fonte, **base de DD/MM/AAAA**) + tendência de 52 semanas. É o observatório entrando no filme. | `paper` |
| 7 | **Continuar** | Índice editorial em tipografia gigante: Entenda · Sintomas e cuidados · Vacina e prevenção · Dados do Brasil · Sala de dados · Fontes. Aviso clínico. Rodapé fixo que se revela por baixo (Walton). | `paper` |

### Cromo (shell) em todas as páginas

- **Sem barra de navegação.** Marca "H1N1" pequena no canto superior esquerdo (condensada) + pílula **Menu** no
  canto superior direito que abre um overlay de tela inteira com os destinos em tipografia gigante e, embaixo,
  os institucionais em mono. Fecha com Esc, foco preso no overlay, `aria-modal`.
- **Trilho de capítulos** à esquerda (desktop) / barra fina no topo (mobile): "( 01 )…( 07 )", capítulo atual
  em destaque, clique leva ao capítulo. Só na home.
- **Rolagem suave** (Lenis) + **tema por seção** (`data-theme="paper | deep | warm"`: as variáveis de cor do
  `<html>` interpolam entre temas conforme a seção entra; o canvas 3D recebe a mesma cor de fundo).
- **Grão de papel** (SVG `feTurbulence` inline, `mix-blend-mode: multiply`, opacidade baixa; desligado em
  `deep`). Nada de grade, scanlines, brilho.
- **Rodapé fixo que se revela** (`position: sticky; bottom: 0` sob o conteúdo).
- Texto alternativo e versão em texto do explicador continuam existindo (acessibilidade e sem WebGL).

## 2. Sistema de design v3 (ver `apps/web/DESIGN.md`)

Tipografia (todas auto-hospedadas por `next/font/google`, servidas do próprio site):
- **Display serifa:** Instrument Serif (regular + *itálico*) — títulos grandes, pull-quotes, números gigantes.
- **Condensada:** Big Shoulders (variável) — "H1N1", numerais de capítulo, palavras-chave em caixa alta
  (único uso de caixa alta permitido).
- **Corpo/UI:** Inter (mantida) — 18–19 px, `line-height` 1.6.
- **Mono:** JetBrains Mono (mantida) — etiquetas `[ 02 ]`, "base de", valores tabulares.

Cores: papel quente `#f4f1ea` + tinta `#14130f`; cobalto `#2451d6` segue como ação e dado principal; rosa
`#d6007f` segue sendo A(H1N1)pdm09; paleta de dados inalterada. Temas: `paper` (padrão), `deep` (`#0b1a2e`
com tinta `#f4f1ea`), `warm` (`#f7e8d5`). Contraste AA verificado por tema.

## 3. Pilha técnica e repositórios (código aberto, exceto GSAP: gratuito)

| Necessidade | Escolha | Repositório / licença |
|---|---|---|
| Rolagem suave (sensação das três referências) | `lenis` 1.3 | https://github.com/darkroomengineering/lenis — MIT |
| Coreografia DOM por rolagem (pin, scrub, split de texto, contadores) | `gsap` 3.13+ com `ScrollTrigger` e `SplitText` | https://github.com/greensock/GSAP — licença "no charge" (gratuita, **não** open source; todos os plugins liberados desde a 3.13) |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei` (já no projeto) | https://github.com/pmndrs/react-three-fiber · https://github.com/pmndrs/drei — MIT |
| Progresso contínuo do explicador por passos de texto | mantido: `useScroll` (motion) → `MotionValue` → `sceneAt(p)` | https://github.com/motiondivision/motion — MIT |
| Fontes | Instrument Serif, Big Shoulders, Inter, JetBrains Mono | https://github.com/Instrument/instrument-serif · https://github.com/xotypeco/big_shoulders · https://github.com/rsms/inter · https://github.com/JetBrains/JetBrainsMono — OFL |
| Grão de papel | SVG `feTurbulence` inline | sem dependência |
| Números animados | `gsap.to` sobre um objeto numérico (sem Lottie: o número vem da API/fatos, não de um arquivo) | — |

Decisão: a decisão 1 do contrato v2 ("sem Lenis/GSAP") é **revogada** para o DOM. O driver do 3D continua
sendo o progresso por passos (`progressFromSteps`) lido da rolagem nativa; Lenis rola a janela nativa, portanto
`scrollY` e `useScroll` seguem válidos. GSAP ScrollTrigger é sincronizado com Lenis
(`lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker`). `prefers-reduced-motion`: Lenis desligado,
ScrollTrigger sem scrub (estados finais), 3D por botões.

Restrições que continuam valendo (testes já existentes bloqueiam regressões):
- Nenhuma conexão externa em runtime (CSP `connect-src 'self' <API>`, `frame-src 'none'`, sem `src` externo).
- Todo número epidemiológico só via `<Fato>`/API com fonte, período, universo e "base de". Sem "tempo real".
- Páginas clínicas `noindex` até revisão humana; aviso clínico presente.
- Sem terminal, sem assistente de IA, sem paleta ⌘K.

## 4. Frentes e propriedade de arquivos (execução em paralelo)

| Frente | Entrega | Arquivos de propriedade exclusiva |
|---|---|---|
| **Núcleo** (feito primeiro, por mim) | tokens v3, temas, tipografia, fontes no layout | `src/app/globals.css`, `src/app/layout.tsx` (fontes), `DESIGN.md`, este documento |
| **A · Shell e sistema de movimento** | `SmoothScroll` (Lenis + ScrollTrigger sync, respeita reduced-motion), `Menu` overlay, `Brand`, `ThemeSections` (interpola variáveis por `data-theme`), `Grain`, `Footer` com revelação, remoção do `Header`, `ProgressRail` (API: lista de capítulos + progresso) | `src/components/shell/**`, `src/components/Footer.tsx`, `src/components/Header.tsx` (remover; mover `PRIMARY_NAV`/`resolvePrimaryNav` para `src/lib/nav.ts`), `src/app/layout.tsx` (exceto fontes), `src/lib/motion/**`, `test/shell.test.ts` |
| **B · Home: o filme** | Abertura, capítulos sobre o palco em tela inteira, números gigantes, ato Brasil (mapa + último valor + tendência), índice final; `VirusExplainer` reestruturado (palco `fixed` em tela inteira, texto por cima, mobile com texto na metade inferior sobre papel translúcido) | `src/app/page.tsx`, `src/components/home/**`, `src/components/virus/VirusExplainer.tsx`, `VirusPartPanel.tsx`, `VirusPoster.tsx`, `BrasilNow.tsx`, `FatoCtx.tsx`, `test/virus-components.test.tsx`, `test/home.test.tsx` |
| **C · Palco 3D** | `background` (cor de fundo lerpada por tema, canvas segue opaco), `lookOffsetY` (enquadrar o vírion na metade superior no mobile), pose de abertura (deriva lenta por cima do título), luz/materiais legíveis no tema `deep`, continuidade | `src/components/virus/VirusCanvas.tsx`, `src/components/virus/scene/**`, `src/lib/virus/**`, `test/virus*.test.ts` (exceto `virus-components`) |
| **D · Páginas editoriais** | Template de revista: `[ 01 ]` mono, título Instrument Serif, resposta como pull-quote, corpo 19 px/64ch, fontes como notas, sumário lateral fixo no desktop, "Leia também" em tipografia grande; 404/erro | `src/components/MdxArticle.tsx`, `src/components/mdx/**`, `Breadcrumb.tsx`, `Notices.tsx`, `SourceCard.tsx`, `src/app/[...slug]/**`, `src/app/dados/fontes/**`, `src/app/dados/metodologia/**`, `not-found.tsx`, `error.tsx`, `global-error.tsx`, `test/components.test.tsx` |
| **E · Páginas de dados** | `/dados/brasil`, `/dados/mundo`, `/sala` no sistema v3: títulos serifados, número gigante com contagem, painéis sobre papel, sem nada que lembre HUD (renomear `HudTopbar/HudFooter`), gráficos com o tema de cores | `src/app/dados/brasil/**`, `src/app/dados/mundo/**`, `src/app/sala/**`, `src/components/sala/**`, `src/components/charts/**`, `src/components/IndicatorCard.tsx`, `src/lib/echarts-theme.ts`, `test/sala.test.ts` |

Contratos entre frentes:
- **Tokens e utilitários CSS** (núcleo): classes `font-display` (Instrument Serif), `font-condensed`
  (Big Shoulders), `font-sans`, `font-mono`; cores `bg-paper`, `text-ink`, `text-muted`, `text-faint`,
  `bg-card`, `border-line`, `primary-*`, `h1n1`, etc.; temas via `[data-theme]`; utilitários `.display-xl`,
  `.display-lg`, `.kicker-mono`, `.bignum`, `.eyebrow`, `.btn`, `.pill`, `.card`, `.paper-grain`.
- **A → B:** `ProgressRail({ acts })` (esqueleto já em `src/components/shell/ProgressRail.tsx`) observa as
  seções `[data-act]` por IntersectionObserver; a home só marca `<section id="ato-01" data-act="01">` e blocos
  com `data-theme`. A cor viva do tema vem de `src/lib/motion/theme.ts` (`getLiveTheme()` / `subscribeTheme`).
- **B ↔ C:** `VirusCanvas` ganha `themeColor?: ThemeRGB` (objeto **mutável** `{ r, g, b }` em 0–255 sRGB, lido
  por quadro em `useFrame`; nunca uma string reativa por prop) e `viewShift?: { x: number; y: number }`
  (fração da viewport aplicada com `camera.setViewOffset`; mobile `y = 0.25` põe o vírion no quarto superior,
  desktop `x` pequeno e positivo tira o vírion de baixo do texto). Ver §7.
- **A → D/E:** nenhuma página renderiza barra de navegação própria; o shell cuida de marca, menu e rodapé.

## 5. Critérios de aceite

1. Home em desktop: nenhum cartão arredondado em volta do palco; o vírion ocupa a tela inteira e o texto
   flutua por cima; o fundo muda de tema no capítulo 3 e no 5; números gigantes com fonte e "base de".
2. Mobile (390 px): o vírion fica visível na metade superior durante toda a narrativa; blocos de texto legíveis
   sobre papel translúcido; menu, trilho e rodapé funcionam por toque.
3. `prefers-reduced-motion`: sem rolagem suave, sem scrub, cena por botões; tudo legível.
4. Teclado: Menu abre/fecha com Enter/Esc; trilho navegável; foco visível.
5. Sem WebGL: pôster + versão em texto; nada quebra.
6. `pnpm -F @h1n1/web typecheck` e `pnpm -F @h1n1/web test` verdes; testes de "sem conexão externa" intactos.
7. Nenhum número solto fora de `<Fato>`/API; aviso clínico presente; sem "tempo real".

## 6. Ajustes após validação (2026-10-21) — OBRIGATÓRIOS para todas as frentes

Dois validadores (design/acessibilidade/integridade e pilha técnica) revisaram este contrato. O que segue
prevalece sobre as seções anteriores em caso de conflito.

### Copy e narrativa
- Título: **"Pequeno demais para ver. Dá para entender."** (não "grande demais para ignorar": alarmista).
- Kickers **sem número**: `( 01 ) O que é`, `( 02 ) Por dentro`, `( 03 ) Como entra`, `( 04 ) Como se espalha`,
  `( 05 ) A vacina`, `( 06 ) No Brasil`, `( 07 ) Continue daqui`. A abertura não tem numeral. Títulos de ato:
  "Um vírus da gripe, de perto." · "Peça por peça." · "Uma chave, uma fechadura." · "De uma pessoa para
  outra." · "Anticorpos prontos antes do encontro." · "O que os registros oficiais mostram." · "E agora?".
- Abertura: etiqueta mono `[ explicação visual · cada afirmação com fonte ]`; subtítulo "Um dos vírus da gripe,
  visto de perto: o que ele é, como entra numa célula, como passa de uma pessoa para outra e como a vacina
  ajuda."; ação "Começar"; links "Pular a animação e ler em texto" e "Estou com sintomas: ver sinais de
  alerta" (este só se a página for elegível); indicação "Role ou deslize para começar".
- Números gigantes: ato 1 "cerca de 100 nm" (fato `dou-2018-virus-100-nm`, legenda sobre formas alongadas);
  ato 4 "24 h" (fato `transmissibilidade-adultos-24h-antes-pico-24-72h`, mantendo "adultos saudáveis" e "em
  quantidades mais baixas"); ato 5 **sem número**: palavra gigante "Todo ano." + fato
  `ms-vacinacao-anual-mudanca-virus`. Vacina sempre atribuída ("segundo o Ministério da Saúde"), nunca
  proteção absoluta.
- Rótulo permanente "ilustração fora de escala" (mono ≥ 14 px) em todo ato com 3D.
- Aviso clínico fixo e idêntico: "Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista
  oficial em /sintomas/sinais-de-alerta/." **Remover** a lista "falta de ar, febre persistente…" da home.
- Trocar "não é um painel em tempo real" por "Os números são os últimos publicados pelas fontes oficiais e
  podem ter atraso; cada um traz a data da base."
- Índice final ordenado por necessidade: Sinais de alerta · Sintomas e cuidados · Vacina e prevenção · Como se
  transmite · Dados do Brasil · Sala de dados · Fontes e metodologia (itens somem se a página não for elegível).
- `allFreeText()` passa a incluir kickers, títulos de ato, abertura e índice; o teste de "sem número solto"
  reconhece `nan[oô]metros?` e `micr[oô]metros?`.

### Tema `deep` (ato 3)
- O **mundo** escurece; a **interface não**: pílulas, marca, trilho e cartões de rótulo ficam em papel claro
  opaco em qualquer tema (já no CSS: `.pill` fixa). Em `deep` o texto fica direto sobre o campo, sem véu.
- Tema por **passo**, não por ato: entra quando a vesícula fecha (ato 3, passo 3) e sai quando a câmera
  recua (ato 4, passo 2). No máximo 3 passos de texto no escuro.
- A transição é função do progresso de rolagem, acontece num trecho **sem texto visível** e a tinta troca de
  uma vez quando a luminância do fundo cruza ≈ 0,18 (interpolar fundo em OKLab; nunca interpolar tinta e fundo
  ao mesmo tempo: a 50% o contraste cai a 1:1).
- Sem glow/emissive: "acende" = realce fosco; "pisca" ≤ 1 Hz.
- `color-scheme: dark` só em `deep` (já no CSS); `theme-color` dinâmico (#f4f1ea / #0b1a2e / #f7e8d5).
- Sem JS: tudo em `paper` (degradação aceitável). Reduced-motion: troca instantânea via `data-theme-current`.

### Texto sobre o palco
- Palco **`sticky; top: 0; height: 100svh` dentro do contêiner do filme** (não `fixed` no body): simplifica o
  fade do ato 6, o rodapé revelado e a impressão.
- Desktop: composição deslocada (frente C expõe `lookOffsetX` além de `lookOffsetY`) para o texto **não
  cruzar o vírion**; véu alfa ≥ .92 (já no CSS) e, dentro do véu, só `ink`/`muted` (nunca `faint` nem link sem
  fundo próprio).
- Mobile (360×640 e 390×844): palco sticky de ~46 svh no topo + texto em fluxo normal abaixo sobre **painel
  opaco** de papel com máscara em gradiente no topo; nada de blur/blend sobre o canvas no toque.
- Canvas com `touch-action: pan-y`; `pointer-events: none` fora do modo "explorar" (ato 2).

### Shell
- Pílula com o texto **"Menu"** (nunca só ícone), ≥ 48 px, `aria-expanded`/`aria-controls`/`aria-haspopup="dialog"`.
  Overlay como `<dialog>` + `showModal()`; primeiro item **"Sinais de alerta"**; botão "Fechar" em texto na
  posição da pílula; foco volta à pílula; `lenis.stop()` enquanto aberto; institucionais listados no menu.
- Marca com descritor "informação clara, dados oficiais" visível a partir de `md`.
- Páginas internas: **breadcrumb visível** acima do H1 (≥ 15 px) e 2–3 links textuais ao lado do Menu a
  partir de `lg` (Sinais de alerta · Vacina · Dados), sem fundo de barra. A home continua sem barra.
- Trilho: `<nav aria-label="Atos">` com links reais `#ato-N`, `aria-current="location"`, sem live region;
  "( 01 )" `aria-hidden` com nome acessível "Ato 1 de 7: O que é". No mobile vira barra fina + botão único
  "( 03 ) Como entra ▾" que abre a lista.
- Rodapé revelado só quando o rodapé tem < 70 svh; senão fluxo normal. Reduced-motion → fluxo normal.
- Controle **"Versão simples (sem animação)"** persistido (localStorage) no Menu: desliga Lenis, scrub,
  contagem, deriva, 3D (pôster por ato) e grão.
- Lenis só com `(hover: hover) and (pointer: fine)`; no toque, rolagem nativa; `lerp` ≤ 0,1 / duração ≤ 0,8 s.

### Semântica e leitor de tela
- DOM texto-primeiro: `<h1>` na abertura, `<section aria-labelledby>` com `<h2>` por ato; canvas `aria-hidden`
  como irmão. **Sem** `aria-live` por rolagem; **sem** `aria-current="step"` no `<article>`.
- Deriva da abertura (movimento automático > 5 s, WCAG 2.2.2): atrelada à rolagem ou parada após 5 s, com
  botão "Pausar animação"; ociosa → `frameloop` sob demanda.
- Citações em inglês dos fatos com `lang="en"`; link "fonte" com `aria-label` único por fato; HA/NA
  descritas também pela forma (cabeça arredondada / cabeça quadrada), não só pela cor.
- Tooltip do glossário fecha com Esc.

### Integridade (ato 6)
- Componente **`<NumeroGigante>`** estruturado: no mesmo bloco e desde o primeiro quadro: indicador com
  definição ("SRAG com A(H1N1)pdm09 confirmada", nunca "casos de H1N1"), valor + unidade, período (SE com
  `<Glossario>`), provisório/consolidado **em texto**, universo (`universe_note`), fonte (nome e órgão, link
  para `/dados/fontes/`), "base de DD/MM/AAAA" + `FreshnessNote`, geografia, link para série e metodologia.
- Número final no HTML desde o SSR; contagem só visual sobre clone `aria-hidden`, uma vez, ≤ 700 ms, só em
  inteiros, formatada por `formatNumberBR`; sem contagem em reduced-motion, "Versão simples", `suppressed`
  ("<5" estático) e `DataUnavailable`.
- Um único número gigante (SIVEP). FluNet como cartão comum com a frase "Os dois números medem coisas
  diferentes e não se somem". Variação ▲/▼ escondida quando valor ou base são pequenos/suprimidos.
- Mapa por UF: `<5` **hachurado** + legenda "<5, ocultado por privacidade"; "sem dado" distinto; tabela
  equivalente ("Ver como tabela") e `<select>` de UF; sem ranking; sem geolocalização; cauda provisória
  tracejada na tendência com legenda; legenda do intervalo gerada dos dados.

### Tokens já corrigidos no CSS
`faint #625e55`, `line-strong #8a8475`, véu `.92`, pílula opaca clara, grão abaixo do texto (dentro do palco),
escalas em `rem + vw`, piso de 14 px para texto (nada de `text-xs`/`text-[10px]`), Instrument Serif ≥ 28 px
romano / ≥ 24 px itálico, `scroll-padding-top`, `color-scheme: dark` só em `deep`. Texto na cor H1N1 usa
`h1n1-700`; `h1n1` só em preenchimento e texto ≥ 24 px.

### Performance
Tiers por `deviceMemory`/`hardwareConcurrency`/`saveData` + teste de fps no 1.º segundo (mediana > 33 ms →
DPR 1 e menos instâncias; ainda ruim → pôster). Pôster por ato (5 WebP). ECharts e `react-globe.gl` fora da
home. Fontes: Instrument Serif 400 + itálico (`preload: false` no itálico), Big Shoulders só 700/800, Inter
variável, JetBrains Mono 400/500.

## 7. Decisões técnicas após validação (verificadas no código dos pacotes instalados)

### Lenis + GSAP (frente A, `src/components/shell/SmoothScroll.tsx` + `src/lib/motion/lenis.ts`)
- Lenis rola a **janela nativa** (`window.scrollTo` instantâneo por quadro): `window.scrollY`, `useScroll` do
  motion e `progressFromSteps` continuam válidos. **Não** usar `lenis/react` (`autoRaf` briga com o ticker do
  GSAP). Provider próprio, `'use client'`, renderiza `null`, instancia no `useEffect`, colocado **antes** de
  `{children}` no layout.
- Instanciar **só** com `(prefers-reduced-motion: no-preference)` **e** `(hover: hover) and (pointer: fine)`;
  escutar `change` das duas media queries e criar/destruir ao vivo. O `respectReducedMotion` padrão do Lenis
  mantém o `preventDefault` da roda: por isso não instanciar, em vez de confiar nele.
- Sincronização: `gsap.registerPlugin(ScrollTrigger)`; `lenis = new Lenis({ autoRaf: false, anchors: false })`;
  `lenis.on('scroll', ScrollTrigger.update)`; `gsap.ticker.add((t) => lenis.raf(t * 1000))`;
  `gsap.ticker.lagSmoothing(0)`; no cleanup `gsap.ticker.remove`, `lenis.destroy()`, `lagSmoothing(500, 33)`.
- Helper `scrollToEl(el, { reduced })`: `getLenis()?.scrollTo(el, { duration: 1.1, force: true })` (honra
  `scroll-margin-top`) com fallback `el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })`.
  `lenis.scrollTo` é no-op com o Lenis parado sem `force: true`.
- `ScrollTrigger.refresh()` em `document.fonts.ready` e na troca de rota (`usePathname`), junto com
  `lenis?.resize()`.

### Tema (frente A, `src/lib/motion/theme.ts`; esqueleto já em disco)
- `THEMES` com as variáveis que diferem por tema (copiadas do CSS; `test/shell.test.ts` lê `globals.css` e
  compara). `live: { r, g, b }` do fundo atual, `getLiveTheme()`, `subscribeTheme(cb)`, `setTheme(name)`.
- Detecção: `IntersectionObserver` em `[data-theme]` com `rootMargin: '-50% 0px -50% 0px'` (linha de
  referência = meio da janela, igual a `referenceLine()` no desktop).
- Interpolação: `gsap.killTweensOf(obj)` + `gsap.to(obj, { t: 1, duration: 0.7 })`, `gsap.utils.interpolate`
  (sRGB; nunca `THREE.Color.lerp`, que interpola em linear) e `setProperty` só nas variáveis que diferem,
  como inline style no `<html>` (vence `@layer theme` e `html[data-theme-current]`). A tinta troca de uma
  vez quando a luminância relativa do fundo cruza 0,18 (não interpolar tinta e fundo juntos). Sem `setState`.
- Reduced-motion: `removeProperty` de tudo e só trocar `data-theme-current` (valores estáticos do CSS).
  Atualizar `<meta name="theme-color">`. `suppressHydrationWarning` no `<html>`; nunca `style` no `<html>` via JSX.
- **Removida** a `transition` de `background-color/color` do `body` (brigava com a interpolação por quadro).

### Palco 3D (frentes B e C)
- Fundo **opaco** (`alpha: false`); `scene.background` é um `THREE.Color` mutado imperativamente num `useFrame`
  de prioridade `-11`: `bg.setRGB(r/255, g/255, b/255, THREE.SRGBColorSpace)` a partir de `themeColor`
  (objeto mutável). Trocar a cor não recompila shaders; a transmissão redesenha o fundo a cada quadro.
  **Nunca** `<color attach="background" args={[hex]}>` com hex mudando (reconstrói a instância por quadro).
  `onCreated` usa a cor viva, não constante. Substituir `CANVAS_BACKGROUND` (`#f5f7fb`), `LINE_STRONG`
  (`#c7d0de`, `Labels.tsx`) e o backdrop `#eef1f7` (`Lighting.tsx`) por valores derivados do tema papel.
- `<Canvas resize={{ scroll: false, debounce: 200 }} eventSource={ref do contêiner do filme} eventPrefix="client">`
  (sem `eventSource`, o DOM por cima impede o hover nas peças; com ele o r3f põe `pointer-events: none` no
  wrapper). `touch-action: pan-y` no canvas.
- Enquadramento: `camera.setViewOffset(w, h, round(-shift.x·w), round(shift.y·h), w, h)` depois do
  `lookAt`, com `shift` = `viewShift` (fração da viewport; validado numericamente: `y = 0.25` põe o vírion a
  25 % do topo em qualquer capítulo). Projeção, `unproject` e picking continuam coerentes.
- Palco **sticky** (`position: sticky; top: 0; height: 100svh`) dentro do contêiner do filme (atos 0–5);
  o elemento do canvas com `height: 100lvh` para não redimensionar quando a barra do Safari recolhe. Quando o
  palco estiver totalmente coberto (atos 6–7, que têm fundo opaco `bg-bg`), `visibility: hidden` + frameloop
  `never`. `clampToStage` dos rótulos restrito à região livre de texto.
- Pôster: `public/virus/poster.svg` tem fundo azulado embutido (é também o `og:image`); gerar versão com
  fundo transparente para a tela.

### SplitText (frentes A, B, D)
- `import { SplitText } from 'gsap/SplitText'` + `gsap.registerPlugin(SplitText)` **antes** de usar. Criar
  dentro de `gsap.context(...)` e `ctx.revert()` no cleanup (cobre o StrictMode). Com `type` contendo
  `lines`, `autoSplit: true` e o `onSplit` **retornando** a animação (re-divide em `fonts loadingdone` e em
  mudança de largura). Só em títulos; nunca em texto que o React re-renderiza; texto fica no HTML do servidor.
  Fontes com `preload: false` (Big Shoulders, JetBrains Mono) exigem `fonts.ready`/`autoSplit`.
  Acima da dobra, preferir keyframes CSS (sem FOUC).

### Rodapé revelado (frente A)
- `position: sticky; bottom: 0; z-index: -1` como **irmão posterior** ao `main`; tudo que o cobre é opaco
  (`main` ou div interna com `bg-bg`; na home, o palco e os atos 6–7). Nenhum `overflow` em ancestral entre o
  sticky e o scroller. `@media (max-width: 767px), (max-height: 640px) { position: static; z-index: auto }`.

### Menu overlay (frente A)
- `<dialog>` irmão do contêiner da página (`#page-root`), que recebe `inert={true}` (React 19: booleano;
  `inert=""` vale **falso**). Ao fechar: remover `inert` **antes** de focar a pílula. Wrap manual de Tab/Shift+Tab,
  Esc fecha, `role="dialog" aria-modal="true"`. `getLenis()?.stop()` ao abrir / `start()` ao fechar; sem Lenis,
  `html.style.overflow = 'hidden'`. Painel rolável com `data-lenis-prevent` + `overscroll-behavior: contain`.
  Fechar na troca de `pathname`.

### CSP e testes
- `next/font` serve de `/_next/static/media/*` (cabe em `font-src 'self'`); gsap/lenis não fazem rede.
  `next/font/google` precisa de rede **no build** (não em runtime). Em vitest (`environment: 'node'`),
  `new Lenis` quebra: o teste do shell cobre só funções puras (`theme.ts`, helpers).
