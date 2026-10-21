import type { Metadata } from 'next';
import Link from 'next/link';
import { freshnessState, getFreshness, getSeries } from '@/lib/api';
import { eligiblePages, firstEligible } from '@/lib/content';
import { formatDateBR } from '@/lib/format';
import { SITE } from '@/lib/site';
import { IndicatorCard } from '@/components/IndicatorCard';
import { JsonLd } from '@/components/JsonLd';

/** ISR: igual a API_REVALIDATE_SECONDS (src/lib/api.ts); literal por exigência do Next (ver test/cache-policy.test.ts). */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `${SITE.name}: ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: '/' },
};

const HOME_INDICATORS = {
  sivep: 'sivep_srag_ah1n1pdm09_confirmed',
  flunet: 'flunet_ah1n1pdm09_detections',
} as const;

export default async function HomePage() {
  const pages = eligiblePages();
  const q = (candidates: string[]) => firstEligible(candidates, pages);

  const questions = [
    { label: 'Quais são os sintomas?', href: q(['/sintomas/', '/sintomas/sinais-de-alerta/', '/o-que-e-h1n1/']) },
    { label: 'Como se transmite?', href: q(['/transmissao/', '/o-que-e-h1n1/']) },
    { label: 'Vacina protege?', href: q(['/vacina/', '/prevencao/', '/o-que-e-h1n1/']) },
    { label: 'Quando procurar atendimento?', href: q(['/sintomas/sinais-de-alerta/', '/sintomas/', '/o-que-e-h1n1/']) },
  ].filter((x): x is { label: string; href: string } => x.href !== null);

  const quick = [
    { label: 'Comparar doenças respiratórias', href: q(['/comparar/', '/comparar/h1n1-vs-gripe-comum/', '/comparar/h1n1-vs-covid/']) },
    { label: 'Linha do tempo desde 2009', href: q(['/historia/']) },
    { label: 'Prevenção', href: q(['/prevencao/', '/vacina/']) },
  ].filter((x): x is { label: string; href: string } => x.href !== null);

  const [sivep, flunet, fresh] = await Promise.all([
    getSeries({ indicator: HOME_INDICATORS.sivep, geo_level: 'country', geo_code: 'BRA' }),
    getSeries({ indicator: HOME_INDICATORS.flunet, geo_level: 'country', geo_code: 'BRA' }),
    getFreshness(),
  ]);
  const bases = [sivep.ok ? sivep.data.meta.data_as_of : null, flunet.ok ? flunet.data.meta.data_as_of : null].filter((d): d is string => !!d).sort();
  const lastBase = bases[bases.length - 1] ?? null;

  const institutional = [
    { label: 'Fontes oficiais', href: '/dados/fontes/' },
    { label: 'Equipe e revisão', href: q(['/sobre/equipe-e-revisao/']) },
    { label: 'Política editorial', href: q(['/sobre/politica-editorial/']) },
  ].filter((x): x is { label: string; href: string } => x.href !== null);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', '@id': `${SITE.url}/#organization`, name: SITE.name, url: SITE.url, description: SITE.description },
            { '@type': 'WebSite', '@id': `${SITE.url}/#website`, name: SITE.name, url: SITE.url, inLanguage: 'pt-BR', publisher: { '@id': `${SITE.url}/#organization` } },
          ],
        }}
      />
      <section aria-labelledby="h-home" className="py-6 sm:py-10">
        <h1 id="h-home" className="text-3xl font-bold leading-tight text-navy-900 sm:text-4xl">
          O que você precisa saber sobre H1N1?
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">Informação de saúde revisada e dados de fontes oficiais, com o recorte de cada número explicado.</p>
        {questions.length > 0 ? (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {questions.map((b) => (
              <li key={b.label}>
                <Link href={b.href} className="touch flex items-center rounded-md border border-navy-100 bg-paper px-4 py-3 text-base font-medium text-navy-900 no-underline shadow-sm hover:border-navy-600 hover:bg-navy-50">
                  {b.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-md border border-line bg-paper p-4 text-sm text-muted">As páginas de orientação estão em revisão clínica e serão publicadas após a revisão. Enquanto isso, consulte o observatório e as fontes oficiais.</p>
        )}
        <p className="mt-4 text-sm text-muted">{SITE.medicalDisclaimer} Em caso de sinais de alerta, procure um serviço de saúde.</p>
      </section>

      <section aria-labelledby="h-brasil" className="border-t border-line py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="h-brasil" className="text-2xl font-semibold text-navy-900">
            H1N1 no Brasil
          </h2>
          <p className="text-sm text-muted">última base disponível: {lastBase ? formatDateBR(lastBase) : 'indisponível'}</p>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Indicadores de vigilância com nome exato do que medem. Semanas recentes são provisórias e sobem em revisões. Não é um painel de casos em tempo real, pois as bases chegam com atraso de notificação.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <IndicatorCard id={HOME_INDICATORS.sivep} series={sivep} freshness={freshnessState(fresh, HOME_INDICATORS.sivep)} weeks={8} geoLabel="Brasil" />
          <IndicatorCard id={HOME_INDICATORS.flunet} series={flunet} freshness={freshnessState(fresh, HOME_INDICATORS.flunet)} weeks={8} geoLabel="Brasil (BRA)" />
        </div>
        <p className="mt-5">
          <Link href="/dados/brasil/" className="touch inline-flex items-center rounded-md bg-navy-900 px-5 py-3 font-medium text-white no-underline hover:bg-navy-800">
            Explorar o observatório
          </Link>
        </p>
      </section>

      {quick.length > 0 && (
        <section aria-labelledby="h-entenda" className="border-t border-line py-8">
          <h2 id="h-entenda" className="text-2xl font-semibold text-navy-900">
            Entenda em poucos minutos
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {quick.map((b) => (
              <li key={b.label}>
                <Link href={b.href} className="touch flex items-center rounded-md border border-line bg-paper px-4 py-3 font-medium text-navy-900 no-underline hover:border-navy-600">
                  {b.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Transparência" className="border-t border-line py-6 text-sm">
        <ul className="flex flex-wrap gap-x-2 gap-y-1">
          {institutional.map((i, idx) => (
            <li key={i.href} className="flex items-center gap-x-2">
              {idx > 0 && <span aria-hidden="true">|</span>}
              <Link href={i.href} className="touch inline-flex items-center py-2">
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
