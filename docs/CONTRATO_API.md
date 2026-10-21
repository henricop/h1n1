# H1N1 · Contrato da API pública `/v1`

**Versão do contrato:** 1.0 · **Data:** 2026-10-20 · **Implementação:** `apps/api` (Fastify 5, OpenAPI gerado) sobre `packages/db` (consultas) e `packages/core` (ontologia, supressão). **Status por endpoint:** "implementado" = rota existe em `apps/api/src/routes`; "especificado" = contrato definido neste documento, implementação pendente.

Base URL: **a definir** (ex.: `https://api.<dominio>/`). Todas as rotas são `GET`, públicas, somente leitura, sem autenticação no MVP.

---

## 0. Regra que vale para todos os consumidores

> **`meta.universe_note` deve ser exibida junto a qualquer número.**
>
> Toda resposta de série traz `meta.universe_note` (texto literal do indicador, ex.: "Os números representam notificações de síndrome respiratória aguda grave (SRAG) hospitalizada registradas no SIVEP-Gripe e classificadas segundo o dicionário de dados, não todos os casos de H1N1 da população."). Um cliente que exiba, publique ou redistribua qualquer `value` sem esse texto ao lado viola o contrato. O mesmo vale para `meta.case_definition`, `meta.data_as_of` e `source` (ou link equivalente). No `series.csv`, a obrigação é cumprida pelas colunas `source_id`, `data_as_of`, `license` e pelo cabeçalho do download, que deve ser acompanhado do dicionário.

Outras regras transversais:

- A API serve **apenas** a snapshot com `status = 'current'` em `indicator_publications`. Snapshots `superseded` ou `rejected` só aparecem em `/v1/snapshots` e `/v1/diff`.
- Supressão ocorre na camada de publicação: células suprimidas saem com `value: null` e `suppressed: true`. O valor bruto nunca é servido, nem em CSV.
- Sem publicação vigente, `/v1/series` responde `200` com `observations: []` e `meta.data_as_of: null`. A API nunca inventa dado, nunca devolve zero no lugar de ausência.
- Nenhuma resposta contém a expressão "tempo real".
- Indicadores de fontes do mesmo `mirror_group` não devem ser somados pelo cliente (lista em `/v1/indicators` e `/v1/sources`).

---

## 1. Convenções

| Item | Convenção |
|---|---|
| Formato | JSON UTF-8; CSV UTF-8 com vírgula em `series.csv` |
| Envelope | Listas: `{ "data": [...] }` (+ `count` em `sources`); itens: `{ "data": {...}, ... }`; séries: `SeriesResult` (seção 3.6) |
| Erros | Sempre `{ "error": { "code": string, "message": string } }`, nunca stack trace |
| Datas | `YYYY-MM-DD` (date) e ISO 8601 com fuso (`timestamptz`) |
| Períodos | `AAAA` (ano), `AAAA-Www` (semana; `epiweek` ou `isoweek` conforme o indicador), `AAAA-Mmm` (mês) |
| Códigos geográficos | País: ISO 3166-1 alfa-3 (`BRA`, `GBR`, `USA`); mundo: `WLD`; região do Brasil: `BR-N`, `BR-NE`, `BR-SE`, `BR-S`, `BR-CO`; UF: `BR-` + sigla (`BR-SP`); Inglaterra: `ENG` (filho de `GBR`) |
| Estratos | Chave canônica textual `stratum_key` = pares `dim=valor` ordenados por dimensão e unidos por `;` (ex.: `age_group=0-4`); total = `''` |
| Identificadores | `indicator.id` em snake_case (`sivep_srag_ah1n1pdm09_confirmed`); `source.id` (`BR-03`) ou `source.slug` (`br_sivep_gripe`); `snapshot.id` UUID |
| Ordenação | `series`: `geo_code, period, stratum_key`; `snapshots`: `fetched_at desc`; `sources`: `priority, id` |
| Limites | `series.limit` 1–100000 (padrão 20000); `snapshots.limit` 1–1000 (padrão 100); `diff.limit` 1–100000 (padrão 5000) |

---

## 2. Códigos de erro

