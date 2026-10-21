# H1N1 · Backlog por sprint (roadmap de 90 dias)

**Versão:** 1.0 · **Data:** 2026-10-20 · **Deriva de:** seção 14 do plano estratégico (dias 1–15, 16–30, 31–60, 61–90) convertida em 6 sprints de 2 semanas (84 dias; a semana restante é folga de estabilização). Sprint 1 começa em 2026-10-20 (dia 1).

Legenda de estado:

- **Entregue (fundação)** — concluído na fase F0/F1 de `docs/PLANO_EXECUCAO.md` antes deste backlog.
- **Em andamento** — fase F2/F3/F4 em execução paralela (conectores, web, docs).
- **Pendente** — não iniciado.
- **Humano** — depende de decisão ou ação humana (domínio, revisor, DPO, contas).

Prioridade de história: P0 (bloqueia o critério de avanço do sprint), P1, P2.

---

## 0. Estado da fundação técnica (antes do Sprint 1)

| Componente | Estado | Evidência |
|---|---|---|
| Plano de execução, decisões A1–A8 | Entregue | `docs/PLANO_EXECUCAO.md`, `docs/ADR/` |
| `data/sources.json` (65 fontes, 19 P0) | Entregue | Validado por `parseCatalog` |
| `packages/core` (tipos, 22 indicadores, `MIRROR_GROUPS`, epiweek BR/MMWR/ISO, supressão, catálogo, geo) | Entregue | `packages/core/src/*` |
| `packages/db` (migração `0001_init.sql`, adaptador PGlite/pg, consultas, seed, publicação atômica, diff) | Entregue | `packages/db/src/*` |
| `apps/api` (Fastify, rotas `/health`, `/v1/*`, OpenAPI, CSV, erros padronizados) | Entregue; testes em andamento | `apps/api/src/routes/*`; `apps/api/test/` vazio em 2026-10-20 |
| `packages/connectors` (flunet, sivep, ibge, worldbank, ukhsa, cdc-nwss, gho, clinicaltrials, pubmed, ena) | Em andamento (F2) | `packages/connectors/src/` vazio em 2026-10-20 |
| `apps/web` (Next.js, páginas P0, observatório, catálogo, metodologia, sobre) | Em andamento (F3) | `apps/web` ausente em 2026-10-20 |
| Conteúdo das 12 páginas P0 | Em andamento; clínicas `pending_clinical_review` | — |
| Documentação (PRD, contrato, dicionário, políticas, demanda, ADRs) | Entregue (F4) | `docs/` |
| Verificação ao vivo de 11 APIs/arquivos | Entregue | `docs/PLANO_EXECUCAO.md`, tabela de 2026-10-20 |

---

## Sprint 1 · Dias 1–14 · Validação de mercado e governança

**Objetivo (plano, dias 1–15):** temas P0 selecionados com evidência e revisor definido.

