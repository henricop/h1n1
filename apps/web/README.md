# @h1n1/web

Site público do projeto H1N1 (Next.js 15, App Router, React 19, TypeScript strict, Tailwind CSS 4). Consome a API HTTP (`apps/api`) e o conteúdo editorial em MDX de `content/` (escrito por outro agente). Não depende de `@h1n1/db`.

## Como rodar

```bash
# na raiz do monorepo
pnpm install
pnpm --filter @h1n1/core build          # o site importa @h1n1/core (INDICATORS, BR_STATES)

# com a API no ar (apps/api em http://localhost:3001)
pnpm --filter @h1n1/web dev             # http://localhost:3000

# sem API: modo mock lê test/fixtures/api/*.json
H1N1_API_MOCK=1 pnpm --filter @h1n1/web dev

# build, typecheck, testes
pnpm --filter @h1n1/web build           # passa com ou sem API no ar
pnpm --filter @h1n1/web typecheck
pnpm --filter @h1n1/web test
```

Variáveis de ambiente:

| Variável | Default | Uso |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Base da API (`/v1/*`) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` só em dev/test (domínio final a definir) | Canonical, sitemap e JSON-LD. **Obrigatória em produção**: `NODE_ENV=production` sem ela lança erro claro na inicialização ("defina NEXT_PUBLIC_SITE_URL; domínio final a definir"). Durante `next build` (`NEXT_PHASE=phase-production-build`) só avisa e usa o placeholder, para o build passar sem a variável; `next start` sem ela falha |
| `H1N1_API_MOCK` | (vazio) | `1` = responder com as fixtures em vez de chamar a API |
| `H1N1_FIXTURES_DIR` | `test/fixtures/api` | Diretório das fixtures da API (modo mock) |
| `H1N1_CONTENT_DIR` | `content/` | Diretório do conteúdo MDX (usado nos testes para apontar a `test/fixtures/content`) |

Para regenerar as fixtures da API (determinísticas, derivadas de `data/sources.json` e da ontologia do core): `pnpm --filter @h1n1/web fixtures:generate`.

## Tema claro (DESIGN.md v2)

Todo o site usa o tema **claro, limpo e forte** descrito em `DESIGN.md`: fundo branco/cinza-azulado, tinta quase preta, cobalto (`primary-600`) para ações, links e dado principal; rosa forte (`h1n1`) para A(H1N1)pdm09, violeta (`h3`), verde-água (`infb`), âmbar (`srag`/`attention-*`) para provisório e atenção, vermelho só em emergência. Tokens em `src/app/globals.css` (`@theme`), fontes via `next/font/google` em `layout.tsx` (Inter → `--font-inter`, Manrope → `--font-display-face`, JetBrains Mono → `--font-jetbrains`). Utilitários do sistema: `.card`/`.card-soft` (raio 20 px, sombra suave), `.label`/`.kicker`/`.meta`, `.value` (contador em display), `.btn`/`.btn-primary`/`.btn-h1n1`/`.btn-sm` (pílulas ≥ 44 px), `.select-field`, `.input-field`, `.chip`. Não existem mais grade de fundo, scanlines, brilho neon nem rótulos em caixa alta monoespaçada; foco visível em cobalto; pares de contraste AA documentados no próprio `globals.css`. O tema claro dos gráficos está em `src/lib/echarts-theme.ts` (`CHART_COLORS`; `HUD_COLORS` é alias de compatibilidade).

## Sala de dados (`/sala/`) e bibliotecas de visualização

A antiga home (sala de situação) vive em **`/sala/`** (a home `/` é a página 3D de outro fluxo): globo WebGL em fundo claro com as detecções de A(H1N1)pdm09 por país desde 2009 (scrubber temporal com replay da pandemia), contadores, mapa de UFs sincronizado (escala `primary-50` → `h1n1`), sinais EARS, tendência com nowcast, temporadas, composição FluNet, Nextstrain (iframe sob demanda), execuções dos conectores e o painel do assistente. `/dados/mundo/` reaproveita globo + tabela por país + comparação de até 5 países.

**Payload do globo**: o RSC de `/sala/` envia só as últimas `GLOBE_WINDOW_WEEKS` (160) semanas de cada país (`GlobeHero`); o eixo do scrubber continua completo. Quando o usuário leva a linha do tempo para antes da janela (replay de 2009, reproduzir desde o início), o cliente busca o dataset completo uma única vez em `GET /api/globe?indicator=&from=` (proxy de `/v1/globe` via `src/lib/api.ts`, cache de 1 h; funciona no modo mock). `/dados/mundo/` continua recebendo o dataset completo (a comparação de países usa a série inteira).

Bibliotecas: `react-globe.gl` (+ `three`, `topojson-client`), `echarts` + `echarts-for-react`, `d3-geo`/`d3-scale`/`d3-array`, `framer-motion`, fontes via `next/font/google` (Inter, Manrope, JetBrains Mono). Globo e ECharts carregam só no cliente (`next/dynamic`, `ssr: false`) com pôster/esqueleto que reserva a altura; cada gráfico tem tabela equivalente em `<details>`.

Malhas em `public/geo/` (baixadas uma vez, nunca em runtime): `br-uf.geojson` (IBGE, `codarea` → `BR_STATES`) e `countries-110m.json` (world-atlas).

Endpoints novos consumidos por `src/lib/api.ts` (zod + mock; `unavailable`/`not_found` honestos): `GET /v1/globe`, `GET /v1/map/brazil`, `GET /v1/analytics/ears`, `GET /v1/analytics/nowcast` (404 `nowcast_unavailable` → "nowcast indisponível"), `GET /v1/analytics/seasons`, `GET /v1/runs`, `GET /v1/indicators/:id/latest`. Fixtures correspondentes em `test/fixtures/api/` (`globe.*.json`, `map.brazil.*.json`, `ears.*.state.json`, `nowcast.*.BRA.json`, `seasons.*.BRA.json`, `runs.json`, `latest.*.BRA.json`), geradas por `fixtures:generate` numa seção própria (PRNG re-semeado) para manter as fixtures anteriores idênticas.

Integridade: nada de "tempo real"; todo número com fonte e `base de`; células suprimidas como `<5` (hachura no mapa) e sem tendência no `LatestChip`; semanas provisórias em âmbar tracejado (só quando existe semana provisória, `provisionalFrom >= 0`); EARS rotulado "sinal estatístico, não surto confirmado" e com o `universe_note`; o console de execuções mostra "última execução", nunca um estado corrente, renderiza todas as linhas no SSR (entrada escalonada só por CSS, desligada em `prefers-reduced-motion`); "Dados indisponíveis" usa o `attemptedAt` real do `ApiResult` e lista vazia vira "Sem dado publicado" (`NoDataPublished`), nunca `new Date()` em render.

## Segurança

- **CSP** em `next.config.ts` (`buildCsp`): `default-src 'self'`; `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` só em dev); `img-src 'self' data: blob:`; `connect-src 'self' <NEXT_PUBLIC_API_URL> https://nextstrain.org`; `frame-src https://nextstrain.org`; `style-src 'self' 'unsafe-inline'`; `font-src 'self' data:`; `object-src 'none'`; `frame-ancestors 'none'`. O iframe do Nextstrain usa `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"` (sem `allow-same-origin`) e cai num link fixo após 20 s sem `load`.
- **Assistente (`/api/chat`)**: corpo lido do stream com teto de 256 KB mesmo sem `Content-Length` (413); só mensagens `user`/`assistant` com partes de texto (`system` → 400; partes de ferramenta/arquivo vindas do cliente são descartadas); cada parte ≤ 2.000 caracteres e conversa ≤ 12.000; links escritos pelo modelo só viram `<a>` se forem rotas internas (`/[a-z0-9-/]*` + query simples) ou coincidirem com uma citação devolvida por ferramenta (`src/lib/assistant/links.ts`).
- **Rate limit** (`src/lib/assistant/rate-limit.ts`): em memória, **por instância** do processo (com N réplicas o limite efetivo é N×). IP do cliente = **último** valor de `x-forwarded-for` (ou `x-real-ip`) **apenas com `TRUST_PROXY=true`**; sem isso o header é ignorado (forjável) e todos dividem a chave `direct`. Em produção atrás de proxy reverso, defina `TRUST_PROXY=true`. Chat: 20/10 min; terminal: 60/10 min.
- **Terminal (`/api/terminal`)**: rate limit por IP (mesmo módulo), linha ≤ 300 caracteres, e nenhuma linha `detalhe:` (URL interna da API, mensagem do fetch) volta ao cliente: fica só no `console.error` do servidor (`src/lib/terminal/route-handler.ts`). `abrir <rota>` (terminal) aceita só rotas internas simples (rejeita `//`, `\`, `javascript:`).
- Rótulo HTML dos pontos do globo escapa o nome do país (`src/lib/html.ts`).

## Comportamento com a API fora do ar

Todas as chamadas em `src/lib/api.ts` têm timeout de 8 s, `next: { revalidate: 3600 }` e nunca lançam: devolvem `{ ok: false, status: 'unavailable', attemptedAt }`. As páginas renderizam "Dados indisponíveis no momento (última tentativa: …)" com o **nome legível do indicador** (rótulo de `OBSERVATORY_INDICATORS`, senão o nome da ontologia do core) e nunca exibem número antigo como atual.

- **Contrato validado (zod)**: toda resposta da API (e toda fixture do modo mock) passa por um schema mínimo (`sources`, `indicators`, `series`, `freshness`, `geo`). Corpo que não é JSON ou JSON fora do contrato (ex.: série sem `meta`) vira `status: 'unavailable'` com o motivo em `console.error`; nunca lança.
- **Células suprimidas**: a camada de API normaliza `value = suppressed ? null : value` em toda observação. `lastPublished`, sparkline, gráfico de linhas, cards e `<Indicador>` usam `publishedValue()` e nunca exibem o valor de uma célula `suppressed` (a tabela mostra `<5`).
- **Frescor**: `freshnessState()` distingue "verificado" de "não verificado". Se `/v1/freshness` falhar, cards, `<Indicador>` e observatório mostram a nota "frescor não verificado" ao lado do valor em vez de esconder o selo em silêncio; "Dado defasado" aparece quando `age_days > 14` (14 dias não é defasado; 15 é).

### Política de cache

| Rota | Política | Motivo |
|---|---|---|
| `/sala/`, `/dados/mundo/`, `/dados/fontes/[idOrSlug]/`, `/dados/metodologia/`, `/[...slug]/`, `sitemap.xml` | `export const revalidate = 3600` (ISR) | Mesmo valor de `API_REVALIDATE_SECONDS` em `src/lib/api.ts`; o Next exige literal, e `test/cache-policy.test.ts` garante que não divergem |
| `/dados/brasil/`, `/dados/fontes/` | `force-dynamic` | Leem `searchParams` (indicador/uf/intervalo; prioridade/acesso); o cache de fetch da API continua em 1 h |

O build passa com ou sem API: páginas ISR renderizadas sem API ficam com "Dados indisponíveis" até a próxima revalidação (um `<Indicador>` cujo fetch falhou no build mostra "dado indisponível" até lá).

## Estrutura

```
apps/web/
├── src/app/
│   ├── layout.tsx            # lang=pt-BR, skip link, header/rodapé derivados do conteúdo
│   ├── page.tsx              # Home 3D (outro fluxo)
│   ├── sala/page.tsx         # Sala de dados (tema claro) + JSON-LD Organization/WebSite/Dataset
│   ├── dados/mundo/          # globo + tabela por país + comparação de países (ISR; estado no cliente)
│   ├── [...slug]/page.tsx    # catch-all das páginas MDX (generateStaticParams + generateMetadata)
│   ├── dados/brasil/         # observatório (seletores por searchParams, SVG + tabela, único Dataset JSON-LD: série derivada)
│   ├── dados/fontes/         # catálogo (DataCatalog JSON-LD, seções por região com id slugificado) e /dados/fontes/[idOrSlug]/ (sem JSON-LD)
│   ├── dados/metodologia/    # MDX opcional + tabela de INDICATORS + 10 regras de integridade
│   ├── sitemap.ts, robots.ts, not-found.tsx, error.tsx, global-error.tsx, globals.css
├── src/lib/
│   ├── api.ts                # cliente tipado da API (zod, normalização de supressão, frescor) + modo mock
│   ├── content.ts            # schema zod do frontmatter, carregamento, política de indexação, navegação, facts
│   ├── glossary.ts, series.ts, format.ts, metadata.ts, nav.ts, observatory.ts (lista, rótulos, parsing dos searchParams), integrity-rules.ts, site.ts
│   ├── timeline.ts, map-scale.ts, hud.ts, echarts-theme.ts, geo-assets.ts, html.ts   # sala de dados (puros, testados)
├── src/components/
│   ├── Header, Footer, Breadcrumb, Notices (banner de revisão, aviso clínico, indisponível, defasado, frescor não verificado)
│   ├── MdxArticle.tsx        # template único de página editorial
│   ├── IndicatorCard.tsx, SourceCard.tsx, JsonLd.tsx, SkipLink.tsx
│   ├── charts/               # Sparkline, LineChart, SeriesTable (SVG puro + tabela acessível), EChart (wrapper), ChartSkeleton
│   ├── sala/                 # globo (GlobeHero com histórico sob demanda), scrubber, contadores, mapa de UFs, EARS, tendência/nowcast, temporadas, composição, Nextstrain, execuções
│   ├── terminal/, assistente/  # CommandPalette e AssistentePanel (de outro agente; apenas montados aqui)
│   └── mdx/                  # componentes expostos ao MDX
├── test/                     # vitest (content, api, series, components, cache-policy, integridade de cópia, sitemap)
│   └── fixtures/             # api/*.json (gerados), content/ (MDX + facts.json de exemplo)
└── content/                  # conteúdo editorial: de outro agente; este pacote só lê
```

## Conteúdo editorial (`content/pages/**.mdx` + `content/facts.json`)

O slug do frontmatter deve corresponder ao caminho do arquivo (`pages/sintomas/criancas.mdx` → `/sintomas/criancas/`; `pages/sintomas/index.mdx` → `/sintomas/`). Slugs `/`, `/dados/brasil/*` e `/dados/fontes/*` são reservados a rotas de aplicação; `/dados/metodologia/` é renderizado pela rota de aplicação (MDX seguido da tabela de indicadores).

### Schema do frontmatter (zod, `src/lib/content.ts`)

| Campo | Tipo | Regras |
|---|---|---|
| `title` | string | obrigatório |
| `description` | string | ≤ 160 caracteres |
| `slug` | string | caminho com barras, ex. `/sintomas/criancas/` |
| `intent` | string | intenção de busca atendida |
| `nav_group` | `entenda` \| `sintomas` \| `vacina` \| `dados` \| `sobre` \| `null` | grupo da navegação |
| `clinical` | boolean | conteúdo clínico |
| `index_policy` | `index` \| `noindex_until_reviewed` | |
| `review_status` | `draft` \| `pending_editorial_review` \| `pending_clinical_review` \| `reviewed` | `reviewed` exige `reviewer` e `reviewed_at` (senão o build falha); os demais são "não revisado" |
| `author` | string | |
| `reviewer` | string \| null | |
| `reviewed_at` | `YYYY-MM-DD` \| null | |
| `updated_at` | `YYYY-MM-DD` | datas sem aspas (YAML `Date`) são aceitas e normalizadas |
| `sources` | `{ id?, title, url, accessed_at }[]` | bloco "Fontes" numerado |
| `related` | string[] (slugs) | só os elegíveis são exibidos |
| `summary_answer` | string | resposta curta exibida acima da dobra |

Dica YAML: valores com `: ` (dois-pontos e espaço) precisam de aspas.

### Política derivada

A decisão de indexação vem de `index_policy` e `review_status`; `clinical` **não** decide indexação (`derivePolicy` em `src/lib/content.ts`).

- `index_policy: noindex_until_reviewed` e `review_status ≠ reviewed` → `robots: noindex,follow`, fora do sitemap, da navegação e da homepage.
- `index_policy: index` é uma **exceção explícita e justificada no frontmatter** (entre as páginas clínicas, hoje só `/sintomas/sinais-de-alerta/`, com citação literal da orientação oficial; páginas não clínicas institucionais e de dados também usam `index`): a página é elegível e indexável (entra no sitemap e na navegação) **mesmo sendo clínica e não revisada**.
- `clinical: true` e `review_status ≠ reviewed` (qualquer `index_policy`) → banner "Conteúdo em revisão clínica…" (`underReview`). Em página `index` o banner aparece, mas a página continua indexável.
- `clinical: true` (mesmo revisada) → aviso "Este conteúdo é educativo e não substitui avaliação médica."
- Resumo: `noindex = não revisada E index_policy = noindex_until_reviewed`; `eligible = !noindex`; `underReview = não revisada E clinical`. Uma página `reviewed` é sempre indexável.
- Toda página MDX renderiza: breadcrumb (+ BreadcrumbList), resposta curta, corpo, "Fontes", "Autoria e revisão" (`author`, `reviewer` ou "Sem revisão clínica até o momento", `updated_at`), "Leia também". Sem data de publicação em destaque, tags, categorias ou "posts recentes".

### Navegação

Construída a partir das páginas elegíveis: Sintomas e cuidados (`/sintomas/`, senão `/sintomas/sinais-de-alerta/`, senão a primeira elegível do grupo), Vacina e prevenção (`/vacina/` ou `/prevencao/`), H1N1 hoje (`/dados/brasil/`), Dados e pesquisas (`/dados/fontes/`, `/dados/metodologia/`), Entenda o H1N1 (`/o-que-e-h1n1/`, `/transmissao/`, `/historia/`, `/comparar/`…). Grupos sem página elegível não aparecem. O rodapé lista `/sobre/*` e `/contato/` elegíveis.

### Componentes MDX (`src/components/mdx/`)

| Componente | Uso |
|---|---|
| `<Resposta titulo?>` | caixa de resposta direta |
| `<Alerta tipo="emergencia" \| "atencao" \| "info" titulo?>` | aviso; `emergencia` usa `role="alert"` |
| `<Limites titulo?>` | lista "o que isto não permite concluir" |
| `<Fato id="…" />` | claim de `facts.json` com fonte, citação opcional, verificador e data; id inexistente quebra o build |
| `<Indicador id="…" geo="BRA" periodo="ultimas-12-semanas" />` | último valor publicável (nunca de célula suprimida), período, data da base, selo de defasagem ou "frescor não verificado", universo e link para `/dados/brasil/`; "dado indisponível" (com o nome do indicador) se a API falhar |
| `<Glossario termo="…">texto?</Glossario>` | definição acessível (hover/foco) dos termos de `src/lib/glossary.ts` (A(H1N1)pdm09, H1N1, influenza A, SRAG, síndrome gripal, SIVEP-Gripe, FluNet, semana epidemiológica, subtipo, RT-PCR, gripe sazonal, pandemia, grupo de risco); termo desconhecido é renderizado sem tooltip |
| `<Comparativo titulo colunas={[…]} linhas={[{ rotulo, valores }]} nota? />` | tabela responsiva |
| `<LinhaDoTempo eventos={[{ data, titulo, fato_id?, descricao? }]} />` | eventos datados com fato verificado |
| `<Passos titulo?>` | lista numerada em destaque (filho: `<ol>`) |

`facts.json`: array de `{ id, claim, source_title, source_url, quote?, verified_by, verified_at }`.

## Páginas de aplicação

- `/sala/`: sala de dados. Topo (título, datas das bases via `/v1/freshness`, "Entenda o H1N1"); hero com globo (`/v1/globe`, 2009-W01 → última semana; janela de 160 semanas no RSC + histórico via `/api/globe`), 4 contadores e scrubber; faixa Brasil (`/v1/map/brazil` × 4 indicadores, ranking, `/v1/analytics/ears`); tendência (`/v1/series` 52 semanas + `/v1/analytics/nowcast`) e temporadas (`/v1/analytics/seasons`); composição FluNet (5 séries); Nextstrain; execuções (`/v1/runs`); `<AssistentePanel />`; rodapé de transparência. Em < 768 px o globo é um pôster SVG com botão "Ativar globo 3D".
- `/terminal/`: console claro (`bg-soft`, prompt em cobalto) sobre `POST /api/terminal`.
- Header: wordmark "H1N1" (Manrope, cobalto), navegação Entenda · Sintomas e cuidados · Vacina e prevenção (só com página elegível) · Dados do Brasil · Sala de dados · Terminal · Fontes, pílula "Buscar ⌘K" que dispara `h1n1:palette` (único evento) para a `CommandPalette` (claro, zera a busca só ao abrir, armadilha de foco simples).
- `/dados/mundo/`: globo + scrubber, tabela por país da semana selecionada e comparação de até 5 países (ECharts) com `universe_note`.
- `/dados/brasil/?indicador=&uf=&intervalo=`: reskin com `TrendChart` (ECharts) e mapa de UFs da última semana para indicadores por UF; lista fixa em `src/lib/observatory.ts`; searchParams inválidos caem no padrão (`resolveObservatoryQuery`); UF é ignorada (com aviso) para FluNet; recorte com tudo suprimido é explicitado; células `<5`; selo "Dado defasado" quando `age_days > 14` em `/v1/freshness` ou "frescor não verificado" se esse endpoint falhar; botão CSV para `/v1/series.csv`; único lugar com JSON-LD `Dataset` (série derivada).
- `/dados/fontes/?prioridade=&acesso=` (JSON-LD `DataCatalog`; ids de seção `regiao-<slug>` sem acentos/espaços) e `/dados/fontes/[idOrSlug]/` (sem JSON-LD: a fonte é catalogada, não um dataset derivado).
- `sitemap.xml`: rotas de aplicação, páginas MDX elegíveis e `/dados/fontes/[slug]/` de cada fonte do catálogo (via API; se indisponível, as fontes são omitidas sem quebrar).
- `error.tsx` (erro de rota, mantém layout) e `global-error.tsx` (falha do layout raiz; renderiza `<html>/<body>` próprios, sem Tailwind).
- `/dados/metodologia/`.

## Testes

`pnpm --filter @h1n1/web test` (vitest, sem browser; componentes via `react-dom/server`; 104 testes): segurança (saneamento das mensagens do chat, teto de bytes lendo o stream, limites por parte e por conversa, política de links, `clientIp` com/sem `TRUST_PROXY`, rate limit e remoção de `detalhe:` na rota do terminal, `abrir` só com rota interna, `buildCsp`, `escapeHtml`); integridade visual (`LatestChip` sem tendência quando suprimido, `CompositionChart` só marca provisório com `provisionalFrom >= 0`, `EarsTable` com `universe_note`, `IngestConsole` com todas as linhas no SSR, `NextstrainPanel` sem `allow-same-origin`, `NoDataPublished`, botão da paleta sem classes do HUD); `test/sala.test.ts` cobre os parsers/zod dos endpoints novos com fixtures (inclusive 404 do nowcast e contrato inválido do globo), o alinhamento de semanas do scrubber (anos ISO com 53 semanas, cobertura, replay), a escala do mapa (nulo/suprimido → hachura), os contadores do HUD e o SSR de `EarsTable`/`IngestConsole`; frontmatter inválido falha; `reviewed` sem revisor falha; política noindex (inclusive metadados `robots` de uma página clínica real do fixture, `/sintomas/`); navegação exclui páginas não elegíveis; `<Fato>` inexistente quebra o build; modo mock lê fixtures; falha de rede devolve `unavailable` sem lançar; contrato inválido (payload sem `meta`, corpo não JSON) vira `unavailable` com motivo logado; célula `suppressed` é normalizada para `value: null` e nunca aparece em card, sparkline, gráfico ou tabela; `isStale` nos limites 14/15 dias; "frescor não verificado" quando `/v1/freshness` falha; estado de falha mostra o nome legível do indicador; searchParams inválidos do observatório caem no padrão; `slugify` dos ids de seção; `NEXT_PUBLIC_SITE_URL` obrigatória em produção; política de cache (`revalidate` literal = `API_REVALIDATE_SECONDS`, `force-dynamic` só com searchParams documentado); `global-error.tsx` presente; integridade de cópia ("tempo real"/"em tempo real", "ao vivo", "agora mesmo", "surto perto" fora de contexto negado e "casos de H1N1 na sua cidade" são proibidos em `src/` e `content/`); sitemap só com páginas elegíveis e fontes do catálogo (omitidas se a API falhar).
