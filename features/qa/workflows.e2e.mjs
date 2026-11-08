import {test,expect} from '@playwright/test';

test('orders search, keyboard dialog and empty state',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?pedidos=1');await expect(page.getByRole('heading',{name:'Pedidos de piscinas',exact:true})).toBeVisible();
  await page.getByRole('searchbox',{name:'Buscar',exact:true}).fill('nonexistent-fixture');
  await expect(page.locator('#fo-rows')).toContainText('Nenhum');
  await page.getByRole('searchbox',{name:'Buscar',exact:true}).fill('');
  await page.getByRole('button',{name:'+ Novo pedido',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});
test('new order persists after reload and stays inside the selected company',async({page})=>{
  await page.goto('/?pedidos=1');await page.getByRole('button',{name:'+ Novo pedido',exact:true}).click();
  const form=page.getByRole('dialog');await form.getByLabel('Nome do cliente *',{exact:true}).fill('Cliente E2E '+test.info().project.name);
  await form.getByLabel('Endereço de entrega *',{exact:true}).fill('Rua fictícia 10');
  await form.getByLabel('Modelo / produto',{exact:true}).fill('Piscina de teste');await form.getByLabel('Preço unitário (R$)',{exact:true}).fill('12000');
  await form.getByRole('button',{name:'Registrar pedido',exact:true}).click();
  await expect(page.getByRole('heading',{name:/PED-\d+/})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Pedidos de piscinas',exact:true})).toBeVisible();
  await page.getByRole('searchbox',{name:'Buscar',exact:true}).fill('Cliente E2E '+test.info().project.name);await expect(page.locator('#fo-rows')).toContainText('Piscina de teste');
  await page.getByLabel('Empresa ativa').selectOption('org-b');await expect(page.locator('#fo-rows')).not.toContainText('Piscina de teste');
});
test('dock shortcuts respect catalog, persistence, Escape and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByRole('button',{name:'Personalizar barra inferior',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('searchbox',{name:'Buscar função'}).fill('Financeiro');
  await dialog.getByRole('checkbox',{name:'Financeiro',exact:true}).check();await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.locator('.workspace-mobile-dock').getByRole('button',{name:'Financeiro',exact:true})).toBeVisible();
  await page.reload();await expect(page.locator('.workspace-mobile-dock').getByRole('button',{name:'Financeiro',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Personalizar barra inferior',exact:true}).click();await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Personalizar barra inferior',exact:true})).toBeFocused();
});
