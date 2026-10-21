# H1N1 · Mapeamento das fontes P0

**Versão:** 1.0 · **Data:** 2026-10-20 · **Base:** `data/sources.json` (65 fontes, 19 marcadas P0) e `h1n1_catalogo_oficial.md`. Verificações ao vivo de 2026-10-20 estão marcadas; o restante vem da documentação publicada e **não atesta resposta HTTP**.

Legenda de estratégia de ingestão:

- **Conector** — conector **implementado** em `packages/connectors` (registro em `src/registry.ts`): `flunet`, `sivep`, `ibge`, `worldbank`, `ukhsa`. Os indicadores correspondentes existem em `packages/core`.
- **Planejado** — sem conector; plano descrito. Inclui os conectores previstos na F2 que **ainda não existem**: `cdc-nwss`, `gho`, `clinicaltrials`, `pubmed`, `ena`.
- **Manual** — sem acesso programático confiável; apenas referência (RAG/citação). O conector `manual` (snapshot registrada a partir de download humano) **não existe** (ver ADR-004, "Pendente").

Pipeline comum (ADR-004): `fetch → snapshot imutável (sha256, url, fetched_at, license, data_as_of) → normalize → load → validate → publish`. Toda fonte **com conector** passa por `snapshots` e `ingestion_runs`.

---

## 1. Resumo

| Id | Fonte | Acesso real | Formato | Licença | Cadência | Estratégia | Indicadores no MVP |
|---|---|---|---|---|---|---|---|
| BR-01 | SINAN SRAG 2009–2012 | CKAN dadosabertos.saude.gov.br | CSV/JSON/XML por ano | CC-BY | Histórico | Planejado | — |
| BR-02 | SINAN SRAG 2013–2018 | CKAN dadosabertos.saude.gov.br | CSV/JSON/XML por ano | CC-BY | Histórico | Planejado | — |
| BR-03 | SIVEP-Gripe 2019–2026 | S3 `ckan.saude.gov.br/SRAG/<ano>/INFLUD<aa>-<dd-mm-aaaa>.csv` (**verificado**) | CSV `;` (261 MB em 2026) | CC-BY | Semanal | **Conector** (`sivep`) | 9 `sivep_*` |
| BR-05 | PNI doses aplicadas 2026 | CKAN dadosabertos.saude.gov.br | CSV | CC-BY | Semanal | Planejado | — |
| BR-07 | SIM | CKAN dadosabertos.saude.gov.br | CSV/JSON/XML | CC-BY | Periódica; prévias | Planejado | — |
| INT-01 | FluNet | OData `xmart-api-public.who.int/FLUMART/VIW_FNT` (**verificado**) | JSON OData | verify_per_source | Semanal | **Conector** (`flunet`) | 10 `flunet_*` |
| INT-02 | FluID | OData `FLUMART/VIW_FID_EPI` (view existe; `VIW_FID` NOT_ALLOWED) | JSON OData | verify_per_source | Conforme notificações | Planejado | — |
| INT-07 | ERVISS (ECDC) | Portal; CSV semanais publicados no site do ERVISS | CSV/portal | verify_per_source | Semanal na temporada | Planejado | — |
| EU-01 | ENA Portal API | REST `ebi.ac.uk/ena/portal/api` (**verificado**, `tax_tree(114727)`) | JSON/TSV | verify_per_source (ENA: dados públicos, atribuição) | Contínua | Planejado (conector `ena` **não existe**) | — (não epidemiológico) |
| US-01 | FluView Interactive (NREVSS/ILINet) | Painel com download; CSV por formulário | CSV | verify_per_source (public domain presumido) | Semanal | Planejado | — |
| US-03 | FluView reports | HTML + CSV | HTML/CSV | verify_per_source | Semanal | Manual | — |
| US-12 | NCBI Influenza Virus Database | CGI legado | HTML/FASTA | verify_per_source | Contínua | Manual / referência | — |
| US-13 | NCBI Virus + Datasets | API/CLI `datasets` | JSONL | verify_per_source | Contínua | Planejado | — |
| US-14 | NCBI E-utilities | REST (**verificado** via PubMed/MeSH) | XML/JSON | verify_per_source | Contínua | Planejado (conector `pubmed` **não existe**) | — |
| UK-01 | UKHSA dashboard API | REST `api.ukhsa-dashboard.data.gov.uk` (**verificado**) | JSON paginado | verify_per_source (OGL presumido) | Semanal na temporada | **Conector** (`ukhsa`) | 1 `ukhsa_*` |
| CA-01 | FluWatch+ | CSV + dicionário XLSX | CSV | verify_per_source | Semanal | Planejado | — |
| AU-01 | NNDSS datasets | Arquivos oficiais (XLSX/CSV) | XLSX/CSV | verify_per_source | Anual | Planejado | — |
| MX-01 | Datos abiertos (SSA/DGE) | ZIP/CSV por download | CSV | verify_per_source | Frequente | Planejado | — |
| CN-01 | CNIC Weekly Reports | HTML/PDF | PDF | verify_per_source | Semanal | Manual / referência | — |

