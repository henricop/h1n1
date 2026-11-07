'use client';
import { useEffect, useRef } from 'react';
import { formatNumberBR } from '@/lib/format';
import { isSimpleMode } from '@/lib/motion/simple-mode';

interface Props {
  value: number | null;
  /** Unidade do indicador (formata com `formatNumberBR`); use no lugar de `format` em componentes de servidor (funções não cruzam a fronteira). */
  unit?: string;
  format?: (v: number) => string;
  /** Texto estático quando o valor é nulo (não reportado) ou suprimido ("<5"). */
  empty?: string;
  className?: string;
  /** Duração da contagem, em segundos (limitada a 0,7 s). */
  duration?: number;
}

const MAX_SECONDS = 0.7;

/**
 * Número com contagem SÓ VISUAL. O valor final está sempre no HTML desde o SSR (e é o que leitores de tela leem);
 * a contagem acontece UMA vez, ao entrar na tela, sobre um clone `aria-hidden` posto por cima do número final.
 * Sem contagem em `prefers-reduced-motion`, na "Versão simples" (`html[data-simple="1"]`), para valores não
 * inteiros ou pequenos (< 10), nulos e suprimidos. Mudanças posteriores de valor (scrubber) atualizam sem animar.
 */
export function CountUp({ value, unit, format, empty = '—', className = '', duration = 0.6 }: Props) {
  const fmt = format ?? ((v: number) => formatNumberBR(v, unit));
  const rootRef = useRef<HTMLSpanElement>(null);
  const finalRef = useRef<HTMLSpanElement>(null);
  const cloneRef = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  const formatRef = useRef(fmt);
  formatRef.current = fmt;

  useEffect(() => {
    const root = rootRef.current;
    const fin = finalRef.current;
    const clone = cloneRef.current;
    if (!root || !fin || !clone || played.current) return;
    if (value === null || !Number.isInteger(value) || value < 10) return;
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || isSimpleMode()) {
      played.current = true;
      return;
    }
    if (typeof IntersectionObserver === 'undefined') return;

    let raf = 0;
    let io: IntersectionObserver | null = null;
    const restore = () => {
      clone.hidden = true;
      clone.textContent = '';
      fin.style.opacity = '';
    };
    const run = () => {
      const ms = Math.min(duration, MAX_SECONDS) * 1000;
      const t0 = performance.now();
      played.current = true;
      fin.style.opacity = '0';
      clone.hidden = false;
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const eased = 1 - Math.pow(1 - k, 3);
        clone.textContent = formatRef.current(Math.round(value * eased));
        if (k < 1) raf = requestAnimationFrame(tick);
        else restore();
      };
      raf = requestAnimationFrame(tick);
    };
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io?.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(root);
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      restore();
    };
  }, [value, duration]);

  return (
    <span ref={rootRef} className={`relative inline-block tabular-nums ${className}`}>
      <span ref={finalRef}>{value === null ? empty : fmt(value)}</span>
      <span ref={cloneRef} aria-hidden="true" hidden className="pointer-events-none absolute left-0 top-0 whitespace-nowrap" />
    </span>
  );
}
