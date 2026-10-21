export interface GlossaryTerm {
  term: string;
  short: string;
  definition: string;
}

/** Termos do glossário usados por <Glossario termo="..."/>. Chaves normalizadas em minúsculas. */
export const GLOSSARY: Readonly<Record<string, GlossaryTerm>> = {
  'a(h1n1)pdm09': {
    term: 'A(H1N1)pdm09',
    short: 'subtipo do vírus influenza A que causou a pandemia de 2009 e circula sazonalmente desde então',
    definition:
      'Subtipo do vírus influenza A identificado em 2009 ("pdm09" indica a linhagem pandêmica de 2009). Desde 2010 circula como um dos vírus da gripe sazonal e está incluído na vacina anual contra influenza.',
  },
  h1n1: {
    term: 'H1N1',
    short: 'forma abreviada de A(H1N1)pdm09, o subtipo de influenza A de origem pandêmica em 2009',
    definition:
      'Nome popular do subtipo A(H1N1)pdm09 do vírus influenza A. "H" e "N" referem-se às proteínas de superfície hemaglutinina e neuraminidase. Neste site, "H1N1" significa sempre A(H1N1)pdm09, salvo indicação contrária.',
  },
  'influenza a': {
    term: 'influenza A',
    short: 'tipo de vírus da gripe que inclui vários subtipos, como H1N1 e H3N2',
    definition:
      'Um dos tipos de vírus influenza que infectam humanos. Inclui subtipos como A(H1N1)pdm09 e A(H3N2). Um resultado "influenza A" sem subtipagem não confirma H1N1.',
  },
  srag: {
    term: 'SRAG',
    short: 'síndrome respiratória aguda grave: quadro gripal com dificuldade para respirar que leva à internação',
    definition:
      'Síndrome Respiratória Aguda Grave: síndrome gripal acompanhada de dispneia, desconforto respiratório, saturação de oxigênio igual ou inferior a 94% em ar ambiente ou piora de doença de base, conforme o Guia de Vigilância em Saúde do Ministério da Saúde, geralmente com hospitalização. No Brasil é notificada no SIVEP-Gripe; os registros representam casos graves, não todas as infecções.',
  },
  'síndrome gripal': {
    term: 'síndrome gripal',
    short: 'quadro de febre com tosse ou dor de garganta e outros sintomas, sem confirmar o vírus causador',
    definition:
      'Definição clínica usada pela vigilância: febre (mesmo referida) acompanhada de tosse ou dor de garganta e pelo menos um outro sintoma, como dor de cabeça, dores musculares ou articulares. Não identifica o vírus; pode ser causada por influenza, SARS-CoV-2, VSR e outros.',
  },
  'sindrome gripal': {
    term: 'síndrome gripal',
    short: 'quadro de febre com tosse ou dor de garganta e outros sintomas, sem confirmar o vírus causador',
    definition:
      'Definição clínica usada pela vigilância: febre (mesmo referida) acompanhada de tosse ou dor de garganta e pelo menos um outro sintoma. Não identifica o vírus causador.',
  },
  'sivep-gripe': {
    term: 'SIVEP-Gripe',
    short: 'sistema do Ministério da Saúde que registra notificações de SRAG hospitalizada e óbitos por SRAG',
    definition:
      'Sistema de Informação de Vigilância Epidemiológica da Gripe, do Ministério da Saúde. Registra casos de SRAG hospitalizados e óbitos por SRAG com resultados laboratoriais, incluindo subtipagem de influenza por RT-PCR.',
  },
  flunet: {
    term: 'FluNet',
    short: 'plataforma da OMS com detecções laboratoriais de influenza reportadas por países',
    definition:
      'Plataforma global da Organização Mundial da Saúde que reúne, por semana, o número de amostras processadas e de detecções de influenza por tipo e subtipo, reportadas por laboratórios de referência. Detecções não são incidência populacional.',
  },
  'semana epidemiológica': {
    term: 'semana epidemiológica',
    short: 'unidade de tempo padronizada da vigilância em saúde, de domingo a sábado',
    definition:
      'Divisão padronizada do ano em semanas (de domingo a sábado) usada pela vigilância epidemiológica brasileira. A primeira semana do ano é a que contém pelo menos quatro dias de janeiro.',
  },
};

// (termos adicionais usados pelo conteúdo editorial)
Object.assign(GLOSSARY as Record<string, GlossaryTerm>, {
  subtipo: {
    term: 'subtipo',
    short: 'variante do vírus influenza A definida pelas proteínas de superfície H e N, como H1N1 e H3N2',
    definition:
      'Classificação dos vírus influenza A pelas combinações das proteínas hemaglutinina (H) e neuraminidase (N). H1N1 e H3N2 são subtipos que circulam em humanos. Influenza B não é dividida em subtipos, e sim em linhagens.',
  },
  'rt-pcr': {
    term: 'RT-PCR',
    short: 'exame laboratorial que detecta o material genético do vírus e permite identificar o subtipo',
    definition:
      'Reação em cadeia da polimerase com transcrição reversa: exame de laboratório que detecta o RNA do vírus em uma amostra respiratória. É o método que permite confirmar influenza A e identificar o subtipo, como A(H1N1)pdm09.',
  },
  'gripe sazonal': {
    term: 'gripe sazonal',
    short: 'gripe causada pelos vírus influenza que circulam todos os anos, com pico em meses mais frios',
    definition:
      'Doença respiratória causada pelos vírus influenza que circulam anualmente (A(H1N1)pdm09, A(H3N2) e influenza B). No Brasil, a circulação costuma aumentar entre o outono e o inverno; a vacina anual é atualizada para esses vírus.',
  },
  pandemia: {
    term: 'pandemia',
    short: 'epidemia que se espalha por vários países e continentes',
    definition:
      'Epidemia de grande extensão geográfica, com transmissão sustentada em múltiplos países. A OMS declarou pandemia de influenza A(H1N1) em junho de 2009 e o fim da fase pandêmica em agosto de 2010.',
  },
  'grupo de risco': {
    term: 'grupo de risco',
    short: 'pessoas com maior chance de complicações pela gripe, segundo o Ministério da Saúde',
    definition:
      'Conjunto de pessoas com maior probabilidade de evoluir para formas graves da gripe, como crianças pequenas, gestantes, idosos, pessoas com doenças crônicas ou imunossupressão. A definição oficial é do Ministério da Saúde e orienta vacinação e tratamento.',
  },
});

export function getGlossaryTerm(key: string): GlossaryTerm | undefined {
  return GLOSSARY[key.trim().toLowerCase()];
}
