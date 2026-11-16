'use strict';
// Celular (web): última lição do violão. Resposta aberta com os critérios, "Trilha concluída!" e o mapa completo.
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');
const L = require('../licao.cjs');
const respostas = require('../respostas.json');

(async () => {
  const licao = respostas.violao.licoes[5];
  const conta = preparar({ trilhas: [{ objetivo: 'Quero aprender violão do zero', concluir: 5 }] });
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${WEB}/`, '.caminho-no__alvo');
  await g.segurar(1200);
  await L.abrirAtual(g);
  await L.irAte(g, /EXERCÍCIO 1/);
  await g.segurar(500);

  await g.gravar('aberta');
  await g.segurar(900);
  await L.responder(g, licao.exercicios[0], 'Eu deixo o indicador e o médio no lugar e só levo o anelar para a 3ª casa. A batida continua, sem parar o braço.');
  await L.verificar(g);
  await g.segurar(1500);
  const criterios = page.locator('.criterios, .aula-criterios, [class*="criterio"]').first();
  if (await criterios.count()) await g.trazer(criterios, { topo: 120, rodape: 330, ms: 900 });
  await g.segurar(2600);
  await g.cortar();

  await L.continuar(g, L.RITMO.rapido);
  await L.responder(g, licao.exercicios[1], true, L.RITMO.rapido);
  await L.verificar(g, L.RITMO.rapido);
  await g.segurar(900);

  await g.gravar('trofeu');
  await g.segurar(500);
  await g.tocar(page.getByRole('button', { name: /^Continuar$/ }), { rotulo: 'continuar (última)' });
  await g.esperar('.painel--concluida');
  g.marcar('trilha-concluida');
  await g.segurar(4200);
  await g.rolar(380, 1300);
  await g.segurar(1600);
  await g.cortar();

  const voltar = page.getByRole('button', { name: /Voltar à trilha|Ver a trilha/ }).first();
  await g.tocar(voltar, { ...L.RITMO.rapido, rotulo: 'voltar à trilha' });
  await g.esperar('.caminho-no__alvo');
  await g.segurar(1500);
  await g.gravar('mapa-final');
  await g.segurar(1200);
  const altura = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - window.scrollY);
  await g.rolar(Math.max(200, altura), 3600);
  await g.segurar(1600);
  await g.cortar();

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
