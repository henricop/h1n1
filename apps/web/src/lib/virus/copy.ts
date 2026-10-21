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

export const CHAPTER_COPY: readonly ChapterCopy[] = [
  {
    id: 'o-que-e',
    lead: 'O H1N1 é um subtipo do vírus influenza A, o vírus da gripe. A partícula que você vê girando é um vírion: uma capa de gordura cheia de espinhos, com o material genético guardado dentro.',
    steps: [
      {
        text: 'O H1N1 é um subtipo do vírus influenza A, o vírus da gripe. A partícula que você vê girando é um vírion: uma capa de gordura cheia de espinhos, com o material genético guardado dentro.',
        factIds: ['ms-subtipos-influenza-a-hemaglutinina-e-neuraminidase'],
      },
      {
        text: 'O "H" do nome é a hemaglutinina: os espinhos azuis, de longe os mais numerosos, que reconhecem a célula.',
      },
      {
        text: 'O "N" é a neuraminidase: os espinhos rosa, mais raros e mais altos, que aparecem em pequenos grupos. Ela não abre a célula; ela solta os vírus novos.',
        factIds: ['nomenclatura-ah1n1pdm09'],
        note: 'Nada neste explicador está em escala real: o vírion é muitíssimo menor que uma célula.',
      },
    ],
  },
  {
    id: 'por-dentro',
    lead: 'Desmontado, o vírus tem poucas peças. Primeiro, a capa: uma membrana de gordura que ele rouba da célula onde nasceu.',
    steps: [
      { text: 'Desmontado, o vírus tem poucas peças. Primeiro, a capa: uma membrana de gordura que ele rouba da célula onde nasceu.', factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2'] },
      { text: 'Espetados na capa ficam os espinhos: a hemaglutinina, a chave que abre a célula, e a neuraminidase, a tesoura que liberta os vírus novos.', factIds: ['krammer-2018-hemaglutinina-entrada-neuraminidase-saida'] },
      { text: 'Por baixo da capa há um forro de proteína, a matriz M1, que dá forma ao vírus. Atravessando a capa, poucos canais M2: portinholas por onde passam prótons.', factIds: ['krammer-2018-m1-arcabouco-do-virion'] },
      { text: 'No centro, o manual de instruções: o material genético vem dividido em oito segmentos de RNA, cada um embrulhado em proteína, como bastões de tamanhos diferentes.', factIds: ['krammer-2018-genoma-oito-segmentos-rna'] },
      { text: 'Passe o mouse ou toque em uma peça para ver o nome. Clique para abrir a explicação com as fontes.' },
    ],
  },
  {
    id: 'como-entra',
    lead: 'Para infectar, o vírus precisa de uma porta. Ele se monta de novo e encontra a superfície de uma célula das vias respiratórias.',
    steps: [
      { text: 'Para infectar, o vírus precisa de uma porta. Ele se monta de novo e encontra a superfície de uma célula das vias respiratórias.' },
      { text: 'A hemaglutinina acha um açúcar na membrana da célula, o ácido siálico, e se encaixa nele, como uma chave na fechadura.', factIds: ['krammer-2018-hemaglutinina-liga-acido-sialico'] },
      { text: 'Depois do encaixe, a célula engole o vírus: a membrana se dobra em volta dele e o fecha numa bolsa.' },
      { text: 'Dentro da bolsa, o ambiente fica ácido. Os canais M2 deixam entrar prótons e a capa se desfaz por dentro.', factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2'] },
      { text: 'Os oito segmentos de RNA escapam e seguem para o núcleo da célula, que passa a fabricar novos vírus.', note: 'Ilustração simplificada: a célula é muito maior que o vírus e as proporções aqui não são reais.' },
    ],
  },
  {
    id: 'como-se-espalha',
    lead: 'Os vírus novos brotam da membrana da célula, levando um pedaço dela como capa. A neuraminidase corta o açúcar que os prenderia ali.',
    steps: [
      { text: 'Os vírus novos brotam da membrana da célula, levando um pedaço dela como capa. A neuraminidase corta o açúcar que os prenderia ali.', factIds: ['krammer-2018-neuraminidase-libera-novos-virus'] },
      { text: 'Afastando o olhar: tudo isso acontece dentro de uma pessoa. Quando ela tosse, espirra ou fala, os vírus saem em gotículas.' },
      { text: 'As gotículas maiores caem perto; as menores flutuam um pouco mais. Se alcançam o nariz ou a boca de alguém, o ciclo recomeça.', factIds: ['oms-transmissao-rapida-em-aglomeracoes-e-regioes-tropicais'] },
      { text: 'A transmissão começa antes mesmo de os sintomas aparecerem, e ambientes cheios facilitam o contágio.', factIds: ['transmissibilidade-adultos-24h-antes-pico-24-72h', 'oms-incubacao-cerca-de-2-dias-1-a-4'] },
    ],
  },
  {
    id: 'vacina',
    lead: 'De perto outra vez: o mesmo vírus, agora numa pessoa vacinada.',
    steps: [
      { text: 'De perto outra vez: o mesmo vírus, agora numa pessoa vacinada.' },
      { text: 'A vacina ensinou o corpo a produzir anticorpos, que grudam na cabeça da hemaglutinina.', factIds: ['krammer-2018-ha-e-na-alvos-principais-dos-anticorpos', 'krammer-2018-anticorpos-contra-cabeca-da-ha-neutralizam'] },
      { text: 'Com a chave bloqueada, o vírus não consegue se encaixar na célula: ele encosta e não entra.' },
      { text: 'Só que a cabeça da hemaglutinina muda um pouco a cada ano, e parte dos anticorpos antigos deixa de reconhecê-la.', factIds: ['krammer-2018-deriva-antigenica-afeta-cabeca-da-ha'] },
      { text: 'Por isso a composição da vacina é revista e a vacinação é anual: anticorpos novos para a cabeça nova.', factIds: ['ms-vacinacao-forma-mais-eficaz-prevencao'] },
    ],
  },
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
