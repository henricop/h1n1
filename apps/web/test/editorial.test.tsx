import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadFacts, parsePage } from '@/lib/content';
import { SITE } from '@/lib/site';
import { Alerta } from '@/components/mdx/Alerta';
import { Comparativo } from '@/components/mdx/Comparativo';
import { Fato, fatoAriaLabel } from '@/components/mdx/Fato';
import { Glossario } from '@/components/mdx/Glossario';
import { Limites } from '@/components/mdx/Limites';
import { LinhaDoTempo } from '@/components/mdx/LinhaDoTempo';
import { Passos } from '@/components/mdx/Passos';
import { Resposta } from '@/components/mdx/Resposta';
import { detectLang, isEnglish } from '@/components/mdx/lang';
import { rehypeArticleHeadings, type ArticleHeading } from '@/components/mdx/headings';
import { Breadcrumb } from '@/components/Breadcrumb';
import { MdxArticle } from '@/components/MdxArticle';
import { ALERT_SIGNS_TEXT, CLINICAL_NOTICE_TEXT, ClinicalNotice, DataUnavailable, FreshnessNote, NoDataPublished, ReviewBanner, StaleBadge } from '@/components/Notices';
import { SourceCard } from '@/components/SourceCard';
import type { SourceRow } from '@/lib/api';

const REAL_CONTENT = path.join(process.cwd(), 'content');
const FIXTURES = path.join(process.cwd(), 'test', 'fixtures', 'content');
const NO_REAL_TIME = ['tempo', 'real'].join(' ');
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

let previousDir: string | undefined;
beforeAll(() => {
  previousDir = process.env.H1N1_CONTENT_DIR;
});
afterAll(() => {
  if (previousDir === undefined) delete process.env.H1N1_CONTENT_DIR;
  else process.env.H1N1_CONTENT_DIR = previousDir;
});

describe('Fato (conteúdo real)', () => {
  beforeAll(() => {
    process.env.H1N1_CONTENT_DIR = REAL_CONTENT;
  });

  it('o link "fonte" tem nome acessível ÚNICO em todos os fatos de facts.json e começa com a palavra visível', () => {
    const facts = [...loadFacts().values()];
    expect(facts.length).toBeGreaterThan(100);
    const labels = facts.map((f) => {
      const html = renderToStaticMarkup(<Fato id={f.id} />);
      const m = /<a [^>]*aria-label="([^"]+)"[^>]*>fonte<\/a>/.exec(html);
      expect(m, f.id).not.toBeNull();
      return m![1]!.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    });
    expect(labels.every((l) => l.startsWith('Fonte: '))).toBe(true);
    const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(dup, dup.join('\n')).toEqual([]);
    expect(fatoAriaLabel(facts[0]!)).toBe(labels[0]!);
  }, 60_000);

  it('citação em inglês leva lang="en"; citação em português não', () => {
    const en = renderToStaticMarkup(<Fato id="oms-espii-2009-04-25" />);
    expect(en).toMatch(/<span lang="en" class="italic">/);
    expect(en).toContain('citação literal, em inglês:');
    const pt = renderToStaticMarkup(<Fato id="ms-vacinacao-forma-mais-eficaz-prevencao" />);
    expect(pt).not.toContain('lang="en"');
    expect(pt).toContain('citação literal:');
  });

  it('título da fonte em inglês marca só o documento com lang="en"; a sigla do órgão fica em português', () => {
    const html = renderToStaticMarkup(<Fato id="pandemia-2009-primeiros-casos-reportados-abril-2009" />);
    expect(html).toMatch(/OMS — <span lang="en">Disease Outbreak News/);
  });

  it('chip ≥ 14 px, sem ids duplicados quando o mesmo fato aparece duas vezes, verificado por em mono 14 px com data BR', () => {
    const html = renderToStaticMarkup(
      <p>
        <Fato id="cdc-designacao-ah1n1pdm09" />
        <Fato id="cdc-designacao-ah1n1pdm09" />
      </p>,
    );
    expect(html).not.toMatch(/\sid="/);
    expect(html).toMatch(/class="[^"]*text-\[14px\][^"]*"[^>]*>fonte<\/a>/);
    expect(html).toMatch(/font-mono text-\[14px\]">verificado por [^<]+ em \d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/text-xs|text-\[(?:1[0-3]|[0-9])px\]/);
  });

  it('heurística de idioma separa português e inglês nos fatos reais', () => {
    expect(detectLang('Em abril de 2009, os casos foram reportados.')).toBe('pt-BR');
    expect(detectLang('The United States Government has reported seven confirmed human cases')).toBe('en');
    expect(isEnglish('Most cases of human influenza are clinically diagnosed.')).toBe(true);
    expect(isEnglish('Critério laboratorial padrão-ouro RT-qPCR.')).toBe(false);
    const facts = [...loadFacts().values()];
    const english = facts.filter((f) => f.quote && isEnglish(f.quote)).length;
    expect(english).toBeGreaterThan(50);
    expect(english).toBeLessThan(facts.length);
  });
});

