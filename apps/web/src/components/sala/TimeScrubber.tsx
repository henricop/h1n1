'use client';
import { weekTitle } from '@/lib/hud';
import { PANDEMIC_REPLAY, parseWeek } from '@/lib/timeline';
import { LABEL } from '@/components/charts/ui';
import { SPEEDS, useTimeline } from './TimelineContext';

/** Scrubber temporal: semana ISO em serifa, range, reproduzir/pausar, velocidade e replay de 2009. */
export function TimeScrubber({ compact = false }: { compact?: boolean }) {
  const t = useTimeline();
  const n = t.weeks.length;
  const pct = n > 1 ? (t.index / (n - 1)) * 100 : 0;
  const years = t.weeks.map((w, i) => ({ w, i })).filter(({ w }) => w.endsWith('-W01'));
  const first = t.weeks[0];
  const lastWeek = t.weeks[n - 1];
  const hasReplay = !!first && !!lastWeek && first <= PANDEMIC_REPLAY.from && lastWeek >= PANDEMIC_REPLAY.to;

  return (
    <div className="card p-5 md:p-6" role="group" aria-label="Linha do tempo semanal">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={LABEL}>Semana selecionada</p>
          <p className={`mt-1 font-display font-normal tabular-nums tracking-[-0.01em] text-ink ${compact ? 'text-[1.75rem]' : 'text-[2rem] md:text-[2.5rem]'}`} aria-live="polite" aria-atomic="true">
            {weekTitle(t.week)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-sm" onClick={t.toggle} aria-pressed={t.playing} aria-label={t.playing ? 'Pausar reprodução' : 'Reproduzir semanas'}>
            <span aria-hidden="true">{t.playing ? '❚❚' : '▶'}</span>
            {t.playing ? 'Pausar' : 'Reproduzir'}
          </button>
          <label className="sr-only" htmlFor="scrubber-speed">
            Velocidade
          </label>
          <select id="scrubber-speed" className="select-field btn-sm" value={t.speed} onChange={(e) => t.setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {hasReplay && (
            <button type="button" className="btn btn-sm btn-h1n1" onClick={() => t.replay(PANDEMIC_REPLAY.from, PANDEMIC_REPLAY.to)}>
              Replay da pandemia de 2009
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={t.goLast}>
            Última semana
          </button>
        </div>
      </div>
      <div className="mt-4">
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
          aria-valuetext={weekTitle(t.week)}
        />
        {/* rótulos de eixo (exceção ao piso de 14 px): anos ímpares no desktop, de 4 em 4 no celular */}
        <div className="relative h-5 font-mono text-[12px] text-muted" aria-hidden="true">
          {years.map(({ w, i }) => {
            const y = parseWeek(w)?.year ?? 0;
            const x = n > 1 ? (i / (n - 1)) * 100 : 0;
            const desktop = compact ? y % 4 === 1 : y % 2 === 1;
            const mobile = y % 4 === 1;
            if (!desktop && !mobile) return null;
            return (
              <span key={w} className={`absolute -translate-x-1/2 tabular-nums ${desktop ? '' : 'md:hidden'} ${mobile ? '' : 'hidden md:inline'}`} style={{ left: `${x}%` }}>
                {y}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
