'use strict';
// Computador (web 1280x800 @2x, com mouse): o mapa da trilha com a barra lateral, abrir a lição e ouvir a batida.
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');

(async () => {
  const conta = preparar({ trilhas: [
    { objetivo: 'Quero aprender violão do zero', concluir: 3 },
    { objetivo: 'Inglês para conversar em viagens', concluir: 2 },
    { objetivo: 'Culinária: receitas básicas', concluir: 6 },
  ] });
  const g = await abrir({ largura: 1280, altura: 800, escala: 2, toque: false, token: conta.token, saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${WEB}/`, '.caminho-no__alvo');
  await g.segurar(1500);

  await g.gravar('desktop');
  g.marcar('cursor', { x: g.ponteiro.x, y: g.ponteiro.y });
  await g.segurar(1100);
  await g.clicar(page.getByRole('button', { name: /^(Começar|Continuar): / }).first(), { viagem: 760, rotulo: 'abrir lição' });
  await g.esperar('.aula-etapa');
  await g.segurar(1500);
  const batida = page.getByRole('button', { name: /Ouvir a batida/ }).first();
  await g.trazer(batida, { rodape: 200, ms: 800 });
  await g.clicar(batida, { viagem: 700, rotulo: 'ouvir a batida' });
  g.marcar('som', { som: 'batida', bpm: 72, compassos: 2, casas: [-1, 0, 2, 2, 1, 0] });
  await g.segurar(4200);
  await g.cortar();

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
