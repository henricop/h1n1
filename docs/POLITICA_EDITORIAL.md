# H1N1 · Política editorial

**Versão:** 1.0 · **Data:** 2026-10-20 · **Publicação:** o conteúdo desta política é a base de `/sobre/politica-editorial/`, `/sobre/equipe-e-revisao/`, `/sobre/financiamento-e-publicidade/` e `/sobre/correcoes/`. Deriva das seções 8.5, 11, 12 e 13 do plano estratégico.

Princípio: **nenhum score de demanda, prazo ou meta de tráfego justifica publicar conteúdo clínico não revisado ou estatística com denominador inadequado** (veto editorial, plano 4.3).

---

## 1. Processo de aprovação (plano 11.1)

| Tipo de conteúdo | Produção | Revisão mínima antes de publicar | Estado inicial no repositório |
|---|---|---|---|
| Página de conceito geral (`/o-que-e-h1n1/`, `/transmissao/`, `/historia/`) | Redação e pesquisa com apoio de IA | Checagem de fonte linha a linha + editor responsável | `review_status: editorial_review` → `reviewed` |
| Sintomas, prevenção, vacina, comparadores, materiais | Redação apoiada em protocolos oficiais | **Profissional de saúde qualificado** + checagem editorial | `pending_clinical_review` (noindex, fora do sitemap e da navegação) |
| Sinais de alerta (`/sintomas/sinais-de-alerta/`) | Citação literal da orientação oficial, sem reescrita | Checagem editorial de fidelidade da citação, URL e data de acesso; revisão clínica recomendada, não bloqueante enquanto o texto for literal | `reviewed` (indexável) |
| Estatística ou comparação epidemiológica (observatório, metodologia) | Analista de dados / pipeline | Revisão metodológica (definição de caso, universo, denominador, semana) + editorial | Indicador publicado só após validação automática (ADR-005) |
| Pesquisa original com conclusão de saúde | Analista + autor técnico | Revisor epidemiológico/clínico apropriado + método público | `pending_clinical_review` |
| Atualização automatizada de gráfico | ETL determinístico | QA automatizado, alarmes e revisão por exceção (publicação rejeitada → humano) | — |
| Tratamento (`/tratamento/`) | — | **Fora do MVP**; só com revisão médica formal e escopo "orientações gerais, sem prescrição" | não existe |

### 1.1. Fluxo

1. **Pauta** aprovada por intenção (PESQUISA_DEMANDA.md), não por sinônimo. Uma URL por intenção.
2. **Rascunho** em MDX com frontmatter completo (`author`, `reviewer`, `reviewed_at`, `review_status`, `sources`, `ai_assisted`). Números epidemiológicos proibidos no texto (RF-06); fatos históricos só de `facts.json`.
3. **Checagem de fontes**: cada afirmação relevante tem fonte oficial com URL, trecho citado e data de acesso; fontes salvas em snapshot quando possível.
4. **Revisão editorial**: clareza, estrutura do template de resposta, ausência de alarmismo, terminologia (A(H1N1)pdm09, H1N1, influenza A com distinções claras), avisos obrigatórios.
5. **Revisão clínica** (quando exigida): ver seção 4.
6. **Publicação**: muda `review_status` para `reviewed`; CI libera index, sitemap e navegação.
7. **Reavaliação**: a cada mudança de diretriz oficial, a cada temporada, ou em 12 meses, o que vier primeiro. Página vencida ganha faixa "Em reavaliação" e, se houver risco, volta para `noindex`.

### 1.2. O que bloqueia publicação

- Afirmação clínica sem fonte oficial verificável.
- Página clínica sem revisor habilitado identificado.
- Qualquer número epidemiológico escrito à mão.
- Uso de "casos de H1N1" para SRAG confirmada, "mortes por H1N1" para óbitos entre SRAG, "tempo real" para qualquer painel.
- Conteúdo que infira risco individual, probabilidade de diagnóstico ou conduta medicamentosa.
- Título ou meta description que prometa mais do que a página entrega (ex.: "casos hoje na sua cidade").
- Fonte com licença não confirmada para redistribuição de dados.

---

## 2. Hierarquia de fontes

Ordem de preferência para afirmações clínicas e epidemiológicas. Quando fontes de níveis diferentes divergem, prevalece a mais alta e a divergência é registrada na página.

