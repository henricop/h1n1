# H1N1 · Product Requirements Document (PRD)

**Versão:** 1.0 · **Data:** 2026-10-20 · **Status:** em vigor para o MVP · **Deriva de:** `h1n1_plano_estrategico_site.md` (v1.0, seção 20), `h1n1_catalogo_oficial.md`, `docs/PLANO_EXECUCAO.md`.

Documentos relacionados: [CONTRATO_API.md](./CONTRATO_API.md) · [DICIONARIO_INDICADORES.md](./DICIONARIO_INDICADORES.md) · [MAPEAMENTO_FONTES_P0.md](./MAPEAMENTO_FONTES_P0.md) · [POLITICA_EDITORIAL.md](./POLITICA_EDITORIAL.md) · [LGPD_E_PRIVACIDADE.md](./LGPD_E_PRIVACIDADE.md) · [PESQUISA_DEMANDA.md](./PESQUISA_DEMANDA.md) · [BACKLOG_SPRINTS.md](./BACKLOG_SPRINTS.md) · [ADR/](./ADR/).

---

## 1. Visão

**H1N1 é uma plataforma pública de orientação, monitoramento e pesquisa sobre influenza A(H1N1)**, em português, para o Brasil, com rigor suficiente para ser citada por imprensa, pesquisadores e profissionais de saúde.

Posicionamento: **"H1N1: informação clara. Dados oficiais. Análise independente."**

O produto tem duas portas na homepage: **Entenda o H1N1** (central de respostas) e **Acompanhe os dados** (observatório). Não é blog, não é agregador de notícias, não é ferramenta de diagnóstico nem de telemedicina.

### 1.1. Tese do produto

Uma pessoa esclarece uma dúvida sobre H1N1 em segundos e, se quiser aprofundar, encontra o que os portais convencionais não entregam: dados analisados, séries por período e região, comparações metodologicamente corretas e materiais úteis, todos com origem verificável.

### 1.2. Limites assumidos nesta versão

- Nenhuma página clínica (sintomas, prevenção, vacina, comparadores, materiais) é indexada ou entra na navegação antes de revisão por profissional de saúde habilitado (revisor **a definir**).
- `/tratamento/` fica fora do MVP.
- Nenhum número epidemiológico é escrito à mão em conteúdo; todo número vem do banco versionado via API.
- Não há analytics no MVP; a medição começa por Search Console e logs de servidor agregados.
- Domínio comercial, revisor clínico e encarregado de dados (DPO): **a definir**.

---

## 2. Públicos

Tabela da seção 2 do plano estratégico, com a decisão de separar quem traz escala de quem confere reputação.

| Prioridade | Público | Situação típica | O que busca | Melhor produto | Papel estratégico |
|---|---|---|---|---|---|
| P0 | Adultos, famílias e cuidadores | Sintomas, contato com pessoa doente, dúvida preventiva | Resposta rápida e compreensível | Central de respostas e guias visuais | Maior potencial de alcance amplo |
| P0 | Pais e responsáveis | Criança com sintomas, escola, vacinação | Orientação geral e sinais de alerta | Guias revisados e materiais compartilháveis | Audiência recorrente e sazonal |
| P0 | Pessoas buscando vacinação e prevenção | Campanha anual e dúvidas sobre proteção | Diretrizes atualizadas e canais oficiais | Vacinação e prevenção | Busca útil, recorrente |
| P1 | Professores, escolas e RH | Comunicação e prevenção em ambientes coletivos | Informativos confiáveis para equipes | Kits, checklists e materiais institucionais | Compartilhamento orgânico |
| P1 | Jornalistas e criadores responsáveis | Dados para matérias e explicadores | Séries, fontes, visualizações, metodologia | Observatório e releases de pesquisa | Autoridade e backlinks naturais |
| P1 | Profissionais de saúde e estudantes | Atualização técnica e epidemiológica | Referências e números com definições claras | Biblioteca científica e relatórios | Credibilidade especializada |
| P2 | Pesquisadores e analistas | Séries padronizadas e recortes | Exportação, dicionários e proveniência | Catálogo de datasets e API | Profundidade, parcerias e monetização B2B futura |
| P2 | Gestores e organizações de saúde | Visão histórica e comparação territorial | Indicadores consistentes | Painéis, relatórios e API | Oportunidade institucional futura |

**Público principal do lançamento:** pessoas que fazem uma pergunta simples no Google e precisam de uma resposta confiável agora. Elas buscam "gripe", "influenza" e comparações, além de "H1N1"; o site fala essa linguagem e explica o que é ou não especificamente H1N1.

**Públicos que não definem a homepage:** pesquisa de genomas, downloads em lote, análises complexas, dados veterinários. Existem em áreas especializadas.

---

## 3. Jornadas por público

### 3.1. Jornada A · Responsável com criança com sintomas (P0)

