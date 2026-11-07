import Link from 'next/link';
import type { ApiResult, FreshnessRow } from '@/lib/api';
import { freshnessFor } from '@/lib/api';
import { formatDateBR } from '@/lib/format';

interface Props {
  freshness: ApiResult<{ data: FreshnessRow[] }>;
  entendaHref: string | null;
}

/** Topo da Sala de dados: kicker mono, título em serifa, frase de apoio, datas das bases e atalho "Entenda o H1N1". */
export function DataTopbar({ freshness, entendaHref }: Props) {
  const sivep = freshnessFor(freshness, 'sivep_srag_ah1n1pdm09_confirmed');
  const flunet = freshnessFor(freshness, 'flunet_ah1n1pdm09_detections');
  const clock = freshness.ok
    ? `Base SIVEP-Gripe de ${formatDateBR(sivep?.data_as_of)} · base FluNet de ${formatDateBR(flunet?.data_as_of)}`
    : 'Frescor não verificado (/v1/freshness indisponível)';
  return (
    <header>
      <p className="kicker-mono text-[14px]!">[ Sala de dados · FluNet e SIVEP-Gripe ]</p>
      <h1 className="display-lg mt-4">H1N1 em números</h1>
      <p className="lead mt-6 max-w-3xl">Globo, mapa por UF, tendência, nowcast e composição viral, com fonte e data da base em cada número.</p>
      <p className="mt-5 max-w-3xl text-muted">Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <p className="font-mono text-[14px] text-muted" aria-label="Datas das bases dos dados">
          {clock}
        </p>
        {entendaHref && (
          <Link href={entendaHref} className="btn">
            Entenda o H1N1
          </Link>
        )}
      </div>
    </header>
  );
}
