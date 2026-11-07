import type { AnatomyEntry, AnatomyLevel, RegionId } from './types';
export const ANATOMY: AnatomyEntry[] = [
  { regionId: 'nasal', name: 'Mucosa nasal e nasofaringe', shortName: 'Mucosa nasal', bodyAnchor: { x: 0, y: 4.76, z: .71 }, organAnchor: { x: 0, y: 1.2, z: 0 }, tissueSceneId: 'nasal-epithelium', connections: ['trachea'], description: 'A superfície respiratória que recebe o primeiro contato neste modelo.' },
  { regionId: 'trachea', name: 'Traqueia', shortName: 'Traqueia', bodyAnchor: { x: 0, y: 3.85, z: .22 }, organAnchor: { x: 0, y: .8, z: 0 }, tissueSceneId: 'tracheal-epithelium', connections: ['nasal', 'bronchi'], description: 'Uma via revestida por tecido epitelial, conectando a entrada aos brônquios.' },
  { regionId: 'bronchi', name: 'Brônquios', shortName: 'Brônquios', bodyAnchor: { x: -.55, y: 3.2, z: .32 }, organAnchor: { x: -.6, y: .35, z: .2 }, tissueSceneId: 'bronchial-epithelium', connections: ['trachea', 'bronchioles'], description: 'Ramificações que distribuem a atividade entre as regiões respiratórias.' },
  { regionId: 'bronchioles', name: 'Bronquíolos', shortName: 'Bronquíolos', bodyAnchor: { x: -.9, y: 2.6, z: .34 }, organAnchor: { x: -.7, y: -.4, z: .2 }, tissueSceneId: 'bronchiolar-epithelium', connections: ['bronchi', 'alveoli'], description: 'Ramos finos que levam às regiões alveolares representativas.' },
  { regionId: 'alveoli', name: 'Região alveolar', shortName: 'Alvéolos', bodyAnchor: { x: -1.05, y: 2.1, z: .4 }, organAnchor: { x: -.6, y: -.85, z: .45 }, tissueSceneId: 'alveolar-epithelium', connections: ['bronchioles'], description: 'Unidades pulmonares ilustrativas; o envolvimento depende da trajetória calculada.' },
];
export const LEVELS: { id: AnatomyLevel; name: string; caption: string }[] = [
  { id: 'body', name: 'Corpo', caption: 'O organismo inteiro' }, { id: 'respiratory', name: 'Respiratório', caption: 'As vias de entrada' },
  { id: 'organ', name: 'Pulmão', caption: 'Brônquios e alvéolos' }, { id: 'tissue', name: 'Tecido', caption: 'A superfície respiratória' }, { id: 'cell', name: 'Célula', caption: 'Por dentro da infecção' },
];
export const anatomyRegion = (id: RegionId) => ANATOMY.find((entry) => entry.regionId === id)!;