| ID | História | Prioridade | Estado | Critérios de aceite | Dependências |
|---|---|---|---|---|---|
| S1-01 | Como responsável, quero confirmar nome, domínio e entidade jurídica para que o site tenha identidade estável | P0 | Humano | Domínio registrado; entidade responsável definida; e-mail institucional criado; campos "a definir" nos docs atualizados | — |
| S1-02 | Como editor, quero formalizar revisor(a) clínico(a)/epidemiológico(a) para desbloquear páginas clínicas | P0 | Humano | Acordo por escrito; nome, registro e declaração de conflitos; critérios da POLITICA_EDITORIAL §4 atendidos | S1-01 |
| S1-03 | Como editor, quero a matriz de 150 consultas em 24 clusters para publicar por intenção | P0 | Entregue (hipóteses) | `docs/PESQUISA_DEMANDA.md` com 150 linhas e colunas quantitativas vazias | — |
| S1-04 | Como editor, quero preencher volume/tendência/SERP/concorrentes para as 150 consultas | P0 | Pendente (Humano: contas Trends/Keyword Planner) | Colunas preenchidas com fonte e data; score calculado por intenção com o template §3.1 | S1-03 |
| S1-05 | Como editor, quero analisar manualmente as SERPs de 30 intenções (mobile e desktop) | P0 | Pendente | Planilha com posições, features, lacunas; nota S justificada | S1-04 |
| S1-06 | Como PM, quero definir as 12 páginas P0 com público e proposta de valor | P0 | Entregue | PRD §4.1 e §8; seção 9 do plano | — |
| S1-07 | Como engenheiro, quero testar download, permissão e dicionário de 2 fontes do MVP | P0 | Entregue | SIVEP (`INFLUD26-19-10-2026.csv`, CC-BY, dicionário PDF) e FluNet (OData `VIW_FNT`) verificados em 2026-10-20 | — |
| S1-08 | Como editor, quero as políticas editorial, de correções, de IA e de publicidade redigidas | P0 | Entregue | `docs/POLITICA_EDITORIAL.md`; páginas `/sobre/*` derivadas | — |
| S1-09 | Como responsável, quero definir a medição do projeto sem analytics | P1 | Entregue (decisão) / Humano (Search Console) | PRD §11; propriedade no Search Console criada após domínio | S1-01 |
| S1-10 | Como responsável LGPD, quero designar DPO e canal de titulares | P1 | Humano | `LGPD_E_PRIVACIDADE.md` sem "a definir" no DPO | S1-01 |
| S1-11 | Como engenheiro, quero testes de contrato da API (`apps/api/test`) | P0 | Em andamento | Testes para 400/404, série vazia, supressão no JSON e CSV, snapshot `superseded` não servida | fundação |
| S1-12 | Como engenheiro, quero o conector `sivep` com parse em streaming e agregação por UF × SE × faixa | P0 | Em andamento (F2) | `pnpm ingest sivep --year 2026` grava snapshot com sha256 e publica os 9 indicadores com validação; nenhuma linha individual no banco | fundação |
| S1-13 | Como engenheiro, quero o conector `flunet` | P0 | Em andamento (F2) | `pnpm ingest flunet` publica os 10 indicadores para BRA | fundação |

**Critério de avanço:** S1-02 e S1-04 concluídos, ou decisão explícita de lançar sem páginas clínicas indexadas (PRD §10, risco 1).

---

## Sprint 2 · Dias 15–28 · Produto-base e prova técnica

**Objetivo (plano, dias 16–30):** site utilizável por visitante leigo e dado reproduzível.

| ID | História | Prioridade | Estado | Critérios de aceite | Dependências |
|---|---|---|---|---|---|
| S2-01 | Como visitante mobile, quero um design system acessível para ler a resposta acima da dobra | P0 | Em andamento (F3) | Tokens, tipografia, componentes base; axe sem violações críticas; contraste AA; alvos 44 px | — |
| S2-02 | Como visitante, quero a homepage com duas portas e bloco "H1N1 no Brasil" com estados | P0 | Em andamento (F3) | PRD §4.2: normal/defasado/indisponível testados; texto de universo literal; sem "tempo real" | S1-12, S2-05 |
| S2-03 | Como visitante, quero páginas de referência não clínicas publicadas (`/o-que-e-h1n1/`, `/transmissao/`, `/historia/`, `/sintomas/sinais-de-alerta/`) | P0 | Em andamento (F3/conteúdo) | Template de resposta (PRD §4.3); frontmatter completo; sinais de alerta com citação literal; `facts.json` para história | — |
| S2-04 | Como editor, quero as páginas clínicas em `pending_clinical_review` com noindex testado em CI | P0 | Em andamento | Teste de CI falha se página não revisada aparecer no sitemap ou sem `noindex`; navegação não as lista | S2-03 |
| S2-05 | Como engenheiro, quero o pipeline SIVEP com histórico versionado em produção | P0 | Em andamento (F2) | Duas ingestões em datas diferentes geram duas snapshots; `/v1/diff` funciona; publicação atômica | S1-12 |
| S2-06 | Como visitante, quero uma visualização mínima do observatório com metodologia visível | P0 | Em andamento (F3) | Um gráfico de `sivep_srag_ah1n1pdm09_confirmed` nacional com tabela, universo, `data_as_of`, link para metodologia | S2-05 |
| S2-07 | Como SEO técnico, quero sitemap, canonicals, metadados e JSON-LD base | P0 | Pendente | `Organization`, `WebSite`, `BreadcrumbList`; sitemap só com páginas publicáveis; `robots.txt`; sem FAQPage | S2-03 |
| S2-08 | Como responsável, quero Search Console configurado | P1 | Humano | Propriedade verificada; sitemap enviado | S1-01 |
| S2-09 | Como visitante, quero `/sobre/*` e `/dados/fontes/` publicados | P0 | Em andamento (F3) | 65 fontes com `mirror_group`; equipe/revisão com texto de autoria oficial; correções vazia mas funcional | — |
| S2-10 | Como engenheiro, quero cabeçalhos de cache e rate limit na API | P1 | Pendente | CONTRATO_API §4 e §5 implementados; 429 com cabeçalhos `RateLimit-*` | — |
| S2-11 | Como engenheiro, quero conectores `ibge`, `worldbank`, `ukhsa` | P1 | Em andamento (F2) | Indicadores de denominador e UKHSA publicados | — |

