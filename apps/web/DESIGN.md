# H1N1 · Sala de Situação — direção de design

**Conceito:** um centro de comando epidemiológico público. Escuro, denso em dados, tipografia monoespaçada para leituras e display geométrica para títulos. Tudo que pulsa, anima ou brilha representa um dado real com data e fonte. Nada de "tempo real": o HUD mostra sempre `base de DD/MM/AAAA`.

## Tokens (apps/web/src/app/globals.css, Tailwind 4 `@theme`)
- Fundos: `bg-bg-950` (página), `bg-bg-900` (painel), `bg-bg-800` (elevado), `bg-bg-700` (hover). Bordas: `border-line`, `border-line-strong`.
- Texto: `text-ink` (principal), `text-muted` (secundário), `text-faint` (eixos/legendas).
- Cores de dado: `signal` (ciano, dado/foco/links), `h1n1` (magenta, A(H1N1)pdm09), `h3` (violeta, A(H3)), `infb` (verde-água, influenza B), `srag` (âmbar, SRAG total e semanas provisórias), `urgent-700` (só emergência), `ok-700`.
- Fontes: `font-display` (títulos), `font-mono` (valores, rótulos HUD, terminal), `font-sans` (corpo). Carregar via `next/font/google`: Space Grotesk, JetBrains Mono, Inter.
- Utilitários: `.hud-grid` (grade de fundo), `.hud-panel` (painel com brilho sutil), `.hud-label`, `.hud-value`, `.glow-signal`, `.glow-h1n1`, `.scanlines` (overlay sutil em containers `relative`), `.pulse-ring`.

## Regras
1. Todo número: `tabular-nums`, fonte, `base de`, texto de universo acessível (tooltip + texto visível abaixo do painel).
2. Semanas provisórias em âmbar tracejado; células suprimidas como `<5`; sinal EARS rotulado "sinal estatístico, não surto confirmado".
3. Animações respeitam `prefers-reduced-motion`; globo 3D só no cliente, carregado sob demanda, com pôster estático como fallback; em telas < 768 px o globo começa pausado.
4. Contraste AA: `ink`/`muted` sobre `bg-900/950`; `signal` sobre `bg-950` ≥ 7:1; nunca texto `faint` menor que 11 px.
5. Layout: HUD de 12 colunas; painéis com `.hud-label` no topo e rodapé de metadados (fonte · licença · base · método).
6. Sem alarmismo: vermelho reservado para o aviso de emergência/sinais de alerta.

## Componentes da sala de situação (src/components/sala/)
| Componente | Tipo | Função |
|---|---|---|
| `TimelineContext` (`TimelineProvider`, `useTimeline`) | client | Estado único do scrubber (semanas ISO, índice, play/pause, velocidade, replay 2009-W17→2010-W33). Sem autoplay; `prefers-reduced-motion` desliga animações automáticas. |
| `TimeScrubber` | client | Range + rótulo grande da semana ISO + play/pause + velocidade + "Replay da pandemia de 2009" + "Última semana". |
| `GlobePanel` → `Globe3D` (dynamic, ssr:false) | client | Globo WebGL (react-globe.gl): hexágonos dos países (world-atlas), pontos e anéis magenta ∝ √detecções; atmosfera ciana; sem textura fotográfica. Em < 768 px mostra o pôster com "Ativar globo 3D"; sem WebGL cai no pôster. |
| `GlobePoster` | server | Pôster SVG (projeção ortográfica voltada para o Brasil, d3-geo) com pontos da última semana: fallback, LCP e estado de carregamento. |
| `HudCounters` + `CountUp` | client | Quatro contadores animados (framer-motion) derivados de `/v1/globe` para a semana: mundo, países reportando, Brasil, posição do Brasil. Rodapé "FluNet · OMS · base de". |
| `BrazilStrip` → `BrazilMap` | client | Seletor de indicador, mapa de UFs (SVG, d3-geo Mercator, malha IBGE) colorido pela semana do scrubber, hachura para "<5"/sem dado, tooltip, legenda; ranking de UFs. Semana fora da cobertura carregada é explicitada. |
| `EarsTable` | server | Sinais EARS C1/C2/C3 por UF, rotulados "sinal estatístico, não surto confirmado". |
| `TrendChart` | client (ECharts dynamic) | Série nacional 52 semanas, provisório tracejado em âmbar + markArea, nowcast (faixa + estimativa pontilhada), tabela equivalente em `<details>`. |
| `SeasonsChart` | client (ECharts) | Sobreposição de temporadas 2019..ano corrente (ano corrente em magenta). |
| `CompositionChart` | client (ECharts) | Área empilhada FluNet Brasil (H1N1pdm09 magenta, A(H3) violeta, não subtipada cinza, B verde-água) + positividade (linha âmbar, eixo direito). |
| `NextstrainPanel` | client | iframe do Nextstrain carregado só ao clicar; crédito e link; fallback sem parâmetros. |
| `IngestConsole` | client | Últimas execuções de `/v1/runs` em estilo terminal, "digitação" só na primeira renderização (reduced-motion desliga). |
| `HudTopbar`, `HudFooter`, `Panel`, `CommandPaletteButton` | server/client | Marca + relógio de base (/v1/freshness) + ⌘K + "Entenda o H1N1"; rodapé de transparência; moldura de painel com rótulo e metadados; botão que despacha o atalho ⌘K/Ctrl+K e o evento `h1n1:command-palette`. |
| `WorldExplorer` | client | `/dados/mundo/`: globo + scrubber + tabela por país da semana + comparação de até 5 países (ECharts, dataZoom). |
| `charts/EChart`, `charts/ChartSkeleton` | client | Wrapper do ECharts (tema `h1n1-hud` registrado a partir de `src/lib/echarts-theme.ts`); esqueleto que reserva a altura. |

Libs puras (testadas em `test/sala.test.ts`): `src/lib/timeline.ts` (semanas ISO, alinhamento, cobertura, replay), `src/lib/map-scale.ts` (escala √ magenta←ciano, hachura para nulo/suprimido), `src/lib/hud.ts` (contadores e ranking), `src/lib/geo-assets.ts` (malhas em `public/geo/`).

Assets: `public/geo/br-uf.geojson` (IBGE, `codarea` → `BR_STATES`), `public/geo/countries-110m.json` (world-atlas). Baixados uma vez; nunca buscados de outra origem em runtime.
