# @h1n1/connectors — conectores de ingestão

Pacote de ingestão do H1N1 (portal público de referência e observatório de influenza A(H1N1)).
Implementa a decisão A4 do plano de execução: `fetch → snapshot imutável (sha256, url, fetched_at, licença) → normalize → load → validação → publicação`.

## Uso

Na raiz do monorepo (`DATABASE_URL` vazio usa PGlite em `data/pglite`; definido usa PostgreSQL):

```
pnpm --filter @h1n1/db seed                 # fontes, indicadores e geografias (obrigatório antes da 1ª ingestão)
pnpm ingest list                            # conectores e indicadores
pnpm ingest status                          # frescor por indicador (data_as_of, idade em dias, última execução)
pnpm ingest flunet --country BRA,USA,ARG    # FluNet (default: BRA)
pnpm ingest sivep --year 2026 [--max-rows N]
pnpm ingest ibge --years 2021-2025
pnpm ingest worldbank
pnpm ingest ukhsa
```

Opções comuns: `--force` (reingere mesmo com sha256 idêntico), `--dry-run` (baixa, normaliza e valida sem gravar no banco).
`SIVEP_MAX_ROWS` (env) equivale a `--max-rows`. `SNAPSHOT_DIR` muda o diretório de snapshots (default `data/snapshots`).
`--country` aceita apenas códigos ISO3 (`/^[A-Z]{3}$/`); valores inválidos são rejeitados antes de montar o filtro OData.

**`--max-rows` / `SIVEP_MAX_ROWS` = execução parcial.** A snapshot é gravada com status `quarantined` e notes
`execução parcial (max-rows=N); não publicável`, nada é publicado, a publicação vigente permanece e a execução
não conta como snapshot `ok` para a idempotência (a próxima ingestão completa do mesmo arquivo não é bloqueada).
O CLI avisa no início e no fim da execução. Serve só para desenvolvimento.

Os arquivos brutos ficam em `data/snapshots/<slug_da_fonte>/<YYYYMMDDTHHmmss>_<sha256[0:12]>.<ext>` com sidecar `.meta.json`
(`url`, `urls`, `fetched_at`, `sha256`, `bytes`, `content_type`, `license`, `data_as_of`, opções, `retain_raw`,
`raw_file_deleted`). A pasta é gitignored. Conectores com `retainRaw: false` (hoje só `sivep`, microdados individuais)
têm o bruto **apagado** logo após a normalização: fica só o sidecar, com `raw_file_deleted: true` e
`raw_file_deleted_reason: "microdados individuais; apenas agregados são retidos"`; `snapshots.storage_path` é `null`.

Downloads (`src/http.ts`): timeout de 60 s até os cabeçalhos e de 45 min para o download total, ambos por `AbortSignal`;
falha de stream (conexão caída, timeout do corpo, `content-length` não atingido) refaz o download inteiro até 2 vezes;
em qualquer erro o arquivo parcial em `tmp/` é removido. 5xx e falhas de rede na requisição têm 3 tentativas; 4xx não é repetido.

## Pipeline (`src/pipeline.ts`)

1. Abre `ingestion_runs` com status `running`.
2. `fetch()` grava o arquivo bruto (streaming para disco, hash calculado no fluxo) e o sidecar.
3. Idempotência: se já existe snapshot **`ok`** da mesma fonte com o mesmo sha256, registra "sem mudança" e encerra (exceto `--force`).
   Snapshots `quarantined`/`failed` (inclusive execuções parciais) nunca bloqueiam.
4. Insere `snapshots` com status **`quarantined`** e notes `em processamento`, roda `normalize()` e grava `observations` em lotes
   de 1.000 dentro de transação; códigos geo novos (países do FluNet/Banco Mundial) são garantidos na tabela `geo` antes da
   validação. Conectores com `retainRaw: false` têm o bruto apagado aqui. O conector pode chamar `ctx.addError()` para
   registrar um erro de integridade da origem (ex.: linhas duplicadas) que leva à quarentena sem derrubar a execução.
5. Validação (abaixo). Se passar: **uma única transação** (`db.transaction`) faz o carry-forward, o `publishIndicator()` de
   TODOS os indicadores do conector e muda a snapshot para `ok`; qualquer exceção no meio reverte tudo (snapshot `failed`,
   publicação anterior continua vigente). Se falhar: snapshot fica `quarantined` com os erros em notes, `rejectPublication()`
   é registrado e a publicação anterior permanece vigente (regra 10 de integridade). Execução parcial (`--max-rows`): snapshot
   `quarantined`, sem publicação nem rejeição.
   O `data_as_of` da publicação é o **máximo** entre o da nova snapshot e o da publicação vigente — uma carga retroativa
   (ex.: reprocessar o arquivo SIVEP de 2025 depois do de 2026) não rebaixa a data da série.
