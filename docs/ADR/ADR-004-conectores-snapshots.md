# ADR-004 · Conectores: `fetch → snapshot imutável → normalize → load`, com licença e hash em toda captura

**Status:** aceita · **Data:** 2026-10-20 · **Decisão do plano de execução:** A4 · **Relacionadas:** ADR-002, ADR-005

## Contexto

O catálogo oficial traz quatro orientações de ingestão que o plano torna obrigatórias: (1) coletar originais com timestamp, URL, hash e licença; (2) normalizar vocabulário (`pathogen`, `subtype`, `case_definition`, `epiweek`...); (3) preservar relação com origem e versão, sem somar canais espelhados; (4) tratar correções retrospectivas e `data_as_of`. As fontes variam de OData (FluNet) a CSV de 261 MB (SIVEP), JSON paginado (UKHSA), REST (IBGE, Banco Mundial, ENA, E-utilities) e PDF (China). Revisões retroativas são frequentes e devem ser mensuráveis (pesquisa R07). Microdados exigem minimização (LGPD_E_PRIVACIDADE.md).

## Decisão

Todo conector em `packages/connectors` implementa quatro etapas, nesta ordem, com persistência entre elas (`src/pipeline.ts`, `runConnector`):

1. **fetch** — baixa o recurso para `data/snapshots/<slug_da_fonte>/<YYYYMMDDTHHmmss>_<sha256[0:12]>.<ext>` (gitignored) e grava o sidecar `.meta.json` ao lado (`url`, `urls`, `fetched_at`, `sha256`, `bytes`, `content_type`, `license`, `data_as_of`, opções, `retain_raw`, `raw_file_deleted`). Registra em `snapshots`: `source_id`, `url`, `fetched_at`, `sha256`, `bytes`, `content_type`, `license` (da fonte, nunca presumida), `storage_path`, `data_as_of` (data de corte declarada pela fonte ou extraída do nome do arquivo/payload), `status` (`ok`/`failed`/`quarantined`) e `notes`. Snapshots são **imutáveis**: nunca sobrescritas; o status só avança como descrito abaixo. Se já existe snapshot `ok` da mesma fonte com o mesmo `sha256`, a ingestão termina como `unchanged` (exceto com `--force`).
2. **normalize** — transforma o bruto em `Observation[]` conforme a ontologia (`packages/core`): `indicator_id`, `geo_level/geo_code`, `period_type/period/period_start/period_end`, `value`, `denominator`, `stratum`, `update_status`, `quality_flags`. Para microdados, **em streaming** e só agregados; nenhuma linha individual é persistida. Conectores com `retainRaw: false` (hoje só `sivep`) têm o **arquivo bruto apagado logo após a normalização**: permanece o sidecar com `raw_file_deleted: true` e o motivo "microdados individuais; apenas agregados são retidos", e `snapshots.storage_path` fica `null`. Reprocessar exige baixar o arquivo de novo.
3. **load** — a snapshot **nasce `quarantined`** (notes "em processamento") e as observações são gravadas em lotes de 1.000 associadas ao `snapshot_id` (constraint de unicidade por célula). Carregar não publica.
4. **validate + publish** — executa as validações abaixo e, se aprovado, uma **única transação** faz o carry-forward, o `publishIndicator` de **todos** os indicadores do conector e a mudança da snapshot para **`ok`** (a publicação anterior do indicador vira `superseded` em `indicator_publications`). Se reprovado, a snapshot permanece `quarantined` com os erros em `notes`, `rejectPublication` registra a publicação `rejected` com o relatório e a publicação vigente anterior permanece (ADR-005, regra 10). Exceção no meio da publicação reverte tudo e marca a snapshot `failed`.

### Validação (`src/validate.ts`)

