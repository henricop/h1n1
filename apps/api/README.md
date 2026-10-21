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

Variáveis de ambiente:

| Variável | Padrão | Efeito |
|---|---|---|
| `DATABASE_URL` | vazio (PGlite em `data/pglite`) | Postgres em produção |
| `PGLITE_DIR` | `data/pglite` | diretório do PGlite |
| `API_PORT` / `API_HOST` | `3001` / `0.0.0.0` | bind |
| `API_RATE_LIMIT` | ligado | `off` desliga todo rate limit |
| `API_RATE_LIMIT_MAX` | `120` | requisições/min por IP (JSON) |
| `API_CSV_RATE_LIMIT_MAX` | `20` | requisições/min por IP em `/v1/series.csv`; `0` usa o limite global |
| `TRUST_PROXY` | `false` | `true`/`1` confia em `X-Forwarded-*`; ou lista de IPs/CIDRs (`10.0.0.0/8,127.0.0.1`). Ligue **somente** atrás de proxy reverso, senão o IP do rate limit pode ser forjado |

Na subida, o servidor aplica migrações e faz `seedAll` se a tabela `sources` estiver vazia.

## Rotas (prefixo `/v1`, JSON UTF-8)

| Rota | Descrição |
|---|---|
| `GET /health` | `{ status, db: 'pglite'\|'pg', time }` · `Cache-Control: no-store` |
| `GET /v1/sources?priority=&country=&access_type=` | catálogo (65 fontes) → `{ data, count }` |
| `GET /v1/sources/:idOrSlug` | fonte por id (`BR-03`) ou slug (`br_sivep_gripe`) + seus indicadores |
| `GET /v1/indicators?source_id=` | ontologia de indicadores |
| `GET /v1/indicators/:id` | definição + publicação vigente + frescor |
| `GET /v1/series?indicator=&geo_level=&geo_code=&from=&to=&include_strata=&stratum.<dim>=&limit=` | série publicada (`SeriesResult`) |
| `GET /v1/series.csv` (mesmos parâmetros) | mesma série em CSV, `Content-Disposition: attachment`, `X-Truncated` |
| `GET /v1/freshness` | uma linha por indicador: snapshot, `data_as_of`, idade em dias, última ingestão |
| `GET /v1/snapshots?source_id=&limit=` · `GET /v1/snapshots/:id` | snapshots imutáveis (sem `storage_path`) |
| `GET /v1/diff?indicator=&a=&b=&limit=` | diferenças célula a célula entre duas snapshots — **só total nacional** (ver abaixo) |
| `GET /v1/geo?level=` | mundo, países, regiões e UFs |
| `GET /openapi.json` · `GET /docs` | especificação OpenAPI 3 e Swagger UI |

### Validação de parâmetros

- Todo parâmetro textual (query e path) aceita no máximo **200 caracteres** e **nenhum caractere de
  controle** (C0 incl. `\u0000`, DEL, C1) → `400 validation_error`. Parâmetros de caminho acima de 200
  caracteres são cortados pelo roteador com `414` no formato padrão.
- `from`/`to`: `AAAA`, `AAAA-Www` ou `AAAA-Mnn` (regex `^\d{4}(-(W\d{2}|M\d{2}))?$`). `AAAA` é expandido
  conforme o `period_type` do indicador: em `from` para o primeiro período do ano (`AAAA-W01` / `AAAA-M01` /
  `AAAA`) e em `to` para o último (`AAAA-W53` / `AAAA-M12` / `AAAA`). `from > to` → `400`.
- `stratum.<dim>=<valor>`: `<dim>` em `^[a-z][a-z0-9_]{0,31}$`; `<valor>` com 1–64 caracteres, **sem `;` nem `=`**
  (são os separadores da chave canônica `stratum_key`).
- `limit`: `meta.truncated: true` (JSON) ou `X-Truncated: true` (CSV) quando o número de observações
  atingiu `limit` — refine a consulta (geo, período) para garantir que nada ficou de fora.

### Erros

