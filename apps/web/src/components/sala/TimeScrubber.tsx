'use client';
import { PANDEMIC_REPLAY, parseWeek, weekLabel } from '@/lib/timeline';
import { SPEEDS, useTimeline } from './TimelineContext';

/** Scrubber temporal: rótulo grande da semana ISO, range, play/pause, velocidade e replay de 2009. */
export function TimeScrubber({ compact = false }: { compact?: boolean }) {
  const t = useTimeline();
  const n = t.weeks.length;
  const pct = n > 1 ? (t.index / (n - 1)) * 100 : 0;
  const years = t.weeks.map((w, i) => ({ w, i })).filter(({ w }) => w.endsWith('-W01'));
  const first = t.weeks[0];
  const lastWeek = t.weeks[n - 1];
  const hasReplay = !!first && !!lastWeek && first <= PANDEMIC_REPLAY.from && lastWeek >= PANDEMIC_REPLAY.to;

  return (
    <div className="hud-panel hud-corner p-3 md:p-4" role="group" aria-label="Linha do tempo semanal">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label">Semana selecionada</p>
          <p className={`glow-signal font-display font-semibold tabular-nums text-signal ${compact ? 'text-xl' : 'text-2xl md:text-3xl'}`} aria-live="polite" aria-atomic="true">
            {weekLabel(t.week)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="hud-btn" onClick={t.toggle} aria-pressed={t.playing} aria-label={t.playing ? 'Pausar reprodução' : 'Reproduzir semanas'}>
            <span aria-hidden="true">{t.playing ? '❚❚' : '▶'}</span>
            {t.playing ? 'Pausar' : 'Reproduzir'}
          </button>
          <label className="sr-only" htmlFor="scrubber-speed">
            Velocidade
          </label>
          <select id="scrubber-speed" className="hud-select" value={t.speed} onChange={(e) => t.setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {hasReplay && (
            <button type="button" className="hud-btn hud-btn-h1n1" onClick={() => t.replay(PANDEMIC_REPLAY.from, PANDEMIC_REPLAY.to)}>
              Replay da pandemia de 2009
            </button>
          )}
          <button type="button" className="hud-btn" onClick={t.goLast}>
            Última semana
          </button>
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor="scrubber" className="sr-only">
          Semana ISO (de {first} a {lastWeek})
        </label>
        <input
          id="scrubber"
          type="range"
          className="scrubber"
          min={0}
          max={Math.max(0, n - 1)}
          step={1}
          value={t.index}
          onChange={(e) => {
            t.pause();
            t.setIndex(Number(e.target.value));
          }}
          style={{ ['--progress' as string]: `${pct}%` }}
          aria-valuetext={weekLabel(t.week)}
        />
        <div className="relative h-4 font-mono text-[10px] text-faint" aria-hidden="true">
          {years.map(({ w, i }) => {
            const y = parseWeek(w)?.year ?? '';
            const x = n > 1 ? (i / (n - 1)) * 100 : 0;
            const show = compact ? Number(y) % 4 === 1 : Number(y) % 2 === 1;
            return show ? (
              <span key={w} className="absolute -translate-x-1/2" style={{ left: `${x}%` }}>
                {y}
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
