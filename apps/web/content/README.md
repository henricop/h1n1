# Conteúdo editorial do H1N1 (`apps/web/content/`)

Esta pasta contém o conteúdo editorial do portal: páginas MDX, a base de fatos verificados e o script de validação. A aplicação Next.js em `apps/web/` lê estes arquivos; nada aqui depende de código da aplicação.

## Estrutura

```
content/
├── README.md              # este arquivo
├── facts.json             # base de fatos verificados (datas, marcos, definições, intervalos)
├── pages/                 # uma página MDX por rota
│   ├── o-que-e-h1n1.mdx   # → /o-que-e-h1n1/
│   ├── sintomas/index.mdx # → /sintomas/
│   ├── sintomas/criancas.mdx
│   └── ...
└── scripts/validate.py    # validação de frontmatter, fatos, frases proibidas e política de indexação
```

Mapeamento de caminho para rota: `pages/<a>/<b>.mdx` → `/<a>/<b>/`; `pages/<a>/index.mdx` → `/<a>/`; `pages/<a>.mdx` → `/<a>/`.

## Como adicionar uma página

1. Crie o arquivo em `pages/` no caminho que corresponde à rota desejada.
2. Preencha o frontmatter com **todos** os campos do schema abaixo, na ordem indicada.
3. Comece o corpo com `<Resposta>` (2 a 4 frases que respondem à intenção da página). Não use H1 no corpo; o título vem do frontmatter.
4. Use títulos `##` e `###`, frases curtas e parágrafos de até 4 linhas.
5. Termine com a seção obrigatória `<Limites>` ("O que esta página não permite concluir").
6. Toda afirmação clínica ou epidemiológica precisa de fonte oficial listada em `sources`, com URL verificada (resposta 200/301/302) e `accessed_at`.
7. Rode `python3 -I scripts/validate.py` a partir desta pasta e corrija o que for apontado.

Tamanho de referência: 500 a 1100 palavras no corpo de páginas clínicas; 300 a 700 nas institucionais.

## Schema do frontmatter

| Campo | Tipo | Regras |
|---|---|---|
| `title` | string | Título da página (vira H1). |
| `description` | string | Até 160 caracteres. |
| `slug` | string | Rota com barras, ex.: `/sintomas/`. |
| `intent` | string | Intenção do usuário que a página resolve. |
| `nav_group` | `entenda` / `sintomas` / `vacina` / `dados` / `sobre` / `null` | Grupo de navegação. |
| `clinical` | boolean | `true` para sintomas, prevenção, vacina, comparações clínicas e materiais. |
| `index_policy` | `index` / `noindex_until_reviewed` | Páginas `clinical: true` nascem `noindex_until_reviewed`. Exceção única: `/sintomas/sinais-de-alerta/` (informação de segurança citada literalmente). |
| `review_status` | string | Páginas clínicas nascem `pending_clinical_review`; demais, `pending_editorial_review`. Só muda para `reviewed` com `reviewer` e `reviewed_at` preenchidos. |
| `author` | string | `Redação H1N1, com apoio de IA, a partir de fontes oficiais (sem revisão clínica até o momento)` enquanto não houver revisão. |
| `reviewer` | string ou `null` | Nome, formação e registro do revisor. Nunca inventar. |
| `reviewed_at` | data ou `null` | Data real da revisão. |
| `updated_at` | data `AAAA-MM-DD` | Data real da última alteração de conteúdo. |
| `sources` | lista de `{id?, title, url, accessed_at}` | `id` é o código do catálogo (`BR-11`, `INT-04`...) quando existir. URL verificada. |
| `related` | lista de slugs | Páginas relacionadas. |
| `summary_answer` | string | 1 a 2 frases com a resposta direta (usada em cards e metadados). |

## Componentes disponíveis no MDX

- `<Resposta>…</Resposta>`: primeiro bloco, resposta direta.
- `<Alerta tipo="emergencia"|"atencao"|"info">…</Alerta>`.
- `<Limites>lista markdown</Limites>`: seção obrigatória.
- `<Fato id="…" />`: exibe um fato de `facts.json`, com claim, fonte e citação.
- `<Indicador id="…" geo="BRA" periodo="ultimas-12-semanas" />`: busca o número real na API de indicadores. IDs válidos vêm da ontologia em `packages/core` (ex.: `sivep_srag_ah1n1pdm09_confirmed`, `flunet_ah1n1pdm09_detections`).
- `<Glossario termo="…" />`: termos disponíveis: `A(H1N1)pdm09`, `influenza A`, `SRAG`, `síndrome gripal`, `subtipo`, `RT-PCR`, `semana epidemiológica`.
- `<Comparativo>tabela markdown</Comparativo>`.
- `<LinhaDoTempo items={[{data:'2009-04', titulo:'…', fato_id:'…'}]} />`.
- `<Passos>lista numerada</Passos>`.

