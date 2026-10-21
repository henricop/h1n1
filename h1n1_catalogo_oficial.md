# H1N1: catálogo oficial de fontes para Knowledge Base

**Referência:** 2026-10-20  
**Escopo:** Influenza A(H1N1) sazonal, A(H1N1)pdm09 (pandemia 2009) e dados de contexto.
**Limite:** inventário amplo, não exaustivo; canais estaduais e municipais requerem auditoria separada. URLs oficiais foram identificadas, mas disponibilidade de cada API não foi testada ao vivo.

## Critérios de leitura
- **P0:** ingestão prioritária; **P1:** fase seguinte; **P2:** contexto/derivados.
- **API pública:** acesso programático documentado; **dados abertos:** download de arquivo; **portal:** não presumir endpoint público.
- **H1N1 confirmado ≠ influenza A não subtipada ≠ síndrome gripal ≠ registro de vacina.**

## Fontes catalogadas
**Total de registros catalogados: 65**

### Brasil (14)

#### BR-01 · SINAN Web Influenza / SRAG, 2009 a 2012
- **Órgão:** Ministério da Saúde / DATASUS
- **Categoria:** Casos, gravidade, óbitos
- **Acesso:** Dados abertos: CSV, JSON, XML
- **Recorte H1N1:** Direta mediante confirmação laboratorial e campos disponíveis
- **Atualização:** Histórico
- **Prioridade:** P0
- **URL oficial:** https://dadosabertos.saude.gov.br/dataset/srag-2009-2012
- **Observações:** Inclui pandemia 2009; usar dicionário por ano.

#### BR-02 · SINAN Web Influenza / SRAG, 2013 a 2018
- **Órgão:** Ministério da Saúde / DATASUS
- **Categoria:** Casos, gravidade, óbitos
- **Acesso:** Dados abertos: CSV, JSON, XML
- **Recorte H1N1:** Direta mediante confirmação laboratorial e campos disponíveis
- **Atualização:** Histórico
- **Prioridade:** P0
- **URL oficial:** https://dadosabertos.saude.gov.br/dataset/srag-2013-2018
- **Observações:** Bases legadas não diretamente comparáveis a SIVEP sem harmonização.

#### BR-03 · SIVEP-Gripe / SRAG, 2019 a 2026
- **Órgão:** Ministério da Saúde / DATASUS
- **Categoria:** Casos, internações, UTI, desfechos
- **Acesso:** Dados abertos: CSV, JSON, Parquet, XML
- **Recorte H1N1:** Direta se subtipo conhecido; casos SRAG não são todos H1N1
- **Atualização:** Semanal nos bancos vivos
- **Prioridade:** P0
- **URL oficial:** https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026
- **Observações:** Disponibilidade de anos 2025/2026 e revisões conforme portal; preservar versões.

#### BR-04 · Painel SRAG e scripts oficiais de análise
- **Órgão:** Ministério da Saúde
- **Categoria:** Vigilância epidemiológica
- **Acesso:** Painel / scripts públicos
- **Recorte H1N1:** Parcial: depende de recorte por agente/subtipo
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://gitlab.com/cgcovid/dados-abertos/-/tree/main
- **Observações:** Scripts de agregação oficiais referenciados no portal de SRAG.

#### BR-05 · PNI: doses aplicadas 2026
- **Órgão:** DPNI / Ministério da Saúde
- **Categoria:** Vacinação
- **Acesso:** Dados abertos: CSV
- **Recorte H1N1:** Vacina influenza em geral, não apenas H1N1
- **Atualização:** Semanal
- **Prioridade:** P0
- **URL oficial:** https://dadosabertos.saude.gov.br/dataset/doses-aplicadas-pelo-programa-de-nacional-de-imunizacoes-pni-2026
- **Observações:** Filtrar por imunobiológico; não confundir dose com pessoa vacinada.

#### BR-06 · Painel da Estratégia de Vacinação contra Influenza
- **Órgão:** Ministério da Saúde
- **Categoria:** Vacinação / cobertura
- **Acesso:** Painel / documentação oficial
- **Recorte H1N1:** Influenza em geral
- **Atualização:** Variável
- **Prioridade:** P1
- **URL oficial:** https://www.gov.br/saude/pt-br/acesso-a-informacao/sic/dados-em-transparencia-ativa/svsa/vacinacao/vacinacao
- **Observações:** Painel de campanha complementa microdados de doses.