| HTTP | `error.code` | Quando | Status |
|---|---|---|---|
| 400 | `validation_error` | Parâmetro inválido ou ausente; mensagem lista `campo: motivo` separados por `; ` | implementado |
| 404 | `not_found` | Indicador, fonte ou snapshot inexistente | implementado |
| 429 | `rate_limited` | Limite por IP excedido (seção 5) | especificado |
| 500 | `internal_error` | Falha não prevista; detalhes só em log | especificado (handler global) |
| 503 | — | `/health` quando o banco não responde (corpo `{ status: "error", db, time }`) | implementado |

Exemplo de erro:

```json
{ "error": { "code": "validation_error", "message": "indicator: parâmetro obrigatório; from: período deve ter o formato AAAA, AAAA-Www ou AAAA-Mmm (ex. 2025-W01)" } }
```

---

## 3. Endpoints

### 3.1. `GET /health` — implementado

Estado do serviço e do banco.

Resposta `200`:

```json
{ "status": "ok", "db": "pglite", "time": "2026-10-20T14:03:11.512Z" }
```

`db` é `pglite` (dev/teste) ou `pg` (produção). Retorna `503` com `status: "error"` se `select 1` falhar.

### 3.2. `GET /v1/sources` — implementado

Catálogo das 65 fontes oficiais.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `priority` | `P0 \| P1 \| P2` | Filtra por prioridade |
| `country` | string (1–8) | Código de país do catálogo (`BR`, `US`, `GB`, `INT`, `EU`...) |
| `access_type` | `api \| open_data \| portal` | Tipo de acesso |

Resposta `200`:

```json
{
  "data": [
    {
      "id": "BR-03",
      "slug": "br_sivep_gripe",
      "name": "SIVEP-Gripe / SRAG, 2019 a 2026",
      "agency": "Ministério da Saúde / DATASUS",
      "country": "BR",
      "region": "Brasil",
      "category": "Casos, internações, UTI, desfechos",
      "access": "Dados abertos: CSV, JSON, Parquet, XML",
      "access_type": "open_data",
      "h1n1_scope": "Direta se subtipo conhecido; casos SRAG não são todos H1N1",
      "update_cadence": "Semanal nos bancos vivos",
      "priority": "P0",
      "url": "https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026",
      "notes": "Disponibilidade de anos 2025/2026 e revisões conforme portal; preservar versões.",
      "license": "CC-BY (portal dadosabertos.saude.gov.br)",
      "mirror_group": "br_srag",
      "api_tested_at": "2026-10-20"
    }
  ],
  "count": 1
}
```

### 3.3. `GET /v1/sources/:idOrSlug` — implementado

Uma fonte por `id` (`BR-03`) ou `slug` (`br_sivep_gripe`), com seus indicadores.

Resposta `200`: `{ "data": Source, "indicators": Indicator[] }`. `404` se não existir.

### 3.4. `GET /v1/indicators` — implementado

Ontologia de indicadores (22 no MVP; ver DICIONARIO_INDICADORES.md).

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `source_id` | string | Filtra por fonte (ex.: `BR-03`) |

Resposta `200`:

```json
{
  "data": [
    {
      "id": "sivep_srag_ah1n1pdm09_confirmed",
      "name": "SRAG por influenza A(H1N1)pdm09 confirmada por RT-PCR (SIVEP-Gripe)",
      "description": "SRAG classificada como influenza (CLASSI_FIN = 1) com subtipo A(H1N1)pdm09 por RT-PCR (PCR_FLUASU = 1).",
      "source_id": "BR-03",
      "case_definition": "CLASSI_FIN = 1 AND PCR_FLUASU = 1.",
      "measurement": "count",
      "unit": "notifications",
      "universe_note": "Os números representam notificações de síndrome respiratória aguda grave (SRAG) hospitalizada registradas no SIVEP-Gripe e classificadas segundo o dicionário de dados, não todos os casos de H1N1 da população.",
      "methodology_version": "sivep-v1",
      "geo_levels": ["country", "state"],
      "period_type": "epiweek",
      "event_date_basis": "symptom_onset",
      "stratum_schema": { "age_group": ["0-4", "5-14", "15-29", "30-49", "50-64", "65+", "NA"] },
      "mirror_group": "br_srag",
      "suppression_threshold": 5,
      "denominator_indicator_id": null,
      "min_denominator": null,
      "caveats": [
        "Semanas recentes estão sujeitas a atraso de notificação e digitação; os valores são provisórios e tendem a subir em revisões.",
        "A base contém apenas SRAG hospitalizada ou óbito por SRAG; não mede infecções leves.",
        "A UF é a de residência do paciente (SG_UF); a semana é a dos primeiros sintomas (SEM_PRI).",
        "Registros com UF ignorada ou residência fora do Brasil ficam fora dos recortes por estado.",
        "Depende de coleta e subtipagem por RT-PCR; casos de influenza A sem subtipo não entram aqui."
      ]
    }
  ]
}
```

