# H1N1: Jornada da Infecção no Corpo Humano

**Especificação de produto, experiência e implementação para o Codex**

**Tipo:** simulador educacional interativo para navegador

**Idioma da interface:** português do Brasil
**Diretriz principal:** evoluir a aplicação existente, não criar uma pesquisa científica nem apenas trocar sua aparência.

---

## 1. O que precisa mudar

A versão atual apresenta um ambiente microscópico com células, partículas virais, agentes de defesa, contadores e controles. Ela funciona como uma demonstração isolada do micromundo, mas **não entrega a experiência imaginada**.

A nova versão deve responder a uma pergunta muito mais interessante:

> **"O que está acontecendo dentro do corpo humano, do primeiro contato com o H1N1 até a recuperação ou a piora, e como diferentes adversidades podem mudar essa jornada?"**

O visitante deve **começar diante de um corpo humano 3D**, acompanhar o avanço temporal da infecção, aproximar a câmera progressivamente até os órgãos, tecidos e células, observar o que acontece em cada escala e introduzir eventos que alterem a simulação em execução.

### O que manter do projeto atual

- Engine existente, caso já esteja funcional, incluindo estados de vírus, células, agentes de defesa, semente aleatória e controles de tempo.
- Renderização 3D e otimizações existentes, desde que sejam tecnicamente adequadas.
- A possibilidade de pausar, acelerar, reiniciar e controlar a intensidade de variáveis.
- Instrumentação de FPS, testes, estrutura de componentes e demais funcionalidades úteis.

### O que substituir ou expandir

- **Tela principal:** sair de uma nuvem de células soltas para um corpo humano com anatomia navegável.
- **Navegação:** adicionar zoom contextual entre escalas, do organismo até o interior celular.
- **Tempo:** introduzir uma linha do tempo em horas e dias, com eventos visuais e marcos da evolução.
- **Simulação:** conectar estados microscópicos a alterações nos tecidos, órgãos e indicadores do corpo.
- **Adversidades:** permitir criar eventos em dias específicos e observar consequências simuladas.
- **Narrativa:** explicar automaticamente o que mudou e por quê, em linguagem simples.
- **Comparação:** permitir confrontar o cenário original com um cenário modificado.

**Regra inegociável:** a interface não pode apenas exibir efeitos programados para o dia 3 ou o dia 5. A situação observada deve ser calculada pela engine. Os textos e animações devem representar o estado calculado.

---

## 2. Visão da experiência

### Abertura

A aplicação inicia com um corpo humano tridimensional, em posição anatômica neutra, sobre um fundo escuro e discreto. O sistema respiratório aparece levemente destacado. Uma indicação informa:

**"Explore como uma infecção por H1N1 evolui dentro do corpo."**

O usuário pode iniciar uma simulação padrão ou escolher um cenário inicial, como defesa imunológica típica, defesa reduzida ou proteção prévia. Não é necessário preencher dados pessoais.

Ao iniciar, uma animação contextual mostra a entrada do vírus pela via respiratória. O visitante pode continuar acompanhando o corpo inteiro ou entrar nas estruturas internas.

### Navegação por escalas

| Nível | Visão | O que deve ser visível | Interações |
|---|---|---|---|
| 1 | **Corpo humano** | Silhueta anatômica, sistema respiratório, regiões afetadas, condição geral | Rotacionar, selecionar órgão, avançar dias |
| 2 | **Sistema respiratório** | Cavidade nasal, traqueia, brônquios e pulmões | Selecionar região, destacar alterações, aproximar |
| 3 | **Região pulmonar** | Brônquios/bronquíolos e representação simplificada de alvéolos | Inspecionar tecido e distribuição local |
| 4 | **Tecido respiratório** | Superfície epitelial organizada, muco, células, agentes de defesa | Acompanhar infecção local, selecionar células |
| 5 | **Célula** | Membrana, interior celular ilustrativo e etapas simplificadas da infecção | Inspecionar estado, acompanhar progressão celular |

**Importante:** é uma experiência multiescala. Não tentar renderizar literalmente todos os níveis com a mesma escala espacial. Um zoom contínuo realista entre metros e micrômetros seria inadequado para essa aplicação. Usar **câmeras-âncora, cenas especializadas, transições e correspondência contextual** para criar a sensação de um mergulho contínuo.

