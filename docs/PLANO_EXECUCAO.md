# H1N1 · Plano de execução técnica (derivado do plano estratégico v1.0 e do catálogo de 65 fontes)

**Data:** 2026-10-20 · **Status:** em execução · **Escopo:** fundação técnica do MVP descrito nas seções 5, 6, 9, 10 e 14 do plano estratégico.

## 0. Leitura da base

- `h1n1_catalogo_oficial.md`: 65 fontes (14 BR, 19 US, 6 globais + 1 OPAS + 1 WOAH, 4 UE/ECDC/ENA, 4 CA, 3 UK, 2 AU, 2 AR, 1 MX/ES/JP/CN/KR/NZ/CL/CO/DE). 19 marcadas P0.
- `h1n1_plano_estrategico_site.md`: portal público de referência + observatório, Brasil/pt-BR, 12 páginas P0, observatório `/dados/brasil/`, comparador, histórico, metodologia; stack Next.js + PostgreSQL + API própria + ETL com snapshots imutáveis; 10 regras de integridade (seção 10.4).

### Verificação ao vivo (2026-10-20)
| Fonte | Endpoint testado | Resultado |
|---|---|---|
| OMS FluNet | `xmart-api-public.who.int/FLUMART/VIW_FNT` (OData) | 200 · coluna `AH1N12009` · 1.739 linhas BRA desde 2009 |
| OMS FluID | `FLUMART/VIW_FID_EPI` | view existe (`VIW_FID` retorna NOT_ALLOWED) |
| SIVEP-Gripe | `s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/<ano>/INFLUD<aa>-<data>.csv` | 200 · CSV `;` · 2026: 261 MB · licença CC-BY · colunas `PCR_FLUASU`, `CLASSI_FIN`, `EVOLUCAO`, `SEM_PRI`, `SG_UF` |
| IBGE localidades/agregados | `/api/v1/localidades/estados`, `/api/v3/agregados/6579/...` | 200 |
| World Bank | `SP.POP.TOTL` BRA | 200 |
| UKHSA | `influenza_testing_positivityByWeek` | 200 · 3.933 registros |
| CDC SODA | `ymmh-divb.json` | 200 |
| OMS GHO | `ghoapi.azureedge.net/api/Indicator` | 200 (sem indicador H1N1 específico) |
| ClinicalTrials v2 | `query.cond=H1N1` | 200 |
| PubMed E-utilities | MeSH H1N1 | 200 · 19.006 artigos |
| ENA Portal | `tax_tree(114727)` | 200 |

## 1. Decisões de arquitetura

| # | Decisão | Justificativa |
|---|---|---|
| A1 | Monorepo pnpm + TypeScript (Node 24, ESM) | Um idioma para ETL, API e web; plano já aponta Next.js/TS |
| A2 | PostgreSQL como alvo; **PGlite** (Postgres embutido) para dev/testes, `pg` quando `DATABASE_URL` existir | Mesmo SQL nos dois; zero dependência de Docker para rodar e testar |
| A3 | API separada em Fastify 5 com OpenAPI gerado | "Serviço de indicadores / API pública própria" (seção 10.1); contrato versionado `/v1` |
| A4 | Conectores = `fetch → snapshot imutável (sha256, url, fetched_at, license) → normalize → load` | Orientações de ingestão do catálogo (itens 1-4) |
| A5 | Ontologia de indicadores explícita (`packages/core`) | Regras 1, 2, 3, 5 de integridade: H1N1 confirmado ≠ influenza A ≠ SRAG |
| A6 | Next.js 15 App Router + MDX com frontmatter editorial (`author`, `reviewer`, `reviewed_at`, `review_status`, `sources`) | Seções 8.5 e 11.1; páginas clínicas nascem `pending_clinical_review` e exibem isso |
| A7 | Números só via consulta determinística ao banco; nenhum número clínico/epidemiológico hard-coded em MDX | Seção 10.1 "RAG nunca é fonte da verdade" |
| A8 | Publicação de indicador bloqueada se validação falhar; API devolve última versão válida com `data_as_of` | Regra 10 |

