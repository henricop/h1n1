'use client';
import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface Props {
  value: number | null;
  format?: (v: number) => string;
  /** Texto quando o valor é nulo (não reportado/suprimido). */
  empty?: string;
  className?: string;
  duration?: number;
}

/** Contador animado (count-up) com framer-motion; sem animação em prefers-reduced-motion. */
export function CountUp({ value, format = (v) => new Intl.NumberFormat('pt-BR').format(Math.round(v)), empty = '—', className = '', duration = 0.6 }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<number | null>(value);
  const prev = useRef<number>(value ?? 0);

  useEffect(() => {
    if (value === null) {
      setShown(null);
      return;
    }
    if (reduced) {
      prev.current = value;
      setShown(value);
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        prev.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, reduced, duration]);

  return (
    <span className={`tabular-nums ${className}`} aria-live="off">
      {shown === null ? empty : format(shown)}
    </span>
  );
}
