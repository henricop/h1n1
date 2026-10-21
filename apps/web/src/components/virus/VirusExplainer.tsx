'use client';
/**
 * Narrativa por rolagem: canvas 3D fixo (sticky) à esquerda no desktop / acima no mobile, capítulos à direita.
 * - progresso contínuo [0, 5) calculado da posição dos capítulos (linha de referência = meio da janela);
 * - prefers-reduced-motion: sem scroll-jacking; o capítulo da cena muda só pelos botões;
 * - canvas aria-hidden; alternativa textual com as peças; teclado: Anterior/Próximo e lista de peças.
 */
import dynamic from 'next/dynamic';
import { useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CHAPTERS, progressFromLayout } from '@/lib/virus/chapters';
import { CHAPTER_COPY } from '@/lib/virus/copy';
import { VIRUS_PARTS, type PartId } from '@/lib/virus/parts';
import { VirusPartPanel } from './VirusPartPanel';
import { VirusPoster } from './VirusPoster';

const VirusCanvas = dynamic(() => import('./VirusCanvas'), { ssr: false, loading: () => null });

interface Props {
  /** <Fato id> renderizados no servidor, por id, para os capítulos */
  facts: Record<string, ReactNode>;
  /** mesmos fatos com âncoras próprias para o painel da peça */
  panelFacts: Record<string, ReactNode>;
  /** mesmos fatos com âncoras próprias para a versão em texto */
  textFacts: Record<string, ReactNode>;
}

class CanvasBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
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

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function VirusExplainer({ facts, panelFacts, textFacts }: Props) {
  const reduced = useReducedMotion() ?? false;
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Array<HTMLLIElement | null>>([]);
  const layout = useRef<{ tops: number[]; heights: number[] }>({ tops: [], heights: [] });
  const progress = useMotionValue(0);
  const { scrollY } = useScroll();

  const [chapter, setChapter] = useState(0);
  const [override, setOverride] = useState<number | null>(null);
  const [mode, setMode] = useState<'poster' | 'canvas' | 'failed'>('poster');
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(false);
  const [quality, setQuality] = useState<'low' | 'high'>('low');
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [selected, setSelected] = useState<PartId | null>(null);
  const lastChip = useRef<HTMLButtonElement | null>(null);

  // reduced-motion: cena fixa por capítulo (botões); caso contrário segue a rolagem
  useEffect(() => {
    setOverride(reduced ? 0 : null);
  }, [reduced]);

  // qualidade por largura de tela
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setQuality(mq.matches ? 'high' : 'low');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // carrega o WebGL só depois da hidratação e quando a seção se aproxima da janela
  useEffect(() => {
    const el = container.current;
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (near && mode === 'poster') setMode(hasWebGL() ? 'canvas' : 'failed');
  }, [near, mode]);

  // medição dos capítulos
  const measure = useCallback(() => {
    const tops: number[] = [];
    const heights: number[] = [];
    chapterRefs.current.forEach((li) => {
      if (!li) return;
      const r = li.getBoundingClientRect();
      tops.push(r.top + window.scrollY);
      heights.push(r.height);
    });
    layout.current = { tops, heights };
  }, []);
  const update = useCallback(
    (y: number) => {
      if (layout.current.tops.length === 0) measure();
      const p = progressFromLayout(y + window.innerHeight * 0.5, layout.current.tops, layout.current.heights);
      progress.set(p);
      const idx = Math.min(CHAPTERS.length - 1, Math.floor(p));
      setChapter((c) => (c === idx ? c : idx));
    },
    [measure, progress],
  );
  useEffect(() => {
    measure();
    update(window.scrollY);
    const ro = new ResizeObserver(() => {
      measure();
      update(window.scrollY);
    });
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, update]);
  useMotionValueEvent(scrollY, 'change', (y) => {
    if (override === null) update(y);
  });

  const goTo = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(CHAPTERS.length - 1, i));
      if (override !== null) setOverride(idx);
      setChapter(idx);
      chapterRefs.current[idx]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    },
    [override, reduced],
  );

  const current = override ?? chapter;
  const select = useCallback((p: PartId) => setSelected(p), []);
  const closePanel = useCallback(() => {
    setSelected(null);
    lastChip.current?.focus();
  }, []);

  return (
    <section aria-labelledby="explicador-titulo" className="mt-6">
      <h2 id="explicador-titulo" className="sr-only">
        O vírus H1N1 em cinco capítulos
      </h2>
      <div ref={container} className="relative lg:grid lg:grid-cols-12 lg:gap-10">
        {/* ===== palco 3D (sticky) ===== */}
        <div className="sticky top-16 z-10 h-[46vh] min-h-[300px] lg:top-20 lg:col-span-7 lg:h-[calc(100vh-6rem)] lg:self-start">
          <div ref={stage} className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-bg-soft">
            <div className="relative min-h-0 flex-1">
              <VirusPoster decorative className={`absolute inset-0 h-full w-full object-contain p-6 transition-opacity duration-700 ${mode === 'canvas' && ready ? 'opacity-0' : 'opacity-100'}`} />
              {mode === 'canvas' && (
                <CanvasBoundary onError={() => setMode('failed')}>
                  <VirusCanvas
                    progress={progress}
                    chapterOverride={override}
                    reducedMotion={reduced}
                    quality={quality}
                    hovered={hovered}
                    selected={selected}
                    onHover={setHovered}
                    onSelect={select}
                    onReady={() => setReady(true)}
                  />
                </CanvasBoundary>
              )}

              {/* controles de capítulo */}
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <p className="pointer-events-auto rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs font-medium text-muted backdrop-blur" aria-live="polite">
                  Capítulo {current + 1} de {CHAPTERS.length}: <span className="text-ink">{CHAPTERS[current]?.title}</span>
                  {mode === 'failed' && <span className="ml-2 text-faint">(3D indisponível; veja a versão em texto)</span>}
                </p>
                <div className="pointer-events-auto flex gap-1.5">
                  <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0} className="touch inline-flex items-center justify-center rounded-full border border-line bg-white/90 text-ink backdrop-blur hover:border-primary-600 hover:text-primary-600 disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink" aria-label="Capítulo anterior">
                    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M12.5 4L6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => goTo(current + 1)} disabled={current === CHAPTERS.length - 1} className="touch inline-flex items-center justify-center rounded-full border border-line bg-white/90 text-ink backdrop-blur hover:border-primary-600 hover:text-primary-600 disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink" aria-label="Próximo capítulo">
                    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* lista de peças (teclado) */}
              <div className="absolute inset-x-3 bottom-3">
                <ul aria-label="Peças do vírus" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                  {VIRUS_PARTS.map((p) => {
                    const active = hovered === p.id || selected === p.id;
                    return (
                      <li key={p.id} className="shrink-0">
                        <button
                          type="button"
                          onMouseEnter={() => setHovered(p.id)}
                          onMouseLeave={() => setHovered(null)}
                          onFocus={() => setHovered(p.id)}
                          onBlur={() => setHovered(null)}
                          onClick={(e) => {
                            lastChip.current = e.currentTarget;
                            select(p.id);
                          }}
                          aria-pressed={selected === p.id}
                          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium backdrop-blur transition-colors ${active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line bg-white/90 text-ink hover:border-line-strong'}`}
                        >
                          <span className={`inline-block h-2 w-2 rounded-full ${p.color === 'primary' ? 'bg-primary-600' : p.color === 'h1n1' ? 'bg-h1n1' : p.color === 'infb' ? 'bg-infb' : 'bg-line-strong'}`} aria-hidden="true" />
                          {p.name}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {selected && (
              <div className="shrink-0 p-2 pt-0">
                <VirusPartPanel part={selected} facts={panelFacts} onClose={closePanel} onChange={select} />
              </div>
            )}
          </div>
        </div>

        {/* ===== capítulos ===== */}
        <ol className="lg:col-span-5">
          {CHAPTERS.map((ch, i) => {
            const copy = CHAPTER_COPY[i]!;
            return (
              <li
                key={ch.id}
                id={ch.id}
                ref={(el) => {
                  chapterRefs.current[i] = el;
                }}
                className="flex min-h-[70vh] scroll-mt-16 items-center py-10 lg:min-h-screen lg:scroll-mt-20 lg:py-16"
              >
                <article aria-current={current === i ? 'step' : undefined} className={`transition-opacity duration-300 ${override === null && current !== i ? 'lg:opacity-60' : 'opacity-100'}`}>
                  <p className="text-sm font-medium text-primary-600">{ch.kicker}</p>
                  <h3 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">{ch.title}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-ink">{copy.lead}</p>
                  {copy.body.map((b) => (
                    <p key={b} className="mt-3 leading-relaxed text-muted">
                      {b}
                    </p>
                  ))}
                  <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink">
                    {copy.factIds.map((id) => (
                      <p key={id}>{facts[id] ?? null}</p>
                    ))}
                  </div>
                  {copy.note && <p className="mt-3 text-xs text-faint">{copy.note}</p>}
                  {i === 1 && (
                    <p className="mt-4 text-sm text-muted">
                      Sem mouse? Use a lista de peças no palco 3D ou a{' '}
                      <a href="#versao-em-texto" className="font-medium">
                        versão em texto
                      </a>
                      .
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ===== alternativa textual ===== */}
      <details id="versao-em-texto" className="mt-8 rounded-2xl border border-line bg-bg p-4">
        <summary className="touch inline-flex cursor-pointer items-center font-medium text-primary-600">Versão em texto: as peças do vírus e o que cada uma faz</summary>
        <dl className="mt-3 grid gap-4 md:grid-cols-2">
          {VIRUS_PARTS.map((p) => (
            <div key={p.id} className="rounded-xl bg-bg-soft p-4">
              <dt className="font-display text-base font-bold text-ink">{p.label}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed text-ink">
                {p.explanation.join(' ')}
                <span className="mt-2 block space-y-2 text-sm">
                  {p.factIds.map((id) => (
                    <span key={id} className="block">
                      {textFacts[id] ?? null}
                    </span>
                  ))}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
