# H1N1 · LGPD e privacidade

**Versão:** 1.0 · **Data:** 2026-10-20 · **Base legal de referência:** Lei nº 13.709/2018 (LGPD). Deriva das seções 10.4 (regra 9) e 11.3 do plano estratégico. Este documento orienta a implementação e é a base da página pública de privacidade (`/sobre/` ou `/privacidade/`, rota **a definir**).

**Encarregado (DPO): a definir.** Até a designação, pedidos de titulares são recebidos pelo e-mail institucional (**a definir**) e respondidos pelo responsável pelo projeto.

---

## 1. Princípio: minimização

O H1N1 é um site público de leitura. A posição padrão é **não coletar dados pessoais de visitantes**. Qualquer coleta futura precisa de: finalidade específica, base legal identificada, registro neste documento, texto público e revisão do DPO.

| O que | MVP | Observação |
|---|---|---|
| Cadastro, login, conta | Não existe | — |
| Formulário de contato | Não existe | E-mail institucional publicado em `/contato/` |
| Newsletter | Não existe | Ver seção 4 |
| Analytics (GA, Plausible, Matomo etc.) | **Não** | Ver seção 2 |
| Cookies | Nenhum cookie próprio; nenhum de terceiros | Sem banner de consentimento porque não há o que consentir |
| Pixels, fontes externas, CDN de terceiros com rastreamento | Não | Fontes e scripts servidos do próprio domínio |
| Busca interna | Pode existir | Consulta não é associada a IP nem persistida com identificador |
| Sintomas, idade, localização, condição de saúde do visitante | **Nunca solicitados** | Regra 7 da integridade e plano 11.2 |
| Geolocalização | Não | Filtros de UF são escolha explícita do usuário na URL, não inferência |

---

## 2. Sem analytics no MVP

Decisão: o MVP **não** instala ferramenta de analytics nem cookies. Medição de uso vem de:

- **Google Search Console**: impressões, cliques, CTR, posição — dados agregados do Google, sem identificação de visitantes pelo site.
- **Logs de servidor** (web e API): agregados por rota, status e dia. Retenção de logs brutos: máximo 30 dias; IP truncado (último octeto IPv4 / últimos 80 bits IPv6 zerados) no momento da gravação; `User-Agent` mantido apenas para detectar bots; sem `Referer` completo além do domínio de origem.
- **Métricas de operação** (`/v1/freshness`, `ingestion_runs`): não envolvem visitantes.

Se, após o MVP, for adotada medição de produto (sessões engajadas, uso de filtros), a escolha deve priorizar solução sem cookies e sem identificador persistente, hospedada no próprio domínio, com dados agregados e política pública atualizada. Qualquer solução que exija consentimento só entra com banner real e opção de recusa equivalente à de aceite. Histórico de saúde jamais é enviado a analytics (plano 11.3): como o site não coleta saúde, a página visitada (ex.: `/sintomas/criancas/`) é o único dado sensível por inferência e, por isso, **não** será associada a identificador individual em nenhuma ferramenta futura.

---

## 3. Rate limit e segurança da API

- O contador de rate limit por IP vive em memória do processo (ou cache volátil) e não é persistido nem associado a conteúdo de consulta.
- Logs da API seguem a mesma regra de IP truncado e 30 dias.
- Não há chaves de API no MVP; se houver, o cadastro coletará apenas e-mail e finalidade, com base legal de execução de contrato/procedimento preliminar.

---

## 4. Formulário e newsletter futuros

Quando (e se) existirem:

| Item | Regra |
|---|---|
| Dados coletados | Apenas e-mail (newsletter) ou e-mail + mensagem (contato). Nenhum campo de saúde, idade, localização |
| Base legal | Consentimento (art. 7º, I) para newsletter; legítimo interesse ou procedimento preliminar para responder contato |
| Consentimento | Opt-in explícito, não pré-marcado, com finalidade descrita; double opt-in para newsletter |
| Retenção | Newsletter: até descadastro; contato: 12 meses após a última interação, depois eliminação |
| Direitos | Descadastro em um clique em todo e-mail; acesso, correção e eliminação pelo canal do DPO |
| Compartilhamento | Provedor de envio de e-mail como operador, com contrato e sem uso secundário; nunca provedores de IA |
| Conteúdo | Nunca "surto perto de você"; nunca segmentação por página de saúde visitada |

---

## 5. Tratamento de microdados de fontes públicas

O único dado pessoal que o projeto processa no MVP é **indireto**: microdados anonimizados publicados pelo Ministério da Saúde (SIVEP-Gripe, BR-03) e, no futuro, SIM, PNI, SINAN e México (MX-01). Esses arquivos são publicados pelos órgãos sob CC-BY/termos abertos e já sem identificadores diretos; ainda assim o projeto adota controles adicionais porque contêm dados de saúde em nível individual.

### 5.1. Controles no pipeline