| Etapa | O que acontece | Requisito do produto | Sinal de sucesso |
|---|---|---|---|
| 1. Busca | Digita "sintomas h1n1 criança" ou "gripe criança febre quando procurar médico" no celular | Página `/sintomas/criancas/` indexável **só depois de revisão clínica**; até lá, a busca cai em `/sintomas/sinais-de-alerta/` (indexável, com citação literal oficial) | Chega a uma página com resposta acima da dobra |
| 2. Resposta | Lê em até 20 segundos: o que os sintomas indicam e **o que não conseguem diferenciar** (não confirma subtipo por aparência) | Bloco "resposta principal" primeiro; bloco "sinais de alerta" com citação literal da fonte oficial e link | Não precisa abrir outra aba para saber se deve procurar atendimento |
| 3. Decisão | Reconhece um sinal de alerta ou não | Aviso fixo: "conteúdo educativo; não substitui avaliação médica"; instrução de procurar atendimento quando houver sinal de alerta | Procura serviço de saúde se houver sinal de alerta |
| 4. Aprofunda | Quer saber se "é H1N1 ou outra gripe" | Link para `/comparar/h1n1-vs-gripe-comum/` (noindex até revisão) e `/o-que-e-h1n1/` | Entende que só teste diferencia subtipo |
| 5. Compartilha | Envia para outro responsável ou grupo da escola | `/materiais/escolas/` (após revisão) com versão HTML acessível e data | Material tem data e fonte visíveis |

Pontos de atenção: nunca pedir sintomas, idade ou localização; nunca calcular probabilidade; nunca sugerir medicamento.

### 3.2. Jornada B · Jornalista apurando a temporada (P1)

| Etapa | O que acontece | Requisito do produto | Sinal de sucesso |
|---|---|---|---|
| 1. Chegada | Busca "casos h1n1 brasil 2026" ou chega pela homepage em "H1N1 no Brasil" | `/dados/brasil/` com indicador corretamente nomeado, data da base e texto de universo ao lado do número | Vê de imediato que o número é "SRAG com H1N1 confirmado", não "casos de H1N1" |
| 2. Leitura | Quer o número da última semana e a tendência | Gráfico com tabela equivalente; alerta de frescor; semanas recentes marcadas como provisórias | Não cita número provisório como definitivo |
| 3. Verificação | Precisa da fonte, da definição e da data | Bloco de metadados: fonte (BR-03), definição de caso literal (`CLASSI_FIN = 1 AND PCR_FLUASU = 1`), `data_as_of`, snapshot, licença | Consegue reproduzir a frase "segundo dados do SIVEP-Gripe extraídos em DD/MM/AAAA" |
| 4. Exportação | Quer os dados para gráfico próprio | Botão "Baixar dados" → `/v1/series.csv` com licença e dicionário; `/dados/metodologia/` | CSV baixado inclui `suppressed`, `data_as_of`, `source_id`, `license` |
| 5. Citação | Cita o site ou a fonte original | Texto sugerido de citação com fonte primária e link canônico; JSON-LD `Dataset` só nas séries derivadas próprias | Backlink ou citação com atribuição correta |

### 3.3. Jornada C · Profissional de saúde ou estudante (P1)

| Etapa | O que acontece | Requisito do produto | Sinal de sucesso |
|---|---|---|---|
| 1. Chegada | Busca "H1N1pdm09 subtipagem SIVEP" ou "influenza A não subtipada" | `/dados/metodologia/` e dicionário de indicadores públicos | Encontra a ontologia (H1N1 confirmado ≠ influenza A ≠ SRAG) |
| 2. Exploração | Compara H1N1 com H3N2 e influenza A não subtipada por semana e UF | Observatório com seletor de indicador; indicadores espelhados nunca somados; estratos por faixa etária com supressão < 5 | Lê células suprimidas como "suprimido (< 5)", não como zero |
| 3. Comparação internacional | Quer comparar com FluNet | `/dados/mundo/` (P1) com semana ISO e aviso de comparabilidade (SIVEP = SRAG hospitalizada; FluNet = detecções laboratoriais) | Não compara séries incompatíveis como se fossem a mesma |
| 4. Reprodução | Quer reproduzir um número | `/v1/indicators/:id` com `case_definition`, `methodology_version`, snapshot; `/v1/diff` entre snapshots | Reproduz o número a partir do arquivo original |
| 5. Retorno | Volta na próxima atualização | Página de temporada com data explícita; aviso de frescor | Retorno voluntário |

---

## 4. Mapa de telas e estados

Rotas conforme seção 6 do plano. Páginas marcadas **[clínica]** nascem `noindex`, fora do sitemap e fora da navegação até revisão clínica (ver seção 8 e POLITICA_EDITORIAL.md).

### 4.1. Inventário de telas do MVP

