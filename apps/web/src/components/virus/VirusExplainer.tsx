'use client';
/**
 * Narrativa por rolagem: palco 3D fixo (sticky) à esquerda no desktop / acima no mobile, capítulos ao lado.
 * - progresso contínuo [0, 5) por PASSOS de texto (`[data-step]`, decisão 8): p = i + (k + frac) / n_i;
 *   linha de referência = meio da janela (desktop) ou meio da faixa visível abaixo do palco (mobile);
 * - frameloop do canvas só com a seção visível e a aba ativa (`active`); `prefers-reduced-motion`: sem
 *   scroll-jacking, o capítulo da cena muda só pelos botões (cena assentada);
 * - canvas aria-hidden; alternativa textual com as peças; teclado: Anterior/Próximo e chips de peças.
 */
import dynamic from 'next/dynamic';
import { useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CHAPTERS } from '@/lib/virus/chapters';
import { STEPS_PER_CHAPTER, progressFromSteps, settledProgress, type StepRect } from '@/lib/virus/choreography';
import { CHAPTER_COPY } from '@/lib/virus/copy';
import { LABEL_IDS, chapterWithHysteresis, dotFills, firstStepIndices, labelDotClass, referenceLine } from '@/lib/virus/explainer';
import { PART_BY_ID, VIRUS_PARTS, type PartId } from '@/lib/virus/parts';
import type { Quality } from '@/lib/virus/pose';
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

/** Índice global do primeiro passo de cada capítulo. */
const FIRST_STEP: readonly number[] = firstStepIndices(STEPS_PER_CHAPTER);