## 2. Estrutura do repositório

```
h1n1/
├── data/sources.json            # catálogo estruturado (65 fontes) gerado a partir do .md
├── data/snapshots/              # originais baixados (gitignored)
├── docs/                        # PRD, contratos, dicionário, políticas, pesquisa de demanda
├── packages/core                # tipos, ontologia de indicadores, epiweek, catálogo
├── packages/db                  # migrações SQL + adaptador PGlite/pg
├── packages/connectors          # implementados: flunet, sivep, ibge, worldbank, ukhsa · planejados: cdc-nwss, gho, clinicaltrials, pubmed, ena
├── apps/api                     # Fastify: /v1/sources, /v1/indicators, /v1/series(.csv), /v1/snapshots, /v1/diff, /v1/freshness, /v1/geo
└── apps/web                     # Next.js: 12 páginas P0, /dados/brasil, /comparar, /historia, /dados/fontes, /dados/metodologia, /sobre/*
```

## 3. Fases e agentes

| Fase | Entrega | Executor | Validação/Revisão |
|---|---|---|---|
| F0 | Plano, scaffold, `data/sources.json`, `packages/core`, `packages/db` | orquestrador | validadores Sonnet (arquitetura, ontologia, IA do site) |
| F1 | `apps/api` (contratos + OpenAPI + testes) | agente de implementação | revisor Haiku |
| F2 | `packages/connectors` + CLI de ingestão + ingestão real FluNet/IBGE/WorldBank/SIVEP 2026 | agente de implementação | revisor Haiku |
| F3 | `apps/web` (páginas P0, observatório, comparador, histórico, metodologia, fontes) | agente de implementação | revisor Haiku + revisão de integridade |
| F4 | `docs/` PRD, contratos, dicionário de indicadores, política editorial, matriz de 150 consultas (hipóteses) | orquestrador + agente | revisor Haiku |
| F5 | Integração ponta a ponta: ingestão → API → web; testes; relatório final | orquestrador | validador final |

## 4. Critérios de aceite

- `pnpm install && pnpm build && pnpm test` verdes.
- `pnpm ingest flunet` grava snapshot com hash e carrega série `flunet_ah1n1pdm09_detections` para BRA.
- `pnpm ingest sivep --year 2026` agrega SRAG por UF/semana com separação explícita: SRAG total, influenza confirmada, A(H1N1)pdm09 confirmado, óbitos.
- API responde `/v1/series?indicator=...&geo_code=BRA` com metadados obrigatórios (fonte, definição de caso, `data_as_of`, universo, licença).
- Web renderiza homepage, 12 páginas P0 (status de revisão visível), `/dados/brasil` com dado real e texto de universo obrigatório, `/dados/fontes` com as 65 fontes.
- Nenhuma página afirma "tempo real"; nenhuma soma canais espelhados; células pequenas (<5) suprimidas em recortes por UF e faixa etária.

## 5. Estado em 2026-10-21 (após implementação, revisão e correções)

| Frente | Entregue | Observações |
|---|---|---|
| core/db | sim | 18 + 3 testes; regra da SE brasileira verificada em 4 anos de SIVEP; diff com supressão |
| api | sim | 12 rotas, OpenAPI, cache/ETag/rate limit por rota; diff restrito a país sem estrato e a snapshots `ok` |
| connectors | sim | flunet, sivep, ibge, worldbank, ukhsa; ingestão real de SIVEP 2025 e 2026 integrais; microdados brutos apagados após agregação; carry-forward entre anos |
| web | sim | 22 rotas; páginas clínicas `noindex` até revisão; exceção explícita `index_policy: index` para sinais de alerta (com banner) |
| conteúdo | em revisão | 17 páginas + fatos citados; tudo `pending_*`; sem revisor clínico |
| docs | sim | PRD, contrato, dicionário, mapeamento P0, políticas, LGPD, pesquisa de demanda (150 consultas, sem volume), backlog, 6 ADRs |

