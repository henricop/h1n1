/**
 * Texto dos capítulos da narrativa (client-safe: sem fs). Cada capítulo tem PASSOS de texto; cada passo
 * dispara uma batida da cena (ver lib/virus/choreography.ts, STEPS_PER_CHAPTER). Os fatos são renderizados
 * no servidor com <Fato id> e injetados pelo id listado em `factIds`.
 */
import { CHAPTERS } from './chapters';
import { VIRUS_PARTS } from './parts';

export interface Step {
  /** 1 a 3 frases, em linguagem simples, sem números epidemiológicos (ficam nos fatos) */
  text: string;
  /** ids de content/facts.json exibidos com <Fato> logo abaixo do texto */
  factIds?: string[];
  /** observação discreta sob o passo */
  note?: string;
}

export interface ChapterCopy {
  id: string;
  /** Frase de abertura do capítulo (= texto do primeiro passo) */
  lead: string;
  steps: Step[];
}

/*
 * Regra de escrita: a 1.ª frase de cada passo nomeia o que a cena faz naquele instante (beat sheet em
 * docs/explicador-3d-v2.md); 1 a 3 frases curtas; números de dias/horas/%/nm só nos fatos. `lead` = 1.º passo.
 */
const STEPS_O_QUE_E: Step[] = [
  {
    text: 'O vírus se aproxima, girando devagar. Este é o H1N1, um subtipo do influenza A, o vírus da gripe: uma partícula minúscula, coberta de espinhos, com o material genético guardado dentro.',
    factIds: ['ms-subtipos-influenza-a-hemaglutinina-e-neuraminidase', 'dou-2018-virus-100-nm'],
  },
  {
    text: 'Os espinhos azuis se acendem: são a hemaglutinina, o "H" do nome. Ela é, de longe, a mais numerosa da superfície, e é a peça que reconhece a célula.',
    factIds: ['harris-2006-contagem-ha-na', 'krammer-2018-hemaglutinina-entrada-neuraminidase-saida'],
  },
  {
    text: 'Agora se acendem os espinhos rosa: a neuraminidase, o "N". São bem mais raros e aparecem sozinhos ou em pequenos grupos entre os azuis. Ela não abre a célula: solta os vírus novos.',
    factIds: ['harris-2006-na-em-grupos', 'krammer-2018-neuraminidase-libera-novos-virus'],
    note: 'Nada neste explicador está em escala real: o vírion é muitíssimo menor que uma célula.',
  },
];

const STEPS_POR_DENTRO: Step[] = [
  {
    text: 'A capa se abre em duas metades. É o envelope: uma membrana de gordura que o vírus não fabrica, mas leva da célula onde nasceu.',
    factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2'],
  },
  {
    text: 'Os espinhos se soltam: a hemaglutinina sobe e, logo depois, a neuraminidase sobe mais alto. Repare nas formas: a HA tem a cabeça sobre uma haste curta; a NA, uma cabeça quadrada no alto de uma haste longa e fina.',
    factIds: ['harris-2006-altura-ha-na-haste', 'pdb101-na-tetramero-haste-longa'],
  },
  {
    text: 'O forro que estava colado por baixo da capa se descola: é a matriz M1, que dá forma ao vírus. Na capa, destacam-se os canais M2, portinholas por onde passam prótons.',
    factIds: ['harris-2006-camada-m1-sob-envelope', 'krammer-2018-m1-arcabouco-do-virion'],
  },
  {
    text: 'No centro, oito bastões se abrem em leque, um a um, e os nomes das peças aparecem. Cada bastão é um segmento do material genético (RNA) enrolado em proteína, cada um de um tamanho; dentro do vírus, sete ficam em volta de um central.',
    factIds: ['noda-2012-rnp-bastonetes-comprimentos', 'noda-2012-arranjo-7-mais-1'],
  },
  {
    text: 'O vírus fica desmontado, à sua espera. Passe o mouse ou toque numa peça para ver o nome; clique para abrir a explicação, com as fontes.',
  },
];

const STEPS_COMO_ENTRA: Step[] = [
  {
    text: 'O vírus se monta de novo enquanto, pela direita, chega a superfície de uma célula das vias respiratórias, cheia de receptores. Para infectar, ele precisa de uma porta.',
    note: 'Ilustração simplificada: a célula é muito maior que o vírus e as proporções aqui não são reais.',
  },
  {
    text: 'O vírus desliza, para de girar e encosta: as hemaglutininas que tocam a célula se acendem. Elas se prendem a um açúcar da superfície, o ácido siálico, como uma chave na fechadura.',
    factIds: ['dou-2018-ha-liga-acido-sialico', 'krammer-2018-hemaglutinina-liga-acido-sialico'],
  },
  {
    text: 'A membrana se dobra e fecha o vírus numa bolsa: a célula o engole. Essa bolsa se chama endossomo.',
    factIds: ['dou-2018-entrada-endocitose'],
  },
  {
    text: 'Dentro da bolsa, o ambiente fica ácido: os canais M2 piscam, deixam a acidez entrar no vírus, e o forro de M1 se desfaz e solta o material genético. A acidez também muda a forma da hemaglutinina, que funde a capa do vírus com a parede da bolsa.',
    factIds: ['dou-2018-m2-acidifica-solta-rnp-m1', 'krammer-2018-endossomo-acido-ha-fusao'],
  },
  {
    text: 'Os oito segmentos de RNA saem em fila rumo ao núcleo da célula. Lá, o material genético do vírus é copiado, e a célula passa a fabricar vírus novos.',
    factIds: ['krammer-2018-rnps-vao-ao-nucleo'],
  },
];

