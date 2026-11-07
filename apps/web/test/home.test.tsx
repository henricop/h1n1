import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadFacts } from '@/lib/content';
import { CHAPTERS, HOME_ACT_COUNT, actAccessibleName } from '@/lib/virus/chapters';
import { STEPS_PER_CHAPTER } from '@/lib/virus/choreography';
import { ACT_BRASIL, ACT_CONTINUE, CHAPTER_COPY, DEEP_STEPS, HOME_INDEX, OPENING, allFreeText, stepTheme } from '@/lib/virus/copy';
import { HOME_ACTS } from '@/components/home/acts';
import { claimExcerpt, extractBigNumber, quoteLang, shortSource } from '@/components/home/fact-utils';
import { FactCompact } from '@/components/home/FactCompact';
import { NumeroGigante } from '@/components/home/NumeroGigante';
import { Opening } from '@/components/home/Opening';
import { BrasilAct, baselineMean, trendAllowed } from '@/components/home/BrasilAct';
import { Continue } from '@/components/home/Continue';
import { TextVersion } from '@/components/home/TextVersion';
import Home from '@/app/page';

const facts = loadFacts();

describe('abertura (ato 0)', () => {
  it('tem o H1 completo e acessível, a etiqueta, o subtítulo, as ações e a indicação de rolagem', () => {
    const html = renderToStaticMarkup(<Opening alertaHref="/sintomas/sinais-de-alerta/" reduced={false} />);
    expect(html).toMatch(/<h1[^>]*id="titulo-home"/);
    expect(html).toContain('H1N1 · Pequeno demais para ver. Dá para entender.');
    expect(html).toContain('explicação visual · cada afirmação com fonte');
    expect(html).toContain('Um dos vírus da gripe, visto de perto');
    expect(html).toContain('Começar');
    expect(html).toContain('href="#versao-em-texto"');
    expect(html).toContain('Pular a animação e ler em texto');
    expect(html).toContain('Estou com sintomas: ver sinais de alerta');
    expect(html).toContain('Role ou deslize para começar');
    // sem numeral de ato e sem data-act (os sete atos começam no ato 1)
    expect(html).not.toContain('data-act');
    // o link de sintomas some quando a página não é elegível
    expect(renderToStaticMarkup(<Opening alertaHref={null} reduced={false} />)).not.toContain('Estou com sintomas');
  });
});

describe('atos: kickers, títulos e temas', () => {
  it('kickers não têm dígitos; títulos e kickers são os do contrato; nome acessível "Ato N de 7"', () => {
    for (const c of CHAPTERS) expect(c.kicker, c.id).not.toMatch(/\d/);
    for (const a of HOME_ACTS) expect(a.label, a.id).not.toMatch(/\d/);
    expect(CHAPTERS.map((c) => c.kicker)).toEqual(['O que é', 'Por dentro', 'Como entra', 'Como se espalha', 'A vacina']);
    expect(CHAPTERS.map((c) => c.title)).toEqual(['Um vírus da gripe, de perto.', 'Peça por peça.', 'Uma chave, uma fechadura.', 'De uma pessoa para outra.', 'Anticorpos prontos antes do encontro.']);
    expect([ACT_BRASIL.kicker, ACT_BRASIL.title]).toEqual(['No Brasil', 'O que os registros oficiais mostram.']);
    expect([ACT_CONTINUE.kicker, ACT_CONTINUE.title]).toEqual(['Continue daqui', 'E agora?']);
    expect(HOME_ACTS.map((a) => a.id)).toEqual(['ato-01', 'ato-02', 'ato-03', 'ato-04', 'ato-05', 'ato-06', 'ato-07']);
    expect(HOME_ACTS).toHaveLength(HOME_ACT_COUNT);
    expect(actAccessibleName('03', 'Como entra')).toBe('Ato 3 de 7: Como entra');
  });

  it('tema por passo: deep só do ato 3 passo 3 ao ato 4 passo 1; warm no ato 5; paper nos demais; transição sobre painel opaco', () => {
    expect(DEEP_STEPS).toEqual([
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 0],
    ]);
    CHAPTER_COPY.forEach((c, i) => {
      c.steps.forEach((s, k) => {
        const expected = i === 4 ? 'warm' : DEEP_STEPS.some(([a, b]) => a === i && b === k) ? 'deep' : 'paper';
        expect(stepTheme(i, k), `${c.id} passo ${k + 1}`).toBe(expected);
      });
    });
    // no máximo 3 passos de texto direto no escuro (os de transição ficam sobre painel opaco de papel claro)
    const darkDirect = CHAPTER_COPY.flatMap((c) => c.steps).filter((s) => s.theme === 'deep' && !s.transition);
    expect(darkDirect.length).toBeLessThanOrEqual(3);
    expect(CHAPTER_COPY[2]!.steps[2]!.transition).toBe(true);
    expect(CHAPTER_COPY[3]!.steps[0]!.transition).toBe(true);
  });

  it('passos: contagens 3·5·5·4·5, ≤ 45 palavras, forma das HA/NA, vacina atribuída', () => {
    CHAPTER_COPY.forEach((c, i) => expect(c.steps.length, c.id).toBe(STEPS_PER_CHAPTER[i]));
    for (const c of CHAPTER_COPY) for (const s of c.steps) expect(s.text.split(/\s+/).length, s.text).toBeLessThanOrEqual(45);
    const all = CHAPTER_COPY.flatMap((c) => c.steps.map((s) => s.text)).join(' ');
    expect(all).toMatch(/cabeça arredondada/);
    expect(all).toMatch(/cabeça quadrada/);
    expect(all).toMatch(/a chave/);
    expect(all).toMatch(/a tesoura/);
    expect(all).toMatch(/segundo o Ministério da Saúde/);
    expect(all.toLowerCase()).not.toMatch(/protege (totalmente|completamente|sempre)|proteção (total|absoluta)/);
  });

  it('allFreeText cobre kickers, títulos de ato, abertura e índice', () => {
    const t = allFreeText();
    expect(t).toContain('O que é');
    expect(t).toContain('O que os registros oficiais mostram.');
    expect(t).toContain(OPENING.lead);
    expect(t).toContain('Sinais de alerta');
    for (const s of t) expect(s.toLowerCase()).not.toContain('tempo real');
  });
});

