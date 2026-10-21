# H1N1 · Pesquisa de demanda: método e matriz de consultas candidatas

**Versão:** 1.0 · **Data:** 2026-10-20 · **Deriva de:** seção 4 do plano estratégico (4.1 fontes, 4.2 clusters, 4.3 priorização, 4.4 entregável).

> **Aviso obrigatório (plano, "Limite desta etapa" e 4.4):** as 150 consultas abaixo são **hipóteses de pauta**, não palavras-chave validadas. As colunas **Volume**, **Tendência**, **SERP features** e **Concorrentes** estão **vazias de propósito**: não houve levantamento quantitativo (Keyword Planner, Trends, SERPs manuais) nem auditoria de concorrentes. Preenchê-las é o entregável do Sprint 1 (BACKLOG_SPRINTS.md) e **pré-condição para qualquer promessa de tráfego**. Nenhum número de volume deve ser inventado para ocupar as células.

---

## 1. Método (plano 4.1)

| Fonte | O que dá | O que não dá | Status |
|---|---|---|---|
| Google Trends | Sazonalidade, interesse relativo por UF, termos relacionados, consultas emergentes | Volume absoluto | A executar (humano) |
| Google Keyword Planner | Estimativas de demanda e variações | Precisão sem conta ativa e configuração | A executar; depende de acesso (**a definir**) |
| Search Console | Impressões, consultas, CTR reais do próprio site | Nada antes do lançamento | Após publicação |
| SERPs manuais (mobile e desktop) | Intenção real, elementos (vídeo, PAA, notícias), quem ranqueia (governo, hospitais) | Volume | A executar para as 30 intenções prioritárias |
| Google Trends API (alfa) | Séries programáticas | Acesso garantido (não assumir) | Avaliar candidatura |
| Fontes próprias agregadas | Páginas mais acessadas, dúvidas recorrentes | Nada no MVP (sem analytics; busca interna sem identificação) | Após lançamento, via logs agregados e Search Console |

Regras: publicar **por intenção**, não uma URL por sinônimo; o interesse de busca **não** é vigilância epidemiológica (regra 8); o cluster "Fora de escopo/animais" existe para documentar o que **não** será coberto, evitando páginas sem valor.

### 1.1. Como preencher a matriz (Sprint 1)

1. Para cada consulta, registrar volume médio mensal (fonte e data), tendência 12/24/60 meses (Trends, interesse relativo), SERP features presentes (featured snippet, PAA, vídeo, notícias, painel de conhecimento, AI Overview), e três concorrentes com domínio e tipo (governo, hospital, imprensa, Fiocruz, OMS).
2. Agrupar por intenção; a intenção herda a soma de volumes, a tendência dominante e o conjunto de features.
3. Pontuar cada intenção com o template da seção 3.
4. Analisar manualmente as 30 intenções com maior score em mobile e desktop.
5. Decidir formato e página-alvo definitivos; atualizar PRD e backlog.

---

## 2. Matriz de 150 consultas em 24 clusters

Colunas: **#**, **Consulta**, **Cluster**, **Intenção**, **Página-alvo**, **Risco clínico** (baixo/médio/alto), **Formato**, **Prioridade** (P0/P1/P2), **Volume**, **Tendência**, **SERP features**, **Concorrentes**. As quatro últimas ficam vazias (—) por serem hipóteses sem validação quantitativa.

Legenda de formato: Referência (página de conceito); Guia revisado (clínico, `noindex` até revisão); Citação oficial (sinais de alerta); Comparador; Observatório; Linha do tempo; Material; Nota (parágrafo dentro de outra página, sem URL própria); Redirecionamento (consulta atendida por outra página com aviso).

