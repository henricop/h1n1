# H1N1 · Dicionário de indicadores

**Versão:** 1.0 · **Data:** 2026-10-20 · **Fonte de verdade:** `packages/core/src/indicators.ts` (`INDICATORS`, `MIRROR_GROUPS`) e `packages/core/src/epiweek.ts`. Este documento é a leitura humana dessas definições; em caso de divergência, o código prevalece e este arquivo deve ser atualizado. A página `/dados/metodologia/` renderiza a tabela de indicadores a partir de `INDICATORS` do `@h1n1/core` (importado pelo site; é a mesma fonte que alimenta `/v1/indicators`, via seed da tabela `indicators`), não deste arquivo.

**Regra central (plano 10.4):** H1N1 confirmado ≠ influenza A não subtipada ≠ SRAG ≠ síndrome gripal ≠ registro de vacina.

Total: **22 indicadores** — 10 FluNet (INT-01), 9 SIVEP-Gripe (BR-03), 2 denominadores (BR-14, INT-11), 1 UKHSA (UK-01).

---

## 1. Como ler cada bloco

| Campo | Significado |
|---|---|
| id | Identificador estável usado em `/v1/series?indicator=` |
| Fonte | `source_id` do catálogo |
| Definição de caso | Campos literais do arquivo/API de origem que selecionam o registro |
| Universo | Texto obrigatório exibido junto a qualquer número (`universe_note`) |
| Período / base de data | `period_type` e `event_date_basis` |
| Estratos | `stratum_schema`; `{}` = apenas total |
| Supressão | `suppression_threshold` (0 = nenhuma) e, para razões, `min_denominator` |
| Caveats | O que o número **não** permite concluir |

Convenções: `epiweek` = semana epidemiológica brasileira (domingo–sábado); `isoweek` = ISO 8601 (segunda–domingo); `year` = ano de referência.

---

## 2. FluNet (OMS / GISRS) — fonte INT-01

Base comum: `measurement: count`, `unit: detections` (exceto onde indicado), `methodology_version: flunet-v1`, `geo_levels: [country]`, `period_type: isoweek`, `event_date_basis: specimen_processing`, estrato `origin_source ∈ {SENTINEL, NONSENTINEL, NOTDEFINED}`, `mirror_group: who_flu`, supressão 0 (dados já agregados pela OMS).

Universo (literal): **"Os números representam detecções de influenza em amostras processadas por laboratórios que reportam à OMS (FluNet), não todos os casos de H1N1 da população."**

Caveats comuns:
- Detecção laboratorial não é incidência populacional; depende de quantas amostras foram processadas.
- A semana é a de processamento da amostra, que pode diferir da semana da coleta.
- Sentinela e não sentinela têm universos diferentes e não devem ser comparados como se fossem a mesma rede.

Endpoint verificado em 2026-10-20: `xmart-api-public.who.int/FLUMART/VIW_FNT` (OData), 1.739 semanas para `COUNTRY_CODE = BRA`.

### flunet_specimens_processed
- **Nome:** Amostras processadas para influenza (FluNet)
- **Definição de caso:** `SPEC_PROCESSED_NB` por país e semana ISO, com estrato por `ORIGIN_SOURCE`.
- **Unidade:** specimens
- **Uso:** denominador de `flunet_influenza_positivity`.

### flunet_ah1n1pdm09_detections
- **Nome:** Detecções de A(H1N1)pdm09 (FluNet)
- **Definição de caso:** `AH1N12009` por país e semana ISO.
- **Observação:** é o indicador H1N1 específico do FluNet. Não somar com `flunet_inf_a_detections` (que já o contém) nem com `flunet_inf_a_not_subtyped`.

### flunet_ah3_detections
- **Nome:** Detecções de A(H3) (FluNet)
- **Definição de caso:** `AH3` por país e semana ISO.

### flunet_inf_a_detections
- **Nome:** Detecções de influenza A, todos os subtipos (FluNet)
- **Definição de caso:** `INF_A` por país e semana ISO.
- **Observação:** inclui H1N1pdm09, H3, não subtipadas e não subtipáveis. Denominador de `flunet_ah1n1pdm09_share_of_inf_a`.

### flunet_inf_a_not_subtyped
- **Nome:** Influenza A não subtipada (FluNet)
- **Definição de caso:** `ANOTSUBTYPED` por país e semana ISO.
- **Caveat adicional:** não subtipada significa que o subtipo não foi testado; não deve ser contada como H1N1.

