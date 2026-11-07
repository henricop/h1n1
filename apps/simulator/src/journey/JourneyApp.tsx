import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { EvolutionGuide } from '../components/journey/EvolutionGuide';
import { PatientMonitor } from '../components/journey/PatientMonitor';
import { MilestoneCard } from '../components/journey/MilestoneCard';
import { MilestoneRoadmap } from '../components/journey/MilestoneRoadmap';
import { nextCalculatedMilestone } from './nextMilestone';
import { AtlasExplorer } from '../atlas/AtlasExplorer';
import { AdversityEditor } from '../components/journey/AdversityEditor';
import { ExplainStatePanel, CELL_LABELS, STAGE_LABELS } from '../components/journey/ExplainStatePanel';
import type { CameraMove } from '../components/journey/JourneyCanvas';
const JourneyCanvas = lazy(() => import('../components/journey/JourneyCanvas').then(module => ({default: module.JourneyCanvas})));
import { ScenarioComparison } from '../components/journey/ScenarioComparison';
import { TimelineControls } from '../components/journey/TimelineControls';
import { TrajectoryChart } from '../components/journey/TrajectoryChart';
import { ADVERSITIES, INITIAL_PRESETS } from '../engine/journey/config';
import { anatomyRegion, LEVELS } from './anatomy';
import { journey, useJourney } from './store';
import type { AnatomyLevel, JourneyLogEntry, JourneySnapshot } from './types';
import { localized } from '../i18n';

type SheetName = 'help' | 'settings' | 'state' | 'event' | 'compare' | 'graphs' | 'log' | null;
function Icon({ type }: { type: 'left' | 'right' | 'in' | 'out' | 'frame' | 'close' | 'settings' | 'layers' }) {
  const paths = { left: 'm14 5-7 7 7 7', right: 'm10 5 7 7-7 7', in: 'M12 5v14M5 12h14', out: 'M5 12h14', frame: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', close: 'm6 6 12 12M6 18 18 6', settings: 'M4 7h16M4 17h16M8 4v6m8 4v6', layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5' };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[type]} /></svg>;
}
function Sheet({ name, title, children, onClose, wide = false }: { name: string; title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current!; element.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { if (element.open) element.close(); document.body.style.overflow = old; }; }, []);
  return <dialog ref={dialog} className={`lab-sheet ${wide ? 'is-wide' : ''}`} aria-label={name} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}><div className="lab-sheet-header"><span>{title}</span><button className="lab-icon-button" onClick={onClose} aria-label={`Fechar ${name}`}><Icon type="close" /></button></div><div className="lab-sheet-content">{children}</div></dialog>;
}
const GUIDANCE: Record<AnatomyLevel, { eyebrow: string; title: string; description: string; action: string }> = {
  body: { eyebrow: 'O corpo inteiro', title: 'Tudo começa com uma respiração.', description: 'Siga o caminho do vírus. Do primeiro contato até o que acontece dentro de uma célula.', action: 'Seguir a respiração' },
  respiratory: { eyebrow: 'Sistema respiratório', title: 'Um caminho para dentro.', description: 'Do nariz aos pulmões: as vias respiratórias são revestidas por uma barreira viva.', action: 'Explorar os pulmões' },
  organ: { eyebrow: 'Dentro do pulmão', title: 'Cada ramo leva mais longe.', description: 'Aproxime uma região para ver o tecido que reveste suas vias.', action: 'Aproximar o tecido' },
  tissue: { eyebrow: 'Tecido respiratório', title: 'Uma barreira feita de células.', description: 'Aqui, células e defesas interagem. Clique em uma célula para descobrir o que está acontecendo.', action: 'Entrar em uma célula' },
  cell: { eyebrow: 'Escala celular', title: 'Um mundo dentro de outro.', description: 'Observe a membrana, o núcleo e a atividade viral. Este estado acompanha o mesmo instante do corpo.', action: 'Voltar ao tecido' },
};
function currentExplanation(snapshot: JourneySnapshot): string {
  switch (snapshot.body.stage) {
    case 'exposure': return 'O contato inicial acontece na mucosa. A defesa ainda está reconhecendo essa atividade.';
    case 'local': return 'Há células infectadas nas vias respiratórias. A atividade continua localizada nas regiões calculadas.';
    case 'response': return 'A defesa está mais ativa. Algumas células controlam a infecção; outras regiões ainda precisam de reparo.';
    case 'recovering': return 'A atividade viral está caindo. O tecido está sendo reparado e células removidas dão lugar a novas células.';
    case 'worsening': return 'Neste cenário, a inflamação e o dano ao tecido estão elevados. Explore a região para entender os fatores.';
    case 'controlled': return 'A atividade foi controlada neste cenário. O tecido pode continuar se reparando.';
  }
}