| Rota | Tipo | Índice | Navegação | Dado dinâmico |
|---|---|---|---|---|
| `/` | Home | index | — | Sim (1 indicador) |
| `/o-que-e-h1n1/` | Referência | index | Entenda o H1N1 | Não |
| `/sintomas/` | Resposta [clínica] | noindex até revisão | oculta até revisão | Não |
| `/sintomas/criancas/` | Resposta [clínica] | noindex até revisão | oculta até revisão | Não |
| `/sintomas/sinais-de-alerta/` | Resposta (citação literal oficial) | index | Sintomas e cuidados | Não |
| `/transmissao/` | Referência | index | Entenda o H1N1 | Não |
| `/prevencao/` | Resposta [clínica] | noindex até revisão | oculta até revisão | Não |
| `/vacina/` | Resposta [clínica] | noindex até revisão | oculta até revisão | Não |
| `/comparar/h1n1-vs-covid/` | Comparador [clínica] | noindex até revisão | oculta até revisão | Não |
| `/comparar/h1n1-vs-gripe-comum/` | Comparador [clínica] | noindex até revisão | oculta até revisão | Não |
| `/dados/brasil/` | Observatório | index | H1N1 hoje | Sim |
| `/dados/fontes/` | Catálogo de fontes | index | Dados e pesquisas | Sim (65 fontes) |
| `/dados/fontes/[slug]/` | Fonte | index | — | Sim |
| `/dados/metodologia/` | Metodologia | index | Dados e pesquisas | Sim (dicionário) |
| `/historia/` | Linha do tempo | index | Entenda o H1N1 | Não (fatos de `facts`) |
| `/sobre/` | Institucional | index | rodapé | Não |
| `/sobre/equipe-e-revisao/` | Institucional | index | rodapé | Não |
| `/sobre/politica-editorial/` | Institucional | index | rodapé | Não |
| `/sobre/financiamento-e-publicidade/` | Institucional | index | rodapé | Não |
| `/sobre/correcoes/` | Changelog | index | rodapé | Não |
| `/contato/` | Institucional | index | rodapé | Não |
| `/materiais/escolas/`, `/materiais/empresas/` | Materiais [clínica] | noindex até revisão | oculta até revisão | Não |
| `/tratamento/` | — | **fora do MVP** | — | — |

### 4.2. Home

```text
[H1N1]                                   [Buscar no site]

O que você precisa saber sobre H1N1?
Informação de saúde revisada e dados de fontes oficiais.

[Quais são os sintomas?] [Como se transmite?] [Vacina protege?]
[Quando procurar atendimento?]

------------------------------------------------------------
H1N1 no Brasil | última base disponível: DD/MM/AAAA
[SRAG com A(H1N1)pdm09 confirmada · últimas N semanas] [tendência] [ver metodologia]
"Os números representam notificações de SRAG hospitalizada ... não todos os casos de H1N1 da população."
[Explorar o observatório]
------------------------------------------------------------

Entenda em poucos minutos
[Comparar doenças] [Linha do tempo] [Prevenção]

Fontes oficiais | Equipe e revisão | Política editorial
```

Estados do bloco "H1N1 no Brasil":

| Estado | Condição | Renderização |
|---|---|---|
| Normal | publicação vigente com `age_days` dentro do limite do indicador | Valor, semana, tendência, `data_as_of`, texto de universo |
| Defasado | `age_days` acima do limite (implementado na web: limite único de 14 dias para todas as fontes; limites por fonte, como FluNet 21 dias, pendentes) | Valor + faixa "Dados defasados: última base DD/MM/AAAA" |
| Indisponível | sem publicação vigente (`observations: []`, `data_as_of: null`) | Bloco substituído por "Observatório temporariamente sem dados publicados" + link para `/dados/metodologia/`; **nunca** zero, nunca número antigo sem data |
| Carregando | SSR/ISR: não existe estado de carregamento visível na home; o HTML já chega com o dado ou com o estado indisponível | — |

Botões de atalho da home apontam para páginas clínicas apenas quando elas estiverem publicadas; enquanto `noindex`, os botões "Quais são os sintomas?" e "Vacina protege?" apontam para `/sintomas/sinais-de-alerta/` e `/o-que-e-h1n1/` respectivamente, ou ficam ocultos.

### 4.3. Página de resposta (template de referência)

Ordem fixa dos blocos (plano 5.1):

1. **Resposta principal** em linguagem simples (máximo ~80 palavras) no primeiro bloco.
2. **Quando procurar atendimento** (sinais de alerta), com citação literal da orientação oficial e link.
3. **O que isso não diferencia** (sintomas não confirmam subtipo).
4. **Perguntas que aprofundam** a mesma intenção (links internos).
5. **Fontes, autoria, revisão e data**: autoria "Redação H1N1 com apoio de IA, a partir de fontes oficiais, sem revisão clínica até o momento" enquanto não houver revisor; `reviewed_at`, `review_status`, lista de `sources`.
6. **Ligações** para prevenção, vacinação e observatório.

Estados:

| Estado | Condição (frontmatter) | Renderização |
|---|---|---|
| Publicada | `review_status: reviewed` e revisor identificado | index, no sitemap, na navegação; selo "Revisado por [nome, registro] em DD/MM/AAAA" |
| Pendente de revisão clínica | `review_status: pending_clinical_review` | `noindex,nofollow`, fora do sitemap e da navegação; faixa no topo "Este conteúdo ainda não passou por revisão clínica" |
| Rascunho | `review_status: draft` | não é construída |
| Desatualizada | `reviewed_at` > 12 meses ou fonte alterada | faixa "Em reavaliação" + ticket de revisão |

### 4.4. Observatório `/dados/brasil/`