### Fluxo principal esperado

1. O visitante vê o corpo inteiro e inicia a infecção simulada.
2. Avança do dia 0 para o dia 1 e observa alterações no sistema respiratório.
3. Aproxima para o pulmão, seleciona uma região e vê o tecido correspondente.
4. Entra na escala celular, observa células infectadas e a ação das defesas.
5. Retorna ao corpo inteiro sem perder o estado ou a posição da linha do tempo.
6. Avança até o dia 4 ou 5 e acompanha a mudança de condição geral.
7. Introduz uma adversidade, por exemplo, **privação de sono simulada a partir do dia 3**.
8. Continua a simulação e observa alterações coerentes nos indicadores e nas cenas.
9. Alterna entre o cenário original e o cenário com adversidade para comparar resultados.
10. Reinicia, altera as condições iniciais e experimenta outro desfecho possível.

---

## 3. Direção visual

### Linguagem estética

Criar uma combinação de **atlas anatômico interativo, visualização microscópica cinematográfica e painel científico acessível**.

- Corpo humano 3D bem construído, com materiais translúcidos controlados e sistema respiratório em destaque.
- Visual interno com iluminação volumétrica discreta, profundidade, partículas e materiais orgânicos.
- Tecidos compostos por estruturas conectadas, não células distribuídas aleatoriamente no vazio.
- Células reconhecíveis, superfícies com leve movimento e resposta visual aos estados.
- Infecção representada por nuances localizadas, não pelo corpo inteiro ficando vermelho de repente.
- Animações suaves de câmera, foco, revelação de camadas e transições de escala.
- Interface limpa, com hierarquia clara e uso moderado de cores.

**Codificação visual sugerida:** saudável em verde-azulado; atividade viral em magenta/vermelho; inflamação em âmbar; defesa imunológica em azul; recuperação em verde. Não depender somente das cores: usar legendas, padrões e rótulos.

### Movimento da câmera

- Scroll ou zoom para aproximação gradual.
- Clique em órgão ou região para criar uma transição guiada.
- Breadcrumb fixo: `Corpo > Pulmões > Brônquio > Tecido > Célula`.
- Comando **Voltar um nível**.
- Botão **Retornar ao corpo**.
- Orbit suave com limites adequados por escala.
- Transições cinematográficas curtas, com foco/desfoque e correspondência de posição.
- Modo de movimento reduzido, respeitando `prefers-reduced-motion`.

A câmera **não pode atravessar órgãos de forma aleatória**. Quando uma região é selecionada, o sistema deve conhecer sua âncora anatômica e qual cena microscópica representa aquela região.

---

## 4. O tempo como elemento central

A simulação deve ter uma **linha do tempo principal**, sempre visível no desktop e facilmente acessível no mobile.

### Escala temporal

- Padrão: **dia 0 ao dia 14**, com possibilidade de acompanhar até o dia 21 se o cenário exigir.
- Cálculo interno recomendado: passos de uma hora simulada, independentes da taxa de renderização.
- Reprodução: pausar, continuar, avançar uma hora, avançar um dia e alterar velocidade.
- Scrubbing: arrastar a linha do tempo para revisar um estado anterior.
- Replay: voltar ao dia 0 e reproduzir com a mesma semente e as mesmas escolhas.
- Snapshots periódicos e log de eventos para tornar a navegação eficiente.

### Marcos narrativos

O sistema pode destacar estágios como **exposição, infecção local, resposta imune, recuperação ou agravamento**. Eles devem depender do estado da engine, não ser forçados por datas fixas.

Exemplo de linguagem da interface:

- **Dia 0:** "O vírus entrou em contato com a mucosa respiratória nesta simulação."
- **Dia 2:** "Há mais células infectadas nesta região. A resposta de defesa está aumentando."
- **Dia 4:** "A atividade inflamatória está elevada. Observe como o tecido se comporta."
- **Dia 7:** "Neste cenário, a atividade viral diminuiu e a recuperação do tecido começou."

Esses exemplos são **templates condicionais**, não previsões nem resultados obrigatórios. Uma simulação que se recupere antes ou piore depois deve gerar uma narrativa correspondente.

### Evento visual importante

Ao selecionar um marco, o usuário poderá clicar em **"Mostrar o que aconteceu"**. A câmera viaja até a região responsável e exibe, no tecido ou nas células, o evento que explica a mudança observada.