export function VirusExplainer({ facts, panelFacts, textFacts }: Props) {
  const reduced = useReducedMotion() ?? false;
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const layout = useRef<StepRect[]>([]);
  const stackedRef = useRef(true);
  const fallback = useRef(false);
  const progress = useMotionValue(0);
  const { scrollY } = useScroll();

  const [chapter, setChapter] = useState(0);
  const [override, setOverride] = useState<number | null>(null);
  const [mode, setMode] = useState<'poster' | 'canvas' | 'failed'>('poster');
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabActive, setTabActive] = useState(true);
  const [stacked, setStacked] = useState(true);
  const [quality, setQuality] = useState<Quality>('low');
  /** topo do palco sticky = altura do cabeçalho do site (2–3 linhas abaixo de lg) + folga */
  const [stageTop, setStageTop] = useState(80);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [selected, setSelected] = useState<PartId | null>(null);
  const labelCards = useRef<Record<PartId, HTMLButtonElement | null>>({ ha: null, na: null, rna: null, envelope: null, m1: null, m2: null });
  const lastChip = useRef<HTMLButtonElement | null>(null);

  // reduced-motion: cena fixa por capítulo (botões); caso contrário segue a rolagem
  useEffect(() => {
    setOverride(reduced ? 0 : null);
  }, [reduced]);

  // qualidade por largura de tela (até o PerformanceMonitor desistir: aí fica em 'low')
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setQuality(mq.matches && !fallback.current ? 'high' : 'low');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const onQualityFallback = useCallback(() => {
    fallback.current = true;
    setQuality('low');
  }, []);

  // layout empilhado (< lg): palco em cima, capítulos abaixo → linha de referência diferente
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => {
      stackedRef.current = !mq.matches;
      setStacked(!mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // o cabeçalho é sticky e muda de altura por largura: o palco (e o scroll-margin dos passos) acompanham
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const apply = () => setStageTop(Math.round(header.getBoundingClientRect().height) + 12);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // carrega o WebGL só depois da hidratação e quando a seção se aproxima da janela
  useEffect(() => {
    const el = container.current;
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true);
      setVisible(true);
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
    // observador permanente: visível na janela → frameloop ligado
    const vis = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { rootMargin: '0px', threshold: 0 });
    vis.observe(el);
    return () => {
      io.disconnect();
      vis.disconnect();
    };
  }, []);
  useEffect(() => {
    const onVis = () => setTabActive(document.visibilityState !== 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    if (near && mode === 'poster') setMode(hasWebGL() ? 'canvas' : 'failed');
  }, [near, mode]);

  // trilho de 5 pontos (DOM direto, sem setState por rolagem)
  const paintDots = useCallback((p: number) => {
    const fills = dotFills(p, CHAPTERS.length);
    dotRefs.current.forEach((el, i) => {
      if (el) el.style.transform = `scaleX(${fills[i]!.toFixed(3)})`;
    });
  }, []);

  // medição dos passos (coordenadas do documento)
  const measure = useCallback(() => {
    const y = window.scrollY;
    layout.current = stepRefs.current.filter((el): el is HTMLDivElement => Boolean(el)).map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + y, height: r.height };
    });
  }, []);
  const update = useCallback(
    (y: number) => {
      if (layout.current.length === 0) measure();
      const refY = referenceLine({ scrollY: y, innerHeight: window.innerHeight, stacked: stackedRef.current, stageBottom: stage.current?.getBoundingClientRect().bottom });
      const p = progressFromSteps(refY, layout.current, STEPS_PER_CHAPTER);
      progress.set(p);
      paintDots(p);
      setChapter((c) => chapterWithHysteresis(p, c));
    },
    [measure, progress, paintDots],
  );
  useEffect(() => {
    measure();
    if (override === null) update(window.scrollY);
    const remeasure = () => {
      measure();
      if (override === null) update(window.scrollY);
    };
    const ro = new ResizeObserver(remeasure);
    if (container.current) ro.observe(container.current);
    window.addEventListener('resize', remeasure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', remeasure);
    };
  }, [measure, update, override, stacked]);
  useMotionValueEvent(scrollY, 'change', (y) => {
    if (override === null) update(y);
  });
  useEffect(() => {
    if (override !== null) paintDots(settledProgress(override));
  }, [override, paintDots]);

  const goTo = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(CHAPTERS.length - 1, i));
      if (override !== null) setOverride(idx);
      setChapter(idx);
      stepRefs.current[FIRST_STEP[idx] ?? 0]?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    },
    [override, reduced],
  );

  const current = override ?? chapter;
  const active = visible && tabActive;
  const select = useCallback((p: PartId) => setSelected(p), []);
  const closePanel = useCallback(() => {
    setSelected(null);
    lastChip.current?.focus();
  }, []);

  let stepIndex = 0;

  return (
    <section aria-labelledby="explicador-titulo" className="mt-6">
      <h2 id="explicador-titulo" className="sr-only">
        O vírus H1N1 em cinco capítulos
      </h2>
      <div ref={container} className="relative lg:grid lg:grid-cols-12 lg:gap-10" style={{ '--stage-top': `${stageTop}px` } as CSSProperties}>
        {/* ===== palco 3D (sticky) ===== */}
        <div className="sticky top-[var(--stage-top)] z-10 h-[44svh] min-h-[280px] lg:col-span-7 lg:h-[calc(100vh_-_var(--stage-top)_-_1rem)] lg:self-start">
          <div ref={stage} className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-bg-soft">
            <div className="relative min-h-0 flex-1">
              {/* o pôster fica ACIMA do canvas (fundo opaco) até os shaders estarem compilados; depois some em fade */}
              <VirusPoster decorative className={`pointer-events-none absolute inset-0 z-[1] h-full w-full object-contain p-6 transition-opacity duration-700 ${mode === 'canvas' && ready ? 'opacity-0' : 'opacity-100'}`} />
              {mode === 'canvas' && (
                <CanvasBoundary onError={() => setMode('failed')}>
                  <VirusCanvas
                    progress={progress}
                    chapterOverride={override}
                    reducedMotion={reduced}
                    quality={quality}
                    active={active}
                    hovered={hovered}
                    selected={selected}
                    onHover={setHovered}
                    onSelect={select}
                    labelCards={labelCards}
                    onReady={() => setReady(true)}
                    onQualityFallback={onQualityFallback}
                  />
                </CanvasBoundary>
              )}

              {/* rótulos das peças: cartões DOM posicionados por quadro pela cena (scene/Labels.tsx) */}
              <div className="pointer-events-none absolute inset-0 z-[30] overflow-hidden" aria-hidden="true">
                {LABEL_IDS.map((id) => {
                  const part = PART_BY_ID.get(id)!;
                  const forced = hovered === id || selected === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      tabIndex={-1}
                      ref={(el) => {
                        labelCards.current[id] = el;
                      }}
                      onClick={() => select(id)}
                      style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none', willChange: 'transform' }}
                      className={`absolute left-0 top-0 w-[11.5rem] whitespace-normal rounded-xl border bg-white/95 px-3 py-2 text-left text-[13px] leading-snug text-ink shadow-[0_8px_30px_-12px_rgba(11,18,32,.28)] backdrop-blur ${forced ? 'border-primary-600' : 'border-line'}`}
                    >
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${labelDotClass(id)}`} aria-hidden="true" />
                      {part.label}
                    </button>
                  );
                })}
              </div>

              {/* controles de capítulo */}
              <div className="pointer-events-none absolute inset-x-3 top-3 z-[40] flex items-start justify-between gap-2">
                <div className="pointer-events-auto rounded-2xl border border-line bg-white/90 px-3 py-1.5 backdrop-blur">
                  <div aria-hidden="true" className="flex items-center gap-1">
                    {CHAPTERS.map((ch, i) => (
                      <span key={ch.id} className="relative h-1.5 w-5 overflow-hidden rounded-full bg-line">
                        <span
                          ref={(el) => {
                            dotRefs.current[i] = el;
                          }}
                          className="absolute inset-0 origin-left rounded-full bg-primary-600"
                          style={{ transform: 'scaleX(0)' }}
                        />
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted" aria-live="polite">
                    Capítulo {current + 1} de {CHAPTERS.length}: <span className="text-ink">{CHAPTERS[current]?.title}</span>
                    {mode === 'failed' && <span className="ml-2 text-faint">(3D indisponível; veja a versão em texto)</span>}
                  </p>
                </div>
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
              <div className="absolute inset-x-3 bottom-3 z-[40]">
                <ul aria-label="Peças do vírus" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
                  {VIRUS_PARTS.map((p) => {
                    const isActive = hovered === p.id || selected === p.id;
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
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium backdrop-blur transition-colors ${isActive ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line bg-white/90 text-ink hover:border-line-strong'}`}
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

        {/* ===== capítulos (um bloco por passo de texto) ===== */}
        <ol className="lg:col-span-5">
          {CHAPTERS.map((ch, i) => {
            const copy = CHAPTER_COPY[i]!;
            return (
              <li key={ch.id} id={ch.id} className="scroll-mt-[calc(var(--stage-top)_+_44svh_+_0.5rem)] lg:scroll-mt-[calc(var(--stage-top)_+_1rem)]">
                <article aria-current={current === i ? 'step' : undefined} className={`transition-opacity duration-300 ${override === null && current !== i ? 'lg:opacity-60' : 'opacity-100'}`}>
                  {copy.steps.map((st, k) => {
                    const g = stepIndex++;
                    return (
                      <div
                        key={k}
                        data-step
                        ref={(el) => {
                          stepRefs.current[g] = el;
                        }}
                        className="flex min-h-[55svh] scroll-mt-[calc(var(--stage-top)_+_44svh_+_0.5rem)] items-center py-6 lg:min-h-[60svh] lg:scroll-mt-[calc(var(--stage-top)_+_1rem)] lg:py-8"
                      >
                        <div>
                          {k === 0 && (
                            <>
                              <p className="text-sm font-medium text-primary-600">{ch.kicker}</p>
                              <h3 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">{ch.title}</h3>
                            </>
                          )}
                          <p className={k === 0 ? 'mt-4 text-lg leading-relaxed text-ink' : 'leading-relaxed text-ink'}>{st.text}</p>
                          {st.factIds && (
                            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">
                              {st.factIds.map((id) => (
                                <p key={id}>{facts[id] ?? null}</p>
                              ))}
                            </div>
                          )}
                          {st.note && <p className="mt-3 text-xs text-faint">{st.note}</p>}
                          {i === 1 && k === copy.steps.length - 1 && (
                            <p className="mt-4 text-sm text-muted">
                              Sem mouse? Use a lista de peças no palco 3D ou a{' '}
                              <a href="#versao-em-texto" className="font-medium">
                                versão em texto
                              </a>
                              .
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
