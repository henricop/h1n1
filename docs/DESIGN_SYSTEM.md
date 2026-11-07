# Design system da jornada

A cena 3D é o conteúdo principal. A interface explica uma ideia e oferece um próximo passo por escala. Métricas, configurações e experimentos ficam disponíveis sob demanda. A execução começa automaticamente, com pausa sempre visível.

## Fundamentos

| Uso | Valor |
| --- | --- |
| Fundo | `#f5f7f8` |
| Superfície | `#ffffff` |
| Texto principal | `#243d46` |
| Texto secundário | `#6b828b` |
| Borda | `#dce5e8` |
| Ação principal | `#197d72` |
| Atividade viral | Rosa |
| Defesa | Azul |
| Inflamação/dano | Âmbar |
| Integridade/reparo | Verde |

Tipografia de sistema, sem fonte remota. Títulos de peso regular e entrelinha curta; texto corrido com entrelinha de 1,6–1,75. A geometria, a iluminação e a cor indicam profundidade no 3D. Não há animações decorativas da interface.

## Composição

O cabeçalho mantém identidade, ajuda, configurações e reinício. A cena ocupa a maior parte da tela; uma navegação curta apresenta Corpo, Respiratório, Pulmão, Tecido e Célula. A esquerda contém uma explicação curta e a ação de aproximação. A linha do tempo fica abaixo da cena. O rodapé abriga gráficos, marcos, créditos e diagnóstico técnico.

No móvel, o texto e o canvas seguem o fluxo vertical. Seletores são nativos; os controles de câmera ficam em um grupo expansível. Não há barra lateral nem navegação lateral fixa.

O estado da pessoa simulada é uma faixa persistente, presente nas cinco escalas e também durante a exploração da anatomia completa. Ela reúne fase, resumo, sintomas ilustrativos, dois índices internos e o controle direto do ritmo viral. O painel regional explica o tecido em foco; o card de marco aparece apenas quando o estado calculado cruza um novo patamar. Esses elementos não substituem a cena 3D.

## Componentes e interação

- Botão primário verde: próximo passo didático.
- Botão discreto: ajuda, comparação e explicação contextual.
- Botões com ícones e nomes acessíveis: câmera, configurações e fechar.
- Diálogos nativos: foco contido, Escape e fechamento explícito. A leitura pausa a simulação; o fechamento retoma uma execução anteriormente ativa.
- Linha do tempo: intervalo de uma hora, rótulo com dia/hora e poucos marcadores visíveis.
- Comparação: mesmos índices de A/B no mesmo horário, diferenças e quatro curvas. Valores tabulares também disponíveis.
- Preferência de movimento: respeita o sistema e desliga órbita/pulsação; não muda a biologia calculada.
- Progresso biológico: magenta indica contato/replicação, azul defesa, âmbar dano e verde reposição. As cores também têm nome e texto. O movimento usa o tempo simulado, congelando na pausa.
- Sintomas: frases curtas e possíveis, explicitamente identificadas como hipótese narrativa do cenário. A interface não apresenta temperatura, saturação ou sintomas individuais medidos.

Textos falam de ações observáveis: “Seguir a respiração”, “Aproximar o tecido”, “Entrar em uma célula”. Evitar expor detalhes de engine no percurso principal. Seleção, índices e cores são apoiados por texto; não depender só da cor.

## Impressão e evidência

O produto é uma aplicação 3D interativa, não um relatório. Os estilos de impressão usam A4 e fundo branco, removem controles, evitam blocos cortados e mostram o painel aberto no fluxo. Para documentação portátil, mantenha as explicações essenciais no corpo do documento e use screenshots reais da cena.

Validação de tela deve incluir desktop, largura móvel de 390 px, ausência de overflow, cinco escalas, contraste dos modelos e funcionamento por teclado. Validação gráfica deve cobrir WebGPU/WebGL 2 e recursos estáveis entre trocas de escala.

## Human Atlas direction and H1N1 focus

The user's later explicit reference is Human Atlas. Macroscopic views therefore use a compact floating context panel, direct structure selection and a large anatomical viewport. The default panel is a five-region H1N1 route with calculated activity; the complete 15-system panel is opened explicitly. In mobile view the route is reached through “Regiões”. Disease timeline and experiment controls remain available below the scene. The five-scale navigator moves into the desktop header to keep it clear of the head/model.

Camera freedom is explicit: “Orbitar”, “Mover”, zoom and reframe. Manual movement is not reset by biological updates. The complete anatomy/explosion mode is secondary. This direction supersedes the earlier prohibition on any permanent contextual panel in this interactive product, while portable document/print rules remain unchanged.
