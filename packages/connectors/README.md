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

Os arquivos brutos ficam em `data/snapshots/<slug_da_fonte>/<YYYYMMDDTHHmmss>_<sha256[0:12]>.<ext>` com sidecar `.meta.json`
(`url`, `urls`, `fetched_at`, `sha256`, `bytes`, `content_type`, `license`, `data_as_of`, opções). A pasta é gitignored.

## Pipeline (`src/pipeline.ts`)

1. Abre `ingestion_runs` com status `running`.
2. `fetch()` grava o arquivo bruto (streaming para disco, hash calculado no fluxo) e o sidecar.
3. Idempotência: se já existe snapshot `ok` da mesma fonte com o mesmo sha256, registra "sem mudança" e encerra (exceto `--force`).
4. Insere `snapshots` (`ok`), roda `normalize()` e grava `observations` em lotes de 1.000 dentro de transação; códigos geo novos
   (países do FluNet/Banco Mundial) são garantidos na tabela `geo` antes da validação.
5. Validação (abaixo). Se passar: `publishIndicator()` para cada indicador do conector, com `data_as_of`. Se falhar:
   snapshot vira `quarantined`, `rejectPublication()` é registrado e a publicação anterior permanece vigente (regra 10 de integridade).
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

Falha em qualquer indicador coloca a snapshot inteira em quarentena. O relatório vai para `indicator_publications.validation_report`.
A supressão de células pequenas **não** é feita aqui: ela é aplicada na leitura (`getSeries` em `@h1n1/db`).

## Conectores

| id | fonte | o que produz |
|---|---|---|
| `flunet` | INT-01 (OMS FluNet, OData `VIW_FNT`) | por país (ISO3) e semana ISO: amostras processadas, detecções A(H1N1)pdm09, A(H3), influenza A, A não subtipada, A não subtipável, B, total; razões `share_of_inf_a` e `positivity` (denominador gravado; valor nulo se denominador < 20 ou numerador > denominador). Total = soma das origens (null = ausente, nunca zero) + estratos `origin_source`. `provisional` nas 4 últimas semanas. `data_as_of` = maior `ISO_WEEKSTARTDATE` + 6 dias. |
| `sivep` | BR-03 (SIVEP-Gripe, CSV `;` INFLUD) | por semana epidemiológica dos primeiros sintomas, BRA e BR-UF (UF de residência), total e por `age_group`: SRAG, SRAG por influenza (`CLASSI_FIN=1`), A(H1N1)pdm09 (`PCR_FLUASU=1`), A(H3N2) (`=2`), A sem subtipo (`3,4`), óbitos (`EVOLUCAO=2`), óbitos H1N1, UTI (`UTI=1`) e completude de subtipagem (só nacional). Zeros explícitos de SE 1 até a última SE com dado; `provisional` nas 8 últimas semanas; `data_as_of` = data no nome do arquivo; flag `uf_ignored` no total nacional quando há linhas sem UF válida. |
| `ibge` | BR-14 (agregado 6579 / variável 9324) | população residente estimada por ano, BRA + BR-UF. Anos sem resposta (2022, 2023) são ignorados. Confere as 27 UFs de `localidades/estados` com `BR_STATES`. |
| `worldbank` | INT-11 (`SP.POP.TOTL`) | população total por país (ISO3) e ano; ignora agregados (lista `/v2/country` com `region.id = NA`), códigos não ISO3 e valores nulos. |
| `ukhsa` | UK-01 (`influenza_testing_positivityByWeek`, England) | positividade semanal (ISO) em `ENG`; total = `age=all`, estratos `{age}` apenas nas faixas do `stratum_schema`; `provisional` quando `in_reporting_delay_period`. |

Definições de caso, universos e caveats estão em `packages/core/src/indicators.ts` e são seguidas literalmente.

## Microdados (SIVEP-Gripe)

O CSV do SIVEP contém registros individuais. O conector lê o arquivo em **streaming** (`csv-parse`) e mantém em memória
apenas contadores por célula (indicador × geo × semana × faixa etária). Nenhuma linha individual é persistida no banco
nem em arquivo derivado; o único artefato é o CSV bruto em `data/snapshots/br_sivep_gripe/` (gitignored), necessário para
auditoria e reprocessamento. `--max-rows` existe só para desenvolvimento e fica registrado no `validation_report`.

## Testes

`pnpm --filter @h1n1/connectors test` — sem rede: fixtures em `test/fixtures` (3 linhas reais do FluNet, 30 linhas sintéticas
do SIVEP com o cabeçalho real de 194 colunas, subconjuntos reais do IBGE/Banco Mundial/UKHSA). Cobrem `normalize()` de cada
conector, `validate()` e o pipeline fim a fim com PGlite `memory://` e um conector fake (publicação, reingestão idêntica
no-op, quarentena com publicação anterior vigente, queda abrupta, carry-forward, dry-run).

Consulta de sanidade pós-ingestão (últimas semanas de cada série, contagens por indicador, execuções e snapshots):
`pnpm --filter @h1n1/connectors exec tsx scripts/sanity.ts`.

## Adicionando um conector

Implemente `Connector` (`src/types.ts`): `id`, `sourceId` (catálogo), `indicators` (ontologia), `fetch(ctx)` → `RawSnapshot`
(arquivo em `ctx.tmpDir`, use `downloadToFile`/`writeRawFile`), `normalize(raw, ctx)` → `Observation[]` (ou `AsyncIterable`
de lotes para volumes grandes). Registre em `src/registry.ts`. Use `makeObs()` para derivar `period_start/end` e
`ctx.ensureGeo()` para geografias novas.