#### BR-07 · Sistema de Informações sobre Mortalidade (SIM)
- **Órgão:** Ministério da Saúde / DATASUS
- **Categoria:** Óbitos e causas CID
- **Acesso:** Dados abertos: CSV/JSON/XML
- **Recorte H1N1:** Indireta via CID/causa; não confirma sempre subtipo H1N1
- **Atualização:** Periódica; prévias disponíveis
- **Prioridade:** P0
- **URL oficial:** https://dadosabertos.saude.gov.br/dataset/sim
- **Observações:** Analisar J09/J10/J11 no contexto da edição CID; cruzamentos individuais não presumidos.

#### BR-08 · SIH/SUS: morbidade hospitalar e internações
- **Órgão:** DATASUS
- **Categoria:** Internações
- **Acesso:** Transferência de arquivos / TabNet
- **Recorte H1N1:** Indireta por CID: influenza ou pneumonia
- **Atualização:** Mensal / conforme divulgação
- **Prioridade:** P1
- **URL oficial:** https://datasus.saude.gov.br/acesso-a-informacao/morbidade-hospitalar-do-sus-sih-sus/
- **Observações:** Somente cobertura SUS; não equivale a notificação laboratorial.

#### BR-09 · Transferência de arquivos DATASUS
- **Órgão:** DATASUS
- **Categoria:** Repositório operacional
- **Acesso:** Arquivos disponíveis para download
- **Recorte H1N1:** Depende do dataset selecionado
- **Atualização:** Variável
- **Prioridade:** P1
- **URL oficial:** https://datasus.saude.gov.br/transferencia-de-arquivos/
- **Observações:** Ponto oficial para arquivos e bases auxiliares.

#### BR-10 · CNES: Cadastro Nacional de Estabelecimentos de Saúde
- **Órgão:** DATASUS
- **Categoria:** Infraestrutura de saúde
- **Acesso:** Portal e arquivos oficiais
- **Recorte H1N1:** Não específica; cruzamento por unidade e município
- **Atualização:** Periódica
- **Prioridade:** P2
- **URL oficial:** https://cnes.datasus.gov.br/
- **Observações:** Criar dicionário de unidades e capacidade operacional.

#### BR-11 · Informe epidemiológico e documentos de influenza
- **Órgão:** Ministério da Saúde
- **Categoria:** Protocolos, alertas, guias
- **Acesso:** HTML/PDF
- **Recorte H1N1:** Direta nos documentos H1N1
- **Atualização:** Variável
- **Prioridade:** P1
- **URL oficial:** https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/g/gripe-influenza
- **Observações:** Preferir documentos normativos a conteúdo genérico.

#### BR-12 · InfoGripe, boletins e dados processados
- **Órgão:** Fiocruz / InfoGripe
- **Categoria:** SRAG e séries analisadas
- **Acesso:** Dados processados / boletins / repositório
- **Recorte H1N1:** Parcial conforme indicador
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://github.com/infogripe/Boletim_InfoGripe
- **Observações:** Fonte pública institucional complementar; não é dado primário independente do SIVEP.

#### BR-13 · API de localidades
- **Órgão:** IBGE
- **Categoria:** Geografia e normalização
- **Acesso:** API REST pública
- **Recorte H1N1:** Não específica
- **Atualização:** Conforme alterações territoriais
- **Prioridade:** P1
- **URL oficial:** https://servicodados.ibge.gov.br/api/docs/localidades
- **Observações:** Resolver código IBGE município, UF e regiões.

#### BR-14 · Estimativas populacionais por município
- **Órgão:** IBGE
- **Categoria:** Denominadores epidemiológicos
- **Acesso:** XLSX/ODS/PDF, dados oficiais
- **Recorte H1N1:** Não específica
- **Atualização:** Anual
- **Prioridade:** P1
- **URL oficial:** https://www.ibge.gov.br/estatisticas/sociais/populacao/9103-estimativas-de-populacao.html?=&t=resultados%2F
- **Observações:** Taxas por 100 mil; fixar versão do denominador.

### Global (6)

#### INT-01 · FluNet
- **Órgão:** OMS / GISRS
- **Categoria:** Virologia / subtipo
- **Acesso:** CSV público e dicionário
- **Recorte H1N1:** Direta: detecções A(H1N1)pdm09 e outros subtipos
- **Atualização:** Semanal
- **Prioridade:** P0
- **URL oficial:** https://www.who.int/tools/flunet/
- **Observações:** Fonte central para comparar países; detecções não são incidência populacional.

#### INT-02 · FluID
- **Órgão:** OMS / GISRS
- **Categoria:** Síndrome gripal e doença respiratória grave
- **Acesso:** CSV público
- **Recorte H1N1:** Indireta: ILI/SARI não identifica o subtipo por si
- **Atualização:** Conforme notificações
- **Prioridade:** P0
- **URL oficial:** https://www.who.int/teams/global-influenza-programme/surveillance-and-monitoring/influenza-surveillance-outputs
- **Observações:** Séries epidemiológicas globais da OMS.

