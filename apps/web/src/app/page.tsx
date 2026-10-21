import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { eligiblePages, firstEligible } from '@/lib/content';
import { SITE, absoluteUrl } from '@/lib/site';
import { HOME_FACT_IDS } from '@/lib/virus/copy';
import { JsonLd } from '@/components/JsonLd';
import { ClinicalNotice } from '@/components/Notices';
import { Fato } from '@/components/mdx/Fato';
import { BrasilNow } from '@/components/virus/BrasilNow';
import { FatoCtx } from '@/components/virus/FatoCtx';
import { VirusExplainer } from '@/components/virus/VirusExplainer';
import { POSTER_ALT, POSTER_HEIGHT, POSTER_SRC, POSTER_WIDTH } from '@/components/virus/VirusPoster';

/** ISR: igual a API_REVALIDATE_SECONDS (src/lib/api.ts); literal por exigência do Next (ver test/cache-policy.test.ts). */
export const revalidate = 3600;

const TITLE = 'H1N1, explicado de um jeito que dá para ver.';
const DESCRIPTION = 'Desmonte o vírus H1N1 peça por peça em 3D: o que ele é, como entra na célula, como se espalha e como a vacina age. Cada afirmação com fonte; dados oficiais do Brasil com data da base.';

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
    siteName: SITE.name,
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: POSTER_SRC, width: POSTER_WIDTH, height: POSTER_HEIGHT, alt: POSTER_ALT }],
  },
};

export default function Home() {
  const pages = eligiblePages();
  const q = (c: string[]) => firstEligible(c, pages);
  // O mesmo fato aparece no capítulo, no painel da peça e na versão em texto: ids de âncora distintos por contexto.
  const facts: Record<string, ReactNode> = Object.fromEntries(HOME_FACT_IDS.map((id) => [id, <Fato key={id} id={id} />]));
  const panelFacts: Record<string, ReactNode> = Object.fromEntries(HOME_FACT_IDS.map((id) => [id, <FatoCtx key={id} id={id} ctx="peca" />]));
  const textFacts: Record<string, ReactNode> = Object.fromEntries(HOME_FACT_IDS.map((id) => [id, <FatoCtx key={id} id={id} ctx="texto" />]));

  const alerta = q(['/sintomas/sinais-de-alerta/', '/sintomas/']);
  const links = [
    { href: q(['/o-que-e-h1n1/']), title: 'O que é o H1N1', text: 'Vírus, subtipo e doença explicados sem jargão.' },
    { href: q(['/transmissao/']), title: 'Como se transmite', text: 'Incubação, período de transmissão e isolamento.' },
    { href: alerta, title: 'Sinais de alerta', text: 'Quando procurar atendimento, segundo a orientação oficial.' },
    { href: q(['/vacina/', '/prevencao/']), title: 'Vacina e prevenção', text: 'O que a vacina da gripe faz e quem deve tomar.' },
    { href: '/dados/brasil/', title: 'Dados do Brasil', text: 'Séries oficiais por semana, com fonte e data da base.' },
    { href: '/sala/', title: 'Sala de dados', text: 'Globo, mapa por UF, tendência e composição viral, para quem quer ir fundo.' },
  ].filter((l): l is { href: string; title: string; text: string } => l.href !== null);

  return (
    <div className="mx-auto max-w-6xl">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', '@id': `${SITE.url}/#organization`, name: SITE.name, url: SITE.url, description: SITE.description },
            { '@type': 'WebSite', '@id': `${SITE.url}/#website`, name: SITE.name, url: SITE.url, inLanguage: 'pt-BR', publisher: { '@id': `${SITE.url}/#organization` } },
            { '@type': 'WebPage', '@id': `${SITE.url}/#home`, name: TITLE, description: DESCRIPTION, url: SITE.url, isPartOf: { '@id': `${SITE.url}/#website` }, primaryImageOfPage: absoluteUrl(POSTER_SRC), inLanguage: 'pt-BR' },
          ],
        }}
      />

      {/* ===== topo ===== */}
      <section aria-labelledby="titulo-home" className="relative overflow-hidden py-16 md:py-24">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-50 blur-3xl md:h-96 md:w-96" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-h1n1-soft blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-medium text-primary-600">Explicador visual · fontes em cada afirmação</p>
          <h1 id="titulo-home" className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink md:text-6xl">
            {TITLE}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">Desmonte o vírus peça por peça, veja como ele entra na célula, como se espalha e como a vacina age; depois confira os dados oficiais do Brasil.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#por-dentro" className="touch inline-flex items-center justify-center rounded-full bg-primary-600 px-6 text-base font-semibold text-white no-underline shadow-[0_8px_30px_-12px_rgba(36,81,214,.6)] hover:bg-primary-700">
              Explorar o vírus
            </a>
            <Link href="/dados/brasil/" className="touch inline-flex items-center justify-center rounded-full border border-line-strong bg-bg px-6 text-base font-semibold text-ink no-underline hover:border-primary-600 hover:text-primary-600">
              Ver os dados do Brasil
            </Link>
          </div>
        </div>
      </section>

      {/* ===== capítulos 1–5: explicador 3D ===== */}
      <VirusExplainer facts={facts} panelFacts={panelFacts} textFacts={textFacts} />

      {/* ===== capítulo 6: Brasil ===== */}
      <section aria-labelledby="brasil-titulo" className="mt-20 rounded-3xl bg-bg-soft px-5 py-14 md:mt-28 md:px-10 md:py-20">
        <p className="text-sm font-medium text-primary-600">Capítulo 6</p>
        <h2 id="brasil-titulo" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
          Como está o Brasil
        </h2>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">Os últimos valores publicados pelas fontes oficiais. Cada número vem com o período, o universo medido e a data da base; casos graves confirmados não são o total de infectados.</p>
        <div className="mt-8">
          <BrasilNow />
        </div>
      </section>

      {/* ===== capítulo 7: continuar ===== */}
      <section aria-labelledby="mais-titulo" className="mt-20 md:mt-28">
        <p className="text-sm font-medium text-primary-600">Capítulo 7</p>
        <h2 id="mais-titulo" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-4xl">
          Quer entender mais?
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="group flex h-full flex-col rounded-3xl border border-line bg-card p-6 no-underline shadow-[0_8px_30px_-12px_rgba(11,18,32,.18)] transition-colors hover:border-primary-600">
                <span className="font-display text-lg font-bold text-ink group-hover:text-primary-600">{l.title}</span>
                <span className="mt-2 text-[15px] leading-relaxed text-muted">{l.text}</span>
                <span className="mt-auto pt-4 text-sm font-medium text-primary-600">Abrir →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ===== aviso ===== */}
      <section aria-label="Aviso" className="mt-16 md:mt-24">
        <ClinicalNotice />
        <p className="mt-3 text-sm text-muted">
          {alerta ? (
            <>
              Em caso de falta de ar, febre persistente ou piora do estado geral, procure um serviço de saúde. Veja os <Link href={alerta}>sinais de alerta</Link>.
            </>
          ) : (
            'Em caso de falta de ar, febre persistente ou piora do estado geral, procure um serviço de saúde.'
          )}{' '}
          Os dados desta página não são um painel em tempo real: todo número traz a data da base.
        </p>
      </section>
    </div>
  );
}
