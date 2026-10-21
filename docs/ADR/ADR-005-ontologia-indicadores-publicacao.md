# ADR-005 · Ontologia explícita de indicadores, supressão na publicação e publicação bloqueada por validação

**Status:** aceita (validada por revisão epidemiológica em 2026-10-20) · **Data:** 2026-10-20 · **Decisões do plano de execução:** A5 e A8 · **Relacionadas:** ADR-002, ADR-004, ADR-006

## Contexto

As regras 1, 2, 3, 5, 9 e 10 de integridade (plano 10.4) exigem que H1N1 confirmado, influenza A não subtipada, SRAG e síndrome gripal sejam entidades distintas; que canais espelhados não sejam somados; que células pequenas não sejam divulgadas; e que publicações com falha sejam bloqueadas mantendo a versão anterior. Essas regras não podem depender de disciplina editorial: precisam estar no código que todos os consumidores compartilham.

A validação epidemiológica fixou as definições: H1N1 confirmado no SIVEP = `CLASSI_FIN = 1 AND PCR_FLUASU = 1`; UF de residência `SG_UF`; semana `SEM_PRI`; `ANOTSUBTYPED` e `ANOTSUBTYPABLE` do FluNet separados; óbito = `EVOLUCAO = 2` (exclui 3) com rótulo "óbitos entre SRAG com H1N1 confirmado", nunca "mortes por H1N1"; supressão < 5 em UF × semana × faixa etária com supressão complementar; totais nacionais não suprimidos; semana epidemiológica brasileira com SE 1 contendo 1º de janeiro quando cai de domingo a quinta (verificado em SIVEP 2021, 2022, 2025, 2026); textos de universo literais para FluNet e SIVEP.

## Decisão

1. **Ontologia em código** (`packages/core/src/indicators.ts`): `INDICATORS` é a lista fechada de indicadores, cada um com `id`, `source_id`, `case_definition` (campos literais), `measurement`, `unit`, `universe_note` (obrigatório), `methodology_version`, `geo_levels`, `period_type`, `event_date_basis`, `stratum_schema`, `mirror_group`, `suppression_threshold`, `denominator_indicator_id`, `min_denominator`, `caveats`. A tabela `indicators` é semeada a partir dela; a API e a UI leem a tabela. Não existe indicador fora de `INDICATORS`.
2. **Mudança de definição = novo id.** Um `indicator_id` nunca muda de definição; mudanças metodológicas criam outro id com outro `methodology_version` (CONTRATO_API §6).
3. **`MIRROR_GROUPS`** (`who_flu`, `br_srag`, `insdc`, `cdc_fluview`, `usda_swine`) vive em `core`; `mirrorGroupOf(source_id)` preenche `sources.mirror_group`. Somar fontes do mesmo grupo é erro de consumidor, documentado e exibido no catálogo.
4. **Semanas** (`packages/core/src/epiweek.ts`): três convenções (`br`, `mmwr`, `iso`) com funções distintas; `period_type` distingue `epiweek` (BR) de `isoweek`; conversão entre convenções só por data.
5. **Supressão só na camada de publicação** (`applySuppression` em `getSeries`): o banco guarda agregados completos; a API aplica `suppression_threshold` (5 para SIVEP), isenta totais nacionais sem estrato, aplica supressão complementar por grupo (mesmo geo/período) e nunca expõe o valor bruto. Razões com `denominator < min_denominator` saem `null` com flag. O CSV usa a mesma saída.
6. **Publicação bloqueada por validação** (`indicator_publications`): `publishIndicator` é transacional (supersede a `current` e insere a nova); `rejectPublication` registra `rejected` com `validation_report`; `getSeries` só lê a `current`. Uma snapshot com falha nunca substitui dado válido; a API continua servindo a anterior com seu `data_as_of`.
7. **Textos literais**: `universe_note` do FluNet e do SIVEP, e os rótulos de óbito, são strings únicas em `core`, reutilizadas por API e UI; lint proíbe "mortes por H1N1", "casos de H1N1" (para SRAG) e "tempo real".

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Indicadores configurados em YAML/JSON editável sem tipos | Perde verificação de tipos e de `satisfies`; facilita definições incompletas (sem `universe_note`) |
| Supressão na ingestão (gravar já suprimido) | Impede supressão complementar correta quando novos estratos são adicionados, impede diff real entre snapshots e impossibilita recalcular com outro limiar sem reingestão |
| Supressão na UI | Qualquer consumidor da API (CSV, terceiros) receberia valores brutos |
| Publicar sempre a snapshot mais recente | Viola regra 10; erro de fonte vira erro publicado |
| Um indicador "influenza A" com estrato de subtipo | Convida a somar e a tratar "não subtipado" como H1N1; a separação em ids distintos é deliberada |
| Converter todas as semanas para ISO no banco | Destrói a semana de origem (`SEM_PRI`) e cria falsa comparabilidade; `period_start` já permite alinhar por data |

## Consequências

- Positivas: a regra central está em um lugar; a UI não consegue exibir número sem universo (campo obrigatório); supressão idêntica em JSON e CSV; revisões retroativas mensuráveis; publicação segura.
- Negativas: adicionar indicador exige PR em `core` + seed + revisão metodológica (intencional); o endpoint `/v1/diff` compara observações **antes** da supressão e precisa aplicar o limiar antes de responder (pendência registrada em CONTRATO_API §3.11 e S3-07).
- Obrigações: testes para `applySuppression` (simples e complementar), `epiWeek` em viradas de ano (28/12, 01/01, 04/01) e para o normalizador SIVEP com fixture cobrindo `PCR_FLUASU` 1–4 e `EVOLUCAO` 2 vs 3.