Fontes P0 **com conector implementado**: **3** (BR-03, INT-01, UK-01). **EU-01 (ENA) e US-14 (E-utilities/PubMed) são P0 sem conector** (planejado).

Fontes não P0 com conector implementado (fora da lista acima, porque o catálogo as classifica P1/P2):

| Id | Fonte | Prioridade | Conector | Indicador |
|---|---|---|---|---|
| BR-14 | IBGE: estimativas populacionais (o conector usa o agregado 6579 / variável 9324, por UF e Brasil) | P1 | `ibge` | `ibge_population_estimate` |
| INT-11 | Banco Mundial, `SP.POP.TOTL` | P2 | `worldbank` | `worldbank_population_total` |

Conectores previstos e **não implementados**: `cdc-nwss`, `gho`, `clinicaltrials`, `pubmed`, `ena`.

---

## 2. Fichas por fonte

### BR-01 · SINAN Web Influenza / SRAG, 2009 a 2012

- **Endpoint/arquivo:** `https://dadosabertos.saude.gov.br/dataset/srag-2009-2012` (CKAN; recursos por ano em CSV, JSON, XML). Não testado ao vivo.
- **Formato:** CSV por ano; dicionário por ano.
- **Campos-chave H1N1:** campos de classificação final e resultado laboratorial do SINAN Influenza do período (nomes variam por ano; a confirmação de A(H1N1)pdm09 em 2009–2010 segue definição de caso pandêmica). Não presumir equivalência com `PCR_FLUASU`.
- **Licença:** CC-BY (portal).
- **Cadência:** histórico, fechado.
- **Estratégia:** planejado (fase P1, pesquisa R01/R05). Passos: (1) baixar recursos e dicionários por ano com snapshot; (2) tabela de harmonização ano → campos → categorias; (3) novo indicador `sinan_srag_ah1n1_confirmed_2009_2018` com `methodology_version` própria; (4) nunca unir com `sivep-v1` numa série contínua sem marca de quebra metodológica em `quality_flags` e na UI.
- **Riscos:** mudança de definição de caso na pandemia; completude laboratorial baixa; recursos CKAN podem mudar de URL; inclui a pandemia de 2009, com forte interesse editorial e alto risco de leitura enganosa.

### BR-02 · SINAN Web Influenza / SRAG, 2013 a 2018

- **Endpoint/arquivo:** `https://dadosabertos.saude.gov.br/dataset/srag-2013-2018`. Não testado ao vivo.
- **Formato:** CSV/JSON/XML por ano.
- **Campos-chave H1N1:** classificação final e subtipo laboratorial conforme dicionário do período (transição para o formulário SIVEP ocorre neste intervalo).
- **Licença:** CC-BY.
- **Cadência:** histórico, fechado.
- **Estratégia:** planejado, junto com BR-01, mesma tabela de harmonização.
- **Riscos:** bases legadas não diretamente comparáveis ao SIVEP sem harmonização; mudanças de formulário dentro do período.

### BR-03 · SIVEP-Gripe / SRAG, 2019 a 2026

