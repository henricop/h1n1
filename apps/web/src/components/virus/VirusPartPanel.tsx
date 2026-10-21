'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { PART_BY_ID, VIRUS_PARTS, type PartId } from '@/lib/virus/parts';

interface Props {
  part: PartId;
  /** <Fato> já renderizados no servidor, por id */
  facts: Record<string, ReactNode>;
  onClose: () => void;
  onChange: (p: PartId) => void;
}

/** Painel lateral de uma peça: 3 a 5 frases + fatos com fonte; navegação Anterior/Próxima por teclado. */
export function VirusPartPanel({ part, facts, onClose, onChange }: Props) {
  const p = PART_BY_ID.get(part)!;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
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
    <section aria-labelledby="peca-titulo" className="flex max-h-[55%] flex-col rounded-2xl border border-line bg-white/95 shadow-[0_8px_30px_-12px_rgba(11,18,32,.18)] backdrop-blur">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <h3 id="peca-titulo" ref={heading} tabIndex={-1} className="font-display text-lg font-bold tracking-[-0.01em] text-ink outline-none md:text-xl">
          {p.label}
        </h3>
        <button type="button" onClick={onClose} className="touch -mr-2 -mt-1 inline-flex shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg-soft hover:text-ink" aria-label="Fechar explicação">
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto px-4 pb-3 text-[15px] leading-relaxed text-ink">
        <p className="mt-1">{p.explanation.join(' ')}</p>
        <div className="mt-2 space-y-2 text-[14px]">
          {p.factIds.map((id) => (
            <p key={id}>{facts[id] ?? null}</p>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <button type="button" onClick={() => onChange(prev.id)} className="touch inline-flex items-center gap-1 rounded-full px-3 text-sm font-medium text-primary-600 hover:bg-primary-50">
          <span aria-hidden="true">←</span> {prev.name}
        </button>
        <button type="button" onClick={() => onChange(next.id)} className="touch inline-flex items-center gap-1 rounded-full px-3 text-sm font-medium text-primary-600 hover:bg-primary-50">
          {next.name} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