**Critério de avanço:** home + 4 páginas não clínicas + observatório mínimo no ar em domínio de staging, com dado SIVEP real e reproduzível.

---

## Sprint 3 · Dias 29–42 · Cobertura do MVP (parte 1)

**Objetivo (plano, dias 31–60, metade 1):** completar páginas P0 e lançar o observatório Brasil.

| ID | História | Prioridade | Estado | Critérios de aceite | Dependências |
|---|---|---|---|---|---|
| S3-01 | Como editor, quero as 12 páginas P0 escritas e checadas (clínicas aguardando revisor) | P0 | Em andamento | Todas com frontmatter, fontes, template; checagem de fonte registrada | S2-03 |
| S3-02 | Como revisor clínico, quero revisar o primeiro lote (sintomas, sintomas/criancas, prevencao, vacina) | P0 | Humano | Registros de revisão; páginas aprovadas mudam para `reviewed` e entram no sitemap | S1-02, S3-01 |
| S3-03 | Como visitante, quero o observatório Brasil completo com filtros e estados | P0 | Pendente | PRD §4.4: 6 indicadores separados, UF, faixa etária, provisório, suprimido "< 5", indisponível, defasado, download CSV, tabela equivalente | S2-06 |
| S3-04 | Como jornalista, quero o alerta de frescor e a data da base em toda tela com número | P0 | Pendente | RF-17; limites por fonte (SIVEP 14 d, FluNet 21 d) | S3-03 |
| S3-05 | Como visitante, quero os comparadores (`/comparar/*`) com limites clínicos | P0 | Pendente (`noindex` até revisão) | Quadro de sobreposição; sem probabilidade; sem diagnóstico; frase "só teste diferencia" | S3-02 |
| S3-06 | Como visitante, quero `/dados/metodologia/` gerada a partir da API | P0 | Pendente | RF-23/24; dicionário igual a `/v1/indicators`; três convenções de semana com exemplos | — |
| S3-07 | Como engenheiro, quero corrigir `/v1/diff` para aplicar supressão antes de responder | P0 | Pendente | CONTRATO_API §3.11; teste com célula < 5 em UF não aparece no diff | — |
| S3-08 | Como engenheiro, quero lint de conteúdo (números hard-coded, "tempo real", "mortes por H1N1", "casos de H1N1") | P0 | Pendente | CI falha nos quatro padrões; exceção para `facts` | — |
| S3-09 | Como operador, quero alertas de ingestão falha e de frescor | P1 | Pendente | RNF-OPS-03; notificação em duas falhas consecutivas ou `age_days` acima do limite | S2-05 |

