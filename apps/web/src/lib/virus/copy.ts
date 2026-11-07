/**
 * Texto da home (client-safe: sem fs). Cada capítulo (ato 1–5) tem PASSOS de texto; cada passo dispara uma batida
 * da cena (ver lib/virus/choreography.ts, STEPS_PER_CHAPTER: 3·5·5·4·5, contagens fixas). Os fatos são
 * renderizados no servidor (components/home/FactCompact) e injetados pelo id listado em `factIds`.
 *
 * Regras de escrita (contrato v4 §6): ≤ 45 palavras por passo, ≤ 2 termos técnicos, função antes do nome
 * técnico ("a chave", "a tesoura"), HA/NA descritas também pela FORMA (cabeça arredondada / cabeça quadrada),
 * vacina sempre atribuída ("segundo o Ministério da Saúde"), nunca proteção absoluta; números de dias, horas,
 * percentuais e nanômetros só nos fatos (test/virus.test.ts, "sem número solto").
 */
import type { ThemeName } from '@/lib/motion/theme';
import { CHAPTERS } from './chapters';
import { VIRUS_PARTS } from './parts';

/** Momento de número (ou palavra) gigante dentro de um passo; o valor exibido vem SEMPRE do fato, nunca é digitado. */
export interface BigMoment {
  /** id em content/facts.json */
  factId: string;
  /** 'nm' extrai "N nanômetros"; 'h' extrai "N horas"; 'word' mostra `word` gigante com o fato logo abaixo */
  kind: 'nm' | 'h' | 'word';
  /** palavra gigante (kind 'word'), ex. "Todo ano." */
  word?: string;
  /** legenda curta sob o número (sem números) */
  caption?: string;
  /** mostrar a citação (em português) em vez do claim, quando o claim omite uma ressalva importante */
  preferQuote?: boolean;
}

export interface Step {
  /** 1 a 3 frases, em linguagem simples, sem números epidemiológicos (ficam nos fatos) */
  text: string;
  /** ids de content/facts.json exibidos logo abaixo do texto */
  factIds?: string[];
  /** observação discreta sob o passo */
  note?: string;
  /** tema do passo (contrato §6: `deep` só do ato 3 passo 3 ao ato 4 passo 1); padrão `paper` */
  theme?: ThemeName;
  /** passo em que o tema está mudando: texto sobre painel opaco de papel claro para a tinta nunca ficar ilegível */
  transition?: boolean;
  /** número/palavra gigante do passo */
  big?: BigMoment;
}

export interface ChapterCopy {
  id: string;
  /** Frase de abertura do capítulo (= texto do primeiro passo) */
  lead: string;
  steps: Step[];
}

/* Ato 1 · O que é */
const STEPS_O_QUE_E: Step[] = [
  {
    text: 'O vírus se aproxima, girando devagar. Este é o H1N1, um dos vírus da gripe: uma partícula minúscula, coberta de espinhos, com o material genético guardado dentro.',
    factIds: ['ms-subtipos-influenza-a-hemaglutinina-e-neuraminidase'],
    big: { factId: 'dou-2018-virus-100-nm', kind: 'nm', caption: 'forma esférica; existem também formas alongadas' },
  },
  {
    text: 'Os espinhos azuis se acendem: cabeça arredondada sobre uma haste curta. São a chave que reconhece a célula, a hemaglutinina, o "H" do nome, e de longe a peça mais numerosa da superfície.',
    factIds: ['harris-2006-contagem-ha-na', 'krammer-2018-hemaglutinina-entrada-neuraminidase-saida'],
  },
  {
    text: 'Agora os espinhos rosa: cabeça quadrada no alto de uma haste fina e longa. São a tesoura que solta os vírus novos, a neuraminidase, o "N". Bem mais raros, aparecem sozinhos ou em pequenos grupos.',
    factIds: ['harris-2006-na-em-grupos', 'krammer-2018-neuraminidase-libera-novos-virus'],
    note: 'Nada aqui está em escala real: o vírus é muitíssimo menor que uma célula.',
  },
];

