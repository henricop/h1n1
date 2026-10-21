import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIndicators, getSource } from '@/lib/api';
import { OBSERVATORY_INDICATORS } from '@/lib/observatory';
import { absoluteUrl, SITE } from '@/lib/site';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { DataUnavailable } from '@/components/Notices';
import { ApiVerifiedBadge } from '@/components/SourceCard';

export const dynamic = 'force-dynamic';

type Params = Promise<{ idOrSlug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { idOrSlug } = await params;
  const res = await getSource(idOrSlug);
  if (!res.ok) return { title: 'Fonte de dados', robots: { index: false, follow: true } };
  const s = res.data.data;
  return {
    title: `${s.name} (${s.agency})`,
    description: `${s.name}: ${s.h1n1_scope}. Cadência ${s.update_cadence.toLowerCase()}; licença ${s.license}.`.slice(0, 160),
    alternates: { canonical: `/dados/fontes/${s.slug}/` },
  };
}

export default async function FontePage({ params }: { params: Params }) {
  const { idOrSlug } = await params;
  const res = await getSource(idOrSlug);
  if (!res.ok && res.status === 'not_found') notFound();
  if (!res.ok) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Fontes oficiais', href: '/dados/fontes/' }, { label: idOrSlug, href: null }]} />
        <div className="mt-6">
          <DataUnavailable attemptedAt={res.attemptedAt} detail={res.error} />
        </div>
      </>
    );
  }
  const s = res.data.data;
  // A API devolve os indicadores derivados junto com a fonte; fallback para /v1/indicators se o campo faltar.
  const ind = res.data.indicators ? ({ ok: true, data: { data: res.data.indicators }, fetchedAt: res.fetchedAt } as const) : await getIndicators();
  const derived = ind.ok ? ind.data.data.filter((i) => i.source_id === s.id) : [];

  return (
    <>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Fontes oficiais', href: '/dados/fontes/' }, { label: s.name, href: `/dados/fontes/${s.slug}/` }]} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Dataset',
          name: s.name,
          description: `${s.category}. ${s.h1n1_scope}. ${s.notes}`,
          url: absoluteUrl(`/dados/fontes/${s.slug}/`),
          creator: { '@type': 'Organization', name: s.agency },
          publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
          isBasedOn: s.url,
          license: s.license,
          includedInDataCatalog: { '@type': 'DataCatalog', name: 'Catálogo de fontes oficiais do H1N1', url: absoluteUrl('/dados/fontes/') },
        }}
      />
      <header className="mt-2">
        <p className="font-mono text-xs text-muted">{s.id}</p>
        <h1 className="text-3xl font-bold text-navy-900">{s.name}</h1>
        <p className="mt-1 text-muted">
          {s.agency} · {s.region} · prioridade {s.priority}
        </p>
        <p className="mt-3 flex flex-wrap gap-2">
          <a href={s.url} rel="noopener noreferrer" target="_blank" className="touch inline-flex items-center rounded-md border border-navy-700 px-4 py-2 font-medium text-navy-900 no-underline hover:bg-navy-50">
            Acessar a fonte oficial
          </a>
          {s.api_tested_at && <ApiVerifiedBadge date={s.api_tested_at} />}
        </p>
      </header>

      <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="font-medium text-navy-900">Categoria</dt>
        <dd>{s.category}</dd>
        <dt className="font-medium text-navy-900">Recorte H1N1</dt>
        <dd>{s.h1n1_scope}</dd>
        <dt className="font-medium text-navy-900">Cadência de atualização</dt>
        <dd>{s.update_cadence}</dd>
        <dt className="font-medium text-navy-900">Acesso</dt>
        <dd>{s.access}</dd>
        <dt className="font-medium text-navy-900">Licença</dt>
        <dd>{s.license === 'verify_per_source' ? 'verificar nos termos da fonte' : s.license}</dd>
        {s.mirror_group && (
          <>
            <dt className="font-medium text-navy-900">Grupo espelhado</dt>
            <dd>
              {s.mirror_group}: reapresenta registros de outras fontes do mesmo grupo; não somar entre si (regra 5 de integridade).
            </dd>
          </>
        )}
        <dt className="font-medium text-navy-900">Observações</dt>
        <dd>{s.notes}</dd>
      </dl>

      <section aria-labelledby="h-ind" className="mt-8">
        <h2 id="h-ind" className="text-xl font-semibold text-navy-900">
          Indicadores derivados desta fonte
        </h2>
        {!ind.ok ? (
          <div className="mt-2">
            <DataUnavailable attemptedAt={ind.attemptedAt} detail={ind.error} />
          </div>
        ) : derived.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhum indicador publicado a partir desta fonte até o momento. Ela consta no catálogo como referência ou está prevista para fases seguintes.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {derived.map((i) => {
              const inObservatory = OBSERVATORY_INDICATORS.some((o) => o.id === i.id);
              return (
                <li key={i.id} className="rounded-md border border-line bg-paper p-4 text-sm">
                  <p className="font-semibold text-navy-900">{i.name}</p>
                  <p className="mt-1 text-muted">{i.description}</p>
                  <p className="mt-1">
                    <span className="font-medium">Definição de caso:</span> {i.case_definition}
                  </p>
                  <p className="mt-2">
                    {inObservatory ? <Link href={`/dados/brasil/?indicador=${encodeURIComponent(i.id)}`}>Ver no observatório</Link> : <span className="text-muted">Sem visualização no observatório (ver metodologia)</span>}
                    {' · '}
                    <Link href="/dados/metodologia/">Metodologia</Link>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
