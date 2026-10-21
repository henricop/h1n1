import type { ApiResult, EarsResult } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod } from '@/lib/format';
import { DataUnavailable } from '@/components/Notices';

/** Sinais EARS por UF: sinal estatístico, não surto confirmado. */
export function EarsTable({ ears, threshold = 5 }: { ears: ApiResult<EarsResult>; threshold?: number }) {
  return (
    <section aria-labelledby="h-ears" className="card p-5">
      <p id="h-ears" className="label">
        Sinais estatísticos EARS (C1, C2, C3)
      </p>
      <p className="mt-1 text-[14px] font-semibold text-attention-700">Sinal estatístico, não surto confirmado.</p>
      {!ears.ok ? (
        <div className="mt-2">
          <DataUnavailable attemptedAt={ears.attemptedAt} detail={ears.error} />
        </div>
      ) : (
        <EarsBody ears={ears.data} threshold={threshold} />
      )}
    </section>
  );
}

function EarsBody({ ears, threshold }: { ears: EarsResult; threshold: number }) {
  const rows = [...ears.results].sort((a, b) => (b.c2 ?? -99) - (a.c2 ?? -99) || a.name.localeCompare(b.name));
  const flagged = rows.filter((r) => r.flags.some((f) => /^C[123]$/.test(f)));
  const period = rows[0]?.period;
  return (
    <>
      <p className="mt-1 text-[12px] text-faint">
        {flagged.length} UF{flagged.length === 1 ? '' : 's'} com sinal · semana avaliada {period ? formatPeriod(period) : '—'} · {ears.method.name}
      </p>
      <div className="mt-2 max-h-64 overflow-auto scroll-thin">
        <table className="data-table text-xs">
          <caption className="sr-only">Sinais EARS por UF: valor da semana, estatísticas C1, C2 e C3 e flags</caption>
          <thead>
            <tr>
              <th scope="col">UF</th>
              <th scope="col" className="text-right">
                Valor
              </th>
              <th scope="col" className="text-right">
                C2
              </th>
              <th scope="col">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const signal = r.flags.some((f) => /^C[123]$/.test(f));
              return (
                <tr key={r.geo_code} className={signal ? 'font-semibold text-attention-700' : undefined}>
                  <th scope="row" className="font-normal">
                    <abbr title={r.name}>{r.geo_code.replace('BR-', '')}</abbr>
                  </th>
                  <td className="num">{r.flags.includes('suppressed') ? `<${threshold}` : formatNumberBR(r.value)}</td>
                  <td className="num">{r.c2 === null ? '—' : r.c2.toFixed(1)}</td>
                  <td className="font-mono">{r.flags.length ? r.flags.join(' ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="meta">
        {ears.meta.universe_note} Baseline {ears.method.baseline} · guarda {ears.method.guard} · limiares {ears.method.thresholds}. {ears.method.note} Fonte {ears.meta.source_id} · base de {formatDateBR(ears.meta.data_as_of)}.
      </p>
    </>
  );
}