- **Endpoint/arquivo (verificado 2026-10-20):** `https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/<ano>/INFLUD<aa>-<dd-mm-aaaa>.csv`; exemplo real `SRAG/2026/INFLUD26-19-10-2026.csv` (261 MB). Página CKAN: `https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026`. Dicionário 2019–2025 em PDF no mesmo dataset.
- **Formato:** CSV separado por `;`, codificação a verificar por arquivo (ISO-8859-1 ou UTF-8), um arquivo por ano, substituído a cada atualização (o nome inclui a data de corte).
- **Campos-chave H1N1:** `CLASSI_FIN` (1 = influenza), `TP_FLU_PCR` (1 = A), `PCR_FLUASU` (1 = A(H1N1)pdm09; 2 = A(H3N2); 3 = não subtipado; 4 = não subtipável), `EVOLUCAO` (2 = óbito; 3 = óbito outras causas), `UTI`, `SG_UF` (residência), `SEM_PRI` (semana dos primeiros sintomas), `DT_SIN_PRI`, `NU_IDADE_N`/`TP_IDADE`, `DT_NOTIFIC`, `SEM_NOT`.
- **Licença:** CC-BY (portal dadosabertos.saude.gov.br).
- **Cadência:** semanal nos bancos vivos (ano corrente e anterior); anos fechados revisados esporadicamente.
- **Estratégia:** **Conector `sivep` (implementado)**. (1) Descobrir o arquivo do ano via CKAN ou padrão de nome; (2) baixar para `data/snapshots/br_sivep_gripe/` com sha256, `data_as_of` = data no nome do arquivo; (3) parse em streaming (nunca carregar 261 MB em memória, nunca persistir linhas); (4) agregar por `SG_UF × SEM_PRI × age_group` para cada um dos 9 indicadores (`SEM_PRI` quando válida, com o ano de `DT_SIN_PRI`; zeros explícitos de SE 1 até a última SE com dado); (5) `update_status = provisional` somente para as **últimas 8 SE** do arquivo; (6) o **bruto é apagado após a agregação** (`retainRaw: false`; fica o sidecar `.meta.json` com sha256, url, licença e `raw_file_deleted: true`); (7) validar: regras por indicador (valores, período, geo, estrato, queda abrupta) e **invariantes cruzadas** (H1N1 ≤ influenza ≤ notificações; óbitos H1N1 ≤ óbitos influenza ≤ influenza; UTI ≤ influenza; soma dos estratos `age_group` = total; soma das UFs ≤ total nacional); (8) `publishIndicator` atômico com carry-forward entre anos (2025 e 2026 compõem uma série); execução parcial (`--max-rows`) nunca publica; (9) supressão só na publicação.
- **Riscos:** tamanho (261 MB e crescendo); mudança de esquema entre anos (dicionário 2019–2025 pode não cobrir 2026; **não há detecção automática** de mudança de esquema, a flag `schema_changed` não existe); codificação inconsistente; revisões retroativas grandes (medir com `/v1/diff`); interpretação pública de "SRAG com H1N1" como "casos de H1N1"; microdados pessoais sensíveis (anonimizados pelo MS, mas tratados com minimização; ver LGPD).

### BR-05 · PNI: doses aplicadas 2026

- **Endpoint/arquivo:** `https://dadosabertos.saude.gov.br/dataset/doses-aplicadas-pelo-programa-de-nacional-de-imunizacoes-pni-2026` (CKAN; CSV, possivelmente particionado por UF). Não testado ao vivo.
- **Formato:** CSV de doses aplicadas (microdado de dose, sem identificação).
- **Campos-chave:** imunobiológico (filtrar vacina influenza, trivalente/quadrivalente conforme campanha), UF/município de aplicação, data de aplicação, faixa etária, grupo prioritário, dose.
- **Licença:** CC-BY.
- **Cadência:** semanal.
- **Estratégia:** planejado para `/vacina/` após revisão clínica. Indicador provisório `pni_influenza_doses_applied` (count, unit `doses`), agregado por UF × mês. Universo obrigatório: "doses aplicadas registradas no PNI, não pessoas vacinadas nem cobertura". Sem cobertura (%) até fixar denominador oficial da campanha.
- **Riscos:** volume alto; dose ≠ pessoa; nomes de imunobiológico variam; vacina é influenza sazonal, não H1N1; atraso de registro.