- Por indicador: sem valor negativo nem `NaN`/infinito; período válido para o tipo (`AAAA-Www` 01–53, `AAAA-Mnn`, `AAAA`) e `period_type` igual ao da ontologia; `geo_code` existente em `geo` e `geo_level` permitido; estratos dentro do `stratum_schema`; percentuais em 0..100; denominador presente quando a ontologia exige; indicador esperado sem nenhuma observação é erro; **queda abrupta** (contagem < 90 % da publicação vigente, comparada só dentro da cobertura declarada pelo conector).
- **Invariantes cruzadas** por célula (geo, período, estrato), avaliadas quando todos os termos existem: SIVEP `ah1n1pdm09_confirmed ≤ influenza_confirmed ≤ notifications` (cadeia H1N1 ≤ influenza ≤ notificações); `ah1n1pdm09_deaths ≤ influenza_deaths ≤ influenza_confirmed` (óbitos); `influenza_icu ≤ influenza_confirmed` (UTI); para cada indicador de contagem do SIVEP, **soma dos estratos `age_group` = total** e **soma das UFs ≤ total nacional**; FluNet `ah1n1pdm09 + ah3 + não subtipada + não subtipável ≤ inf_a` e `inf_a ≤ inf_all` (subtipos ≤ inf_a ≤ inf_all).
- Erros que o conector reporta via `ctx.addError()` (ex.: linhas duplicadas na origem do FluNet) entram no relatório e quarentenam a snapshot sem derrubar a execução. O relatório completo (por indicador, `cross_checks`, `connector_errors`) vai para `indicator_publications.validation_report`.

Cada execução grava `ingestion_runs` (`connector`, `status`, `rows_in`, `rows_out`, `snapshot_id`, `error`, `params`). A CLI (`pnpm ingest <conector> [--year] [--country] [--years] [--force] [--dry-run] [--max-rows]`) é a única porta de ingestão; não há endpoint HTTP de escrita.

Regras adicionais:

- `mirror_group` acompanha a fonte; conectores de fontes espelhadas nunca escrevem no mesmo `indicator_id`.
- **Carry-forward entre anos**: um conector pode declarar a cobertura temporal da snapshot (`ctx.setCoverage`); ao publicar, as observações da publicação vigente **fora** dessa cobertura são copiadas para a nova snapshot com a flag `carried_forward`. É assim que `sivep --year 2025` e `--year 2026` compõem uma única série vigente.
- O `data_as_of` da publicação é o **máximo** entre o da nova snapshot e o da publicação vigente (carga retroativa não rebaixa a data).
- **Execução parcial** (`--max-rows` ou `SIVEP_MAX_ROWS`) **nunca publica**: a snapshot fica `quarantined` com a nota "execução parcial (max-rows=N); não publicável", nenhuma publicação é registrada nem rejeitada, e a execução não bloqueia a próxima ingestão completa.
- Geografias novas (países do FluNet e do Banco Mundial) são garantidas na tabela `geo` pelo pipeline (`ctx.ensureGeo`) antes da validação.

### Pendente (não implementado)

- **Detecção de mudança de esquema**: a flag `schema_changed` **não existe** no código; hoje uma coluna nova ou ausente só é pega indiretamente (estrato fora do `stratum_schema`, indicador sem observações, queda abrupta).
- **Conector `manual`** (registro de snapshot de PDF/portal com hash e normalização vazia): **não existe**; fontes sem acesso programático seguem sem ingestão.
- **`data_as_of` obrigatório**: o pipeline não quarentena snapshot sem `data_as_of`; `publishIndicator` aceita `null`. A regra original (sem `data_as_of`, quarentena) está pendente.
- Alerta em duas falhas consecutivas (S3-09) e política de retenção de snapshots (S5-07).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| ETL direto na tabela de observações, sem snapshot | Perde reprodutibilidade, diff entre versões e prova de origem; viola orientação 1 do catálogo |
| Orquestrador externo (Airflow, Dagster, n8n) desde o MVP | Sobrecarga operacional; a CLI agendada por cron/CI basta até haver dezenas de fontes; pode ser adotado por cima da CLI |
| Guardar microdados no banco para flexibilidade analítica | Viola minimização (LGPD) e aumenta risco; o conector agrega em streaming e apaga o bruto; análises ad hoc exigem baixar o arquivo de novo, em processo isolado e sem persistir linhas |
| Publicar automaticamente a snapshot mais recente | Viola regra 10; uma ingestão com erro substituiria dado válido |

## Consequências

- Positivas: cada número da API rastreia até um arquivo com hash; revisões retroativas são mensuráveis (`/v1/diff`); falhas não contaminam o publicado; licenças ficam registradas por captura.
- Negativas: armazenamento cresce com as fontes que retêm o bruto (o SIVEP, ~261 MB por ingestão, é apagado após a agregação e deixa só o sidecar); exige política de retenção (LGPD §6); normalizadores precisam de fixtures e testes por fonte.
- Obrigações: fixture pequena por conector em testes (70 testes em `packages/connectors`); validação de esquema por versão de dicionário (pendente, ver "Pendente"); alerta em duas falhas consecutivas.
