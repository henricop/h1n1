# H1N1 · Documentação

Documentação de produto e engenharia do projeto H1N1 (central pública de referência e observatório de influenza A(H1N1)). Data de referência: 2026-10-21 (estado após implementação, revisão e correções; `docs/PLANO_EXECUCAO.md` §5). Todos os documentos derivam de `h1n1_plano_estrategico_site.md` (v1.0) e `h1n1_catalogo_oficial.md` (65 fontes), e refletem o código em `packages/core`, `packages/db`, `packages/connectors`, `apps/api` e `apps/web`. Onde um texto de especificação divergir do código, o código prevalece.

Convenção: onde algo depende de decisão humana (domínio, revisor clínico, DPO, contas de ferramentas), os documentos dizem **"a definir"**. Nenhum número de audiência, volume de busca ou nome de pessoa/órgão parceiro é inventado.

## Índice

| Documento | O que contém | Para quem |
|---|---|---|
| [PLANO_EXECUCAO.md](./PLANO_EXECUCAO.md) | Plano técnico derivado do plano estratégico: verificação ao vivo de 11 APIs, decisões A1–A8, estrutura do repositório, fases F0–F5, critérios de aceite e estado de implementação (§5) | Todos |
| [PRD.md](./PRD.md) | Visão, públicos, 3 jornadas, mapa de telas e estados (carregando/indisponível/defasado/suprimido), RF-01…RF-42, requisitos não funcionais (SEO, WCAG 2.1 AA, CWV, segurança, LGPD), regras de integridade testáveis, critérios de aceite por tela, fora de escopo, riscos, métricas | Produto, engenharia, editorial |
| [CONTRATO_API.md](./CONTRATO_API.md) | Contrato `/v1`: `health, sources, sources/:id, indicators, indicators/:id, series, series.csv, freshness, snapshots, snapshots/:id, diff, geo`; exemplos `SeriesResult`; erros; cache por rota e ETag; rate limit (120/min e 20/min no CSV); `/v1/diff` restrito a país sem estrato; versionamento; regra "`universe_note` deve ser exibida junto a qualquer número" | Engenharia, consumidores externos |
| [DICIONARIO_INDICADORES.md](./DICIONARIO_INDICADORES.md) | Os 22 indicadores de `INDICATORS` (FluNet, SIVEP, IBGE, Banco Mundial, UKHSA) com definição de caso literal, universo, estratos, supressão e caveats; regra de `provisional` por fonte e `quality_flags` reais; grupos espelhados (`MIRROR_GROUPS`, "o que não somar"); semanas epidemiológicas BR vs MMWR vs ISO com exemplos verificados | Analistas, revisores, jornalistas |
| [MAPEAMENTO_FONTES_P0.md](./MAPEAMENTO_FONTES_P0.md) | As 19 fontes P0: endpoint real ou arquivo, formato, campos-chave H1N1, licença, cadência, estratégia (conector implementado em 3 delas: BR-03, INT-01, UK-01; as demais planejadas ou manuais), os conectores não P0 (BR-14, INT-11), riscos e plano para as sem conector | Engenharia de dados |
| [POLITICA_EDITORIAL.md](./POLITICA_EDITORIAL.md) | Processo de aprovação por tipo de conteúdo, hierarquia de fontes, política de IA, revisão clínica (requisitos e bloqueios), correções e changelog, conflito de interesses, publicidade e financiamento | Editorial, revisores |
| [LGPD_E_PRIVACIDADE.md](./LGPD_E_PRIVACIDADE.md) | Minimização, sem analytics no MVP, formulário/newsletter futuros, tratamento de microdados (streaming, só agregados, supressão < 5, nunca município × idade × data), retenção, base legal, DPO a definir | Responsável legal, engenharia |
| [PESQUISA_DEMANDA.md](./PESQUISA_DEMANDA.md) | Método (seção 4 do plano), matriz de 150 consultas em 24 clusters (colunas quantitativas vazias por serem hipóteses), fórmula de score e template de pontuação | Editorial, SEO |
| [BACKLOG_SPRINTS.md](./BACKLOG_SPRINTS.md) | Roadmap de 90 dias em 6 sprints de 2 semanas, com histórias, critérios de aceite, dependências e estado real (entregue / em andamento / pendente / humano), contagem de testes por pacote | Gestão, engenharia |
| [ADR/](./ADR/) | Decisões de arquitetura em formato ADR | Engenharia |