---

## 5. Engine de simulação: simples, conectada e consistente

Não construir um modelo clínico de pesquisa. Construir um **modelo educacional estilizado e reproduzível**, com regras simples, auditáveis e fáceis de calibrar para uma boa experiência interativa.

### Camadas da engine

**A. Estado do organismo**

- Condição geral ilustrativa.
- Intensidade da resposta imunológica.
- Inflamação agregada.
- Integridade respiratória agregada.
- Nível de desconforto/sintomas simulados, apenas como apresentação educativa.

**B. Estado por região respiratória**

- Região anatômica e conexões com regiões vizinhas.
- Atividade viral relativa.
- Fração de células saudáveis, expostas, infectadas, danificadas e em recuperação.
- Atividade de defesa local.
- Integridade do tecido.
- Inflamação local.

**C. Estado microscópico**

- Células individuais ou agregadas por grupos.
- Partículas virais **representativas**, não uma contagem real de todos os vírus no organismo.
- Agentes de defesa visuais, também representativos.
- Animações de adesão, infecção, resposta imune e regeneração.

### Relação entre escalas

O estado microscópico altera os agregados do tecido; os tecidos alimentam os indicadores do órgão; os órgãos alimentam a condição geral.

Exemplo:

```text
Células respiratórias infectadas
           ↓
Maior atividade infecciosa no tecido
           ↓
Mudança na integridade e inflamação locais
           ↓
Alterações no estado visual da região pulmonar
           ↓
Atualização dos indicadores do corpo
```

O fluxo inverso também existe: uma condição sistêmica modificada por uma adversidade altera parâmetros simplificados da resposta imune ou da recuperação nos tecidos.

### Regiões modeladas na primeira entrega

1. Mucosa nasal e nasofaringe, de forma simplificada.
2. Traqueia.
3. Brônquios.
4. Bronquíolos.
5. Região alveolar representativa.

Essas regiões fazem parte de um **modelo demonstrativo de vias respiratórias**. A visualização não deve sugerir que todas as regiões obrigatoriamente ficarão infectadas em todas as simulações.

### Máquina de estados celulares

```text
SAUDÁVEL
   ↓ exposição bem-sucedida
EXPOSTA
   ↓ progressão
INFECTADA
   ├──→ DANIFICADA
   │        ↓
   │    REMOVIDA / TECIDO EM REPARO
   │
   └──→ CONTROLADA PELA DEFESA
            ↓
       TECIDO EM RECUPERAÇÃO
```

Separar **estado de célula** de **estado de tecido**: uma célula danificada não deve "renascer" magicamente como se fosse a mesma entidade. A recuperação visual representa reparo ou reposição do tecido em escala agregada.

### Comportamento simplificado por passo

```text
para cada hora simulada:
    aplicar eventos e adversidades ativos
    atualizar estado de defesa do organismo
    atualizar propagação ilustrativa por região
    atualizar células expostas/infectadas/danificadas
    atualizar defesa local, inflamação e reparo
    transferir parte da atividade entre regiões conectadas
    recalcular indicadores agregados do organismo
    registrar mudanças relevantes e gerar snapshot quando necessário
```

A parametrização deve privilegiar **coerência causal, estabilidade numérica e diversidade de cenários**, sem afirmar taxas biológicas reais. Não inventar percentuais de eficácia terapêutica, mortalidade ou prognóstico clínico.

### Determinismo e replay

- Usar PRNG com `seed` explícita, nunca `Math.random()` diretamente dentro da lógica determinística.
- Estado = condições iniciais + seed + tempo simulado + eventos aplicados.
- Atualizar a engine em passos fixos; renderizar com interpolação.
- Para navegar ao passado: restaurar o snapshot anterior mais próximo e reaplicar eventos em ordem.
- Ao alterar uma adversidade no passado, recalcular **somente a linha temporal daquele cenário** a partir do ponto afetado.
- Pausar não deve alterar nenhum indicador.
- Acelerar o tempo não pode mudar o resultado com a mesma seed.

---

## 6. Sistema de adversidades e intervenções

Este é um dos diferenciais centrais. O visitante deve poder perguntar **"E se isso acontecer no dia 3?"** e realmente testar a hipótese na simulação.

### Catálogo inicial

