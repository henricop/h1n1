import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VirusPartPanel } from '@/components/virus/VirusPartPanel';
import { POSTER_PAPER_SRC, POSTER_SRC, VirusPoster } from '@/components/virus/VirusPoster';
import { BrasilNow } from '@/components/virus/BrasilNow';
import { FatoCtx } from '@/components/virus/FatoCtx';

describe('componentes do explicador (sem WebGL)', () => {
  it('VirusPoster reserva dimensões e tem alternativa textual (ou é decorativo); variante de papel sem fundo', () => {
    const html = renderToStaticMarkup(<VirusPoster />);
    expect(html).toContain(`src="${POSTER_SRC}"`);
    expect(html).toMatch(/width="1200"/);
    expect(html).toMatch(/height="630"/);
    expect(html).toMatch(/alt="Ilustração do vírus/);
    const deco = renderToStaticMarkup(<VirusPoster decorative />);
    expect(deco).toContain('alt=""');
    expect(deco).toContain('aria-hidden="true"');
    const paper = renderToStaticMarkup(<VirusPoster decorative variant="paper" />);
    expect(paper).toContain(`src="${POSTER_PAPER_SRC}"`);
  });

  it('VirusPartPanel mostra explicação, fatos injetados e navegação anterior/próxima; nada abaixo de 14 px', () => {
    const html = renderToStaticMarkup(<VirusPartPanel part="na" facts={{ 'krammer-2018-neuraminidase-libera-novos-virus': <span>FATO-NA</span> }} onClose={() => {}} onChange={() => {}} />);
    expect(html).toContain('Neuraminidase (o N)');
    expect(html).toContain('FATO-NA');
    expect(html).toContain('Fechar explicação');
    expect(html).toContain('Hemaglutinina (H)');
    expect(html).toContain('8 segmentos de RNA');
    expect(html).not.toMatch(/text-\[1[0-3]px\]|text-xs/);
  });

  it('FatoCtx prefixa o id pelo contexto e mostra fonte curta', () => {
    const a = renderToStaticMarkup(<FatoCtx id="dou-2018-virus-100-nm" ctx="peca" />);
    const b = renderToStaticMarkup(<FatoCtx id="dou-2018-virus-100-nm" ctx="texto" />);
    expect(a).toContain('id="fato-peca-dou-2018-virus-100-nm"');
    expect(b).toContain('id="fato-texto-dou-2018-virus-100-nm"');
    expect(a).toContain('fonte: Dou D. et al. (2018)');
  });

  it('BrasilNow (wrapper do ato 6, mock) renderiza os dois indicadores com período, provisório, universo e base de', async () => {
    const html = renderToStaticMarkup(await BrasilNow());
    expect(html).toContain('SRAG com A(H1N1)pdm09 confirmada');
    expect(html).toContain('Detecções de A(H1N1)pdm09 (FluNet)');
    expect(html).toContain('41/2026');
    expect(html).toContain('provisório');
    expect(html).toContain('base de 13/10/2026');
    expect(html).toContain('base de 12/10/2026');
    expect(html).toMatch(/href="\/dados\/brasil\/?\?indicador=sivep_srag_ah1n1pdm09_confirmed"/);
    expect(html).not.toContain('tempo real');
  });
});
