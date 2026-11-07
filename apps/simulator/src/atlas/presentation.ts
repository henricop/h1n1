import type { SystemId, Part } from './anatomy';
import type { RegionId } from '../journey/types';

export const SYSTEM_LABELS: Record<SystemId, string> = {
  skeletal: 'Esqueleto', muscular: 'Músculos', cardiac: 'Coração', sensory: 'Órgãos sensoriais', arterial: 'Artérias', venous: 'Veias', nervous: 'Sistema nervoso', respiratory: 'Respiratório', digestive: 'Digestório', urinary: 'Urinário', lymphatic: 'Linfático', endocrine: 'Endócrino', reproductive: 'Reprodutor', integumentary: 'Superfície corporal', connective: 'Tecido conjuntivo',
};
const NAMES: Record<string, string> = {heart:'Coração',brain:'Cérebro',liver:'Fígado',stomach:'Estômago',spleen:'Baço',pancreas:'Pâncreas',trachea:'Traqueia',larynx:'Laringe',pharynx:'Faringe',diaphragm:'Diafragma',lung:'Pulmão',lungs:'Pulmões','right lung':'Pulmão direito','left lung':'Pulmão esquerdo','respiratory system':'Sistema respiratório','urinary bladder':'Bexiga','right main bronchus':'Brônquio principal direito','left main bronchus':'Brônquio principal esquerdo'};
export function displayName(name: string): string { return NAMES[name.toLowerCase()] ?? name; }
export function normalizeName(name: string) { return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
export function matchesConcept(name:string,id:string,query:string) { const term=normalizeName(query);return normalizeName(name).includes(term)||normalizeName(displayName(name)).includes(term)||id.toLowerCase().includes(term); }
export function regionForPart(part: Pick<Part,'name'|'system'>): RegionId | null {
  if (part.system !== 'respiratory') return null;
  const n=part.name.toLowerCase();
  if (/nasal|nose|pharyn/.test(n)) return 'nasal';
  if (/trachea|laryn/.test(n)) return 'trachea';
  if (/bronchial tree|bronchiole/.test(n)) return 'bronchioles';
  return 'bronchi';
}
export const SYSTEM_CONTEXT: Record<SystemId,string> = {
 skeletal:'Estruturas de sustentação e proteção. Oculte os músculos para observar os ossos e suas relações.',
 muscular:'Músculos e seus pontos de inserção. Sua visibilidade ajuda a revelar as camadas mais profundas.',
 cardiac:'O coração ocupa o tórax entre os pulmões. Neste experimento, o modelo de infecção acompanha as vias respiratórias.',
 sensory:'Estruturas relacionadas aos sentidos, identificadas pela anatomia de origem.',
 arterial:'Vasos que conduzem sangue para fora do coração. As cores são convenções desta visualização.',
 venous:'Vasos de retorno ao coração. Ative e oculte camadas para acompanhar seus trajetos.',
 nervous:'Cérebro, medula e nervos representados nesta anatomia de referência.',
 respiratory:'Selecione uma via ou um segmento pulmonar, isole a estrutura e entre no tecido para observar a infecção no mesmo instante da simulação.',
 digestive:'Órgãos e estruturas do aparelho digestório, no contexto das demais estruturas do tronco.',
 urinary:'Rins e vias urinárias representados na anatomia de referência.',
 lymphatic:'Estruturas linfáticas disponíveis neste conjunto. A quantidade de peças não representa a complexidade biológica do sistema.',
 endocrine:'Órgãos endócrinos identificados no conjunto de referência.',
 reproductive:'Estruturas do aparelho reprodutor da referência masculina adulta.',
 integumentary:'Superfície externa usada como referência de posição. Desative esta camada para explorar os sistemas internos.',
 connective:'Cartilagens, ligamentos e outros tecidos de sustentação disponíveis no atlas.',
};