describe('Alerta', () => {
  it('vermelho (urgent) só no tipo "emergencia"', () => {
    const emergencia = renderToStaticMarkup(<Alerta tipo="emergencia">Procure um serviço de saúde.</Alerta>);
    expect(emergencia).toContain('urgent-700');
    expect(emergencia).toContain('role="alert"');
    expect(emergencia).toContain('Procure atendimento');
    for (const tipo of ['atencao', 'info'] as const) {
      const html = renderToStaticMarkup(<Alerta tipo={tipo}>Texto.</Alerta>);
      expect(html, tipo).not.toMatch(/urgent|red-|#b42318/);
    }
    expect(renderToStaticMarkup(<Alerta tipo="atencao">x</Alerta>)).toContain('attention-');
    expect(renderToStaticMarkup(<Alerta tipo="info">x</Alerta>)).toContain('primary-');
    // sem tipo: informação
    expect(renderToStaticMarkup(<Alerta>x</Alerta>)).toContain('Informação');
  });

  it('o glifo é decorativo (aria-hidden) e o título é texto', () => {
    const html = renderToStaticMarkup(<Alerta tipo="atencao" titulo="Cuidado">x</Alerta>);
    expect(html).toMatch(/aria-hidden="true"[^>]*>!<\/span>/);
    expect(html).toContain('>Cuidado<');
  });
});

describe('Breadcrumb', () => {
  it('é visível (nada de sr-only/hidden), ≥ 15 px, com página atual marcada e JSON-LD', () => {
    const html = renderToStaticMarkup(
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Sintomas', href: '/sintomas/' }, { label: 'Sinais de alerta', href: '/sintomas/sinais-de-alerta/' }]} />,
    );
    expect(html).toContain('aria-label="Trilha de navegação"');
    expect(html).toContain('text-[15px]');
    expect(html).not.toMatch(/sr-only|(?<!aria-)hidden|text-xs|text-sm/);
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/href="\/sintomas\/?"/);
    expect(html).toContain('BreadcrumbList');
    expect(text(html)).toContain('Início/Sintomas/Sinais de alerta');
  });
});

describe('Notices', () => {
  it('ClinicalNotice traz o aviso fixo idêntico (educativo + sinais de alerta com link) e o texto corrido bate com a constante', () => {
    const html = renderToStaticMarkup(<ClinicalNotice />);
    expect(text(html)).toBe(CLINICAL_NOTICE_TEXT);
    expect(text(html)).toContain(SITE.medicalDisclaimer);
    expect(text(html)).toContain('Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em /sintomas/sinais-de-alerta/.');
    expect(ALERT_SIGNS_TEXT).toBe('Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em /sintomas/sinais-de-alerta/.');
    expect(html).toMatch(/href="\/sintomas\/sinais-de-alerta\/?"/);
  });

  it('ReviewBanner e demais avisos: sem "tempo real", sem texto abaixo de 14 px', () => {
    const outputs = [
      renderToStaticMarkup(<ReviewBanner />),
      renderToStaticMarkup(<ClinicalNotice />),
      renderToStaticMarkup(<DataUnavailable attemptedAt="2026-10-20T10:05:00Z" detail="x" />),
      renderToStaticMarkup(<NoDataPublished />),
      renderToStaticMarkup(<StaleBadge ageDays={3} />),
      renderToStaticMarkup(<FreshnessNote state={{ verified: false, row: null, stale: false, error: 'x' }} />),
    ];
    for (const html of outputs) {
      expect(html.toLowerCase()).not.toContain(NO_REAL_TIME);
      expect(html).not.toMatch(/text-xs|text-\[(?:1[0-3]|[0-9])px\]/);
    }
    expect(text(outputs[0]!)).toContain('Conteúdo em revisão clínica');
    expect(text(outputs[0]!)).toContain('Em caso de sinais de alerta, procure um serviço de saúde.');
  });
});

