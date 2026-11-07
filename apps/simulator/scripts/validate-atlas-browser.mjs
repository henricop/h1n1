import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Only accepts handles from the authorized Codex browser integration. */
export async function validateSimulator({browser,tab,outputDirectory,label,viewportSize,samples=3}) {
  await mkdir(outputDirectory,{recursive:true});
  const viewport=await browser.capabilities.get('viewport');
  if(viewportSize)await viewport.set(viewportSize);else await viewport.reset();
  await tab.goto('http://127.0.0.1:3000/');
  const button=name=>tab.playwright.getByRole('button',{name,exact:true});
  const field=name=>tab.playwright.getByLabel(name,{exact:true});
  const read=()=>tab.playwright.evaluate(()=>({hour:Number(document.querySelector('[data-testid="simulated-hour"]')?.textContent),level:document.querySelector('.lab-stage')?.getAttribute('data-level'),scenario:document.querySelector('[data-testid="active-scenario"]')?.textContent,renderer:document.querySelector('[data-testid="journey-renderer-status"]')?.textContent,geometries:Number(document.querySelector('[data-testid="gpu-geometries"]')?.textContent),width:innerWidth,content:document.documentElement.scrollWidth}));
  const capture=async(name)=>writeFile(join(outputDirectory,`${label}-${name}.png`),await tab.screenshot({fullPage:true}));
  const checks=[];
  const ready=async()=>{await tab.playwright.getByText('Preparando a anatomia completa',{exact:true}).waitFor({state:'hidden'});await tab.playwright.waitForTimeout(2400);};
  await ready();let state=await read();assert.ok(state.hour>0);assert.equal(state.width,state.content);assert.match(state.renderer,/WebGL 2/);checks.push('autoplay-h1n1-clock','responsive-layout','real-atlas-backend');await capture('h1n1-running');
  await button('Pausar').click();const frozen=(await read()).hour;await tab.playwright.waitForTimeout(650);assert.equal((await read()).hour,frozen);checks.push('pause-stability');
  if(viewportSize?.width<=700)await button('Abrir percurso H1N1').click();
  for(const name of ['Mucosa nasal','Traqueia','Brônquios','Bronquíolos','Alvéolos'])assert.equal(await button(`Focar ${name}`).count(),1);
  await button('Focar Traqueia').click();
  const before=await tab.screenshot({fullPage:false});await button('Aproximar anatomia').click();const after=await tab.screenshot({fullPage:false});assert.notEqual(Buffer.compare(Buffer.from(before),Buffer.from(after)),0);await button('Afastar anatomia').click();
  await button('Deslocar câmera').click();assert.equal(await button('Deslocar câmera').getAttribute('aria-pressed'),'true');
  const panBefore=await tab.screenshot({fullPage:false});await field('Atlas 3D interativo do corpo humano').press('ArrowRight');const panAfter=await tab.screenshot({fullPage:false});assert.notEqual(Buffer.compare(Buffer.from(panBefore),Buffer.from(panAfter)),0);
  await button('Orbitar livremente').click();await field('Atlas 3D interativo do corpo humano').press('Shift+ArrowRight');await button('Enquadrar região').click();checks.push('five-h1n1-regions','manual-zoom','pan-mode','keyboard-pan-orbit');
  await button('Buscar anatomia').click();await field('Buscar estruturas anatômicas').fill('trachea');
  await button('Traqueia trachea 1 peça').click();await button('Isolar estrutura ↗').click();await tab.playwright.waitForTimeout(450);await capture('isolated-trachea');
  assert.ok(await button('Explorar o tecido respiratório →').count());checks.push('search-select-isolate-source-structure');
  await button('Explorar o tecido respiratório →').click();assert.equal((await read()).level,'tissue');assert.equal((await read()).hour,frozen);
  await button('Entrar em uma célula').click();assert.equal((await read()).level,'cell');assert.equal((await read()).hour,frozen);checks.push('anatomy-tissue-cell-shared-clock');
  await field('Linha do tempo').press('Home');for(let i=0;i<3;i++)await button('Avançar um dia').click();
  await button('＋ E se algo mudar? Adicionar evento').click();await field('Intensidade').selectOption('high');await button('Aplicar ao cenário').click();await button('Fechar Adicionar evento').click();
  for(let i=0;i<3;i++)await button('Avançar um dia').click();await button('Comparar cenários').click();
  const comparisons=await tab.playwright.evaluate(()=>Array.from(document.querySelectorAll('.journey-scenario-indices')).map(e=>e.textContent));assert.notEqual(comparisons[0],comparisons[1]);await capture('scenario-day6');await button('Fechar Comparar cenários').click();checks.push('causal-h1n1-event-comparison');
  await button('Explorar Corpo').click();await ready();const baseline=(await read()).geometries;
  const geometrySamples=[];
  for(let cycle=0;cycle<2;cycle++){await button('Explorar Tecido').click();await button('Explorar Célula').click();await button('Explorar Corpo').click();await ready();geometrySamples.push((await read()).geometries);}
  assert.ok(geometrySamples.every(n=>n<=baseline+2),`${baseline} -> ${geometrySamples}`);checks.push('bounded-renderer-resources');
  if(viewportSize?.width<=700)await button('Abrir percurso H1N1').click();
  await button('Explorar anatomia completa').click();await button('Esqueleto').click();await field('Separar anatomia').press('End');await tab.playwright.waitForTimeout(1100);await capture('exploded-skeleton');assert.match(await tab.playwright.getByTestId('atlas-visible-count').innerText(),/296/);checks.push('optional-full-atlas-and-explosion');
  await button('Montar anatomia').click();await button('Girar anatomia').click();
  const fps=[];for(let i=0;i<samples;i++){await tab.playwright.waitForTimeout(1300);fps.push(Number((await read()).renderer.match(/(\d+) fps/)?.[1]));}
  const errors=await tab.dev.logs({levels:['error'],limit:50});assert.equal(errors.length,0,JSON.stringify(errors));checks.push('rotation-fps-sampled','no-console-errors');
  const result={label,checks,fps,resources:{baseline,geometrySamples},final:await read(),errors};await writeFile(join(outputDirectory,`${label}.json`),JSON.stringify(result,null,2));return result;
}
