# H1N1 · Documentação

Documentação de produto e engenharia do projeto H1N1 (central pública de referência e observatório de influenza A(H1N1)). Data de referência: 2026-10-20. Todos os documentos derivam de `h1n1_plano_estrategico_site.md` (v1.0) e `h1n1_catalogo_oficial.md` (65 fontes), e refletem o código em `packages/core`, `packages/db` e `apps/api`.

Convenção: onde algo depende de decisão humana (domínio, revisor clínico, DPO, contas de ferramentas), os documentos dizem **"a definir"**. Nenhum número de audiência, volume de busca ou nome de pessoa/órgão parceiro é inventado.

## Índice

| Documento | O que contém | Para quem |
|---|---|---|
| [PLANO_EXECUCAO.md](./PLANO_EXECUCAO.md) | Plano técnico derivado do plano estratégico: verificação ao vivo de 11 APIs, decisões A1–A8, estrutura do repositório, fases F0–F5, critérios de aceite | Todos |
| [PRD.md](./PRD.md) | Visão, públicos, 3 jornadas, mapa de telas e estados (carregando/indisponível/defasado/suprimido), RF-01…RF-42, requisitos não funcionais (SEO, WCAG 2.1 AA, CWV, segurança, LGPD), regras de integridade testáveis, critérios de aceite por tela, fora de escopo, riscos, métricas | Produto, engenharia, editorial |
| [CONTRATO_API.md](./CONTRATO_API.md) | Contrato `/v1`: `health, sources, sources/:id, indicators, indicators/:id, series, series.csv, freshness, snapshots, snapshots/:id, diff, geo`; exemplos `SeriesResult`; erros; cache; rate limit; versionamento; regra "`universe_note` deve ser exibida junto a qualquer número" | Engenharia, consumidores externos |
| [DICIONARIO_INDICADORES.md](./DICIONARIO_INDICADORES.md) | Os 22 indicadores de `INDICATORS` (FluNet, SIVEP, IBGE, Banco Mundial, UKHSA) com definição de caso literal, universo, estratos, supressão e caveats; grupos espelhados (`MIRROR_GROUPS`, "o que não somar"); semanas epidemiológicas BR vs MMWR vs ISO com exemplos verificados | Analistas, revisores, jornalistas |
| [MAPEAMENTO_FONTES_P0.md](./MAPEAMENTO_FONTES_P0.md) | As 19 fontes P0: endpoint real ou arquivo, formato, campos-chave H1N1, licença, cadência, estratégia (conector F2 / planejado / manual), riscos e plano para as sem conector | Engenharia de dados |
| [POLITICA_EDITORIAL.md](./POLITICA_EDITORIAL.md) | Processo de aprovação por tipo de conteúdo, hierarquia de fontes, política de IA, revisão clínica (requisitos e bloqueios), correções e changelog, conflito de interesses, publicidade e financiamento | Editorial, revisores |
| [LGPD_E_PRIVACIDADE.md](./LGPD_E_PRIVACIDADE.md) | Minimização, sem analytics no MVP, formulário/newsletter futuros, tratamento de microdados (streaming, só agregados, supressão < 5, nunca município × idade × data), retenção, base legal, DPO a definir | Responsável legal, engenharia |
| [PESQUISA_DEMANDA.md](./PESQUISA_DEMANDA.md) | Método (seção 4 do plano), matriz de 150 consultas em 24 clusters (colunas quantitativas vazias por serem hipóteses), fórmula de score e template de pontuação | Editorial, SEO |
| [BACKLOG_SPRINTS.md](./BACKLOG_SPRINTS.md) | Roadmap de 90 dias em 6 sprints de 2 semanas, com histórias, critérios de aceite, dependências e estado (entregue na fundação / em andamento / pendente / humano) | Gestão, engenharia |
| [ADR/](./ADR/) | Decisões de arquitetura em formato ADR | Engenharia |

## ADRs

| ADR | Decisão | Cobre |
|---|---|---|
| [ADR-001](./ADR/ADR-001-stack.md) | Monorepo pnpm + TypeScript (Node ≥ 22, ESM) | A1 |
| [ADR-002](./ADR/ADR-002-banco-pglite-postgres.md) | PostgreSQL alvo; PGlite em dev/teste; `stratum_key` em texto; `indicator_publications`; `facts` separada | A2 |
| [ADR-003](./ADR/ADR-003-api-fastify-vs-route-handlers.md) | Fastify separado com lógica em `packages/db`; dissidência (Route Handlers do Next.js) registrada e rota de reversão definida | A3 |
| [ADR-004](./ADR/ADR-004-conectores-snapshots.md) | Conectores `fetch → snapshot imutável → normalize → load → validate/publish` | A4 |
| [ADR-005](./ADR/ADR-005-ontologia-indicadores-publicacao.md) | Ontologia explícita, `MIRROR_GROUPS`, três convenções de semana, supressão na publicação, publicação bloqueada por validação | A5, A8 |
| [ADR-006](./ADR/ADR-006-web-nextjs-mdx-numeros-do-banco.md) | Next.js 15 + MDX com frontmatter editorial; `noindex` até revisão; números só do banco; JSON-LD restrito | A6, A7 |

## Regras que todos os documentos compartilham

1. H1N1 confirmado ≠ influenza A não subtipada ≠ SRAG ≠ síndrome gripal ≠ dose de vacina.
2. Todo número vem do banco versionado e é exibido com `universe_note`, definição de caso, `data_as_of` e fonte.
3. Rótulos: "SRAG com A(H1N1)pdm09 confirmada"; "óbitos entre SRAG com H1N1 confirmado". Nunca "casos de H1N1" para SRAG, nunca "mortes por H1N1", nunca "tempo real".
4. Páginas clínicas nascem `noindex`, fora do sitemap e da navegação, até revisão por profissional habilitado (a definir).
5. Supressão < 5 em recortes por UF e faixa etária, com supressão complementar; totais nacionais não suprimidos; nunca município.
6. Fontes do mesmo `mirror_group` não se somam.
7. Semana BR (domingo–sábado; SE 1 contém 1º/jan quando cai de domingo a quinta) ≠ MMWR (4 dias) ≠ ISO (segunda–domingo); converter só por data.

## Manutenção

- Alterou `packages/core/src/indicators.ts` ou `epiweek.ts`? Atualize DICIONARIO_INDICADORES.md.
- Alterou rotas, parâmetros ou formato em `apps/api` ou `packages/db/src/queries.ts`? Atualize CONTRATO_API.md e siga a política de compatibilidade (§6).
- Nova fonte com conector? Atualize MAPEAMENTO_FONTES_P0.md (se P0) e o catálogo `data/sources.json`.
- Nova decisão de arquitetura? Novo ADR numerado; não edite decisões aceitas, substitua-as com "superada por ADR-00X".
- `docs/PLANO_EXECUCAO.md` é mantido pelo orquestrador do projeto.
