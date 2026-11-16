'use strict';
// Celular (web): inglês para viagem. Frases com pronúncia ("Ouça e repita") e a resposta aberta do restaurante,
// primeiro com "I want" (o retorno aponta o erro comum) e depois com "I'd like" (critérios atendidos).
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');
const L = require('../licao.cjs');
const respostas = require('../respostas.json');

(async () => {
  const saida = path.join(__dirname, '../clipes');

  // 1) Frases da primeira lição.
  {
    const conta = preparar({ trilhas: [{ objetivo: 'Inglês para conversar em viagens', concluir: 0 }] });
    const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida });
    const { page } = g;
    await g.ir(`${WEB}/`, '.caminho-no__alvo');
    await g.segurar(1200);
    await g.gravar('ingles-mapa');
    await g.segurar(2600);
    await g.cortar();
    await L.abrirAtual(g);
    await g.segurar(500);
    await g.gravar('ingles-conceito');
    await g.segurar(2200);
    await g.cortar();
    await L.irAte(g, /EXEMPLO/);
    await g.segurar(500);
    await g.gravar('ingles-frases');
    await g.segurar(900);
    const primeira = page.locator('.falas li').first();
    await g.trazer(primeira, { topo: 150, rodape: 420, ms: 900 });
    await g.segurar(900);
    await g.tocar(page.locator('.falas li').first().locator('.ouvir__botao').first(), { rotulo: 'ouvir frase 1' });
    g.marcar('som', { som: 'voz', texto: "Hello! I'm Ana." });
    await g.segurar(1900);
    await g.rolar(250, 900);
    await g.segurar(500);
    await g.tocar(page.locator('.falas li').nth(2).locator('.ouvir__botao').first(), { rotulo: 'ouvir frase 3' });
    g.marcar('som', { som: 'voz', texto: 'Nice to meet you!' });
    await g.segurar(2000);
    await g.cortar();
    await g.fechar();
  }

  // 2) Resposta aberta do restaurante.
  {
    const licao = respostas.ingles.licoes[5];
    const conta = preparar({ trilhas: [{ objetivo: 'Inglês para conversar em viagens', concluir: 5 }] });
    const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida });
    const { page } = g;
    await g.ir(`${WEB}/`, '.caminho-no__alvo');
    await g.segurar(1200);
    await L.abrirAtual(g);
    await L.irAte(g, /EXERCÍCIO 1/);
    await g.segurar(500);

    await g.gravar('ingles-erro');
    await g.segurar(900);
    await L.responder(g, licao.exercicios[0], 'I want a coffee and a cheese bread please');
    await L.verificar(g);
    await g.segurar(3200);
    await g.cortar();

    await g.tocar(page.getByRole('button', { name: /^Tentar de novo/ }), { ...L.RITMO.rapido, rotulo: 'tentar de novo' });
    await g.segurar(600);
    const campo = L.form(g).locator('textarea').first();
    await g.durante(campo.fill(''));
    await g.segurar(400);

    await g.gravar('ingles-certo');
    await g.segurar(600);
    await L.responder(g, licao.exercicios[0], "I'd like a coffee and a cheese bread, please.");
    await L.verificar(g);
    await g.segurar(1400);
    const criterios = page.locator('[class*="criterio"]').first();
    if (await criterios.count()) await g.trazer(criterios, { topo: 120, rodape: 330, ms: 900 });
    await g.segurar(2600);
    await g.cortar();
    await g.fechar();
  }
  console.log('inglês ok');
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