6. Fecha `ingestion_runs` com `rows_in`, `rows_out`, status e erro.

**Carry-forward (arquivos anuais):** um conector pode declarar a cobertura temporal da snapshot por indicador
(`ctx.setCoverage`). Ao publicar, as observações da publicação vigente *fora* dessa cobertura são copiadas para a nova
snapshot com a flag `carried_forward`. É assim que `sivep --year 2025` e `sivep --year 2026` compõem uma única série vigente
sem que um ano apague o outro. A regra de queda abrupta compara contagens apenas dentro da cobertura.

## Regras de validação (`src/validate.ts`)

Por indicador, sobre todas as observações da snapshot:

- nenhum valor negativo; nenhum `NaN`/infinito (valor ou denominador);
- período válido para o tipo (`YYYY-Www` semanas 01–53, `YYYY-Mnn`, `YYYY`) e `period_type` igual ao da ontologia;
- `geo_code` existente em `geo` e `geo_level` permitido pela ontologia;
- estratos restritos ao `stratum_schema` do indicador (`@h1n1/core`);
- percentuais entre 0 e 100; indicadores com `denominator_indicator_id` exigem `denominator` preenchido;
- contagem de observações ≥ 90 % da publicação vigente do mesmo indicador (queda abrupta → quarentena);
- indicador esperado pelo conector sem nenhuma observação → erro.

Invariantes cruzadas por célula (geo, período, estrato), avaliadas quando todos os termos existem (`cross_checks` no relatório):

- SIVEP: `ah1n1pdm09_confirmed ≤ influenza_confirmed ≤ notifications`; `ah1n1pdm09_deaths ≤ influenza_deaths ≤ influenza_confirmed`;
  `influenza_icu ≤ influenza_confirmed`; para cada indicador de contagem, soma dos estratos `age_group` = total e soma das UFs ≤ total nacional;
- FluNet: `ah1n1pdm09 + ah3 + not_subtyped + not_subtypable ≤ inf_a`; `inf_a ≤ inf_all`.

Falha em qualquer indicador, invariante cruzada ou erro do conector (`ctx.addError`) coloca a snapshot inteira em quarentena.
O relatório (por indicador, `cross_checks`, `connector_errors`) vai para `indicator_publications.validation_report`.
A supressão de células pequenas **não** é feita aqui: ela é aplicada na leitura (`getSeries` em `@h1n1/db`).

## Conectores

| id | fonte | o que produz |
|---|---|---|
| `flunet` | INT-01 (OMS FluNet, OData `VIW_FNT`) | por país (ISO3) e semana ISO: amostras processadas, detecções A(H1N1)pdm09, A(H3), influenza A, A não subtipada, A não subtipável, B, total; razões `share_of_inf_a` e `positivity` (denominador gravado; valor nulo se denominador < 20 ou numerador > denominador). Total = soma das origens (null = ausente, nunca zero) + estratos `origin_source`. `provisional` nas 4 últimas semanas. `data_as_of` = maior `ISO_WEEKSTARTDATE` + 6 dias. Linhas duplicadas por (`COUNTRY_CODE`, `ISO_YEAR`, `ISO_WEEK`, `ORIGIN_SOURCE`): só a primeira conta, a contagem vai para o relatório e a snapshot é quarentenada. `ORIGIN_SOURCE` fora de `SENTINEL/NONSENTINEL/NOTDEFINED` não derruba a execução: entra no total com a flag `origin_source_unknown` e não gera estrato. |
| `sivep` | BR-03 (SIVEP-Gripe, CSV `;` INFLUD) | por semana epidemiológica dos primeiros sintomas, BRA e BR-UF (UF de residência), total e por `age_group`: SRAG, SRAG por influenza (`CLASSI_FIN=1`), A(H1N1)pdm09 (`PCR_FLUASU=1`), A(H3N2) (`=2`), A sem subtipo (`3,4`), óbitos (`EVOLUCAO=2`), óbitos H1N1, UTI (`UTI=1`) e completude de subtipagem (só nacional). **Período** = `SEM_PRI` quando válida (1..53), com ano epidemiológico = `epiWeek(DT_SIN_PRI).year` quando a data existe (senão o ano do arquivo); `DT_SIN_PRI` só define a semana quando `SEM_PRI` é inválida; divergências `SEM_PRI ≠ epiWeek(DT_SIN_PRI).week` são contadas (`rows_sem_pri_mismatch`). Idade: `TP_IDADE` 1/2 (dias/meses) → `0-4`, 3 → anos; `TP_IDADE` nulo/inválido ou `NU_IDADE_N` ausente → faixa `NA` (`rows_age_unknown`). Zeros explícitos de SE 1 até a última SE com dado; `provisional` nas 8 últimas semanas; `data_as_of` = data no nome do arquivo; flag `uf_ignored` no total nacional **e nos seus estratos** só nas semanas em que houve linhas sem UF válida. `retainRaw: false`. |
| `ibge` | BR-14 (agregado 6579 / variável 9324) | população residente estimada por ano, BRA + BR-UF. Anos sem resposta (2022, 2023) são ignorados. Confere as 27 UFs de `localidades/estados` com `BR_STATES`. |
| `worldbank` | INT-11 (`SP.POP.TOTL`) | população total por país (ISO3) e ano; ignora agregados (lista `/v2/country` com `region.id = NA`), códigos não ISO3 e valores nulos. |
| `ukhsa` | UK-01 (`influenza_testing_positivityByWeek`, England) | positividade semanal (ISO) em `ENG`; total = `age=all`, estratos `{age}` nas faixas publicadas pela UKHSA e previstas no `stratum_schema` (`0-4`, `5-14`, `15-44`, `45-64`, `65-79`, `80+`); outras faixas são descartadas e contadas (`age_skipped`); `provisional` quando `in_reporting_delay_period`. |

