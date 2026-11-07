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
  /** 2 a 5 frases em linguagem simples */
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
  /** silhuetas: cinza quente entre `line` (#dcd7cb) e `line-strong` do papel v3 */
  person: '#c6c1b6',
  /** tinta v3 (#14130f) */
  ink: '#14130f',
} as const;

export const VIRUS_PARTS: readonly VirusPart[] = [
  {
    id: 'ha',
    name: 'Hemaglutinina (H)',
    label: 'Hemaglutinina (o H): a chave que abre a célula',
    color: 'primary',
    explanation: [
      'A hemaglutinina é, de longe, a proteína mais numerosa da superfície do vírus: há várias delas para cada neuraminidase.',
      'Cada espinho azul tem uma cabeça larga, de seção triangular, apoiada numa haste curta.',
      'É a cabeça que reconhece e se prende a um açúcar das células das vias respiratórias, o ácido siálico: esse encaixe é o primeiro passo para o vírus entrar.',
      'Essa mesma cabeça é o principal alvo dos anticorpos que bloqueiam o vírus.',
      'O "H1" do nome H1N1 identifica o tipo de hemaglutinina deste subtipo.',
    ],
    factIds: ['harris-2006-contagem-ha-na', 'harris-2006-ha-trimero-na-tetramero', 'krammer-2018-hemaglutinina-liga-acido-sialico', 'krammer-2018-anticorpos-contra-cabeca-da-ha-neutralizam'],
  },
  {
    id: 'na',
    name: 'Neuraminidase (N)',
    label: 'Neuraminidase (o N): a tesoura que libera novos vírus',
    color: 'h1n1',
    explanation: [
      'A neuraminidase é a segunda proteína da superfície, bem menos numerosa que a hemaglutinina; aparece sozinha entre elas ou em pequenos grupos.',
      'Tem uma cabeça quadrada, de quatro partes iguais, no alto de uma haste longa e fina, e por isso fica um pouco acima dos espinhos azuis.',
      'Ela funciona como uma tesoura: corta o ácido siálico, o açúcar ao qual a hemaglutinina se prende.',
      'Sem esse corte, os vírus recém-formados tenderiam a ficar presos à célula que os produziu.',
      'O "N1" do nome identifica o tipo de neuraminidase deste subtipo.',
    ],
    factIds: ['krammer-2018-neuraminidase-libera-novos-virus', 'harris-2006-na-em-grupos', 'pdb101-na-tetramero-haste-longa', 'harris-2006-altura-ha-na-haste'],
  },
  {
    id: 'rna',
    name: '8 segmentos de RNA',
    label: '8 segmentos de RNA: o manual de instruções do vírus, em 8 partes',
    color: 'infb',
    explanation: [
      'O material genético do influenza A vem dividido em oito segmentos de RNA, cada um enrolado em proteínas do vírus: são as ribonucleoproteínas (RNPs).',
      'Cada segmento forma um bastonete de comprimento diferente; dentro do vírus, sete ficam em volta de um central.',
      'Numa das pontas de cada bastonete fica presa a polimerase, a enzima do vírus que copia esse RNA dentro da célula.',
      'Por ser segmentado, dois vírus influenza que infectam a mesma célula podem trocar segmentos entre si (rearranjo); o vírus de 2009 trazia uma combinação de genes nunca vista antes.',
    ],
    factIds: ['krammer-2018-genoma-oito-segmentos-rna', 'noda-2012-arranjo-7-mais-1', 'harris-2006-polimerase-na-ponta-da-rnp', 'krammer-2018-genoma-segmentado-permite-rearranjo', 'cdc-designacao-ah1n1pdm09'],
  },
  {
    id: 'envelope',
    name: 'Envelope',
    label: 'Envelope: a capa que ele rouba da célula',
    color: 'muted',
    explanation: [
      'O vírus é envolto por uma membrana de gordura que ele não fabrica: é um pedaço da membrana da célula infectada, levado quando o vírus novo brota.',
      'Nessa capa ficam espetadas a hemaglutinina, a neuraminidase e o canal M2.',
      'A partícula é minúscula e nem sempre redonda: pode ser arredondada, oval ou alongada como um filamento.',
      'Além da vacina, o Ministério da Saúde recomenda medidas gerais de prevenção contra doenças respiratórias, descritas na fonte abaixo.',
    ],
    factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2', 'krammer-2018-montagem-brotamento-membrana', 'noda-2012-diametro-80-120nm-filamentoso', 'ms-medidas-gerais-comprovadamente-eficazes'],
  },
  {
    id: 'm1',
    name: 'Matriz (M1)',
    label: 'Matriz M1: o esqueleto por baixo da capa',
    color: 'muted',
    explanation: [
      'Logo abaixo da capa há um forro fino de proteína M1, uma camada única colada por dentro da membrana.',
      'Acredita-se que esse forro sirva de arcabouço para a partícula e ajude a guiar os segmentos de RNA dentro da célula.',
      'Quando o vírus já foi engolido e seu interior fica ácido, o material genético se solta da M1 e fica livre para seguir viagem.',
      'Na ilustração, é a casca fosca que aparece logo por baixo quando as duas metades da capa se afastam.',
    ],
    factIds: ['harris-2006-camada-m1-sob-envelope', 'krammer-2018-m1-arcabouco-do-virion', 'dou-2018-m2-acidifica-solta-rnp-m1'],
  },
  {
    id: 'm2',
    name: 'Canal M2',
    label: 'Canal M2: a portinhola que ajuda a abrir o pacote',
    color: 'muted',
    explanation: [
      'Atravessando a capa há canais M2, pequenos túneis que deixam passar prótons.',
      'Quando a célula engole o vírus e a bolsa em volta dele fica ácida, os canais M2 levam essa acidez para dentro, e o material genético se solta do forro de M1.',
      'O M2 é necessário nas duas pontas da infecção: na entrada do vírus na célula e na saída dos vírus novos.',
      'Na ilustração, são poucos cilindros cinza espetados na capa, bem menos numerosos que os espinhos.',
    ],
    factIds: ['krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2', 'dou-2018-m2-acidifica-solta-rnp-m1'],
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