## ADRs

| ADR | Decisão | Cobre |
|---|---|---|
| [ADR-001](./ADR/ADR-001-stack.md) | Monorepo pnpm + TypeScript (Node ≥ 22 no `engines`; CI em Node 24; ESM) | A1 |
| [ADR-002](./ADR/ADR-002-banco-pglite-postgres.md) | PostgreSQL alvo; PGlite em dev/teste; `stratum_key` em texto; `indicator_publications`; `facts` separada | A2 |
| [ADR-003](./ADR/ADR-003-api-fastify-vs-route-handlers.md) | Fastify separado com lógica em `packages/db`; cache por rota, ETag/304 e rate limit implementados; dissidência (Route Handlers do Next.js) registrada e rota de reversão definida | A3 |
| [ADR-004](./ADR/ADR-004-conectores-snapshots.md) | Conectores `fetch → snapshot imutável → normalize → load → validate/publish`; validação com invariantes cruzadas; snapshot nasce `quarantined`; carry-forward; bruto de microdados apagado; pendentes: `schema_changed`, conector `manual` | A4 |
| [ADR-005](./ADR/ADR-005-ontologia-indicadores-publicacao.md) | Ontologia explícita, `MIRROR_GROUPS`, três convenções de semana, supressão na publicação (complementar sobre o grupo completo), publicação bloqueada por validação, lint de cópia parcial | A5, A8 |
| [ADR-006](./ADR/ADR-006-web-nextjs-mdx-numeros-do-banco.md) | Next.js 15 + MDX com frontmatter editorial; `noindex` conforme `index_policy` (exceção `index`); ISR de 1 h; números só do banco; JSON-LD restrito (`Dataset` só no observatório) | A6, A7 |

## Regras que todos os documentos compartilham

1. H1N1 confirmado ≠ influenza A não subtipada ≠ SRAG ≠ síndrome gripal ≠ dose de vacina.
2. Todo número vem do banco versionado e é exibido com `universe_note`, definição de caso, `data_as_of` e fonte.
3. Rótulos: "SRAG com A(H1N1)pdm09 confirmada"; "óbitos entre SRAG com H1N1 confirmado". Nunca "casos de H1N1" para SRAG, nunca "mortes por H1N1", nunca "tempo real".
4. Páginas com `index_policy: noindex_until_reviewed` são `noindex`, fora do sitemap e da navegação, até revisão por profissional habilitado (a definir). Exceção explícita: `index_policy: index` (hoje, entre as clínicas, só `/sintomas/sinais-de-alerta/`) é indexável sem revisão e exibe o banner de revisão; `clinical` controla o banner e o aviso, não a indexação.
5. Supressão < 5 em recortes por UF e faixa etária, com supressão complementar; totais nacionais não suprimidos; nunca município.
6. Fontes do mesmo `mirror_group` não se somam.
7. Semana BR (domingo–sábado; SE 1 contém 1º/jan quando cai de domingo a quinta) ≠ MMWR (4 dias) ≠ ISO (segunda–domingo); converter só por data.

## Estado atual (2026-10-21)

Testes (`pnpm test`, PGlite): **165 no total**: `core` 18, `db` 3 (também rodam contra PostgreSQL 16 no CI), `api` 20, `connectors` 70, `web` 54.

