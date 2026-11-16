'use strict';
// Celular (web): lição 1 do violão. Mapa, conceito com o Stu, pares errados, reforço, pares certos e lição concluída.
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');
const L = require('../licao.cjs');
const respostas = require('../respostas.json');

(async () => {
  const licao = respostas.violao.licoes[0];
  const [pares, lacuna] = licao.exercicios;
  const conta = preparar({ trilhas: [{ objetivo: 'Quero aprender violão do zero', concluir: 0 }] });
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${WEB}/`, '.caminho-no__alvo');
  await g.segurar(1500);

  await g.gravar('mapa-inicio');
  await g.segurar(1500);
  await g.tocar(page.getByRole('button', { name: /^(Começar|Continuar): / }).first(), { rotulo: 'abrir lição' });
  await g.esperar('.aula-etapa');
  await g.segurar(1500);
  await g.cortar();

  await g.gravar('conceito');
  await g.segurar(1700);
  for (let i = 0; i < 3; i += 1) {
    const ler = page.getByRole('button', { name: /Continuar lendo/ });
    if (!(await ler.isVisible().catch(() => false))) break;
    await g.tocar(ler, { rotulo: 'continuar lendo' });
    await g.segurar(1500);
  }
  await g.segurar(600);
  await g.cortar();

  await L.irAte(g, /EXERCÍCIO 1/);
  await g.segurar(500);

  await g.gravar('pares-erro');
  await g.segurar(800);
  await L.responder(g, pares, false);
  await L.verificar(g);
  await g.segurar(2000);
  await g.cortar();

  await g.gravar('reforco');
  await g.segurar(300);
  await g.tocar(page.getByRole('button', { name: /Ver outro jeito de entender/ }), { rotulo: 'outro jeito' });
  await g.esperar('.estudio-ponte .estudio-opcao');
  g.marcar('reforco-chegou');
  await g.segurar(2400);
  await g.tocar(page.locator('.estudio-ponte .estudio-opcao').filter({ hasText: pares.pares[0][1] }).first(), { rotulo: 'opção do reforço' });
  await g.segurar(450);
  await g.tocar(page.getByRole('button', { name: /Conferir este exemplo/ }), { rotulo: 'conferir' });
  await g.esperar('.estudio-retorno-ponte[data-estado="certa"]');
  g.marcar('reforco-certo');
  await g.segurar(2000);
  await g.cortar();

  await g.gravar('pares-certo');
  await g.segurar(300);
  await g.tocar(page.getByRole('button', { name: /^Tentar de novo/ }), { rotulo: 'tentar de novo' });
  await g.segurar(900);
  await L.responder(g, pares, true);
  await L.verificar(g);
  await g.segurar(2600);
  await g.cortar();

  await L.continuar(g, L.RITMO.rapido);
  await L.resolver(g, lacuna);
  await g.esperar('.como-foi');
  await g.tocar(page.locator('.como-foi__sem-cronometro'), { ...L.RITMO.rapido, rotulo: 'já pratiquei' });
  await g.tocar(page.locator('.como-foi label').filter({ hasText: 'Consegui' }), { ...L.RITMO.rapido, rotulo: 'consegui' });
  await g.segurar(900);

  await g.gravar('concluida');
  await g.segurar(500);
  await g.tocar(page.getByRole('button', { name: /^Concluir lição/ }), { rotulo: 'concluir' });
  await g.esperar('.painel--concluida');
  g.marcar('concluida');
  await g.segurar(3600);
  await g.cortar();

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