#### INT-03 · Global Health Observatory (GHO)
- **Órgão:** OMS
- **Categoria:** Indicadores de saúde e contextuais
- **Acesso:** API OData
- **Recorte H1N1:** Geralmente indireta; nem todo indicador é H1N1
- **Atualização:** Variável
- **Prioridade:** P1
- **URL oficial:** https://www.who.int/data/gho/info/gho-odata-api
- **Observações:** Base API: https://ghoapi.azureedge.net/api/ ; verificar indicador antes de ingestão.

#### INT-04 · Recomendações de composição vacinal da OMS
- **Órgão:** OMS / GISRS
- **Categoria:** Vacinas e variantes
- **Acesso:** Relatórios oficiais HTML/PDF
- **Recorte H1N1:** Direta: componente A(H1N1)pdm09
- **Atualização:** Semestral
- **Prioridade:** P1
- **URL oficial:** https://www.who.int/teams/global-influenza-programme/vaccines/who-recommendations
- **Observações:** Separar hemisférios, ano e plataforma de produção.

#### INT-05 · International Classification of Diseases: ICD API
- **Órgão:** OMS
- **Categoria:** Terminologias e códigos
- **Acesso:** API REST com cadastro OAuth2
- **Recorte H1N1:** Indireta, codificações de influenza
- **Atualização:** Versões oficiais
- **Prioridade:** P1
- **URL oficial:** https://icd.who.int/icdapi
- **Observações:** API requer credenciais; não é API anônima.

#### INT-11 · World Bank Indicators API: população
- **Órgão:** Banco Mundial
- **Categoria:** Denominadores demográficos
- **Acesso:** API REST pública
- **Recorte H1N1:** Não específica
- **Atualização:** Anual
- **Prioridade:** P2
- **URL oficial:** https://datahelpdesk.worldbank.org/knowledgebase/articles/898581
- **Observações:** Ex.: https://api.worldbank.org/v2/country/BRA/indicator/SP.POP.TOTL?format=json

### Américas (1)

#### INT-06 · Painel regional de vigilância de vírus respiratórios / AMart
- **Órgão:** OPAS / OMS
- **Categoria:** Virologia e síndromes
- **Acesso:** Painel oficial; exportação/API não confirmada
- **Recorte H1N1:** Direta em componente virológico; indireta no sindrômico
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://www.paho.org/en/news/8-7-2025-paho-launches-new-interactive-dashboard-monitor-respiratory-viruses-americas
- **Observações:** FluNet e FluID reapresentados; evitar duplicidade de contagens.

### Europa (4)

#### INT-07 · ERVISS, European Respiratory Virus Surveillance Summary
- **Órgão:** ECDC
- **Categoria:** Influenza e vírus respiratórios
- **Acesso:** Portal de vigilância
- **Recorte H1N1:** Potencialmente direta em categorias virológicas
- **Atualização:** Semanal na temporada
- **Prioridade:** P0
- **URL oficial:** https://www.ecdc.europa.eu/en/seasonal-influenza/surveillance-reports-and-disease-data
- **Observações:** Conferir variáveis disponíveis antes de atribuir a H1N1.

#### INT-08 · Surveillance Atlas of Infectious Diseases / TESSy
- **Órgão:** ECDC
- **Categoria:** Epidemiologia
- **Acesso:** Exportação CSV pelo Atlas
- **Recorte H1N1:** Influenza; subtipo depende de dataset/indicador
- **Atualização:** Variável
- **Prioridade:** P1
- **URL oficial:** https://atlas.ecdc.europa.eu/public/
- **Observações:** Dados de países enviados ao ECDC; portal não comprova API aberta.

#### INT-09 · Relatórios e política de reutilização dos dados UE/EEE
- **Órgão:** ECDC
- **Categoria:** Metadados, acesso, licenciamento
- **Acesso:** HTML / políticas / solicitações
- **Recorte H1N1:** Contextual
- **Atualização:** Conforme publicação
- **Prioridade:** P2
- **URL oficial:** https://www.ecdc.europa.eu/en/publications-data/access-eueea-surveillance-data-third-parties
- **Observações:** Acesso detalhado por EpiPulse pode requerer autorização.

#### EU-01 · European Nucleotide Archive Portal API
- **Órgão:** EMBL-EBI / ENA
- **Categoria:** Sequenciamento genômico
- **Acesso:** API REST pública com OpenAPI
- **Recorte H1N1:** Direta mediante filtro influenza A H1N1
- **Atualização:** Contínua
- **Prioridade:** P0
- **URL oficial:** https://www.ebi.ac.uk/ena/portal/api/swagger-ui/index.html
- **Observações:** Evitar duplicar acesso de sequências espelhadas entre INSDC.