| Evento | Como aparece na UI | Efeito conceitual simulado |
|---|---|---|
| Privação de sono | "Dormiu mal por 2 noites" | Ajusta temporariamente a capacidade de resposta/recuperação ilustrativa |
| Estresse prolongado | "Período de estresse intenso" | Modifica um parâmetro agregado de resiliência |
| Exposição a fumaça | "Irritação das vias respiratórias" | Reduz temporariamente a integridade epitelial ilustrativa |
| Desidratação | "Hidratação insuficiente" | Introduz um fator de desconforto e recuperação simulada |
| Defesa imunológica reduzida | "Defesa inicialmente reduzida" | Condição basal que altera a dinâmica de resposta |
| Condição respiratória prévia | "Maior vulnerabilidade respiratória" | Modifica a resiliência de tecido, sem simular uma doença específica |
| Proteção por vacinação prévia | "Proteção prévia" | Condição inicial, configurada antes da exposição |
| Suporte e repouso | "Condições favoráveis de recuperação" | Ajusta fatores gerais de recuperação ilustrativa |

**Restrições de interpretação:** os efeitos acima são **mecânicas qualitativas do simulador**, não afirmações de magnitude causal individual. Não apresentar dados como "dormir mal aumenta a infecção em 32%" ou comparar isso a decisões médicas reais.

A primeira entrega deve limitar-se a eventos educativos de alto nível, sem representar doses, administração de medicamentos, instruções de manipulação viral ou técnicas para intensificar infecção real.

### Editor de adversidades

Ao clicar em **"Adicionar evento"**, abrir um painel com:

- Tipo de adversidade.
- Dia e hora de início.
- Duração.
- Intensidade: leve, moderada ou intensa.
- Região afetada, quando aplicável.
- Descrição clara do efeito demonstrativo esperado.
- Botão **Aplicar ao cenário**.

Após aplicar:

1. O evento aparece na linha do tempo com um marcador próprio.
2. Um indicador discreto mostra que há uma condição ativa.
3. A simulação passa a utilizar os modificadores correspondentes.
4. O usuário vê mudanças nos indicadores e nas cenas, quando o estado as justificar.
5. A explicação informa **qual parâmetro foi alterado**, sem fingir precisão clínica.
6. O evento pode ser editado, desativado ou removido.

Eventos com duração limitada devem terminar automaticamente no momento configurado.

### Comparação entre cenários

O usuário deve poder criar duas linhas temporais:

- **Cenário A:** evolução original, sem a nova adversidade.
- **Cenário B:** mesmo início e mesma seed, com a adversidade.

Mostrar comparação de:

- Atividade viral relativa.
- Integridade do tecido respiratório.
- Atividade de defesa.
- Inflamação relativa.
- Tempo até um estado de recuperação ilustrativa ou agravamento, quando ocorrer.

Permitir alternar as visualizações ou abrir comparação lado a lado no desktop. **Comparação não significa prever o que aconteceria com uma pessoa real.**

---

## 7. Interface principal e organização da informação

### Desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ H1N1 | Jornada da Infecção       DIA 04 / 14      [Ajuda] [Reiniciar] │
├─────────────────┬──────────────────────────────────┬─────────────────┤
│ NAVEGAÇÃO       │                                  │ ESTADO ATUAL    │
│                 │       CORPO HUMANO 3D            │                 │
│ ○ Corpo         │                                  │ Atividade viral │
│ ○ Respiratório  │        [órgãos e tecidos]        │ Defesa          │
│ ○ Pulmões       │                                  │ Inflamação      │
│ ○ Tecido        │                                  │ Tecido íntegro  │
│ ○ Célula        │                                  │                 │
│                 │ [Zoom] [Orbit] [Foco] [Voltar]   │ O que mudou?    │
├─────────────────┴──────────────────────────────────┴─────────────────┤
│ [◀ Dia] [▶ Play] [▶ Dia] [Velocidade]                               │
│ Dia 0 ━━━━━●━━━━━━━━━━●━━━━━━━━━━━━●━━━━━━━━━━━━ Dia 14            │
│             evento         resposta                 recuperação       │
├──────────────────────────────────────────────────────────────────────┤
│ [+ Adicionar adversidade] [Comparar cenários] [Gráficos] [Eventos]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Padrões de interação