| Frente | Estado |
|---|---|
| `packages/core`, `packages/db` | Implementados (22 indicadores; publicação atômica; diff restrito) |
| `apps/api` | 12 rotas + OpenAPI; cache por rota, ETag/304, rate limit |
| `packages/connectors` | Implementados: `flunet`, `sivep`, `ibge`, `worldbank`, `ukhsa`. Pendentes: `cdc-nwss`, `gho`, `clinicaltrials`, `pubmed`, `ena` |
| `apps/web` | Home, páginas MDX, `/dados/brasil/`, `/dados/fontes/`, `/dados/metodologia/`, `/sobre/*`; conteúdo todo `pending_*` (sem revisor clínico) |
| Pendências conhecidas | `schema_changed` e conector `manual`; `data_as_of` obrigatório na publicação; lint de "mortes por H1N1", "casos de H1N1" e números hard-coded; revalidação ISR por evento; teste de rotas construídas para `noindex`; limites de defasagem por fonte na web; alertas de ingestão (S3-09); retenção de snapshots (S5-07) |
| Humanas | domínio, revisor clínico, DPO, Search Console |

## Comportamento operacional (lacunas documentadas)

**Carry-forward entre anos.** Fontes por arquivo anual (SIVEP 2025 e 2026) compõem uma única série vigente: ao publicar, o pipeline copia para a nova snapshot as observações da publicação vigente cujo período está **fora da cobertura** declarada pelo conector, marcando-as com `quality_flags: ['carried_forward']`. Portanto uma snapshot vigente pode conter observações de anos anteriores, e a queda abrupta é medida só dentro da cobertura. O `data_as_of` da publicação nunca retrocede (máximo entre a nova e a vigente).

**Frescor é da fonte, não do indicador.** `/v1/freshness` calcula `age_days` a partir do `fetched_at` da snapshot vigente do indicador (não de `data_as_of`), e `last_run_status`/`last_run_finished_at` vêm da **última execução de ingestão da fonte** (`ingestion_runs` por `source_id`, de qualquer status), não de uma execução específica do indicador. Todos os indicadores de uma fonte compartilham a mesma última execução; uma execução recente não prova que o dado de um indicador específico avançou (use `data_as_of`).

**Geografia se expande sozinha.** A tabela `geo` nasce do seed (`seedAll`: mundo, Brasil, UFs e os países iniciais). Os conectores `flunet` e `worldbank` declaram os países que encontram (`ensureGeo`) e o pipeline os insere/atualiza em `geo` antes da validação, de modo que `--country` com ISO3 novo não exige alterar o seed. Códigos desconhecidos fora desse caminho reprovam a validação (`geo_code` inexistente).

**Pipeline de CI** (`.github/workflows/ci.yml`, em todo push e pull request): Node 24 e pnpm; `pnpm install --frozen-lockfile`; build dos pacotes (`./packages/**`); `pnpm test` com PGlite (padrão); em seguida os testes de `@h1n1/db` contra **PostgreSQL 16** (serviço do job, `DATABASE_URL`); por fim, build dos apps (`./apps/**`) com `H1N1_API_MOCK=1`, para o build da web passar sem API no ar. Não há deploy, lint nem teste de rotas construídas no CI.

**Defasagem na web.** Há **um único limite**: 14 dias (`STALE_AFTER_DAYS`), para todas as fontes; "Dado defasado" aparece com `age_days > 14` (14 não é defasado, 15 é). Quando `/v1/freshness` falha, a web não esconde o selo: mostra a nota **"frescor não verificado"** ao lado do valor (cards, `<Indicador>` e observatório). Limites por fonte (ex.: FluNet 21 dias, descritos em CONTRATO_API §3.8 como diretriz de UI) não estão implementados na web.

## Manutenção

- Alterou `packages/core/src/indicators.ts` ou `epiweek.ts`? Atualize DICIONARIO_INDICADORES.md.
- Alterou rotas, parâmetros ou formato em `apps/api` ou `packages/db/src/queries.ts`? Atualize CONTRATO_API.md e siga a política de compatibilidade (§6).
- Nova fonte com conector? Atualize MAPEAMENTO_FONTES_P0.md (se P0) e o catálogo `data/sources.json`.
- Nova decisão de arquitetura? Novo ADR numerado; não edite decisões aceitas, substitua-as com "superada por ADR-00X".
- `docs/PLANO_EXECUCAO.md` é mantido pelo orquestrador do projeto.