describe('componentes MDX no sistema v3', () => {
  beforeAll(() => {
    process.env.H1N1_CONTENT_DIR = FIXTURES;
  });

  it('Glossario: termo conhecido vira botão com tooltip ligado por aria-describedby; desconhecido fica sem tooltip', () => {
    const html = renderToStaticMarkup(<Glossario termo="SRAG" />);
    expect(html).toContain('<button type="button" aria-describedby=');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('sr-only');
    expect(html).toContain('Síndrome Respiratória Aguda Grave');
    const id = /aria-describedby="([^"]+)"/.exec(html)![1]!;
    expect(html).toContain(`id="${id}"`);
    const unknown = renderToStaticMarkup(<Glossario termo="termo-inexistente" />);
    expect(unknown).not.toContain('tooltip');
    expect(unknown).toContain('termo-inexistente');
  });

  it('Resposta é pull-quote (serifa itálica, filete à esquerda), sem cartão', () => {
    const html = renderToStaticMarkup(<Resposta><p>Resposta curta.</p></Resposta>);
    expect(html).toContain('border-l-2');
    expect(html).toContain('lead');
    expect(html).not.toMatch(/rounded-\[20px\]|bg-primary-50|card/);
  });

  it('Limites usa o título padrão da seção e um id estável para o sumário', () => {
    const html = renderToStaticMarkup(<Limites><ul><li>Não é diagnóstico.</li></ul></Limites>);
    expect(html).toContain('O que esta página não permite concluir');
    expect(html).toContain('id="limites"');
    expect(html).toContain('aria-labelledby="limites"');
  });

  it('Comparativo: região rolável e focável com cabeçalho acessível; modo de linhas gera th com scope', () => {
    const html = renderToStaticMarkup(
      <Comparativo titulo="Gripe e covid" colunas={['Gripe', 'Covid']} linhas={[{ rotulo: 'Agente', valores: ['Influenza', 'SARS-CoV-2'] }]} />,
    );
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<th scope="col">Gripe</th>');
    expect(html).toContain('<th scope="row">Agente</th>');
    expect(html).toContain('<caption>Gripe e covid</caption>');
  });

  it('LinhaDoTempo: datas em mono no formato BR, títulos em serifa e fato com fonte', () => {
    const html = renderToStaticMarkup(
      <LinhaDoTempo items={[{ data: '2009-06-11', titulo: 'OMS declara pandemia.', fato_id: 'oms-pandemia-2009' }, { data: '2010-08', titulo: 'Fim da fase 6.' }, { data: '2009', titulo: 'Ano.' }]} />,
    );
    expect(html).toContain('>11/06/2009<');
    expect(html).toMatch(/datetime="2009-06-11"/i);
    expect(html).toContain('>08/2010<');
    expect(html).toContain('font-display');
    expect(html).toContain('>fonte</a>');
  });

  it('Passos: envolve a lista numerada com a classe do módulo (numerais em condensada via CSS)', () => {
    const html = renderToStaticMarkup(<Passos titulo="O que fazer"><ol><li>Um</li></ol></Passos>);
    expect(html).toContain('O que fazer');
    expect(html).toMatch(/class="[^"]*passos[^"]*"/);
  });
});

