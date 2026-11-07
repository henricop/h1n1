'use client';
/**
 * Trilho de atos da home (docs/reformulacao-v4.md §4, §6 e §7). API: `ProgressRail({ acts })`.
 *
 * - Desktop (≥ lg): `<nav aria-label="Atos">` fixo à esquerda, links reais `#ato-NN`; o ato que cruza o meio da
 *   janela (IntersectionObserver, `rootMargin: '-50% 0px -50% 0px'`) ganha `aria-current="location"`. "( 01 )" é
 *   decorativo (`aria-hidden`); nome acessível "Ato 1 de 7: O que é". Sem live region.
 * - Mobile: barra fina de progresso decorativa no topo (abaixo da safe area) + botão único "( 03 ) Como entra ▾"
 *   que abre a lista de atos num `<dialog>` pequeno (Esc fecha, foco volta ao botão).
 * - Clique: `scrollToEl` (Lenis ou `scrollIntoView`, instantâneo com reduced-motion/"Versão simples"), hash na
 *   URL sem salto e foco na seção (`tabindex="-1"` se faltar) para teclado e leitor de tela.
 * - Interface em papel claro opaco em qualquer tema. Renderizar fora de ancestrais com `transform`/`filter`
 *   (quebrariam o `position: fixed`).
 */
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { getLenis, scrollToEl } from '@/lib/motion/lenis';
import { actAccessibleName, actNumeral, actsProgress, type Act } from './rail';
import { PAPER_VARS, UI } from './paper';

export type { Act } from './rail';

const ROOT_MARGIN = '-50% 0px -50% 0px';

