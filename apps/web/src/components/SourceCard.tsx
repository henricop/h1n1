import Link from 'next/link';
import type { SourceRow } from '@/lib/api';
import { formatDateBR } from '@/lib/format';

const ACCESS_LABEL: Record<string, string> = { api: 'API', open_data: 'Dados abertos', portal: 'Portal' };

export function ApiVerifiedBadge({ date }: { date: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-ok-700/30 bg-ok-100 px-2 py-0.5 text-xs font-medium text-ok-700">
      API verificada em {date}
    </span>
  );
}

export function SourceCard({ source: s }: { source: SourceRow }) {
  return (
    <article className="flex h-full flex-col rounded-md border border-line bg-paper p-4 text-sm" aria-labelledby={`src-${s.id}`}>
      <h3 id={`src-${s.id}`} className="text-base font-semibold text-ink">
        <Link href={`/dados/fontes/${s.slug}/`}>{s.name}</Link>
      </h3>
      <p className="mt-1 text-muted">
        {s.agency} · <span className="font-mono text-xs">{s.id}</span> · {s.priority}
      </p>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
        <dt className="font-medium text-ink">Categoria</dt>
        <dd>{s.category}</dd>
        <dt className="font-medium text-ink">Recorte H1N1</dt>
        <dd>{s.h1n1_scope}</dd>
        <dt className="font-medium text-ink">Cadência</dt>
        <dd>{s.update_cadence}</dd>
        <dt className="font-medium text-ink">Acesso</dt>
        <dd>
          {ACCESS_LABEL[s.access_type] ?? s.access_type}: {s.access}
        </dd>
        <dt className="font-medium text-ink">Licença</dt>
        <dd>{s.license === 'verify_per_source' ? 'verificar nos termos da fonte' : s.license}</dd>
      </dl>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        <a href={s.url} rel="noopener noreferrer" target="_blank" className="touch inline-flex items-center">
          Site oficial
        </a>
        {s.api_tested_at && <ApiVerifiedBadge date={s.api_tested_at} />}
        {s.mirror_group && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">grupo espelhado: {s.mirror_group}</span>}
      </p>
    </article>
  );
}
