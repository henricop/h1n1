'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Termo com definição (parte interativa de <Glossario>). Padrão "tooltip" acessível (WCAG 1.4.13):
 *  - abre por foco (teclado), passagem do mouse ou toque; fecha com Esc, ao sair do foco/mouse ou ao tocar fora;
 *  - o ponteiro pode ir até a definição sem ela sumir (a definição fica dentro do mesmo invólucro, com uma ponte
 *    transparente sobre o intervalo);
 *  - a definição está sempre no DOM e ligada ao termo por `aria-describedby` (leitor de tela lê mesmo fechada);
 *  - a caixa é empurrada para dentro da janela quando o termo está perto da borda.
 */
export function GlossarioTip({ term, definition, children }: { term: string; definition: string; children: ReactNode }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const wrap = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  // Tipo do último ponteiro: no toque, o mouseenter sintético não pode abrir (o clique que vem depois alterna).
  const pointer = useRef<'mouse' | 'touch'>('mouse');

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  // Mantém a caixa dentro da janela (margem de 12 px).
  useLayoutEffect(() => {
    if (!open) {
      setShift(0);
      return;
    }
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 12;
    const overflowRight = r.right - (window.innerWidth - margin);
    const overflowLeft = margin - r.left;
    setShift(overflowRight > 0 ? -overflowRight : overflowLeft > 0 ? overflowLeft : 0);
  }, [open]);

  return (
    <span
      ref={wrap}
      className="relative inline"
      onPointerEnter={(e) => {
        pointer.current = e.pointerType === 'touch' ? 'touch' : 'mouse';
      }}
      onMouseEnter={() => {
        if (pointer.current !== 'touch') setOpen(true);
      }}
      onMouseLeave={() => {
        if (pointer.current !== 'touch') close();
      }}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        type="button"
        aria-describedby={tipId}
        className="cursor-help border-b border-dotted border-primary-600 p-0 text-left align-baseline"
        onPointerDown={(e) => {
          pointer.current = e.pointerType === 'touch' ? 'touch' : 'mouse';
        }}
        onFocus={(e) => {
          // só foco de teclado abre (foco por clique/toque não: o clique cuida do estado)
          if (e.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        onClick={() => {
          // toque alterna; mouse e teclado só garantem que está aberta
          setOpen((o) => (pointer.current === 'touch' ? !o : true));
        }}
      >
        <dfn className="not-italic">{children}</dfn>
      </button>
      <span
        ref={box}
        id={tipId}
        role="tooltip"
        tabIndex={-1}
        style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        className={
          open
            ? 'absolute left-0 top-full z-30 block w-[min(22rem,calc(100vw-1.5rem))] pt-2 text-left font-sans text-[15px] font-normal not-italic leading-snug tracking-normal text-ink outline-none'
            : 'sr-only'
        }
      >
        <span className="block rounded-md border border-line-strong bg-card p-4 shadow-card">
          <strong className="font-semibold">{term}</strong>: {definition}
          <span aria-hidden="true" className="mt-2 block font-mono text-[14px] text-muted">
            Esc fecha
          </span>
        </span>
      </span>
    </span>
  );
}
