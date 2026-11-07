import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JsonLd } from '@/components/JsonLd';
import { BrasilAct } from '@/components/home/BrasilAct';
import { Continue } from '@/components/home/Continue';
import { FactCompact } from '@/components/home/FactCompact';
import { NumeroGigante } from '@/components/home/NumeroGigante';
import { TextVersion } from '@/components/home/TextVersion';
import { HOME_ACTS } from '@/components/home/acts';
import { ProgressRail } from '@/components/shell/ProgressRail';
import { VirusExplainer } from '@/components/virus/VirusExplainer';
import { POSTER_ALT, POSTER_HEIGHT, POSTER_SRC, POSTER_WIDTH } from '@/components/virus/VirusPoster';
import { eligiblePages, firstEligible } from '@/lib/content';
import { SITE, absoluteUrl } from '@/lib/site';
import { CHAPTER_COPY, HOME_FACT_IDS } from '@/lib/virus/copy';

/** ISR: igual a API_REVALIDATE_SECONDS (src/lib/api.ts); literal por exigência do Next (ver test/cache-policy.test.ts). */
export const revalidate = 3600;

const TITLE = 'H1N1: pequeno demais para ver, dá para entender';
const DESCRIPTION = 'Um dos vírus da gripe, visto de perto: o que ele é, como entra numa célula, como passa de uma pessoa para outra e como a vacina ajuda. Cada afirmação com fonte; dados oficiais do Brasil com a data da base.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
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

/**
 * Home v4 — "Pequeno demais para ver. Dá para entender." Um filme em sete atos: abertura e atos 1–5 sobre o palco
 * 3D sticky (VirusExplainer), ato 6 "No Brasil" (dados oficiais, fundo opaco que cobre o palco), ato 7 "Continue
 * daqui" e a versão em texto acessível. DOM texto-primeiro: h1 na abertura, uma <section data-act> com h2 por ato.
 */
export default async function Home() {
  const pages = eligiblePages();
  const alerta = firstEligible(['/sintomas/sinais-de-alerta/'], pages);
  // O mesmo fato pode aparecer no filme, no painel da peça e na versão em texto: ids de âncora distintos por contexto.
  const byCtx = (ctx: string): Record<string, ReactNode> => Object.fromEntries(HOME_FACT_IDS.map((id) => [id, <FactCompact key={id} id={id} ctx={ctx} />]));
  const facts = byCtx('filme');
  const panelFacts = byCtx('peca');
  const bigs: Record<string, ReactNode> = Object.fromEntries(CHAPTER_COPY.flatMap((c) => c.steps.flatMap((s) => (s.big ? [[s.big.factId, <NumeroGigante key={s.big.factId} moment={s.big} ctx="filme" />] as const] : []))));
  const brasil = await BrasilAct();

  return (
    <>
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
      <ProgressRail acts={HOME_ACTS} />

      {/* atos 0–5: abertura e o filme sobre o palco 3D */}
      <VirusExplainer facts={facts} bigs={bigs} panelFacts={panelFacts} alertaHref={alerta} />

      {/* ato 6: o observatório entra no filme (fundo opaco cobre o palco) */}
      {brasil}

      {/* ato 7: índice e aviso clínico fixo */}
      <Continue pages={pages} />

      {/* versão em texto: alvo de "Pular a animação", leitores de tela, sem WebGL */}
      <TextVersion />
    </>
  );
}