### Estados Unidos (19)

#### US-01 · FluView Interactive: NREVSS e ILINet
- **Órgão:** CDC
- **Categoria:** Virologia / vigilância sindrômica
- **Acesso:** Painel com download
- **Recorte H1N1:** Direta nos dados subtipados; ILI é indireto
- **Atualização:** Semanal
- **Prioridade:** P0
- **URL oficial:** https://www.cdc.gov/fluview/overview/fluview-interactive.html
- **Observações:** Separar resultado de laboratório de síndrome gripal.

#### US-02 · FluSurv-NET / RESP-NET
- **Órgão:** CDC
- **Categoria:** Hospitalizações laboratorialmente confirmadas
- **Acesso:** Painel/download
- **Recorte H1N1:** Influenza confirmada; tipo/subtipo depende da tabela
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://www.cdc.gov/resp-net/dashboard/
- **Observações:** Taxas de amostragem populacional, não universo completo EUA.

#### US-03 · FluView reports e caracterização genética
- **Órgão:** CDC
- **Categoria:** Vigilância / genética / antivirais
- **Acesso:** Relatórios HTML e downloads CSV
- **Recorte H1N1:** Direta para A(H1N1)pdm09 em seções específicas
- **Atualização:** Semanal
- **Prioridade:** P0
- **URL oficial:** https://www.cdc.gov/fluview/
- **Observações:** Inclui proporções de subclados, testes e linhagens.

#### US-04 · FluVaxView e RespVaxView
- **Órgão:** CDC
- **Categoria:** Cobertura vacinal
- **Acesso:** Painel / CSV
- **Recorte H1N1:** Influenza sazonal, não H1N1 exclusiva
- **Atualização:** Semanal na temporada
- **Prioridade:** P1
- **URL oficial:** https://www.cdc.gov/fluvaxview/dashboard/index.html
- **Observações:** Estimativas e intenção vacinal de múltiplas fontes.

#### US-05 · National Wastewater Surveillance System influenza A
- **Órgão:** CDC
- **Categoria:** Vigilância ambiental
- **Acesso:** API pública Socrata SODA
- **Recorte H1N1:** Influenza A, não subtipo H1N1
- **Atualização:** Periódica
- **Prioridade:** P1
- **URL oficial:** https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Data-for-Influenza-A/ymmh-divb
- **Observações:** ID dataset ymmh-divb; contagem ambiental não equivale a casos humanos. Verificar direitos de dados de parceiros WastewaterSCAN (CC BY-NC), apesar do portal federal indicar public domain.

#### US-06 · Epidemic Trends and Rt
- **Órgão:** CDC
- **Categoria:** Tendências e modelagem Rt
- **Acesso:** API pública Socrata SODA
- **Recorte H1N1:** Influenza geral; não exclusivo H1N1
- **Atualização:** Semanal/histórico
- **Prioridade:** P2
- **URL oficial:** https://data.cdc.gov/Public-Health-Surveillance/CDC-Epidemic-Trends-and-Rt/5dqz-y4ea/about_data
- **Observações:** Estimativas derivadas de emergência, não contagem direta.

#### US-07 · NCHS mortalidade por influenza em FluView
- **Órgão:** CDC
- **Categoria:** Óbitos
- **Acesso:** Painel e exportação
- **Recorte H1N1:** Influenza geral, não necessariamente H1N1
- **Atualização:** Periódica
- **Prioridade:** P1
- **URL oficial:** https://www.cdc.gov/fluview/overview/fluview-interactive.html
- **Observações:** Não somar automaticamente com óbitos pediátricos de outras tabelas.

#### US-08 · Influenza-associated pediatric mortality
- **Órgão:** CDC
- **Categoria:** Óbitos pediátricos
- **Acesso:** Painel e exportação
- **Recorte H1N1:** Influenza; subtipo só quando informado
- **Atualização:** Semanal/histórico
- **Prioridade:** P2
- **URL oficial:** https://www.cdc.gov/fluview/overview/fluview-interactive.html
- **Observações:** Rede específica de vigilância.

#### US-09 · Novel influenza A human infections / variant flu
- **Órgão:** CDC
- **Categoria:** Infecções zoonóticas
- **Acesso:** Painel e exportação
- **Recorte H1N1:** Direta para variantes H1N1v quando presentes
- **Atualização:** Semanal/histórico
- **Prioridade:** P1
- **URL oficial:** https://www.cdc.gov/fluview/overview/fluview-interactive.html
- **Observações:** H1N1v não é automaticamente o mesmo que H1N1pdm09 sazonal.

