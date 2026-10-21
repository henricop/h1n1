'use client';
import dynamic from 'next/dynamic';
import { Component, useEffect, useState, type ReactNode } from 'react';
import type { GlobeCountry } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { useTimeline } from './TimelineContext';

const Globe3D = dynamic(() => import('./Globe3D'), { ssr: false, loading: () => null });

interface Props {
  countries: GlobeCountry[];
  /** Deslocamento da janela carregada em relação ao eixo do scrubber (0 = dataset completo). */
  offset?: number;
  /** Histórico anterior à janela ainda carregando (ver GlobeHero). */
  loadingHistory?: boolean;
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
export function GlobePanel({ countries, offset = 0, loadingHistory = false, max, dataAsOf, universeNote, poster }: Props) {
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
  const status = showGlobe ? (ready ? (loadingHistory ? 'Carregando histórico…' : 'Globo 3D') : 'Carregando globo…') : mode === 'failed' ? 'Globo 3D indisponível neste dispositivo' : 'Pôster estático';
  return (
    <div className="card relative overflow-hidden p-2 md:p-3">
      <div className="relative aspect-square w-full max-h-[640px] md:aspect-[1/1]">
        <div className={`absolute inset-0 transition-opacity duration-700 ${showGlobe && ready ? 'opacity-0' : 'opacity-100'}`}>{poster}</div>
        {showGlobe && (
          <GlobeBoundary onError={() => setMode('failed')}>
            <Globe3D countries={countries} weekIndex={t.index - offset} week={t.week} max={max} reducedMotion={t.reducedMotion} playing={t.playing} dataAsOf={formatDateBR(dataAsOf)} onReady={() => setReady(true)} />
          </GlobeBoundary>
        )}
        <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-[12px] text-muted" aria-live="polite">
          {status}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[13px] leading-snug text-muted">{universeNote}</p>
        {!isDesktop && mode === 'poster' && (
          <button type="button" className="btn btn-sm" onClick={() => setMode(hasWebGL() ? 'globe' : 'failed')}>
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
