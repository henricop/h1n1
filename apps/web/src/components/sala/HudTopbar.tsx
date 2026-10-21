import Link from 'next/link';
import type { ApiResult, FreshnessRow } from '@/lib/api';
import { freshnessFor } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { CommandPaletteButton } from './CommandPaletteButton';

interface Props {
  freshness: ApiResult<{ data: FreshnessRow[] }>;
  entendaHref: string | null;
}

/** Topo do HUD: marca, relógio de base (datas das bases SIVEP e FluNet), ⌘K e link "Entenda o H1N1". */
export function HudTopbar({ freshness, entendaHref }: Props) {
  const sivep = freshnessFor(freshness, 'sivep_srag_ah1n1pdm09_confirmed');
  const flunet = freshnessFor(freshness, 'flunet_ah1n1pdm09_detections');
  const clock = freshness.ok
    ? `base SIVEP ${formatDateBR(sivep?.data_as_of)} · FluNet ${formatDateBR(flunet?.data_as_of)}`
    : 'frescor não verificado (/v1/freshness indisponível)';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-display text-xl font-semibold tracking-tight text-ink md:text-2xl">
          H1N1 <span className="text-faint">·</span> <span className="text-signal">SALA DE SITUAÇÃO</span>
        </p>
        <p className="hud-kicker mt-1" aria-label="Relógio de base dos dados">
          <span aria-hidden="true">◴ </span>
          {clock}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CommandPaletteButton />
        {entendaHref && (
          <Link href={entendaHref} className="hud-btn">
            Entenda o H1N1
          </Link>
        )}
      </div>
    </div>
  );
}
