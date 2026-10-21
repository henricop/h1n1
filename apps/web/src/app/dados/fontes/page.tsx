import type { Metadata } from 'next';
import Link from 'next/link';
import { getSources, type SourceRow } from '@/lib/api';
import { slugify } from '@/lib/format';
import { SITE, absoluteUrl } from '@/lib/site';
import { Breadcrumb } from '@/components/Breadcrumb';
import { JsonLd } from '@/components/JsonLd';
import { DataUnavailable } from '@/components/Notices';
import { SourceCard } from '@/components/SourceCard';

/**
 * Dinâmica por exigência dos searchParams (prioridade, acesso). O cache de fetch da API continua com
 * API_REVALIDATE_SECONDS (1 h) em src/lib/api.ts.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fontes oficiais de dados sobre H1N1 e influenza',
  description: 'Catálogo das fontes oficiais usadas pelo H1N1: órgão, recorte H1N1, cadência, licença e tipo de acesso, agrupadas por região.',
  alternates: { canonical: '/dados/fontes/' },
};

const PRIORITIES = ['P0', 'P1', 'P2'] as const;
const ACCESS = [
  { key: 'api', label: 'API' },
  { key: 'open_data', label: 'Dados abertos' },
  { key: 'portal', label: 'Portal' },
] as const;
const REGION_ORDER = ['Brasil', 'Global', 'América Latina', 'Estados Unidos', 'Canadá', 'Reino Unido', 'União Europeia', 'Europa'];

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function FontesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const prioridade = PRIORITIES.find((p) => p === one(sp.prioridade)) ?? '';
  const acesso = ACCESS.find((a) => a.key === one(sp.acesso))?.key ?? '';
  const res = await getSources({ priority: prioridade || undefined, access_type: acesso || undefined });

  const groups = new Map<string, SourceRow[]>();
  if (res.ok) {
    for (const s of res.data.data) {
      const list = groups.get(s.region) ?? [];
      list.push(s);
      groups.set(s.region, list);
    }
  }
  const regions = [...groups.keys()].sort((a, b) => {
    const ia = REGION_ORDER.indexOf(a);
    const ib = REGION_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, 'pt-BR');
  });

  return (
    <>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Fontes oficiais', href: '/dados/fontes/' }]} />
      <header className="mt-2">
        <h1 className="text-3xl font-bold text-ink">Fontes oficiais</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Catálogo das fontes de dados consultadas pelo projeto, com o recorte que cada uma oferece sobre H1N1. Fontes do mesmo grupo espelhado reapresentam os mesmos registros e nunca são somadas.
        </p>
      </header>

      <form method="get" action="/dados/fontes/" className="mt-6 flex flex-wrap items-end gap-4 rounded-md border border-line bg-paper p-4" aria-label="Filtros do catálogo">
        <div>
          <label htmlFor="prioridade" className="block text-sm font-medium text-ink">
            Prioridade
          </label>
          <select id="prioridade" name="prioridade" defaultValue={prioridade} className="touch mt-1 rounded border border-line bg-paper px-3 py-2">
            <option value="">Todas</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="acesso" className="block text-sm font-medium text-ink">
            Tipo de acesso
          </label>
          <select id="acesso" name="acesso" defaultValue={acesso} className="touch mt-1 rounded border border-line bg-paper px-3 py-2">
            <option value="">Todos</option>
            {ACCESS.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="touch rounded border border-signal bg-signal/15 px-5 py-2 font-medium text-signal hover:bg-signal/25">
          Filtrar
        </button>
        {(prioridade || acesso) && (
          <Link href="/dados/fontes/" className="touch inline-flex items-center px-2 text-sm">
            Limpar filtros
          </Link>
        )}
      </form>

      {!res.ok ? (
        <div className="mt-6">
          <DataUnavailable attemptedAt={res.attemptedAt} detail={res.error} />
        </div>
      ) : (
        <>
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'DataCatalog',
              name: 'Catálogo de fontes oficiais do H1N1',
              url: absoluteUrl('/dados/fontes/'),
              publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
              inLanguage: 'pt-BR',
              dataset: res.data.data.map((s) => ({
                '@type': 'Dataset',
                name: s.name,
                url: absoluteUrl(`/dados/fontes/${s.slug}/`),
                creator: { '@type': 'Organization', name: s.agency },
                isBasedOn: s.url,
                license: s.license,
              })),
            }}
          />
          <p className="mt-4 text-sm text-muted" role="status">
            {res.data.data.length} fonte{res.data.data.length === 1 ? '' : 's'} {prioridade || acesso ? 'com os filtros aplicados' : 'catalogadas'}.
          </p>
          {regions.map((region) => (
            <section key={region} aria-labelledby={`regiao-${slugify(region)}`} className="mt-8">
              <h2 id={`regiao-${slugify(region)}`} className="text-xl font-semibold text-ink">
                {region} <span className="text-sm font-normal text-muted">({groups.get(region)!.length})</span>
              </h2>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {groups.get(region)!.map((s) => (
                  <li key={s.id}>
                    <SourceCard source={s} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
