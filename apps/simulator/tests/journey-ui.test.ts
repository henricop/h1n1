import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdversityEditor } from '../src/components/journey/AdversityEditor';
import { TimelineControls, type TimelineControlsProps } from '../src/components/journey/TimelineControls';
import { ScenarioComparison } from '../src/components/journey/ScenarioComparison';
import { TrajectoryChart } from '../src/components/journey/TrajectoryChart';
import { ADVERSITIES } from '../src/engine/journey/config';
import { JourneySimulation } from '../src/engine/journey/JourneySimulation';
import type { JourneySnapshot, ScenarioEvent } from '../src/journey/types';

const noop = () => {};
const event: ScenarioEvent = { id: 'ui-sleep', kind: 'sleep', startHour: 72, durationHours: 48, intensity: 'high', enabled: true };
const render = (component: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(component);
function timelineProps(snapshot: JourneySnapshot): TimelineControlsProps {
  return { hour: snapshot.simulatedHour, horizonDays: snapshot.config.horizonDays, playing: false, speed: 1,
    log: snapshot.log, events: snapshot.events, onSeek: noop, onStep: noop, onToggle: noop,
    onSpeed: noop, onReplay: noop, onHorizon: noop, onShowEvent: noop };
}

describe('journey controls render the real model contract', () => {
  it('starts paused at day zero with accessible hourly timeline, replay and day controls', () => {
    const model = new JourneySimulation();
    const html = render(createElement(TimelineControls, timelineProps(model.getSnapshot())));
    expect(model.status).toBe('paused');
    expect(html).toContain('Iniciar jornada');
    expect(html).toContain('data-testid="timeline-hour">Dia 0 · 00h');
    expect(html).toMatch(/aria-label="Linha do tempo"[^>]*max="336"/);
    expect(html).toContain('aria-label="Avançar uma hora"');
    expect(html).toContain('aria-label="Avançar um dia"');
    expect(html).toContain('aria-label="Voltar um dia"');
    expect(html).toContain('Replay');
    expect(html).toContain('21 dias');
  });

  it('keeps the clean timeline compact while preserving all time operations progressively', () => {
    const model = new JourneySimulation();
    model.upsertEvent(event); model.seek(96);
    const html = render(createElement(TimelineControls, { ...timelineProps(model.getSnapshot('B')), compact: true }));
    expect(html).toContain('journey-timeline is-compact');
    expect(html).not.toContain('journey-recent-log');
    expect(html).not.toContain('journey-timeline-caption');
    expect(html).toContain('aria-label="Linha do tempo"');
    expect(html).toContain('aria-label="Mais controles de tempo"');
    expect(html).toContain('aria-label="Avançar uma hora"');
    expect(html).toContain('aria-label="Avançar um dia"');
    expect(html).toContain('aria-label="Voltar um dia"');
    expect(html).toContain('Replay');
    expect(html).toContain('21 dias');
    expect(html).toContain('Privação de sono, Dia 3 · 00h, active');
  });

  it('places actual scheduled events and exposes one current calculated milestone preview', () => {
    const model = new JourneySimulation();
    model.upsertEvent(event); model.seek(96);
    const snapshot = model.getSnapshot('B');
    const html = render(createElement(TimelineControls, timelineProps(snapshot)));
    expect(html).toContain('Privação de sono, Dia 3 · 00h, active');
    expect(html).toContain('journey-event-marker is-active');
    const preview = html.split('class="journey-recent-log"')[1];
    expect(preview).toBeDefined();
    expect((preview!.match(/<li>/g) ?? []).length).toBe(1);
    const latest = [...snapshot.log].filter((entry) => entry.simulatedHour <= 96).sort((a, b) => b.simulatedHour - a.simulatedHour)[0]!;
    expect(preview).toContain(latest.title);
  });

  it('renders all eight high-level choices and the enabled state of real B events', () => {
    const model = new JourneySimulation();
    model.upsertEvent(event); model.seek(96);
    const html = render(createElement(AdversityEditor, { open: true, onClose: noop, events: model.getSnapshot('B').events,
      definitions: ADVERSITIES, hour: model.hour, horizonDays: 14, onApply: noop, onRemove: noop, onToggle: noop }));
    for (const item of ADVERSITIES) expect(html).toContain(`<option value="${item.kind}"`);
    for (const label of ['Tipo de evento', 'Dia de início', 'Hora de início', 'Duração em horas', 'Intensidade']) expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('In progress');
    expect(html).toContain('Dia 3 · 00h · 48 hours');
    expect(html).toContain('Aplicar ao cenário');
    expect(html).toContain('Parâmetro do modelo: eficiência da defesa e velocidade de reparo');
    model.setEventEnabled(event.id, false);
    const disabled = render(createElement(AdversityEditor, { open: true, onClose: noop, events: model.getSnapshot('B').events,
      definitions: ADVERSITIES, hour: model.hour, horizonDays: 14, onApply: noop, onRemove: noop, onToggle: noop }));
    expect(disabled).toContain('Disabled');
    expect(disabled).toContain('Editar Dormiu mal por 2 noites');
    expect(disabled).toContain('Remover Dormiu mal por 2 noites');
    const initialOnly = render(createElement(AdversityEditor, { open: true, onClose: noop, events: [],
      definitions: ADVERSITIES.filter((item) => item.kind === 'prior-protection'), hour: 96, horizonDays: 14,
      onApply: noop, onRemove: noop, onToggle: noop }));
    expect(initialOnly).toMatch(/aria-label="Dia de início"[^>]*disabled=""[^>]*value="0"/);
    expect(initialOnly).toMatch(/aria-label="Duração em horas"[^>]*max="504"/);
    expect(initialOnly).toContain('Condição inicial: aplicada antes da exposição');
  });

  it('compares current engine values and keeps four explicit index families with A/B line patterns', () => {
    const model = new JourneySimulation();
    model.upsertEvent(event); model.seek(144);
    const { A, B } = model.getComparison();
    const html = render(createElement(ScenarioComparison, { A, B, active: 'B', onSelect: noop, onShowEvent: noop }));
    expect(html).toContain('Dia 6 · 00h');
    expect(html).toContain(`seed ${A.config.seed}`);
    expect(html).toContain('Ver cenário A'); expect(html).toContain('Ver cenário B');
    expect(html).toContain('1 evento habilitado');
    expect(html).toContain(B.body.viralActivity.toFixed(1));
    expect(html).toContain(A.body.tissueIntegrity.toFixed(1));
    expect(html).toContain('stroke-dasharray="6 5"');
    expect(html).toContain('A ┄┄ · B ━━');
    expect(html).toContain('Valores no horário selecionado');
    expect(html).toContain('Fatores registrados:');
    expect(html).not.toMatch(/saturação|mortalidade|eficácia/);
    const chart = render(createElement(TrajectoryChart, { A: A.history, B: B.history, hour: 144, horizonHours: 336 }));
    expect((chart.match(/<path /g) ?? []).length).toBe(8);
    expect((chart.match(/<tr>/g) ?? []).length).toBe(5); // one heading plus four internal indices
  });
});