describe('fatos na home', () => {
  it('extractBigNumber tira "100" (nm) e "24" (h) dos fatos; nunca inventa valor', () => {
    const nm = extractBigNumber(facts.get('dou-2018-virus-100-nm')!.claim, 'nm');
    expect(nm).toMatchObject({ value: 100, approx: true, unit: 'nm' });
    const h = extractBigNumber(facts.get('transmissibilidade-adultos-24h-antes-pico-24-72h')!.quote!, 'h');
    expect(h).toMatchObject({ value: 24, unit: 'h' });
    expect(extractBigNumber('sem número aqui', 'nm')).toBeNull();
    expect(extractBigNumber('mede 120 nm', 'h')).toBeNull();
    expect(extractBigNumber('cerca de 80 nanômetros', 'nm')).toMatchObject({ value: 80, approx: true });
    expect(extractBigNumber('leva 24 h', 'h')).toMatchObject({ value: 24, approx: false });
  });

  it('shortSource, quoteLang e claimExcerpt', () => {
    expect(shortSource(facts.get('dou-2018-virus-100-nm')!.source_title)).toBe('Dou D. et al. (2018)');
    expect(shortSource('Ministério da Saúde — Gripe (influenza)')).toBe('Ministério da Saúde');
    expect(quoteLang(facts.get('dou-2018-virus-100-nm')!.quote)).toBe('en');
    expect(quoteLang(facts.get('ms-vacinacao-anual-mudanca-virus')!.quote)).toBe('pt');
    expect(quoteLang(undefined)).toBe('pt');
    expect(claimExcerpt('um dois três', 2)).toBe('um dois…');
  });

  it('FactCompact: afirmação + fonte curta visíveis, citação em inglês com lang="en" atrás de <details>, aria-label único', () => {
    const html = renderToStaticMarkup(<FactCompact id="dou-2018-virus-100-nm" ctx="teste" />);
    expect(html).toContain('cerca de 100 nanômetros');
    expect(html).toContain('fonte: Dou D. et al. (2018)');
    expect(html).toMatch(/<details[^>]*id="fato-teste-dou-2018-virus-100-nm"/);
    expect(html).toContain('<q lang="en">');
    expect(html).toMatch(/aria-label="Fonte da afirmação &quot;Uma partícula esférica/);
    expect(html).toContain('Verificado por');
    const pt = renderToStaticMarkup(<FactCompact id="ms-vacinacao-anual-mudanca-virus" ctx="teste" />);
    expect(pt).not.toContain('lang="en"');
  });

  it('NumeroGigante: "cerca de 100 nm" e "24 h" extraídos dos fatos; ato 5 só a palavra "Todo ano."', () => {
    const nm = renderToStaticMarkup(<NumeroGigante moment={{ factId: 'dou-2018-virus-100-nm', kind: 'nm', caption: 'forma esférica' }} ctx="t" />);
    expect(nm).toMatch(/cerca de<\/span><span class="bignum">100<\/span><span[^>]*>nm<\/span>/);
    expect(nm).toContain('forma esférica');
    expect(nm).toContain('fonte: Dou D. et al. (2018)');
    const h = renderToStaticMarkup(<NumeroGigante moment={{ factId: 'transmissibilidade-adultos-24h-antes-pico-24-72h', kind: 'h', preferQuote: true }} ctx="t" />);
    expect(h).toMatch(/<span class="bignum">24<\/span><span[^>]*>h<\/span>/);
    expect(h).toContain('adultos saudáveis');
    expect(h).toContain('em quantidades mais baixas');
    const w = renderToStaticMarkup(<NumeroGigante moment={{ factId: 'ms-vacinacao-anual-mudanca-virus', kind: 'word', word: 'Todo ano.' }} ctx="t" />);
    expect(w).toContain('Todo ano.');
    expect(w).not.toContain('class="bignum">');
    expect(w).toContain('Ministério da Saúde');
  });
});

describe('ato 6 · No Brasil (mock da API)', () => {
  it('um número gigante com indicador "confirmada", período, situação, universo, fonte, base de, geografia e links; FluNet como cartão; sem "tempo real"', async () => {
    const html = renderToStaticMarkup(await BrasilAct());
    expect(html).toMatch(/<section[^>]*id="ato-06"[^>]*data-act="06"/);
    expect(html).toContain('O que os registros oficiais mostram.');
    expect(html).toContain('SRAG com A(H1N1)pdm09 confirmada');
    expect(html).not.toContain('casos de H1N1 confirmados');
    expect((html.match(/class="bignum"/g) ?? []).length).toBe(1);
    expect(html).toContain('semana epidemiológica');
    expect(html).toContain('41/2026');
    expect(html).toContain('Valor provisório');
    expect(html).toContain('não todos os casos de H1N1 da população');
    expect(html).toContain('SIVEP-Gripe / SRAG, 2019 a 2026 (Ministério da Saúde / DATASUS)');
    // next/link normaliza a barra final fora do runtime do Next: aceita com ou sem
    expect(html).toMatch(/href="\/dados\/fontes\/?"/);
    expect(html).toContain('base de 13/10/2026');
    expect(html).toContain('Brasil (UF de residência do paciente)');
    expect(html).toMatch(/href="\/dados\/brasil\/?\?indicador=sivep_srag_ah1n1pdm09_confirmed"/);
    expect(html).toMatch(/href="\/dados\/metodologia\/?"/);
    // número final no HTML desde o SSR (22 notificações na fixture)
    expect(html).toMatch(/class="bignum"><span class="relative inline-block "><span>22<\/span>/);
    expect(html).toContain('Detecções de A(H1N1)pdm09 (FluNet)');
    expect(html).toContain('Os dois números medem coisas diferentes e não se somam.');
    expect(html).toContain('base de 12/10/2026');
    expect(html).toContain('Ver como tabela');
    expect(html).toContain('ocultad');
    expect(html).toContain('52 semanas');
    expect(html).toContain('provisórias (cauda tracejada)');
    expect(html).toContain('podem ter atraso');
    expect(html.toLowerCase()).not.toContain('tempo real');
  });

  it('variação ▲/▼ só com valor e base suficientes e sem supressão', () => {
    const latest = { indicator: { id: 'x', name: 'x' }, geo_code: 'BRA', period: '2026-W41', period_end: '2026-10-10', value: 22, suppressed: false, provisional: true, trend_pct_vs_4w: -46.7, data_as_of: '2026-10-13' };
    expect(trendAllowed(latest, 41)).toBe(true);
    expect(trendAllowed({ ...latest, value: 7 }, 41)).toBe(false);
    expect(trendAllowed(latest, 10)).toBe(false);
    expect(trendAllowed(latest, null)).toBe(false);
    expect(trendAllowed({ ...latest, suppressed: true, value: null }, 41)).toBe(false);
    const obs = (vals: Array<number | null>) => vals.map((v, i) => ({ geo_level: 'country' as const, geo_code: 'BRA', period: `2026-W${String(i + 1).padStart(2, '0')}`, period_start: '', period_end: '', value: v, denominator: null, stratum: {}, suppressed: false, update_status: 'final' as const, quality_flags: [] }));
    expect(baselineMean(obs([10, 20, 30, 40, 99]))).toBe(25);
    expect(baselineMean(obs([10, null, 30, 40, 99]))).toBeNull();
    expect(baselineMean(obs([1, 2]))).toBeNull();
  });
});

describe('ato 7 e versão em texto', () => {
  it('Continue: índice em ordem de necessidade, só páginas elegíveis, aviso clínico fixo, sem lista de sintomas nem "tempo real"', () => {
    const html = renderToStaticMarkup(<Continue />);
    expect(html).toMatch(/<section[^>]*id="ato-07"[^>]*data-act="07"/);
    expect(html).toContain('E agora?');
    expect(html).toContain('Este conteúdo é educativo e não substitui avaliação médica.');
    expect(html).toContain('Em caso de sinais de alerta, procure um serviço de saúde. Veja a lista oficial em ');
    expect(html).toContain('/sintomas/sinais-de-alerta/');
    expect(html).not.toContain('falta de ar');
    expect(html).not.toContain('febre persistente');
    expect(html.toLowerCase()).not.toContain('tempo real');
    expect(html).toContain('Dados do Brasil');
    expect(html).toContain('Sala de dados');
    expect(html).toContain('Fontes e metodologia');
    const order = HOME_INDEX.map((i) => i.label).filter((l) => html.includes(l));
    expect(html.indexOf('Dados do Brasil')).toBeLessThan(html.indexOf('Sala de dados'));
    expect(order.length).toBeGreaterThanOrEqual(3);
  });

  it('TextVersion: seção com id versao-em-texto, cinco atos e as seis peças', () => {
    const html = renderToStaticMarkup(<TextVersion />);
    expect(html).toMatch(/<section[^>]*id="versao-em-texto"/);
    for (const c of CHAPTERS) expect(html).toContain(c.title);
    expect(html).toContain('Hemaglutinina (o H)');
    expect(html).toContain('Canal M2');
    // fato compartilhado por duas peças recebe ids distintos (contexto por peça)
    expect(html).toContain('id="fato-peca-texto-envelope-krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2"');
    expect(html).toContain('id="fato-peca-texto-m2-krammer-2018-envelope-lipidico-derivado-da-celula-e-canal-m2"');
    expect(html).toContain('id="fato-texto-dou-2018-virus-100-nm"');
  });
});

describe('home completa (SSR)', () => {
  it('h1 na abertura, 7 seções [data-act] ato-01…ato-07 com h2, data-theme deep só nos passos permitidos, canvas ausente no SSR', async () => {
    const html = renderToStaticMarkup(await Home());
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    const acts = [...html.matchAll(/<section[^>]*\bid="(ato-\d\d)"[^>]*\bdata-act="(\d\d)"/g)].map((m) => [m[1], m[2]]);
    expect(acts).toEqual([
      ['ato-01', '01'],
      ['ato-02', '02'],
      ['ato-03', '03'],
      ['ato-04', '04'],
      ['ato-05', '05'],
      ['ato-06', '06'],
      ['ato-07', '07'],
    ]);
    for (const [id] of acts) expect(html, id).toMatch(new RegExp(`<h2[^>]*id="${id}-titulo"`));
    expect((html.match(/data-theme="deep"/g) ?? []).length).toBe(DEEP_STEPS.length);
    expect((html.match(/data-theme="warm"/g) ?? []).length).toBe(STEPS_PER_CHAPTER[4]);
    expect((html.match(/data-step/g) ?? []).length).toBe(STEPS_PER_CHAPTER.reduce((a, b) => a + b, 0));
    expect(html).toContain('ilustração fora de escala');
    expect(html).toContain('aria-label="Atos"');
    expect(html).toContain('id="versao-em-texto"');
    expect(html).not.toContain('<canvas');
    // sem `aria-live` por rolagem nem `aria-current="step"` no filme (atos 0–5); o mapa por UF do ato 6 tem o seu próprio status de carregamento
    const film = html.slice(0, html.indexOf('id="ato-06"'));
    expect(film).not.toContain('aria-live');
    expect(html).not.toContain('aria-current="step"');
    expect(html.toLowerCase()).not.toContain('tempo real');
    expect(html).not.toContain('falta de ar');
    // ids de fato únicos no documento
    const ids = [...html.matchAll(/\bid="(fato-[^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size, ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')).toBe(ids.length);
  });
});
