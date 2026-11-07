import {useJourney} from '../../journey/store';
import {cellNarrative,CELL_COLORS,CELL_NAMES,PHASE_COLORS,PHASE_NAMES,regionVisual} from '../../journey/visualState';
import type {CellStatus} from '../../journey/types';
import './evolution.css';

export function EvolutionGuide({onExplain}:{onExplain:()=>void}) {
  const {snapshot,regionId,level,selectedCellSlot,navigate}=useJourney();
  const region=snapshot.regions.find(r=>r.regionId===regionId)!;
  const visual=regionVisual(region);
  const cell=level==='cell'?region.cells.find(c=>c.slot===selectedCellSlot):undefined;
  const narration=cell?cellNarrative(cell,snapshot.simulatedHour):visual;
  const phase=cell?narration.phase:visual.phase;
  const recent=[...snapshot.log].reverse().find(event=>event.regionId===regionId&&event.simulatedHour<=snapshot.simulatedHour);
  const states:CellStatus[]=['healthy','exposed','infected','controlled','damaged','removed','recovering'];
  return <aside className="evolution-guide" aria-label="O que acontece neste instante" data-testid="evolution-guide" data-phase={phase} style={{'--phase-color':PHASE_COLORS[phase]} as React.CSSProperties}>
    <header><span>{visual.name}{cell?` · célula ${String(cell.slot+1).padStart(2,'0')}`:''}</span><time>Dia {Math.floor(snapshot.simulatedHour/24)} · {String(snapshot.simulatedHour%24).padStart(2,'0')}h</time></header>
    <span className="evolution-phase"><i/>{PHASE_NAMES[phase]}</span>
    <h2 data-testid="evolution-headline">{narration.headline}</h2>
    <p className="evolution-description">{narration.description}</p>
    <div className="evolution-cell-bar" aria-label="Estados das células nesta região">{states.filter(status=>visual.counts[status]>0).map(status=><span key={status} style={{width:`${visual.counts[status]/visual.total*100}%`,background:CELL_COLORS[status]}}/>)}</div>
    <div className="evolution-counts" aria-label="Contagem de células">{states.filter(status=>visual.counts[status]>0).map(status=><span key={status}><i style={{background:CELL_COLORS[status]}}/><strong data-testid={`cells-${status}`}>{visual.counts[status]}</strong> {CELL_NAMES[status]}</span>)}</div>
    <div className="evolution-defense"><span><i/>Defesa local</span><strong>{Math.round(visual.defense)}<small>/100</small></strong><span className="evolution-defense-track"><i style={{width:`${visual.defense}%`}}/></span></div>
    {recent&&<p className="evolution-since">Último marco: dia {Math.floor(recent.simulatedHour/24)}, {recent.simulatedHour%24}h · {recent.title}</p>}
    <div className="evolution-actions">{level!=='cell'&&<button onClick={()=>navigate(level==='tissue'?'cell':'tissue')}>{level==='tissue'?'Observar uma célula':'Ver o que acontece no tecido'} <span>↗</span></button>}<button onClick={onExplain}>Por que mudou?</button></div>
    <div className="evolution-legend" aria-label="Legenda da animação"><span><i className="is-virus"/>Vírus</span><span><i className="is-defense"/>Defesa</span><span><i className="is-damage"/>Dano</span><span><i className="is-repair"/>Reparo</span></div>
    <small className="evolution-note">Animação esquemática. Estados e contagens vêm da simulação.</small>
  </aside>;
}
