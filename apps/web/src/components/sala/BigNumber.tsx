import Link from 'next/link';
import type { ReactNode } from 'react';
import { CountUp } from './CountUp';

export interface BigNumberProps {
  id: string;
  /** Kicker em mono, ex.: "( 01 ) Último valor publicado". */
  kicker: string;
  /** Nome do indicador (ex.: "SRAG por A(H1N1)pdm09 confirmada por RT-PCR"), nunca "casos de H1N1". */
  indicatorName: string;
  /** Definição de caso do indicador. */
  definition?: string | null;
  /** Valor publicado; null quando suprimido ou sem valor. */
  value: number | null;
  suppressed: boolean;
  threshold: number;
  /** Código da unidade (`notifications`, `deaths`, `percent`…). */
  unit: string;
  /** Unidade por extenso (UNIT_LABEL). */
  unitLabel: string;
  /** Período por extenso, ex.: <Glossario>SE</Glossario> 41/2026. */
  period: ReactNode;
  /** Intervalo de datas do período, ex.: "de 05/10/2026 a 11/10/2026". */
  periodRange?: string;
  provisional: boolean;
  /** Frase de status personalizada (substitui o texto padrão de provisório/consolidado). */
  statusNote?: string;
  /** Situação curta personalizada para a lista de rótulos (padrão: provisória/consolidada). */
  statusLabel?: string;
  universe: string;
  geography: string;
  source: { name: string; agency: string; href: string };
  /** Data da base já formatada (DD/MM/AAAA). */
  baseDate: string;
  /** <FreshnessNote/> do indicador. */
  freshness?: ReactNode;
  /** Links de rodapé (série, metodologia). */
  footer?: ReactNode;
}

/**
 * Número gigante com TODOS os rótulos no mesmo bloco e desde o SSR: indicador com definição, valor + unidade,
 * período, provisório/consolidado em TEXTO, universo, fonte (link), "base de" + frescor e geografia.
 * A contagem (CountUp) é só visual; o número final já está no HTML. Suprimido: "<5" estático, sem contagem.
 */
export function BigNumber(p: BigNumberProps) {
  const t = `${p.id}-t`;
  const empty = p.suppressed ? `<${p.threshold}` : '—';
  const status = p.statusNote ?? (p.provisional ? 'Provisório: a semana ainda recebe registros e o valor tende a subir em revisões.' : 'Consolidado: a fonte não marca esta semana como provisória.');
  return (
    <article id={p.id} aria-labelledby={t} className="border-t border-ink pt-8">
      <p className="kicker-mono text-[14px]!">{p.kicker}</p>
      <h2 id={t} className="display-md mt-3 max-w-4xl">
        {p.indicatorName}
      </h2>
      {p.definition && <p className="mt-4 max-w-3xl text-muted">{p.definition}</p>}

      <p className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-2">
        <span className="bignum">
          <CountUp value={p.suppressed ? null : p.value} unit={p.unit} empty={empty} />
        </span>
        <span className="lead max-w-md pb-2 md:pb-5">
          {p.suppressed ? `menos de ${p.threshold} ${p.unitLabel}` : p.unitLabel} em {p.period}
        </span>
      </p>
      {p.suppressed && <p className="mt-3 max-w-2xl text-attention-700">Valor ocultado por privacidade: contagens abaixo de {p.threshold} não são publicadas. Isso evita identificar pessoas e não significa ausência de casos.</p>}
      <p className={`mt-4 max-w-2xl ${p.provisional ? 'text-attention-700' : 'text-muted'}`}>{status}</p>

      <dl className="mt-10 grid gap-x-12 gap-y-6 border-t border-line pt-8 sm:grid-cols-2">
        <Item label="Período">
          {p.period}
          {p.periodRange ? <span className="text-muted"> ({p.periodRange})</span> : null}
        </Item>
        <Item label="Situação">{p.statusLabel ?? (p.provisional ? 'provisória (sujeita a revisão)' : 'consolidada')}</Item>
        <Item label="Geografia">{p.geography}</Item>
        <Item label="Universo">{p.universe}</Item>
        <Item label="Fonte">
          <Link href={p.source.href}>{p.source.name}</Link> · {p.source.agency}
        </Item>
        <Item label="Base de">
          {p.baseDate} {p.freshness}
        </Item>
      </dl>
      {p.footer && <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px]">{p.footer}</div>}
    </article>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[14px] font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}
