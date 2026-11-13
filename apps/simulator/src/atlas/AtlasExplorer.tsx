import { useEffect, useMemo, useState } from 'react';
import AtlasScene from './AtlasScene';
import { DEFAULT_VISIBLE, SYSTEMS, type Atlas, type Concept, type SceneState, type SystemId, type View } from './anatomy';
import { displayName, matchesConcept, regionForPart, SYSTEM_CONTEXT, SYSTEM_LABELS } from './presentation';
import { visualRegions, PHASE_NAMES } from '../journey/visualState';
import { journey as simulation, useJourney } from '../journey/store';
import { ANATOMY } from '../journey/anatomy';
import type { AnatomyLevel, RegionId } from '../journey/types';
import { formatNumber, locale } from '../i18n';
import './atlas.css';

let catalogue: Promise<Atlas> | undefined;
const getCatalogue = () => catalogue ??= fetch('/models/atlas/atlas.json').then(r => { if(!r.ok)throw new Error('O catálogo anatômico não pôde ser carregado.');return r.json() as Promise<Atlas>; }).catch(e=>{catalogue=undefined;throw e;});
const initial = (): SceneState => ({ regions:[],selectedRegion:'nasal',hour:0,allowed:null,navigation:'orbit',cameraAction:null,playing:true,particles:[],explode:0,visible:['skeletal','respiratory'],selected:[],focus:[],isolate:false,view:'three-quarter',rotate:false,reset:0,reducedMotion:false,activity:{},activityKey:'' });
type Props = {mode:AnatomyLevel;resetKey:number;onExplain:()=>void};
export function AtlasExplorer({mode,resetKey,onExplain}:Props) {
  const journey = useJourney();
  const [atlas,setAtlas]=useState<Atlas|null>(null);
  const [state,setState]=useState(initial);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  const [panel,setPanel]=useState<'layers'|'search'|'path'|null>(null);
  const [query,setQuery]=useState('');
  const [chosen,setChosen]=useState<Concept|null>(null);
  const [detail,setDetail]=useState(false);
  const [anatomyMode,setAnatomyMode]=useState(false);
  useEffect(()=>{let live=true;getCatalogue().then(a=>{if(live)setAtlas(a);}).catch(e=>{if(live)setError(e instanceof Error ? e.message : String(e));});return()=>{live=false;};},[]);
  useEffect(()=>{
    if(!atlas)return;
    const respiratory=atlas.parts.filter(p=>p.system==='respiratory');
    const targets=mode==='organ'?respiratory.filter(p=>!/nasal|pharyn|laryn|trachea/.test(p.name.toLowerCase())):respiratory;
    const context=atlas.parts.filter(p=>p.system==='respiratory'||(p.system==='skeletal'&&p.bounds[0][1]>1&&/rib|vertebra|sternum|clavicle|skull|mandib|maxilla|sphenoid|ethmoid|occipital|temporal|parietal|frontal|zygomatic/i.test(p.name))).map(p=>p.id);
    setState(s=>({...initial(),allowed:mode==='body'?context:null,visible:mode==='body'?['skeletal','respiratory']:['respiratory'],focus:mode==='body'?context:targets.map(p=>p.id),reset:s.reset+1}));
    setChosen(null);setDetail(false);setPanel(null);setAnatomyMode(false);
  },[atlas,mode,resetKey]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='/'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLTextAreaElement)){event.preventDefault();setPanel('search');}if(event.key==='Escape'){setPanel(null);setDetail(false);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const regions=useMemo(()=>visualRegions(journey.snapshot),[journey.snapshot]);
  const parts=useMemo(()=>new Map(atlas?.parts.map(p=>[p.id,p])),[atlas]);
  const counts=useMemo(()=>Object.fromEntries(SYSTEMS.map(s=>[s.id,atlas?.parts.filter(p=>p.system===s.id).length??0])),[atlas]);
  const selectedParts=state.selected.map(id=>parts.get(id)).filter(p=>p!==undefined);
  const selected=selectedParts.find(p=>regionForPart(p)!==null)??selectedParts[0];
  const regionId=selected?regionForPart(selected):null;
  const region=journey.snapshot.regions.find(r=>r.regionId===(regionId??journey.regionId))!;
  const visibleCount=atlas?.parts.filter(p=>state.isolate?state.selected.includes(p.id):(state.visible.includes(p.system)&&(!state.allowed||state.allowed.includes(p.id)))||state.selected.includes(p.id)).length??0;
  const results=useMemo(()=>{
    if(!atlas)return [];
    if(!query.trim())return ['trachea','lung','right lung','left lung','heart','brain','liver','stomach'].flatMap(name=>atlas.concepts.find(c=>c.name.toLowerCase()===name)??[]);
    return atlas.concepts.filter(c=>matchesConcept(c.name,c.id,query)).sort((a,b)=>a.name.length-b.name.length).slice(0,60);
  },[atlas,query]);
  const activityKey=`${journey.snapshot.scenarioId}:${journey.snapshot.simulatedHour}:${journey.snapshot.regions.map(r=>r.viralActivity.toFixed(3)).join(':')}`;
  const activity=useMemo(()=>Object.fromEntries((atlas?.parts??[]).flatMap(p=>{const id=regionForPart(p);return id?[[p.id,journey.snapshot.regions.find(r=>r.regionId===id)?.viralActivity??0]]:[];})),[atlas,activityKey]);
  const choose=(concept:Concept)=>{
    const part=parts.get(concept.elements[0]??'');const id=part?regionForPart(part):null;if(id)journey.selectRegion(id);
    setChosen(concept);setDetail(true);setPanel(null);setState(s=>({...s,selected:concept.elements,isolate:false,rotate:false}));
  };
  const choosePart=(id:string)=>{if(id.startsWith('concept:')){const concept=atlas?.concepts.find(c=>c.id===id.slice(8));if(concept)choose(concept);return;}const p=parts.get(id);if(p)choose({id:p.conceptId,name:p.name,elements:[p.id]});};
  const preset=(visible:SystemId[])=>{setDetail(false);setChosen(null);setState(s=>({...s,allowed:null,visible,selected:[],isolate:false,explode:0,focus:visible.length===1?atlas?.parts.filter(p=>p.system===visible[0]).map(p=>p.id)??[]:[],reset:s.reset+1}));};
  const reset=()=>{setDetail(false);setChosen(null);setState(s=>({...s,explode:0,selected:[],isolate:false,focus:atlas?.parts.filter(p=>p.system==='respiratory').map(p=>p.id)??[],view:'three-quarter',cameraAction:null,reset:s.reset+1}));};
  const focusRegion=(id:RegionId)=>{journey.selectRegion(id);setDetail(false);setPanel(null);const candidates=atlas?.parts.filter(p=>regionForPart(p)===id)??[];const targets=candidates.length?candidates:atlas?.parts.filter(p=>/bronchial tree/i.test(p.name))??[];setState(s=>({...s,selected:targets.map(p=>p.id),focus:targets.map(p=>p.id),isolate:false,explode:0,rotate:false,reset:s.reset+1}));};
  const particles=journey.snapshot.regions.map((r,i)=>{const centers=[[0,1.568,.107],[0,1.42,-.01],[0,1.335,-.018],[-.065,1.3,-.02],[-.09,1.25,.015]];const c=centers[i]!;return {x:c[0]!,y:c[1]!,z:c[2]!,count:r.representativeViruses?Math.min(12,Math.ceil(r.representativeViruses/4)):0};});
  const sceneState={...state,regions,selectedRegion:journey.regionId,hour:journey.snapshot.simulatedHour,contextual:!anatomyMode,conceptId:chosen?.id,rotate:state.rotate||(journey.autoCamera&&journey.playing),playing:journey.playing,particles,inspectorOpen:detail&&!!selected,reducedMotion:journey.reducedMotion,activity,activityKey};
  return <div className="atlas-workspace" aria-label="Atlas anatômico">
    {atlas&&<AtlasScene atlas={atlas} state={sceneState} onSelect={choosePart} onProgress={setProgress} onError={setError} onInfo={useJourney.getState().setInfo} getVisualHour={()=>simulation.visualHour} onRegionSelect={focusRegion}/>}
    <div className="atlas-identity"><span>DO ORGANISMO À CÉLULA</span><p>H1N1 · <strong>O caminho da infecção</strong></p></div>
    <div className="atlas-top-actions"><button className="atlas-search-trigger" aria-label="Buscar anatomia" onClick={()=>{setPanel(panel==='search'?null:'search');setDetail(false);}}><span aria-hidden="true">⌕</span><span>Encontrar estrutura</span><kbd>/</kbd></button></div>
    {panel!=='layers'&&<section className={`atlas-infection-path ${panel==='path'?'is-open':''}`} aria-label="Percurso do H1N1"><header><span>H1N1</span><button className="atlas-path-close" aria-label="Fechar percurso" onClick={()=>setPanel(null)}>×</button><strong>{journey.playing?'Em evolução':'Em pausa'}</strong></header><h2>Via respiratória.</h2><p>Escolha uma região para observar.</p><ol>{ANATOMY.map((entry,i)=>{const r=journey.snapshot.regions[i]!;return <li key={entry.regionId}><button aria-label={`Focar ${entry.shortName}`} aria-current={journey.regionId===entry.regionId?'step':undefined} onClick={()=>focusRegion(entry.regionId)}><span>{String(i+1).padStart(2,'0')}</span><div>{entry.shortName}<small>{PHASE_NAMES[regions[i]!.phase]}{regions[i]!.counts.infected?` · ${regions[i]!.counts.infected} células`:''}</small></div><i style={{background:r.viralActivity>.5?'#c75c7d':'#dce5e4'}}/></button></li>;})}</ol><button className="atlas-path-explain" onClick={onExplain}>O que está acontecendo? ↗</button><button className="atlas-full-anatomy" onClick={()=>{setAnatomyMode(true);preset([...DEFAULT_VISIBLE]);setPanel('layers');}}>Explorar anatomia completa</button></section>}
    <section className={`atlas-layers ${panel==='layers'?'is-open':''}`} aria-label="Camadas anatômicas">
      <header><h2>Sistemas</h2><span>15</span><button className="atlas-mobile-close" aria-label="Fechar sistemas" onClick={()=>setPanel(null)}>×</button></header>
      <div className="atlas-presets"><button onClick={()=>preset(SYSTEMS.map(s=>s.id))}>Todos</button><button onClick={()=>preset(['skeletal'])}>Esqueleto</button><button onClick={()=>preset(['cardiac','respiratory','digestive','urinary','endocrine','reproductive'])}>Órgãos</button></div>
      <div className="atlas-system-list">{SYSTEMS.map(system=><div key={system.id} className={`atlas-system-row ${state.visible.includes(system.id)?'is-visible':''}`}><button title={`Isolar sistema ${SYSTEM_LABELS[system.id]}`} onClick={()=>preset([system.id])}><i style={{background:system.color}}/><span>{SYSTEM_LABELS[system.id]}</span><small>{counts[system.id]??0}</small></button><input type="checkbox" role="switch" aria-label={`Mostrar ${SYSTEM_LABELS[system.id]}`} checked={state.visible.includes(system.id)} onChange={()=>{setDetail(false);setState(s=>({...s,selected:[],focus:[],isolate:false,visible:s.visible.includes(system.id)?s.visible.filter(id=>id!==system.id):[...s.visible,system.id]}));}}/></div>)}</div>
      <footer><span data-testid="atlas-visible-count">{formatNumber(visibleCount)} peças visíveis</span><button onClick={()=>preset([])}>Ocultar tudo</button></footer>
    </section>
    {panel==='search'&&<section className="atlas-search-panel" aria-label="Buscar estruturas"><header><h2>Encontrar uma estrutura</h2><button aria-label="Fechar busca" onClick={()=>setPanel(null)}>×</button></header><input autoFocus aria-label="Buscar estruturas anatômicas" placeholder="Pulmão, coração, trachea…" value={query} onChange={e=>setQuery(e.target.value)}/><div className="atlas-search-results">{results.map(c=><button key={c.id} onClick={()=>choose(c)}><span>{displayName(c.name)}{displayName(c.name)!==c.name&&<small>{c.name}</small>}</span><small>{c.elements.length} {c.elements.length===1?'peça':'peças'}</small></button>)}{!results.length&&<p>Nenhuma estrutura encontrada. Tente também o nome em inglês ou o identificador FMA.</p>}</div></section>}
    {detail&&selected&&chosen&&<section className="atlas-detail" aria-label="Estrutura selecionada"><button className="atlas-detail-close" aria-label="Fechar estrutura" onClick={()=>setDetail(false)}>×</button><i className="atlas-detail-accent" style={{background:SYSTEMS.find(s=>s.id===selected.system)?.color}}/><span className="atlas-eyebrow">{SYSTEM_LABELS[selected.system]}</span><h2>{displayName(chosen.name)}</h2>{displayName(chosen.name)!==chosen.name&&<p className="atlas-source-name">{chosen.name}</p>}<div className="atlas-detail-scroll"><p>{SYSTEM_CONTEXT[selected.system]}</p><dl><div><dt>Referência anatômica</dt><dd>{chosen.id}</dd></div><div><dt>Peças selecionadas</dt><dd>{state.selected.length}</dd></div></dl>{selectedParts.length>1&&<details><summary>Estruturas incluídas</summary>{selectedParts.slice(0,40).map(p=><button className="atlas-member" key={p.id} onClick={()=>choosePart(p.id)}>{displayName(p.name)} ↗</button>)}</details>}{regionId&&<div className="atlas-live-state"><span>H1N1 · Dia {Math.floor(journey.snapshot.simulatedHour/24)}</span><p>Atividade viral <strong>{Math.round(region.viralActivity)}<small>/100</small></strong></p><button onClick={onExplain}>Entender este momento ↗</button></div>}</div><div className="atlas-detail-actions"><button className="atlas-primary" onClick={()=>setState(s=>({...s,isolate:!s.isolate,explode:0,focus:[],reset:s.reset+1}))}>{state.isolate?'Mostrar no corpo':'Isolar estrutura'} <span>↗</span></button><button onClick={()=>setState(s=>({...s,focus:[...s.selected],explode:0,reset:s.reset+1}))}>Focar estrutura</button>{regionId&&<button onClick={()=>journey.navigate('tissue')}>Explorar o tecido respiratório →</button>}</div></section>}
    <button className="atlas-mobile-path" aria-label="Abrir percurso H1N1" onClick={()=>setPanel(panel==='path'?null:'path')}>◎ <span>Regiões</span></button><div className="atlas-navigation-tools" aria-label="Movimentar câmera"><button aria-label="Orbitar livremente" aria-pressed={state.navigation==='orbit'} onClick={()=>setState(s=>({...s,navigation:'orbit'}))}>↻ <span>Orbitar</span></button><button aria-label="Deslocar câmera" aria-pressed={state.navigation==='pan'} onClick={()=>setState(s=>({...s,navigation:'pan'}))}>✥ <span>Mover</span></button><i/><button aria-label="Aproximar anatomia" onClick={()=>setState(s=>({...s,cameraAction:{type:'in',revision:(s.cameraAction?.revision??0)+1}}))}>＋</button><button aria-label="Afastar anatomia" onClick={()=>setState(s=>({...s,cameraAction:{type:'out',revision:(s.cameraAction?.revision??0)+1}}))}>−</button><button aria-label="Enquadrar região" onClick={()=>setState(s=>({...s,focus:s.allowed??(anatomyMode?[]:atlas?.parts.filter(p=>p.system==='respiratory').map(p=>p.id)??[]),reset:s.reset+1}))}>⌖</button></div>
    <nav className="atlas-view-controls" aria-label="Vistas anatômicas">{(['three-quarter','front','side','back'] as View[]).map((view,i)=><button key={view} aria-label={`Vista ${['três quartos','frontal','lateral','posterior'][i]}`} aria-pressed={state.view===view} onClick={()=>setState(s=>({...s,view,focus:anatomyMode?[]:state.allowed??atlas?.parts.filter(p=>p.system==='respiratory').map(p=>p.id)??[],rotate:false,reset:s.reset+1}))}>{(locale === 'en' ? ['¾', 'F', 'S', 'B'] : ['¾', 'F', 'L', 'P'])[i]}</button>)}<hr/><button aria-label={state.rotate?'Parar rotação':'Girar anatomia'} disabled={journey.reducedMotion} onClick={()=>setState(s=>({...s,rotate:!s.rotate}))}>{state.rotate?'Ⅱ':'↻'}</button><button aria-label="Restaurar anatomia" onClick={reset}>⟲</button></nav>
    <div className={`atlas-explode-dock ${anatomyMode?'':'is-contextual'}`}><button className="atlas-mobile-systems" onClick={()=>setPanel(panel==='layers'?null:'layers')} aria-label="Abrir sistemas">▱<small>Sistemas</small></button><div><label htmlFor="atlas-explosion">Separar anatomia <output>{Math.round(state.explode*100)}%</output></label><input id="atlas-explosion" aria-label="Separar anatomia" type="range" min={0} max={100} value={Math.round(state.explode*100)} onChange={e=>{setDetail(false);setState(s=>({...s,explode:Number(e.target.value)/100,isolate:false,focus:[],selected:[],rotate:false}));}}/><p><span>Corpo montado</span><span>Peça por peça</span></p></div><button aria-label="Montar anatomia" onClick={reset}>⟲<small>Montar</small></button></div>
    {!detail&&<button className="atlas-journey-link" aria-label={mode==='body'?'Seguir a respiração':mode==='respiratory'?'Explorar os pulmões':'Aproximar o tecido'} onClick={()=>journey.navigate(mode==='body'?'respiratory':mode==='respiratory'?'organ':'tissue')}>{mode==='body'?'Explorar sistema respiratório':mode==='respiratory'?'Explorar os pulmões':'Entrar no tecido'} <span>↗</span></button>}
    <p className="atlas-hint">{state.navigation==='pan'?'Arraste para deslocar':'Arraste para girar'} · roda/pinça para aproximar · partículas ilustrativas</p>
    <a className="atlas-credit" href="/models/atlas/ATTRIBUTION.md" target="_blank" rel="noreferrer">BodyParts3D · Human Atlas ↗</a>
    {progress<100&&!error&&<div className="atlas-loading" role="status"><strong>Preparando a anatomia completa</strong><p>{progress}% · Carregando 2.234 peças</p><progress value={progress} max={100}/></div>}
    {error&&<div className="atlas-loading" role="alert"><strong>A anatomia não pôde iniciar.</strong><p>{error}</p><button onClick={()=>location.reload()}>Tentar novamente</button></div>}
  </div>;
}