### flunet_inf_a_not_subtypable
- **Nome:** Influenza A não subtipável (FluNet)
- **Definição de caso:** `ANOTSUBTYPABLE` por país e semana ISO.
- **Caveat adicional:** não subtipável significa testada sem resultado; não deve ser contada como H1N1.
- **Observação:** `ANOTSUBTYPED` e `ANOTSUBTYPABLE` são colunas distintas no FluNet e permanecem indicadores distintos.

### flunet_inf_b_detections
- **Nome:** Detecções de influenza B (FluNet)
- **Definição de caso:** `INF_B` por país e semana ISO.

### flunet_inf_all_detections
- **Nome:** Detecções de influenza, A e B (FluNet)
- **Definição de caso:** `INF_ALL` por país e semana ISO.
- **Uso:** numerador de `flunet_influenza_positivity`.

### flunet_ah1n1pdm09_share_of_inf_a
- **Nome:** Participação de A(H1N1)pdm09 entre influenza A (FluNet)
- **Definição de caso:** `100 × AH1N12009 / INF_A` por país e semana ISO.
- **Medida/unidade:** percent / percent
- **Denominador:** `flunet_inf_a_detections`; `min_denominator: 20` (semanas com `INF_A < 20` saem com `value: null` e flag `denominator_below_minimum`).
- **Caveat adicional:** depende da estratégia de subtipagem; semanas com poucas detecções de influenza A são suprimidas.

### flunet_influenza_positivity
- **Nome:** Positividade para influenza (FluNet)
- **Definição de caso:** `100 × INF_ALL / SPEC_PROCESSED_NB` por país e semana ISO.
- **Medida/unidade:** percent / percent
- **Denominador:** `flunet_specimens_processed`; `min_denominator: 20`.
- **Caveat adicional:** positividade depende de quem é testado; não é prevalência na população.

---

## 3. SIVEP-Gripe (Ministério da Saúde / DATASUS) — fonte BR-03

Base comum: `measurement: count`, `unit: notifications` (exceto óbitos: `deaths`), `methodology_version: sivep-v1`, `geo_levels: [country, state]`, `period_type: epiweek`, `event_date_basis: symptom_onset`, estrato `age_group ∈ {0-4, 5-14, 15-29, 30-49, 50-64, 65+, NA}`, `mirror_group: br_srag`, **supressão 5** (recortes por UF e/ou faixa etária; totais nacionais sem estrato nunca suprimidos; supressão complementar ativa).

Universo (literal): **"Os números representam notificações de síndrome respiratória aguda grave (SRAG) hospitalizada registradas no SIVEP-Gripe e classificadas segundo o dicionário de dados, não todos os casos de H1N1 da população."**

Campos literais do arquivo `INFLUD<aa>-<dd-mm-aaaa>.csv` (separador `;`), conforme dicionário 2019–2025:

| Campo | Uso no H1N1 |
|---|---|
| `SG_UF` | UF de **residência** → `geo_code = BR-<UF>`; ignorado/exterior fica fora dos recortes por estado, mas entra no total `BRA` |
| `SEM_PRI` | Semana epidemiológica dos **primeiros sintomas** → `period` (convenção brasileira). Usada quando válida (1..53); o **ano** do período é o de `epiWeek(DT_SIN_PRI)` quando a data existe (senão, o ano do arquivo) |
| `DT_SIN_PRI` | Data dos primeiros sintomas: só define a **semana** quando `SEM_PRI` é inválida; divergências `SEM_PRI ≠ epiWeek(DT_SIN_PRI).week` são contadas no relatório da ingestão (`rows_sem_pri_mismatch`) |
| `CLASSI_FIN` | Classificação final; `1` = SRAG por influenza |
| `TP_FLU_PCR` | Tipo de influenza por RT-PCR; `1` = influenza A |
| `PCR_FLUASU` | Subtipo de influenza A por RT-PCR; `1` = A(H1N1)pdm09; `2` = A(H3N2); `3` = não subtipado; `4` = não subtipável |
| `EVOLUCAO` | `1` cura; `2` óbito; `3` óbito por outras causas; `9` ignorado |
| `UTI` | `1` = internação em UTI |
| `NU_IDADE_N` + `TP_IDADE` | Idade → `age_group` via `ageGroupFromYears` |