/* Ato 2 · Por dentro */
const STEPS_POR_DENTRO: Step[] = [
  {
    text: 'A capa se abre em duas metades. É o envelope: uma membrana de gordura que o vírus não fabrica, mas leva da célula onde nasceu.',
    factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2'],
  },
  {
    text: 'Os espinhos se soltam e sobem: primeiro a chave, de cabeça arredondada e haste curta; depois a tesoura, de cabeça quadrada e haste longa, que por isso fica um pouco mais alta.',
    factIds: ['harris-2006-altura-ha-na-haste', 'pdb101-na-tetramero-haste-longa'],
  },
  {
    text: 'O forro colado por baixo da capa se descola: é a matriz M1, o esqueleto que dá forma ao vírus. Na capa restam os canais M2, portinholas por onde passa a acidez.',
    factIds: ['harris-2006-camada-m1-sob-envelope', 'krammer-2018-m1-arcabouco-do-virion'],
  },
  {
    text: 'No centro, oito bastões se abrem em leque. Cada um é um segmento do material genético (RNA) enrolado em proteína, de um tamanho diferente; dentro do vírus, sete ficam em volta de um central.',
    factIds: ['noda-2012-rnp-bastonetes-comprimentos', 'noda-2012-arranjo-7-mais-1'],
  },
  {
    text: 'O vírus fica desmontado, à sua espera. Passe o mouse ou toque numa peça para ver o nome; escolha uma para abrir a explicação, com as fontes.',
  },
];

/* Ato 3 · Como entra (tema `deep` do passo 3 em diante) */
const STEPS_COMO_ENTRA: Step[] = [
  {
    text: 'O vírus se monta de novo e, pela direita, chega a superfície de uma célula das vias respiratórias, cheia de receptores. Para infectar, ele precisa de uma porta.',
    note: 'Ilustração simplificada: a célula é muito maior que o vírus.',
  },
  {
    text: 'O vírus para de girar e encosta: as chaves que tocam a célula se acendem. Elas se prendem a um açúcar da superfície, o ácido siálico, como uma chave na fechadura.',
    factIds: ['dou-2018-ha-liga-acido-sialico', 'krammer-2018-hemaglutinina-liga-acido-sialico'],
  },
  {
    text: 'A membrana se dobra e fecha o vírus numa bolsa: a célula o engole. Essa bolsa se chama endossomo, e lá dentro a luz some.',
    factIds: ['dou-2018-entrada-endocitose'],
    theme: 'deep',
    transition: true,
  },
  {
    text: 'Dentro da bolsa, o ambiente fica ácido. As portinholas M2 deixam a acidez entrar, o forro se desfaz, e a chave muda de forma e funde a capa do vírus com a parede da bolsa.',
    factIds: ['dou-2018-m2-acidifica-solta-rnp-m1', 'krammer-2018-endossomo-acido-ha-fusao'],
    theme: 'deep',
  },
  {
    text: 'Os oito segmentos de RNA saem em fila rumo ao núcleo da célula. Lá o material genético do vírus é copiado, e a célula passa a fabricar vírus novos.',
    factIds: ['krammer-2018-rnps-vao-ao-nucleo'],
    theme: 'deep',
  },
];

/* Ato 4 · Como se espalha (passo 1 ainda `deep`; a luz volta quando a câmera recua, no passo 2) */
const STEPS_COMO_SE_ESPALHA: Step[] = [
  {
    text: 'Vírus novos incham na membrana da célula e brotam, cada um levando um pedaço dela como capa. A tesoura corta o açúcar que os prenderia ali e os solta.',
    factIds: ['krammer-2018-montagem-brotamento-membrana', 'dou-2018-na-corta-acido-sialico-libera'],
    theme: 'deep',
    transition: true,
  },
  {
    text: 'Afastando o olhar, a célula some e aparecem duas pessoas: tudo isso acontecia nas vias respiratórias da primeira. Quando ela tosse, espirra ou fala, os vírus saem junto.',
    factIds: ['cdc-goticulas-tosse-espirro-fala'],
    note: 'Fora de escala: vírus e gotículas aparecem enormes para dar para acompanhá-los.',
  },
  {
    text: 'Gotículas e partículas ainda menores, os aerossóis, viajam pelo ar, e o vírus pega carona até a boca da outra pessoa. Se chegam ao nariz ou à boca de alguém por perto, o ciclo recomeça.',
    factIds: ['krammer-2018-transmissao-goticulas-aerossois-fomites', 'oms-goticulas-infectam-pessoas-proximas'],
  },
  {
    text: 'A cena para com o vírus já na segunda pessoa. A transmissão pode começar antes dos sintomas, e ambientes cheios facilitam o contágio.',
    factIds: ['oms-transmissao-rapida-em-aglomeracoes-e-regioes-tropicais'],
    big: { factId: 'transmissibilidade-adultos-24h-antes-pico-24-72h', kind: 'h', caption: 'antes dos sintomas, em adultos saudáveis', preferQuote: true },
  },
];