### 3.5. `GET /v1/indicators/:id` — implementado

Definição, publicação vigente e frescor de um indicador.

Resposta `200`:

```json
{
  "data": { "...": "Indicator (como acima)" },
  "publication": {
    "indicator_id": "sivep_srag_ah1n1pdm09_confirmed",
    "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10",
    "published_at": "2026-10-20 12:40:02.117+00",
    "data_as_of": "2026-10-19",
    "status": "current",
    "validation_report": { "rows_in": 189234, "rows_out": 15120, "checks": ["schema_ok", "no_negative", "weeks_in_range"] }
  },
  "freshness": {
    "indicator_id": "sivep_srag_ah1n1pdm09_confirmed",
    "source_id": "BR-03",
    "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10",
    "data_as_of": "2026-10-19",
    "fetched_at": "2026-10-20 12:31:44.901+00",
    "published_at": "2026-10-20 12:40:02.117+00",
    "age_days": 0,
    "last_run_status": "ok",
    "last_run_finished_at": "2026-10-20 12:39:58.004+00"
  }
}
```

`publication` e `freshness` são `null` quando não há publicação vigente. `404` se o indicador não existir.

### 3.6. `GET /v1/series` — implementado

Série temporal publicada de um indicador (snapshot vigente, supressão aplicada). Formato `SeriesResult` de `packages/db/src/queries.ts`.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `indicator` | string | sim | Id do indicador |
| `geo_level` | `world \| country \| region \| state` | não | Nível geográfico |
| `geo_code` | string (1–16) | não | `BRA`, `BR-SP`, `WLD`... |
| `from` | período | não | Inicial, inclusive (`2025-W01`) |
| `to` | período | não | Final, inclusive (`2026-W52`) |
| `include_strata` | `true \| false` | não | Inclui estratos além do total; padrão só total (`stratum_key = ''`) |
| `stratum.<dim>` | string (1–64) | não | Filtro de estrato; `<dim>` em `^[a-z][a-z0-9_]{0,31}$` (ex.: `stratum.age_group=0-4`) |
| `limit` | inteiro 1–100000 | não | Padrão 20000 |

Comparação de período é lexicográfica sobre o id (`AAAA-Www`), válida dentro do mesmo `period_type`.

Exemplo: `GET /v1/series?indicator=sivep_srag_ah1n1pdm09_confirmed&geo_level=state&geo_code=BR-SP&from=2026-W30&to=2026-W33&include_strata=true`

Resposta `200`:

