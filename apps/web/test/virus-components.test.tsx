import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { VirusPartPanel } from '@/components/virus/VirusPartPanel';
import { POSTER_SRC, VirusPoster } from '@/components/virus/VirusPoster';
import { BrasilNow } from '@/components/virus/BrasilNow';

describe('componentes do explicador (sem WebGL)', () => {
  it('VirusPoster reserva dimensões e tem alternativa textual (ou é decorativo)', () => {
    const html = renderToStaticMarkup(<VirusPoster />);
    expect(html).toContain(`src="${POSTER_SRC}"`);
    expect(html).toMatch(/width="1200"/);
    expect(html).toMatch(/height="630"/);
    expect(html).toMatch(/alt="Ilustração do vírus/);
    const deco = renderToStaticMarkup(<VirusPoster decorative />);
    expect(deco).toContain('alt=""');
    expect(deco).toContain('aria-hidden="true"');
  });

  it('VirusPartPanel mostra explicação, fatos injetados e navegação anterior/próxima', () => {
    const html = renderToStaticMarkup(<VirusPartPanel part="na" facts={{ 'krammer-2018-neuraminidase-libera-novos-virus': <span>FATO-NA</span> }} onClose={() => {}} onChange={() => {}} />);
    expect(html).toContain('Neuraminidase (o N)');
    expect(html).toContain('FATO-NA');
    expect(html).toContain('Fechar explicação');
    expect(html).toContain('Hemaglutinina (H)');
    expect(html).toContain('8 segmentos de RNA');
  });

  it('BrasilNow (mock) renderiza os dois indicadores com período, provisório, universo e base de', async () => {
    const html = renderToStaticMarkup(await BrasilNow());
    expect(html).toContain('SRAG por influenza A(H1N1)pdm09');
    expect(html).toContain('Detecções de A(H1N1)pdm09 (FluNet)');
    expect(html).toContain('SE 41/2026');
    expect(html).toContain('provisório');
    expect(html).toContain('base de 13/10/2026');
    expect(html).toContain('base de 12/10/2026');
    expect(html).toMatch(/href="\/dados\/brasil\/?\?indicador=sivep_srag_ah1n1pdm09_confirmed"/);
    expect(html).not.toContain('tempo real');
  });
});