/* Ato 5 · A vacina (tema `warm`) */
const STEPS_VACINA: Step[] = [
  {
    text: 'Chegando perto da gotícula, ela volta a ser o vírus inteiro. É o mesmo H1N1, agora chegando a uma pessoa vacinada.',
    theme: 'warm',
  },
  {
    text: 'Anticorpos em forma de Y grudam nas cabeças arredondadas da chave. A vacina prepara o corpo para produzi-los antes do encontro com o vírus.',
    factIds: ['krammer-2018-ha-e-na-alvos-principais-dos-anticorpos', 'krammer-2018-ha-principal-componente-vacinas-inativadas'],
    theme: 'warm',
  },
  {
    text: 'A membrana de uma célula aparece à direita e o vírus tenta encostar, mas não encaixa: com a chave coberta de anticorpos, ele não consegue se prender.',
    factIds: ['krammer-2018-anticorpos-contra-cabeca-da-ha-neutralizam'],
    theme: 'warm',
  },
  {
    text: 'As cabeças da chave mudam de tom e parte dos anticorpos se solta. É a deriva antigênica: o vírus acumula pequenas mudanças, sobretudo nessa cabeça, e os anticorpos antigos deixam de reconhecê-la.',
    factIds: ['krammer-2018-deriva-antigenica-afeta-cabeca-da-ha', 'krammer-2018-deriva-antigenica-vacina-anual'],
    theme: 'warm',
  },
  {
    text: 'Anticorpos novos, de outro tom, voltam a grudar. Por isso, segundo o Ministério da Saúde, a vacina é revista com frequência e a vacinação contra a gripe é anual: anticorpos novos para a cabeça nova.',
    factIds: ['ms-vacinacao-forma-mais-eficaz-prevencao'],
    theme: 'warm',
    big: { factId: 'ms-vacinacao-anual-mudanca-virus', kind: 'word', word: 'Todo ano.', caption: 'segundo o Ministério da Saúde' },
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

/** Tema de um passo (capítulo i, passo k); `paper` quando não marcado. */
export function stepTheme(chapterIndex: number, stepIndex: number): ThemeName {
  return CHAPTER_COPY[chapterIndex]?.steps[stepIndex]?.theme ?? 'paper';
}

/** Pares [capítulo, passo] com tema `deep` (contrato: do ato 3 passo 3 ao ato 4 passo 1, inclusive). */
export const DEEP_STEPS: ReadonlyArray<readonly [number, number]> = CHAPTER_COPY.flatMap((c, i) => c.steps.flatMap((s, k) => (s.theme === 'deep' ? [[i, k] as const] : [])));

/** Ids de fato dos passos (inclusive os dos momentos gigantes). */
function stepFactIds(s: Step): string[] {
  return [...(s.factIds ?? []), ...(s.big ? [s.big.factId] : [])];
}

/** Todos os ids de fato usados na home (capítulos + peças), sem repetição. */
export const HOME_FACT_IDS: readonly string[] = Array.from(new Set([...CHAPTER_COPY.flatMap((c) => c.steps.flatMap(stepFactIds)), ...VIRUS_PARTS.flatMap((p) => p.factIds)]));

/** Garantia estática: todo capítulo tem texto. */
export function copyForChapter(id: string): ChapterCopy {
  const c = CHAPTER_COPY.find((x) => x.id === id);
  if (!c) throw new Error(`Capítulo sem texto: ${id}`);
  return c;
}

/* ---------- Abertura (ato 0) ---------- */
export const OPENING = {
  /** etiqueta mono acima do título (os colchetes são decorativos) */
  tag: 'explicação visual · cada afirmação com fonte',
  /** palavra gigante em condensada */
  word: 'H1N1',
  /** restante do título (Instrument Serif) */
  titleRest: 'Pequeno demais para ver. Dá para entender.',
  /** H1 completo e acessível */
  title: 'H1N1 · Pequeno demais para ver. Dá para entender.',
  lead: 'Um dos vírus da gripe, visto de perto: o que ele é, como entra numa célula, como passa de uma pessoa para outra e como a vacina ajuda.',
  start: 'Começar',
  skip: 'Pular a animação e ler em texto',
  symptoms: 'Estou com sintomas: ver sinais de alerta',
  hint: 'Role ou deslize para começar',
  pause: 'Pausar animação',
  resume: 'Retomar animação',
  scaleLabel: 'ilustração fora de escala',
} as const;

/* ---------- Atos 6 e 7 (fora do filme) ---------- */
export interface HomeActMeta {
  index: string;
  kicker: string;
  title: string;
}
export const ACT_BRASIL: HomeActMeta = { index: '06', kicker: 'No Brasil', title: 'O que os registros oficiais mostram.' };
export const ACT_CONTINUE: HomeActMeta = { index: '07', kicker: 'Continue daqui', title: 'E agora?' };

/** Frase fixa sobre atraso dos dados (a home nunca promete imediatismo). */
export const DATA_DELAY_NOTE = 'Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.';

/** Aviso clínico fixo da home (segunda frase; a primeira é SITE.medicalDisclaimer). */
export const CLINICAL_ALERT_NOTE = { before: 'Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em ', path: '/sintomas/sinais-de-alerta/', after: '.' } as const;

/** Índice final, em ordem de necessidade; `candidates` vazio = página de aplicação sempre disponível. */
export interface HomeIndexItem {
  label: string;
  text: string;
  candidates: string[];
  href?: string;
}
export const HOME_INDEX: readonly HomeIndexItem[] = [
  { label: 'Sinais de alerta', text: 'Quando procurar atendimento, segundo a orientação oficial.', candidates: ['/sintomas/sinais-de-alerta/'] },
  { label: 'Sintomas e cuidados', text: 'O que esperar e como cuidar em casa.', candidates: ['/sintomas/'] },
  { label: 'Vacina e prevenção', text: 'O que a vacina da gripe faz e quem deve tomar.', candidates: ['/vacina/', '/prevencao/'] },
  { label: 'Como se transmite', text: 'Incubação, período de transmissão e isolamento.', candidates: ['/transmissao/'] },
  { label: 'Dados do Brasil', text: 'Séries oficiais por semana, com fonte e data da base.', candidates: [], href: '/dados/brasil/' },
  { label: 'Sala de dados', text: 'Globo, mapa por UF, tendência e composição viral.', candidates: [], href: '/sala/' },
  { label: 'Fontes e metodologia', text: 'De onde vem cada número e como é tratado.', candidates: [], href: '/dados/fontes/' },
];

/** Todos os textos livres da home (para o teste de "sem números soltos"): passos, notas, legendas, kickers, títulos, abertura e índice. */
export function allFreeText(): string[] {
  return [
    ...CHAPTERS.flatMap((c) => [c.kicker, c.title]),
    ...[ACT_BRASIL, ACT_CONTINUE].flatMap((a) => [a.kicker, a.title]),
    ...CHAPTER_COPY.flatMap((c) => [c.lead, ...c.steps.flatMap((s) => [s.text, s.note ?? '', s.big?.caption ?? '', s.big?.word ?? ''])]),
    ...VIRUS_PARTS.flatMap((p) => [p.name, p.label, ...p.explanation]),
    ...Object.values(OPENING),
    DATA_DELAY_NOTE,
    CLINICAL_ALERT_NOTE.before,
    ...HOME_INDEX.flatMap((i) => [i.label, i.text]),
  ].filter(Boolean);
}