const STEPS_COMO_SE_ESPALHA: Step[] = [
  {
    text: 'Vírus novos incham na membrana da célula e brotam, cada um levando um pedaço dela como capa. A neuraminidase corta o açúcar que os prenderia ali e os solta.',
    factIds: ['krammer-2018-montagem-brotamento-membrana', 'dou-2018-na-corta-acido-sialico-libera'],
  },
  {
    text: 'Afastando o olhar, a célula some e aparecem duas pessoas: tudo aquilo acontecia nas vias respiratórias da primeira. Quando ela tosse, espirra ou fala, os vírus saem junto.',
    factIds: ['cdc-goticulas-tosse-espirro-fala'],
    note: 'Fora de escala: o vírus e as gotículas aparecem enormes para que dê para acompanhá-los.',
  },
  {
    text: 'Gotículas e partículas ainda menores, os aerossóis, viajam pelo ar, e o vírus pega carona numa delas até a boca da outra pessoa. Se chegam ao nariz ou à boca de alguém por perto, o ciclo recomeça.',
    factIds: ['krammer-2018-transmissao-goticulas-aerossois-fomites', 'oms-goticulas-infectam-pessoas-proximas'],
  },
  {
    text: 'A cena para com o vírus já na segunda pessoa. Vale lembrar: a transmissão pode começar antes mesmo de os sintomas aparecerem, e ambientes cheios facilitam o contágio.',
    factIds: ['transmissibilidade-adultos-24h-antes-pico-24-72h', 'oms-transmissao-rapida-em-aglomeracoes-e-regioes-tropicais'],
  },
];

const STEPS_VACINA: Step[] = [
  {
    text: 'Chegando perto da gotícula, ela volta a ser o vírus inteiro. É o mesmo H1N1, agora chegando a uma pessoa vacinada.',
  },
  {
    text: 'Anticorpos em forma de Y grudam nas cabeças da hemaglutinina. A vacina ensinou o corpo a produzi-los antes do encontro com o vírus.',
    factIds: ['krammer-2018-ha-e-na-alvos-principais-dos-anticorpos', 'krammer-2018-ha-principal-componente-vacinas-inativadas'],
  },
  {
    text: 'A membrana de uma célula aparece à direita, e o vírus tenta encostar, mas não encaixa. Com a chave coberta de anticorpos, ele não consegue se prender.',
    factIds: ['krammer-2018-anticorpos-contra-cabeca-da-ha-neutralizam'],
  },
  {
    text: 'As cabeças da hemaglutinina mudam de tom e parte dos anticorpos se solta. É a deriva antigênica: o vírus acumula pequenas mudanças, sobretudo nessa cabeça, e os anticorpos antigos deixam de reconhecê-la.',
    factIds: ['krammer-2018-deriva-antigenica-afeta-cabeca-da-ha', 'krammer-2018-deriva-antigenica-vacina-anual'],
  },
  {
    text: 'Anticorpos novos, de outro tom, voltam a grudar. Por isso a vacina é revista com frequência e a vacinação contra a gripe é anual: anticorpos novos para a cabeça nova.',
    factIds: ['ms-vacinacao-anual-mudanca-virus', 'ms-vacinacao-forma-mais-eficaz-prevencao'],
  },
];

function chapter(id: string, steps: Step[]): ChapterCopy {
  return { id, lead: steps[0]!.text, steps };
}

export const CHAPTER_COPY: readonly ChapterCopy[] = [
  chapter('o-que-e', STEPS_O_QUE_E),
  chapter('por-dentro', STEPS_POR_DENTRO),
  chapter('como-entra', STEPS_COMO_ENTRA),
  chapter('como-se-espalha', STEPS_COMO_SE_ESPALHA),
  chapter('vacina', STEPS_VACINA),
];

/** Todos os ids de fato usados na home (capítulos + peças), sem repetição. */
export const HOME_FACT_IDS: readonly string[] = Array.from(new Set([...CHAPTER_COPY.flatMap((c) => c.steps.flatMap((s) => s.factIds ?? [])), ...VIRUS_PARTS.flatMap((p) => p.factIds)]));

/** Garantia estática: todo capítulo tem texto. */
export function copyForChapter(id: string): ChapterCopy {
  const c = CHAPTER_COPY.find((x) => x.id === id);
  if (!c) throw new Error(`Capítulo sem texto: ${id}`);
  return c;
}

/** Todos os textos livres (para o teste de "sem números soltos"). */
export function allFreeText(): string[] {
  return [
    ...CHAPTERS.map((c) => c.title),
    ...CHAPTER_COPY.flatMap((c) => [c.lead, ...c.steps.flatMap((s) => [s.text, s.note ?? ''])]),
    ...VIRUS_PARTS.flatMap((p) => [p.name, p.label, ...p.explanation]),
  ].filter(Boolean);
}
