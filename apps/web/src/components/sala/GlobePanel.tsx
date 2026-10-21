'use client';
import dynamic from 'next/dynamic';
import { Component, useEffect, useState, type ReactNode } from 'react';
import type { GlobeCountry } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { useTimeline } from './TimelineContext';

const Globe3D = dynamic(() => import('./Globe3D'), { ssr: false, loading: () => null });

interface Props {
  countries: GlobeCountry[];
  max: number;
  dataAsOf: string | null;
  universeNote: string;
  /** Pôster SVG renderizado no servidor (fallback e LCP). */
  poster: ReactNode;
}

class GlobeBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Hero do globo: em telas ≥ 768 px carrega o WebGL sob demanda (o pôster fica por baixo até o canvas estar pronto);
 * em telas menores mostra o pôster com o botão "Ativar globo 3D". Sem autoplay; sem rotação em reduced-motion.
 */
export function GlobePanel({ countries, max, dataAsOf, universeNote, poster }: Props) {
  const t = useTimeline();
  const [mode, setMode] = useState<'poster' | 'globe' | 'failed'>('poster');
  const [ready, setReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (isDesktop && mode === 'poster' && hasWebGL()) setMode('globe');
  }, [isDesktop, mode]);

  const showGlobe = mode === 'globe';
  return (
    <div className="hud-panel hud-corner relative overflow-hidden p-2 md:p-3">
      <div className="relative aspect-square w-full max-h-[640px] md:aspect-[1/1]">
        <div className={`absolute inset-0 transition-opacity duration-700 ${showGlobe && ready ? 'opacity-0' : 'opacity-100'}`}>{poster}</div>
        {showGlobe && (
          <GlobeBoundary onError={() => setMode('failed')}>
            <Globe3D countries={countries} weekIndex={t.index} week={t.week} max={max} reducedMotion={t.reducedMotion} playing={t.playing} dataAsOf={formatDateBR(dataAsOf)} onReady={() => setReady(true)} />
          </GlobeBoundary>
        )}
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
          {showGlobe ? (ready ? 'Globo WebGL' : 'Carregando globo…') : mode === 'failed' ? 'Globo 3D indisponível neste dispositivo' : 'Pôster estático'}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[12px] leading-snug text-muted">{universeNote}</p>
        {!isDesktop && mode === 'poster' && (
          <button type="button" className="hud-btn" onClick={() => setMode(hasWebGL() ? 'globe' : 'failed')}>
            Ativar globo 3D
          </button>
        )}
      </div>
    </div>
  );
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