Caveats comuns:
- Semanas recentes estão sujeitas a atraso de notificação e digitação; os valores são provisórios e tendem a subir em revisões. O conector marca como `provisional` as **8 últimas semanas epidemiológicas** do arquivo (a partir da última SE com dado).
- A base contém apenas SRAG hospitalizada ou óbito por SRAG; não mede infecções leves.
- A UF é a de residência do paciente (`SG_UF`); a semana é a dos primeiros sintomas (`SEM_PRI`).
- Registros com UF ignorada ou residência fora do Brasil ficam fora dos recortes por estado, mas contam no total `BRA`; nas semanas em que isso ocorreu, o total nacional e seus estratos levam a flag `uf_ignored` (a soma das UFs pode ser menor que o nacional).

Arquivo verificado em 2026-10-20: `INFLUD26-19-10-2026.csv` (261 MB, CC-BY).

### sivep_srag_notifications
- **Nome:** Notificações de SRAG hospitalizada (SIVEP-Gripe)
- **Definição de caso:** registros do arquivo INFLUD por `SG_UF` e `SEM_PRI`, independentemente do agente.
- **Observação:** denominador contextual; **não é** influenza nem H1N1.

### sivep_srag_influenza_confirmed
- **Nome:** SRAG por influenza (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1`.
- **Caveat adicional:** inclui influenza A e B, subtipadas ou não; não é exclusivo de H1N1.

### sivep_srag_ah1n1pdm09_confirmed
- **Nome:** SRAG por influenza A(H1N1)pdm09 confirmada por RT-PCR (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1 AND PCR_FLUASU = 1`.
- **Caveat adicional:** depende de coleta e subtipagem por RT-PCR; casos de influenza A sem subtipo não entram aqui.
- **Rótulo de UI:** "SRAG com A(H1N1)pdm09 confirmada". Nunca "casos de H1N1".
- **Observação:** é o indicador principal da home e do observatório.

### sivep_srag_ah3n2_confirmed
- **Nome:** SRAG por influenza A(H3N2) confirmada por RT-PCR (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1 AND PCR_FLUASU = 2`.

### sivep_srag_inf_a_not_subtyped
- **Nome:** SRAG por influenza A sem subtipo definido (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1 AND PCR_FLUASU IN (3, 4)`.
- **Caveat adicional:** não deve ser somado a H1N1; subtipo desconhecido.
- **Observação:** diferentemente do FluNet, o SIVEP agrupa "não subtipado" (3) e "não subtipável" (4) num só indicador, porque a distinção no campo `PCR_FLUASU` tem completude baixa; a separação pode ser feita em versão futura (`sivep-v2`) como novo id.

### sivep_srag_influenza_deaths
- **Nome:** Óbitos entre SRAG por influenza (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1 AND EVOLUCAO = 2`. Exclui `EVOLUCAO = 3` (óbito por outras causas).
- **Unidade:** deaths
- **Caveat adicional:** o SIVEP não registra causa básica do óbito; trata-se de óbitos entre casos de SRAG por influenza, não de "mortes causadas por influenza".

### sivep_srag_ah1n1pdm09_deaths
- **Nome:** Óbitos entre SRAG por A(H1N1)pdm09 confirmada (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1 AND PCR_FLUASU = 1 AND EVOLUCAO = 2`.
- **Unidade:** deaths
- **Caveat adicional:** óbitos entre casos de SRAG com H1N1 confirmado por RT-PCR, não "mortes causadas por H1N1".
- **Rótulo de UI obrigatório:** "óbitos entre SRAG com H1N1 confirmado". A expressão "mortes por H1N1" é proibida em UI e conteúdo (lint).

### sivep_srag_influenza_icu
- **Nome:** SRAG por influenza com internação em UTI (SIVEP-Gripe)
- **Definição de caso:** `CLASSI_FIN = 1 AND UTI = 1`.

### sivep_srag_influenza_subtype_completeness
- **Nome:** Completude de subtipagem entre SRAG por influenza A (SIVEP-Gripe)
- **Definição de caso:** `100 × (PCR_FLUASU IN (1,2)) / (TP_FLU_PCR = 1)`, ambos com `CLASSI_FIN = 1`.
- **Medida/unidade:** percent / percent
- **Estratos:** nenhum (`{}`)
- **Supressão:** 0 (indicador de qualidade); `min_denominator: 20`.
- **Caveat:** indicador de qualidade de dado; semanas com menos de 20 casos de influenza A por RT-PCR são suprimidas.
- **Uso:** contextualiza quanto do "influenza A" de uma semana pôde ser atribuído a um subtipo; quedas na completude explicam parte das oscilações do H1N1 confirmado.

---

## 4. Denominadores

### ibge_population_estimate
- **Nome:** População residente estimada (IBGE)
- **Fonte:** BR-14 (agregado 6579, variável 9324 da API de agregados; verificado em 2026-10-20)
- **Definição de caso:** população residente estimada em 1º de julho.
- **Medida/unidade:** count / persons · `geo_levels: [country, state]` · `period_type: year` · `event_date_basis: reference_year` · sem estratos · supressão 0 · `mirror_group: null`
- **Universo:** "Estimativa populacional oficial usada como denominador; fixar a versão do denominador em cada taxa."
- **Caveat:** estimativa, não contagem censitária.
- **Uso:** taxas por 100 mil (não calculadas no MVP; ao calcular, registrar `methodology_version` do denominador).

### worldbank_population_total
- **Nome:** População total (Banco Mundial, SP.POP.TOTL)
- **Fonte:** INT-11 (verificado em 2026-10-20)
- **Definição de caso:** `SP.POP.TOTL` por país e ano.
- **Medida/unidade:** count / persons · `geo_levels: [country]` · `period_type: year` · `event_date_basis: reference_year` · sem estratos · supressão 0
- **Universo:** "Denominador demográfico para comparações internacionais; não é dado epidemiológico."
- **Caveat:** séries podem ser revisadas retroativamente pelo Banco Mundial.

---

## 5. UKHSA (Inglaterra) — fonte UK-01

### ukhsa_influenza_testing_positivity
- **Nome:** Positividade de testes para influenza, Inglaterra (UKHSA)
- **Definição de caso:** métrica `influenza_testing_positivityByWeek`, geografia `England`, estrato padrão, por semana (verificado em 2026-10-20: 3.933 registros).
- **Medida/unidade:** percent / percent · `geo_levels: [country]` (código `ENG`) · `period_type: isoweek` · `event_date_basis: specimen_processing` · estrato `age ∈ {all, 0-4, 5-14, 15-44, 45-64, 65-79, 80+}` · supressão 0 · `mirror_group: null`
- **Universo:** "Os números representam a positividade de testes laboratoriais reportados à UKHSA na Inglaterra, não casos de H1N1 nem incidência populacional."
- **Caveats:** influenza geral, sem subtipo; não é H1N1. Semanas em período de atraso de notificação (`in_reporting_delay_period`) são marcadas como provisórias.
- **Observação:** o conector aceita as faixas publicadas pela UKHSA e previstas no `stratum_schema` (inclui `65-79` e `80+`, que substituem o antigo `65+`); outras faixas são descartadas e contadas (`age_skipped`). As faixas etárias da UKHSA **não coincidem** com as do SIVEP; não comparar estratos entre fontes.

---

## 6. O que NÃO somar: grupos espelhados (`MIRROR_GROUPS`)

Fontes do mesmo grupo reapresentam os mesmos registros primários (ou derivam deles). Somar canais de um mesmo grupo conta o mesmo caso duas vezes. A API expõe `mirror_group` em `/v1/sources` e `/v1/indicators`; o catálogo exibe "não somar com: ...".

| Grupo | Fontes | Por quê |
|---|---|---|
| `who_flu` | INT-01 FluNet, INT-02 FluID, INT-06 OPAS/AMart | O painel da OPAS reapresenta FluNet/FluID; FluID é a face epidemiológica (ILI/SARI) do mesmo sistema GISRS |
| `br_srag` | BR-01 SINAN 2009–2012, BR-02 SINAN 2013–2018, BR-03 SIVEP 2019–2026, BR-04 Painel SRAG/scripts, BR-12 InfoGripe | Mesma vigilância de SRAG em sistemas sucessivos; painel e InfoGripe são derivados do SIVEP |
| `insdc` | EU-01 ENA, US-12 NCBI Influenza Virus DB, US-13 NCBI Virus/Datasets, US-14 Entrez Nucleotide, US-15 SRA/BioProject | INSDC espelha sequências entre ENA, GenBank e DDBJ; uma sequência aparece em todos |
| `cdc_fluview` | US-01 FluView Interactive, US-03 FluView reports, US-07 NCHS mortalidade, US-08 mortalidade pediátrica, US-09 novel influenza A | Tabelas do mesmo sistema FluView; óbitos de NCHS e pediátricos têm redes distintas e não se somam entre si nem com os laboratoriais |
| `usda_swine` | US-18 APHIS swine surveillance, US-19 NAHLN | NAHLN é a rede laboratorial do mesmo programa APHIS |

Regras derivadas:

1. Dentro do SIVEP, os indicadores também não se somam entre si: `sivep_srag_ah1n1pdm09_confirmed` + `sivep_srag_ah3n2_confirmed` + `sivep_srag_inf_a_not_subtyped` ≤ `sivep_srag_influenza_confirmed` (há influenza B e influenza A sem RT-PCR), e `sivep_srag_influenza_confirmed` ⊂ `sivep_srag_notifications`.
2. Dentro do FluNet, `AH1N12009 + AH3 + ANOTSUBTYPED + ANOTSUBTYPABLE` pode não fechar com `INF_A` (há outras colunas, como A(H5) e A(H7)); nunca derivar um indicador por subtração.
3. SIVEP (SRAG hospitalizada, semana BR de sintomas, UF de residência) e FluNet (detecções laboratoriais, semana ISO de processamento, país) **não são comparáveis** diretamente; podem aparecer lado a lado com aviso, nunca sobrepostos no mesmo eixo sem conversão de semana e sem o aviso de universo.
4. `sivep_srag_ah1n1pdm09_deaths` não é um subconjunto de nada do SIM (BR-07); óbitos por CID J09 no SIM não confirmam subtipo e não devem ser somados nem comparados como "mortes por H1N1".

---

## 7. Semanas epidemiológicas

Implementação: `packages/core/src/epiweek.ts`. Três convenções coexistem nas fontes e **não se convertem por número de semana**, apenas por data (`period_start`/`period_end`).

| Convenção | Usada por | Início da semana | Regra da semana 1 | Função |
|---|---|---|---|---|
| **BR** (semana epidemiológica brasileira) | SIVEP, SINAN (`SEM_PRI`, `SEM_NOT`) | Domingo | A SE 1 é a semana domingo–sábado que contém 1º de janeiro quando ele cai de **domingo a quinta** (≥ 3 dias em janeiro); caso contrário, a semana seguinte. Verificado empiricamente contra `SEM_PRI` dos arquivos INFLUD 2021, 2022, 2025 e 2026 em 2026-10-20 | `epiWeek`, `epiWeekStart` |
| **MMWR** (CDC) | FluView, MMWR | Domingo | A semana 1 é a que contém 1º de janeiro quando ele cai de **domingo a quarta** (≥ 4 dias em janeiro) | `mmwrWeek`, `mmwrWeekStart` |
| **ISO 8601** | FluNet (`ISO_YEAR`/`ISO_WEEK`), UKHSA, ECDC | Segunda | A semana 1 é a que contém a primeira quinta-feira do ano (equivale a conter 4 de janeiro) | `isoWeek`, `isoWeekStart` |

### 7.1. Exemplos verificados com o código (2026-10-20)

| Semana | Início | Fim |
|---|---|---|
| SE 1/2026 (BR) | **28/12/2025** (domingo) | 03/01/2026 |
| SE 1/2025 (BR) | 29/12/2024 | 04/01/2025 |
| SE 1/2022 (BR) | 02/01/2022 | 08/01/2022 |
| SE 1/2021 (BR) | 03/01/2021 | 09/01/2021 |
| MMWR 1/2026 | 04/01/2026 | 10/01/2026 |
| MMWR 40/2026 | **04/10/2026** (domingo) | 10/10/2026 |
| ISO 1/2026 | 29/12/2025 (segunda) | 04/01/2026 |
| ISO 41/2026 | **05/10/2026** (segunda) | 11/10/2026 |
| SE 41/2026 (BR) | 04/10/2026 | 10/10/2026 |

Por que BR e MMWR divergem em 2026: 1º de janeiro de 2026 é quinta-feira. Na regra brasileira (até quinta) a semana que o contém é a SE 1, logo a SE 1 começa no domingo anterior, 28/12/2025. Na regra MMWR (até quarta) essa semana ainda é a 53/2025 e a MMWR 1 só começa em 04/01/2026. Resultado: durante todo o ano de 2026, a semana BR está **uma unidade à frente** da MMWR para a mesma data.

### 7.2. Mesma data, três números

| Data | BR | MMWR | ISO |
|---|---|---|---|
| 28/12/2025 (dom) | SE 1/2026 | 53/2025 | 52/2025 |
| 01/01/2026 (qui) | SE 1/2026 | 53/2025 | 1/2026 |
| 04/10/2026 (dom) | SE 41/2026 | 40/2026 | 40/2026 |
| 05/10/2026 (seg) | SE 41/2026 | 40/2026 | 41/2026 |
| 20/10/2026 (ter) | SE 43/2026 | 42/2026 | 43/2026 |

Consequências práticas:

- `period` de indicadores SIVEP (`epiweek`) e FluNet/UKHSA (`isoweek`) usam o mesmo formato `AAAA-Www`, mas **não** são a mesma semana. Qualquer comparação deve alinhar por `period_start`.
- Um domingo pertence à semana BR/MMWR que começa nele e à semana ISO que termina nele.
- O observatório exibe a convenção ao lado do eixo ("semana epidemiológica brasileira, domingo a sábado" ou "semana ISO, segunda a domingo").
- Ao citar FluView (CDC) em texto, usar "semana MMWR"; ao citar SIVEP, "SE"; ao citar FluNet, "semana ISO".

---

## 8. Supressão e publicação (resumo)

- Supressão de célula pequena (`applySuppression`): células com `0 < value < 5` em qualquer recorte que não seja total nacional sem estrato saem com `value: null`, `suppressed: true`. Zeros não são suprimidos.
- Supressão complementar: se, num grupo (mesmo indicador, snapshot, geo, período), apenas uma célula de estrato foi suprimida e o total existe, a próxima menor célula também é suprimida para impedir recuperação por subtração. O cálculo é feito sobre o **grupo completo** (total + todos os estratos) mesmo quando a consulta pede um único estrato.
- Razões com `denominator < min_denominator` saem com `value: null` e flag `denominator_below_minimum`.
- Só a snapshot `current` do indicador é servida; publicação é atômica e bloqueada em falha de validação.
- Nunca há recorte por município, nem cruzamento município × idade × data.

---

## 9. Status provisório e `quality_flags`

**`update_status`** (`provisional` | `final`), definido pelo conector:

| Fonte | Regra de `provisional` |
|---|---|
| SIVEP | as **últimas 8 semanas epidemiológicas** (SE > última SE com dado − 8) |
| FluNet | as **últimas 4 semanas ISO** de cada país (semanas que começam em até 21 dias antes do início da última semana) |
| UKHSA | semanas com `in_reporting_delay_period = true` |

**`quality_flags` que existem no código** (lista fechada; qualquer outra não é emitida):

| Flag | Onde | Significado |
|---|---|---|
| `uf_ignored` | SIVEP | na semana houve registros sem UF válida (ignorada/exterior): entram no total nacional `BRA` e nos seus estratos, mas não em nenhuma UF |
| `numerator_exceeds_denominator` | FluNet (`share_of_inf_a`, `positivity`) | numerador > denominador; o percentual **não** é calculado (`value: null`) |
| `carried_forward` | qualquer conector com cobertura declarada (SIVEP) | observação copiada da publicação anterior porque o período está fora da cobertura da snapshot atual (ex.: arquivo de 2025 mantido ao publicar o de 2026); ver `docs/README.md`, seção "Comportamento operacional" |
| `origin_source_unknown` | FluNet | semana com `ORIGIN_SOURCE` fora de `SENTINEL`/`NONSENTINEL`/`NOTDEFINED`: a linha entra no total, sem estrato próprio |
| `denominator_below_minimum` | acrescentada na leitura (`getSeries`), não na ingestão | razão com `denominator < min_denominator`: `value: null` |

**Não existem** `reporting_delay` (o atraso da UKHSA vira `update_status: provisional`) nem `schema_changed` (detecção de mudança de esquema está pendente; ver ADR-004).

---

## 10. Indicadores previstos, ainda não definidos

Entram como novos ids quando houver conector e revisão metodológica; não existem em `INDICATORS` hoje:

| Id provisório | Fonte | Observação |
|---|---|---|
| `sinan_srag_ah1n1_confirmed_2009_2018` | BR-01, BR-02 | Exige harmonização de dicionários por ano; não é comparável com `sivep-v1` sem nota |
| `pni_influenza_doses_applied` | BR-05 | Dose ≠ pessoa vacinada; vacina influenza, não H1N1 |
| `sim_deaths_icd_j09` | BR-07 | CID J09 não confirma subtipo; nunca rotular como "mortes por H1N1" |
| `fluid_ili_sari_*` | INT-02 | Sindrômico; sem subtipo |
| `cdc_fluview_ah1n1pdm09_pct_positive` | US-01/US-03 | Semana MMWR; rede clínica vs saúde pública separadas |
| `sivep_srag_*_rate_per_100k` | BR-03 + BR-14 | Só com denominador fixado por versão e nota de que SRAG não é incidência |