#### US-10 · VAERS public datasets
- **Órgão:** HHS / CDC / FDA
- **Categoria:** Segurança de vacinas
- **Acesso:** CSV/ZIP público com possível verificação
- **Recorte H1N1:** Eventos reportados após vacina influenza
- **Atualização:** Periódica
- **Prioridade:** P2
- **URL oficial:** https://vaers.hhs.gov/data/datasets.html
- **Observações:** Relato espontâneo não prova causalidade; mudanças em relatórios secundários.

#### US-11 · openFDA / FAERS / rótulos / recalls
- **Órgão:** FDA
- **Categoria:** Medicamentos e farmacovigilância
- **Acesso:** API REST aberta
- **Recorte H1N1:** Indireta: antivirais, segurança e produtos relacionados
- **Atualização:** Variável
- **Prioridade:** P2
- **URL oficial:** https://open.fda.gov/apis/drug/
- **Observações:** FAERS não é VAERS; eventos reportados não provam efeito causal.

#### US-12 · NCBI Influenza Virus Database
- **Órgão:** NLM/NIH
- **Categoria:** Sequências e metadados virológicos
- **Acesso:** Consulta / download
- **Recorte H1N1:** Direta com filtro subtipo H1N1
- **Atualização:** Contínua
- **Prioridade:** P0
- **URL oficial:** https://www.ncbi.nlm.nih.gov/genomes/FLU/Database/nph-select.cgi?cmd=database
- **Observações:** Acesso histórico e busca por hospedeiro, país, segmento e data.

#### US-13 · NCBI Virus + Datasets
- **Órgão:** NLM/NIH
- **Categoria:** Genômica viral
- **Acesso:** API/CLI e JSONL
- **Recorte H1N1:** Direta com filtros taxonômicos e de sequência
- **Atualização:** Contínua
- **Prioridade:** P0
- **URL oficial:** https://www.ncbi.nlm.nih.gov/datasets/docs/v2/how-tos/virus/virus-metadata/
- **Observações:** Exemplo CLI: datasets summary virus genome taxon 11320; filtrar H1N1 nos metadados.

#### US-14 · NCBI Entrez E-utilities: GenBank / Nucleotide
- **Órgão:** NLM/NIH
- **Categoria:** Sequências, artigos, metadados
- **Acesso:** API REST aberta (limites)
- **Recorte H1N1:** Direta por consulta Influenza A H1N1
- **Atualização:** Contínua
- **Prioridade:** P0
- **URL oficial:** https://www.ncbi.nlm.nih.gov/books/NBK25499/
- **Observações:** ESearch/EFetch; evitar repetir sequências presentes no NCBI Virus.

#### US-15 · SRA / BioProject / BioSample
- **Órgão:** NLM/NIH
- **Categoria:** Leituras brutas e projetos genômicos
- **Acesso:** NCBI APIs / downloads
- **Recorte H1N1:** Direta ao filtrar taxon, hospedeiro, subtipo
- **Atualização:** Contínua
- **Prioridade:** P1
- **URL oficial:** https://www.ncbi.nlm.nih.gov/datasets/taxonomy/11320/
- **Observações:** SRA pode ser muito volumoso; para RAG preferir metadados.

#### US-16 · ClinicalTrials.gov
- **Órgão:** NIH / NLM
- **Categoria:** Ensaios clínicos H1N1, vacina e tratamento
- **Acesso:** API REST v2 pública
- **Recorte H1N1:** Direta por termos H1N1 / influenza A
- **Atualização:** Contínua
- **Prioridade:** P1
- **URL oficial:** https://clinicaltrials.gov/data-api/api
- **Observações:** Registro de estudo não prova resultado ou eficácia.

#### US-17 · PubMed via Entrez
- **Órgão:** NLM/NIH
- **Categoria:** Publicações indexadas
- **Acesso:** API REST pública
- **Recorte H1N1:** Direta por termos e MeSH
- **Atualização:** Contínua
- **Prioridade:** P1
- **URL oficial:** https://www.ncbi.nlm.nih.gov/books/NBK25499/
- **Observações:** Ingerir metadados/resumos conforme licenças; não assumir texto completo livre.

#### US-18 · Influenza A Virus in Swine Surveillance
- **Órgão:** USDA APHIS
- **Categoria:** Vigilância animal / H1N1 suína
- **Acesso:** Relatórios trimestrais PDF
- **Recorte H1N1:** Direta para H1N1 suína
- **Atualização:** Trimestral
- **Prioridade:** P1
- **URL oficial:** https://www.aphis.usda.gov/livestock-poultry-disease/swine/influenza-a-virus
- **Observações:** Amostragem voluntária, não prevalência na população suína.

