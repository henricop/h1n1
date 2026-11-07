import Link from 'next/link';
import type { SourceRow } from '@/lib/api';
import { markVirus, SERIF_CLASS } from '@/components/mdx/mark';

const ACCESS_LABEL: Record<string, string> = { api: 'API', open_data: 'Dados abertos', portal: 'Portal' };

export function licenseLabel(license: string): string {
  return license === 'verify_per_source' ? 'verificar nos termos da fonte' : license;
}

export function ApiVerifiedBadge({ date }: { date: string }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-ok-700/40 bg-ok-100 px-3 py-0.5 text-[14px] font-medium text-ok-700">
      API verificada em {date}
    </span>
  );
}

/** Etiqueta não interativa (categoria, prioridade, acesso). */
export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-7 items-center rounded-full border border-line-strong px-3 py-0.5 text-[14px] leading-tight text-ink">{children}</span>;
}

/**
 * Fonte do catálogo como LINHA editorial (sem cartão): nome em serifa (≥ 28 px), órgão · país · licença em mono,
 * chips de categoria/prioridade/acesso; à direita, o recorte H1N1 e os metadados.
 */
export function SourceCard({ source: s }: { source: SourceRow }) {
  return (
    <article className="grid gap-5 border-t border-line py-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 md:py-10" aria-labelledby={`src-${s.id}`}>
      <div>
        <h3 id={`src-${s.id}`} className={`${SERIF_CLASS} font-display text-[1.75rem] leading-[1.08] tracking-[-0.01em] text-ink md:text-[2.125rem]`}>
          <Link href={`/dados/fontes/${s.slug}/`} className="text-ink no-underline decoration-line-strong underline-offset-4 hover:underline">
            {markVirus(s.name)}
          </Link>
        </h3>
        <p className="mt-3 font-mono text-[14px] leading-snug text-muted">
          {s.agency} · {s.country} · {licenseLabel(s.license)}
        </p>
        <p className="mt-4 flex flex-wrap gap-2">
          <Tag>{s.category}</Tag>
          <Tag>prioridade {s.priority}</Tag>
          <Tag>{ACCESS_LABEL[s.access_type] ?? s.access_type}</Tag>
          {s.mirror_group && <Tag>grupo espelhado: {s.mirror_group}</Tag>}
        </p>
      </div>
      <div>
        <p className="text-[17px] leading-relaxed text-ink">{s.h1n1_scope}</p>
        <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-1.5 text-[15px]">
          <dt className="font-mono text-[14px] text-muted">código</dt>
          <dd className="font-mono text-[14px]">{s.id}</dd>
          <dt className="font-mono text-[14px] text-muted">cadência</dt>
          <dd>{s.update_cadence}</dd>
          <dt className="font-mono text-[14px] text-muted">acesso</dt>
          <dd>{s.access}</dd>
        </dl>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
          <a href={s.url} rel="noopener noreferrer" target="_blank" aria-label={`Site oficial de ${s.name}`} className="touch inline-flex items-center">
            Site oficial
          </a>
          <Link href={`/dados/fontes/${s.slug}/`} aria-label={`Ficha da fonte ${s.name}`} className="touch inline-flex items-center">
            Ficha da fonte
          </Link>
          {s.api_tested_at && <ApiVerifiedBadge date={s.api_tested_at} />}
        </p>
      </div>
    </article>
  );
}
