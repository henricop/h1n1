'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { nearestIndex } from '@/lib/timeline';

export interface Timeline {
  weeks: string[];
  index: number;
  week: string;
  playing: boolean;
  /** Semanas por segundo. */
  speed: number;
  reducedMotion: boolean;
  setIndex: (i: number) => void;
  setWeek: (w: string) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  /** Posiciona em `from` e reproduz até `to` (inclusive), parando ao final. */
  replay: (from: string, to: string) => void;
  goLast: () => void;
}

const Ctx = createContext<Timeline | null>(null);

export const SPEEDS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 2, label: '2 sem/s' },
  { value: 5, label: '5 sem/s' },
  { value: 10, label: '10 sem/s' },
  { value: 20, label: '20 sem/s' },
];

/**
 * Estado compartilhado do scrubber temporal (globo, contadores, mapa). Sem autoplay: a reprodução só começa
 * por ação do usuário (também respeita prefers-reduced-motion, que apenas desliga animações automáticas).
 */
export function TimelineProvider({ weeks, initialWeek, children }: { weeks: string[]; initialWeek?: string; children: ReactNode }) {
  const last = Math.max(0, weeks.length - 1);
  const [index, setIndexState] = useState(() => (initialWeek ? nearestIndex(weeks, initialWeek) : last));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const stopAt = useRef<number | null>(null);
  const reduced = useReducedMotion() ?? false;

  const setIndex = useCallback((i: number) => setIndexState(Math.min(last, Math.max(0, Math.round(i)))), [last]);
  const setWeek = useCallback((w: string) => setIndexState(nearestIndex(weeks, w)), [weeks]);
  const pause = useCallback(() => {
    stopAt.current = null;
    setPlaying(false);
  }, []);
  const play = useCallback(() => {
    if (weeks.length < 2) return;
    setIndexState((i) => (i >= last ? 0 : i));
    setPlaying(true);
  }, [weeks.length, last]);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);
  const replay = useCallback(
    (from: string, to: string) => {
      const a = nearestIndex(weeks, from);
      const b = nearestIndex(weeks, to);
      stopAt.current = Math.max(a, b);
      setIndexState(Math.min(a, b));
      setPlaying(true);
    },
    [weeks],
  );
  const goLast = useCallback(() => {
    pause();
    setIndexState(last);
  }, [pause, last]);

  useEffect(() => {
    if (!playing) return;
    const ms = Math.max(30, 1000 / speed);
    const id = window.setInterval(() => {
      setIndexState((i) => {
        const end = stopAt.current ?? last;
        if (i >= end) {
          window.clearInterval(id);
          stopAt.current = null;
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [playing, speed, last]);

  const value = useMemo<Timeline>(
    () => ({ weeks, index, week: weeks[index] ?? '', playing, speed, reducedMotion: reduced, setIndex, setWeek, play, pause, toggle, setSpeed, replay, goLast }),
    [weeks, index, playing, speed, reduced, setIndex, setWeek, play, pause, toggle, replay, goLast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTimeline(): Timeline {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTimeline precisa de <TimelineProvider>');
  return t;
}
