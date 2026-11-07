'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { PART_BY_ID, VIRUS_PARTS, type PartId } from '@/lib/virus/parts';

interface Props {
  part: PartId;
  /** fatos já renderizados no servidor (FactCompact), por id */
  facts: Record<string, ReactNode>;
  onClose: () => void;
  onChange: (p: PartId) => void;
}

/**
 * Painel de uma peça (modo "explorar", ato 2): 2 a 5 frases + fatos com fonte; Anterior/Próxima por teclado;
 * Esc fecha. Papel claro OPACO (cartão só porque há dado/fonte), nenhum texto abaixo de 14 px. O pai decide a
 * posição (lateral no desktop, inferior no celular) e a altura máxima.
 */
export function VirusPartPanel({ part, facts, onClose, onChange }: Props) {
  const p = PART_BY_ID.get(part)!;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [part]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const i = VIRUS_PARTS.findIndex((x) => x.id === part);
  const prev = VIRUS_PARTS[(i - 1 + VIRUS_PARTS.length) % VIRUS_PARTS.length]!;
  const next = VIRUS_PARTS[(i + 1) % VIRUS_PARTS.length]!;
  return (
    <section aria-labelledby="peca-titulo" className="card flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <h3 id="peca-titulo" ref={heading} tabIndex={-1} className="font-display text-[28px] leading-tight text-ink outline-none">
          {p.label}
        </h3>
        <button type="button" onClick={onClose} className="btn btn-sm -mr-2 shrink-0" aria-label="Fechar explicação">
          Fechar
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-5 pb-4 text-[15px] leading-relaxed text-ink scroll-thin">
        <p className="mt-2">{p.explanation.join(' ')}</p>
        <div className="mt-3 space-y-3">
          {p.factIds.map((id) => (
            <div key={id}>{facts[id] ?? null}</div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <button type="button" onClick={() => onChange(prev.id)} className="btn btn-sm border-transparent bg-transparent text-primary-600">
          <span aria-hidden="true">←</span> {prev.name}
        </button>
        <button type="button" onClick={() => onChange(next.id)} className="btn btn-sm border-transparent bg-transparent text-primary-600">
          {next.name} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
