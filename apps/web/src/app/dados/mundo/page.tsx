import type { Metadata } from 'next';
import { freshnessState, getFreshness, getGlobe, getSource } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { globalMax } from '@/lib/hud';
import { TIMELINE_START, defaultWeekIndex } from '@/lib/timeline';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';
import { LABEL } from '@/components/charts/ui';
import { GlobePoster } from '@/components/sala/GlobePoster';
import { PageShell } from '@/components/sala/PageShell';
import { WorldExplorer } from '@/components/sala/WorldExplorer';

/** ISR: igual a API_REVALIDATE_SECONDS (src/lib/api.ts); literal por exigência do Next (ver test/cache-policy.test.ts). */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'H1N1 no mundo: detecções de A(H1N1)pdm09 por país (FluNet)',
  description: 'Globo e tabela por país das detecções laboratoriais de A(H1N1)pdm09 reportadas à OMS (FluNet) por semana ISO desde 2009, com comparação de até 5 países.',
  alternates: { canonical: '/dados/mundo/' },
  robots: { index: true, follow: true },
};

const INDICATOR = 'flunet_ah1n1pdm09_detections';

export default async function MundoPage() {
  const [globe, fresh] = await Promise.all([getGlobe({ indicator: INDICATOR, from: TIMELINE_START }), getFreshness()]);
  const sourceRes = globe.ok ? await getSource(globe.data.meta.source_id) : null;
  const source = sourceRes?.ok
    ? { name: sourceRes.data.data.name, agency: sourceRes.data.data.agency, href: `/dados/fontes/${sourceRes.data.data.slug}/` }
    : { name: 'FluNet', agency: 'OMS/GISRS', href: `/dados/fontes/${globe.ok ? globe.data.meta.source_id : ''}/` };
  const crumbs = [
    { label: 'Início', href: '/' },
    { label: 'Dados', href: null },
    { label: 'Mundo', href: '/dados/mundo/' },
  ];
  const idx = globe.ok ? defaultWeekIndex(globe.data.weeks, globe.data.countries) : 0;
  const max = globe.ok ? globalMax(globe.data.countries) : 0;
  return (
    <PageShell>
      <Breadcrumb items={crumbs} />
      <header className="mt-8">
        <p className="kicker-mono text-[14px]!">[ FluNet · OMS/GISRS ]</p>
        <h1 className="display-lg mt-4">H1N1 no mundo</h1>
        <p className="lead mt-6 max-w-3xl">Detecções de laboratório, país por país, desde 2009.</p>
        <p className="mt-5 max-w-3xl text-muted">
          Detecções laboratoriais de A(H1N1)pdm09 por país e semana ISO. Não é incidência populacional: depende de quantas amostras cada país processa e reporta. Os números são os últimos publicados pelas fontes oficiais e podem ter atraso; cada um traz a data da base.
        </p>
      </header>
      {!globe.ok ? (
        <div className="mt-12">
          <DataUnavailable attemptedAt={globe.attemptedAt} detail={globe.error} />
        </div>
      ) : (
        <div className="mt-14">
          <WorldExplorer
            data={globe.data}
            max={max}
            source={source}
            freshness={<FreshnessNote state={freshnessState(fresh, INDICATOR)} />}
            poster={<GlobePoster countries={globe.data.countries} weekIndex={idx} week={globe.data.weeks[idx] ?? ''} max={max} dataAsOf={globe.data.meta.data_as_of} indicatorName={globe.data.indicator.name} />}
          />
          <section aria-labelledby="h-mundo-metodo" className="mt-24">
            <header className="mb-8 max-w-3xl">
              <p className="kicker-mono text-[14px]!">( 03 ) Método</p>
              <h2 id="h-mundo-metodo" className="display-md mt-3">
                Como ler estes números
              </h2>
            </header>
            <p className="max-w-3xl rounded-2xl border border-primary-100 bg-primary-50 p-5 text-ink">{globe.data.meta.universe_note}</p>
            <dl className="mt-8 grid gap-x-10 gap-y-4 border-t border-line pt-6 text-[15px] sm:grid-cols-[max-content_1fr]">
              <dt className={LABEL}>Definição</dt>
              <dd className="text-ink">{globe.data.meta.case_definition}</dd>
              <dt className={LABEL}>Base de</dt>
              <dd className="text-ink">{formatDateBR(globe.data.meta.data_as_of)}</dd>
              <dt className={LABEL}>Licença</dt>
              <dd className="text-ink">{globe.data.meta.license === 'verify_per_source' ? 'conforme termos de uso da OMS (FluNet)' : (globe.data.meta.license ?? 'verificar na fonte')}</dd>
            </dl>
          </section>
        </div>
      )}
    </PageShell>
  );
}