Componentes: seletor de indicador (apenas indicadores SIVEP e IBGE habilitados no MVP), seletor de período (temporada / últimas 12, 26, 52 semanas), seletor de UF (opcional), seletor de faixa etária (opcional), gráfico com tabela equivalente, bloco de metadados, botão "Baixar dados", texto de universo, caveats, link para metodologia.

| Estado | Condição | Renderização |
|---|---|---|
| Carregando | troca de filtro no cliente | Esqueleto do gráfico + tabela; o estado anterior não permanece visível com os novos filtros |
| Normal | série com observações | Gráfico, tabela, metadados, universo |
| Indisponível | API 5xx, timeout, ou `observations: []` sem publicação | Mensagem "Dados indisponíveis no momento"; metadados da última publicação conhecida se existirem; **sem** gráfico vazio com eixo zero |
| Defasado | `freshness.age_days` acima do limite | Faixa amarela com `data_as_of` e `fetched_at`; gráfico permanece |
| Provisório | observações com `update_status: provisional` | Pontos/barras recentes com hachura e legenda "provisório, sujeito a revisão" |
| Suprimido | células com `suppressed: true` | Célula mostra "< 5" na tabela e lacuna no gráfico; legenda "valores menores que 5 são suprimidos em recortes por UF e faixa etária" |
| Denominador insuficiente | `quality_flags` contém `denominator_below_minimum` | Célula "n/d (denominador < N)" |
| Sem recorte | UF ou estrato sem dados | "Sem registros nesta combinação"; nunca zero implícito |

Regras: totais nacionais nunca suprimidos; recortes UF × semana × faixa etária com supressão < 5 e complementar; nunca município; nunca "tempo real".

### 4.5. Catálogo de fontes `/dados/fontes/`

Lista as 65 fontes com filtros por país/região, prioridade, tipo de acesso. Cada fonte tem página própria com: órgão, categoria, acesso, recorte H1N1, cadência, licença, `mirror_group` ("não somar com ..."), `api_tested_at`, indicadores derivados e última snapshot.

Estados: lista sempre renderizada a partir de `/v1/sources` (SSG); se a API estiver fora no build, usa o último build válido; a página de fonte mostra "Sem snapshot registrada" quando não houver ingestão.

### 4.6. Metodologia `/dados/metodologia/`

Conteúdo: ontologia (H1N1 confirmado ≠ influenza A ≠ SRAG ≠ síndrome gripal), dicionário de indicadores gerado de `/v1/indicators`, semanas epidemiológicas (BR vs MMWR vs ISO com exemplos), supressão, snapshots e revisões, licenças, glossário, lista das 10 regras de integridade.

### 4.7. Sobre

`/sobre/` e subpáginas: quem faz, política editorial, política de IA, financiamento e publicidade (sem anúncios no MVP), correções (changelog público), contato. Revisor clínico, DPO e CNPJ/entidade responsável: **a definir**, exibidos como tal, nunca inventados.

---

## 5. Requisitos funcionais

Prefixos: **RF** funcional; cada um tem critério de verificação. "Deve" = obrigatório no MVP; "Pode" = desejável.

### 5.1. Conteúdo e páginas

| ID | Requisito | Verificação |
|---|---|---|
| RF-01 | O site deve renderizar as 12 páginas P0 da seção 9 do plano como HTML no servidor (SSG/ISR), sem depender de JavaScript para o texto principal | `curl` sem JS contém o bloco de resposta principal |
| RF-02 | Toda página de conteúdo deve ter frontmatter com `author`, `reviewer`, `reviewed_at`, `review_status`, `sources` e exibi-los | Teste de build falha se faltar campo |
| RF-03 | Páginas com `review_status != reviewed` devem renderizar `<meta name="robots" content="noindex,nofollow">`, ficar fora do sitemap e fora da navegação | Teste automatizado de CI (ver RNF-SEO-04) |
| RF-04 | `/sintomas/sinais-de-alerta/` deve exibir a orientação oficial como citação literal, com URL, data de acesso e sem reescrita | Revisão editorial + link verificado no build |
| RF-05 | Toda página clínica deve exibir aviso fixo de que o conteúdo é educativo e não substitui avaliação médica | Snapshot test do layout |
| RF-06 | Nenhum número epidemiológico pode estar hard-coded em MDX; números vêm de componente que consulta a API | Lint de conteúdo: regex de números seguidos de "casos", "óbitos", "%" em MDX gera erro, salvo quando marcados como `facts` |
| RF-07 | Fatos históricos citados (ex.: datas da pandemia de 2009) devem vir de `facts.json`/tabela `facts`, com fonte, citação e data de verificação | Página `/historia/` renderiza somente fatos da tabela |
| RF-08 | A home deve ter duas portas visíveis: "Entenda o H1N1" e "Acompanhe os dados" | Teste de acessibilidade/landmarks |
| RF-09 | Pode existir busca interna (PostgreSQL full-text) sem registro de consultas por usuário | Logs não contêm texto de busca associado a IP |

### 5.2. Observatório e dados

