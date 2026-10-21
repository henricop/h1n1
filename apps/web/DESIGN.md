# H1N1 · direção de design v2 — "claro, forte, humano"

**Para quem:** pessoas comuns que querem entender e decidir, não especialistas. **Sensação:** tecnologia de ponta a serviço de clareza. Referências de polimento: Apple Health, Stripe, Linear, explicadores do NYT/Reuters Graphics. **Não é:** painel escuro, HUD, "tempo real", alarmismo.

## Tokens (apps/web/src/app/globals.css, Tailwind 4 `@theme`)
- Fundos: `bg-bg` (branco), `bg-bg-soft` (cinza-azulado leve para seções alternadas), `bg-bg-tint` (tint do primário), `bg-card`. Bordas `border-line` / `border-line-strong`.
- Texto: `text-ink`, `text-muted`, `text-faint` (≥ 12 px).
- Cor primária cobalto `primary-600` (ações, links, dado principal), `primary-50/100` para fundos de destaque. Dados: `h1n1` (rosa forte), `h3` (violeta), `infb` (verde-água), `srag` (âmbar, também provisório), `urgent-700` só emergência, `ok-700`.
- Fontes: `font-display` (Manrope, títulos grandes, peso 700/800, tracking -0.02em), `font-sans` (Inter, corpo 17–18 px, line-height 1.6), `font-mono` (JetBrains Mono apenas para valores tabulares e código).
- Raio: cartões 20–24 px, botões pílula (999 px). Sombra: `shadow-[0_8px_30px_-12px_rgba(11,18,32,.18)]`. Espaço generoso: seções com `py-20 md:py-28`, container `max-w-6xl`.

## Regras
1. Um pensamento por tela: título grande (display 40–64 px) + uma frase + um elemento visual. Linguagem simples; termos técnicos explicados na primeira vez (componente `<Glossario>`).
2. Todo número: `tabular-nums`, fonte, "base de DD/MM/AAAA", texto de universo visível. Provisório em âmbar; suprimido como "<5".
3. 3D (react-three-fiber): fundo claro, materiais físicos suaves (translúcido/fosco), luz de estúdio, sem neon. Canvas sempre com alternativa textual e pôster estático; `prefers-reduced-motion` desliga animação contínua; DPR ≤ 1.5; em mobile reduzir instâncias.
4. Acessibilidade AA: foco visível `outline primary-600`, alvos ≥ 44 px, contraste verificado, navegação por teclado em tudo (inclusive capítulos 3D: botões "próximo/anterior").
5. Nada de grade de fundo, scanlines, brilho neon, caixa alta monoespaçada em rótulos. Rótulos em caixa normal, pequenos e discretos.
6. Vermelho só no aviso de emergência; aviso médico sempre presente em conteúdo clínico, com tom calmo.
