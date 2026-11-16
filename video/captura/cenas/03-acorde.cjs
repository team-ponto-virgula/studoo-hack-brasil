'use strict';
// Celular (web): lição 2 do violão. O diagrama do Lá menor, "Ouvir o acorde", o passo a passo e um exercício de escolha.
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');
const L = require('../licao.cjs');
const respostas = require('../respostas.json');

(async () => {
  const licao = respostas.violao.licoes[1];
  const conta = preparar({ trilhas: [{ objetivo: 'Quero aprender violão do zero', concluir: 1 }] });
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${WEB}/`, '.caminho-no__alvo');
  await g.segurar(1200);
  await L.abrirAtual(g);
  await g.segurar(600);

  await g.gravar('acorde');
  await g.segurar(1300);
  const ouvir = page.getByRole('button', { name: /Ouvir o acorde/ }).first();
  await g.trazer(ouvir, { rodape: 190, ms: 900 });
  await g.segurar(900);
  await g.tocar(ouvir, { rotulo: 'ouvir o acorde' });
  g.marcar('som', { som: 'acorde', nome: 'Am', casas: [-1, 0, 2, 2, 1, 0] });
  await g.segurar(3000);
  await g.cortar();

  await L.irAte(g, /DEMONSTRAÇÃO/);
  await g.gravar('passo-a-passo');
  await g.segurar(1000);
  for (let i = 0; i < 3; i += 1) {
    const ler = page.getByRole('button', { name: /Continuar lendo/ });
    if (!(await ler.isVisible().catch(() => false))) break;
    await g.tocar(ler, { rotulo: 'continuar lendo' });
    await g.segurar(1500);
  }
  await g.segurar(500);
  await g.cortar();

  await L.irAte(g, /EXERCÍCIO 1/);
  await g.segurar(400);
  await g.gravar('escolha');
  await g.segurar(900);
  await L.responder(g, licao.exercicios[0], true);
  await L.verificar(g);
  await g.segurar(2600);
  await g.cortar();

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
