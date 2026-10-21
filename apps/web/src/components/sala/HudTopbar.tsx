import Link from 'next/link';
import type { ApiResult, FreshnessRow } from '@/lib/api';
import { freshnessFor } from '@/lib/api';
import { formatDateBR } from '@/lib/format';

interface Props {
  freshness: ApiResult<{ data: FreshnessRow[] }>;
  entendaHref: string | null;
}

/** Topo da sala de dados: título, datas das bases (SIVEP e FluNet) e atalho para "Entenda o H1N1". */
export function HudTopbar({ freshness, entendaHref }: Props) {
  const sivep = freshnessFor(freshness, 'sivep_srag_ah1n1pdm09_confirmed');
  const flunet = freshnessFor(freshness, 'flunet_ah1n1pdm09_detections');
  const clock = freshness.ok
    ? `Base SIVEP-Gripe de ${formatDateBR(sivep?.data_as_of)} · base FluNet de ${formatDateBR(flunet?.data_as_of)}`
    : 'Frescor não verificado (/v1/freshness indisponível)';
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker">Sala de dados</p>
        <p className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-5xl">H1N1 em números</p>
        <p className="mt-2 max-w-2xl text-muted">Globo, mapa por UF, tendência, nowcast e composição viral, com fonte e data da base em cada número. Não é um painel em tempo real.</p>
        <p className="mt-2 text-[13px] text-faint" aria-label="Datas das bases dos dados">
          {clock}
        </p>
      </div>
      {entendaHref && (
        <Link href={entendaHref} className="btn">
          Entenda o H1N1
        </Link>
      )}
    </div>
  );
}