| # | Consulta | Cluster | Intenção | Página-alvo | Risco | Formato | Prior. | Volume | Tend. | SERP | Concorr. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | o que é h1n1 | Definição | Compreender | /o-que-e-h1n1/ | baixo | Referência | P0 | — | — | — | — |
| 2 | h1n1 é gripe | Definição | Compreender | /o-que-e-h1n1/ | baixo | Referência | P0 | — | — | — | — |
| 3 | influenza a é h1n1 | Definição | Compreender | /o-que-e-h1n1/ | baixo | Referência | P0 | — | — | — | — |
| 4 | h1n1 significado | Definição | Compreender | /o-que-e-h1n1/ | baixo | Referência | P0 | — | — | — | — |
| 5 | h1n1pdm09 o que é | Definição | Compreender | /o-que-e-h1n1/ | baixo | Referência | P1 | — | — | — | — |
| 6 | diferença entre influenza a e b | Definição | Compreender | /o-que-e-h1n1/ | baixo | Referência | P1 | — | — | — | — |
| 7 | sintomas h1n1 | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P0 | — | — | — | — |
| 8 | sintomas da gripe h1n1 | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P0 | — | — | — | — |
| 9 | sintomas influenza a | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P0 | — | — | — | — |
| 10 | h1n1 sintomas primeiros dias | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P0 | — | — | — | — |
| 11 | h1n1 dá diarreia | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P1 | — | — | — | — |
| 12 | h1n1 sem febre | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P1 | — | — | — | — |
| 13 | tosse seca h1n1 | Sintomas adultos | Identificar informação | /sintomas/ | médio | Guia revisado | P1 | — | — | — | — |
| 14 | h1n1 em crianças sintomas | Sintomas crianças | Identificar informação | /sintomas/criancas/ | alto | Guia revisado | P0 | — | — | — | — |
| 15 | sintomas de h1n1 em bebê | Sintomas crianças | Identificar informação | /sintomas/criancas/ | alto | Guia revisado | P0 | — | — | — | — |
| 16 | gripe em criança quando procurar médico | Sintomas crianças | Decidir sobre atendimento | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 17 | h1n1 criança febre alta | Sintomas crianças | Identificar informação | /sintomas/criancas/ | alto | Guia revisado | P0 | — | — | — | — |
| 18 | h1n1 em adolescente | Sintomas crianças | Identificar informação | /sintomas/criancas/ | médio | Nota | P2 | — | — | — | — |
| 19 | gripe forte em criança o que fazer | Sintomas crianças | Decidir sobre atendimento | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 20 | sinais de alerta gripe | Sinais de alerta | Avaliar quando procurar ajuda | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 21 | quando procurar atendimento h1n1 | Sinais de alerta | Avaliar quando procurar ajuda | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 22 | falta de ar gripe é grave | Sinais de alerta | Avaliar quando procurar ajuda | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 23 | h1n1 quando ir ao hospital | Sinais de alerta | Avaliar quando procurar ajuda | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 24 | srag o que é | Sinais de alerta | Compreender | /sintomas/sinais-de-alerta/ | médio | Citação oficial | P0 | — | — | — | — |
| 25 | síndrome respiratória aguda grave sintomas | Sinais de alerta | Avaliar quando procurar ajuda | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P0 | — | — | — | — |
| 26 | gripe piorou depois de melhorar | Sinais de alerta | Avaliar quando procurar ajuda | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P1 | — | — | — | — |
| 27 | h1n1 é perigosa | Gravidade e risco | Avaliar risco | /o-que-e-h1n1/ | médio | Referência | P0 | — | — | — | — |
| 28 | h1n1 mata | Gravidade e risco | Avaliar risco | /o-que-e-h1n1/ | alto | Referência | P0 | — | — | — | — |
| 29 | h1n1 grupo de risco | Gravidade e risco | Avaliar risco | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 30 | h1n1 idosos | Gravidade e risco | Avaliar risco | /vacina/ | médio | Guia revisado | P1 | — | — | — | — |
| 31 | h1n1 pode causar pneumonia | Gravidade e risco | Compreender | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P1 | — | — | — | — |
| 32 | taxa de mortalidade h1n1 | Gravidade e risco | Monitorar/contextualizar | /dados/metodologia/ | alto | Referência | P1 | — | — | — | — |
| 33 | como se pega h1n1 | Transmissão | Decidir sobre prevenção | /transmissao/ | baixo | Referência | P0 | — | — | — | — |
| 34 | h1n1 transmissão | Transmissão | Decidir sobre prevenção | /transmissao/ | baixo | Referência | P0 | — | — | — | — |
| 35 | h1n1 transmite por quantos dias | Transmissão | Decidir sobre prevenção | /transmissao/ | médio | Referência | P0 | — | — | — | — |
| 36 | h1n1 é contagioso | Transmissão | Compreender | /transmissao/ | baixo | Referência | P0 | — | — | — | — |
| 37 | h1n1 pega pelo ar | Transmissão | Compreender | /transmissao/ | baixo | Referência | P1 | — | — | — | — |
| 38 | quanto tempo o vírus h1n1 sobrevive em superfícies | Transmissão | Compreender | /transmissao/ | baixo | Referência | P1 | — | — | — | — |
| 39 | h1n1 passa de pessoa para pessoa | Transmissão | Compreender | /transmissao/ | baixo | Referência | P1 | — | — | — | — |
| 40 | incubação h1n1 | Incubação | Compreender | /transmissao/ | baixo | Referência | P0 | — | — | — | — |
| 41 | período de incubação gripe | Incubação | Compreender | /transmissao/ | baixo | Referência | P0 | — | — | — | — |
| 42 | quantos dias para aparecer sintomas de h1n1 | Incubação | Compreender | /transmissao/ | baixo | Referência | P0 | — | — | — | — |
| 43 | tive contato com h1n1 e agora | Incubação | Decidir sobre prevenção | /transmissao/ | médio | Referência | P1 | — | — | — | — |
| 44 | h1n1 contágio antes dos sintomas | Incubação | Compreender | /transmissao/ | baixo | Referência | P1 | — | — | — | — |
| 45 | quarentena h1n1 quantos dias | Incubação | Decidir sobre prevenção | /transmissao/ | médio | Referência | P1 | — | — | — | — |
| 46 | quanto tempo dura h1n1 | Duração e recuperação | Entender evolução | /sintomas/ | médio | Guia revisado | P0 | — | — | — | — |
| 47 | quantos dias dura a gripe | Duração e recuperação | Entender evolução | /sintomas/ | médio | Guia revisado | P0 | — | — | — | — |
| 48 | tosse depois da gripe | Duração e recuperação | Entender evolução | /sintomas/ | médio | Guia revisado | P1 | — | — | — | — |
| 49 | h1n1 recuperação | Duração e recuperação | Entender evolução | /sintomas/ | médio | Guia revisado | P1 | — | — | — | — |
| 50 | cansaço depois da gripe quanto tempo | Duração e recuperação | Entender evolução | /sintomas/ | médio | Guia revisado | P2 | — | — | — | — |
| 51 | h1n1 pode voltar | Duração e recuperação | Compreender | /sintomas/ | médio | Nota | P2 | — | — | — | — |
| 52 | gripe x h1n1 | Comparação gripe/resfriado | Comparar | /comparar/h1n1-vs-gripe-comum/ | médio | Comparador | P0 | — | — | — | — |
| 53 | diferença entre gripe e h1n1 | Comparação gripe/resfriado | Comparar | /comparar/h1n1-vs-gripe-comum/ | médio | Comparador | P0 | — | — | — | — |
| 54 | diferença entre resfriado e gripe | Comparação gripe/resfriado | Comparar | /comparar/h1n1-vs-gripe-comum/ | médio | Comparador | P0 | — | — | — | — |
| 55 | h1n1 x h3n2 | Comparação gripe/resfriado | Comparar | /comparar/h1n1-vs-gripe-comum/ | baixo | Comparador | P1 | — | — | — | — |
| 56 | gripe comum vs influenza | Comparação gripe/resfriado | Comparar | /comparar/h1n1-vs-gripe-comum/ | médio | Comparador | P1 | — | — | — | — |
| 57 | como saber se é h1n1 ou gripe normal | Comparação gripe/resfriado | Comparar | /comparar/h1n1-vs-gripe-comum/ | alto | Comparador | P0 | — | — | — | — |
| 58 | h1n1 x covid | Comparação covid | Comparar | /comparar/h1n1-vs-covid/ | médio | Comparador | P0 | — | — | — | — |
| 59 | diferença entre h1n1 e covid | Comparação covid | Comparar | /comparar/h1n1-vs-covid/ | médio | Comparador | P0 | — | — | — | — |
| 60 | sintomas covid ou gripe | Comparação covid | Comparar | /comparar/h1n1-vs-covid/ | alto | Comparador | P0 | — | — | — | — |
| 61 | h1n1 é pior que covid | Comparação covid | Avaliar risco | /comparar/h1n1-vs-covid/ | médio | Comparador | P1 | — | — | — | — |
| 62 | pode ter covid e h1n1 ao mesmo tempo | Comparação covid | Compreender | /comparar/h1n1-vs-covid/ | médio | Nota | P2 | — | — | — | — |
| 63 | teste covid negativo pode ser h1n1 | Comparação covid | Comparar | /comparar/h1n1-vs-covid/ | alto | Comparador | P1 | — | — | — | — |
| 64 | como evitar h1n1 | Prevenção | Agir preventivamente | /prevencao/ | médio | Guia revisado | P0 | — | — | — | — |
| 65 | prevenção h1n1 | Prevenção | Agir preventivamente | /prevencao/ | médio | Guia revisado | P0 | — | — | — | — |
| 66 | máscara protege contra h1n1 | Prevenção | Agir preventivamente | /prevencao/ | médio | Guia revisado | P1 | — | — | — | — |
| 67 | álcool gel mata h1n1 | Prevenção | Agir preventivamente | /prevencao/ | baixo | Guia revisado | P1 | — | — | — | — |
| 68 | como não pegar gripe de quem está em casa | Prevenção | Agir preventivamente | /prevencao/ | médio | Guia revisado | P1 | — | — | — | — |
| 69 | cuidados com h1n1 | Prevenção | Agir preventivamente | /prevencao/ | médio | Guia revisado | P0 | — | — | — | — |
| 70 | h1n1 cuidados em casa | Prevenção | Agir preventivamente | /prevencao/ | alto | Guia revisado | P1 | — | — | — | — |
| 71 | vacina da gripe protege h1n1 | Vacina | Entender diretrizes | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 72 | vacina h1n1 | Vacina | Entender diretrizes | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 73 | vacina influenza h1n1 | Vacina | Entender diretrizes | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 74 | vacina da gripe 2026 | Vacina | Entender diretrizes | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 75 | vacina trivalente ou quadrivalente gripe | Vacina | Entender diretrizes | /vacina/ | médio | Guia revisado | P1 | — | — | — | — |
| 76 | vacina da gripe dá gripe | Vacina | Compreender | /vacina/ | médio | Guia revisado | P1 | — | — | — | — |
| 77 | quanto tempo a vacina da gripe leva para fazer efeito | Vacina | Compreender | /vacina/ | médio | Guia revisado | P1 | — | — | — | — |
| 78 | onde tomar vacina da gripe | Vacinação prática | Agir | /vacina/ | baixo | Guia revisado | P0 | — | — | — | — |
| 79 | vacina da gripe sus quem pode tomar | Vacinação prática | Entender diretrizes | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 80 | campanha vacinação gripe 2026 | Vacinação prática | Agir | /vacina/ | baixo | Guia revisado | P0 | — | — | — | — |
| 81 | vacina da gripe grupos prioritários | Vacinação prática | Entender diretrizes | /vacina/ | médio | Guia revisado | P0 | — | — | — | — |
| 82 | vacina da gripe gestante pode tomar | Vacinação prática | Entender diretrizes | /vacina/ | alto | Guia revisado | P1 | — | — | — | — |
| 83 | vacina da gripe particular preço | Vacinação prática | Agir | /vacina/ | baixo | Nota | P2 | — | — | — | — |
| 84 | tratamento h1n1 | Tratamento | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento → /sintomas/sinais-de-alerta/ | P1 | — | — | — | — |
| 85 | remédio para h1n1 | Tratamento | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento → /sintomas/sinais-de-alerta/ | P1 | — | — | — | — |
| 86 | oseltamivir h1n1 | Tratamento | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento → /sintomas/sinais-de-alerta/ | P1 | — | — | — | — |
| 87 | tamiflu como funciona | Tratamento | Compreender | /tratamento/ (adiado) | alto | Redirecionamento | P2 | — | — | — | — |
| 88 | h1n1 tem cura | Tratamento | Compreender | /o-que-e-h1n1/ | médio | Nota | P1 | — | — | — | — |
| 89 | antibiótico para gripe h1n1 | Tratamento | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento | P2 | — | — | — | — |
| 90 | teste h1n1 | Diagnóstico e teste | Compreender | /o-que-e-h1n1/ | alto | Nota | P0 | — | — | — | — |
| 91 | como saber se estou com h1n1 | Diagnóstico e teste | Identificar informação | /comparar/h1n1-vs-gripe-comum/ | alto | Comparador | P0 | — | — | — | — |
| 92 | exame para detectar h1n1 | Diagnóstico e teste | Compreender | /o-que-e-h1n1/ | médio | Nota | P1 | — | — | — | — |
| 93 | teste rápido influenza | Diagnóstico e teste | Compreender | /o-que-e-h1n1/ | médio | Nota | P1 | — | — | — | — |
| 94 | pcr influenza a h1n1 | Diagnóstico e teste | Compreender | /dados/metodologia/ | baixo | Referência | P2 | — | — | — | — |
| 95 | influenza a não subtipada o que significa | Diagnóstico e teste | Compreender | /dados/metodologia/ | baixo | Referência | P2 | — | — | — | — |
| 96 | h1n1 no brasil | Dados Brasil | Monitorar | /dados/brasil/ | médio | Observatório | P1 | — | — | — | — |
| 97 | casos h1n1 2026 | Dados Brasil | Monitorar | /dados/brasil/ | médio | Observatório | P1 | — | — | — | — |
| 98 | h1n1 no meu estado | Dados Brasil | Monitorar | /dados/brasil/ | médio | Observatório | P1 | — | — | — | — |
| 99 | casos de h1n1 em são paulo | Dados Brasil | Monitorar | /dados/brasil/ (filtro UF) | médio | Observatório | P1 | — | — | — | — |
| 100 | surto de h1n1 2026 | Dados Brasil | Monitorar | /dados/brasil/ | alto | Observatório | P1 | — | — | — | — |
| 101 | mortes por h1n1 no brasil 2026 | Dados Brasil | Monitorar | /dados/brasil/ | alto | Observatório (rótulo "óbitos entre SRAG com H1N1 confirmado") | P1 | — | — | — | — |
| 102 | boletim influenza ministério da saúde | Dados Brasil | Monitorar | /dados/fontes/ | baixo | Catálogo | P1 | — | — | — | — |
| 103 | h1n1 no mundo | Dados mundo | Monitorar | /dados/mundo/ (P1) | médio | Observatório | P1 | — | — | — | — |
| 104 | casos de h1n1 no mundo 2026 | Dados mundo | Monitorar | /dados/mundo/ (P1) | médio | Observatório | P1 | — | — | — | — |
| 105 | flunet oms | Dados mundo | Monitorar | /dados/fontes/who_flunet/ | baixo | Catálogo | P2 | — | — | — | — |
| 106 | h1n1 estados unidos 2026 | Dados mundo | Monitorar | /dados/mundo/ (P1) | médio | Observatório | P2 | — | — | — | — |
| 107 | gripe na europa 2026 | Dados mundo | Monitorar | /dados/mundo/ (P1) | médio | Observatório | P2 | — | — | — | — |
| 108 | h1n1 argentina | Dados mundo | Monitorar | /dados/mundo/ (P1) | médio | Observatório | P2 | — | — | — | — |
| 109 | h1n1 2009 | Histórico | Contextualizar | /historia/ | baixo | Linha do tempo | P1 | — | — | — | — |
| 110 | pandemia de h1n1 | Histórico | Contextualizar | /historia/ | baixo | Linha do tempo | P1 | — | — | — | — |
| 111 | quantas pessoas morreram de h1n1 em 2009 | Histórico | Contextualizar | /historia/ | alto | Linha do tempo (fato verificado de `facts`) | P1 | — | — | — | — |
| 112 | gripe suína 2009 brasil | Histórico | Contextualizar | /historia/ | baixo | Linha do tempo | P1 | — | — | — | — |
| 113 | gripe espanhola é h1n1 | Histórico | Compreender | /historia/ | baixo | Linha do tempo | P2 | — | — | — | — |
| 114 | h1n1 origem | Histórico | Compreender | /historia/ | baixo | Linha do tempo | P2 | — | — | — | — |
| 115 | h1n1 na escola | Escola e trabalho | Compartilhar | /materiais/escolas/ | médio | Material | P1 | — | — | — | — |
| 116 | criança com gripe pode ir para escola | Escola e trabalho | Decidir | /materiais/escolas/ | médio | Material | P1 | — | — | — | — |
| 117 | orientações h1n1 trabalho | Escola e trabalho | Compartilhar | /materiais/empresas/ | médio | Material | P1 | — | — | — | — |
| 118 | comunicado para pais sobre gripe | Escola e trabalho | Compartilhar | /materiais/escolas/ | médio | Material | P1 | — | — | — | — |
| 119 | cartaz prevenção gripe | Escola e trabalho | Compartilhar | /materiais/escolas/ | baixo | Material | P1 | — | — | — | — |
| 120 | atestado gripe quantos dias | Escola e trabalho | Decidir | /materiais/empresas/ | médio | Nota | P2 | — | — | — | — |
| 121 | h1n1 mutação | Ciência e variantes | Aprofundar | /historia/ | baixo | Linha do tempo | P2 | — | — | — | — |
| 122 | variantes influenza | Ciência e variantes | Aprofundar | /historia/ | baixo | Linha do tempo | P2 | — | — | — | — |
| 123 | h1n1pdm09 clado | Ciência e variantes | Aprofundar | /pesquisas/ (P1) | baixo | Pesquisa | P2 | — | — | — | — |
| 124 | h1n1 resistência oseltamivir | Ciência e variantes | Aprofundar | /pesquisas/ (P1) | alto | Pesquisa | P2 | — | — | — | — |
| 125 | composição vacina influenza 2026 oms | Ciência e variantes | Aprofundar | /vacina/ | médio | Guia revisado | P2 | — | — | — | — |
| 126 | genoma h1n1 | Ciência e variantes | Aprofundar | /pesquisas/ (P1) | baixo | Pesquisa | P2 | — | — | — | — |
| 127 | h1n1 na gravidez | Gestação e populações especiais | Avaliar risco | /vacina/ | alto | Guia revisado | P1 | — | — | — | — |
| 128 | gestante com gripe o que fazer | Gestação e populações especiais | Decidir sobre atendimento | /sintomas/sinais-de-alerta/ | alto | Citação oficial | P1 | — | — | — | — |
| 129 | h1n1 e amamentação | Gestação e populações especiais | Compreender | /vacina/ | alto | Guia revisado | P2 | — | — | — | — |
| 130 | h1n1 asma | Gestação e populações especiais | Avaliar risco | /vacina/ | alto | Guia revisado | P2 | — | — | — | — |
| 131 | h1n1 diabetes risco | Gestação e populações especiais | Avaliar risco | /vacina/ | alto | Guia revisado | P2 | — | — | — | — |
| 132 | h1n1 imunossuprimido | Gestação e populações especiais | Avaliar risco | /vacina/ | alto | Guia revisado | P2 | — | — | — | — |
| 133 | época de gripe no brasil | Sazonalidade | Compreender | /dados/brasil/ | baixo | Observatório | P1 | — | — | — | — |
| 134 | temporada de gripe 2026 | Sazonalidade | Monitorar | /dados/brasil/ | médio | Observatório | P1 | — | — | — | — |
| 135 | h1n1 inverno | Sazonalidade | Compreender | /dados/brasil/ | baixo | Observatório | P1 | — | — | — | — |
| 136 | pico de gripe mês | Sazonalidade | Compreender | /dados/brasil/ | baixo | Observatório | P1 | — | — | — | — |
| 137 | gripe no verão é possível | Sazonalidade | Compreender | /transmissao/ | baixo | Nota | P2 | — | — | — | — |
| 138 | quando começa a campanha da gripe | Sazonalidade | Agir | /vacina/ | baixo | Guia revisado | P1 | — | — | — | — |
| 139 | o que tomar para h1n1 | Medicamentos e automedicação | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento → /sintomas/sinais-de-alerta/ | P1 | — | — | — | — |
| 140 | remédio caseiro para gripe h1n1 | Medicamentos e automedicação | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento | P2 | — | — | — | — |
| 141 | pode tomar dipirona na gripe | Medicamentos e automedicação | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento | P2 | — | — | — | — |
| 142 | anti-inflamatório gripe pode | Medicamentos e automedicação | Entender diretrizes | /tratamento/ (adiado) | alto | Redirecionamento | P2 | — | — | — | — |
| 143 | vitamina c previne gripe | Medicamentos e automedicação | Compreender | /prevencao/ | médio | Nota | P2 | — | — | — | — |
| 144 | chá para gripe funciona | Medicamentos e automedicação | Compreender | /prevencao/ | médio | Nota | P2 | — | — | — | — |
| 145 | gripe suína em porcos | Fora de escopo/animais | Compreender | /o-que-e-h1n1/ (nota) | baixo | Nota | P2 | — | — | — | — |
| 146 | pode pegar h1n1 comendo carne de porco | Fora de escopo/animais | Compreender | /o-que-e-h1n1/ (nota) | baixo | Nota | P2 | — | — | — | — |
| 147 | h1n1 em cachorro | Fora de escopo/animais | Compreender | sem página | baixo | — | — | — | — | — | — |
| 148 | gripe aviária h5n1 | Fora de escopo/animais | Compreender | sem página (fora do escopo H1N1) | baixo | — | — | — | — | — | — |
| 149 | h1n1 em gato | Fora de escopo/animais | Compreender | sem página | baixo | — | — | — | — | — | — |
| 150 | h1n1v variante suína humana | Fora de escopo/animais | Aprofundar | /historia/ (nota) | baixo | Nota | P2 | — | — | — | — |