Validações de abordagem (Sonnet) antes de implementar: arquitetura/modelo de dados, ontologia epidemiológica (dicionário SIVEP + metadados FluNet), IA do site/SEO/governança. Revisões (Haiku) após implementar: API, conectores, web, docs; conteúdo clínico revisado com Sonnet. Achados graves corrigidos; pendências humanas: domínio, revisor clínico, DPO, Search Console.

## 6. Estado em 2026-10-21, v3 ("claro, forte, humano")

Após duas rodadas de feedback do usuário (v1 sóbria rejeitada; v2 escura/HUD rejeitada), o site foi reconstruído sobre o tema claro de `apps/web/DESIGN.md` v2:

| Frente | Entregue |
|---|---|
| Home | Explicador 3D em react-three-fiber: vírus A(H1N1)pdm09 procedural que se desmonta por rolagem (envelope, hemaglutinina, neuraminidase, M1, M2, 8 segmentos de RNA), capítulos "como entra", "como se espalha", "como a vacina ajuda", dados do Brasil e links; 12 fatos biológicos de Krammer et al. 2018 (Nat Rev Dis Primers) e MS; pôster SVG como fallback e og:image |
| Sala de dados (/sala/) | Globo (react-globe.gl) com FluNet global (189.651 linhas, 193 países, 2009→hoje), scrubber com replay de 2009, mapa de UFs (IBGE), EARS C1/C2/C3, nowcast com CDF de atraso do SIVEP, sobreposição de temporadas, composição FluNet, ~~Nextstrain~~ (removido em 2026-10-21, ver 6.1), console de ingestão |
| ~~Terminal e assistente~~ | **Removido em 2026-10-21 (ver 6.1).** Histórico: /terminal/ com 11 comandos e paleta ⌘K (cmdk); assistente com Claude (ai + @ai-sdk/anthropic) e 9 ferramentas sobre a API, desativado sem chave |
| API | 7 rotas de visualização/análise; índice de matriz (consulta 2,8 s → 58 ms) e cache LRU; nowcast restrito à população da CDF; sanitização de logs |
| Conectores | FluNet global particionado por ano; CDF de atraso de notificação; provisório relativo à data da base; microdados apagados após agregação |
| Testes | core 18 · db 9 · analytics 8 · api 46 · connectors 87 · web 121 |

Pendências humanas inalteradas: revisor clínico, domínio, DPO, validação quantitativa de demanda. (A "chave da Anthropic para o assistente" deixou de ser pendência: o assistente foi removido, ver 6.1.)

### 6.1 Decisão do usuário em 2026-10-21: sem terminal, sem conexão externa

"Não é pra ter terminal! Não quero conexão externa." Removidos do `apps/web`:

- **Terminal**: rota `/terminal/`, `POST /api/terminal`, `GET /api/palette`, `src/components/terminal/` (Terminal, CommandPalette), `src/lib/terminal/`, botão "Buscar ⌘K" do cabeçalho (só abria a paleta do terminal), item "Terminal" da navegação e da home, dependência `cmdk`.
- **Assistente de IA** (conexão com a API da Anthropic): `/api/chat`, `src/components/assistente/`, `src/lib/assistant/`, seção "Pergunte ao observatório" da `/sala/`, dependências `ai`, `@ai-sdk/anthropic`, `@ai-sdk/react` (e as exceções de `minimumReleaseAgeExclude` que existiam só para elas). Alinha o site de novo ao ADR-006 ("sem IA no runtime").
- **Nextstrain** (iframe de nextstrain.org): painel da `/sala/` e menções no rodapé.
- **CSP**: `connect-src 'self' <NEXT_PUBLIC_API_URL>` (+ `ws: wss:` só em dev), `frame-src 'none'`, `img-src 'self' data: blob:`, nenhum domínio externo. Um teste em `apps/web/test/sala.test.ts` varre `src/` contra iframe, URL absoluta em `fetch`/`src`/`url()` e SDK de IA.

O navegador do visitante só fala com o próprio site e com a API própria. Links `<a href>` para as fontes oficiais (licenças, catálogo de fontes) continuam: são referência, não conexão.