| Nível | Fonte | Uso |
|---|---|---|
| 1 | Normas e protocolos do Ministério da Saúde (guias, notas técnicas, informes de influenza — BR-11), Anvisa para produtos | Definições de caso, sinais de alerta, grupos prioritários, campanhas |
| 2 | OMS (programa global de influenza, recomendações de composição vacinal — INT-04), OPAS | Contexto global, nomenclatura, composição vacinal |
| 3 | Dados primários oficiais com dicionário (SIVEP-Gripe, SINAN, SIM, PNI, FluNet, FluID, UKHSA, CDC) | Todo número do observatório; sempre via banco versionado |
| 4 | Agências nacionais de outros países (CDC, ECDC, UKHSA, PHAC...) | Comparações internacionais com nota de comparabilidade |
| 5 | Instituições de pesquisa pública e painéis derivados (Fiocruz InfoGripe, scripts oficiais) | Contexto e validação cruzada; nunca somados aos primários (`mirror_group`) |
| 6 | Literatura revisada por pares (PubMed, com preferência a revisões sistemáticas e diretrizes de sociedades) | Aprofundamento, história, ciência e variantes; nunca para conduta individual |
| 7 | Registros de ensaios (ClinicalTrials.gov) | Apenas como "estudo registrado", nunca como evidência de eficácia |
| — | Imprensa, blogs, redes sociais, sites de hospitais privados, conteúdo gerado por IA de terceiros | **Não são fontes.** Podem ser citados como "o que circula" apenas em pesquisas sobre desinformação, com cautela |

Regras:

- Citação literal, com aspas, para sinais de alerta e definições de caso. Paráfrase apenas para explicação, nunca para orientação de conduta.
- Toda fonte tem URL canônica, título, órgão, data de publicação (quando houver) e data de acesso.
- Fontes em PDF ganham snapshot com hash; se o link quebrar, a página cita o snapshot e abre ticket de atualização.
- Dados espelhados (OPAS vs FluNet, InfoGripe vs SIVEP, ENA vs NCBI) nunca são somados nem apresentados como fontes independentes de confirmação.

---

## 3. Política de uso de IA

Declaração pública (obrigatória em `/sobre/equipe-e-revisao/` e no bloco de autoria de cada página enquanto não houver revisor):

> **Autoria:** Redação H1N1 com apoio de IA, a partir de fontes oficiais, sem revisão clínica até o momento.

Quando houver revisão clínica, o bloco passa a: "Redação H1N1 com apoio de IA, a partir de fontes oficiais. Revisão clínica: [nome, profissão, registro profissional], em DD/MM/AAAA."

Regras:

1. IA é usada para rascunhar, estruturar, resumir fontes, sugerir perguntas e revisar linguagem. **Não** é fonte de fatos, números ou orientações.
2. Toda afirmação gerada com apoio de IA passa por checagem humana de fonte antes de publicação; o campo `ai_assisted: true` fica no frontmatter e é exibido.
3. IA **nunca** decide publicação, nunca atribui revisão clínica, nunca gera números epidemiológicos (RF-06, ADR-006) e nunca interage com o visitante para responder dúvidas de saúde (sem chatbot no MVP).
4. Dados pessoais de visitantes não são enviados a provedores de IA (não há coleta).
5. Conteúdo em escala gerado por IA para capturar palavras-chave é proibido (política de spam do Google e plano 8.4). O limite é editorial: uma página por intenção, com valor próprio.
6. Prompts e modelos usados ficam registrados no histórico do repositório para auditoria interna; não são exibidos ao público.
7. Imagens e diagramas gerados por IA levam legenda com essa informação e nunca representam pessoas reais nem sinais clínicos como se fossem fotografias médicas.

---

## 4. Revisão clínica

### 4.1. Requisitos do revisor

- Profissional de saúde com registro ativo em conselho profissional brasileiro (medicina, enfermagem ou farmácia, conforme o conteúdo) **e** experiência em infectologia, epidemiologia, pediatria, saúde da família, saúde pública ou vigilância, conforme o tema.
- Para conteúdo pediátrico (`/sintomas/criancas/`, materiais para escolas): experiência em pediatria ou saúde da criança.
- Para estatística: formação em epidemiologia, bioestatística ou saúde coletiva.
- Sem conflito de interesse não declarado (seção 6).
- Nome, profissão, registro e vínculo exibidos publicamente após consentimento por escrito.
- **Revisor do projeto: a definir.** Até a formalização, nenhuma página clínica é indexada e o bloco de autoria exibe "sem revisão clínica até o momento".

### 4.2. O que o revisor verifica

- Fidelidade às diretrizes oficiais vigentes e data da versão usada.
- Sinais de alerta completos e sem omissão; instrução de busca de atendimento correta.
- Ausência de diagnóstico, prognóstico, probabilidade individual ou conduta medicamentosa.
- Linguagem não alarmista e não minimizadora.
- Terminologia: H1N1 vs influenza A vs gripe vs SRAG.
- Adequação do público (adultos, responsáveis, escolas).

### 4.3. O que bloqueia a publicação na revisão clínica