export function ProgressRail({ acts }: { acts: readonly Act[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const barRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLDialogElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const listId = `atos-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const total = acts.length;
  const idsKey = acts.map((a) => a.id).join('|');

  // Ato atual: o que entrou por último e ainda cruza a linha do meio.
  useEffect(() => {
    const ids = idsKey.split('|').filter(Boolean);
    if (ids.length === 0) return;
    const entered = new Map<string, number>();
    const observed = new Set<Element>();
    let seq = 0;
    let frame = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) entered.set(id, ++seq);
          else entered.delete(id);
        }
        let best: string | null = null;
        let bestSeq = -1;
        for (const [id, s] of entered) {
          if (s > bestSeq) {
            best = id;
            bestSeq = s;
          }
        }
        setActive(best);
      },
      { rootMargin: ROOT_MARGIN },
    );
    const scan = () => {
      frame = 0;
      for (const el of observed) {
        if (!el.isConnected) {
          io.unobserve(el);
          observed.delete(el);
          entered.delete((el as HTMLElement).id);
        }
      }
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && !observed.has(el)) {
          io.observe(el);
          observed.add(el);
        }
      }
    };
    scan();
    // Seções montadas depois (import dinâmico, troca de árvore): re-observa, coalescido por quadro.
    const mo = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
    };
  }, [idsKey]);

  // Barra fina (mobile): progresso entre o topo do primeiro ato e o fim do último; escrita direta no DOM.
  useEffect(() => {
    const ids = idsKey.split('|').filter(Boolean);
    const firstId = ids[0];
    const lastId = ids[ids.length - 1];
    if (!firstId || !lastId) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = barRef.current;
      const first = document.getElementById(firstId);
      const last = document.getElementById(lastId);
      if (!bar || !first || !last) return;
      const p = actsProgress(first.getBoundingClientRect().top, last.getBoundingClientRect().bottom, window.innerHeight / 2);
      bar.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [idsKey]);

  const unlockList = useCallback(() => {
    document.documentElement.style.removeProperty('overflow');
    getLenis()?.start();
    setListOpen(false);
  }, []);

  const closeList = useCallback(
    (opts: { focusToggle?: boolean } = {}) => {
      const d = listRef.current;
      if (d?.open) d.close();
      unlockList();
      if (opts.focusToggle !== false) toggleRef.current?.focus({ preventScroll: true });
    },
    [unlockList],
  );

  const openList = () => {
    const d = listRef.current;
    if (!d || d.open) return;
    getLenis()?.stop();
    document.documentElement.style.overflow = 'hidden';
    d.showModal();
    setListOpen(true);
    (d.querySelector<HTMLElement>('[aria-current="location"]') ?? d.querySelector<HTMLElement>('a[href]'))?.focus({ preventScroll: true });
  };

  const goTo = (e: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(id);
    if (!el) return; // sem a seção: comportamento nativo da âncora
    e.preventDefault();
    if (listRef.current?.open) closeList({ focusToggle: false });
    scrollToEl(el);
    window.history.replaceState(window.history.state, '', `#${id}`);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  };

  if (total === 0) return null;
  const activeIndex = acts.findIndex((a) => a.id === active);
  const activeAct = activeIndex >= 0 ? acts[activeIndex]! : null;

  return (
    <>
      {/* Desktop: trilho fixo à esquerda */}
      <nav aria-label="Atos" className="fixed top-1/2 left-[calc(env(safe-area-inset-left)+1rem)] z-40 hidden -translate-y-1/2 lg:block">
        <ol className="flex flex-col gap-0.5 rounded-[26px] border p-1" style={{ background: UI.surface, borderColor: UI.border }}>
          {acts.map((a, i) => {
            const current = a.id === active;
            return (
              <li key={a.id}>
                <a
                  href={`#${a.id}`}
                  aria-label={actAccessibleName(a, i + 1, total)}
                  aria-current={current ? 'location' : undefined}
                  onClick={(e) => goTo(e, a.id)}
                  className="group flex min-h-[44px] items-center gap-2 rounded-full px-3 font-mono text-[14px] whitespace-nowrap no-underline decoration-1 underline-offset-4 hover:underline"
                  style={current ? { background: UI.ink, color: UI.surface } : { color: UI.muted }}
                >
                  <span aria-hidden="true" className="tabular-nums">
                    {actNumeral(a)}
                  </span>
                  <span aria-hidden="true" className={`pr-1 font-sans text-[14px] ${current ? 'inline' : 'hidden group-hover:inline group-focus-visible:inline'}`}>
                    {a.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: barra fina decorativa + botão único com a lista */}
      <div className="lg:hidden">
        <span
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-40 block h-[3px]"
          style={{ background: 'rgba(251, 250, 247, 0.85)' }}
        >
          <span ref={barRef} className="block h-full origin-left" style={{ background: UI.ink, transform: 'scaleX(0)' }} />
        </span>
        <button
          ref={toggleRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-label={activeAct ? `Atos: ato ${activeIndex + 1} de ${total}, ${activeAct.label}` : 'Atos'}
          onClick={openList}
          className={`fixed top-[calc(env(safe-area-inset-top)+4.25rem)] left-[calc(env(safe-area-inset-left)+0.75rem)] z-40 inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[15px] font-medium ${
            activeAct ? '' : 'invisible'
          }`}
          style={{ background: UI.surface, color: UI.ink, borderColor: UI.border }}
        >
          {activeAct ? (
            <>
              <span aria-hidden="true" className="font-mono text-[14px] tabular-nums" style={{ color: UI.muted }}>
                {actNumeral(activeAct)}
              </span>
              <span>{activeAct.label}</span>
            </>
          ) : (
            <span>Atos</span>
          )}
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      <dialog
        ref={listRef}
        id={listId}
        aria-label="Atos"
        data-lenis-prevent=""
        onCancel={(e) => {
          e.preventDefault();
          closeList();
        }}
        onClose={unlockList}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeList();
        }}
        className="fixed top-[calc(env(safe-area-inset-top)+4.25rem)] right-auto bottom-auto left-[calc(env(safe-area-inset-left)+0.75rem)] m-0 max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-[20px] border p-0 shadow-card backdrop:bg-[rgba(20,19,15,0.28)]"
        style={{ ...PAPER_VARS, background: UI.surface, color: UI.ink, borderColor: UI.border }}
      >
        <div className="p-2">
          <div className="flex items-center justify-between pl-3">
            <p className="font-mono text-[14px] text-muted">Atos</p>
            <button type="button" onClick={() => closeList()} className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[15px] font-medium text-ink decoration-1 underline-offset-4 hover:underline">
              Fechar
            </button>
          </div>
          <ol>
            {acts.map((a, i) => {
              const current = a.id === active;
              return (
                <li key={a.id}>
                  <a
                    href={`#${a.id}`}
                    aria-label={actAccessibleName(a, i + 1, total)}
                    aria-current={current ? 'location' : undefined}
                    onClick={(e) => goTo(e, a.id)}
                    className="flex min-h-[48px] items-center gap-3 rounded-[14px] px-3 text-[16px] text-ink no-underline aria-[current=location]:bg-bg-soft aria-[current=location]:font-semibold"
                  >
                    <span aria-hidden="true" className="font-mono text-[14px] tabular-nums text-muted">
                      {actNumeral(a)}
                    </span>
                    <span aria-hidden="true">{a.label}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </dialog>
    </>
  );
}