- **Centro:** visualização sempre protagonista.
- **Esquerda:** profundidade anatômica, localização e atalhos de navegação.
- **Direita:** indicadores e explicação do estado atual.
- **Inferior:** linha do tempo, reprodução e eventos.
- **Mobile:** tela 3D em destaque e painéis inferiores recolhíveis; não tentar encolher três colunas.
- **Modo apresentação:** ocultar controles e usar uma experiência guiada.

### Inspeção contextual

Clicar numa célula abre detalhes como:

```text
Célula epitelial | Região: brônquio
Estado: infectada
Tempo nesse estado: 9 horas simuladas
Resposta de defesa local: ativa

Nesta simulação, a célula participa de uma região
com maior atividade viral e inflamação.
```

Os valores devem vir do estado real da engine, não de mocks.

### Gráficos

Exibir no máximo quatro curvas principais por padrão:

1. Atividade viral relativa.
2. Resposta imune relativa.
3. Integridade tecidual.
4. Inflamação relativa.

Os valores devem ser apresentados como **índices internos de 0 a 100** ou unidades relativas, com legenda explícita. Não chamar esses índices de carga viral clínica, saturação de oxigênio ou exame laboratorial.

---

## 8. Arquitetura técnica recomendada

**Prioridade:** preservar o projeto existente, incluindo sua stack, caso ela já cumpra o objetivo. Fazer evolução incremental, sem reescrever tudo por preferência de biblioteca.

### Stack sugerida

- TypeScript e React no frontend.
- Three.js como base de renderização 3D.
- React Three Fiber e Drei **se trouxerem integração real ao projeto atual**, não como obrigação de migração.
- GSAP para transições de câmera e sequências narrativas.
- Zustand ou gerenciamento de estado equivalente para UI e controles.
- Engine de simulação pura em TypeScript, independente do React e do Three.js.
- Web Worker para simulação caso benchmarks demonstrem necessidade.
- Vitest para testes determinísticos e invariantes.
- Playwright para navegação, screenshots e validação ponta a ponta.
- WebGPU quando suportado e estável; fallback confiável para WebGL 2.
- Sem backend obrigatório, sem banco de dados e sem IA em runtime para funcionar.

### Separação obrigatória

```text
H1N1 SIMULATOR
├── App / UI
│   ├── AnatomicalNavigator
│   ├── TimelineControls
│   ├── AdversityEditor
│   ├── ScenarioComparison
│   └── ExplainStatePanel
│
├── Simulation Core (sem dependência de UI/3D)
│   ├── SimulationClock
│   ├── SeededRandom
│   ├── BodyState
│   ├── RegionState
│   ├── TissueState
│   ├── CellState
│   ├── ImmuneResponseSystem
│   ├── EventModifierSystem
│   ├── SnapshotManager
│   └── ScenarioBranchManager
│
├── Visualization
│   ├── BodyScene
│   ├── RespiratoryScene
│   ├── OrganScene
│   ├── TissueScene
│   ├── CellScene
│   ├── ScaleTransitionManager
│   ├── AnatomyAnchors
│   └── Effects / Materials / LOD
│
└── Tests
    ├── simulation
    ├── state-invariants
    ├── scenarios
    ├── navigation
    └── visual-e2e
```

### Contrato de estado mínimo

```ts
type AnatomyLevel =
  | "body"
  | "respiratory"
  | "organ"
  | "tissue"
  | "cell";

type CellStatus =
  | "healthy"
  | "exposed"
  | "infected"
  | "damaged"
  | "controlled";

type ScenarioEvent = {
  id: string;
  kind: string;
  startHour: number;
  durationHours: number;
  intensity: "mild" | "moderate" | "high";
  targetRegionId?: string;
  enabled: boolean;
};

type RegionSummary = {
  regionId: string;
  viralActivity: number;      // índice interno 0..100
  immuneActivity: number;     // índice interno 0..100
  inflammation: number;      // índice interno 0..100
  tissueIntegrity: number;   // índice interno 0..100
  healthyCellRatio: number;  // 0..1
  infectedCellRatio: number; // 0..1
};

type Scenario = {
  id: string;
  seed: number;
  initialConditions: Record<string, unknown>;
  events: ScenarioEvent[];
};

type SimulationSnapshot = {
  scenarioId: string;
  simulatedHour: number;
  regions: RegionSummary[];
  // Adicionar estado interno necessário para replay determinístico.
};
```