**Critério de avanço:** observatório Brasil com dado real, estados e CSV; 12 páginas escritas; lint ativo.

---

## Sprint 4 · Dias 43–56 · Cobertura do MVP (parte 2) e primeiro estudo

**Objetivo (plano, dias 31–60, metade 2):** a plataforma resolve tarefas, em vez de apenas apresentar textos.

| ID | História | Prioridade | Estado | Critérios de aceite | Dependências |
|---|---|---|---|---|---|
| S4-01 | Como analista, quero publicar 1 pesquisa original reproduzível (candidatas: R03 distribuição etária entre SRAG com H1N1; R07 revisões entre snapshots) | P0 | Pendente | Página `/pesquisas/[slug]/` com resumo, gráfico, hipótese, método, recorte, limitações, tabela, versão do dataset, data; código reproduzível; revisão metodológica; `Dataset` JSON-LD | S3-03, S3-07 |
| S4-02 | Como escola, quero 1 material de distribuição (`/materiais/escolas/`) | P0 | Pendente (`noindex` até revisão) | Cartaz com orientação oficial citada, mensagem para pais, checklist não alarmista, HTML acessível, data | S3-02 |
| S4-03 | Como PM, quero testes de desempenho, acessibilidade e usabilidade com usuários reais | P0 | Pendente / Humano | Lighthouse mobile dentro dos orçamentos; axe limpo; 5 sessões de usabilidade com tarefas (achar sinais de alerta; ler número com data; baixar CSV) | S3-03 |
| S4-04 | Como editor, quero revisão semanal do Search Console instituída | P1 | Humano | Ritual documentado; primeiras impressões por cluster registradas | S2-08 |
| S4-05 | Como revisor, quero revisar o segundo lote (comparadores, materiais) | P0 | Humano | Páginas aprovadas → `reviewed` | S1-02, S3-05, S4-02 |
| S4-06 | Como engenheiro, quero conectores `pubmed`, `clinicaltrials`, `ena` (metadados) | P2 | Em andamento (F2) | Snapshots registradas; sem indicador epidemiológico derivado | — |
| S4-07 | Como visitante, quero `/historia/` com marcos metodológicos e fatos verificados | P1 | Pendente | Todos os fatos de `facts` com fonte e citação; marcos de mudança de sistema (SINAN → SIVEP) sinalizados | S2-03 |

**Critério de avanço:** 1 estudo publicado e auditável até o dia 60; 1 material; testes com usuários realizados; páginas clínicas do lote 1 indexadas se houver revisor.

---

## Sprint 5 · Dias 57–70 · Distribuição e integração internacional

**Objetivo (plano, dias 61–90, metade 1):** primeiros sinais de descoberta orgânica e pautas com dado.

| ID | História | Prioridade | Estado | Critérios de aceite | Dependências |
|---|---|---|---|---|---|
| S5-01 | Como visitante, quero `/dados/mundo/` com FluNet (semana ISO) e aviso de comparabilidade | P1 | Pendente | 10 indicadores FluNet para BRA e países selecionados; universo FluNet literal; nunca sobreposto ao SIVEP sem conversão por data | S1-13 |
| S5-02 | Como analista, quero 1–2 pesquisas adicionais, se a qualidade permitir | P1 | Pendente | Mesmos critérios de S4-01 | S4-01 |
| S5-03 | Como editor, quero enviar 1–2 pautas com dado original a veículos e parceiros | P1 | Humano | Pauta com gráfico, método, limitações e texto de citação; registro de envios e respostas | S4-01 |
| S5-04 | Como engenheiro, quero o conector FluID (`VIW_FID_EPI`) inspecionado e, se viável, ingerido | P2 | Pendente | Esquema registrado em snapshot; decisão documentada | S1-13 |
| S5-05 | Como visitante, quero gráficos incorporáveis com atribuição | P2 | Pendente | Embed estático (SVG/PNG) com fonte, data e link; sem script de terceiros | S3-03 |
| S5-06 | Como engenheiro, quero medir revisões retrospectivas (R07) com `/v1/diff` em todas as ingestões | P1 | Pendente | Relatório por ingestão com nº de células alteradas e magnitude; exibido na metodologia | S3-07 |
| S5-07 | Como operador, quero a política de retenção de snapshots implementada | P1 | Pendente | Job de limpeza conforme LGPD §6; `snapshots.notes` registra eliminação | S2-05 |