#### US-19 · NAHLN swine influenza surveillance
- **Órgão:** USDA APHIS
- **Categoria:** Vigilância laboratorial animal
- **Acesso:** Página institucional / relatórios
- **Recorte H1N1:** Direta para H1N1 animal
- **Atualização:** Variável
- **Prioridade:** P2
- **URL oficial:** https://www.aphis.usda.gov/labs/nahln/surveillance-preparedness
- **Observações:** Complementa APHIS; não somar duplicado.

### Inglaterra (3)

#### UK-01 · UKHSA influenza dashboard
- **Órgão:** UK Health Security Agency
- **Categoria:** Positividade, internações, gravidade
- **Acesso:** API pública REST/JSON + CSV
- **Recorte H1N1:** Influenza geral; não exclusivamente H1N1
- **Atualização:** Semanal na temporada
- **Prioridade:** P0
- **URL oficial:** https://ukhsa-dashboard.data.gov.uk/respiratory-viruses/influenza
- **Observações:** Documentação: https://ukhsa-dashboard.data.gov.uk/access-our-data/getting-started ; sem autenticação.

#### UK-02 · UKHSA métrica influenza_testing_positivityByWeek
- **Órgão:** UK Health Security Agency
- **Categoria:** Percentual PCR positivo
- **Acesso:** API pública REST
- **Recorte H1N1:** Influenza geral
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://ukhsa-dashboard.data.gov.uk/metrics-documentation/influenza-testing-positivity-by-week
- **Observações:** Exemplo usando métrica influenza_testing_positivityByWeek; conferir hierarquia e geografia.

#### UK-03 · Relatórios nacionais influenza 2026-2027
- **Órgão:** UKHSA / GOV.UK
- **Categoria:** Vigilância, laboratórios, mortalidade
- **Acesso:** ODS + HTML + PDF
- **Recorte H1N1:** Dependente de variável no relatório
- **Atualização:** Semanal / quinzenal
- **Prioridade:** P1
- **URL oficial:** https://www.gov.uk/government/statistics/national-flu-and-covid-19-surveillance-reports-2026-to-2027-season
- **Observações:** Arquivos ODS estatísticos oficiais.

### Canadá (4)

#### CA-01 · FluWatch+ / Canadian Respiratory Virus Surveillance
- **Órgão:** Public Health Agency of Canada
- **Categoria:** Laboratórios, clínica, severidade
- **Acesso:** CSV e dicionário XLSX
- **Recorte H1N1:** Influenza; subtipo onde divulgado
- **Atualização:** Semanal
- **Prioridade:** P0
- **URL oficial:** https://health-infobase.canada.ca/respiratory-virus-surveillance/explore.html
- **Observações:** Arquivos laboratório e clínica separados.

#### CA-02 · Open Government FluWatch históricos
- **Órgão:** PHAC
- **Categoria:** Séries históricas
- **Acesso:** CSV/XLSX
- **Recorte H1N1:** Influenza e subtipos conforme período
- **Atualização:** Histórico
- **Prioridade:** P1
- **URL oficial:** https://search.open.canada.ca/opendata/?search_text=fluwatch
- **Observações:** Inclui período da pandemia 2009.

#### CA-03 · Respiratory Virus Detections in Canada
- **Órgão:** PHAC
- **Categoria:** Resultados laboratoriais semanais
- **Acesso:** Portal/recursos oficiais
- **Recorte H1N1:** Influenza e tipos/subtipos conforme laboratório
- **Atualização:** Semanal/histórico
- **Prioridade:** P1
- **URL oficial:** https://open.canada.ca/data/en/dataset/6a045376-71df-4221-b059-ba452b70c46f
- **Observações:** Rede sentinela, subestima o universo de casos.

#### CA-04 · National Wastewater Monitoring of Pathogens
- **Órgão:** PHAC
- **Categoria:** Vigilância ambiental
- **Acesso:** CSV de carga viral e tendências
- **Recorte H1N1:** Influenza A, não H1N1 isolado
- **Atualização:** Periódica
- **Prioridade:** P2
- **URL oficial:** https://health-infobase.canada.ca/wastewater/
- **Observações:** Variável dependendo de locais/ensaios.

### Austrália (2)

#### AU-01 · NNDSS datasets Influenza laboratory confirmed
- **Órgão:** Australian Centre for Disease Control
- **Categoria:** Notificações laboratoriais
- **Acesso:** Arquivos oficiais
- **Recorte H1N1:** Influenza confirmada; subtipo conforme dataset
- **Atualização:** Anual
- **Prioridade:** P0
- **URL oficial:** https://www1.health.gov.au/internet/main/publishing.nsf/Content/ohp-pub-datasets.htm
- **Observações:** Registros selecionados desde 2009.

