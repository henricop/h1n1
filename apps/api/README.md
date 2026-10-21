# @h1n1/api

API pública do H1N1 (Fastify 5 + OpenAPI). Serve fontes, indicadores, séries, snapshots e frescor
a partir de `@h1n1/db`. Todos os números vêm de **snapshots versionados de fontes oficiais** e só
saem depois de publicados como vigentes para o indicador; a API nunca calcula nem inventa valores.

## Como rodar

```bash
pnpm install
pnpm --filter @h1n1/core build && pnpm --filter @h1n1/db build   # se dist/ não existir
pnpm --filter @h1n1/api dev        # tsx watch, porta 3001 (API_PORT), host 0.0.0.0
pnpm --filter @h1n1/api test       # vitest (PGlite em memória)
pnpm --filter @h1n1/api build && pnpm --filter @h1n1/api start
```

Variáveis: `DATABASE_URL` (Postgres; vazio usa PGlite em `data/pglite`), `PGLITE_DIR`, `API_PORT`
(3001), `API_HOST`, `API_RATE_LIMIT=off` para desligar o limite de 120 req/min por IP.
Na subida, o servidor aplica migrações e faz `seedAll` se a tabela `sources` estiver vazia.

## Rotas (prefixo `/v1`, JSON UTF-8)

| Rota | Descrição |
|---|---|
| `GET /health` | `{ status, db: 'pglite'\|'pg', time }` |
| `GET /v1/sources?priority=&country=&access_type=` | catálogo (65 fontes) → `{ data, count }` |
| `GET /v1/sources/:idOrSlug` | fonte por id (`BR-03`) ou slug (`br_sivep_gripe`) + seus indicadores |
| `GET /v1/indicators?source_id=` | ontologia de indicadores |
| `GET /v1/indicators/:id` | definição + publicação vigente + frescor |
| `GET /v1/series?indicator=&geo_level=&geo_code=&from=&to=&include_strata=&stratum.<dim>=&limit=` | série publicada (`SeriesResult`) |
| `GET /v1/series.csv` (mesmos parâmetros) | mesma série em CSV, `Content-Disposition: attachment` |
| `GET /v1/freshness` | uma linha por indicador: snapshot, `data_as_of`, idade em dias, última ingestão |
| `GET /v1/snapshots?source_id=&limit=` · `GET /v1/snapshots/:id` | snapshots imutáveis |
| `GET /v1/diff?indicator=&a=&b=&limit=` | diferenças célula a célula entre duas snapshots |
| `GET /v1/geo?level=` | mundo, países, regiões e UFs |
| `GET /openapi.json` · `GET /docs` | especificação OpenAPI 3 e Swagger UI |

Erros sempre no formato `{ "error": { "code", "message" } }` (`validation_error` 400, `not_found` 404,
`rate_limited` 429, `internal_error` 500; nunca stack trace). Respostas 200 em `/v1/*` levam
`Cache-Control: public, max-age=300, stale-while-revalidate=600`; CORS liberado para GET.

## Exemplo

```bash
curl 'http://localhost:3001/v1/series?indicator=sivep_srag_ah1n1pdm09_confirmed&geo_level=state&geo_code=BR-SC&from=2026-W01&to=2026-W20&include_strata=true'
curl 'http://localhost:3001/v1/series.csv?indicator=flunet_ah1n1pdm09_detections&geo_code=BRA' -o flunet_bra.csv
```

Resposta de `/v1/series` (resumida):

```json
{
  "indicator": { "id": "sivep_srag_ah1n1pdm09_confirmed", "...": "..." },
  "source": { "id": "BR-03", "slug": "br_sivep_gripe", "...": "..." },
  "publication": { "snapshot_id": "...", "data_as_of": "2026-10-19", "status": "current" },
  "snapshot": { "id": "...", "sha256": "...", "fetched_at": "...", "license": "CC-BY" },
  "observations": [
    { "geo_code": "BR-SC", "period": "2026-W01", "value": null, "suppressed": true, "stratum": {}, "...": "..." }
  ],
  "meta": {
    "data_as_of": "2026-10-19",
    "universe_note": "Os números representam notificações de SRAG hospitalizada registradas no SIVEP-Gripe ... não todos os casos de H1N1 da população.",
    "case_definition": "CLASSI_FIN = 1 AND PCR_FLUASU = 1.",
    "license": "CC-BY",
    "suppression_threshold": 5,
    "caveats": ["..."],
    "count": 1
  }
}
```

Sem publicação vigente a resposta é `200` com `observations: []` e `meta.data_as_of: null`.

## `meta.universe_note` é obrigatório

Qualquer número exibido a partir de `/v1/series` **deve** vir acompanhado de `meta.universe_note`
(o que a contagem representa e o que ela não representa: H1N1 confirmado ≠ influenza A não subtipada
≠ SRAG ≠ síndrome gripal), de `meta.data_as_of` e de `meta.case_definition`. Células suprimidas
(`suppressed: true`, `value: null`; no CSV `value` vazio) nunca expõem o valor bruto e não devem ser
reconstruídas por diferença. Fontes do mesmo `mirror_group` reapresentam os mesmos dados e não
devem ser somadas.