Sempre `{ "error": { "code", "message" } }`, nunca stack trace nem eco da URL:
`validation_error` 400/413/415, `not_found` 404, `rate_limited` 429, `client_error` para outros 4xx
(o status original é mantido, ex. 414), `internal_error` 5xx.

### Cache e ETag

| Rota | `Cache-Control` (respostas 200) |
|---|---|
| `/health` | `no-store` |
| `/v1/sources*`, `/v1/indicators*`, `/v1/geo` | `public, max-age=3600, stale-while-revalidate=86400` |
| `/v1/freshness` | `public, max-age=60` |
| `/v1/series`, `/v1/series.csv` | `public, max-age=300, stale-while-revalidate=3600` + `ETag` (sha256 do corpo); `If-None-Match` → `304` |
| `/v1/snapshots*`, `/v1/diff` | `public, max-age=300` |

Respostas 4xx/5xx não levam `Cache-Control`. CORS liberado para `GET`/`HEAD`/`OPTIONS` (preflight responde `204`).

### Rate limit

Por IP, em memória (nada persistido): **120/min** para JSON e **20/min** para `/v1/series.csv` (contadores
separados). Cabeçalhos no padrão draft da IETF: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
(+ `Retry-After` no `429`). Em testes use `buildApp({ rateLimit: false })`; os limites são configuráveis por
`rateLimitMax` / `csvRateLimitMax` (ou pelas variáveis acima).

## Supressão de célula pequena

Células de recortes subnacionais ou estratificados com `value < suppression_threshold` saem com
`value: null` e `suppressed: true` (o total nacional sem estrato nunca é suprimido). A **supressão
complementar** (se só um estrato do grupo foi suprimido e o total está presente, o próximo menor
estrato também é suprimido) é calculada sobre o **grupo completo** — total + todos os estratos da
mesma geo/período — **mesmo quando a consulta pede um único estrato** (`stratum.<dim>=`). Ou seja,
consultar `stratum.age_group=5-14` isoladamente devolve a mesma célula (suprimida ou não) que a
consulta com `include_strata=true`.

Limitação conhecida desta versão (fora de escopo): a supressão opera por grupo geo/período. Um
consumidor que combine **consultas diferentes** — por exemplo, total nacional menos a soma dos
estados, ou um estrato nacional menos os mesmos estratos estaduais — pode, em tese, estimar uma
célula suprimida por diferença entre níveis geográficos. A API não tenta suprimir entre níveis;
o contrato (CONTRATO_API.md §0 e §7) proíbe a reconstrução por diferença, e `/v1/diff` é restrito ao
total nacional justamente para não abrir mais um canal.

### `/v1/diff` restrito ao total nacional

Nesta versão, `/v1/diff` só aceita snapshots com `status = 'ok'` (`400` caso contrário; `404` se não
existirem) da mesma fonte do indicador, e só devolve células com `geo_level = 'country'` e
`stratum_key = ''`. Células subnacionais ou estratificadas (as sujeitas a supressão) nunca saem do diff.

## Exemplo

```bash
curl 'http://localhost:3001/v1/series?indicator=sivep_srag_ah1n1pdm09_confirmed&geo_level=state&geo_code=BR-SC&from=2026&to=2026-W20&include_strata=true'
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
    "count": 1,
    "truncated": false
  }
}
```

Sem publicação vigente a resposta é `200` com `observations: []` e `meta.data_as_of: null`.
`snapshot` (aqui e em `/v1/snapshots*`) nunca inclui `storage_path` (caminho interno de armazenamento).

## `meta.universe_note` é obrigatório

Qualquer número exibido a partir de `/v1/series` **deve** vir acompanhado de `meta.universe_note`
(o que a contagem representa e o que ela não representa: H1N1 confirmado ≠ influenza A não subtipada
≠ SRAG ≠ síndrome gripal), de `meta.data_as_of` e de `meta.case_definition`. Células suprimidas
(`suppressed: true`, `value: null`; no CSV `value` vazio) nunca expõem o valor bruto e não devem ser
reconstruídas por diferença. Fontes do mesmo `mirror_group` reapresentam os mesmos dados e não
devem ser somadas.
