# ADR-006 · Next.js 15 App Router + MDX com frontmatter editorial; números só via consulta determinística ao banco

**Status:** aceita (validada por revisão editorial/SEO em 2026-10-20) · **Data:** 2026-10-20 · **Decisões do plano de execução:** A6 e A7 · **Relacionadas:** ADR-001, ADR-003, ADR-005

## Contexto

O plano exige páginas indexáveis em HTML no servidor (8.2, 10.2), autoria e revisão transparentes (8.5), processo de aprovação por tipo de conteúdo (11.1) e a regra de que RAG/IA "nunca é a fonte da verdade para números; estatísticas devem vir de consultas determinísticas ao banco versionado, com origem exibida" (10.1). A validação editorial/SEO acrescentou: páginas clínicas nascem `noindex`, fora do sitemap e da navegação até revisão; sinais de alerta indexáveis com citação literal; `/tratamento/` adiado; JSON-LD restrito a `Organization`, `WebSite`, `BreadcrumbList`, `Dataset` (só séries derivadas próprias) e `DataCatalog`; sem `FAQPage`/`MedicalWebPage`; autoria declarada como "Redação H1N1 com apoio de IA, a partir de fontes oficiais, sem revisão clínica até o momento"; CI testa `noindex`; alerta de frescor na UI.

## Decisão

1. **Next.js 15 (App Router)** em `apps/web`, com SSG/ISR para todas as páginas de conteúdo e observatório; o HTML entregue contém o texto principal e a tabela equivalente dos gráficos. Revalidação de ISR por evento de publicação de indicador, não por cron.
2. **Conteúdo em MDX** com frontmatter obrigatório: `title`, `slug`, `intent`, `author`, `ai_assisted`, `reviewer` (ou `null`), `reviewed_at` (ou `null`), `review_status` ∈ {`draft`, `editorial_review`, `pending_clinical_review`, `reviewed`}, `sources[]` (título, órgão, URL, data de acesso), `clinical` (booleano). O build falha se faltar campo.
3. **Estado de publicação derivado do frontmatter**: `review_status != reviewed` em página `clinical: true` ⇒ `<meta name="robots" content="noindex,nofollow">`, exclusão do sitemap e da navegação, faixa de aviso no topo, bloco de autoria com o texto oficial. Teste de CI percorre todas as rotas construídas e falha se alguma página clínica não revisada estiver indexável ou no sitemap. `/tratamento/` não é construída.
4. **Números só do banco**: MDX **não** pode conter números epidemiológicos (casos, óbitos, percentuais, taxas). Componentes como `<Indicator id="..." geo="BRA" />` e `<Series ... />` consultam `/v1/series` (ou `packages/db` em build) e renderizam valor + `universe_note` + `data_as_of` + fonte + alerta de frescor; sem esses metadados o componente lança erro. Um lint de conteúdo bloqueia padrões numéricos ligados a "casos", "óbitos", "%" fora de componentes. Fatos históricos (datas, marcos) vêm de `facts.json`/tabela `facts`, com fonte, citação e data de verificação, via componente `<Fact id="..." />`.
5. **Dados estruturados**: `Organization` e `WebSite` no layout; `BreadcrumbList` nas internas; `Dataset` apenas em `/pesquisas/*` e páginas de série derivada própria (com `license`, `isBasedOn` apontando para a fonte oficial, `temporalCoverage`, `spatialCoverage`); `DataCatalog` em `/dados/fontes/`. Proibidos `FAQPage` e `MedicalWebPage`.
6. **Sem IA no runtime**: nenhum chatbot, RAG público ou geração de texto no servidor do site. A IA é ferramenta de redação (POLITICA_EDITORIAL §3), e o texto resultante passa pelo mesmo frontmatter e revisão.
7. **Alerta de frescor** é componente global: qualquer tela com número compara `freshness.age_days` ao limite da fonte e exibe a faixa de defasagem; sem publicação vigente, exibe estado indisponível (PRD §4.2 e §4.4).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| CMS headless (Sanity, Strapi, WordPress headless) | Adiciona serviço e custo; o fluxo de revisão por PR com frontmatter tipado é suficiente e auditável; migração possível depois |
| Pages Router / SPA | SPA prejudica indexação e CWV; App Router permite RSC e streaming com HTML completo |
| Permitir números em MDX com "data de referência" | Envelhecem sem aviso; não têm snapshot nem universo; contradiz 10.1 |
| `FAQPage`/`MedicalWebPage` para resultados ricos | Resultados ricos de FAQ foram restritos a sites governamentais/saúde reconhecidos; `MedicalWebPage` sem revisor identificado seria sinal falso de autoridade |
| Indexar páginas clínicas com aviso "não revisado" | Risco YMYL e reputacional; perde-se demanda no curto prazo por decisão (PRD §10, risco 1) |
| Chatbot/RAG para perguntas de saúde | Plano 11.2 veta prescrição e probabilidade; risco regulatório e de privacidade |

## Consequências

- Positivas: toda página clínica indexada tem revisor e data verdadeiros; números são rastreáveis a snapshot e universo; o site pode ser citado por imprensa com segurança; CI impede regressões de `noindex`.
- Negativas: até haver revisor, as intenções de maior alcance (sintomas, vacina, prevenção) não são indexadas; componentes de dado exigem a API ou o banco disponíveis em build (fallback: último build válido); escrever MDX é mais restrito.
- Obrigações: manter o lint de conteúdo e o teste de `noindex`; manter os limites de frescor por fonte em um único lugar; revisar `review_status` e `reviewed_at` a cada mudança de diretriz oficial ou a cada 12 meses.