```json
{
  "indicator": { "id": "sivep_srag_ah1n1pdm09_confirmed", "name": "SRAG por influenza A(H1N1)pdm09 confirmada por RT-PCR (SIVEP-Gripe)", "source_id": "BR-03", "period_type": "epiweek", "event_date_basis": "symptom_onset", "suppression_threshold": 5, "...": "demais campos de Indicator" },
  "source": { "id": "BR-03", "slug": "br_sivep_gripe", "name": "SIVEP-Gripe / SRAG, 2019 a 2026", "license": "CC-BY (portal dadosabertos.saude.gov.br)", "mirror_group": "br_srag", "...": "demais campos de Source" },
  "publication": { "indicator_id": "sivep_srag_ah1n1pdm09_confirmed", "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10", "published_at": "2026-10-20 12:40:02.117+00", "data_as_of": "2026-10-19", "status": "current", "validation_report": {} },
  "snapshot": {
    "id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10",
    "source_id": "BR-03",
    "url": "https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-19-10-2026.csv",
    "fetched_at": "2026-10-20 12:31:44.901+00",
    "sha256": "3c1f…e9",
    "bytes": 273678336,
    "content_type": "text/csv",
    "license": "CC-BY (portal dadosabertos.saude.gov.br)",
    "storage_path": "data/snapshots/BR-03/2026-10-20T12-31-44Z_INFLUD26-19-10-2026.csv",
    "data_as_of": "2026-10-19",
    "status": "ok",
    "notes": null
  },
  "observations": [
    { "indicator_id": "sivep_srag_ah1n1pdm09_confirmed", "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10", "geo_level": "state", "geo_code": "BR-SP", "period_type": "epiweek", "period": "2026-W30", "period_start": "2026-07-19", "period_end": "2026-07-25", "value": 37, "denominator": null, "stratum": {}, "update_status": "final", "quality_flags": [], "suppressed": false },
    { "indicator_id": "sivep_srag_ah1n1pdm09_confirmed", "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10", "geo_level": "state", "geo_code": "BR-SP", "period_type": "epiweek", "period": "2026-W30", "period_start": "2026-07-19", "period_end": "2026-07-25", "value": null, "denominator": null, "stratum": { "age_group": "0-4" }, "update_status": "final", "quality_flags": [], "suppressed": true },
    { "indicator_id": "sivep_srag_ah1n1pdm09_confirmed", "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10", "geo_level": "state", "geo_code": "BR-SP", "period_type": "epiweek", "period": "2026-W30", "period_start": "2026-07-19", "period_end": "2026-07-25", "value": 12, "denominator": null, "stratum": { "age_group": "65+" }, "update_status": "final", "quality_flags": [], "suppressed": false },
    { "indicator_id": "sivep_srag_ah1n1pdm09_confirmed", "snapshot_id": "7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10", "geo_level": "state", "geo_code": "BR-SP", "period_type": "epiweek", "period": "2026-W33", "period_start": "2026-08-09", "period_end": "2026-08-15", "value": 21, "denominator": null, "stratum": {}, "update_status": "provisional", "quality_flags": ["reporting_delay"], "suppressed": false }
  ],
  "meta": {
    "data_as_of": "2026-10-19",
    "fetched_at": "2026-10-20 12:31:44.901+00",
    "universe_note": "Os números representam notificações de síndrome respiratória aguda grave (SRAG) hospitalizada registradas no SIVEP-Gripe e classificadas segundo o dicionário de dados, não todos os casos de H1N1 da população.",
    "case_definition": "CLASSI_FIN = 1 AND PCR_FLUASU = 1.",
    "license": "CC-BY (portal dadosabertos.saude.gov.br)",
    "suppression_threshold": 5,
    "caveats": ["..."],
    "count": 4
  }
}
```

Os valores numéricos do exemplo são ilustrativos de formato, não dados reais.

Semântica dos campos de observação:

| Campo | Significado |
|---|---|
| `period`, `period_start`, `period_end` | Id e intervalo fechado do período; para `epiweek` (SIVEP) domingo–sábado na convenção brasileira; para `isoweek` (FluNet, UKHSA) segunda–domingo |
| `value` | Valor publicado; `null` se suprimido ou se `denominator < min_denominator` |
| `denominator` | Denominador para percentuais; `null` para contagens |
| `stratum` / `stratum_key` | Estrato (`{}` = total) e sua chave canônica |
| `update_status` | `provisional` (sujeito a revisão) ou `final` |
| `quality_flags` | Ex.: `reporting_delay`, `denominator_below_minimum`, `schema_changed` |
| `suppressed` | `true` quando a célula foi suprimida (valor < 5 em recorte subnacional/estratificado, ou supressão complementar) |

Sem publicação vigente: `publication: null`, `snapshot: null`, `observations: []`, `meta.data_as_of: null`, `meta.count: 0`, HTTP `200`.

### 3.7. `GET /v1/series.csv` — implementado

Mesma consulta e parâmetros de `/v1/series`, em CSV. Cabeçalhos: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<indicator_id>.csv"`.

Colunas, nesta ordem: `indicator_id, geo_level, geo_code, period_type, period, period_start, period_end, value, denominator, suppressed, update_status, stratum_key, quality_flags, snapshot_id, data_as_of, source_id, license`. `quality_flags` separadas por `|`; células suprimidas com `value` vazio e `suppressed=true`.

