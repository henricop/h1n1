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
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` (domínio final a definir) | Canonical, sitemap e JSON-LD |
| `H1N1_API_MOCK` | (vazio) | `1` = responder com as fixtures em vez de chamar a API |
| `H1N1_FIXTURES_DIR` | `test/fixtures/api` | Diretório das fixtures da API (modo mock) |
| `H1N1_CONTENT_DIR` | `content/` | Diretório do conteúdo MDX (usado nos testes para apontar a `test/fixtures/content`) |

Para regenerar as fixtures da API (determinísticas, derivadas de `data/sources.json` e da ontologia do core): `pnpm --filter @h1n1/web fixtures:generate`.

## Comportamento com a API fora do ar

Todas as chamadas em `src/lib/api.ts` têm timeout de 8 s, `next: { revalidate: 3600 }` e nunca lançam: devolvem `{ ok: false, status: 'unavailable', attemptedAt }`. As páginas renderizam "Dados indisponíveis no momento (última tentativa: …)" e nunca exibem número antigo como atual. Páginas que dependem da API (`/`, `/dados/brasil/`, `/dados/fontes/*`) são `force-dynamic`; páginas MDX são estáticas com revalidação de 1 h (um `<Indicador>` cujo fetch falhou no build mostra "dado indisponível" até a próxima revalidação).

## Estrutura

```
apps/web/
├── src/app/
│   ├── layout.tsx            # lang=pt-BR, skip link, header/rodapé derivados do conteúdo
│   ├── page.tsx              # homepage (seção 6.2 do plano) + JSON-LD Organization/WebSite
│   ├── [...slug]/page.tsx    # catch-all das páginas MDX (generateStaticParams + generateMetadata)
│   ├── dados/brasil/         # observatório (seletores por searchParams, SVG + tabela, Dataset JSON-LD)
│   ├── dados/fontes/         # catálogo (DataCatalog JSON-LD) e /dados/fontes/[idOrSlug]/
│   ├── dados/metodologia/    # MDX opcional + tabela de INDICATORS + 10 regras de integridade
│   ├── sitemap.ts, robots.ts, not-found.tsx, error.tsx, globals.css
├── src/lib/
│   ├── api.ts                # cliente tipado da API + modo mock
│   ├── content.ts            # schema zod do frontmatter, carregamento, política de indexação, navegação, facts
│   ├── glossary.ts, series.ts, format.ts, metadata.ts, nav.ts, observatory.ts, integrity-rules.ts, site.ts
├── src/components/
│   ├── Header, Footer, Breadcrumb, Notices (banner de revisão, aviso clínico, indisponível, defasado)
│   ├── MdxArticle.tsx        # template único de página editorial
│   ├── IndicatorCard.tsx, SourceCard.tsx, JsonLd.tsx, SkipLink.tsx
│   ├── charts/               # Sparkline, LineChart, SeriesTable (SVG puro + tabela acessível)
│   └── mdx/                  # componentes expostos ao MDX
├── test/                     # vitest (content, api, integridade de cópia, sitemap)
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

- `index_policy: noindex_until_reviewed` e `review_status ≠ reviewed` → `robots: noindex,follow`, fora do sitemap, da navegação e da homepage, com banner "Conteúdo em revisão clínica…".
- `clinical: true` não revisada → mesmo tratamento (não lançar página clínica sem revisão, seção 11.1 do plano).
- `clinical: true` (mesmo revisada) → aviso "Este conteúdo é educativo e não substitui avaliação médica."
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
| `<Indicador id="…" geo="BRA" periodo="ultimas-12-semanas" />` | último valor, período, data da base, universo e link para `/dados/brasil/`; "dado indisponível" se a API falhar |
| `<Glossario termo="…">texto?</Glossario>` | definição acessível (hover/foco) dos termos de `src/lib/glossary.ts` (A(H1N1)pdm09, H1N1, influenza A, SRAG, síndrome gripal, SIVEP-Gripe, FluNet, semana epidemiológica, subtipo, RT-PCR, gripe sazonal, pandemia, grupo de risco); termo desconhecido é renderizado sem tooltip |
| `<Comparativo titulo colunas={[…]} linhas={[{ rotulo, valores }]} nota? />` | tabela responsiva |
| `<LinhaDoTempo eventos={[{ data, titulo, fato_id?, descricao? }]} />` | eventos datados com fato verificado |
| `<Passos titulo?>` | lista numerada em destaque (filho: `<ol>`) |

`facts.json`: array de `{ id, claim, source_title, source_url, quote?, verified_by, verified_at }`.

## Páginas de aplicação

- `/`: título, 4 perguntas (apontam para a página elegível; cada uma some se não houver nenhuma), bloco "H1N1 no Brasil | última base disponível" com `sivep_srag_ah1n1pdm09_confirmed` (8 semanas, sparkline + tabela) e `flunet_ah1n1pdm09_detections` (BRA), "Entenda em poucos minutos", links institucionais.
- `/dados/brasil/?indicador=&uf=&intervalo=`: lista fixa em `src/lib/observatory.ts`; UF é ignorada (com aviso) para FluNet; recorte com tudo suprimido é explicitado; células `<5`; selo "Dado defasado" quando `age_days > 14` em `/v1/freshness`; botão CSV para `/v1/series.csv`.
- `/dados/fontes/?prioridade=&acesso=` e `/dados/fontes/[idOrSlug]/`.
- `/dados/metodologia/`.

## Testes

`pnpm --filter @h1n1/web test` (vitest, sem browser): frontmatter inválido falha; `reviewed` sem revisor falha; política noindex; navegação exclui páginas não elegíveis; `<Fato>` inexistente quebra o build; modo mock lê fixtures; falha de rede devolve `unavailable` sem lançar; integridade de cópia ("tempo real" fora de contexto negado e "casos de H1N1 na sua cidade" são proibidos em `src/` e `content/`); sitemap só com páginas elegíveis.