| ID | Requisito | Verificação |
|---|---|---|
| RF-10 | O observatório deve consumir exclusivamente `/v1/series` e `/v1/freshness`; nunca lê arquivos brutos | Grep no código do web: sem acesso a `data/snapshots` |
| RF-11 | Todo número exibido deve estar acompanhado de `meta.universe_note`, `meta.case_definition` (ou link), `data_as_of` e fonte | Teste de componente: renderizar série sem `universe_note` lança erro |
| RF-12 | O observatório deve mostrar separadamente SRAG total, SRAG por influenza, A(H1N1)pdm09 confirmada, A(H3N2), influenza A não subtipada e óbitos, sem somá-los | Indicadores distintos; ausência de operação de soma no cliente |
| RF-13 | Semanas com `update_status: provisional` devem ser visualmente distintas e legendadas | Snapshot visual |
| RF-14 | Células `suppressed: true` devem exibir "< 5" e nunca zero | Teste de tabela |
| RF-15 | O botão "Baixar dados" deve apontar para `/v1/series.csv` com os mesmos filtros e exibir a licença da fonte | Link gerado com query idêntica |
| RF-16 | Quando não houver publicação vigente, o observatório deve exibir estado "indisponível" e nunca gráfico vazio com eixo em zero | Teste com API mockada vazia |
| RF-17 | Quando `age_days` exceder o limite do indicador, deve exibir alerta de frescor | Teste com `freshness` mockado |
| RF-18 | Filtros de UF e faixa etária só ficam disponíveis para indicadores cujo `geo_levels`/`stratum_schema` os suporte | Seletor derivado da definição |
| RF-19 | Gráficos devem ter tabela equivalente acessível e texto alternativo descritivo | Auditoria WCAG |
| RF-20 | Pode existir `/dados/mundo/` com FluNet (semana ISO) em P1, com aviso de comparabilidade | — |

### 5.3. Catálogo e metodologia

| ID | Requisito | Verificação |
|---|---|---|
| RF-21 | `/dados/fontes/` deve listar as 65 fontes a partir de `/v1/sources` com filtros | Contagem = 65 |
| RF-22 | Cada fonte deve mostrar `mirror_group` com a frase "não somar com: ..." quando aplicável | Render para BR-03 lista BR-01, BR-02, BR-04, BR-12 |
| RF-23 | `/dados/metodologia/` deve renderizar o dicionário a partir de `/v1/indicators` (não cópia manual) | Diff entre API e página vazio |
| RF-24 | A metodologia deve explicar as três convenções de semana com os exemplos verificados | Texto presente |

### 5.4. API e pipeline (resumo; detalhe em CONTRATO_API.md)

| ID | Requisito | Verificação |
|---|---|---|
| RF-30 | API `/v1` deve expor `health, sources, sources/:id, indicators, indicators/:id, series, series.csv, freshness, snapshots, snapshots/:id, diff, geo` | Testes de rota |
| RF-31 | `/v1/series` deve servir apenas a snapshot com `status = current` do indicador | Teste: snapshot `superseded` não aparece |
| RF-32 | Supressão deve ocorrer na camada de publicação; valores brutos suprimidos nunca saem da API nem do CSV | Teste de `applySuppression` + rota |
| RF-33 | Publicação de indicador deve ser atômica e bloqueada se a validação falhar, mantendo a anterior | Teste de `publishIndicator`/`rejectPublication` |
| RF-34 | Toda snapshot deve registrar `sha256`, `url`, `fetched_at`, `license`, `data_as_of` | Constraint not null + teste |
| RF-35 | `/v1/diff` deve permitir comparar duas snapshots do mesmo indicador (pesquisa R07) | Teste |

### 5.5. Institucional

| ID | Requisito | Verificação |
|---|---|---|
| RF-40 | `/sobre/correcoes/` deve listar correções com data, página, descrição e motivo | Página gerada de `CHANGELOG` editorial |
| RF-41 | `/sobre/equipe-e-revisao/` deve declarar a política de IA e o estado "sem revisão clínica até o momento" quando aplicável | Texto obrigatório |
| RF-42 | `/contato/` não deve ter formulário no MVP; exibe e-mail institucional (**a definir**) | — |

---

## 6. Requisitos não funcionais

### 6.1. SEO e descoberta

| ID | Requisito |
|---|---|
| RNF-SEO-01 | Páginas indexáveis em HTML completo no servidor; conteúdo principal não depende de JS |
| RNF-SEO-02 | `canonical`, `title`, `description` únicos por página; `max-image-preview:large` |
| RNF-SEO-03 | Sitemap XML contém apenas páginas `review_status: reviewed` ou não clínicas |
| RNF-SEO-04 | CI testa que toda página clínica não revisada responde com `noindex,nofollow` e está ausente do sitemap; falha bloqueia deploy |
| RNF-SEO-05 | JSON-LD: `Organization` e `WebSite` no layout; `BreadcrumbList` em páginas internas; `Dataset` apenas em páginas de séries derivadas próprias (com `license`, `isBasedOn`, `temporalCoverage`, `spatialCoverage`); `DataCatalog` em `/dados/fontes/`. **Sem** `FAQPage` nem `MedicalWebPage` |
| RNF-SEO-06 | URLs de filtros do observatório (`?uf=`, `?faixa=`) são `noindex` e canonicalizam para `/dados/brasil/`; nenhuma página por município |
| RNF-SEO-07 | Nenhuma página usa a expressão "tempo real"; lint textual bloqueia |
| RNF-SEO-08 | `robots.txt` não bloqueia rastreadores indiscriminadamente; a API pública é `noindex` via header |

