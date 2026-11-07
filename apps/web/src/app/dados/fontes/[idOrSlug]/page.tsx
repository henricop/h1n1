import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIndicators, getSource } from '@/lib/api';
import { OBSERVATORY_INDICATORS } from '@/lib/observatory';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataUnavailable } from '@/components/Notices';
import { ApiVerifiedBadge, Tag, licenseLabel } from '@/components/SourceCard';
import { FRAME, FRAME_TOP, KICKER, SECTION_TITLE } from '@/components/mdx/frame';
import { markVirus, SERIF_CLASS } from '@/components/mdx/mark';

/** ISR: igual a API_REVALIDATE_SECONDS (src/lib/api.ts); literal por exigência do Next (ver test/cache-policy.test.ts). */
export const revalidate = 3600;

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
      <div className={`${FRAME} ${FRAME_TOP} pb-24 md:pb-32`}>
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Fontes oficiais', href: '/dados/fontes/' }, { label: idOrSlug, href: null }]} />
        <div className="mt-10">
          <DataUnavailable attemptedAt={res.attemptedAt} detail={res.error} />
        </div>
      </div>
    );
  }
  const s = res.data.data;
  // A API devolve os indicadores derivados junto com a fonte; fallback para /v1/indicators se o campo faltar.
  const ind = res.data.indicators ? ({ ok: true, data: { data: res.data.indicators }, fetchedAt: res.fetchedAt } as const) : await getIndicators();
  const derived = ind.ok ? ind.data.data.filter((i) => i.source_id === s.id) : [];

  const meta: Array<[string, React.ReactNode]> = [
    ['categoria', s.category],
    ['recorte H1N1', s.h1n1_scope],
    ['cadência de atualização', s.update_cadence],
    ['acesso', s.access],
    ['licença', licenseLabel(s.license)],
  ];

  return (
    <div className={`${FRAME} ${FRAME_TOP} pb-24 md:pb-32`}>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Fontes oficiais', href: '/dados/fontes/' }, { label: s.name, href: `/dados/fontes/${s.slug}/` }]} />
      {/* Sem JSON-LD Dataset aqui: a fonte é catalogada (DataCatalog em /dados/fontes/); Dataset só no observatório (série derivada). */}
      <header className="mt-8 md:mt-12">
        <p className={KICKER}>
          <span aria-hidden="true">[ </span>
          {s.id}
          <span aria-hidden="true"> ]</span>
        </p>
        <h1 className="display-lg mt-5 max-w-5xl text-balance">{markVirus(s.name)}</h1>
        <p className="mt-6 font-mono text-[14px] leading-relaxed text-muted md:mt-8">
          {s.agency} · {s.region} · prioridade {s.priority}
        </p>
        <p className="mt-6 flex flex-wrap items-center gap-3">
          <a href={s.url} rel="noopener noreferrer" target="_blank" className="btn btn-primary">
            Acessar a fonte oficial
          </a>
          {s.api_tested_at && <ApiVerifiedBadge date={s.api_tested_at} />}
          {s.mirror_group && <Tag>grupo espelhado: {s.mirror_group}</Tag>}
        </p>
      </header>

      <dl className="mt-16 max-w-4xl space-y-5 border-t border-ink pt-8 text-[17px] leading-relaxed md:mt-24">
        {meta.map(([label, value]) => (
          <div key={label} className="grid gap-x-12 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <dt className="font-mono text-[14px] text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {s.mirror_group && (
          <div className="grid gap-x-12 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <dt className="font-mono text-[14px] text-muted">grupo espelhado</dt>
            <dd>{s.mirror_group}: reapresenta registros de outras fontes do mesmo grupo; não somar entre si (regra 5 de integridade).</dd>
          </div>
        )}
      </dl>

      {s.notes && (
        <section aria-labelledby="h-notas" className="mt-16 md:mt-24">
          <h2 id="h-notas" className={SECTION_TITLE}>
            Observações
          </h2>
          <div className="prose mt-6">
            <p>{s.notes}</p>
          </div>
        </section>
      )}

      <section aria-labelledby="h-ind" className="mt-16 md:mt-24">
        <h2 id="h-ind" className={SECTION_TITLE}>
          Indicadores derivados desta fonte
        </h2>
        {!ind.ok ? (
          <div className="mt-6">
            <DataUnavailable attemptedAt={ind.attemptedAt} detail={ind.error} />
          </div>
        ) : derived.length === 0 ? (
          <p className="mt-6 max-w-2xl text-[17px] text-muted">Nenhum indicador publicado a partir desta fonte até o momento. Ela consta no catálogo como referência ou está prevista para fases seguintes.</p>
        ) : (
          <ul className="mt-10">
            {derived.map((i) => {
              const inObservatory = OBSERVATORY_INDICATORS.some((o) => o.id === i.id);
              return (
                <li key={i.id} className="border-t border-line py-8">
                  <p className={`${SERIF_CLASS} font-display text-[1.75rem] leading-[1.1] tracking-[-0.01em] text-ink md:text-[2rem]`}>{markVirus(i.name)}</p>
                  <p className="mt-3 max-w-3xl text-[17px] text-muted">{i.description}</p>
                  <p className="mt-3 max-w-3xl text-[17px]">
                    <span className="font-mono text-[14px] text-muted">definição de caso</span> {i.case_definition}
                  </p>
                  <p className="mt-4 text-[15px]">
                    {inObservatory ? (
                      <Link href={`/dados/brasil/?indicador=${encodeURIComponent(i.id)}`} aria-label={`Ver ${i.name} no observatório`}>
                        Ver no observatório
                      </Link>
                    ) : (
                      <span className="text-muted">Sem visualização no observatório (ver metodologia)</span>
                    )}
                    {' · '}
                    <Link href="/dados/metodologia/">Metodologia</Link>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