O código acima é apenas um **contrato inicial**, não a implementação integral. O Codex deve evoluí-lo com tipos estritos e responsabilidades claras.

### Mapeamento entre simulação e visualização

Criar um **Anatomy Registry**:

```text
regionId: "bronchus-left"
bodyAnchor: "thorax-left"
organSceneAnchor: "left-bronchus"
tissueSceneId: "bronchial-epithelium"
relevantState: simulation.regions["bronchus-left"]
```

Dessa forma, a câmera pode ir do corpo para o brônquio e mostrar exatamente o estado daquela região. Sem esse mapeamento, a navegação parecerá bonita, mas desconectada da simulação.

### Performance

- Não renderizar todas as escalas anatômicas simultaneamente.
- Carregar modelos e texturas por demanda e preparar o próximo nível antes da transição.
- Criar LOD para corpo e órgãos.
- Usar instancing nas células e partículas repetidas.
- Aplicar culling e limites adaptativos para partículas e efeitos.
- Reduzir pós-processamento automaticamente em dispositivos mais lentos.
- Manter estado científico separado de partículas decorativas.
- Não tentar renderizar uma partícula para cada vírus calculado.
- Evitar sincronização React por frame; publicar snapshots visuais em frequência controlada.
- Limpar geometria, materiais, render targets e listeners durante a troca de escala.

**Metas de qualidade:** mirar 60 FPS em desktop adequado e 30 FPS em mobile intermediário, confirmadas com benchmark; iniciar uma versão funcional mesmo em hardware sem WebGPU.

---

## 9. Modelos 3D e pipeline de assets

A qualidade da experiência dependerá bastante da anatomia.

### Assets essenciais

- Corpo humano anatômico simplificado, com camadas separáveis.
- Sistema respiratório completo e identificável.
- Pulmões e árvore brônquica simplificada.
- Modelo de tecido epitelial respiratório.
- Modelos estilizados de células epiteliais, células de defesa e partículas de influenza.
- Representação interna celular claramente ilustrativa.

### Regras para os assets

1. Buscar inicialmente assets com licença adequada para uso e distribuição no site.
2. Registrar fonte, autoria, licença e eventuais obrigações de atribuição.
3. Priorizar `.glb` / `.gltf` com hierarquia nomeada e pontos anatômicos consistentes.
4. Otimizar geometrias e texturas para web; não carregar modelos clínicos gigantes sem necessidade.
5. Se não houver modelo adequado, gerar versão procedural ou construir um modelo simplificado, mas não substituir o corpo por uma coleção de esferas.
6. A anatomia deve ser reconhecível, ainda que estilizada e não clinicamente exaustiva.
7. Componentes sem modelo final devem continuar navegáveis e funcionais, com fallback visual identificado.

**Não usar imagem estática como falsa visualização 3D.** O usuário deve conseguir orbitar, selecionar e aproximar.

---

## 10. Mecânica de explicação: "Por que mudou?"

Toda mudança relevante deve ser rastreável.

Exemplo de evento interno:

```ts
{
  simulatedHour: 84,
  kind: "tissue-integrity-decreased",
  regionId: "bronchus-left",
  relatedFactors: [
    "local-infection-activity",
    "inflammation",
    "smoke-exposure-event"
  ]
}
```

A interface traduz isso em:

> **Dia 3, brônquio esquerdo:** a integridade do tecido diminuiu neste cenário. A atividade infecciosa e a inflamação estão elevadas, enquanto a exposição à fumaça adicionada pelo usuário introduz um fator extra de irritação no modelo.

A explicação deve indicar **fatores que a própria engine utilizou**, não inventar justificativas depois de observar o gráfico. A autoria das explicações pode ser determinística, com templates em português. Não é necessário chamar um LLM durante a execução.

---

## 11. Etapas para o Codex

### Fase 0: auditoria e plano de migração

**Objetivo:** entender a implementação atual e preservar o que já funciona.

- Inspecionar framework, arquivos, sistemas de partículas, estados, renderização e testes.
- Identificar componentes reutilizáveis e componentes que precisarão ser substituídos.
- Executar a aplicação e registrar o baseline visual e funcional.
- Elaborar plano incremental com arquivos afetados, riscos e critérios de aceite.
- Atualizar `AGENTS.md` com as regras específicas deste projeto.