### BR-07 · Sistema de Informações sobre Mortalidade (SIM)

- **Endpoint/arquivo:** `https://dadosabertos.saude.gov.br/dataset/sim` (CKAN; DO por ano em CSV/JSON/XML; prévias para anos recentes). Não testado ao vivo.
- **Formato:** CSV de declarações de óbito (microdado).
- **Campos-chave:** `CAUSABAS` (CID-10 J09 influenza por vírus identificado zoonótico/pandêmico; J10 influenza por vírus identificado; J11 não identificado), `DTOBITO`, `CODMUNRES`, idade, sexo; linhas da declaração (`LINHAA`–`LINHAD`, `LINHAII`) para causas múltiplas.
- **Licença:** CC-BY.
- **Cadência:** anual definitivo; prévias periódicas.
- **Estratégia:** planejado (P1, pesquisa R05/histórico). Indicador provisório `sim_deaths_icd_j09` e `sim_deaths_icd_j10_j11`, por UF × mês, supressão 5. Rótulo obrigatório "óbitos com causa básica CID J09/J10/J11", nunca "mortes por H1N1". Não cruzar com SIVEP em nível individual.
- **Riscos:** J09 não confirma subtipo; mudança de edição da CID; prévias revisadas; cruzamento indevido com SIVEP; células pequenas por município (não publicar município).

### INT-01 · FluNet (OMS / GISRS)

- **Endpoint (verificado 2026-10-20):** `https://xmart-api-public.who.int/FLUMART/VIW_FNT` (OData; filtros `$filter=COUNTRY_CODE eq 'BRA'`, paginação `$skip/$top`); metadados em `VIW_FLU_METADATA`. Página pública: `https://www.who.int/tools/flunet/`. 1.739 linhas para BRA desde 2009.
- **Formato:** JSON OData; também CSV pelo site.
- **Campos-chave H1N1:** `AH1N12009`, `AH1` (sazonal pré-2009), `AH3`, `AH5`, `AH7N9`, `ANOTSUBTYPED`, `ANOTSUBTYPABLE`, `INF_A`, `INF_B`, `BVIC`, `BYAM`, `BNOTDETERMINED`, `INF_ALL`, `INF_NEGATIVE`, `SPEC_PROCESSED_NB`, `SPEC_RECEIVED_NB`, `ISO_YEAR`, `ISO_WEEK`, `ISO_WEEKSTARTDATE`, `ORIGIN_SOURCE`, `COUNTRY_CODE`, `COUNTRY_AREA_TERRITORY`.
- **Licença:** verify_per_source. A OMS publica dados sob política de dados abertos com atribuição; confirmar termos do xMart antes de redistribuir CSV.
- **Cadência:** semanal (com atraso variável por país).
- **Estratégia:** **Conector `flunet` (implementado)**. (1) Consultar OData por país (BRA no MVP; lista ampliável); (2) snapshot do JSON com sha256; (3) mapear colunas → 10 indicadores `flunet_*`, `period = ISO_YEAR-W<ISO_WEEK>`, estrato `origin_source`; linhas duplicadas por (`COUNTRY_CODE`, `ISO_YEAR`, `ISO_WEEK`, `ORIGIN_SOURCE`) contam uma vez e quarentenam a snapshot; (4) `update_status = provisional` para as **últimas 4 semanas ISO** de cada país; (5) validar: regras por indicador e invariantes cruzadas (`ah1n1pdm09 + ah3 + não subtipada + não subtipável ≤ inf_a ≤ inf_all`); a checagem `INF_ALL ≤ SPEC_PROCESSED_NB` **não** é feita; (6) publicar. Países novos entram na tabela `geo` automaticamente.
- **Riscos:** xMart pode mudar nomes de view (como `VIW_FID` → NOT_ALLOWED); países com relato irregular; semana de processamento vs coleta; detecções não são incidência; OPAS (INT-06) reapresenta os mesmos dados (`who_flu`).

