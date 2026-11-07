'use client';
/**
 * O filme (atos 0–5, contrato v4 §6/§7): contêiner do filme com o palco 3D STICKY em tela inteira
 * (`position: sticky; top: 0`, caixa de 0 px no fluxo cujo filho de 100svh fica atrás do texto; canvas opaco
 * com a cor viva do tema; grão de papel como irmão acima do canvas e abaixo do texto) e os passos de texto por
 * cima, sem cartão, sem borda, sem coluna.
 * - Desktop (≥ lg): texto à esquerda (~34 rem) sobre `.veil`; vírion deslocado à direita (`viewShift.x`).
 * - Celular (< lg): palco sticky de 46 svh no topo (acima do texto, com máscara em gradiente na borda) e texto
 *   em fluxo abaixo sobre papel opaco; sem blur/blend sobre o canvas.
 * - Progresso contínuo [0, 5) por PASSOS de texto (`[data-step]` → `progressFromSteps`), linha de referência por
 *   breakpoint (`referenceLine`), capítulo com histerese; frameloop só com o filme visível, a aba ativa, sem pausa
 *   e sem ociosidade (> 5 s sem rolagem fora do modo explorar: WCAG 2.2.2).
 * - Tema por PASSO (`data-theme`): o shell interpola; passos de transição ficam sobre painel opaco de papel claro.
 * - `prefers-reduced-motion` e "Versão simples": sem scrub; a cena assenta no capítulo atual (ou vira pôster).
 * - Canvas `aria-hidden` e irmão do texto; sem `aria-live` por rolagem; sem `aria-current="step"`.
 */
import dynamic from 'next/dynamic';
import { useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Opening } from '@/components/home/Opening';
import { actId } from '@/components/home/acts';
import { useRevealMotion } from '@/components/home/useRevealMotion';
import { scrollToEl } from '@/lib/motion/lenis';
import { isSimpleMode, onSimpleMode } from '@/lib/motion/simple-mode';
import { getLiveTheme } from '@/lib/motion/theme';
import { CHAPTERS, actAccessibleName } from '@/lib/virus/chapters';
import { STEPS_PER_CHAPTER, progressFromSteps, type StepRect } from '@/lib/virus/choreography';
import { CHAPTER_COPY, OPENING } from '@/lib/virus/copy';
import { LABEL_IDS, chapterWithHysteresis, firstStepIndices, labelDotClass, referenceLine } from '@/lib/virus/explainer';
import { PART_BY_ID, VIRUS_PARTS, type PartId } from '@/lib/virus/parts';
import type { Quality } from '@/lib/virus/pose';
import { VirusPartPanel } from './VirusPartPanel';
import { VirusPoster } from './VirusPoster';

const VirusCanvas = dynamic(() => import('./VirusCanvas'), { ssr: false, loading: () => null });

interface Props {
  /** fatos compactos renderizados no servidor, por id (contexto "filme") */
  facts: Record<string, ReactNode>;
  /** números/palavras gigantes renderizados no servidor, por id do fato */
  bigs: Record<string, ReactNode>;
  /** mesmos fatos com ids próprios para o painel da peça */
  panelFacts: Record<string, ReactNode>;
  /** href de /sintomas/sinais-de-alerta/ (null se a página não for elegível) */
  alertaHref: string | null;
}

/** Enquadramento (fração da viewport, `camera.setViewOffset`): desktop tira o vírion de baixo do texto; celular centra no palco de 46 svh. */
export const DESKTOP_VIEW_SHIFT = { x: 0.21, y: 0 } as const;
export const MOBILE_VIEW_SHIFT = { x: 0, y: 0 } as const;
/** Região (frações do canvas) onde os cartões de rótulo podem ficar: à direita do texto no desktop; o palco inteiro no celular. */
export const DESKTOP_LABEL_REGION = { left: 0.44, top: 0.08, right: 0.98, bottom: 0.88 } as const;
export const MOBILE_LABEL_REGION = { left: 0, top: 0, right: 1, bottom: 1 } as const;
/** Ociosidade (ms sem rolagem) a partir da qual a deriva para (WCAG 2.2.2). */
export const IDLE_MS = 5000;

