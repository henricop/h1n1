import type { Metadata } from 'next';
import { getFreshness, getGlobe } from '@/lib/api';
import { formatDateBR } from '@/lib/format';
import { globalMax } from '@/lib/hud';
import { TIMELINE_START, defaultWeekIndex } from '@/lib/timeline';
import { Breadcrumb } from '@/components/Breadcrumb';
import { DataUnavailable, FreshnessNote } from '@/components/Notices';
import { freshnessState } from '@/lib/api';
import { GlobePoster } from '@/components/sala/GlobePoster';
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
  const crumbs = [
    { label: 'Início', href: '/' },
    { label: 'Dados', href: null },
    { label: 'Mundo', href: '/dados/mundo/' },
  ];
  return (
    <>
      <Breadcrumb items={crumbs} />
      <header className="mt-2">
        <p className="kicker">FluNet · OMS/GISRS</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-[-0.02em] text-ink md:text-5xl">H1N1 no mundo</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Detecções laboratoriais de A(H1N1)pdm09 por país e semana ISO, desde 2009. Não é incidência populacional: depende de quantas amostras cada país processa e reporta. {globe.ok && <FreshnessNote state={freshnessState(fresh, INDICATOR)} />}
        </p>
      </header>
      {!globe.ok ? (
        <div className="mt-6">
          <DataUnavailable attemptedAt={globe.attemptedAt} detail={globe.error} />
        </div>
      ) : (
        <div className="mt-8">
          <WorldExplorer
            data={globe.data}
            max={globalMax(globe.data.countries)}
            poster={<GlobePoster countries={globe.data.countries} weekIndex={defaultWeekIndex(globe.data.weeks, globe.data.countries)} week={globe.data.weeks[defaultWeekIndex(globe.data.weeks, globe.data.countries)] ?? ''} max={globalMax(globe.data.countries)} dataAsOf={globe.data.meta.data_as_of} indicatorName={globe.data.indicator.name} />}
          />
          <p className="mt-8 rounded-2xl border border-primary-100 bg-primary-50 p-4 text-[15px] text-ink">{globe.data.meta.universe_note}</p>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="font-medium text-ink">Definição</dt>
            <dd className="text-muted">{globe.data.meta.case_definition}</dd>
            <dt className="font-medium text-ink">Base de dados</dt>
            <dd className="text-muted">{formatDateBR(globe.data.meta.data_as_of)}</dd>
            <dt className="font-medium text-ink">Licença</dt>
            <dd className="text-muted">{globe.data.meta.license === 'verify_per_source' ? 'conforme termos de uso da OMS (FluNet)' : (globe.data.meta.license ?? 'verificar na fonte')}</dd>
          </dl>
        </div>
      )}
    </>
  );
}
