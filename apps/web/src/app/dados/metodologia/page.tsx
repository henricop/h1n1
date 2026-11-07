import type { Metadata } from 'next';
import Link from 'next/link';
import { INDICATORS } from '@h1n1/core';
import { getPage } from '@/lib/content';
import { INTEGRITY_RULES } from '@/lib/integrity-rules';
import { pageMetadata } from '@/lib/metadata';
import { Breadcrumb } from '@/components/Breadcrumb';
import { MdxArticle } from '@/components/MdxArticle';
import { FRAME, FRAME_TOP, KICKER, SECTION_TITLE } from '@/components/mdx/frame';
import { markVirus, SERIF_CLASS } from '@/components/mdx/mark';

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const page = getPage('/dados/metodologia/');
  if (page) return pageMetadata(page);
  return {
    title: 'Metodologia: indicadores, definições de caso e regras de integridade',
    description: 'Como o H1N1 define cada indicador (fonte, definição de caso, universo, período, supressão) e as dez regras de integridade que valem para todo número publicado.',
    alternates: { canonical: '/dados/metodologia/' },
  };
}

const PERIOD_LABEL: Record<string, string> = { epiweek: 'semana epidemiológica', isoweek: 'semana ISO', month: 'mês', year: 'ano' };
const MEASURE_LABEL: Record<string, string> = { count: 'contagem', rate: 'taxa', percent: 'percentual' };

/** Seções injetadas depois do corpo MDX: entram no sumário lateral do template. */
const TABLE_HEADINGS = [
  { id: 'h-indicadores', text: 'Indicadores' },
  { id: 'h-regras', text: 'Regras obrigatórias de integridade' },
];

export default async function MetodologiaPage() {
  const page = getPage('/dados/metodologia/');
  const tables = <MethodologyTables />;
  if (page) return <MdxArticle page={page} extraHeadings={TABLE_HEADINGS}>{tables}</MdxArticle>;
  return (
    <article className={`${FRAME} ${FRAME_TOP} pb-24 md:pb-32`}>
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Metodologia', href: '/dados/metodologia/' }]} />
      <header className="mt-8 md:mt-12">
        <p className={KICKER}>
          <span aria-hidden="true">[ </span>dados e pesquisas<span aria-hidden="true"> ]</span>
        </p>
        <h1 className="display-lg mt-5 text-balance">Metodologia</h1>
        <p className="lead mt-8 max-w-3xl md:mt-10">
          {markVirus('Cada número publicado no H1N1 vem de uma consulta determinística a uma base oficial versionada (snapshot com hash, URL, data de coleta e licença). Abaixo, a definição exata de cada indicador e as regras de integridade aplicadas.')}
        </p>
      </header>
      <div className="mt-16 md:mt-24">{tables}</div>
    </article>
  );
}

/**
 * Indicadores e regras, em formato editorial: cada indicador é um bloco (nome em serifa, definição em lista de
 * termos), em vez de uma tabela de sete colunas ilegível em telas estreitas. Gerado da ontologia em @h1n1/core.
 */
function MethodologyTables() {
  return (
    <>
      <section aria-labelledby="h-indicadores">
        <h2 id="h-indicadores" className={`${SECTION_TITLE} scroll-mt-24`}>
          Indicadores
        </h2>
        <p className="mt-4 max-w-2xl text-[17px] text-muted">
          Gerado a partir da ontologia de indicadores do projeto (@h1n1/core). Indicadores com série publicada podem ser abertos no <Link href="/dados/brasil/">observatório</Link>.
        </p>
        <ul className="mt-10">
          {INDICATORS.map((i) => (
            <li key={i.id} className="border-t border-line py-8 md:py-10">
              <article aria-labelledby={`ind-${i.id}`}>
                <p className="font-mono text-[14px] text-muted">{i.id}</p>
                <h3 id={`ind-${i.id}`} className={`${SERIF_CLASS} mt-2 font-display text-[1.75rem] leading-[1.1] tracking-[-0.01em] text-ink md:text-[2.125rem]`}>
                  {markVirus(i.name)}
                </h3>
                <p className="mt-3 font-mono text-[14px] leading-relaxed text-muted">
                  {MEASURE_LABEL[i.measurement] ?? i.measurement} · fonte {i.source_id} · {i.methodology_version}
                </p>
                <dl className="mt-6 space-y-4 text-[17px] leading-relaxed">
                  <Row label="definição de caso">{i.case_definition}</Row>
                  <Row label="universo">{i.universe_note}</Row>
                  <Row label="período">
                    {PERIOD_LABEL[i.period_type] ?? i.period_type}
                    <span className="block font-mono text-[14px] text-muted">níveis: {i.geo_levels.join(', ')}</span>
                  </Row>
                  <Row label="supressão">
                    {i.suppression_threshold > 0 ? `células < ${i.suppression_threshold} em recortes subnacionais/estratificados` : 'nenhuma'}
                    {i.min_denominator ? <span className="block font-mono text-[14px] text-muted">denominador mínimo: {i.min_denominator}</span> : null}
                  </Row>
                  <Row label="o que não permite concluir">
                    <ul className="list-disc space-y-1.5 pl-5">
                      {i.caveats.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </Row>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-regras" className="mt-20 md:mt-28">
        <h2 id="h-regras" className={`${SECTION_TITLE} scroll-mt-24`}>
          Regras obrigatórias de integridade
        </h2>
        <p className="mt-4 max-w-2xl text-[17px] text-muted">Seção 10.4 do plano estratégico. Valem para todo indicador, gráfico e texto do site.</p>
        <ol className="mt-10 max-w-3xl">
          {INTEGRITY_RULES.map((r, n) => (
            <li key={r} className="relative border-t border-line py-5 pl-16 text-[17px] leading-relaxed">
              <span aria-hidden="true" className="absolute left-0 top-3 font-condensed text-[2.75rem] font-extrabold leading-none text-ink">
                {n + 1}
              </span>
              {r}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-12 gap-y-1 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <dt className="font-mono text-[14px] text-muted">{label}</dt>
      <dd className="max-w-3xl">{children}</dd>
    </div>
  );
}
