import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Receives handles from the official Codex browser extension. Never launches,
 * attaches to, or controls a personal browser through another transport. */
export async function validateSimulator({ browser, tab, outputDirectory, label, forceWebGL = false, viewportSize, samples = 4 }) {
  await mkdir(outputDirectory, { recursive: true });
  const viewport = await browser.capabilities.get('viewport');
  if (viewportSize) await viewport.set(viewportSize); else await viewport.reset();
  await tab.goto(`http://127.0.0.1:3000/${forceWebGL ? '?renderer=webgl' : ''}`);
  const button = name => tab.playwright.getByRole('button', { name, exact: true });
  const field = name => tab.playwright.getByLabel(name, { exact: true });
  const read = () => tab.playwright.evaluate(() => ({
    hour: Number(document.querySelector('[data-testid="simulated-hour"]')?.textContent),
    level: document.querySelector('.lab-stage')?.getAttribute('data-level'),
    branch: document.querySelector('[data-testid="active-scenario"]')?.textContent,
    seed: document.querySelector('[data-testid="current-seed"]')?.textContent,
    renderer: document.querySelector('[data-testid="journey-renderer-status"]')?.textContent,
    geometries: Number(document.querySelector('[data-testid="gpu-geometries"]')?.textContent),
    width: innerWidth, contentWidth: document.documentElement.scrollWidth,
  }));
  const comparison = () => tab.playwright.evaluate(() => Array.from(document.querySelectorAll('.journey-scenario-indices')).map(dl => Array.from(dl.querySelectorAll('dd')).map(dd => dd.textContent)));
  const capture = async name => writeFile(join(outputDirectory, `${label}-${name}.png`), await tab.screenshot({ fullPage: true }));
  const checks = [];
  await tab.playwright.getByText('Preparando o corpo humano.', { exact: true }).waitFor({ state: 'hidden' });
  await button('Pausar').waitFor({ state: 'visible' });
  await tab.playwright.waitForTimeout(1200);
  let state = await read();
  assert.ok(state.hour > 0, 'clock progresses automatically on opening');
  assert.equal(state.level, 'body'); assert.equal(state.branch, 'A');
  assert.match(state.renderer, forceWebGL ? /WebGL 2/ : /WebGPU|WebGL 2/);
  assert.ok(state.contentWidth <= state.width + 1);
  checks.push('autoplay-real-clock', 'body-first', 'backend-ready', 'no-horizontal-overflow');
  await capture('body-running');
  await button('Pausar').click(); const frozen = (await read()).hour;
  await tab.playwright.waitForTimeout(600); assert.equal((await read()).hour, frozen);
  checks.push('pause-stability');
  await field('Linha do tempo').press('Home');
  for (const [action, expected] of [['Seguir a respiração','respiratory'], ['Explorar os pulmões','organ'], ['Aproximar o tecido','tissue'], ['Entrar em uma célula','cell']]) {
    await button(action).click(); state = await read();
    assert.equal(state.level, expected); assert.equal(state.hour, 0); assert.equal(state.seed, '2009');
  }
  checks.push('five-scales-shared-clock-seed');
  await button('Explorar Pulmão').click();
  for (let i = 0; i < 3; i++) await button('Avançar um dia').click();
  assert.equal((await read()).hour,72); await capture('lung-day3');
  await button('Explorar Tecido').click(); await capture('tissue-day3');
  await button('Entrar em uma célula').click(); await capture('cell-day3');
  assert.ok(await field('Célula em foco').count());
  checks.push('selected-real-cell');
  await button('＋ E se algo mudar? Adicionar evento').click();
  await field('Intensidade').selectOption('high'); await capture('event-editor');
  await button('Aplicar ao cenário').click(); assert.equal((await read()).branch, 'B');
  await button('Fechar Adicionar evento').click();
  for (let i=0; i<3; i++) await button('Avançar um dia').click();
  assert.equal((await read()).hour,144);
  await button('Comparar cenários').click(); const modified = await comparison();
  assert.notDeepEqual(modified[0],modified[1]); await capture('comparison-day6');
  await button('Fechar Comparar cenários').click();
  await button('＋ E se algo mudar? Adicionar evento').click();
  await field('Ativar Dormiu mal por 2 noites').uncheck();
  await button('Fechar Adicionar evento').click();
  await button('Comparar cenários').click(); let equal = await comparison(); assert.deepEqual(equal[0],equal[1]);
  await button('Fechar Comparar cenários').click();
  await button('＋ E se algo mudar? Adicionar evento').click();
  await field('Ativar Dormiu mal por 2 noites').check();
  await button('Remover Dormiu mal por 2 noites').click();
  await button('Fechar Adicionar evento').click();
  await button('Comparar cenários').click(); equal = await comparison(); assert.deepEqual(equal[0],equal[1]);
  await button('Fechar Comparar cenários').click();
  checks.push('real-adversity-divergence', 'disable-restores-baseline', 'remove-restores-baseline');
  await button('Explorar Corpo').click(); await tab.playwright.waitForTimeout(1400);
  const baseline = (await read()).geometries;
  const bodyCounts = [];
  for(let cycle=0;cycle<3;cycle++) {
    for(const scale of ['Respiratório','Pulmão','Tecido','Célula','Corpo']) await button(`Explorar ${scale}`).click();
    await tab.playwright.waitForTimeout(1300); bodyCounts.push((await read()).geometries);
  }
  assert.ok(bodyCounts.every(count=>count<=baseline+2), `bounded geometry after swaps ${baseline} -> ${bodyCounts}`);
  checks.push('bounded-resources-after-15-scale-swaps');
  await button('Configurar simulação').click(); await field('Reduzir movimento').check();
  assert.equal(await field('Câmera automática').isEnabled(),false);
  await button('Fechar Configurar simulação').click();
  if(viewportSize?.width<=700) await button('Controles da câmera').click();
  await button('Girar à esquerda').click(); await button('Girar à direita').click();
  await button('Aproximar').click(); await button('Afastar').click(); await button('Enquadrar').click();
  checks.push('reduced-motion', 'accessible-camera-controls');
  await button('Configurar simulação').click(); await field('Reduzir movimento').uncheck(); await button('Fechar Configurar simulação').click();
  await button('Continuar').click(); const fps=[];
  for(let i=0;i<samples;i++) { await tab.playwright.waitForTimeout(1300); const s=await read(); fps.push(Number(s.renderer.match(/(\d+) fps/)?.[1])); }
  await button('Pausar').click(); state=await read(); assert.ok(state.hour>144); assert.ok(state.contentWidth<=state.width+1);
  const errors=await tab.dev.logs({levels:['error'],limit:50}); assert.equal(errors.length,0,JSON.stringify(errors));
  checks.push('running-fps-sampled','no-console-errors');
  await capture('final');
  const result={label,viewport:{width:state.width},backend:state.renderer,checks,fps,resources:{baseline,bodyCounts},final:state,errors};
  await writeFile(join(outputDirectory,`${label}.json`),JSON.stringify(result,null,2));
  return result;
}
