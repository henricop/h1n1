import type { Metadata } from 'next';
import Link from 'next/link';
import { INDICATORS } from '@h1n1/core';
import { getPage } from '@/lib/content';
import { INTEGRITY_RULES } from '@/lib/integrity-rules';
import { pageMetadata } from '@/lib/metadata';
import { Breadcrumb } from '@/components/Breadcrumb';
import { MdxArticle } from '@/components/MdxArticle';

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

export default async function MetodologiaPage() {
  const page = getPage('/dados/metodologia/');
  const tables = <MethodologyTables />;
  if (page) return <MdxArticle page={page}>{tables}</MdxArticle>;
  return (
    <article className="mx-auto max-w-5xl">
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Dados', href: null }, { label: 'Metodologia', href: '/dados/metodologia/' }]} />
      <h1 className="mt-2 text-3xl font-bold text-ink">Metodologia</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Cada número publicado no H1N1 vem de uma consulta determinística a uma base oficial versionada (snapshot com hash, URL, data de coleta e licença). Abaixo, a definição exata de cada indicador e as regras de integridade aplicadas.
      </p>
      {tables}
    </article>
  );
}

function MethodologyTables() {
  return (
    <>
      <section aria-labelledby="h-indicadores" className="mt-10">
        <h2 id="h-indicadores" className="text-2xl font-semibold text-ink">
          Indicadores
        </h2>
        <p className="mt-2 text-sm text-muted">
          Gerado a partir da ontologia de indicadores do projeto (@h1n1/core). Indicadores com série publicada podem ser abertos no <Link href="/dados/brasil/">observatório</Link>.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table">
            <caption>Definição de cada indicador: id, nome, definição de caso, universo, período, supressão e limites interpretativos</caption>
            <thead>
              <tr>
                <th scope="col">Id</th>
                <th scope="col">Nome</th>
                <th scope="col">Definição de caso</th>
                <th scope="col">Universo</th>
                <th scope="col">Período</th>
                <th scope="col">Supressão</th>
                <th scope="col">O que não permite concluir</th>
              </tr>
            </thead>
            <tbody>
              {INDICATORS.map((i) => (
                <tr key={i.id}>
                  <th scope="row" className="font-mono text-xs font-normal">
                    {i.id}
                  </th>
                  <td>
                    <span className="font-medium">{i.name}</span>
                    <span className="block text-xs text-muted">
                      {MEASURE_LABEL[i.measurement] ?? i.measurement} · fonte {i.source_id} · {i.methodology_version}
                    </span>
                  </td>
                  <td>{i.case_definition}</td>
                  <td>{i.universe_note}</td>
                  <td>
                    {PERIOD_LABEL[i.period_type] ?? i.period_type}
                    <span className="block text-xs text-muted">níveis: {i.geo_levels.join(', ')}</span>
                  </td>
                  <td>
                    {i.suppression_threshold > 0 ? `células < ${i.suppression_threshold} em recortes subnacionais/estratificados` : 'nenhuma'}
                    {i.min_denominator ? <span className="block text-xs text-muted">denominador mínimo: {i.min_denominator}</span> : null}
                  </td>
                  <td>
                    <ul className="list-disc pl-4">
                      {i.caveats.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="h-regras" className="mt-10">
        <h2 id="h-regras" className="text-2xl font-semibold text-ink">
          Regras obrigatórias de integridade
        </h2>
        <p className="mt-2 text-sm text-muted">Seção 10.4 do plano estratégico. Valem para todo indicador, gráfico e texto do site.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-6">
          {INTEGRITY_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>
    </>
  );
}
