# H1N1 · direção de design v3 — "papel, cinema, dado"

**Patamar:** plastic-ocean.com, coloniazacamil.com, opportunity.waltonfamilyfoundation.org (ver
`docs/reformulacao-v4.md`). **Para quem:** pessoas comuns. **Sensação:** uma revista de jornalismo visual que
virou filme: papel quente, tipografia grande, um protagonista (o vírus) atravessando a página, números como
momentos. **Não é:** landing page com cartões, painel escuro, HUD, "tempo real", alarmismo.

## Tokens (`src/app/globals.css`, Tailwind 4 `@theme`)

Fontes (auto-hospedadas por `next/font`):
- `font-display` → Instrument Serif (400, itálico 400). Títulos ≥ 40 px, pull-quotes, números gigantes.
  `letter-spacing: -0.01em`, `line-height: 0.95–1.02`. Nunca em texto corrido.
- `font-condensed` → Big Shoulders (variável 300–900). "H1N1", numerais de capítulo, palavras-chave em
  caixa alta (`tracking 0.02em`). Único lugar onde caixa alta é permitida.
- `font-sans` → Inter. Corpo 18–19 px, `line-height` 1.6; UI 14–15 px.
- `font-mono` → JetBrains Mono. Etiquetas `[ 02 ]`, "base de 13/10/2026", valores tabulares. Caixa normal.

Cores (tema `paper`, padrão):
- Fundos: `bg-paper` `#f4f1ea`, `bg-paper-2` `#ece8df` (faixas alternadas), `bg-card` `#fbfaf7`, véu
  translúcido para texto sobre o palco: `bg-veil` `rgba(244,241,234,.78)`.
- Tinta: `text-ink` `#14130f`, `text-muted` `#4d4a42`, `text-faint` `#716d63` (≥ 12 px). Linhas: `border-line`
  `#dcd7cb`, `border-line-strong` `#b9b3a4`.
- Ação e dado principal: cobalto `primary-600` `#2451d6` (`-700` `#1e3fae`, `-100` `#dbe5ff`, `-50` `#eef3ff`).
- Dados (inalterados): `h1n1` `#d6007f` (A(H1N1)pdm09), `h3` `#6d5df6`, `infb` `#0f9f93`, `srag` `#f29a0a`,
  `attention-700` `#9a5b00` (provisório), `urgent-700` `#b42318` (só emergência), `ok-700` `#126e42`.

Temas por seção (`[data-theme]` no elemento da seção; o shell interpola as variáveis no `<html>`):
- `paper` (acima); `deep`: fundo `#0b1a2e`, tinta `#f4f1ea`, muted `#c9d2e3`, linhas `rgba(244,241,234,.18)`;
  `warm`: fundo `#f7e8d5`, tinta `#14130f`. Contraste AA em todos (tinta sobre fundo ≥ 12:1; muted ≥ 7:1).

Escala tipográfica (clamp): `.display-xl` 64→160 px (abertura, "H1N1" em condensada chega a 28 vw);
`.display-lg` 40→96 px; `.display-md` 32→56 px; `.lead` 20→26 px (Instrument Serif itálico para subtítulos);
`.bignum` 72→200 px (Instrument Serif, `tabular-nums`); `.kicker-mono` 12–13 px mono `[ 01 ]`; `.eyebrow`
13 px sans medium cobalto.

Formas: botões e pílulas `rounded-full` (`.btn`, `.pill`), alvo ≥ 44 px; cartões só onde há **dado** (painéis
de números, gráficos): `rounded-[20px]`, fundo `bg-card`, borda `border-line`, sombra `shadow-card`. Nunca
cartão em volta de narrativa ou do palco 3D.

Textura: `.paper-grain` (SVG `feTurbulence` inline, `mix-blend-mode: multiply`, opacidade ≤ .08; `display:none`
em `deep` e em `prefers-reduced-motion` não há diferença, é estática).

## Regras

1. **Um pensamento por tela.** Título grande + uma frase + um elemento visual. Linguagem simples; termos
   explicados na primeira vez (`<Glossario>`).
2. **Números como momentos, nunca soltos.** Todo número epidemiológico vem de `<Fato>` ou da API, com fonte,
   período, universo e "base de DD/MM/AAAA" visíveis no mesmo bloco; provisório em âmbar; suprimido "<5".
   Contagem animada (`gsap`) só na entrada e nunca em `prefers-reduced-motion`.
3. **Palco 3D em tela inteira** (home): fundo = cor do tema (canvas opaco, cor lerpada), sem pós-processamento,
   sem neon. Alternativa textual + pôster sempre; `prefers-reduced-motion` → cena por botões; DPR ≤ 1,5.
4. **Shell mínimo:** marca pequena + pílula Menu + trilho de capítulos (home) + rodapé que se revela. Sem barra
   de navegação. Menu em overlay com tipografia gigante, foco preso, Esc fecha.
5. **Movimento com propósito:** rolagem suave (Lenis), revelações curtas (≤ 600 ms), texto dividido em linhas
   só em títulos; nada "flutua" sem razão. `prefers-reduced-motion` desliga tudo isso.
6. **Acessibilidade AA:** foco visível `outline primary-600` (em `deep`, tinta clara), alvos ≥ 44 px, contraste
   verificado por tema, navegação por teclado completa (inclusive capítulos 3D e menu).
7. **Proibido:** grade de fundo, scanlines, neon, bloom, caixa alta em mono, "tempo real", vermelho fora do
   aviso de emergência, iframes e qualquer asset de outra origem.