## Regra "sem número solto"

Nenhum número epidemiológico (contagem de casos, óbitos, percentuais, "X% dos casos") pode aparecer em texto livre nas páginas. Há duas formas permitidas:

1. **Fato histórico ou definição documentada** (data, marco, intervalo de estimativa com fonte literal): entra em `facts.json` e é referenciado por `<Fato id="…" />`. Estimativas de mortalidade só entram como fato com intervalo e citação literal.
2. **Número atual**: `<Indicador … />`, que consulta a API e exibe definição, universo, fonte e data da base.

A mesma regra vale para intervalos de dias e horas e limiares clínicos (incubação, período de transmissão, afastamento, idades de grupos de risco, doses): o `<Fato>` fica no mesmo parágrafo, item, citação ou linha de tabela que o número, inclusive dentro de `<Resposta>`. `description` e `summary_answer` não contêm números de dias/horas. Orientações de conduta (o que fazer em casa, quando procurar atendimento para grupos de risco) só entram como citação literal via `<Fato>`; a frase genérica "procure um serviço de saúde" é sempre permitida. O aviso fixo de emergência é idêntico em todas as páginas que o usam: "Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em /sintomas/sinais-de-alerta/." Listas de sinais de alerta só existem em `/sintomas/sinais-de-alerta/`, como citação literal.

Também é proibido: "tempo real", "surto perto de você", diagnóstico, probabilidade individual, prescrição ou dose de antiviral, "teste de H1N1 por sintomas", promessas de proteção absoluta. Sempre: "procure um serviço de saúde" diante de sinais de alerta e a marcação "este conteúdo é educativo".

## Schema de `facts.json`

Array de objetos:

```json
{
  "id": "kebab-case-unico",
  "claim": "Uma frase em pt-BR com a afirmação.",
  "source_title": "Órgão — Título do documento",
  "source_url": "https://…",
  "quote": "Trecho literal curto (opcional).",
  "verified_by": "Redação H1N1 (apoio de IA); pendente de revisão",
  "verified_at": "AAAA-MM-DD"
}
```

Só entram fatos cuja URL foi verificada e cujo conteúdo foi lido. Fontes aceitas: Ministério da Saúde (gov.br), Anvisa, OMS, OPAS, CDC, Fiocruz e órgãos equivalentes.

## Terminologia

Distinguir sempre: **influenza A** (tipo), **A(H1N1)pdm09** (subtipo; "H1N1" explicado na primeira menção), **influenza B**, **SRAG** (síndrome respiratória aguda grave) e **síndrome gripal**. H1N1 confirmado ≠ influenza A não subtipada ≠ SRAG ≠ síndrome gripal ≠ registro de vacina. Usar `<Glossario>` na primeira menção de cada termo.

## Validação

```
cd apps/web/content
python3 -I scripts/validate.py
```

O script verifica: campos obrigatórios do frontmatter; `description` ≤ 160 caracteres; `<Fato id>` existentes em `facts.json`; ausência de "tempo real" e "surto perto"; `clinical: true` com `index_policy: noindex_until_reviewed` (exceto `/sintomas/sinais-de-alerta/`); presença de `<Resposta>` e `<Limites>`; termos de glossário válidos; contagem de palavras do corpo; e **números soltos**: qualquer número (algarismo ou por extenso) seguido de dias, horas, semanas, meses, anos, minutos ou percentual, no corpo, na `description` ou no `summary_answer`, fora de um bloco que contenha `<Fato id>` (ou `fato_id:`), é erro. A checagem é por bloco (parágrafo, item, citação) e, em tabelas, por linha; anos de 4 dígitos sem unidade, atributos de componentes e destinos de links são ignorados; páginas em `/sobre/`, `/contato/` e `/dados/` (prazos de política e convenções metodológicas) são isentas. Sai com código 1 se houver erro.
