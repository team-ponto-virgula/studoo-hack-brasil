'use strict';
// Celular (web): "Tenho um material". O material de demonstração (frações) vira trilha, e a lição cita a página.
const path = require('path');
const { abrir, novaSessao, WEB } = require('../gravador.cjs');

(async () => {
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token: novaSessao(), saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${WEB}/`, 'main h1');
  await g.segurar(1200);

  await g.gravar('material-enviar');
  await g.segurar(800);
  await g.tocar(page.getByRole('button', { name: /Tenho um material/ }).first(), { rotulo: 'tenho um material' });
  await g.segurar(1500);
  await g.tocar(page.getByRole('button', { name: /Quero experimentar primeiro/ }).first(), { rotulo: 'experimentar' });
  await g.esperar(page.getByRole('button', { name: /Criar trilha deste material/ }));
  g.marcar('material-lido');
  await g.segurar(1100);
  await g.tocar(page.locator('summary').filter({ hasText: 'Página 1' }).first(), { rotulo: 'página 1' });
  await g.segurar(1900);
  await g.tocar(page.getByRole('button', { name: /Criar trilha deste material/ }), { rotulo: 'criar trilha' });
  await g.esperar(page.getByRole('button', { name: /^Começar/ }).first());
  g.marcar('trilha-pronta');
  await g.segurar(2200);
  await g.cortar();

  await g.gravar('material-licao');
  await g.segurar(400);
  await g.tocar(page.getByRole('button', { name: /^Começar/ }).first(), { rotulo: 'começar' });
  await g.esperar('.aula-etapa');
  await g.segurar(1700);
  for (let i = 0; i < 2; i += 1) {
    // Alguns quadros antes de olhar: o rodapé só troca "Continuar lendo" por "Avançar" quando a página redesenha.
    await g.segurar(80);
    const ler = page.getByRole('button', { name: /Continuar lendo/ });
    if (!(await ler.isVisible().catch(() => false))) break;
    try { await g.tocar(ler, { rotulo: 'continuar lendo' }); } catch { break; }
    await g.segurar(1700);
  }
  await g.segurar(900);
  await g.cortar();

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