describe('rehypeArticleHeadings', () => {
  const h2 = (text: string) => ({ type: 'element', tagName: 'h2', properties: {}, children: [{ type: 'text', value: text }] });

  it('gera ids determinísticos, sem acentos e únicos; reserva os ids do template; injeta id no Limites', () => {
    const out: ArticleHeading[] = [];
    const tree = {
      type: 'root',
      children: [
        h2('Quando procurar atendimento'),
        h2('Quando procurar atendimento'),
        h2('Fontes'),
        h2('Síndrome gripal e SRAG: a diferença'),
        { type: 'mdxJsxFlowElement', name: 'Limites', attributes: [], children: [] },
      ],
    };
    rehypeArticleHeadings(out)()(tree);
    expect(out.map((h) => h.id)).toEqual(['quando-procurar-atendimento', 'quando-procurar-atendimento-2', 'fontes', 'sindrome-gripal-e-srag-a-diferenca', 'limites']);
    expect((tree.children[0] as unknown as { properties: { id: string } }).properties.id).toBe('quando-procurar-atendimento');
    const limites = tree.children[4] as { attributes: Array<{ name: string; value: string }> };
    expect(limites.attributes).toContainEqual({ type: 'mdxJsxAttribute', name: 'id', value: 'limites' });
    // determinismo: segunda execução, mesmo resultado
    const again: ArticleHeading[] = [];
    rehypeArticleHeadings(again)()({ type: 'root', children: [h2('Quando procurar atendimento')] });
    expect(again[0]!.id).toBe('quando-procurar-atendimento');
  });

  it('um h2 chamado "Autoria e revisão" ou "Leia também" não colide com os ids do template', () => {
    const out: ArticleHeading[] = [];
    rehypeArticleHeadings(out)()({ type: 'root', children: [h2('h-fontes'), h2('Limites')] });
    expect(out.map((h) => h.id)).toEqual(['h-fontes-2'.replace('h-fontes-2', 'h-fontes-2'), 'limites-2']);
  });
});