### INT-02 · FluID (OMS / GISRS)

- **Endpoint:** `https://xmart-api-public.who.int/FLUMART/VIW_FID_EPI` (view existe em 2026-10-20; `VIW_FID` retorna NOT_ALLOWED). Página: `https://www.who.int/teams/global-influenza-programme/surveillance-and-monitoring/influenza-surveillance-outputs`.
- **Formato:** JSON OData / CSV.
- **Campos-chave:** ILI e SARI (casos, consultas, internações, óbitos), `AGEGROUP_CODE`, `ISO_YEAR/ISO_WEEK`, `COUNTRY_CODE`; sem subtipo.
- **Licença:** verify_per_source (mesma política da OMS).
- **Cadência:** conforme notificações dos países.
- **Estratégia:** planejado (P1, `/dados/mundo/`). Reutilizar o conector `flunet` com outra view; indicadores `fluid_ili_*`/`fluid_sari_*` com universo "síndromes, não H1N1". Nunca somar com FluNet (`who_flu`).
- **Riscos:** esquema da view não inspecionado; cobertura muito desigual entre países; confusão sindrômico × laboratorial.

### INT-07 · ERVISS (ECDC)

- **Endpoint:** portal `https://www.ecdc.europa.eu/en/seasonal-influenza/surveillance-reports-and-disease-data`; o ERVISS publica arquivos CSV semanais (virologia e sindrômico) em página própria do ECDC/WHO-Europe. URL dos CSV a confirmar; não testado.
- **Formato:** CSV semanal + painel.
- **Campos-chave:** detecções por tipo/subtipo (inclui A(H1)pdm09 nas tabelas virológicas), país, semana ISO, rede sentinela vs não sentinela, positividade.
- **Licença:** verify_per_source (ECDC: reutilização permitida com atribuição, salvo exceções; INT-09 descreve a política).
- **Cadência:** semanal na temporada (outubro–maio).
- **Estratégia:** planejado (P1, `/dados/mundo/`). Conector `erviss` lendo CSV; indicadores `erviss_ah1pdm09_detections` etc., semana ISO. Checar sobreposição com FluNet para países europeus (o ECDC e a OMS-Europa compartilham coleta; tratar como espelho potencial e não somar).
- **Riscos:** URL de CSV muda por temporada; variáveis mudam; sobreposição com FluNet; licença por conjunto.

### EU-01 · European Nucleotide Archive Portal API

- **Endpoint (verificado 2026-10-20):** `https://www.ebi.ac.uk/ena/portal/api/search?result=sequence&query=tax_tree(114727)` respondeu 200. O nome do táxon 114727 e sua correspondência exata com A(H1N1)pdm09 devem ser confirmados no conector contra a taxonomia do NCBI/ENA antes de qualquer agregação. Swagger: `https://www.ebi.ac.uk/ena/portal/api/swagger-ui/index.html`.
- **Formato:** JSON ou TSV; campos selecionáveis (`fields=accession,collection_date,country,host,strain,...`).
- **Campos-chave H1N1:** `tax_id`, `scientific_name`, `strain`, `collection_date`, `country`, `host`, `isolate`, `first_public`.
- **Licença:** dados INSDC são públicos sem restrição; citar ENA/EMBL-EBI.
- **Cadência:** contínua.
- **Estratégia:** **planejado (conector `ena` não existe)**, limitado a **metadados agregados** (contagem de sequências por país × mês de coleta) para `/historia/` e pesquisas. Não baixar sequências. Não é indicador epidemiológico; universo "sequências depositadas, não casos". Espelho `insdc`: não somar com NCBI.
- **Riscos:** viés de deposição (países sequenciam de forma desigual); datas de coleta incompletas; volume.

### US-01 · FluView Interactive: NREVSS e ILINet (CDC)