Definições de caso, universos e caveats estão em `packages/core/src/indicators.ts` e são seguidas literalmente.

## Microdados (SIVEP-Gripe)

O CSV do SIVEP contém registros individuais. O conector lê o arquivo em **streaming** (`csv-parse`, com BOM e datas ISO ou
`dd/mm/aaaa`) e mantém em memória apenas contadores por célula (indicador × geo × semana × faixa etária). Nenhuma linha
individual é persistida no banco nem em arquivo derivado, e o **CSV bruto é apagado** de `data/snapshots/br_sivep_gripe/`
logo após a agregação (`retainRaw: false`): o que fica é o sidecar `.meta.json` (sha256, bytes, url, fetched_at, licença,
`raw_file_deleted: true`, motivo "microdados individuais; apenas agregados são retidos"), suficiente para auditoria da
proveniência; reprocessar exige baixar o arquivo de novo. `--max-rows` existe só para desenvolvimento: a execução é
parcial, fica em quarentena e nunca é publicada (`max_rows`/`partial` no `validation_report`).

## Testes

`pnpm --filter @h1n1/connectors test` — sem rede: fixtures em `test/fixtures` (3 linhas reais do FluNet, 30 linhas sintéticas
do SIVEP com o cabeçalho real de 194 colunas, BOM e datas `dd/mm/aaaa`, subconjuntos reais do IBGE/Banco Mundial/UKHSA).
Cobrem `normalize()` de cada conector (SIVEP: período por `SEM_PRI`, `TP_IDADE` inválido → `NA`, `uf_ignored` por semana,
lista de indicadores igual aos `sivep_*` do core; FluNet: duplicatas, `ORIGIN_SOURCE` desconhecido, validação de `--country`),
`validate()` (regras por indicador e invariantes cruzadas), `parseFlexibleDate`, `http.downloadToFile` (servidor local:
retry de stream, 404, timeouts de cabeçalho e de corpo, remoção do parcial) e o pipeline fim a fim com PGlite `memory://`
e um conector fake (publicação, snapshot inicial em quarentena, reingestão idêntica no-op, quarentena com publicação anterior
vigente, `addError`, queda abrupta, carry-forward, `data_as_of` máximo, dry-run, `--max-rows`/`SIVEP_MAX_ROWS` parcial,
`retainRaw: false`, interrupção simulada no meio da publicação com rollback).

Consulta de sanidade pós-ingestão (últimas semanas de cada série, contagens por indicador, execuções e snapshots):
`pnpm --filter @h1n1/connectors exec tsx scripts/sanity.ts`.

## Adicionando um conector

Implemente `Connector` (`src/types.ts`): `id`, `sourceId` (catálogo), `indicators` (ontologia), `retainRaw` (opcional;
`false` para microdados individuais — o bruto é apagado após a normalização), `fetch(ctx)` → `RawSnapshot`
(arquivo em `ctx.tmpDir`, use `downloadToFile`/`writeRawFile`), `normalize(raw, ctx)` → `Observation[]` (ou `AsyncIterable`
de lotes para volumes grandes). Registre em `src/registry.ts`. Use `makeObs()` para derivar `period_start/end`,
`ctx.ensureGeo()` para geografias novas, `ctx.setCoverage()` para arquivos por período e `ctx.addError()` para erros de
integridade da origem que devem quarentenar a snapshot.
