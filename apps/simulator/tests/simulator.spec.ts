import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page, path = '/?lang=pt') {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'H1N1 Jornada da Infecção', exact: true })).toBeVisible();
  await expect(page.getByTestId('journey-renderer-status')).toContainText(/WebGPU|WebGL 2/);
  await expect(page.getByLabel('Atlas 3D interativo do corpo humano')).toBeVisible();
}
async function pause(page: Page) {
  const pause = page.getByRole('button', { name: 'Pausar', exact: true });
  if (await pause.isVisible()) await pause.click();
}
const hour = (page: Page) => page.getByTestId('simulated-hour').textContent().then(Number);

test('opens with the simulation running and freezes only on pause', async ({ page }) => {
  await ready(page);
  await expect.poll(() => hour(page)).toBeGreaterThan(0);
  await pause(page); const frozen = await hour(page);
  await page.waitForTimeout(700); expect(await hour(page)).toBe(frozen);
});

test('all anatomical scales preserve the same clock and seed', async ({ page }) => {
  await ready(page); await pause(page);
  await page.getByLabel('Linha do tempo', { exact: true }).press('Home');
  for (const [name, level] of [['Respiratório','respiratory'],['Pulmão','organ'],['Tecido','tissue'],['Célula','cell'],['Corpo','body']]) {
    await page.getByRole('button',{name:`Explorar ${name}`,exact:true}).click();
    await expect(page.locator('.lab-stage')).toHaveAttribute('data-level',level!);
    expect(await hour(page)).toBe(0); await expect(page.getByTestId('current-seed')).toHaveText('2009');
  }
});

test('day-three intervention changes B and removal restores A', async ({ page }) => {
  await ready(page); await pause(page);
  await page.getByLabel('Linha do tempo', { exact: true }).press('Home');
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Avançar um dia',exact:true}).click();
  await page.getByRole('button',{name:'＋ E se algo mudar? Adicionar evento',exact:true}).click();
  await page.getByLabel('Intensidade',{exact:true}).selectOption('high');
  await page.getByRole('button',{name:'Aplicar ao cenário',exact:true}).click();
  await page.getByRole('button',{name:'Fechar Adicionar evento',exact:true}).click();
  for(let i=0;i<3;i++) await page.getByRole('button',{name:'Avançar um dia',exact:true}).click();
  await page.getByRole('button',{name:'Comparar cenários',exact:true}).click();
  const values=()=>page.locator('.journey-scenario-indices').allTextContents();
  const changed=await values(); expect(changed[0]).not.toBe(changed[1]);
  await page.getByRole('button',{name:'Fechar Comparar cenários',exact:true}).click();
  await page.getByRole('button',{name:'＋ E se algo mudar? Adicionar evento',exact:true}).click();
  await page.getByRole('button',{name:'Remover Dormiu mal por 2 noites',exact:true}).click();
  await page.getByRole('button',{name:'Fechar Adicionar evento',exact:true}).click();
  await page.getByRole('button',{name:'Comparar cenários',exact:true}).click();
  const baseline=await values(); expect(baseline[0]).toBe(baseline[1]);
});

test('dialog pauses reading time and resumes the ongoing demonstration',async({page})=>{
  await ready(page); await page.getByRole('button',{name:'Como explorar',exact:true}).click();
  const frozen=await hour(page); await page.waitForTimeout(700); expect(await hour(page)).toBe(frozen);
  await page.getByRole('button',{name:'Vamos explorar ↗',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pausar',exact:true})).toBeVisible();
  await expect.poll(()=>hour(page)).toBeGreaterThan(frozen);
});

test('WebGL 2 renders the same anatomy and running clock',async({page},testInfo)=>{
  await ready(page,'/?renderer=webgl&lang=pt');
  await expect(page.getByTestId('journey-renderer-status')).toContainText('WebGL 2');
  await expect.poll(()=>hour(page)).toBeGreaterThan(0);
  await page.screenshot({path:testInfo.outputPath('journey-webgl.png'),fullPage:true});
});

test('responsive layout fits the viewport',async({page},testInfo)=>{
  await ready(page); await pause(page);
  const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
  expect(size.content).toBeLessThanOrEqual(size.width+1);
  await page.screenshot({path:testInfo.outputPath('journey-overview.png'),fullPage:true});
});
