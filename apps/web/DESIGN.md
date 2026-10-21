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
