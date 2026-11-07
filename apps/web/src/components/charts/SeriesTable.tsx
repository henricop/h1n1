import type { SeriesObservation } from '@/lib/api';
import { formatDateBR, formatNumberBR, formatPeriod } from '@/lib/format';
import { publishedValue } from '@/lib/series';
import { NOTE, TABLE } from './ui';

interface Props {
  id: string;
  caption: string;
  obs: SeriesObservation[];
  unit: string;
  periodType?: string;
  suppressionThreshold: number;
  compact?: boolean;
}

/** Tabela HTML equivalente ao gráfico (acessível, com caption). Células suprimidas aparecem como "<5". */
export function SeriesTable({ id, caption, obs, unit, periodType, suppressionThreshold, compact }: Props) {
  const anySuppressed = obs.some((o) => o.suppressed);
  const anyProvisional = obs.some((o) => o.update_status === 'provisional');
  const t = suppressionThreshold || 5;
  return (
    <div className="overflow-x-auto">
      <table id={id} className={TABLE}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Semana</th>
            {!compact && <th scope="col">Início</th>}
            {!compact && <th scope="col">Fim</th>}
            <th scope="col" className="text-right!">
              Valor
            </th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {obs.map((o) => (
            <tr key={`${o.geo_code}-${o.period}`}>
              <th scope="row" className="font-normal">
                {formatPeriod(o.period, periodType)}
              </th>
              {!compact && <td>{formatDateBR(o.period_start)}</td>}
              {!compact && <td>{formatDateBR(o.period_end)}</td>}
              <td className="num">{o.suppressed ? `<${t}` : formatNumberBR(publishedValue(o), unit)}</td>
              <td>{o.update_status === 'provisional' ? 'provisória' : 'consolidada'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(anySuppressed || anyProvisional) && (
        <ul className={`mt-3 space-y-1 ${NOTE}`}>
          {anySuppressed && (
            <li>
              &lt;{t}: célula com contagem pequena, ocultada por privacidade para evitar reidentificação (regra 9 de integridade). O valor exato não é publicado.
            </li>
          )}
          {anyProvisional && <li>Semanas provisórias: sujeitas a atraso de notificação e digitação; tendem a subir em revisões.</li>}
        </ul>
      )}
    </div>
  );
}