### 6.2. Acessibilidade (WCAG 2.1 AA)

| ID | Requisito |
|---|---|
| RNF-A11Y-01 | Contraste mínimo 4,5:1 para texto e 3:1 para componentes/gráficos |
| RNF-A11Y-02 | Navegação completa por teclado; foco visível; ordem lógica |
| RNF-A11Y-03 | Landmarks (`header`, `nav`, `main`, `footer`) e hierarquia de títulos sem saltos |
| RNF-A11Y-04 | Gráficos com `aria-label` descritivo e tabela equivalente; cores não são o único meio de distinguir séries |
| RNF-A11Y-05 | Alvos de toque mínimos de 44 × 44 px em mobile |
| RNF-A11Y-06 | Textos em `lang="pt-BR"`; siglas expandidas na primeira ocorrência |
| RNF-A11Y-07 | Auditoria automatizada (axe) em CI com zero violações críticas; auditoria manual antes do lançamento |

### 6.3. Desempenho (Core Web Vitals)

| ID | Requisito |
|---|---|
| RNF-CWV-01 | Alvos no p75 de usuários reais: LCP ≤ 2,5 s, INP < 200 ms, CLS < 0,1 |
| RNF-CWV-02 | Até haver amostra de campo, Lighthouse em CI com orçamento: JS inicial ≤ 150 kB gzip nas páginas de conteúdo |
| RNF-CWV-03 | Gráficos carregam depois do texto; reservam altura (sem CLS); fallback tabular no HTML |
| RNF-CWV-04 | Imagens com dimensões explícitas; formatos modernos; sem mapas pesados no MVP |
| RNF-CWV-05 | Cache HTTP conforme CONTRATO_API.md; páginas ISR revalidadas por tempo (1 h); revalidação por evento de publicação pendente |

### 6.4. Segurança

| ID | Requisito |
|---|---|
| RNF-SEC-01 | HTTPS obrigatório; HSTS; cabeçalhos `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` |
| RNF-SEC-02 | API somente leitura e pública; endpoints de publicação/ingestão não expostos via HTTP (CLI interna) |
| RNF-SEC-03 | Validação de todos os parâmetros (zod); erros sem stack trace (`{ error: { code, message } }`) |
| RNF-SEC-04 | Rate limit por IP na API (ver contrato); sem credenciais no repositório; segredos por variável de ambiente |
| RNF-SEC-05 | Snapshots baixadas tratadas como dados não confiáveis: parse em processo isolado, limite de tamanho, hash verificado |
| RNF-SEC-06 | Dependências auditadas em CI; versões fixadas pelo lockfile |

### 6.5. LGPD e privacidade (detalhe em LGPD_E_PRIVACIDADE.md)

| ID | Requisito |
|---|---|
| RNF-LGPD-01 | Sem analytics, pixels ou cookies de terceiros no MVP |
| RNF-LGPD-02 | Nunca solicitar sintomas, idade, localização exata ou dados de saúde do visitante |
| RNF-LGPD-03 | Logs de servidor com IP truncado e retenção máxima de 30 dias |
| RNF-LGPD-04 | Microdados SIVEP processados em streaming; apenas agregados persistidos; linhas individuais nunca gravadas no banco |
| RNF-LGPD-05 | Supressão < 5 em recortes subnacionais estratificados; nunca município × idade × data |

### 6.6. Operação

| ID | Requisito |
|---|---|
| RNF-OPS-01 | `pnpm install && pnpm build && pnpm test` verdes em CI |
| RNF-OPS-02 | Cada ingestão registra `ingestion_runs` com status, contagens e erro |
| RNF-OPS-03 | Alerta quando `age_days` de um indicador P0 exceder o limite ou quando uma ingestão falhar duas vezes seguidas |
| RNF-OPS-04 | Banco: PGlite em dev/teste; Postgres em produção com o mesmo SQL |

---

## 7. Regras de integridade como requisitos testáveis

As 10 regras da seção 10.4 do plano, traduzidas em testes.

