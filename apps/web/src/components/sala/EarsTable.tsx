import type { ApiResult, EarsResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod } from '@/lib/format';
import { LABEL, META, TABLE } from '@/components/charts/ui';
import { DataUnavailable } from '@/components/Notices';

/** Sinais EARS por UF: sinal estatístico, não surto confirmado. Ordem alfabética (sem ranking de UFs). */
export function EarsTable({ ears, threshold = 5 }: { ears: ApiResult<EarsResult>; threshold?: number }) {
  return (
    <section aria-labelledby="h-ears" className="card p-5 md:p-7">
      <p id="h-ears" className={LABEL}>
        Sinais estatísticos EARS (C1, C2, C3)
      </p>
      <p className="mt-2 text-[16px] font-semibold text-attention-700">Sinal estatístico, não surto confirmado.</p>
      {!ears.ok ? (
        <div className="mt-3">
          <DataUnavailable attemptedAt={ears.attemptedAt} detail={ears.error} />
        </div>
      ) : (
        <EarsBody ears={ears.data} threshold={threshold} />
      )}
    </section>
  );
}

const isSignal = (flags: string[]) => flags.some((f) => /^C[123]$/.test(f));
/** Rótulos dos flags da API em português; os demais (C1, C2, C3) seguem como vêm. */
const FLAG_LABEL: Record<string, string> = { suppressed: 'ocultado por privacidade' };

function EarsBody({ ears, threshold }: { ears: EarsResult; threshold: number }) {
  const rows = [...ears.results].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const flagged = rows.filter((r) => isSignal(r.flags));
  const period = rows[0]?.period;
  return (
    <>
      <p className="mt-2 text-[14px] text-muted">
        {flagged.length} UF{flagged.length === 1 ? '' : 's'} com sinal · semana avaliada {period ? formatPeriod(period) : '—'} · {ears.method.name} · ordem alfabética
      </p>
      <div className="mt-3 max-h-80 overflow-auto scroll-thin">
        <table className={TABLE}>
          <caption className="sr-only">Sinais EARS por UF: valor da semana, estatística C2 e flags</caption>
          <thead>
            <tr>
              <th scope="col">UF</th>
              <th scope="col" className="text-right!">
                Valor
              </th>
              <th scope="col" className="text-right!">
                C2
              </th>
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const signal = isSignal(r.flags);
              return (
                <tr key={r.geo_code} className={signal ? 'font-semibold text-attention-700' : undefined}>
                  <th scope="row" className="font-normal">
                    <abbr title={r.name}>{r.geo_code.replace('BR-', '')}</abbr>
                  </th>
                  <td className="num">{r.flags.includes('suppressed') ? `<${threshold}` : formatNumberBR(r.value)}</td>
                  <td className="num">{r.c2 === null ? '—' : r.c2.toFixed(1)}</td>
                  <td className="font-mono">{r.flags.length ? r.flags.map((f) => FLAG_LABEL[f] ?? f).join(' ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={META}>
        {ears.meta.universe_note} Baseline {ears.method.baseline} · guarda {ears.method.guard} · limiares {ears.method.thresholds}. {ears.method.note} Fonte {ears.meta.source_id} · base de {formatDateBR(ears.meta.data_as_of)}. {'<'}
        {threshold}: ocultado por privacidade.
      </p>
    </>
  );
}
