'use strict';
// Teste rápido do gravador: abre o início com uma conta preparada e grava meio segundo numa pasta à parte.
const path = require('path');
const { abrir, preparar, WEB } = require('./gravador.cjs');

(async () => {
  const saida = process.argv[2] || path.join(require('os').tmpdir(), 'studoo-teste-gravador');
  const conta = preparar({ trilhas: [{ objetivo: 'Quero aprender violão do zero', concluir: 1 }] });
  const g = await abrir({ largura: 390, altura: 844, escala: 2, token: conta.token, saida });
  await g.ir(`${WEB}/`, '.caminho-no__alvo');
  await g.gravar('teste');
  await g.segurar(500);
  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, largura, altura, escala }) => ({ nome, quadros, largura, altura, escala }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 600)); process.exit(1); });