```csv
indicator_id,geo_level,geo_code,period_type,period,period_start,period_end,value,denominator,suppressed,update_status,stratum_key,quality_flags,snapshot_id,data_as_of,source_id,license
sivep_srag_ah1n1pdm09_confirmed,state,BR-SP,epiweek,2026-W30,2026-07-19,2026-07-25,37,,false,final,,,7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10,2026-10-19,BR-03,CC-BY (portal dadosabertos.saude.gov.br)
sivep_srag_ah1n1pdm09_confirmed,state,BR-SP,epiweek,2026-W30,2026-07-19,2026-07-25,,,true,final,age_group=0-4,,7f0d3b7e-5d2c-4a1e-9a1b-2f1c0e8a9d10,2026-10-19,BR-03,CC-BY (portal dadosabertos.saude.gov.br)
```

Quem redistribui o CSV deve acompanhar o dicionário (`/v1/indicators/:id` ou `/dados/metodologia/`) e a `universe_note`.

### 3.8. `GET /v1/freshness` — implementado

Frescor por indicador: snapshot vigente, `data_as_of`, idade em dias, última ingestão.

Resposta `200`:

```json
{
  "data": [
    { "indicator_id": "flunet_ah1n1pdm09_detections", "source_id": "INT-01", "snapshot_id": "c2…", "data_as_of": "2026-10-12", "fetched_at": "2026-10-20 09:02:10+00", "published_at": "2026-10-20 09:05:33+00", "age_days": 0, "last_run_status": "ok", "last_run_finished_at": "2026-10-20 09:05:31+00" },
    { "indicator_id": "ukhsa_influenza_testing_positivity", "source_id": "UK-01", "snapshot_id": null, "data_as_of": null, "fetched_at": null, "published_at": null, "age_days": null, "last_run_status": null, "last_run_finished_at": null }
  ],
  "generated_at": "2026-10-20T14:03:11.512Z"
}
```

`age_days` é calculado sobre `fetched_at` da snapshot vigente. Limites de alerta por fonte (UI): SIVEP 14 dias, FluNet 21 dias, UKHSA 14 dias, IBGE/Banco Mundial 400 dias.

### 3.9. `GET /v1/snapshots` — implementado

Snapshots imutáveis baixadas das fontes.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `source_id` | string | Filtra por fonte |
| `limit` | inteiro 1–1000 | Padrão 100 |

Resposta `200`: `{ "data": Snapshot[] }` ordenado por `fetched_at desc`. Inclui snapshots com `status` `ok`, `failed` e `quarantined` (transparência de operação); apenas `ok` podem ser publicadas.

### 3.10. `GET /v1/snapshots/:id` — implementado

Uma snapshot por UUID. `404` se o id não for UUID válido ou não existir.

### 3.11. `GET /v1/diff` — implementado

Diferenças célula a célula entre duas snapshots do mesmo indicador (revisões retrospectivas; pesquisa R07).

| Parâmetro | Tipo | Obrigatório |
|---|---|---|
| `indicator` | string | sim |
| `a` | UUID | sim |
| `b` | UUID | sim |
| `limit` | inteiro 1–100000 | não (padrão 5000) |

Resposta `200`:

```json
{
  "data": [
    { "geo_level": "state", "geo_code": "BR-RS", "period": "2026-W35", "stratum_key": "", "value_a": 18, "value_b": 23 },
    { "geo_level": "country", "geo_code": "BRA", "period": "2026-W38", "stratum_key": "", "value_a": null, "value_b": 61 }
  ]
}
```

`value_a`/`value_b` são valores armazenados (`null` = célula ausente na snapshot). Atenção: `/v1/diff` compara observações **antes** da supressão de publicação; por isso o endpoint só expõe diffs de células já publicáveis — a implementação deve aplicar o mesmo `suppression_threshold` do indicador antes de responder (requisito para a versão 1.1; até lá, `diff` deve ser restrito a `geo_level = country` sem estrato no deploy público).

### 3.12. `GET /v1/geo` — implementado

