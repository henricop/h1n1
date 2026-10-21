# H1N1 · informação clara, dados oficiais, análise independente

Plataforma pública de orientação, monitoramento e pesquisa sobre influenza A(H1N1), feita para pessoas comuns com rigor suficiente para ser citada por jornalistas, pesquisadores e profissionais de saúde. **Não é um blog.**

Documentos de origem: [`h1n1_plano_estrategico_site.md`](./h1n1_plano_estrategico_site.md) (estratégia) e [`h1n1_catalogo_oficial.md`](./h1n1_catalogo_oficial.md) (65 fontes oficiais). Plano técnico: [`docs/PLANO_EXECUCAO.md`](./docs/PLANO_EXECUCAO.md). Demais documentos em [`docs/`](./docs/).

## Estrutura

| Pasta | O que é |
|---|---|
| `data/sources.json` | Catálogo estruturado das 65 fontes (gerado do markdown) |
| `data/snapshots/` | Originais baixados, com hash e licença (não versionado) |
| `packages/core` | Tipos, ontologia de indicadores, semanas epidemiológicas, supressão de células pequenas |
| `packages/db` | Esquema PostgreSQL (PGlite em dev), migrações, seed, consultas de publicação |
| `packages/connectors` | Conectores de ingestão (FluNet, SIVEP-Gripe, IBGE, Banco Mundial, UKHSA) e CLI |
| `apps/api` | API pública `/v1` (Fastify + OpenAPI) |
| `apps/web` | Site Next.js: páginas de referência, observatório, catálogo de fontes, metodologia |
| `apps/web/content` | Conteúdo editorial em MDX com frontmatter de revisão e registro de fatos citados |
| `docs/` | PRD, contrato de API, dicionário de indicadores, políticas, pesquisa de demanda, ADRs |

## Como rodar

```bash
pnpm install
pnpm build                       # compila packages e apps
pnpm test                        # testes de todos os pacotes
pnpm db:seed                     # cria o banco (PGlite em ./data/pglite) e carrega fontes/indicadores
pnpm ingest flunet --country BRA # ingestão real do FluNet (OMS)
pnpm ingest sivep --year 2026    # ingestão real do SIVEP-Gripe (arquivo de ~260 MB)
pnpm ingest status               # frescor por indicador
pnpm api                         # http://localhost:3001 (docs em /docs)
pnpm web                         # http://localhost:3000
```

Para usar PostgreSQL real, defina `DATABASE_URL`. Variáveis em `.env.example`.

## Regras de integridade (não negociáveis)

1. H1N1 confirmado **não é** influenza A não subtipada.
2. Casos graves registrados **não são** total de infectados.
3. Óbitos codificados por influenza **não são automaticamente** óbitos confirmados por H1N1.
4. Proporções de testes positivos dependem da estratégia de coleta e da cobertura.
5. Não somar painéis derivados aos registros primários da mesma origem.
6. Exibir explicitamente períodos, revisões, atraso e população de referência.
7. Não inferir risco individual usando apenas dados populacionais.
8. Não usar interesse no Google Trends como substituto de vigilância epidemiológica.
9. Não divulgar células pequenas ou cruzamentos que aumentem risco de reidentificação.
10. Bloquear publicação de indicadores com falha de validação, mantendo versão anterior claramente datada.

Cada número publicado sai de uma snapshot versionada de fonte oficial e é acompanhado do texto de universo do indicador. Conteúdo clínico nasce como "em revisão clínica", sem indexação, até revisão por profissional habilitado.

## Licenças dos dados

- SIVEP-Gripe, SINAN, SIM, PNI: CC-BY, Ministério da Saúde (dadosabertos.saude.gov.br).
- FluNet: OMS, conforme política de dados da OMS.
- IBGE e Banco Mundial: dados abertos, conforme termos de cada órgão.
- Demais fontes: verificar por fonte (`data/sources.json`, campo `license`).
