# ADR-002 · PostgreSQL como alvo, PGlite em desenvolvimento e testes

**Status:** aceita (validada por revisão de arquitetura em 2026-10-20) · **Data:** 2026-10-20 · **Decisão do plano de execução:** A2 · **Relacionadas:** ADR-003, ADR-005

## Contexto

O plano (10.2) define PostgreSQL para séries e consultas, com TimescaleDB como opção futura. O desenvolvimento precisa rodar e testar sem Docker nem serviço externo, inclusive em CI. As consultas incluem `jsonb` (estratos), índices parciais (`one_current`), `full outer join` (diff), `lateral` (frescor), transações (publicação atômica) e `gen_random_uuid()`.

## Decisão

- **PostgreSQL ≥ 14** é o banco de produção, acessado por `pg` quando `DATABASE_URL` existir.
- **PGlite** (Postgres embutido em WASM) é usado quando não há `DATABASE_URL`: diretório em `data/pglite` para desenvolvimento e `memory://` para testes.
- O **mesmo SQL** roda nos dois; migrações em `packages/db/migrations/*.sql`, aplicadas por `packages/db/src/client.ts` com registro em `schema_migrations`.
- A interface `Db` (`query`, `exec`, `transaction`, `close`, `kind`) abstrai o driver; nenhuma consulta usa recursos ausentes no PGlite.
- Decisões de esquema confirmadas na validação de arquitetura:
  - **chave de estrato canônica em texto** (`stratum_key`, pares `dim=valor` ordenados, `''` = total) na constraint de unicidade de `observations`, em vez de comparar `jsonb`;
  - tabela **`indicator_publications`** define a snapshot vigente por indicador (índice parcial único em `status = 'current'`); a API nunca escolhe "a snapshot mais recente" por conta própria;
  - campos **`period_end`**, **`event_date_basis`**, **`update_status`** em `observations`/`indicators` e **`mirror_group`** em `sources`/`indicators`;
  - **fatos históricos** citados em texto ficam em `facts` (e `facts.json`), separados de `observations`; indicadores só vêm de `observations`.
- TimescaleDB **não** entra no MVP; volume de agregados semanais por UF × estrato é pequeno.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| SQLite em dev, Postgres em prod | Dialetos divergem (jsonb, índices parciais com `where`, `lateral`, `numeric`); testes não cobririam o SQL real |
| Docker Compose com Postgres em dev/CI | Funciona, mas cria dependência de Docker para rodar testes; PGlite elimina isso e mantém o mesmo SQL |
| Apenas Postgres, sem PGlite | Barreira para contribuição e para CI simples |
| TimescaleDB desde o início | Sem volume que justifique; hypertables dificultam PGlite |
| Armazenar observações como documentos (NoSQL) | Perde constraints, diff por célula e supressão complementar por grupo |

## Consequências

- Positivas: `pnpm test` roda sem serviços; mesma migração em todos os ambientes; publicação atômica garantida por transação; diff entre snapshots por SQL.
- Negativas: PGlite tem limites de desempenho e de extensões; cargas grandes (SIVEP agregado completo) devem ser testadas também contra Postgres real antes de produção; diferenças sutis de versão podem surgir.
- Obrigações: toda nova consulta tem teste em PGlite; a CI roda ao menos um job com Postgres real antes de release; `storage_path` das snapshots aponta para disco/objeto, nunca para o banco.
