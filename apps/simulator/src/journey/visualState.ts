import { anatomyRegion } from './anatomy';
import { localized } from '../i18n';
import type { CellStatus, JourneyCell, JourneySnapshot, RegionId, RegionState } from './types';

export type VisualPhase = 'quiet' | 'contact' | 'entry' | 'replication' | 'defense' | 'damage' | 'repair' | 'controlled';
export const PHASE_COLORS: Record<VisualPhase,string> = {quiet:'#9aaeb1',contact:'#d36a9b',entry:'#c7467b',replication:'#c33264',defense:'#458fcd',damage:'#d49a46',repair:'#3a9c80',controlled:'#4e9e91'};
export const PHASE_NAMES: Record<VisualPhase,string> = {quiet:localized('No activity','Sem atividade'),contact:localized('Contact','Contato'),entry:localized('Infection','Infecção'),replication:localized('Replication','Replicação'),defense:localized('Defense at work','Defesa em ação'),damage:localized('Tissue damage','Dano ao tecido'),repair:localized('Cell replacement','Reposição celular'),controlled:localized('Controlled','Controlada')};
export const CELL_COLORS: Record<CellStatus,string> = {healthy:'#b3d5cb',exposed:'#d58cb1',infected:'#c94578',controlled:'#5d9bcb',damaged:'#d4a05d',removed:'#c7ccd0',recovering:'#4aa989'};
export const CELL_NAMES: Record<CellStatus,string> = {healthy:localized('healthy','saudáveis'),exposed:localized('exposed','expostas'),infected:localized('infected','infectadas'),controlled:localized('controlled','controladas'),damaged:localized('damaged','danificadas'),removed:localized('removed','removidas'),recovering:localized('new, repairing','novas em reparo')};
export const REGION_ANCHORS: Record<RegionId,readonly [number,number,number]> = {nasal:[0,1.568,.107],trachea:[0,1.42,-.01],bronchi:[0,1.335,-.018],bronchioles:[-.065,1.3,-.02],alveoli:[-.09,1.25,.015]};
export interface VisualRegion {
  id:RegionId;name:string;counts:Record<CellStatus,number>;total:number;phase:VisualPhase;color:string;headline:string;description:string;
  viral:number;defense:number;inflammation:number;integrity:number;viruses:number;defenders:number;receiving:boolean;repaired:number;
}
export function countCells(cells:JourneyCell[]):Record<CellStatus,number> {
  const counts:Record<CellStatus,number>={healthy:0,exposed:0,infected:0,controlled:0,damaged:0,removed:0,recovering:0};
  for(const cell of cells)counts[cell.status]++;
  return counts;
}
export function regionVisual(region:RegionState):VisualRegion {
  const c=countCells(region.cells),n=region.cells.length;
  const replication=region.factors.includes('replicação de células infectadas');
  let phase:VisualPhase='quiet',headline=localized('This region is intact.','Esta região está preservada.'),description=localized(`No exposed or infected cells among ${n} observed positions.`,`Nenhuma célula exposta ou infectada entre as ${n} posições observadas.`);
  if(region.viralActivity>.08){phase='contact';headline=localized('This region has viral activity.','Há atividade viral nesta região.');description=localized('The model recorded local activity, with no exposed or infected cells at this moment.','O modelo registrou atividade local, sem células expostas ou infectadas neste instante.');}
  if(c.infected){
    phase=replication?'replication':'entry';headline=replication?localized('Infected cells are replicating.','Células infectadas estão replicando.'):localized('Infection has entered the cells.','A infecção entrou nas células.');
    description=localized(`${c.infected} of ${n} cells are infected${c.exposed?` and ${c.exposed} are exposed`:''}. ${replication?'Replication contributes to local viral activity.':'The initial infection phase has been calculated for this region.'}`,`${c.infected} de ${n} células estão infectadas${c.exposed?` e ${c.exposed} estão expostas`:''}. ${replication?'A replicação contribui para a atividade viral local.':'A fase inicial da infecção já foi calculada nesta região.'}`);
    if(c.controlled&&region.immuneActivity>12&&!replication){phase='defense';headline=localized('Defense is controlling some cells.','A defesa já controla parte das células.');description=localized(`${c.controlled} cells controlled and ${c.infected} still infected. Control happens cell by cell, not across the entire region at once.`,`${c.controlled} células controladas e ${c.infected} ainda infectadas. O controle ocorre por célula, sem encerrar toda a região de uma vez.`);}
  } else if(c.exposed){phase='contact';headline=localized('The virus is contacting the tissue.','O vírus está em contato com o tecido.');description=localized(`${c.exposed} of ${n} cells are exposed. No cells are infected in this region yet.`,`${c.exposed} de ${n} células estão expostas. Ainda não há células infectadas nesta região.`);}
  else if(c.controlled){phase='controlled';headline=localized('Infection was controlled in these cells.','A infecção foi controlada nestas células.');description=localized(`${c.controlled} cells are controlled by defense. Local viral activity is ${Math.round(region.viralActivity)}/100.`,`${c.controlled} células estão sob controle da defesa. A atividade viral local está em ${Math.round(region.viralActivity)}/100.`);}
  if(c.damaged+c.removed>0&&c.damaged+c.removed>=c.infected&&c.damaged+c.removed>=c.recovering){phase='damage';headline=localized('The tissue shows cell damage.','O tecido apresenta dano celular.');description=localized(`${c.damaged} damaged cells and ${c.removed} removed. Removed positions need replacement by new cells.`,`${c.damaged} células danificadas e ${c.removed} removidas. As posições removidas precisam de reposição, não de ressurreição da mesma célula.`);}
  else if(c.recovering>0&&c.infected===0){phase='repair';headline=localized('New cells are replacing damaged tissue.','Novas células estão repondo o tecido.');description=localized(`${c.recovering} new cells are recovering. The simulation has recorded ${region.repairedCells} replacements in this region.`,`${c.recovering} células novas em recuperação. A simulação já registrou ${region.repairedCells} reposições nesta região.`);}
  else if(!c.exposed&&!c.infected&&!c.damaged&&!c.removed&&region.repairedCells>0&&region.viralActivity<.2){phase='controlled';headline=localized('The tissue has rebuilt.','O tecido está recomposto.');description=localized(`The cell positions have been refilled. ${region.repairedCells} new cell identities were created during this trajectory.`,`As posições celulares foram repostas. ${region.repairedCells} novas identidades foram criadas ao longo desta trajetória.`);}
  return {id:region.regionId,name:localized(({nasal:'Nasal mucosa',trachea:'Trachea',bronchi:'Bronchi',bronchioles:'Bronchioles',alveoli:'Alveoli'} as const)[region.regionId],anatomyRegion(region.regionId).shortName),counts:c,total:n,phase,color:PHASE_COLORS[phase],headline,description,viral:region.viralActivity,defense:region.immuneActivity,inflammation:region.inflammation,integrity:region.tissueIntegrity,viruses:region.representativeViruses,defenders:region.representativeDefenders,receiving:region.factors.includes('atividade recebida de uma região conectada'),repaired:region.repairedCells};
}
export const visualRegions=(snapshot:JourneySnapshot)=>snapshot.regions.map(regionVisual);
export function cellNarrative(cell:JourneyCell,hour:number):{phase:VisualPhase;headline:string;description:string} {
  const age=hour-cell.sinceHour;
  switch(cell.status){
    case 'exposed':return {phase:'contact',headline:localized('Contact with the membrane.','Contato com a membrana.'),description:localized(`Exposed for ${age} h. The model has not recorded infection in this cell.`,`Exposta há ${age} h. O modelo ainda não registrou infecção nesta célula.`)};
    case 'infected':return cell.infectionAge>=4?{phase:'replication',headline:localized('Replication in the infected cell.','Replicação na célula infectada.'),description:localized(`${cell.infectionAge} h since infection. This cell can now contribute to the calculated viral production.`,`${cell.infectionAge} h de infecção. Esta célula já pode contribuir para a produção viral calculada.`)}:{phase:'entry',headline:localized('The cell became infected.','A célula foi infectada.'),description:localized(`${cell.infectionAge} h since infection. The illustration shows entry before the model counts this cell toward replication.`,`${cell.infectionAge} h de infecção. O esquema mostra a entrada, antes da contribuição de replicação do modelo.`)};
    case 'controlled':return {phase:'defense',headline:localized('Defense controlled this cell.','A defesa controlou esta célula.'),description:localized(`Control was recorded ${age} h ago. Intracellular viral activity is no longer shown.`,`Controle registrado há ${age} h. A atividade viral intracelular deixa de ser mostrada.`)};
    case 'damaged':return {phase:'damage',headline:localized('This cell was damaged.','Esta célula sofreu dano.'),description:localized(`Damage was recorded ${age} h ago. The cell shrinks before the model removes it.`,`Dano registrado há ${age} h. A célula perde volume antes de ser removida pelo modelo.`)};
    case 'removed':return {phase:'damage',headline:localized('The cell was removed.','A célula foi removida.'),description:localized(`This position has been under repair for ${age} h. A new cell identity is needed to refill it.`,`A posição está em reparo há ${age} h. Uma nova identidade será necessária para repor o tecido.`)};
    case 'recovering':return {phase:'repair',headline:localized('A new cell is growing.','Uma nova célula está crescendo.'),description:localized(`Generation ${cell.generation}, created ${age} h ago. It replaces the removed cell.`,`Geração ${cell.generation}, criada há ${age} h. Ela substitui a célula removida.`)};
    default:return {phase:cell.generation?'controlled':'quiet',headline:cell.generation?localized('The new cell is intact.','A nova célula está íntegra.'):localized('This cell is healthy.','Esta célula está saudável.'),description:cell.generation?localized(`Generation ${cell.generation}. Replacement completed recovery at this position.`,`Geração ${cell.generation}. A reposição concluiu a recuperação desta posição.`):localized('No exposure or infection has been calculated for this cell.','Não há exposição ou infecção calculada nesta célula.')};
  }
}
export const fractional=(value:number)=>value-Math.floor(value);
/** Pure time-to-shape mapping: seeking the same hour produces the same appearance. */
export function cellVisualScale(cell:JourneyCell,visualHour:number):number {
  const age=Math.max(0,visualHour-cell.sinceHour);
  if(cell.status==='damaged')return 1-.38*Math.min(1,age/4);
  if(cell.status==='removed')return .62-.54*Math.min(1,age/2);
  if(cell.status==='recovering')return .25+.75*Math.min(1,age/12);
  return 1;
}