export function JourneyApp() {
  const state = useJourney();
  const { snapshot, comparison, level, regionId, selectedCellSlot, playing, speed, info, error, reducedMotion, autoCamera, presentation } = state;
  const store = useJourney.getState;
  const [sheet, setSheet] = useState<SheetName>(null);
  const [cameraMove, setCameraMove] = useState<CameraMove>(null);
  const [cameraReset, setCameraReset] = useState(0);
  const [seedDraft, setSeedDraft] = useState(String(snapshot.config.seed));
  const [preset, setPreset] = useState(INITIAL_PRESETS[0]?.id ?? 'typical');
  const [notice, setNotice] = useState('');
  const [cameraTools, setCameraTools] = useState(false);
  const tourHour = useRef(-24);
  const dialogWasPlaying = useRef(false);
  const levelIndex = LEVELS.findIndex((item) => item.id === level);
  const region = snapshot.regions.find((item) => item.regionId === regionId)!;
  const cell = region.cells.find((item) => item.slot === selectedCellSlot);
  const guide = GUIDANCE[level];
  const macro = level === 'body' || level === 'respiratory' || level === 'organ';
  const day = Math.floor(snapshot.simulatedHour / 24);
  const hour = snapshot.simulatedHour % 24;
  const nextHour = snapshot.simulatedHour + 1;
  const viralRate = snapshot.scenarioId === 'A' ? 1 : Math.max(1, ...snapshot.events.filter(event => event.enabled && event.kind === 'viral-rate' && event.startHour <= nextHour && event.startHour + event.durationHours > nextHour).map(event => event.intensity === 'high' ? 3 : event.intensity === 'moderate' ? 2 : 1.5));
  const closeSheet = () => {
    setSheet(null); useJourney.setState({ comparisonOpen: false });
    if (dialogWasPlaying.current) { journey.play(); dialogWasPlaying.current = false; store().publish(); }
  };
  const openSheet = (name: SheetName) => {
    dialogWasPlaying.current = journey.status === 'running'; journey.pause();
    if (name === 'compare' || name === 'event') useJourney.setState({ comparison: journey.getComparison(), comparisonOpen: name === 'compare' });
    store().publish(); setSheet(name);
  };
  const showEvent = (event: JourneyLogEntry) => {
    dialogWasPlaying.current = false;
    journey.pause(); journey.seek(event.simulatedHour); store().publish(); store().selectRegion(event.regionId); store().navigate(event.level); closeSheet();
    setNotice(`${event.title}. ${localized('Day', 'Dia')} ${Math.floor(event.simulatedHour / 24)}, ${event.simulatedHour % 24} ${localized('hours', 'horas')}.`);
  };
  const reset = (presetId?: string) => {
    const selected = INITIAL_PRESETS.find((item) => item.id === (presetId ?? preset));
    journey.reset({ seed: Number(seedDraft) || 0, ...(presetId && selected ? { initialConditions: selected.initialConditions } : {}) });
    if (sheet) dialogWasPlaying.current = true;
    else journey.play();
    store().publish(); useJourney.setState({ comparison: journey.getComparison(), level: 'body', regionId: 'nasal', selectedCellSlot: null });
    tourHour.current = -24; setSeedDraft(String(journey.config.seed)); setCameraReset((n) => n + 1); setNotice('Jornada reiniciada no corpo inteiro.');
  };
  const scales = (className: string) => <nav className={className} aria-label="Escalas de exploração">{LEVELS.map((item, i) => <button key={item.id} aria-current={item.id === level ? 'step' : undefined} aria-label={`Explorar ${item.name}`} onClick={() => state.navigate(item.id)}><span>{item.name}</span>{i < 4 && <i aria-hidden="true">›</i>}</button>)}</nav>;
  const nextMilestone = () => {
    const event = nextCalculatedMilestone(journey.getSnapshot());
    if (!event) { setNotice('Não há novos marcos até o fim deste cenário.'); return; }
    showEvent(event);
  };
  const nextLevel = () => state.navigate(level === 'cell' ? 'tissue' : LEVELS[Math.min(4, levelIndex + 1)]!.id);
  const setViralRate = (rate: number) => {
    const startHour = journey.hour + 1;
    const horizon = journey.config.horizonDays * 24;
    if (startHour >= horizon) return;
    const wasPlaying = journey.status === 'running';
    const prior = journey.getSnapshot('B').events.find(event => event.enabled && event.kind === 'viral-rate' && event.id.startsWith('viral-control-') && event.startHour <= startHour && event.startHour + event.durationHours > startHour);
    if (prior) {
      if (prior.startHour < startHour) journey.upsertEvent({ ...prior, durationHours: startHour - prior.startHour });
      else journey.removeEvent(prior.id);
    }
    if (rate > 1) journey.upsertEvent({ id: `viral-control-${startHour}`, kind: 'viral-rate', startHour, durationHours: horizon - startHour, intensity: rate >= 3 ? 'high' : rate >= 2 ? 'moderate' : 'mild', enabled: true });
    journey.setActiveScenario('B');
    if (wasPlaying) journey.play();
    store().publish();
    setNotice(`Ritmo viral do cenário B ajustado para ${rate} vezes a partir da próxima hora.`);
  };
  useEffect(() => {
    let frame = 0, previous = 0;
    const advance = (now: number) => {
      frame = requestAnimationFrame(advance);
      if (document.hidden) { previous = 0; return; }
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0; previous = now;
      if (useJourney.getState().info) journey.advance(dt);
    };
    frame = requestAnimationFrame(advance);
    const publish = window.setInterval(() => store().publish(), 125);
    return () => { cancelAnimationFrame(frame); clearInterval(publish); };
  }, []);
  useEffect(() => {
    let resume = false;
    const visibility = () => { if (document.hidden) { resume = journey.status === 'running'; journey.pause(); } else if (resume) { journey.play(); resume = false; } store().publish(); };
    document.addEventListener('visibilitychange', visibility); return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (!presentation || snapshot.simulatedHour - tourHour.current < 12) return;
    const latest = snapshot.log.at(-1); if (latest && latest.simulatedHour > tourHour.current) { tourHour.current = snapshot.simulatedHour; store().selectRegion(latest.regionId); store().navigate(latest.level); }
  }, [presentation, snapshot.simulatedHour, snapshot.log]);

  return <main className={`lab-app ${presentation ? 'is-presentation' : ''}`}>
    <a className="lab-skip" href="#lab-timeline">Ir para o tempo da simulação</a>
    <header className="lab-header"><a className="lab-brand" href="/" aria-label="H1N1 Jornada da Infecção, início"><span className="lab-brand-symbol" aria-hidden="true"><svg viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M18 3v11m0 0C10 12 5 19 7 28c2 7 10 4 10 0V14Zm0 0c8-2 13 5 11 14-2 7-10 4-10 0V14Z" /><path d="m18 13-6 8m6-8 6 8" /></svg></span><span><h1>H1N1 <span>Jornada da Infecção</span></h1><small>Explore por dentro.</small></span></a>{macro && scales('lab-scales lab-header-scales')}<div className="lab-header-actions"><button className="lab-text-button" onClick={() => openSheet('help')}>Como explorar</button><button className="lab-icon-button" aria-label="Configurar simulação" onClick={() => openSheet('settings')}><Icon type="settings" /></button><button className="lab-reset" aria-label="Reiniciar jornada" onClick={() => reset()}>↻ <span>Reiniciar</span></button></div></header>

    <PatientMonitor viralRate={viralRate} onViralRate={setViralRate} />
    <div className="lab-exploration"><section className={`lab-stage ${macro ? 'has-atlas' : ''}`} aria-label="Exploração 3D" data-level={level} data-hour={snapshot.simulatedHour}>
      <div className="lab-viewport">{macro ? <AtlasExplorer mode={level} resetKey={cameraReset} onExplain={() => openSheet('state')} /> : <Suspense fallback={<div className="lab-loading" role="status">Preparando a escala microscópica…</div>}><JourneyCanvas cameraMove={cameraMove} resetCamera={cameraReset} /></Suspense>}</div>
      {scales(`lab-scales ${macro ? 'lab-stage-scales' : ''}`)}
      <div className="lab-context"><span className="lab-eyebrow">{guide.eyebrow}</span><h2>{guide.title}</h2><p>{guide.description}</p><button className="lab-button lab-button-primary" onClick={nextLevel}>{guide.action}<span aria-hidden="true">↗</span></button>{level !== 'body' && <button className="lab-back" onClick={() => state.navigate(LEVELS[Math.max(0, levelIndex - 1)]!.id)}>← Voltar um nível</button>}</div>
      <div className="lab-location"><span className="lab-status-dot" /><span>{STAGE_LABELS[snapshot.body.stage]}</span><button aria-label={`Cenário ${snapshot.scenarioId}, comparar cenários`} onClick={() => openSheet('compare')}>Cenário {snapshot.scenarioId}</button></div>
      {!macro && !info && !error && <div className="lab-loading" role="status"><span className="lab-loading-glyph" aria-hidden="true">⌁</span><strong>Preparando o corpo humano.</strong><p>Carregando a anatomia 3D no seu dispositivo.</p></div>}
      {!macro && error && <div className="lab-render-error" role="alert"><strong>A cena 3D não pôde iniciar.</strong><p>{error}</p><button className="lab-button" onClick={() => window.location.reload()}>Tentar novamente</button></div>}
      <div className="lab-region-control">{level !== 'body' && <label><span>Região</span><select aria-label="Região em foco" value={regionId} onChange={(event) => state.selectRegion(event.target.value as typeof regionId)}>{['nasal','trachea','bronchi','bronchioles','alveoli'].map((id) => <option key={id} value={id}>{anatomyRegion(id as typeof regionId).shortName}</option>)}</select></label>}{level === 'cell' && <label><span>Célula</span><select aria-label="Célula em foco" value={selectedCellSlot ?? 0} onChange={(event) => state.selectCell(Number(event.target.value))}>{region.cells.map((item) => <option key={item.slot} value={item.slot}>{String(item.slot + 1).padStart(2,'0')} · {CELL_LABELS[item.status]}</option>)}</select></label>}</div>
      <div className="lab-insight"><span className="lab-insight-mark" aria-hidden="true">✳</span><div><p>{level === 'cell' && cell ? `${CELL_LABELS[cell.status]}. ${snapshot.simulatedHour - cell.sinceHour} horas neste estado. O reparo do tecido pode gerar uma nova célula.` : currentExplanation(snapshot)}</p><button className="lab-text-button" onClick={() => openSheet('state')}>Entender este momento <span aria-hidden="true">↗</span></button></div></div>
      <div className="lab-camera"><div className={`lab-camera-buttons ${cameraTools ? 'is-open' : ''}`}>{([['left','Girar à esquerda'],['right','Girar à direita'],['in','Aproximar'],['out','Afastar']] as const).map(([action,label]) => <button className="lab-icon-button" key={action} aria-label={label} title={label} onClick={() => setCameraMove({action,revision:(cameraMove?.revision??0)+1})}><Icon type={action} /></button>)}<button className="lab-icon-button" aria-label="Enquadrar" title="Enquadrar" onClick={() => setCameraReset((n)=>n+1)}><Icon type="frame" /></button></div><button className="lab-camera-mobile lab-icon-button" aria-label="Controles da câmera" aria-expanded={cameraTools} onClick={()=>setCameraTools(!cameraTools)}><Icon type="layers" /></button><small>Arraste para girar · aproxime para explorar</small></div>
      <span className="lab-out-of-scale">Representação ilustrativa · fora de escala</span>
    </section><EvolutionGuide onExplain={() => openSheet('state')} /></div>

    <section className="lab-time-dock" id="lab-timeline" aria-label="Tempo da jornada"><TimelineControls compact hour={snapshot.simulatedHour} horizonDays={snapshot.config.horizonDays} playing={playing} speed={speed} log={snapshot.log} events={snapshot.events} onSeek={state.seek} onStep={state.step} onToggle={state.togglePlay} onSpeed={state.setSpeed} onReplay={state.replay} onHorizon={(days)=>{journey.setHorizon(days);store().publish();}} onShowEvent={showEvent} /><MilestoneRoadmap snapshot={snapshot} onOpen={showEvent} onNext={nextMilestone} /><div className="lab-experiment-actions"><button className="lab-event-button" aria-label="＋ E se algo mudar? Adicionar evento" onClick={()=>openSheet('event')}>＋ E se algo mudar?<span>Adicionar evento</span></button><button className="lab-text-button" onClick={()=>openSheet('compare')}>Comparar cenários <span aria-hidden="true">⇄</span></button>{snapshot.activeEvents.length>0 && <button className="lab-active-event" onClick={()=>openSheet('event')}>{snapshot.activeEvents.length} {snapshot.activeEvents.length>1?localized('active conditions','condições ativas'):localized('active condition','condição ativa')}</button>}<button className="lab-text-button lab-changes-button" onClick={()=>openSheet('state')}>Ver o que mudou</button></div></section>
    <footer className="lab-footer"><p>Simulação educacional. Não é uma previsão clínica.</p><div><button onClick={()=>openSheet('graphs')}>Trajetória</button><button onClick={()=>openSheet('log')}>Marcos</button><a href="/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">Créditos 3D ↗</a><details className="lab-diagnostics"><summary>Desempenho</summary><div><strong data-testid="journey-renderer-status">{info?`${info.backend} · ${info.fps} fps`:'Preparando 3D'}</strong>{info && <dl><div><dt>Geometrias</dt><dd data-testid="gpu-geometries">{info.geometries}</dd></div><div><dt>Texturas</dt><dd>{info.textures}</dd></div><div><dt>Desenhos</dt><dd>{info.drawCalls}</dd></div><div><dt>Triângulos</dt><dd>{info.triangles}</dd></div><div><dt>Qualidade</dt><dd>{info.quality}</dd></div></dl>}</div></details></div></footer>
    <span className="sr-only" data-testid="simulated-hour">{snapshot.simulatedHour}</span><span className="sr-only" data-testid="active-scenario">{snapshot.scenarioId}</span><span className="sr-only" data-testid="current-seed">{snapshot.config.seed}</span>
    {!sheet && <MilestoneCard snapshot={snapshot} onOpen={showEvent} />}

    {sheet==='help' && <Sheet name="Como explorar" title="Uma jornada, passo a passo" onClose={closeSheet}><div className="lab-help"><span className="lab-eyebrow">Comece pelo que você vê</span><h2>Gire. Aproxime.<br />Descubra por dentro.</h2><ol><li><strong>01</strong><div><h3>Explore o corpo.</h3><p>Arraste o modelo e selecione uma região. Você também pode usar os nomes das escalas e os botões de câmera.</p></div></li><li><strong>02</strong><div><h3>Siga até uma célula.</h3><p>Corpo, pulmão, tecido e célula mostram o mesmo instante da mesma jornada.</p></div></li><li><strong>03</strong><div><h3>Avance e experimente.</h3><p>Mude o dia. Adicione uma condição ao cenário B e compare com o original. Nada aqui prevê o que acontecerá com uma pessoa.</p></div></li></ol><button className="lab-button lab-button-primary" onClick={closeSheet}>Vamos explorar ↗</button></div></Sheet>}
    {sheet==='settings' && <Sheet name="Configurar simulação" title="Seu experimento" onClose={closeSheet}><div className="lab-settings"><h2>Escolha um ponto de partida.</h2><p>São condições ilustrativas. Nenhum dado pessoal é necessário.</p><label>Condições iniciais<select aria-label="Condições iniciais" value={preset} onChange={(event)=>{setPreset(event.target.value);reset(event.target.value);}}>{INITIAL_PRESETS.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p>{INITIAL_PRESETS.find((item)=>item.id===preset)?.description}</p><label className="lab-setting-toggle"><input type="checkbox" aria-label="Reduzir movimento" checked={reducedMotion} onChange={(event)=>state.setReducedMotion(event.target.checked)} /><span>Reduzir movimento<small>Transições imediatas e movimentos decorativos desligados.</small></span></label><label className="lab-setting-toggle"><input type="checkbox" aria-label="Câmera automática" checked={autoCamera} disabled={reducedMotion} onChange={(event)=>state.setAutoCamera(event.target.checked)} /><span>Câmera automática<small>Uma órbita suave, que respeita sua navegação manual.</small></span></label><button className="lab-button" onClick={()=>{useJourney.setState({presentation:!presentation});if(!presentation){tourHour.current=journey.hour;journey.play();store().publish();}closeSheet();}}>{presentation?'Sair da apresentação':'Modo apresentação'}</button><details className="lab-reproducibility"><summary>Repetir a mesma jornada</summary><p>A mesma seed e os mesmos eventos reproduzem o mesmo resultado.</p><label>Seed<input aria-label="Seed" type="number" min={0} max={4294967295} value={seedDraft} onChange={(event)=>setSeedDraft(event.target.value)} /></label><button className="lab-button" onClick={()=>reset()}>Aplicar e reiniciar</button></details></div></Sheet>}
    {sheet==='state' && <Sheet name="Estado da jornada" title={`Dia ${day} · ${String(hour).padStart(2,'0')}h · ${anatomyRegion(regionId).shortName}`} onClose={closeSheet}><div className="lab-state-explainer"><h2>O que está acontecendo?</h2><p className="lab-state-lead">{currentExplanation(snapshot)}</p><ExplainStatePanel snapshot={snapshot} regionId={regionId} selectedSlot={level==='cell'?selectedCellSlot:null} onShowEvent={showEvent} /></div></Sheet>}
    {sheet==='event' && <Sheet name="Adicionar evento" title="E se algo mudar na jornada?" onClose={closeSheet} wide><AdversityEditor open onClose={closeSheet} events={comparison.B.events} definitions={ADVERSITIES.filter(item=>item.kind!=='viral-rate')} hour={snapshot.simulatedHour} horizonDays={snapshot.config.horizonDays} onApply={(event)=>{state.applyEvent(event);setNotice(`${ADVERSITIES.find((item)=>item.kind===event.kind)?.title} ${localized('applied to scenario B.','aplicado ao cenário B.')}`);}} onRemove={state.removeEvent} onToggle={state.toggleEvent}/></Sheet>}
    {sheet==='compare' && <Sheet name="Comparar cenários" title="Mesmo começo. Uma condição diferente." onClose={closeSheet} wide><ScenarioComparison A={comparison.A} B={comparison.B} active={snapshot.scenarioId} onSelect={state.selectScenario} onShowEvent={showEvent}/><button className="lab-button lab-button-primary lab-view-scenario" onClick={closeSheet}>Explorar cenário {snapshot.scenarioId} em 3D ↗</button></Sheet>}
    {sheet==='graphs' && <Sheet name="Trajetória" title={`Cenário ${snapshot.scenarioId} · índices ilustrativos`} onClose={closeSheet} wide><div className="lab-trajectory"><h2>Como a jornada mudou.</h2><p>Quatro índices internos, de 0 a 100. Não são exames.</p><TrajectoryChart A={snapshot.history} hour={snapshot.simulatedHour} horizonHours={snapshot.config.horizonDays*24}/></div></Sheet>}
    {sheet==='log' && <Sheet name="Marcos da jornada" title="Mudanças que a simulação calculou" onClose={closeSheet}><div className="lab-event-log"><h2>Uma história de mudanças.</h2><p>Selecione um momento para encontrá-lo no corpo.</p><ol>{[...snapshot.log].reverse().slice(0,48).map((event)=><li key={event.id}><time>Dia {Math.floor(event.simulatedHour/24)} · {event.simulatedHour%24}h</time><h3>{event.title}</h3><p>{event.explanation}</p><button className="lab-text-button" onClick={()=>showEvent(event)}>Mostrar o que aconteceu ↗</button></li>)}</ol></div></Sheet>}
    <div className="sr-only" role="status" aria-live="polite">{notice}</div>
  </main>;
}