**Entrega:** diagnóstico de arquitetura e uma primeira mudança pequena sem regressão.

### Fase 1: corpo humano como cena principal

- Substituir a abertura da nuvem de células por uma vista completa do corpo.
- Inserir modelos anatômicos e sistema respiratório destacável.
- Criar seleção de órgãos, hover e rótulos.
- Implementar câmera, orbit e enquadramentos.
- Preparar a hierarquia espacial para transições de escala.

**Aceite:** ao abrir o site, o usuário vê um corpo humano navegável, não o micromundo isolado.

### Fase 2: navegação multiescala

- Implementar os cinco níveis de exploração.
- Criar âncoras anatômicas e transições contextualizadas.
- Incluir breadcrumb, voltar nível e retornar ao corpo.
- Conectar o micromundo atual a uma região real do modelo visual.
- Preservar relógio, seed, eventos e estado ao trocar de nível.

**Aceite:** Corpo > Pulmão > Região > Tecido > Célula funciona em ida e volta, mantendo consistência visual e de dados.

### Fase 3: progressão temporal

- Criar relógio independente do FPS.
- Integrar estado de regiões, tecidos e condição geral.
- Implementar timeline de 0 a 14 dias, com possibilidade de extensão.
- Suportar pausa, avanço de hora, avanço de dia, replay e scrubbing.
- Criar snapshots e logs de eventos.
- Conectar alterações dos indicadores às cenas anatômicas.

**Aceite:** avançar dias altera o corpo e a visualização celular de forma coerente, repetível e vinculada à engine.

### Fase 4: adversidades

- Implementar catálogo configurável de eventos.
- Criar editor de dia, duração, intensidade e região.
- Aplicar modificadores à engine sem efeitos fictícios apenas na interface.
- Registrar eventos na timeline.
- Permitir editar, remover e recalcular uma linha temporal.

**Aceite:** introduzir uma adversidade num dia muda o estado posterior, quando aplicável, preservando o anterior.

### Fase 5: cenários paralelos

- Implementar baseline e cópia derivada do baseline.
- Manter seed e condições iniciais iguais para comparação controlada.
- Apresentar gráficos comparativos, diferenças e explicações.
- Permitir voltar ao cenário original sem perder os resultados.

**Aceite:** dois cenários são reprodutíveis, comparáveis e independentes após a bifurcação.

### Fase 6: acabamento visual e narrativa

- Refinar shaders, materiais, iluminação, tecidos e partículas.
- Adicionar transições com foco e profundidade.
- Implementar cartões de explicação, legendas, onboarding e "Mostrar o que aconteceu".
- Melhorar acessibilidade, estados de loading, telas pequenas e preferências de movimento.

**Aceite:** a experiência parece um atlas interativo vivo, não um dashboard genérico ou um conjunto de esferas.

### Fase 7: validação e otimização

- Testar lógica com Vitest.
- Testar fluxos reais no navegador com Playwright.
- Inspecionar renders e screenshots em desktop e mobile.
- Medir FPS, memória, carregamento e falhas de contexto gráfico.
- Corrigir problemas identificados antes de considerar concluído.

**Aceite:** testes passando, navegação completa, gráficos coerentes e ausência de travamentos conhecidos nos cenários de referência.

---

## 12. Testes obrigatórios

### Invariantes da engine

- Nenhuma contagem negativa.
- Razões e índices mantidos em seus intervalos válidos.
- Soma dos estados celulares compatível com a população modelada.
- Pausa não avança tempo nem altera estado.
- Mesma seed + mesmas condições + mesmos eventos = mesmo estado em qualquer tempo.
- Alterar FPS, qualidade gráfica ou câmera não altera o resultado.
- Eventos não podem retroagir em períodos anteriores ao seu início.
- Remover um evento e recalcular deve reproduzir o baseline, quando todas as demais condições forem iguais.
- As métricas agregadas devem concordar com os estados das regiões.

### Testes de experiência

