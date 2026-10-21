/**
 * Texto dos capítulos da narrativa (client-safe: sem fs). Os fatos são renderizados no servidor com
 * <Fato id> e injetados pelo id listado em `factIds`.
 */
import { CHAPTERS } from './chapters';
import { VIRUS_PARTS } from './parts';

export interface ChapterCopy {
  id: string;
  /** Frase de abertura (texto livre, sem números epidemiológicos) */
  lead: string;
  /** Parágrafos complementares, sem números de dias/percentuais */
  body: string[];
  /** ids de content/facts.json exibidos com <Fato> */
  factIds: string[];
  /** Observação discreta sob o texto */
  note?: string;
}

export const CHAPTER_COPY: readonly ChapterCopy[] = [
  {
    id: 'o-que-e',
    lead: 'O H1N1 é um subtipo do vírus influenza A, o vírus da gripe. O nome vem das duas proteínas que cobrem sua superfície: a hemaglutinina (H) e a neuraminidase (N).',
    body: ['A partícula que você vê girando é um vírion: uma capa de gordura cheia de espinhos, com o material genético guardado dentro. Ela é muitíssimo menor que uma célula; nada neste explicador está em escala real.'],
    factIds: ['ms-subtipos-influenza-a-hemaglutinina-e-neuraminidase', 'nomenclatura-ah1n1pdm09'],
  },
  {
    id: 'por-dentro',
    lead: 'Desmontado, o vírus tem poucas peças. Cada uma tem um papel na infecção, e algumas são o alvo da vacina e dos remédios.',
    body: ['Passe o mouse ou toque em uma peça para ver o nome. Clique para abrir a explicação com as fontes.'],
    factIds: ['krammer-2018-genoma-oito-segmentos-rna'],
  },
  {
    id: 'como-entra',
    lead: 'Para infectar, o vírus precisa de uma porta. A hemaglutinina encontra um açúcar na superfície da célula e se encaixa nele, como uma chave na fechadura.',
    body: ['Depois do encaixe, a célula engole o vírus; lá dentro, o canal M2 ajuda a abrir a capa e os segmentos de RNA são liberados para fabricar novos vírus.'],
    factIds: ['krammer-2018-hemaglutinina-liga-acido-sialico', 'krammer-2018-hemaglutinina-entrada-neuraminidase-saida'],
    note: 'Ilustração simplificada: a célula é muito maior que o vírus e as proporções aqui não são reais.',
  },
  {
    id: 'como-se-espalha',
    lead: 'Novos vírus saem da célula e, quando a pessoa tosse, espirra ou fala, viajam em gotículas até outra pessoa.',
    body: ['A transmissão começa antes mesmo de os sintomas aparecerem, e ambientes cheios facilitam o contágio.'],
    factIds: ['transmissibilidade-adultos-24h-antes-pico-24-72h', 'oms-transmissao-rapida-em-aglomeracoes-e-regioes-tropicais', 'oms-incubacao-cerca-de-2-dias-1-a-4'],
  },
  {
    id: 'vacina',
    lead: 'A vacina ensina o corpo a produzir anticorpos que grudam na cabeça da hemaglutinina. Com a chave bloqueada, o vírus não consegue abrir a célula.',
    body: ['Como a cabeça da hemaglutinina muda um pouco a cada ano, a composição da vacina é revista periodicamente, e a vacinação é anual.'],
    factIds: ['krammer-2018-ha-e-na-alvos-principais-dos-anticorpos', 'krammer-2018-anticorpos-contra-cabeca-da-ha-neutralizam', 'krammer-2018-deriva-antigenica-afeta-cabeca-da-ha', 'ms-vacinacao-forma-mais-eficaz-prevencao'],
  },
];

/** Todos os ids de fato usados na home (capítulos + peças), sem repetição. */
export const HOME_FACT_IDS: readonly string[] = Array.from(new Set([...CHAPTER_COPY.flatMap((c) => c.factIds), ...VIRUS_PARTS.flatMap((p) => p.factIds)]));

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
    ...CHAPTER_COPY.flatMap((c) => [c.lead, ...c.body, c.note ?? '']),
    ...VIRUS_PARTS.flatMap((p) => [p.name, p.label, ...p.explanation]),
  ].filter(Boolean);
}