| Regra | Requisito testável | Onde testa |
|---|---|---|
| 1. H1N1 confirmado ≠ influenza A não subtipada | `sivep_srag_ah1n1pdm09_confirmed` usa `CLASSI_FIN = 1 AND PCR_FLUASU = 1`; `PCR_FLUASU IN (3,4)` vai para `sivep_srag_inf_a_not_subtyped`; FluNet `ANOTSUBTYPED` e `ANOTSUBTYPABLE` são indicadores separados | Teste do normalizador SIVEP com fixture; teste do mapeamento FluNet |
| 2. Casos graves ≠ infectados | `universe_note` obrigatório e não vazio em todo indicador; UI falha ao renderizar sem ele | Constraint `not null` + teste de componente |
| 3. Óbitos codificados ≠ óbitos por H1N1 | `sivep_srag_ah1n1pdm09_deaths` usa `EVOLUCAO = 2` (exclui 3) e rótulo "óbitos entre SRAG com H1N1 confirmado"; lint proíbe "mortes por H1N1" em conteúdo e UI | Teste do normalizador; lint textual |
| 4. Positividade depende de cobertura | Indicadores percentuais têm `denominator_indicator_id` e `min_denominator`; razões com denominador < mínimo saem com `value: null` e flag `denominator_below_minimum` | Teste de `getSeries` |
| 5. Não somar canais espelhados | `MIRROR_GROUPS` em core; UI nunca soma indicadores de fontes do mesmo grupo; catálogo exibe "não somar com" | Teste unitário de `mirrorGroupOf`; revisão de componentes |
| 6. Exibir períodos, revisões, atraso | `period_start`, `period_end`, `event_date_basis`, `update_status`, `data_as_of`, `fetched_at` presentes em toda resposta de série | Teste de contrato |
| 7. Não inferir risco individual | Nenhuma calculadora, quiz ou formulário de sintomas; lint de rotas proíbe `/teste`, `/calculadora` | Revisão de PR |
| 8. Trends não substitui vigilância | Dados de interesse de busca (R08) nunca entram em `indicators`; ficam em pesquisa separada com aviso | Revisão de ontologia |
| 9. Não divulgar células pequenas | `applySuppression` com threshold 5, complementar, isenta totais nacionais; CSV sai sem valor bruto | Testes de supressão (simples e complementar) |
| 10. Bloquear publicação com falha | `publishIndicator` atômico; `rejectPublication` registra relatório; API serve a última `current` com `data_as_of` | Teste de transação |

Regras adicionais verificadas em 2026-10-20 e incorporadas:

- UF = `SG_UF` (residência); semana = `SEM_PRI`; registros com UF ignorada ou residência fora do Brasil ficam fora dos recortes por estado (entram no total nacional).
- Semana epidemiológica brasileira: SE 1 contém 1º de janeiro quando ele cai de domingo a quinta; MMWR exige 4 dias (domingo a quarta). Testado contra arquivos SIVEP 2021, 2022, 2025, 2026.
- Texto de universo FluNet e SIVEP é literal, igual em core, API e UI.

---

## 8. Critérios de aceite por tela

| Tela | Critérios de aceite |
|---|---|
| Home | (a) Duas portas visíveis acima da dobra em 360 px; (b) bloco "H1N1 no Brasil" exibe indicador nomeado como "SRAG com A(H1N1)pdm09 confirmada", `data_as_of` e texto de universo literal; (c) sem publicação vigente, exibe estado indisponível e nenhum número; (d) sem a expressão "tempo real"; (e) LCP ≤ 2,5 s em Lighthouse mobile |
| Página de resposta | (a) Primeiro bloco é a resposta principal; (b) bloco de autoria/revisão/data visível com o texto oficial de autoria; (c) se não revisada: `noindex`, fora do sitemap e da navegação, faixa de aviso; (d) aviso "não substitui avaliação médica"; (e) toda fonte citada tem URL e data de acesso; (f) nenhum número epidemiológico em texto |
| Sinais de alerta | (a) Citação literal da fonte oficial com link e data; (b) indexável; (c) instrução clara de procurar atendimento; (d) sem lista "própria" que altere a orientação oficial |
| Observatório Brasil | (a) Seis indicadores SIVEP separados, selecionáveis, nunca somados; (b) cada vista exibe universo, definição de caso, `data_as_of`, snapshot e licença; (c) provisório hachurado; (d) suprimido como "< 5"; (e) estado indisponível e defasado implementados e testados; (f) download CSV com filtros idênticos; (g) tabela equivalente ao gráfico; (h) axe sem violações críticas |
| Catálogo de fontes | (a) 65 fontes; (b) filtros funcionam sem JS (query string) e com JS; (c) `mirror_group` exibido; (d) página de fonte com snapshots e indicadores; (e) `DataCatalog` JSON-LD válido |
| Metodologia | (a) Dicionário gerado da API; (b) três convenções de semana com os exemplos (SE 1/2026 = 28/12/2025; MMWR 40/2026 = 04/10/2026; ISO 41/2026 = 05/10/2026); (c) regras de integridade listadas; (d) supressão explicada |
| História | (a) Todos os fatos vêm da tabela `facts` com fonte e citação; (b) marcos de mudança metodológica sinalizados; (c) sem números de casos/óbitos fora de `facts` verificados |
| Sobre | (a) Política editorial, de IA, de correções e de publicidade publicadas; (b) campos "a definir" exibidos como tal; (c) changelog de correções funcional |

---

## 9. Fora de escopo do MVP