1. Abrir e visualizar o corpo inteiro.
2. Girar e aproximar o modelo.
3. Selecionar pulmão e navegar até tecido.
4. Selecionar uma célula e inspecionar seu estado.
5. Avançar três dias e voltar ao corpo.
6. Voltar um dia pela timeline e confirmar atualização consistente das cenas.
7. Pausar e verificar congelamento de indicadores.
8. Adicionar adversidade no dia 3.
9. Verificar que a adversidade aparece na timeline.
10. Avançar para o dia 6 e observar diferenças no cenário modificado.
11. Comparar cenário A e B.
12. Remover adversidade e recalcular.
13. Reiniciar com a mesma seed e reproduzir o mesmo resultado.
14. Testar navegação em mobile.
15. Testar redução de movimento e teclado.
16. Testar WebGL 2 quando WebGPU não estiver disponível.
17. Validar que troca constante de escala não causa crescimento indevido de memória.

### Validação visual

O Codex deve produzir capturas reais da aplicação em pelo menos:

- Corpo inteiro no dia 0.
- Corpo com regiões alteradas num dia posterior.
- Vista detalhada do pulmão.
- Vista do tecido respiratório.
- Vista de uma célula selecionada.
- Editor de adversidades aberto.
- Comparação de dois cenários.
- Layout mobile.

Não considerar a implementação concluída apenas porque o build passou.

---

## 13. Critérios de sucesso do produto

A experiência está pronta quando:

- [ ] O usuário começa com um **corpo humano 3D completo e navegável**.
- [ ] É possível fazer o percurso até um órgão, tecido e célula, e retornar.
- [ ] O tempo pode ser avançado **dia a dia**, e as alterações são visíveis em todas as escalas.
- [ ] O modelo representa progressão, controle imunológico, recuperação e possibilidade de agravamento ilustrativo.
- [ ] A timeline mostra eventos importantes que realmente decorreram da engine.
- [ ] Adversidades podem ser adicionadas em momentos específicos.
- [ ] As adversidades alteram parâmetros reais do simulador e, portanto, os estados resultantes.
- [ ] Cenários podem ser comparados a partir da mesma condição inicial e seed.
- [ ] Cada indicador pode ser explicado por fatores internos rastreáveis.
- [ ] O site funciona em desktop e mobile com qualidade adaptativa.
- [ ] O sistema não depende de APIs pagas, backend ou IA externa para executar a experiência.
- [ ] Os testes críticos e as verificações visuais estão concluídos.

---

## 14. Prioridade de implementação

Não construir todas as cenas e sistemas completos de uma só vez.

O **primeiro marco jogável** deve entregar exatamente esta sequência:

**Corpo 3D → Pulmão → Tecido → Célula → Avançar um dia → Ver mudança → Adicionar adversidade → Ver mudança correspondente.**

Mesmo com modelos simplificados, esse percurso precisa funcionar ponta a ponta antes de investir em efeitos sofisticados, dezenas de eventos ou gráficos adicionais.

Após esse marco, melhorar os assets, completar a navegação, adicionar comparação de cenários e elevar a qualidade cinematográfica.

---

## 15. Instrução final ao Codex

> Você está evoluindo um simulador de H1N1 que já possui um micromundo 3D com partículas virais, células e defesas. **A versão atual é apenas o ponto de partida.** O objetivo real é um simulador educacional multiescala, centrado no corpo humano, em que o usuário mergulha da anatomia até a célula, acompanha a infecção por dias e introduz adversidades para observar a mudança da trajetória simulada.
>
> Inspecione o repositório antes de modificar. Preserve os sistemas bons. Não faça uma nova landing page e não entregue apenas uma animação. Priorize uma implementação executável, interativa e causalmente consistente. A timeline, o corpo, os órgãos e as células precisam compartilhar um único estado de simulação. Os eventos inseridos pelo usuário devem ter efeitos verificáveis, e a comparação entre cenários deve ser determinística.
>
> Use as melhores ferramentas efetivamente disponíveis no ambiente Codex para planejar, editar, executar, testar, inspecionar o navegador e revisar o trabalho. Delegue tarefas independentes a subagentes quando disponíveis, evitando edições simultâneas conflitantes. Mantenha o projeto compilável entre fases, valide a interface em navegador real e não dê a tarefa por concluída sem percorrer o fluxo principal.
>
> Este é um **simulador interativo simples em sua lógica, mas ambicioso em experiência e visualização**, e não um sistema de pesquisa médica. Não invente precisão clínica. Execute o plano por marcos verificáveis, começando pelo percurso do corpo até a célula e pela progressão dia a dia.