Unidades geográficas: mundo, países, regiões e UFs do Brasil.

| Parâmetro | Tipo |
|---|---|
| `level` | `world \| country \| region \| state` |

Resposta `200`:

```json
{ "data": [
  { "code": "BRA", "level": "country", "name": "Brasil", "parent_code": "WLD", "ibge_id": null, "iso2": "BR" },
  { "code": "BR-SE", "level": "region", "name": "Sudeste", "parent_code": "BRA", "ibge_id": null, "iso2": null },
  { "code": "BR-SP", "level": "state", "name": "São Paulo", "parent_code": "BR-SE", "ibge_id": "35", "iso2": null }
] }
```

### 3.13. `GET /openapi.json` e `GET /docs` — implementado (gerado)

Especificação OpenAPI gerada pelo Fastify a partir dos esquemas de rota. Este documento prevalece em caso de divergência semântica; o OpenAPI prevalece para tipos de campo.

---

## 4. Cache

| Endpoint | `Cache-Control` | Chave de invalidação |
|---|---|---|
| `/health` | `no-store` | — |
| `/v1/sources*`, `/v1/geo` | `public, max-age=3600, stale-while-revalidate=86400` | Deploy/seed |
| `/v1/indicators*` | `public, max-age=3600, stale-while-revalidate=86400` | Deploy/seed ou nova publicação (campo `publication`) |
| `/v1/series`, `/v1/series.csv` | `public, max-age=300, stale-while-revalidate=3600` + `ETag` derivado de `(indicator, snapshot_id, query)` | Nova publicação do indicador |
| `/v1/freshness` | `public, max-age=60` | — |
| `/v1/snapshots*`, `/v1/diff` | `public, max-age=300` | Nova snapshot |

Status: **especificado**; cabeçalhos a implementar como plugin global no Fastify. A web (ISR) revalida páginas por evento de publicação, não por cron.

---

## 5. Rate limit

- Limite por IP: **120 requisições/minuto** para JSON e **20/minuto** para `series.csv`, com resposta `429 rate_limited` e cabeçalhos `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- Sem chaves de API no MVP. Se houver demanda institucional, chaves com limites maiores entram na versão 1.x sem alterar o contrato público.
- IPs são usados apenas em memória para o contador, não persistidos (LGPD_E_PRIVACIDADE.md).

Status: **especificado**.

---

## 6. Versionamento e política de compatibilidade

- Versão major no caminho (`/v1`). Mudanças incompatíveis geram `/v2`, com `/v1` mantido por pelo menos 12 meses após o anúncio.
- **Compatível (sem mudar versão):** adicionar campo, adicionar valor em `quality_flags`, adicionar indicador, adicionar parâmetro opcional, adicionar coluna ao fim do CSV.
- **Incompatível (exige `/v2`):** remover ou renomear campo, mudar tipo, mudar semântica de `value`, mudar ordem ou remover colunas do CSV, mudar convenção de `period` ou de códigos geográficos, mudar a chave canônica de estrato.
- **Mudança de metodologia de um indicador** (ex.: nova definição de caso) não altera a versão da API: cria-se um **novo `indicator.id`** com novo `methodology_version`; o antigo permanece servível com a última publicação e caveat de descontinuação. Nunca se altera silenciosamente a definição de um id existente.
- `validation_report`, `notes` e `quality_flags` são campos abertos (`additionalProperties`) e não têm garantia de esquema.
- Depreciações são anunciadas em `/sobre/correcoes/` e no OpenAPI (`deprecated: true`) com data de remoção.

---

## 7. Checklist para consumidores (inclusive `apps/web`)

1. Exibir `meta.universe_note` ao lado de qualquer número.
2. Exibir `meta.data_as_of` (data da base) e `source.name` com link para `source.url`.
3. Tratar `observations: []` como "sem dados publicados", nunca como zero.
4. Tratar `suppressed: true` como "< 5", nunca como zero ou ausência.
5. Distinguir `update_status: provisional` visualmente.
6. Nunca somar indicadores de fontes com o mesmo `mirror_group`.
7. Nunca comparar `epiweek` e `isoweek` como se fossem a mesma semana sem conversão por `period_start`.
8. Respeitar `license` da snapshot ao redistribuir.
