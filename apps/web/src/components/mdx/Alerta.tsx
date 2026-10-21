import type { ReactNode } from 'react';

type Tipo = 'emergencia' | 'atencao' | 'info';

const STYLES: Record<Tipo, { box: string; label: string; role: 'alert' | 'note' }> = {
  emergencia: { box: 'border-urgent-700 bg-urgent-50 text-urgent-700', label: 'Procure atendimento', role: 'alert' },
  atencao: { box: 'border-attention-700 bg-attention-100 text-attention-700', label: 'Atenção', role: 'note' },
  info: { box: 'border-navy-600 bg-navy-50 text-ink', label: 'Informação', role: 'note' },
};

export function Alerta({ tipo = 'info', titulo, children }: { tipo?: Tipo; titulo?: string; children: ReactNode }) {
  const s = STYLES[tipo] ?? STYLES.info;
  return (
    <div role={s.role} className={`my-6 rounded-md border-l-4 p-4 ${s.box}`}>
      <p className="font-semibold">{titulo ?? s.label}</p>
      <div className="mt-1 text-[0.97em] [&>p]:my-2 [&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-5">{children}</div>
    </div>
  );
}