**Critério de avanço:** `/dados/mundo/` publicado; pelo menos 1 pauta enviada; relatório de revisões disponível.

---

## Sprint 6 · Dias 71–84 · Otimização e decisões de expansão

**Objetivo (plano, dias 61–90, metade 2):** uso recorrente com confiabilidade operacional; decisões P1 baseadas em evidência.

| ID | História | Prioridade | Estado | Critérios de aceite | Dependências |
|---|---|---|---|---|---|
| S6-01 | Como editor, quero revisar titles, descriptions, UX e links internos com impressões reais | P0 | Humano | Para cada cluster com impressões: CTR e posição registrados; ajustes aplicados sem alterar `reviewed_at` | S4-04 |
| S6-02 | Como editor, quero decidir sobre `/boletins/` (atualização semanal/quinzenal só com mudança real) | P1 | Humano | Decisão documentada; se sim, template de 5 blocos (plano 5.6) e primeira edição | S5-06 |
| S6-03 | Como PM, quero definir a expansão P1 com base em resultados (tabela de decisão, plano §16) | P0 | Humano | Documento de decisão por cluster: expandir / rever / reestruturar / restringir | S6-01 |
| S6-04 | Como responsável, quero decisões documentadas sobre newsletter, API pública e novos países | P1 | Humano | Três ADRs ou notas de decisão em `docs/ADR/` | S6-03 |
| S6-05 | Como engenheiro, quero a revisão de 90 dias de operação (frescor, falhas, publicações rejeitadas) | P1 | Pendente | Relatório com `age_days` médio por indicador, falhas, tempo de correção | S3-09 |
| S6-06 | Como visitante, quero `/materiais/empresas/` e `/comparar/influenza-a-vs-b/` se houver revisão | P2 | Pendente | Mesmos critérios de S4-02 e S3-05 | S4-05 |
| S6-07 | Como engenheiro, quero preparar `/tratamento/` tecnicamente (rota, template) sem publicar | P2 | Pendente | Rota existe em `draft`; não é construída; decisão de publicação exige revisão médica formal | S1-02 |

**Critério de avanço:** decisões de expansão registradas; primeiros sinais de descoberta orgânica medidos; nenhum indicador P0 com `age_days` acima do limite sem alerta nos últimos 30 dias.

---

## Dependências transversais

| Dependência | Bloqueia | Responsável |
|---|---|---|
| Revisor clínico (S1-02) | Indexação de todas as páginas clínicas, comparadores, materiais, pesquisas com conclusão de saúde | Humano |
| Domínio e entidade (S1-01) | Search Console, e-mail, JSON-LD `Organization`, política de privacidade | Humano |
| Contas Trends/Keyword Planner (S1-04) | Score de priorização, análise de SERP, decisões do Sprint 6 | Humano |
| Conector SIVEP (S1-12) | Home, observatório, pesquisa R03/R07 | Engenharia (F2) |
| Correção de supressão no diff (S3-07) | Pesquisa R07, relatório de revisões | Engenharia |
| DPO (S1-10) | Base legal confirmada para microdados; página de privacidade final | Humano |

## O que não entra nos 90 dias

Newsletter, analytics, formulário de contato, `/tratamento/` publicado, páginas municipais, versões em outros idiomas, API premium, chatbot, conectores de SINAN 2009–2018, SIM, PNI, FluView, FluWatch+, ERVISS, NNDSS, México e China (ver MAPEAMENTO_FONTES_P0 §3).