- `/tratamento/` e qualquer orientação sobre antivirais, doses ou condutas.
- Chatbot, RAG voltado ao público, calculadoras, quizzes de sintomas, "teste de H1N1".
- Páginas por município ou qualquer URL programática sem dado próprio.
- Analytics, pixels, newsletter, formulários de contato.
- `/dados/mundo/`, `/pesquisas/`, `/boletins/`, `/materiais/*` (P1, após revisão e dados).
- Versões em espanhol e inglês.
- API premium, autenticação, chaves de API.
- Integração com disponibilidade de doses, horários de vacinação ou serviços de saúde.
- Dados veterinários e zoonoses na navegação principal.
- Ingestão de fontes P0 sem conector no MVP (ver MAPEAMENTO_FONTES_P0.md): SINAN 2009–2018, PNI, SIM, FluID, ERVISS, FluView, NCBI, FluWatch+, NNDSS, México, China.

---

## 10. Riscos e mitigação

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| 1 | Sem revisor clínico, as páginas P0 clínicas permanecem `noindex` e o lançamento perde as intenções de maior alcance | Alta | Alto | Lançar com páginas não clínicas + sinais de alerta (citação literal) + observatório; formalizar revisor como critério de avanço do Sprint 1 |
| 2 | Arquivo SIVEP de 261 MB muda de esquema ou URL sem aviso | Média | Alto | Validação de esquema no conector; snapshot anterior permanece `current`; alerta de frescor |
| 3 | Leitura enganosa de "SRAG com H1N1" como "casos de H1N1" pela imprensa | Alta | Alto | Rótulo e universo literais ao lado do número; texto de citação sugerido; sem "casos de H1N1" em UI |
| 4 | Supressão complementar insuficiente para reidentificação em UF pequena | Baixa | Alto | Não publicar município; faixas etárias largas; revisão da política de supressão a cada novo estrato |
| 5 | Dependência de SEO e mudanças de distribuição | Média | Médio | Materiais, referências diretas, citação por imprensa; sem meta de tráfego nesta fase |
| 6 | Conteúdo com apoio de IA percebido como de baixa qualidade ou em escala | Média | Alto | Publicar por intenção, não por sinônimo; autoria transparente; revisão humana obrigatória; veto editorial |
| 7 | Semana epidemiológica calculada errada em virada de ano | Baixa | Médio | `epiweek.ts` testado contra `SEM_PRI` real de quatro anos; testes de borda (28/12, 01/01, 04/01) |
| 8 | Fastify separado aumenta custo operacional (dissidência do validador) | Média | Baixo | Lógica de consulta em `packages/db`; borda substituível por Route Handlers sem reescrever consultas (ADR-003) |
| 9 | Licença de fonte internacional não permite republicação | Média | Médio | `license` por snapshot; fontes `verify_per_source` não publicadas até confirmação |
| 10 | Dado defasado exibido como atual | Baixa | Alto | Alerta de frescor obrigatório; `data_as_of` em toda tela; teste RF-17 |

---

## 11. Métricas

Seção 15 do plano. **Métrica principal de produto:** sessões orgânicas qualificadas que alcançam uma resposta, ferramenta ou visualização útil. Sem analytics no MVP, a aproximação inicial usa Search Console (impressões, cliques, CTR, posição por cluster) e logs de servidor agregados (páginas servidas, downloads de CSV, chamadas à API), sem identificação de usuário.

### 11.1. Scorecard mensal

| Categoria | Indicador | Fonte no MVP | Interpretação |
|---|---|---|---|
| Aquisição | Impressões e cliques orgânicos | Search Console | Descoberta real |
| Busca | CTR e posição por cluster de intenção | Search Console + PESQUISA_DEMANDA.md | Adequação entre SERP, promessa e página |
| Produto | Downloads de CSV, chamadas a `/v1/series` | Logs agregados | Valor além de leitura passiva |
| Engajamento | Sessões engajadas por tipo de página | **não medido no MVP** (sem analytics) | — |
| Retenção | Retorno voluntário, assinaturas | **não medido no MVP** | — |
| Autoridade | Referências editoriais e links | Search Console (links) + registro manual | Reconhecimento externo |
| Operação | `age_days` por indicador, falhas de ingestão, publicações rejeitadas | `/v1/freshness`, `ingestion_runs`, `indicator_publications` | Confiabilidade |
| Segurança | Correções clínicas, reclamações fundamentadas, páginas desatualizadas | `/sobre/correcoes/` + backlog | Controle de risco |
| SEO técnico | Páginas indexáveis válidas, CWV, cobertura | Search Console + Lighthouse CI | Saúde do canal |

### 11.2. Metas operacionais (não são metas de audiência)

- 100% das afirmações clínicas sensíveis com referência e revisão apropriada (até lá, `noindex`).
- 100% dos gráficos com definição de indicador e data da fonte.
- 100% dos dados ingeridos com identificador e snapshot de origem (sha256).
- 0 painéis exibidos como atualizados se a sincronização falhou.
- 12 páginas P0 bem feitas antes de escalar.
- 1 estudo original concluído e auditável até o dia 60.
- LCP ≤ 2,5 s, INP < 200 ms, CLS < 0,1 no p75 quando houver amostra.

Não há meta de visitas. Após 60–90 dias de Search Console, estimar cenários conservador/base/agressivo.
