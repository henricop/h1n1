# ADR-004 · Conectores: `fetch → snapshot imutável → normalize → load`, com licença e hash em toda captura

**Status:** aceita · **Data:** 2026-10-20 · **Decisão do plano de execução:** A4 · **Relacionadas:** ADR-002, ADR-005

## Contexto

O catálogo oficial traz quatro orientações de ingestão que o plano torna obrigatórias: (1) coletar originais com timestamp, URL, hash e licença; (2) normalizar vocabulário (`pathogen`, `subtype`, `case_definition`, `epiweek`...); (3) preservar relação com origem e versão, sem somar canais espelhados; (4) tratar correções retrospectivas e `data_as_of`. As fontes variam de OData (FluNet) a CSV de 261 MB (SIVEP), JSON paginado (UKHSA), REST (IBGE, Banco Mundial, ENA, E-utilities) e PDF (China). Revisões retroativas são frequentes e devem ser mensuráveis (pesquisa R07). Microdados exigem minimização (LGPD_E_PRIVACIDADE.md).

## Decisão

Todo conector em `packages/connectors` implementa quatro etapas, nesta ordem, com persistência entre elas:

1. **fetch** — baixa o recurso para `data/snapshots/<source_id>/<timestamp>_<nome>` (gitignored). Registra em `snapshots`: `source_id`, `url`, `fetched_at`, `sha256`, `bytes`, `content_type`, `license` (da fonte, nunca presumida), `storage_path`, `data_as_of` (data de corte declarada pela fonte ou extraída do nome/arquivo), `status` (`ok`/`failed`/`quarantined`). Snapshots são **imutáveis**: nunca sobrescritas.
2. **normalize** — transforma o bruto em `Observation[]` conforme a ontologia (`packages/core`): `indicator_id`, `geo_level/geo_code`, `period_type/period/period_start/period_end`, `value`, `denominator`, `stratum`, `update_status`, `quality_flags`. Para microdados, **em streaming** e só agregados; nenhuma linha individual é persistida.
3. **load** — grava observações associadas ao `snapshot_id` (constraint de unicidade por célula). Carregar não publica.
4. **validate + publish** — executa validações (esquema, domínios, sem negativos, totais ≥ estratos, semanas no intervalo, mudança abrupta vs snapshot anterior) e, se aprovado, `publishIndicator` marca a snapshot como `current` (atômico; a anterior vira `superseded`). Se reprovado, `rejectPublication` registra o relatório e a publicação anterior permanece (ADR-005, regra 10).

Cada execução grava `ingestion_runs` (`connector`, `status`, `rows_in`, `rows_out`, `snapshot_id`, `error`, `params`). A CLI (`pnpm ingest <conector> [--year]`) é a única porta de ingestão; não há endpoint HTTP de escrita.

Regras adicionais:

- `mirror_group` acompanha a fonte; conectores de fontes espelhadas nunca escrevem no mesmo `indicator_id`.
- `data_as_of` é obrigatório para publicar; sem ele, a snapshot fica `quarantined`.
- Mudança de esquema detectada (colunas ausentes/novas) gera `quality_flags: ['schema_changed']` e bloqueia publicação até revisão humana.
- Fontes manuais (PDF, portal) seguem o mesmo fluxo: o humano baixa, o conector `manual` registra snapshot com hash; normalização pode ser vazia (apenas referência).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| ETL direto na tabela de observações, sem snapshot | Perde reprodutibilidade, diff entre versões e prova de origem; viola orientação 1 do catálogo |
| Orquestrador externo (Airflow, Dagster, n8n) desde o MVP | Sobrecarga operacional; a CLI agendada por cron/CI basta até haver dezenas de fontes; pode ser adotado por cima da CLI |
| Guardar microdados no banco para flexibilidade analítica | Viola minimização (LGPD) e aumenta risco; análises ad hoc podem rodar sobre a snapshot em processo isolado, sem persistir |
| Publicar automaticamente a snapshot mais recente | Viola regra 10; uma ingestão com erro substituiria dado válido |

## Consequências

- Positivas: cada número da API rastreia até um arquivo com hash; revisões retroativas são mensuráveis (`/v1/diff`); falhas não contaminam o publicado; licenças ficam registradas por captura.
- Negativas: armazenamento cresce (SIVEP ~261 MB por ingestão); exige política de retenção (LGPD §6); normalizadores precisam de fixtures e testes por fonte.
- Obrigações: fixture pequena por conector em testes; validação de esquema por versão de dicionário; alerta em duas falhas consecutivas.
