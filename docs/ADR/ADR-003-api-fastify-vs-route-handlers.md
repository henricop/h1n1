# ADR-003 · API pública separada em Fastify 5, com lógica de consulta em `packages/db`

**Status:** aceita, com dissidência registrada · **Data:** 2026-10-20 · **Decisão do plano de execução:** A3 · **Relacionadas:** ADR-001, ADR-002, ADR-006

## Contexto

O plano (10.1) prevê um "serviço de indicadores / API pública própria / cache" entre o banco e o site, e lista como P2 "downloads estruturados e API própria" e, na monetização, "API premium de indicadores normalizados". O site é Next.js (ADR-006), que também poderia expor endpoints via Route Handlers do App Router.

Na validação de arquitetura de 2026-10-20, um validador **dissentiu** da API separada: para um MVP com uma equipe pequena, Route Handlers do Next.js evitariam um segundo processo, um segundo deploy, CORS e duplicação de esquemas; a API "pública" poderia nascer dentro do site e ser extraída depois, se houvesse demanda.

## Decisão

Manter **Fastify 5** em `apps/api`, com contrato `/v1` (CONTRATO_API.md) e OpenAPI gerado, **e** manter toda a lógica de consulta, supressão e publicação em `packages/db` + `packages/core`, de modo que a borda HTTP seja fina e substituível.

Regras que tornam a decisão reversível:

1. Nenhuma regra de negócio vive em `apps/api`: rotas apenas validam parâmetros (zod em `schemas.ts`), chamam `getSeries`, `getFreshness`, `diffSnapshots` etc. e serializam (`csv.ts`).
2. `SeriesResult` e demais tipos de resposta são definidos em `packages/db`, não na API.
3. `apps/web` consome a API **somente por HTTP** (cliente tipado em `src/lib/api.ts`, com modo mock por fixtures) e hoje não depende de `@h1n1/db`; importar `packages/db` diretamente em build continua possível se a latência justificar, pois o formato é o mesmo.
4. Se a dissidência se confirmar (custo operacional sem uso externo da API após 90 dias), a migração para Route Handlers é: criar `apps/web/app/v1/*/route.ts` chamando as mesmas funções de `packages/db`, apontar o domínio da API para o site, desligar `apps/api`. Sem reescrever consultas, supressão ou contrato.

## Estado de implementação (verificado em `apps/api/src/app.ts` e `apps/api/README.md`)

Cache, rate limit e ETag **estão implementados** (não são mais apenas especificação):

- **Cache por rota** (`config.cache` em cada rota; `Cache-Control` só em respostas 200 de `GET`/`HEAD`): `/health` `no-store`; `/v1/sources*`, `/v1/indicators*`, `/v1/geo` `public, max-age=3600, stale-while-revalidate=86400`; `/v1/freshness` `public, max-age=60`; `/v1/series` e `/v1/series.csv` `public, max-age=300, stale-while-revalidate=3600`; `/v1/snapshots*` e `/v1/diff` `public, max-age=300`. Respostas 4xx/5xx não levam `Cache-Control`.
- **ETag/304**: `/v1/series` e `/v1/series.csv` calculam ETag forte (sha256 truncado do corpo) e respondem `304` a `If-None-Match` (lista, `W/` ou `*`).
- **Rate limit** por IP, em memória, janela de 1 minuto: **120/min** para JSON e **20/min** para `/v1/series.csv` (contadores separados), com cabeçalhos `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (draft IETF) e `Retry-After` no `429` (`rate_limited`). Configurável por `API_RATE_LIMIT`, `API_RATE_LIMIT_MAX`, `API_CSV_RATE_LIMIT_MAX`; `TRUST_PROXY` só atrás de proxy reverso.
- **Contrato**: `/v1/diff` restrito ao total nacional sem estrato e a snapshots `ok`; supressão complementar calculada sobre o grupo completo mesmo em consulta por estrato (ver ADR-005). A suíte da API tem 20 testes.

## Alternativas consideradas

| Alternativa | Prós | Contras | Resultado |
|---|---|---|---|
| **Route Handlers do Next.js** (dissidência) | Um processo, um deploy; sem CORS; menos código | Acopla ciclo de vida da API ao do site (deploy do site reinicia a API); OpenAPI não vem de graça; rate limit e cache HTTP dependem do host do Next; API premium futura teria de ser extraída de qualquer forma; dificulta clientes não web (CLI de ingestão, notebooks) usarem um serviço estável | Rejeitada para já, mas preparada como rota de saída |
| **Fastify separado** (escolhida) | Contrato versionado e documentado (OpenAPI); cache/rate limit/ETag na borda (hook `onSend` e `@fastify/rate-limit`); deploy e escala independentes; útil para jornalistas/pesquisadores desde o MVP | Segundo serviço para operar; CORS; dois conjuntos de testes | Aceita |
| Hono/Express | Equivalentes; Fastify tem serialização por esquema e OpenAPI integrados | — | Não escolhidas |
| GraphQL | Flexibilidade de consulta | Contrário à ideia de respostas fechadas com `universe_note` obrigatório; cache HTTP mais difícil | Rejeitada |
| Só arquivos estáticos (CSV/JSON gerados no build) | Zero operação | Perde `freshness`, `diff`, filtros, e exige rebuild por ingestão | Rejeitada; pode complementar (exports estáticos) |

## Consequências

- Positivas: contrato público desde o dia 1, consumível por imprensa e pesquisadores; OpenAPI em `/docs`; separação clara entre dado (API) e narrativa (site), que reforça ADR-006.
- Negativas: custo operacional de dois serviços; necessidade de CORS (liberado para `GET`/`HEAD`/`OPTIONS`) e de manter cache, rate limit e ETag na borda HTTP (já implementados, ver "Estado de implementação").
- Ponto de revisão: **Sprint 6** (BACKLOG_SPRINTS.md, S6-04). Critério objetivo para reverter: nenhum consumidor externo da API nos primeiros 90 dias **e** custo operacional medido acima do que a equipe sustenta. Critério para manter: pelo menos um uso externo recorrente (download de CSV, citação de `/v1/series`) ou decisão de API premium.