- **Endpoint:** `https://www.cdc.gov/fluview/overview/fluview-interactive.html`; downloads CSV via formulário do painel (`gis.cdc.gov/grasp/fluview/...`). Não há API documentada estável; não testado.
- **Formato:** CSV (laboratórios clínicos; laboratórios de saúde pública com subtipo; ILINet).
- **Campos-chave H1N1:** nos laboratórios de saúde pública, `A (2009 H1N1)`, `A (H3)`, `A (Subtyping not performed)`, `B`, `BVic`, `BYam`, `H3N2v`; `TOTAL SPECIMENS`, `PERCENT POSITIVE`; `YEAR`, `WEEK` (MMWR); ILINet `%UNWEIGHTED ILI`, `% WEIGHTED ILI`.
- **Licença:** verify_per_source (obra do governo federal dos EUA, geralmente domínio público; confirmar na página).
- **Cadência:** semanal (sexta-feira).
- **Estratégia:** planejado (P1, `/dados/mundo/`, pesquisa R06). Conector `fluview` com download direto dos CSV se houver URL estável; caso contrário, manual com snapshot. Indicadores em semana **MMWR** (`period_type` novo `mmwrweek` ou conversão por `period_start` — decisão pendente; o enum atual não contém MMWR). Separar laboratórios clínicos (sem subtipo) de saúde pública (com subtipo); não somar.
- **Riscos:** ausência de API; formato muda por temporada; semana MMWR difere da BR em 2026 (ver dicionário, seção 7); espelho `cdc_fluview`.

### US-03 · FluView reports e caracterização genética (CDC)

- **Endpoint:** `https://www.cdc.gov/fluview/` (relatório semanal HTML com tabelas e links CSV).
- **Formato:** HTML + CSV.
- **Campos-chave H1N1:** proporção de A(H1N1)pdm09 entre subtipados, subclados genéticos (nomenclatura muda por temporada; registrar a vigente em cada snapshot), resistência a antivirais por subtipo, caracterização antigênica.
- **Licença:** verify_per_source.
- **Cadência:** semanal.
- **Estratégia:** manual / referência. Uso editorial (histórico, variantes) com citação literal, data de acesso e snapshot do HTML. Não ingerir como indicador no MVP; espelho de US-01.
- **Riscos:** tabelas mudam; subclados exigem contexto técnico; risco de leitura "nova variante" alarmista.

### US-12 · NCBI Influenza Virus Database

- **Endpoint:** `https://www.ncbi.nlm.nih.gov/genomes/FLU/Database/nph-select.cgi?cmd=database` (interface CGI legada; o NCBI direciona para NCBI Virus).
- **Formato:** HTML/FASTA.
- **Campos-chave:** subtipo, hospedeiro, país, segmento, data de coleta.
- **Licença:** verify_per_source (dados públicos).
- **Cadência:** contínua, mas interface legada.
- **Estratégia:** manual / referência. Não construir conector; US-13 cobre o mesmo conteúdo via API. Espelho `insdc`.
- **Riscos:** descontinuação da interface; duplicidade com US-13/US-14/EU-01.

### US-13 · NCBI Virus + Datasets

- **Endpoint:** CLI/API `datasets summary virus genome taxon 11320 --host human --...` (11320 = Influenza A virus); doc `https://www.ncbi.nlm.nih.gov/datasets/docs/v2/how-tos/virus/virus-metadata/`. Não testado.
- **Formato:** JSONL de metadados.
- **Campos-chave:** `virus.tax_id`, `isolate.name`, `host.sci_name`, `location.geographic_location`, `isolate.collection_date`, `sequence.segment`, subtipo nos metadados/nome da cepa.
- **Licença:** verify_per_source (dados públicos).
- **Cadência:** contínua.
- **Estratégia:** planejado (P2). Metadados agregados por país × mês, igual ao ENA; escolher **um** de ENA ou NCBI como canônico por região para evitar dupla contagem (`insdc`).
- **Riscos:** volume; subtipo precisa ser extraído do nome da cepa; viés de deposição.

### US-14 · NCBI Entrez E-utilities: GenBank / Nucleotide