#### AU-02 · NNDSS data visualisation tool
- **Órgão:** Australian Centre for Disease Control
- **Categoria:** Notificações
- **Acesso:** Painel oficial
- **Recorte H1N1:** Influenza, nem sempre subtipo
- **Atualização:** Diária
- **Prioridade:** P1
- **URL oficial:** https://nindss.health.gov.au/
- **Observações:** O painel pode oferecer dados mais atualizados que datasets anuais.

### Argentina (2)

#### AR-01 · Boletín Epidemiológico Nacional 2026
- **Órgão:** Ministerio de Salud
- **Categoria:** Casos, laboratórios, alerta
- **Acesso:** PDF/HTML
- **Recorte H1N1:** Influenza e subtipo quando discriminado
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://www.argentina.gob.ar/salud/boletin-epidemiologico-nacional/boletines-2026
- **Observações:** Não classificar boletins como API.

#### AR-02 · SNVS 2.0, informes públicos e metodologia
- **Órgão:** Ministerio de Salud
- **Categoria:** Notificação e vigilância
- **Acesso:** Documentos públicos; base operacional restrita
- **Recorte H1N1:** Dependente do informe
- **Atualização:** Variável
- **Prioridade:** P2
- **URL oficial:** https://www.argentina.gob.ar/salud/epidemiologia/publicaciones
- **Observações:** SNVS completo não deve ser tratado como dado aberto.

### México (1)

#### MX-01 · Dados abertos influenza, COVID e outros vírus respiratórios
- **Órgão:** Secretaría de Salud / Dirección General de Epidemiología
- **Categoria:** Casos e vigilância laboratorial
- **Acesso:** Dados abertos por download
- **Recorte H1N1:** Influenza e subtipo conforme dicionário
- **Atualização:** Atualizações frequentes
- **Prioridade:** P0
- **URL oficial:** https://www.gob.mx/salud/datos-abiertos-152127
- **Observações:** Base de casos respiratórios de download oficial; esquema deve ser inspecionado.

### Espanha (1)

#### ES-01 · SiVIRA vigilância de IRA/IRAG
- **Órgão:** Instituto de Salud Carlos III
- **Categoria:** Atenção primária, hospitalização, virologia
- **Acesso:** Relatórios HTML e repositório
- **Recorte H1N1:** Influenza/subtipo conforme tabelas
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://docsivira.isciii.es/
- **Observações:** Sem API pública documentada neste levantamento.

### Global animal (1)

#### INT-10 · WAHIS public interface
- **Órgão:** WOAH
- **Categoria:** Doenças animais de notificação internacional
- **Acesso:** Portal com extração de dados
- **Recorte H1N1:** Complementar zoonoses; H1N1 suína usual não é notificação obrigatória
- **Atualização:** Conforme eventos
- **Prioridade:** P2
- **URL oficial:** https://www.woah.org/en/what-we-do/animal-health-and-welfare/disease-data-collection/
- **Observações:** Não presumir cobertura global H1N1 suína.

### Japão (1)

#### JP-01 · Infectious Disease Surveillance Center: influenza/ARI weekly
- **Órgão:** Japan Institute for Health Security (JIHS)
- **Categoria:** Vigilância clínica e laboratorial
- **Acesso:** Relatórios HTML/PDF oficiais
- **Recorte H1N1:** Influenza e recorte H1N1 quando discriminado
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://id-info.jihs.go.jp/en/index.html
- **Observações:** Relatórios públicos; API nacional aberta não comprovada.

### China (1)

#### CN-01 · National Influenza Surveillance Weekly Reports
- **Órgão:** Chinese National Influenza Center / China CDC
- **Categoria:** Influenza laboratorial, subtipagem, antigenicidade, resistência
- **Acesso:** HTML e PDF oficiais
- **Recorte H1N1:** Direta: A(H1N1)pdm09 em resultados virológicos
- **Atualização:** Semanal
- **Prioridade:** P0
- **URL oficial:** https://ivdc.chinacdc.cn/cnic/en/Surveillance/WeeklyReport/
- **Observações:** Inclui relatórios semanais e caracterização antiviral; não é API.

### Coreia do Sul (1)

#### KR-01 · Korea influenza surveillance reports
- **Órgão:** Korea Disease Control and Prevention Agency (KDCA)
- **Categoria:** Vigilância de influenza
- **Acesso:** Relatórios e portal governamental
- **Recorte H1N1:** Depende da tabela e estratificação do subtipo
- **Atualização:** Semanal/sazonal
- **Prioridade:** P1
- **URL oficial:** https://www.kdca.go.kr/eng/4293/subview.do
- **Observações:** Verificar acesso e formato específico antes de programar extração.

