import type { ReactNode } from 'react';

type Tipo = 'emergencia' | 'atencao' | 'info';

/**
 * Faixas de aviso (sem cartão arredondado). Vermelho (`urgent`) só em "emergencia"; "atencao" em âmbar; "info" em
 * cobalto claro. O ícone é um glifo de texto (decorativo): o significado vem do título, nunca só da cor.
 */
const STYLES: Record<Tipo, { band: string; mark: string; title: string; glyph: string; label: string; role: 'alert' | 'note' }> = {
  emergencia: {
    band: 'border-urgent-700 bg-urgent-50',
    mark: 'border-urgent-700 text-urgent-700',
    title: 'text-urgent-700',
    glyph: '!',
    label: 'Procure atendimento',
    role: 'alert',
  },
  atencao: {
    band: 'border-attention-700 bg-attention-100',
    mark: 'border-attention-700 text-attention-700',
    title: 'text-attention-700',
    glyph: '!',
    label: 'Atenção',
    role: 'note',
  },
  info: {
    band: 'border-primary-600 bg-primary-50',
    mark: 'border-primary-600 text-primary-700',
    title: 'text-primary-700',
    glyph: 'i',
    label: 'Informação',
    role: 'note',
  },
};

export function Alerta({ tipo = 'info', titulo, children }: { tipo?: Tipo; titulo?: string; children: ReactNode }) {
  const s = STYLES[tipo] ?? STYLES.info;
  return (
    <div role={s.role} data-alerta={tipo} className={`my-10 flex gap-4 border-l-4 px-5 py-5 md:gap-5 md:px-7 md:py-6 ${s.band}`}>
      <span aria-hidden="true" className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[16px] font-bold leading-none ${s.mark}`}>
        {s.glyph}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-mono text-[14px] font-medium leading-8 ${s.title}`}>{titulo ?? s.label}</p>
        <div className="mt-1 text-ink [&>p]:my-3! [&>p:first-child]:mt-0! [&>p:last-child]:mb-0! [&>ul]:my-3! [&>ul]:list-disc [&>ul]:pl-5">{children}</div>
      </div>
    </div>
  );
}
