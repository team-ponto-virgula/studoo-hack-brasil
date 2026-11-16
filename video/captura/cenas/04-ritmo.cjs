'use strict';
// Celular (web): lição 4 do violão (ritmo). A batida com o guia dos tempos, a prática com cronômetro e a conclusão.
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');
const L = require('../licao.cjs');
const respostas = require('../respostas.json');

(async () => {
  const licao = respostas.violao.licoes[3];
  const conta = preparar({ trilhas: [{ objetivo: 'Quero aprender violão do zero', concluir: 3 }] });
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${WEB}/`, '.caminho-no__alvo');
  await g.segurar(1200);

  await g.gravar('mapa-meio');
  await g.segurar(2400);
  await g.cortar();

  await L.abrirAtual(g);
  await L.irAte(g, /DEMONSTRAÇÃO/);
  await g.segurar(500);

  await g.gravar('batida');
  await g.segurar(900);
  const batida = page.getByRole('button', { name: /Ouvir a batida/ }).first();
  await g.trazer(batida, { rodape: 260, ms: 900 });
  await g.segurar(700);
  await g.tocar(batida, { rotulo: 'ouvir a batida' });
  g.marcar('som', { som: 'batida', bpm: 72, compassos: 2, casas: [-1, 0, 2, 2, 1, 0] });
  await g.segurar(7600);
  await g.cortar();

  await L.irAte(g, /EXERCÍCIO 1/);
  await L.resolver(g, licao.exercicios[0]);
  await L.resolver(g, licao.exercicios[1]);
  await g.esperar('.como-foi');
  await g.segurar(700);

  await g.gravar('pratica');
  await g.segurar(1400);
  const cronometro = page.locator('.cronometro__acoes button').first();
  await g.trazer(cronometro, { rodape: 330, ms: 900 });
  await g.segurar(600);
  await g.tocar(cronometro, { rotulo: 'começar cronômetro' });
  g.marcar('cronometro');
  await g.segurar(1700);
  const junto = page.getByRole('button', { name: /Tocar junto/ }).first();
  await g.trazer(junto, { rodape: 250, ms: 700 });
  await g.tocar(junto, { rotulo: 'tocar junto' });
  g.marcar('som', { som: 'batida', bpm: 72, compassos: 8, casas: [-1, 0, 2, 2, 1, 0] });
  await g.segurar(6400);
  await g.cortar();

  // O "Como foi?" libera com 30 s de cronômetro: o tempo passa fora da câmera.
  await g.segurar(27000);

  await g.gravar('como-foi');
  await g.segurar(700);
  const consegui = page.locator('.como-foi label').filter({ hasText: 'Consegui' });
  await g.trazer(consegui, { rodape: 240, ms: 800 });
  await g.segurar(500);
  await g.tocar(consegui, { rotulo: 'consegui' });
  await g.segurar(1900);
  await g.tocar(page.getByRole('button', { name: /^Concluir lição/ }), { rotulo: 'concluir' });
  await g.esperar('.painel--concluida');
  g.marcar('concluida');
  await g.segurar(3800);
  await g.cortar();

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