- **Endpoint (verificado 2026-10-20 para PubMed):** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=...` (MeSH H1N1: 19.006 artigos); mesma API serve `db=nuccore` para sequências.
- **Formato:** XML/JSON.
- **Campos-chave:** `db=nuccore` com termo `Influenza A virus H1N1[Organism]`; `db=pubmed` com MeSH "Influenza A Virus, H1N1 Subtype".
- **Licença:** verify_per_source; metadados e resumos do PubMed são utilizáveis com atribuição; texto completo não presumido.
- **Cadência:** contínua. Limite de 3 req/s sem chave, 10 req/s com chave (`api_key`).
- **Estratégia:** **planejado (conector `pubmed` não existe)** (metadados bibliográficos para biblioteca científica e RAG com citação). Para `nuccore`, não ingerir no MVP (coberto por ENA/NCBI Virus).
- **Riscos:** limites de taxa; `tool`/`email` obrigatórios na requisição; resumos não são evidência clínica; publicação de contagem de artigos não é indicador de saúde.

### UK-01 · UKHSA influenza dashboard

- **Endpoint (verificado 2026-10-20):** `https://api.ukhsa-dashboard.data.gov.uk/themes/infectious_disease/sub_themes/respiratory/topics/Influenza/geography_types/Nation/geographies/England/metrics/influenza_testing_positivityByWeek` (3.933 registros, paginado). Doc: `https://ukhsa-dashboard.data.gov.uk/access-our-data/getting-started`. Sem autenticação.
- **Formato:** JSON paginado (`results[]` com `date`, `epiweek`, `year`, `metric_value`, `stratum`, `age`, `sex`, `in_reporting_delay_period`).
- **Campos-chave:** `metric_value`, `epiweek`/`year` (semana ISO), `age`, `in_reporting_delay_period` (→ `provisional`). Outras métricas disponíveis: internações, UTI, positividade por idade.
- **Licença:** verify_per_source (conteúdo GOV.UK normalmente Open Government Licence v3; confirmar na página de dados).
- **Cadência:** semanal na temporada.
- **Estratégia:** **Conector `ukhsa` (implementado)**. Indicador `ukhsa_influenza_testing_positivity`, `geo_code = ENG`, estrato `age` (`0-4`, `5-14`, `15-44`, `45-64`, `65-79`, `80+`; outras faixas são descartadas); `in_reporting_delay_period` vira `provisional`. Universo: positividade, não H1N1.
- **Riscos:** nomes de métricas mudam entre temporadas; influenza geral, sem subtipo; faixas etárias diferentes das do SIVEP.

### CA-01 · FluWatch+ / Canadian Respiratory Virus Surveillance

- **Endpoint:** `https://health-infobase.canada.ca/respiratory-virus-surveillance/explore.html` com links de CSV (laboratório e clínica separados) e dicionário XLSX. Não testado.
- **Formato:** CSV + XLSX.
- **Campos-chave:** detecções por tipo/subtipo (A(H1N1), A(H3N2), A não subtipado, B), testes, positividade, por região e semana (convenção a confirmar: o Canadá usa semana de vigilância alinhada à MMWR/CDC).
- **Licença:** verify_per_source (Open Government Licence – Canada presumida).
- **Cadência:** semanal.
- **Estratégia:** planejado (P1, `/dados/mundo/`). Conector `fluwatch` lendo CSV laboratorial; indicadores `fluwatch_ah1n1_detections` etc.
- **Riscos:** URLs de CSV mudam; convenção de semana; rede de laboratórios ≠ casos.

### AU-01 · NNDSS datasets: influenza confirmada laboratorialmente

- **Endpoint:** `https://www1.health.gov.au/internet/main/publishing.nsf/Content/ohp-pub-datasets.htm` (arquivos anuais; o painel NINDSS em AU-02 tem dados mais recentes). Não testado.
- **Formato:** XLSX/CSV por ano, registros selecionados desde 2009.
- **Campos-chave:** subtipo (A(H1N1)pdm09, A(H3N2), A não subtipado, B), estado/território, semana/mês de diagnóstico, faixa etária, sexo.
- **Licença:** verify_per_source (CC-BY presumida no portal australiano; confirmar).
- **Cadência:** anual.
- **Estratégia:** planejado (P2, pesquisa R06 e sazonalidade hemisfério sul). Conector `nndss` por arquivo anual; indicadores `nndss_ah1n1pdm09_notifications`.
- **Riscos:** granularidade e campos variam por ano; notificação laboratorial depende de testagem; atraso anual.