| Controle | Implementação |
|---|---|
| Fonte anonimizada pelo órgão | Só ingerir arquivos públicos oficiais; nunca solicitar ou aceitar bases identificadas (GAL, RNDS, e-SUS, prontuários) |
| Agregação em streaming | O conector lê o CSV linha a linha e acumula contadores por `indicator × geo × período × estrato`; **nenhuma linha individual é gravada no banco** (`observations` só contém agregados) |
| Snapshot bruto | O arquivo original é guardado em `data/snapshots/` (gitignored, acesso restrito, hash sha256) apenas para reprodutibilidade e auditoria; não é servido pela API nem pelo site |
| Campos lidos | Apenas os necessários à ontologia: `SG_UF`, `SEM_PRI`, `CLASSI_FIN`, `TP_FLU_PCR`, `PCR_FLUASU`, `EVOLUCAO`, `UTI`, idade. Nome, CPF, CNS, endereço, município de residência, datas exatas, unidade de saúde: **não lidos, não persistidos** |
| Granularidade geográfica | Máximo UF (`BR-<UF>`); **nunca município** |
| Granularidade temporal | Semana epidemiológica; nunca data exata |
| Estratos | Faixas etárias largas (0-4, 5-14, 15-29, 30-49, 50-64, 65+, NA); sem sexo, raça/cor, gestação ou comorbidade no MVP |
| Supressão | Células com valor < 5 suprimidas em qualquer recorte subnacional ou estratificado; supressão complementar; totais nacionais sem estrato não suprimidos (ADR-005) |
| Cruzamento vetado | **Nunca município × idade × data**, nem UF × idade × data exata, nem qualquer combinação que reduza uma célula a poucos indivíduos |
| Acesso ao bruto | Operadores do pipeline; registrado em `ingestion_runs`; snapshots antigos podem ser eliminados conforme seção 6 |

### 5.2. Por que isso basta (e o que não fazemos)

- A publicação é de **estatística agregada** com supressão; não há identificação direta e o risco de reidentificação é mitigado por granularidade e supressão.
- Não republicamos microdados. Quem quiser microdados vai ao portal oficial (link no catálogo).
- Não fazemos linkage entre bases (ex.: SIVEP × SIM) em nível individual.
- Não fazemos análise de "caso notável" (ex.: óbito único em UF pequena numa semana): a supressão impede exibir e a política editorial impede comentar.

---

## 6. Retenção

| Dado | Retenção | Eliminação |
|---|---|---|
| Logs de servidor brutos | 30 dias | Rotação automática |
| Logs agregados (contagens por rota/dia) | Indefinida | Não contêm dados pessoais |
| Snapshots brutos de microdados (SIVEP, futuros SIM/PNI/MX) | Mínimo: enquanto a snapshot estiver `current` ou for referenciada por pesquisa publicada; máximo: 24 meses após ser `superseded`, salvo necessidade de reprodutibilidade documentada em pesquisa publicada (então mantida com acesso restrito) | Job de limpeza; registro em `snapshots.notes` |
| Snapshots de fontes agregadas (FluNet, UKHSA, IBGE, Banco Mundial) | Indefinida (não contêm dados pessoais) | — |
| Agregados em `observations` | Indefinida; versionados por snapshot | — |
| Registros de `indicator_publications` e `ingestion_runs` | Indefinida (auditoria) | — |
| E-mails recebidos em contato | 12 meses após última interação | Manual/periódica |
| Dados de newsletter (futuro) | Até descadastro | Imediata no descadastro |

---

## 7. Base legal

| Tratamento | Base legal (LGPD) | Observação |
|---|---|---|
| Logs de servidor com IP truncado | Legítimo interesse (art. 7º, IX) para segurança e operação | Minimização por truncamento e 30 dias |
| Microdados públicos anonimizados de saúde para estatística | Os arquivos são publicados como dados abertos pelo órgão controlador, já sem identificadores diretos. O projeto os trata como **dados anonimizados** (art. 12) e só persiste agregados com supressão; não invoca a hipótese de "estudos por órgão de pesquisa" (art. 11, II, "c"), que não se aplica a ele. Se, em análise jurídica, algum conjunto for considerado dado pessoal sensível residual, a ingestão daquele conjunto é suspensa até definição de base legal | Avaliação a ser confirmada pelo DPO/assessoria jurídica (**a definir**) |
| Newsletter (futuro) | Consentimento (art. 7º, I) | — |
| Contato por e-mail | Legítimo interesse / procedimento preliminar a pedido do titular (art. 7º, V e IX) | — |
| Compartilhamento com provedores de IA | **Não ocorre** para dados de visitantes | Conteúdo editorial não contém dados pessoais |

Transferência internacional: logs e hospedagem podem estar em provedores fora do Brasil; com IP truncado e sem identificadores, o risco é baixo, mas o contrato com o provedor e a localização devem ser documentados pelo DPO.

---

## 8. Direitos dos titulares

Canal: e-mail institucional (**a definir**), identificado em `/contato/` e na página de privacidade. Prazo de resposta: 15 dias. Como o site não mantém cadastro, a maioria dos pedidos terá resposta "não tratamos dados pessoais seus"; pedidos sobre microdados de saúde devem ser direcionados ao órgão controlador (Ministério da Saúde), com orientação sobre o canal oficial.

---

## 9. Checklist de conformidade para novas funcionalidades

Antes de implementar qualquer recurso que toque dados de visitantes ou novos microdados:

1. Qual dado, qual finalidade, qual base legal? Está nesta tabela?
2. Dá para fazer sem coletar? Se sim, fazer sem coletar.
3. Há cookie, identificador ou envio a terceiro? Se sim, exige revisão do DPO e atualização pública.
4. Nova fonte de microdados: campos lidos listados; agregação em streaming; granularidade máxima UF × semana × faixa etária larga; supressão < 5; teste de reidentificação por subtração (supressão complementar).
5. Retenção definida e job de eliminação implementado.
6. Página pública de privacidade atualizada no mesmo deploy.