- Qualquer item da lista 1.2.
- Recomendação em desacordo com a norma do Ministério da Saúde vigente.
- Sinais de alerta incompletos ou reescritos de forma que altere o sentido oficial.
- Menção a dose, posologia, medicamento específico ou "o que tomar".
- Sugestão de que sintomas permitem identificar subtipo viral.
- Comparadores que atribuam probabilidade a uma doença com base em sintomas.
- Conteúdo com data de diretriz superada.

### 4.4. Registro

Cada revisão gera um registro com: página, versão (commit), revisor, data, itens corrigidos, parecer (aprovado / aprovado com alterações / reprovado). O registro é interno; a página exibe revisor e data.

---

## 5. Correções e changelog

- Página pública `/sobre/correcoes/` lista, em ordem cronológica inversa: data, página, o que foi alterado, motivo, quem solicitou (categoria: leitor, revisor, fonte atualizada, erro interno), gravidade.
- **Gravidade alta** (risco à saúde ou número errado): correção em até 24 h; a página recebe nota de correção visível no topo por 30 dias; se a correção não puder ser feita no prazo, a página volta a `noindex` ou o indicador é despublicado (mantendo a versão anterior datada).
- **Gravidade média** (imprecisão sem risco): correção em até 7 dias; nota no rodapé.
- **Gravidade baixa** (tipografia, link): correção na próxima publicação; registro no changelog.
- A data de revisão (`reviewed_at`) só muda quando houver revisão real; nunca é alterada para fins de SEO.
- Erros em dados: se a fonte original revisar valores, o pipeline publica nova snapshot e `/v1/diff` documenta a diferença; o boletim (quando existir) explica. Se o erro for nosso (bug no normalizador), registramos em correções com o id do indicador e o intervalo afetado.
- Canal para reportar erro: e-mail institucional (**a definir**) em `/contato/`; sem formulário no MVP.

---

## 6. Conflito de interesses

- Autores, revisores e responsáveis pelo projeto declaram por escrito vínculos com fabricantes de vacinas, medicamentos, testes diagnósticos, laboratórios, planos de saúde, hospitais e órgãos governamentais nos últimos 3 anos.
- Declarações são públicas em `/sobre/equipe-e-revisao/` (resumo) e arquivadas internamente.
- Revisor com vínculo direto com fabricante do produto tratado na página não revisa aquela página.
- Patrocinadores, quando existirem, não participam de pauta, redação, revisão ou decisão de publicação.
- O projeto não recebe amostras, produtos ou viagens de empresas do setor.
- Órgãos parceiros: **nenhum até o momento**; qualquer parceria futura será declarada com escopo e contrapartidas.

---

## 7. Publicidade e financiamento (plano, seção 13)

Estado atual: **sem anúncios, sem patrocínio, sem afiliados** no MVP. `/sobre/financiamento-e-publicidade/` declara isso e a fonte de financiamento (**a definir**: recursos próprios até segunda ordem).

Quando houver monetização, por etapas e só após validar valor e esta política:

| Modelo | Condição |
|---|---|
| Patrocínio institucional identificado | Rótulo "patrocinado" visível; independência editorial explícita; sem influência em conclusões; nunca em páginas de sinais de alerta |
| Licenciamento de gráficos e estudos | Respeita licenças e crédito dos dados originais; não privatiza dados públicos |
| API premium (SLA, suporte, volume) | A API pública básica continua gratuita; dados-fonte continuam públicos |
| Relatórios sob demanda | Metodologia e escopo públicos; cliente não altera resultado |
| Publicidade programática | Só após política de privacidade compatível; nunca sobre leitura ou alertas; sem categorias vetadas |
| Formação e materiais institucionais | Conteúdo revisado; preço e escopo públicos |

Vetado em qualquer cenário: anúncios de cura, suplementos, testes de eficácia duvidosa, vacinas, medicamentos, serviços de telemedicina com promessa diagnóstica, afiliados que criem conflito, e qualquer ação comercial que pareça aconselhamento médico. Anúncio nunca aparece em `/sintomas/sinais-de-alerta/`, no bloco de resposta principal nem dentro de gráficos do observatório.

---

## 8. Linguagem e segurança do público (plano 11.2)

- Aviso fixo em páginas clínicas: "Conteúdo educativo. Não substitui avaliação por profissional de saúde. Em caso de sinais de alerta, procure atendimento."
- Sem "teste de H1N1" por sintomas, sem calculadora de probabilidade, sem prescrição.
- Comunicar sazonalidade e aumentos sem pânico: usar o indicador nomeado, o período e a comparação com temporadas anteriores compatíveis; evitar "explosão", "surto perto de você", "alerta máximo".
- Terminologia fixa: "influenza A(H1N1)pdm09" na primeira ocorrência, depois "H1N1"; "gripe" só quando o texto explica que se refere a influenza; "SRAG" sempre expandido na primeira vez; "casos" só para o que a fonte chama de caso.
- Siglas, faixas etárias e semanas sempre com a convenção explícita.