### 2.1. Contagem por cluster

| Cluster | Consultas | Página-alvo principal | Prioridade dominante |
|---|---|---|---|
| Definição | 6 | /o-que-e-h1n1/ | P0 |
| Sintomas adultos | 7 | /sintomas/ | P0 |
| Sintomas crianças | 6 | /sintomas/criancas/ | P0 |
| Sinais de alerta | 7 | /sintomas/sinais-de-alerta/ | P0 |
| Gravidade e risco | 6 | /o-que-e-h1n1/, /vacina/ | P0–P1 |
| Transmissão | 7 | /transmissao/ | P0 |
| Incubação | 6 | /transmissao/ | P0 |
| Duração e recuperação | 6 | /sintomas/ | P0–P1 |
| Comparação gripe/resfriado | 6 | /comparar/h1n1-vs-gripe-comum/ | P0 |
| Comparação covid | 6 | /comparar/h1n1-vs-covid/ | P0 |
| Prevenção | 7 | /prevencao/ | P0 |
| Vacina | 7 | /vacina/ | P0 |
| Vacinação prática | 6 | /vacina/ | P0 |
| Tratamento | 6 | /tratamento/ (adiado) | P1 (redirecionado) |
| Diagnóstico e teste | 6 | /o-que-e-h1n1/, /comparar/ | P0–P1 |
| Dados Brasil | 7 | /dados/brasil/ | P1 |
| Dados mundo | 6 | /dados/mundo/ (P1) | P1–P2 |
| Histórico | 6 | /historia/ | P1 |
| Escola e trabalho | 6 | /materiais/* | P1 |
| Ciência e variantes | 6 | /historia/, /pesquisas/ | P2 |
| Gestação e populações especiais | 6 | /vacina/, sinais de alerta | P1–P2 |
| Sazonalidade | 6 | /dados/brasil/ | P1 |
| Medicamentos e automedicação | 6 | /tratamento/ (adiado) | P1–P2 (redirecionado) |
| Fora de escopo/animais | 6 | sem página / nota | — |
| **Total** | **150** | | |

Observações de cobertura:

- Nenhuma consulta recebe URL própria por sinônimo: "sintomas h1n1", "sintomas da gripe h1n1" e "sintomas influenza a" vão para a mesma `/sintomas/`.
- Os clusters Tratamento e Medicamentos (12 consultas, risco alto) **não** terão página no MVP. A estratégia é atender a intenção de segurança (quando procurar atendimento) com `/sintomas/sinais-de-alerta/` e declarar explicitamente que o site não orienta medicação. Perde-se demanda, por decisão.
- "mortes por h1n1" (consulta 101) é atendida com o rótulo correto "óbitos entre SRAG com H1N1 confirmado"; o título da página nunca usa a expressão da busca.
- Consultas de dados por cidade (variações de 99) são atendidas no nível UF; não haverá páginas municipais.

---

## 3. Score de priorização (plano 4.3)

Cada **intenção** (não cada consulta) recebe nota de 1 a 5 em seis critérios; o score é a soma ponderada.

| Critério | Peso | Como pontuar (1 → 5) |
|---|---|---|
| D · Demanda verificada | 25% | 1 = sem dado; 3 = volume moderado comprovado por Keyword Planner/Trends; 5 = alto volume e tendência estável/crescente |
| S · Potencial de atender a intenção melhor que a SERP atual | 25% | 1 = SERP dominada por governo/hospitais com resposta boa; 5 = SERP com respostas longas, desatualizadas ou sem fonte |
| R · Relevância para o público principal | 20% | 1 = só especialistas; 5 = adultos/famílias/responsáveis |
| P · Diferencial proprietário (dados ou ferramenta) | 15% | 1 = texto puro; 5 = dado próprio do observatório ou ferramenta |
| F · Facilidade de produzir e atualizar corretamente | 10% | 1 = exige revisão clínica complexa e atualização frequente; 5 = perene e verificável |
| X · Probabilidade de distribuição externa e referências | 5% | 1 = nenhuma; 5 = pauta de imprensa ou material compartilhável |

**Score = 0,25·D + 0,25·S + 0,20·R + 0,15·P + 0,10·F + 0,05·X** (faixa 1,00–5,00).

Pesos são hipótese de gestão e devem ser recalibrados com dados reais após 60–90 dias de Search Console.

**Veto editorial:** nenhum score justifica publicar conteúdo clínico não revisado ou estatística com denominador inadequado. Intenções de risco clínico alto só avançam com revisor definido, independentemente do score.

### 3.1. Template de pontuação

| Intenção | Consultas (#) | Página-alvo | Risco | D | S | R | P | F | X | Score | Veto? | Decisão |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ex.: Sinais de alerta | 20–26 | /sintomas/sinais-de-alerta/ | alto | — | — | — | — | — | — | — | não (citação literal) | — |
| ex.: Dados Brasil | 96–102 | /dados/brasil/ | médio | — | — | — | — | — | — | — | não | — |
| ex.: Tratamento | 84–89 | /tratamento/ | alto | — | — | — | — | — | — | — | **sim** (sem revisor) | adiado |
| ... | | | | | | | | | | | | |

Preenchimento: uma linha por intenção (24–30 linhas), notas inteiras de 1 a 5, score com duas casas decimais, campo "Veto?" preenchido antes do score, "Decisão" ∈ {publicar P0, publicar P1, adiar, descartar}. As células de nota ficam vazias até existir o levantamento quantitativo.

---

## 4. Análise manual de SERP (a executar)

Para as 30 intenções com maior score (ou, antes do score, para todas as P0), registrar em mobile e desktop, em janela anônima, com localização Brasil:

- Quem ocupa as 5 primeiras posições (tipo: governo, hospital, Fiocruz, imprensa, enciclopédia, outro).
- Features: featured snippet (e sua fonte), "As pessoas também perguntam", vídeos, notícias/Top stories, painel de conhecimento, AI Overview, resultados de saúde com selo.
- Data visível de atualização dos resultados.
- O que a resposta atual não entrega (sem fonte, sem data, sem universo do dado, sem distinção H1N1 vs influenza).
- Formato que venceria (resposta curta + fonte; comparador; gráfico com data).

Saída: coluna "SERP features" e "Concorrentes" preenchidas; nota S justificada por intenção.
