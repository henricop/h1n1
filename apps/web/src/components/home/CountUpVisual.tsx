'use client';
/**
 * Contagem só visual do número gigante do ato 6 (contrato v4 §6, integridade): o número FINAL está no HTML desde
 * o SSR (span real); a contagem roda uma vez, sobre um clone `aria-hidden`, quando o bloco entra na janela,
 * dura ≤ 700 ms, só em inteiros e formatada por `formatNumberBR`. Não roda em `prefers-reduced-motion`, na
 * "Versão simples" nem para valores não inteiros; `suppressed`/indisponível nunca chegam aqui.
 */
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { formatNumberBR } from '@/lib/format';
import { isSimpleMode } from '@/lib/motion/simple-mode';

export const COUNT_DURATION_S = 0.7;

export function CountUpVisual({ value, unit, className = '' }: { value: number; unit?: string; className?: string }) {
  const real = useRef<HTMLSpanElement>(null);
  const clone = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const r = real.current;
    const c = clone.current;
    if (!r || !c || !Number.isInteger(value) || value < 0) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || isSimpleMode()) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    let tween: gsap.core.Tween | null = null;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return;
        done = true;
        io.disconnect();
        const obj = { v: 0 };
        c.textContent = formatNumberBR(0, unit);
        c.style.visibility = 'visible';
        r.style.opacity = '0';
        tween = gsap.to(obj, {
          v: value,
          duration: COUNT_DURATION_S,
          ease: 'power2.out',
          snap: { v: 1 },
          onUpdate: () => {
            c.textContent = formatNumberBR(Math.round(obj.v), unit);
          },
          onComplete: () => {
            r.style.opacity = '';
            c.style.visibility = 'hidden';
          },
        });
      },
      { threshold: 0.4 },
    );
    io.observe(r);
    return () => {
      io.disconnect();
      tween?.kill();
      r.style.opacity = '';
      c.style.visibility = 'hidden';
    };
  }, [value, unit]);
  return (
    <span className={`relative inline-block ${className}`}>
      <span ref={real}>{formatNumberBR(value, unit)}</span>
      <span ref={clone} aria-hidden="true" className="absolute inset-0" style={{ visibility: 'hidden' }} />
    </span>
  );
}
