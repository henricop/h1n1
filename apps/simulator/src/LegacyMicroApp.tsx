import { useEffect, useState } from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { DEFAULT_CONFIG, SCENARIOS } from './engine/config';
import type { CellState } from './engine/types';
import { simulation, useSimulator } from './store';

type IconName = 'play' | 'pause' | 'reset' | 'plus' | 'minus' | 'left' | 'right' | 'shield' | 'frame' | 'close' | 'orbit';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    play: <path d="m9 5 10 7-10 7Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    left: <path d="m14 5-7 7 7 7" />,
    right: <path d="m10 5 7 7-7 7" />,
    shield: <><path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    frame: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    orbit: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const number = new Intl.NumberFormat('pt-BR');
function timeLabel(seconds: number) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
const cellLabels: Record<CellState, string> = { healthy: 'Saudável', infected: 'Infectada', recovered: 'Recuperada' };

export function App() {
  const { snapshot, selectedCell, speed, autoCamera, reducedMotion, rendererInfo, error } = useSimulator();
  const { metrics, config, events } = snapshot;
  const [scenario, setScenario] = useState(SCENARIOS[0]?.id ?? 'balanced');
  const [seed, setSeed] = useState(String(config.seed));
  const [initialViruses, setInitialViruses] = useState(String(config.initialViruses));
  const [cameraReset, setCameraReset] = useState(0);
  const [cameraMove, setCameraMove] = useState<{ action: 'left' | 'right' | 'in' | 'out'; revision: number } | null>(null);
  const [help, setHelp] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const cell = selectedCell === null ? undefined : simulation.cells.find((item) => item.id === selectedCell);
  const running = metrics.status === 'running';
  const complete = metrics.status === 'complete';
  const infectionPercent = (metrics.infected / config.cellCount) * 100;
  const store = useSimulator.getState;

  // Hidden tabs don't accumulate biological time or waste a continuous render loop.
  useEffect(() => {
    let resume = false;
    const onVisibility = () => {
      if (document.hidden) { resume = simulation.status === 'running'; simulation.pause(); }
      else if (resume) { simulation.play(); resume = false; }
      store().publish();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const reset = (presetId?: string) => {
    const preset = SCENARIOS.find((item) => item.id === (presetId ?? scenario));
    const parsedSeed = Math.max(0, Math.min(4294967295, Math.floor(Number(seed) || 0)));
    const virusCount = Math.max(0, Math.min(300, Math.floor(Number(initialViruses) || 0)));
    simulation.reset({ ...(presetId ? { ...DEFAULT_CONFIG, ...preset?.config } : config), seed: parsedSeed,
      ...(!presetId ? { initialViruses: virusCount } : {}) });
    store().selectCell(null);
    store().setSpeed(1);
    store().publish();
    setSeed(String(simulation.config.seed));
    setInitialViruses(String(simulation.config.initialViruses));
    setCameraReset((value) => value + 1);
    setAnnouncement(`Simulação reiniciada com a seed ${parsedSeed}.`);
  };

  const addViruses = () => {
    const before = simulation.getSnapshot().metrics.activeViruses;
    simulation.addViruses(20);
    store().publish();
    const added = simulation.getSnapshot().metrics.activeViruses - before;
    setAnnouncement(added ? `${added} vírus adicionados ao ambiente.` : 'Limite de partículas atingido.');
  };

  return (
    <main className="simulator" data-cell-count={config.cellCount} data-initial-viruses={config.initialViruses}>
      <a className="skip-link" href="#controls">Ir para os controles</a>
      <header className="app-header">
        <a className="identity" href="/" aria-label="H1N1 Infection Simulator, início">
          <span className="identity-mark" aria-hidden="true"><svg viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="11" /><circle cx="22" cy="22" r="5" />{Array.from({ length: 8 }, (_, i) => <path key={i} d="M22 4v6m-2-6h4" transform={`rotate(${i * 45} 22 22)`} />)}</svg></span>
          <span><h1><strong>H1N1</strong> <span>Infection Simulator</span></h1><span className="identity-caption">Um micromundo nas suas mãos.</span></span>
        </a>
        <div className="header-actions"><span className="experiment-tag"><span /> Experimento interativo</span><button className="help-button" aria-expanded={help} aria-controls="help-note" onClick={() => setHelp(!help)}>Como funciona <span aria-hidden="true">↗</span></button></div>
      </header>

      {help && <section className="help-note" id="help-note" aria-label="Como funciona o simulador">
        <div><strong>Observe. Interfira. Explore.</strong><p>Arraste para orbitar, use a roda ou dois dedos para aproximar e clique em uma célula para inspecionar. Vírus aderem, infectam e se replicam; a defesa persegue alvos e ajuda as células a se recuperar.</p></div>
        <div><strong>Mesma seed, mesmo começo.</strong><p>Reinicie para repetir o experimento. Os tempos e as regras são demonstrativos e configuráveis: os números descrevem este ambiente virtual, sem prever uma infecção humana.</p></div>
      </section>}

      <section className="metrics" aria-label="Estado atual da simulação">
        <Metric label="Saudáveis" value={metrics.healthy} id="healthy" color="healthy" />
        <Metric label="Infectadas" value={metrics.infected} id="infected" color="infected" />
        <Metric label="Recuperadas" value={metrics.recovered} id="recovered" color="recovered" />
        <Metric label="Vírus ativos" value={metrics.activeViruses} id="viruses" color="virus" />
        <div className="infection-meter"><span><span>Ocupação da infecção</span><strong>{Math.round(infectionPercent)}<small>%</small></strong></span><div className="meter-track" role="meter" aria-label="Células infectadas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(infectionPercent)}><span style={{ width: `${infectionPercent}%` }} /></div><p>{number.format(metrics.neutralized)} vírus neutralizados pela defesa</p></div>
      </section>

      <section className="observation" aria-label="Câmara de observação">
        <div className="scene-topline">
          <div className="scene-label"><span className={`live-dot ${running ? 'is-running' : ''}`} /><span>{complete ? 'Experimento encerrado' : running ? 'Observação em curso' : 'Observação pausada'}</span><span className="scene-separator">/</span><time data-testid="metric-time" dateTime={`PT${Math.floor(metrics.time)}S`}>{timeLabel(metrics.time)}</time></div>
          <label className="scenario-select"><span>Cenário</span><select aria-label="Cenário" value={scenario} onChange={(event) => { setScenario(event.target.value); reset(event.target.value); }}>{SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </div>

        <SimulationCanvas cameraReset={cameraReset} cameraMove={cameraMove} />
        {!rendererInfo && !error && <div className="scene-loading" role="status"><span className="loading-orb" /><strong>Preparando o micromundo</strong><span>Inicializando a renderização 3D no seu dispositivo.</span></div>}
        {error && <div className="scene-error" role="alert"><strong>A cena 3D não pôde iniciar.</strong><p>{error}</p><p>Este simulador precisa de WebGPU ou WebGL 2 com aceleração gráfica.</p><button className="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>}

        {cell && <aside className="cell-inspector" data-testid="cell-inspector" aria-label={`Inspeção da célula ${cell.id}`}>
          <div className="inspector-head"><span className="eyebrow">Em foco</span><button className="icon-button" aria-label="Fechar inspeção" onClick={() => store().selectCell(null)}><Icon name="close" size={16} /></button></div>
          <h2>Célula <span>{String(cell.id).padStart(2, '0')}</span></h2>
          <p className={`cell-state ${cell.state}`}><span />{cellLabels[cell.state]}</p>
          <dl><div><dt>Infecções recebidas</dt><dd>{cell.infections}</dd></div><div><dt>Tempo neste estado</dt><dd>{Math.floor(cell.stateAge)} s</dd></div>{cell.state === 'infected' && <div><dt>Próxima replicação</dt><dd>{Math.max(0, Math.ceil((1 - cell.replicationProgress) * config.replicationInterval))} s</dd></div>}</dl>
          <p className="inspector-note">{cell.state === 'healthy' ? 'Pode receber partículas virais próximas.' : cell.state === 'infected' ? 'Produz novas partículas até a recuperação.' : 'Protegida contra reinfecção neste experimento.'}</p>
        </aside>}

        {complete && <div className="completion-note" role="status"><strong>{metrics.finishReason === 'contained' ? 'A infecção foi contida.' : 'O tempo do experimento terminou.'}</strong><span>{metrics.totalInfections} infecções simuladas · pico de {metrics.peakInfected} células infectadas</span><button className="text-button" onClick={() => reset()}>Repetir experimento ↗</button></div>}

        <div className="scene-bottomline">
          <div className="legend" aria-label="Legenda do ambiente"><span><i className="legend-virus" />Vírus H1N1</span><span><i className="legend-cell" />Célula</span><span><i className="legend-immune" />Defesa</span></div>
          <div className="camera-tools" role="group" aria-label="Câmera manual">
            {([['left', 'Girar à esquerda'], ['right', 'Girar à direita'], ['in', 'Aproximar'], ['out', 'Afastar']] as const).map(([action, label]) => <button key={action} className="camera-tool" aria-label={label} title={label} onClick={() => setCameraMove({ action, revision: (cameraMove?.revision ?? 0) + 1 })}><Icon name={action === 'in' ? 'plus' : action === 'out' ? 'minus' : action} size={15} /></button>)}
            <button className="camera-frame" onClick={() => { store().selectCell(null); setCameraReset((value) => value + 1); }}><Icon name="frame" size={16} /> Enquadrar</button>
          </div>
        </div>
        <div className="scene-coordinate" aria-hidden="true">in vitro / espaço simulado</div>
      </section>

      <section className="control-deck" id="controls" aria-label="Controles do experimento">
        <div className="transport-controls">
          <button className="button button-primary" disabled={complete || !!error || !rendererInfo} onClick={() => { running ? simulation.pause() : simulation.play(); store().publish(); }}><Icon name={running ? 'pause' : 'play'} />{running ? 'Pausar' : 'Iniciar'}</button>
          <label className="speed-control"><span className="sr-only">Velocidade</span><select aria-label="Velocidade" value={speed} onChange={(event) => store().setSpeed(Number(event.target.value))}>{[0.5, 1, 2, 5].map((value) => <option key={value} value={value}>{String(value).replace('.', ',')}×</option>)}</select></label>
          <button className="icon-button reset-button" aria-label="Reiniciar" title="Reiniciar com a mesma seed" onClick={() => reset()}><Icon name="reset" /></button>
        </div>
        <div className="seed-controls"><label>Vírus iniciais<input aria-label="Vírus iniciais" type="number" min={0} max={300} value={initialViruses} onChange={(event) => setInitialViruses(event.target.value)} /></label><button className="button button-subtle" aria-label="+ 20 vírus" onClick={addViruses}><Icon name="plus" size={16} />20 vírus</button><span className="field-hint">Quantidade inicial aplicada ao reiniciar.</span></div>
        <div className="defense-controls"><label htmlFor="defense">Intensidade da defesa <output htmlFor="defense">{Math.round(config.defense)}<span>/10</span></output></label><input id="defense" type="range" min={0} max={10} step={1} value={config.defense} aria-label="Intensidade da defesa" onChange={(event) => { simulation.setDefense(Number(event.target.value)); store().publish(); }} /><div className="defense-meta"><span>{metrics.immuneAgents} agentes no ambiente</span><button className="text-button" onClick={() => { simulation.setDefense(8); store().publish(); setAnnouncement('Defesa ativada com intensidade 8 de 10.'); }}><Icon name="shield" size={13} />Ativar defesa</button></div></div>
        <div className="experiment-settings"><label>Seed<input type="number" min={0} max={4294967295} aria-label="Seed" value={seed} onChange={(event) => setSeed(event.target.value)} /></label><label className="camera-toggle"><input type="checkbox" checked={autoCamera} disabled={reducedMotion} onChange={(event) => store().setAutoCamera(event.target.checked)} /><span className="toggle-track" /><Icon name="orbit" size={15} />Câmera automática</label></div>
      </section>

      <footer className="app-footer"><p><span className="footer-asterisk">✳</span> Simulação demonstrativa. Regras visuais, sem previsão clínica.</p><div className="footer-options"><label className="inspect-select"><span className="sr-only">Inspecionar célula</span><select aria-label="Inspecionar célula" value={selectedCell ?? ''} onChange={(event) => store().selectCell(event.target.value === '' ? null : Number(event.target.value))}><option value="">Inspecionar célula</option>{simulation.cells.map((item) => <option key={item.id} value={item.id}>Célula {String(item.id).padStart(2, '0')} · {cellLabels[item.state]}</option>)}</select></label><label className="reduced-toggle"><input type="checkbox" checked={reducedMotion} onChange={(event) => store().setReducedMotion(event.target.checked)} />Reduzir movimento</label><span className="renderer-status" data-testid="renderer-status">{rendererInfo ? `${rendererInfo.backend} · ${Math.round(rendererInfo.fps)} fps` : 'Iniciando 3D'}</span></div></footer>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
      <div className="sr-only" aria-label="Último evento">{events.at(-1)?.message ?? 'Experimento iniciado.'}</div>
    </main>
  );
}

function Metric({ label, value, id, color }: { label: string; value: number; id: string; color: string }) {
  return <div className={`metric metric-${color}`}><span className="metric-label"><i />{label}</span><span className="metric-value" data-testid={`metric-${id}`}>{number.format(value)}</span><span className="metric-unit">{id === 'viruses' ? 'partículas no ambiente' : 'células no ambiente'}</span></div>;
}