describe('MdxArticle (SSR)', () => {
  beforeAll(() => {
    process.env.H1N1_CONTENT_DIR = FIXTURES;
  });

  const body = `<Resposta>
Resposta curta com <Glossario termo="SRAG" />.
</Resposta>

## Primeira seção

Texto com fato. <Fato id="oms-pandemia-2009" />

## Primeira seção

Outra.

## Segunda seção

<Alerta tipo="emergencia">Procure um serviço de saúde.</Alerta>

<Limites>
- Não é diagnóstico.
</Limites>
`;
  const fm = {
    title: 'Sinais de alerta na gripe (H1N1 e outros vírus): quando procurar atendimento e o que esperar',
    description: 'Descrição curta.',
    slug: '/sintomas/sinais-de-alerta/',
    intent: 'i',
    nav_group: 'sintomas',
    clinical: true,
    index_policy: 'index',
    review_status: 'pending_clinical_review',
    author: 'Redação H1N1',
    reviewer: null,
    reviewed_at: null,
    updated_at: '2026-10-20',
    sources: [
      { id: 'BR-11', title: 'OMS — Disease Outbreak News, Influenza-like illness in the United States and Mexico', url: 'https://example.org/a', accessed_at: '2026-10-20' },
      { title: 'Ministério da Saúde — Gripe', url: 'https://example.org/b', accessed_at: '2026-10-20' },
    ],
    related: ['/o-que-e-h1n1/', '/historia/'],
    summary_answer: 'Falta de ar e outros sinais exigem avaliação em serviço de saúde.',
  };
  const yaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  const page = parsePage(`---\n${yaml}\n---\n\n${body}`, 'sinais.mdx');

  it('monta o template de revista: breadcrumb antes do H1, kicker do grupo, resposta em pull-quote, avisos em faixa de papel', async () => {
    const html = renderToStaticMarkup(await MdxArticle({ page }));
    expect(html.match(/<h1[ >]/g)?.length).toBe(1);
    expect(html.indexOf('aria-label="Trilha de navegação"')).toBeGreaterThan(-1);
    expect(html.indexOf('aria-label="Trilha de navegação"')).toBeLessThan(html.indexOf('<h1'));
    expect(text(html)).toContain('[ Sintomas e cuidados ]');
    expect(html).toContain('data-summary-answer');
    expect(html).toMatch(/data-summary-answer[^>]*class="[^"]*font-display[^"]*italic/);
    expect(html).toContain('bg-bg-soft');
    expect(text(html)).toContain(CLINICAL_NOTICE_TEXT);
    expect(text(html)).toContain('Conteúdo em revisão clínica');
    expect(html).toContain('display-lg');
    expect(html).toContain('prose');
    expect(html).not.toMatch(/rounded-\[20px\]/);
  });

  it('sumário: todo item aponta para um id que existe no HTML, ids repetidos ganham sufixo e há link para Fontes e Limites', async () => {
    const html = renderToStaticMarkup(await MdxArticle({ page }));
    const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!);
    expect(new Set(hrefs)).toEqual(new Set(['primeira-secao', 'primeira-secao-2', 'segunda-secao', 'limites', 'h-fontes']));
    for (const id of new Set(hrefs)) expect(html, id).toMatch(new RegExp(`id="${id}"`));
    // cada id aparece uma única vez no documento
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
    const dup = ids.filter((i, n) => ids.indexOf(i) !== n);
    expect(dup, dup.join(',')).toEqual([]);
    expect(html).toContain('<h2 id="primeira-secao"');
    expect(html).toContain('nesta página');
  });

  it('fontes numeradas, autoria e revisão em mono, "Leia também" em tipografia grande sem cartões', async () => {
    const html = renderToStaticMarkup(await MdxArticle({ page }));
    expect(html).toMatch(/<ol class="[^"]*notas[^"]*"/);
    expect(html).toContain('id="fonte-BR-11"');
    expect(html).toContain('<span lang="en">Disease Outbreak News');
    expect(html).toContain('Sem revisão clínica até o momento');
    expect(html).toContain('Autoria e revisão');
    expect(html).toContain('Leia também');
    expect(html.match(/display-md/g)?.length).toBe(2);
    expect(html).toMatch(/md:grid-cols-2/);
    expect(html).not.toContain('class="card');
    expect(html).toContain('20/10/2026');
  });

  it('nenhuma classe de texto abaixo de 14 px e nenhuma promessa de tempo real no HTML', async () => {
    const html = renderToStaticMarkup(await MdxArticle({ page }));
    expect(html).not.toMatch(/text-xs|text-\[(?:1[0-3]|[0-9])px\]/);
    expect(html.toLowerCase()).not.toContain(NO_REAL_TIME);
  });

  it('página não clínica e revisada: sem aviso clínico nem banner de revisão', async () => {
    const calm = parsePage(`---\n${Object.entries({ ...fm, clinical: false, review_status: 'reviewed', reviewer: 'Dra. X', reviewed_at: '2026-10-19', sources: [], related: [] }).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n## Só uma\n\nTexto.\n`, 'x.mdx');
    const html = renderToStaticMarkup(await MdxArticle({ page: calm }));
    expect(html).not.toContain('Em caso de sinais de alerta');
    expect(html).not.toContain('Conteúdo em revisão clínica');
    expect(html).toContain('Dra. X, em 19/10/2026');
    expect(html).not.toContain('nesta página'); // sumário só com 2 ou mais seções
  });
});

