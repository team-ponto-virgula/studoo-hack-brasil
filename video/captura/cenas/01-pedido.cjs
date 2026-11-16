'use strict';
// Celular (web 390x844 @3x): pedir "violão do zero", ver a trilha nascer, conferir a prévia e começar.
const path = require('path');
const { abrir, novaSessao, WEB } = require('../gravador.cjs');

(async () => {
  const token = novaSessao();
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token, saida: path.join(__dirname, '../clipes'), ritmoGeracao: 300 });
  const { page } = g;
  await g.ir(`${WEB}/`, 'main h1');
  await g.segurar(900);

  await g.gravar('pedido');
  await g.segurar(900);
  await g.tocar(page.locator('textarea').first(), { rotulo: 'campo' });
  await g.segurar(250);
  await g.digitar('Quero aprender violão do zero');
  await g.segurar(450);
  await g.tocar(page.getByRole('button', { name: /Montar minha trilha/ }), { rotulo: 'montar' });
  g.marcar('geracao-inicio');
  await g.esperar(page.getByRole('button', { name: /^Começar/ }).first());
  g.marcar('geracao-fim');
  await g.segurar(1600);
  await g.cortar();

  await g.gravar('previa');
  await g.segurar(500);
  await g.rolar(430, 1400);
  await g.segurar(500);
  const nos = page.locator('.caminho-no, [data-estado="previa"]');
  await g.tocar(nos.nth(1), { rotulo: 'no-previa' });
  await g.segurar(2200);
  await g.cortar();

  await page.screenshot; // (sem captura do Playwright: o controle de quadros é do gravador)
  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 800)); process.exit(1); });
