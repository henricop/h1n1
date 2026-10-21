/**
 * As peças do vírion e seus textos. Todo fato biológico vem de content/facts.json (ids em `factIds`);
 * o texto livre aqui só contextualiza, sem números de dias/percentuais (ver test/virus.test.ts).
 */
export type PartId = 'ha' | 'na' | 'rna' | 'envelope' | 'm1' | 'm2';

export interface VirusPart {
  id: PartId;
  /** Nome curto para chips e lista */
  name: string;
  /** Rótulo completo mostrado sobre a peça */
  label: string;
  /** Cor (token do tema) */
  color: 'primary' | 'h1n1' | 'infb' | 'muted';
  /** 3 a 5 frases em linguagem simples */
  explanation: string[];
  /** ids de content/facts.json renderizados com <Fato> no painel */
  factIds: string[];
}

/** Cores hexadecimais dos tokens de globals.css usadas nos materiais 3D e no pôster. */
export const PART_COLORS = {
  primary: '#2451d6',
  primaryDeep: '#1e3fae',
  h1n1: '#d6007f',
  h3: '#6d5df6',
  infb: '#0f9f93',
  ok: '#157f4c',
  envelope: '#cfd9e8',
  envelopeEdge: '#b7c3d6',
  m1: '#c3cddc',
  m2: '#8a94a6',
  cell: '#eef3ff',
  cellEdge: '#dbe5ff',
  droplet: '#9db5f5',
  person: '#c7d0de',
  ink: '#0b1220',
} as const;

export const VIRUS_PARTS: readonly VirusPart[] = [
  {
    id: 'ha',
    name: 'Hemaglutinina (H)',
    label: 'Hemaglutinina (o H): a chave que abre a célula',
    color: 'primary',
    explanation: [
      'A hemaglutinina é a proteína mais numerosa na superfície do vírus: cada espinho azul é um trio dela, com uma haste e uma cabeça.',
      'É a cabeça que reconhece e se prende a um açúcar (o ácido siálico) presente na superfície das células das vias respiratórias.',
      'Esse encaixe é o primeiro passo da infecção: sem ele, o vírus não entra.',
      'O "H1" do nome H1N1 identifica o tipo de hemaglutinina deste subtipo.',
    ],
    factIds: ['krammer-2018-hemaglutinina-entrada-neuraminidase-saida', 'krammer-2018-hemaglutinina-liga-acido-sialico'],
  },
  {
    id: 'na',
    name: 'Neuraminidase (N)',
    label: 'Neuraminidase (o N): a tesoura que libera novos vírus',
    color: 'h1n1',
    explanation: [
      'A neuraminidase é a segunda proteína da superfície, menos numerosa, com uma cabeça achatada em forma de cogumelo.',
      'Ela funciona como uma tesoura: corta o açúcar ao qual a hemaglutinina se prende.',
      'Sem esse corte, os vírus recém-formados ficariam grudados na célula que os produziu e uns nos outros.',
      'O "N1" do nome identifica o tipo de neuraminidase deste subtipo.',
    ],
    factIds: ['krammer-2018-neuraminidase-libera-novos-virus'],
  },
  {
    id: 'rna',
    name: '8 segmentos de RNA',
    label: '8 segmentos de RNA: o manual de instruções do vírus, em 8 partes',
    color: 'infb',
    explanation: [
      'O material genético do influenza A não é uma molécula única: vem dividido em oito segmentos de RNA, cada um embrulhado por proteínas virais.',
      'Cada segmento carrega a receita de uma ou mais proteínas do vírus, inclusive da hemaglutinina e da neuraminidase.',
      'Por ser segmentado, dois vírus influenza que infectam a mesma célula podem trocar segmentos entre si (rearranjo); o vírus de 2009 trazia uma combinação de genes nunca vista antes.',
    ],
    factIds: ['krammer-2018-genoma-oito-segmentos-rna', 'krammer-2018-genoma-segmentado-permite-rearranjo', 'cdc-designacao-ah1n1pdm09'],
  },
  {
    id: 'envelope',
    name: 'Envelope',
    label: 'Envelope: a capa que ele rouba da célula',
    color: 'muted',
    explanation: [
      'O vírus é envolto por uma membrana de gordura que não é fabricada por ele: é um pedaço da membrana da célula infectada, levado quando o novo vírus brota.',
      'Nessa capa ficam espetadas a hemaglutinina, a neuraminidase e o canal M2.',
      'Essa capa é a parte mais exposta do vírus fora do corpo; as medidas gerais de prevenção recomendadas pelo Ministério da Saúde, como a higiene das mãos, estão na fonte abaixo.',
    ],
    factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2', 'ms-medidas-gerais-comprovadamente-eficazes'],
  },
  {
    id: 'm1',
    name: 'Matriz (M1)',
    label: 'Matriz M1: o esqueleto por baixo da capa',
    color: 'muted',
    explanation: [
      'Logo abaixo do envelope há uma camada de proteína M1 que dá forma e sustentação à partícula.',
      'Ela também ajuda a organizar os segmentos de RNA na hora de montar novos vírus dentro da célula.',
      'Na ilustração, é a esfera fosca que aparece quando as duas metades da capa se afastam.',
    ],
    factIds: ['krammer-2018-m1-arcabouco-do-virion'],
  },
  {
    id: 'm2',
    name: 'Canal M2',
    label: 'Canal M2: a portinhola que ajuda a abrir o pacote',
    color: 'muted',
    explanation: [
      'Espalhados pela capa há poucos canais M2, pequenos túneis que deixam passar prótons.',
      'Dentro da célula, eles ajudam o vírus a se "desembrulhar" e soltar o RNA; sem isso, a infecção não avança.',
      'Na ilustração, são os pequenos cilindros cinza espetados na capa, bem menos numerosos que os espinhos.',
    ],
    factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2'],
  },
];

export const PART_BY_ID: ReadonlyMap<PartId, VirusPart> = new Map(VIRUS_PARTS.map((p) => [p.id, p]));

export function partIndex(id: PartId): number {
  return VIRUS_PARTS.findIndex((p) => p.id === id);
}

export function nextPart(id: PartId, dir: 1 | -1): PartId {
  const i = partIndex(id);
  const n = VIRUS_PARTS.length;
  return VIRUS_PARTS[(i + dir + n) % n]!.id;
}