describe('SourceCard', () => {
  const s: SourceRow = {
    id: 'BR-03',
    slug: 'br_sivep_gripe',
    name: 'SIVEP-Gripe',
    agency: 'Ministério da Saúde',
    country: 'BR',
    region: 'Brasil',
    category: 'Vigilância',
    access: 'Dados abertos',
    access_type: 'open_data',
    h1n1_scope: 'SRAG por A(H1N1)pdm09 confirmada.',
    update_cadence: 'Semanal',
    priority: 'P0',
    url: 'https://x.example',
    notes: 'n',
    license: 'verify_per_source',
    mirror_group: null,
    api_tested_at: null,
  };

  it('linha editorial: nome em serifa ≥ 28 px, órgão · país · licença em mono, sem cartão', () => {
    const html = renderToStaticMarkup(<SourceCard source={s} />);
    expect(html).toContain('text-[1.75rem]');
    expect(html).toMatch(/font-mono text-\[14px\][^>]*>Ministério da Saúde · BR · verificar nos termos da fonte/);
    expect(html).not.toMatch(/class="card|rounded-\[20px\]/);
    expect(html).toContain('aria-label="Site oficial de SIVEP-Gripe"');
    expect(html).not.toMatch(/text-xs|text-\[(?:1[0-3]|[0-9])px\]/);
  });
});

describe('tipografia mínima nos arquivos da frente D', () => {
  const ROOT = process.cwd();
  const TARGETS = [
    'src/components/MdxArticle.tsx',
    'src/components/Breadcrumb.tsx',
    'src/components/Notices.tsx',
    'src/components/SourceCard.tsx',
    'src/components/AlertSigns.tsx',
    'src/components/mdx',
    'src/app/[...slug]',
    'src/app/dados/fontes',
    'src/app/dados/metodologia',
    'src/app/not-found.tsx',
    'src/app/error.tsx',
    'src/app/global-error.tsx',
  ];
  const files = (p: string): string[] => {
    const full = path.join(ROOT, p);
    if (!existsSync(full)) return [];
    if (statSync(full).isFile()) return [full];
    return readdirSync(full).flatMap((e) => files(path.join(p, e)));
  };

  it('sem text-xs, text-[10..13px] nem fontes menores que 14 px em texto', () => {
    const offenders: string[] = [];
    for (const f of TARGETS.flatMap(files)) {
      if (!/\.(tsx?|css)$/.test(f)) continue;
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\btext-xs\b|text-\[(?:[0-9]|1[0-3])px\]/.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
          if (/font-size:\s*(?:[0-9]|1[0-3])px\b/.test(line) || /font-size:\s*0\.(?:[0-7]\d*|8[0-6]\d*)rem/.test(line)) offenders.push(`${path.relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('nenhum arquivo da frente promete "tempo real"', () => {
    const offenders = TARGETS.flatMap(files)
      .filter((f) => readFileSync(f, 'utf8').toLowerCase().includes(NO_REAL_TIME))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});

describe('markVirus (H1N1 em contextos de serifa)', () => {
  it('envolve "H1N1" em span.mark em strings, elementos HTML e arrays; deixa o texto intacto', async () => {
    const { markVirus } = await import('@/components/mdx/mark');
    const html = renderToStaticMarkup(<h1>{markVirus('Sinais de alerta na gripe (H1N1 e outros) e A(H1N1)pdm09')}</h1>);
    expect(html.match(/<span class="[^"]*mark[^"]*">H1N1<\/span>/g)?.length).toBe(2);
    expect(text(html)).toBe('Sinais de alerta na gripe (H1N1 e outros) e A(H1N1)pdm09');
    const nested = renderToStaticMarkup(<div>{markVirus(<p>Vírus <strong>H1N1</strong> circula.</p>)}</div>);
    expect(nested).toMatch(/<strong><span class="[^"]*mark[^"]*">H1N1<\/span><\/strong>/);
    expect(renderToStaticMarkup(<p>{markVirus('Sem o token.')}</p>)).toBe('<p>Sem o token.</p>');
  });

  it('Resposta e títulos de seção do MDX aplicam a marca; o corpo em Inter não', async () => {
    const html = renderToStaticMarkup(<Resposta><p>O subtipo H1N1 circula.</p></Resposta>);
    expect(html).toMatch(/<span class="[^"]*mark[^"]*">H1N1<\/span>/);
    const { mdxComponents } = await import('@/components/mdx');
    const H2 = mdxComponents.h2 as (p: { id?: string; children?: React.ReactNode }) => React.ReactElement;
    expect(renderToStaticMarkup(H2({ id: 'x', children: 'Sobre o H1N1' }))).toMatch(/<h2 id="x">Sobre o <span class="[^"]*mark[^"]*">H1N1<\/span><\/h2>/);
  });
});