### MX-01 · Datos abiertos: influenza, COVID e outros vírus respiratórios

- **Endpoint:** `https://www.gob.mx/salud/datos-abiertos-152127` (ZIP com CSV diário/periódico de casos de vigilância respiratória). Não testado.
- **Formato:** CSV em ZIP, dicionário e catálogos em XLSX.
- **Campos-chave:** resultado laboratorial por patógeno (inclui influenza A(H1N1)pdm09 como categoria no catálogo), entidade federativa, data de início de sintomas, idade, sexo, hospitalização, UTI, óbito.
- **Licença:** verify_per_source (Términos de Libre Uso MX presumidos).
- **Cadência:** frequente (histórico diário).
- **Estratégia:** planejado (P1, `/dados/mundo/`, comparação Américas com FluNet). Conector `mx_dge` com parse em streaming (microdado), agregando por entidade × semana; supressão 5.
- **Riscos:** esquema não inspecionado; microdado individual (mesma política LGPD-equivalente: só agregados); catálogo de resultados muda; sobreposição com FluNet (México reporta à OPAS/OMS).

### CN-01 · National Influenza Surveillance Weekly Reports (CNIC / China CDC)

- **Endpoint:** `https://ivdc.chinacdc.cn/cnic/en/Surveillance/WeeklyReport/` (HTML com PDF semanal). Não é API; não testado.
- **Formato:** PDF.
- **Campos-chave:** proporção de A(H1N1)pdm09 entre positivos, positividade por região (norte/sul), caracterização antigênica, resistência a antivirais.
- **Licença:** verify_per_source.
- **Cadência:** semanal.
- **Estratégia:** manual / referência. Snapshot do PDF para citação em `/historia/` e pesquisas; sem indicador no MVP. Avaliar FluNet (`COUNTRY_CODE = CHN`) como alternativa estruturada para a China.
- **Riscos:** extração de PDF frágil; sem licença explícita; FluNet já cobre a série virológica da China.

---

## 3. Plano para fontes sem conector no MVP

| Ordem | Fonte | Gatilho | Entrega |
|---|---|---|---|
| 1 | INT-02 FluID | `/dados/mundo/` (Sprint 5–6) | Reuso do conector `flunet` com view `VIW_FID_EPI`; inspeção de esquema registrada em snapshot |
| 2 | BR-05 PNI | Publicação de `/vacina/` após revisão clínica | Conector `pni`, agregado UF × mês, universo "doses, não pessoas" |
| 3 | BR-01/BR-02 SINAN | Pesquisa R01/R05 | Tabela de harmonização + indicador com quebra metodológica marcada |
| 4 | BR-07 SIM | Pesquisa R05, `/historia/` | Conector `sim`, J09/J10/J11, supressão 5, rótulo CID obrigatório |
| 5 | US-01 FluView, CA-01 FluWatch+, INT-07 ERVISS | Pesquisa R06 | Conectores de CSV; decisão sobre `mmwrweek` no enum de `period_type` |
| 6 | MX-01, AU-01 | `/dados/mundo/` ampliado | Conectores com parse em streaming (MX) e anual (AU) |
| 7 | US-13 NCBI Datasets | Pesquisa de variantes (P2) | Metadados agregados; escolher canônico ENA vs NCBI |
| 8 | US-03, US-12, CN-01 | Conteúdo editorial | Apenas snapshot + citação; sem indicador |
| 9 | EU-01 ENA, US-14 E-utilities/PubMed (P0 sem conector) | Backlog S4-06 | Conectores `ena` e `pubmed` (metadados; sem indicador epidemiológico derivado) |

Critério para promover uma fonte "planejada" a conector: licença confirmada por escrito ou página oficial salva em snapshot; dicionário de campos registrado; teste de esquema com fixture; indicador definido em `packages/core` com `universe_note` e caveats revisados.