/** Variáveis do tema `paper` forçadas no painel de transição (a tinta não pode ficar ilegível enquanto o fundo interpola). */
const PAPER_VARS = {
  '--color-ink': '#14130f',
  '--color-muted': '#4d4a42',
  '--color-faint': '#625e55',
  '--color-line': '#dcd7cb',
  '--color-line-strong': '#8a8475',
  '--color-primary-600': '#2451d6',
  '--color-primary-700': '#1e3fae',
  '--color-primary-100': '#dbe5ff',
  '--color-primary-50': '#eef3ff',
  '--color-card': '#fbfaf7',
} as CSSProperties;

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

export function VirusExplainer({ facts, bigs, panelFacts, alertaHref }: Props) {
  const reduced = useReducedMotion() ?? false;
  const film = useRef<HTMLDivElement>(null);
  const stageBox = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const layout = useRef<StepRect[]>([]);
  const stackedRef = useRef(true);
  const fallback = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef(false);
  const progress = useMotionValue(0);
  const { scrollY } = useScroll();

  const [chapter, setChapter] = useState(0);
  const [mode, setMode] = useState<'poster' | 'canvas' | 'failed'>('poster');
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [covered, setCovered] = useState(false);
  const [tabActive, setTabActive] = useState(true);
  const [stacked, setStacked] = useState(true);
  const [quality, setQuality] = useState<Quality>('low');
  const [simple, setSimple] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [selected, setSelected] = useState<PartId | null>(null);
  const labelCards = useRef<Record<PartId, HTMLButtonElement | null>>({ ha: null, na: null, rna: null, envelope: null, m1: null, m2: null });
  const lastChip = useRef<HTMLButtonElement | null>(null);

  // "Versão simples": sem 3D (pôster por ato), sem revelações
  useEffect(() => {
    setSimple(isSimpleMode());
    return onSimpleMode(setSimple);
  }, []);

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

  // layout empilhado (< lg): palco de 46 svh em cima, texto abaixo → linha de referência diferente
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

  // carrega o WebGL só depois da hidratação e quando o filme se aproxima; visível → frameloop; coberto → palco oculto
  useEffect(() => {
    const el = film.current;
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true);
      setVisible(true);
      return undefined;
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
    const vis = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting);
        setVisible(on);
        setCovered(!on);
      },
      { rootMargin: '0px', threshold: 0 },
    );
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
    if (near && mode === 'poster' && !simple) setMode(hasWebGL() ? 'canvas' : 'failed');
  }, [near, mode, simple]);

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
      const refY = referenceLine({ scrollY: y, innerHeight: window.innerHeight, stacked: stackedRef.current, stageBottom: stageBox.current?.getBoundingClientRect().bottom });
      const p = progressFromSteps(refY, layout.current, STEPS_PER_CHAPTER);
      progress.set(p);
      setChapter((c) => chapterWithHysteresis(p, c));
    },
    [measure, progress],
  );
  useEffect(() => {
    measure();
    update(window.scrollY);
    const remeasure = () => {
      measure();
      update(window.scrollY);
    };
    const ro = new ResizeObserver(remeasure);
    if (film.current) ro.observe(film.current);
    // o que muda de altura ACIMA do filme (fontes, avisos) também desloca os passos
    ro.observe(document.body);
    window.addEventListener('resize', remeasure);
    if (typeof document !== 'undefined' && 'fonts' in document) document.fonts.ready.then(remeasure, () => undefined);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', remeasure);
    };
  }, [measure, update, stacked]);

  // ociosidade: sem rolagem por 5 s a deriva para (frameloop `never`); qualquer rolagem/ponteiro retoma
  const current = chapter;
  const exploring = current === 1;
  const armIdle = useCallback(() => {
    if (idleRef.current) {
      idleRef.current = false;
      setIdle(false);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (reduced || exploring) return;
    idleTimer.current = setTimeout(() => {
      idleRef.current = true;
      setIdle(true);
    }, IDLE_MS);
  }, [reduced, exploring]);
  useEffect(() => {
    armIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [armIdle]);
  const wake = useCallback(() => {
    if (idleRef.current) armIdle();
  }, [armIdle]);
  useMotionValueEvent(scrollY, 'change', (y) => {
    update(y);
    armIdle();
  });

  const goTo = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(CHAPTERS.length - 1, i));
      setChapter(idx);
      scrollToEl(stepRefs.current[FIRST_STEP[idx] ?? 0], { reduced });
    },
    [reduced],
  );

  const active = visible && tabActive && !paused && !idle && !simple;
  const canvasOn = mode === 'canvas' && !simple;
  const select = useCallback((p: PartId) => setSelected(p), []);
  const closePanel = useCallback(() => {
    setSelected(null);
    lastChip.current?.focus();
  }, []);

  useRevealMotion(film, !reduced && !simple);

  let stepIndex = 0;

  return (
    <>
      <div ref={film} className="relative" onPointerMove={wake} onPointerDown={wake} onKeyDown={wake}>
        {/* ===== palco sticky (0 px no fluxo; o filho fica atrás do texto no desktop e acima dele no celular) ===== */}
        <div className="sticky top-0 z-20 h-0 lg:z-0">
          <div ref={stageBox} className="relative h-[46svh] w-full overflow-hidden bg-bg lg:h-[100svh]" style={{ visibility: covered ? 'hidden' : 'visible' }}>
            {/* canvas com 100 lvh para não redimensionar quando a barra do navegador recolhe */}
            <div className="absolute inset-x-0 top-0 h-[46lvh] lg:h-[100lvh]">
              {canvasOn && (
                <CanvasBoundary onError={() => setMode('failed')}>
                  <VirusCanvas
                    progress={progress}
                    chapterOverride={reduced ? current : null}
                    reducedMotion={reduced}
                    quality={quality}
                    active={active}
                    hovered={hovered}
                    selected={selected}
                    onHover={setHovered}
                    onSelect={select}
                    labelCards={labelCards}
                    onReady={() => setReady(true)}
                    onContextLost={() => {
                      setReady(false);
                      setMode('failed');
                    }}
                    onQualityFallback={onQualityFallback}
                    themeColor={getLiveTheme()}
                    viewShift={stacked ? MOBILE_VIEW_SHIFT : DESKTOP_VIEW_SHIFT}
                    eventSource={film}
                    interactive={exploring}
                    labelRegion={stacked ? MOBILE_LABEL_REGION : DESKTOP_LABEL_REGION}
                  />
                </CanvasBoundary>
              )}
              {/* grão de papel: irmão acima do canvas e abaixo do texto; o CSS o desliga em `deep` */}
              <div className="paper-grain" aria-hidden="true" />
              {/* pôster sem fundo: cobre o carregamento até os shaders compilarem; É a cena sem WebGL e na "Versão simples" */}
              <div className={`pointer-events-none absolute inset-0 z-[2] flex items-center justify-center transition-opacity duration-700 lg:justify-end lg:pr-[10vw] ${canvasOn && ready ? 'opacity-0' : 'opacity-100'}`}>
                <VirusPoster decorative variant="paper" className="h-[82%] w-auto max-w-[92%] object-contain lg:h-[66%]" />
              </div>
              {/* rótulos das peças: cartões DOM posicionados por quadro pela cena (scene/Labels.tsx) */}
              <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" aria-hidden="true">
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
                      className={`absolute left-0 top-0 w-[11.5rem] whitespace-normal rounded-xl border bg-[#fbfaf7] px-3 py-2 text-left text-[14px] leading-snug text-[#14130f] shadow-card ${forced ? 'border-[#2451d6]' : 'border-[#8a8475]'}`}
                    >
                      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${labelDotClass(id)}`} aria-hidden="true" />
                      {part.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* celular: máscara em gradiente na borda inferior do palco (o texto some por baixo) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-10 bg-linear-to-b from-transparent to-bg lg:hidden" aria-hidden="true" />
          </div>
        </div>

        {/* ===== ato 0 · abertura ===== */}
        <Opening alertaHref={alertaHref} reduced={reduced} />

        {/* ===== atos 1–5: um bloco por passo de texto ===== */}
        {CHAPTERS.map((ch, i) => {
          const copy = CHAPTER_COPY[i]!;
          const id = actId(ch.index);
          return (
            <section key={ch.id} id={id} data-act={ch.index} aria-labelledby={`${id}-titulo`} className="pointer-events-none relative z-10 scroll-mt-[48svh] lg:scroll-mt-[22svh]">
              {copy.steps.map((st, k) => {
                const g = stepIndex++;
                const theme = st.theme ?? 'paper';
                const dark = theme === 'deep' && !st.transition;
                const surface = st.transition ? 'rounded-2xl bg-[#fbfaf7] p-6 md:p-8' : dark ? 'lg:p-6' : 'veil rounded-2xl lg:p-6';
                return (
                  <div
                    key={k}
                    data-step
                    data-theme={theme}
                    ref={(el) => {
                      stepRefs.current[g] = el;
                    }}
                    className="flex min-h-[55svh] scroll-mt-[48svh] items-start px-5 py-8 md:px-10 lg:min-h-[62svh] lg:scroll-mt-[22svh] lg:items-center lg:py-10 lg:pl-[12.5rem]"
                  >
                    <div data-reveal-block className={`pointer-events-auto w-full max-w-[34rem] ${surface}`} style={st.transition ? PAPER_VARS : undefined}>
                      {k === 0 && (
                        <>
                          <p className="kicker-mono">
                            <span aria-hidden="true">( {ch.index} ) </span>
                            <span className="sr-only">{actAccessibleName(ch.index, ch.kicker)}</span>
                            <span aria-hidden="true">{ch.kicker}</span>
                          </p>
                          <h2 id={`${id}-titulo`} data-reveal-title className="display-md mt-3">
                            {ch.title}
                          </h2>
                        </>
                      )}
                      <p className={`${k === 0 ? 'mt-5' : ''} text-[19px] leading-[1.6] text-ink`}>{st.text}</p>
                      {st.big && <div className="mt-6">{bigs[st.big.factId] ?? null}</div>}
                      {st.factIds && (
                        <div className="mt-4 space-y-3">
                          {st.factIds.map((fid) => (
                            <div key={fid}>{facts[fid] ?? null}</div>
                          ))}
                        </div>
                      )}
                      {st.note && <p className="mt-3 text-[14px] leading-snug text-muted">{st.note}</p>}
                      {i === 1 && k === copy.steps.length - 1 && (
                        <>
                          <ul aria-label="Peças do vírus" className="mt-5 flex flex-wrap gap-2">
                            {VIRUS_PARTS.map((p) => {
                              const isActive = hovered === p.id || selected === p.id;
                              return (
                                <li key={p.id}>
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
                                    className={`chip min-h-[44px] gap-1.5 ${isActive ? 'border-primary-600 bg-primary-50 text-primary-700' : ''}`}
                                  >
                                    <span className={`inline-block h-2 w-2 rounded-full ${labelDotClass(p.id)}`} aria-hidden="true" />
                                    {p.name}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          <p className="mt-3 text-[14px] text-muted">
                            Sem mouse? Use esta lista ou a <a href="#versao-em-texto">versão em texto</a>.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        {/* cauda: o palco respira antes de o ato 6 (opaco) cobri-lo */}
        <div className="h-[28svh]" aria-hidden="true" />
      </div>

      {/* ===== controles do palco: fixos; somem quando o filme já foi coberto pelo ato 6 (rótulo "fora de escala" no HTML do servidor) ===== */}
      {!covered && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(46svh-3.25rem)] z-30 lg:top-auto lg:bottom-5">
          <div className="flex items-center justify-end gap-2 px-3 lg:px-6">
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-[#8a8475] bg-[#fbfaf7] px-4 font-mono text-[14px] text-[#14130f]">{OPENING.scaleLabel}</span>
            {mode === 'failed' && <span className="hidden min-h-[44px] items-center rounded-full border border-[#8a8475] bg-[#fbfaf7] px-4 font-mono text-[14px] text-[#14130f] md:inline-flex">3D indisponível: veja a versão em texto</span>}
            {canvasOn && (
              <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className="pill pointer-events-auto">
                {paused ? OPENING.resume : OPENING.pause}
              </button>
            )}
            <button type="button" onClick={() => goTo(current - 1)} disabled={current === 0} className="pill pointer-events-auto min-w-[44px] px-3 disabled:opacity-40" aria-label="Ato anterior">
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12.5 4L6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" onClick={() => goTo(current + 1)} disabled={current === CHAPTERS.length - 1} className="pill pointer-events-auto min-w-[44px] px-3 disabled:opacity-40" aria-label="Próximo ato">
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7.5 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ===== painel da peça (modo explorar): lateral no desktop, inferior no celular; papel claro opaco ===== */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex max-h-[55svh] flex-col p-3 lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-20 lg:max-h-[calc(100svh-7rem)] lg:w-[24rem] lg:p-0">
          <VirusPartPanel part={selected} facts={panelFacts} onClose={closePanel} onChange={select} />
        </div>
      )}
    </>
  );
}