### Nova Zelândia (1)

#### NZ-01 · National virology weekly surveillance reports
- **Órgão:** Public Health and Forensic Science (PHF Science)
- **Categoria:** Vigilância laboratorial
- **Acesso:** Boletins oficiais PDF
- **Recorte H1N1:** Influenza A/B; subtipo conforme relatório
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://www.phfscience.nz/media/p5rfufka/virology-weekly-report_2026_28.pdf
- **Observações:** URL de boletim específico de 2026; buscar nova edição na instituição, não assumir link estável.

### Chile (1)

#### CL-01 · Vigilancia de Virus Respiratorios
- **Órgão:** Instituto de Salud Pública de Chile (ISP)
- **Categoria:** Vigilância laboratorial, redes sentinela
- **Acesso:** Relatórios HTML e PDF
- **Recorte H1N1:** Influenza A/B; subtipo H1N1 somente quando divulgado
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://www.ispch.gob.cl/virusrespiratorios/
- **Observações:** Não atribuir automaticamente influenza A a H1N1.

### Colômbia (1)

#### CO-01 · Boletín Epidemiológico Semanal
- **Órgão:** Instituto Nacional de Salud (INS)
- **Categoria:** Vigilância respiratória e surtos
- **Acesso:** PDF oficial por semana
- **Recorte H1N1:** Influenza e subtipagem conforme boletim
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://www.ins.gov.co/buscador-eventos/BoletinEpidemiologico/2026_Boletin_epidemiologico_semana_3.pdf
- **Observações:** Link para uma edição; catalogar publicações novas pela página de boletins.

### Alemanha (1)

#### DE-01 · Influenza Wochenberichte
- **Órgão:** Robert Koch-Institut (RKI)
- **Categoria:** Vigilância sentinela / respiratória
- **Acesso:** Relatórios oficiais PDF/HTML
- **Recorte H1N1:** Influenza virológica e subtipo conforme relatório
- **Atualização:** Semanal
- **Prioridade:** P1
- **URL oficial:** https://influenza.rki.de/Wochenberichte.aspx
- **Observações:** Números podem refletir vigilância sentinela, não todos os casos.

## Orientações de ingestão

1. Coletar dados originais com timestamp, URL, hash e licença.
2. Normalizar `pathogen`, `virus_type`, `subtype`, `lineage`, `clade`, `host_species`, `case_definition`, `lab_confirmation`, `location`, `epiweek`, `specimen_date`, `publication_date`.
3. Preservar relação com origem e versão; não somar dois canais espelhados (OPAS e FluNet, NCBI e ENA, InfoGripe e SIVEP).
4. Tratar correções retrospectivas e `data_as_of`, além de distinguir óbitos notificados de estimativas sindrômicas.
5. Para conteúdo normativo e estudos, utilizar RAG com citações; para séries epidemiológicas, consulta SQL/OLAP e cálculo controlado.
6. Versionar vocabulários e definições de caso por país/ano e respeitar LGPD e acordos de licenciamento.

## Fontes relevantes fora do escopo aberto

- **GISAID EpiFlu:** requer adesão contratual e limita republicação/incorporação em outros bancos. https://gisaid.org/terms-of-use/
- **GAL/RNDS/SNVS e sistemas individuais restritos:** não presumir acesso a microdados ou APIs públicas.
- **WHO ICD API:** documentada, mas exige cadastro e OAuth2.

## Exemplos de integração documentada

```text
OMS GHO OData: https://ghoapi.azureedge.net/api/Indicator
CDC SODA: https://data.cdc.gov/resource/ymmh-divb.json
NCBI ESearch: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
NCBI Datasets CLI: datasets summary virus genome taxon 11320
ENA Swagger: https://www.ebi.ac.uk/ena/portal/api/swagger-ui/index.html
ClinicalTrials.gov API: https://clinicaltrials.gov/api/v2/studies
UKHSA API (modelo): https://api.ukhsa-dashboard.data.gov.uk/themes/infectious_disease/sub_themes/respiratory/topics/Influenza/geography_types/Nation/geographies/England/metrics/influenza_testing_positivityByWeek
IBGE: https://servicodados.ibge.gov.br/api/v1/localidades/municipios
World Bank: https://api.worldbank.org/v2/country/BRA/indicator/SP.POP.TOTL?format=json
```

Os exemplos são especificações publicadas ou composição a partir da documentação; não atestam teste de resposta HTTP em tempo real.