# ADR-001 · Monorepo pnpm + TypeScript (Node ≥ 22, ESM) para ETL, API e web

**Status:** aceita · **Data:** 2026-10-20 · **Decisão do plano de execução:** A1 · **Relacionadas:** ADR-002, ADR-003, ADR-006

## Contexto

O plano estratégico (seção 10.2) aponta Next.js + TypeScript no frontend, PostgreSQL no banco, ETL com snapshots imutáveis e um serviço próprio de indicadores/API. O projeto é pequeno em pessoas e grande em superfícies (conectores para dezenas de fontes, API versionada, site com conteúdo editorial, documentação). Precisamos de um idioma, um sistema de tipos e um conjunto de ferramentas que sirvam a todas as camadas, com testes rodando sem infraestrutura externa.

Restrições: a ontologia de indicadores (ADR-005) precisa ser compartilhada entre conectores, banco, API e web sem duplicação; a regra "números só do banco" (ADR-006) exige que o site consuma tipos idênticos aos da API.

## Decisão

- Um monorepo gerenciado por **pnpm workspaces** (`pnpm-workspace.yaml`), com `packages/core`, `packages/db`, `packages/connectors`, `apps/api`, `apps/web`.
- **TypeScript** em todos os pacotes, **ESM**, Node ≥ 22 (alvo 24), `tsconfig.base.json` comum.
- Scripts raiz: `build`, `test` (vitest), `lint`, `typecheck`, `db:migrate`, `db:seed`, `ingest`, `api`, `web`.
- `packages/core` é a única fonte de tipos de domínio e da ontologia; `packages/db` depende de `core`; `apps/*` e `connectors` dependem de ambos.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Python para ETL + TS para web | Duas linguagens duplicam a ontologia e as regras de integridade; aumentam custo de revisão. Python seria natural para análise, mas as pesquisas (R01–R08) podem usar notebooks à parte, consumindo a API |
| Repositórios separados por serviço | Contratos entre API e web divergem com facilidade; publicação de `core` como pacote versionado seria sobrecarga para uma equipe pequena |
| Turborepo/Nx | Úteis, mas não necessários no tamanho atual; `pnpm -r` com filtros basta. Podem ser adotados sem mudar a estrutura |
| JavaScript sem tipos | A ontologia (H1N1 ≠ influenza A ≠ SRAG) depende de tipos para impedir uso errado em tempo de compilação |

## Consequências

- Positivas: uma definição de indicador alimenta conector, seed, API e UI; `pnpm build && pnpm test` cobre tudo; refatorações cruzadas são seguras.
- Negativas: a pipeline de dados grandes (SIVEP 261 MB) roda em Node, exigindo parse em streaming cuidadoso; análises estatísticas avançadas ficarão fora do monorepo.
- Obrigações: manter `packages/core` sem dependências de runtime pesadas; qualquer novo pacote entra no workspace com `build`, `test`, `typecheck`.
