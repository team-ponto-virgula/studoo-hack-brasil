'use strict';
// Celular (web): outros assuntos, um plano curto de cada (o recurso mais visual da trilha), e a lista "Minhas trilhas".
const path = require('path');
const { abrir, preparar, WEB } = require('../gravador.cjs');
const L = require('../licao.cjs');

const ASSUNTOS = [
  { nome: 'culinaria', objetivo: 'Culinária: receitas básicas', concluir: 3, etapa: /EXEMPLO|DEMONSTRAÇÃO/ },
  { nome: 'historia', objetivo: 'História do Brasil para a prova', concluir: 2, etapa: /EXEMPLO|DEMONSTRAÇÃO/ },
  { nome: 'fracoes', objetivo: 'Frações', concluir: 0, etapa: /EXEMPLO|DEMONSTRAÇÃO/ },
  { nome: 'fotografia', objetivo: 'Fotografia com o celular', concluir: 2, etapa: /EXEMPLO|DEMONSTRAÇÃO/ },
];

(async () => {
  const saida = path.join(__dirname, '../clipes');
  for (const assunto of ASSUNTOS) {
    const conta = preparar({ trilhas: [{ objetivo: assunto.objetivo, concluir: assunto.concluir }] });
    const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida });
    const { page } = g;
    await g.ir(`${WEB}/`, '.caminho-no__alvo');
    await g.segurar(1200);
    await g.gravar(`assunto-${assunto.nome}-mapa`);
    await g.segurar(2000);
    await g.cortar();
    await L.abrirAtual(g);
    await g.segurar(400);
    await g.gravar(`assunto-${assunto.nome}-conceito`);
    await g.segurar(1800);
    await g.cortar();
    await L.irAte(g, assunto.etapa);
    await g.segurar(400);
    await g.gravar(`assunto-${assunto.nome}`);
    await g.segurar(1100);
    for (let i = 0; i < 2; i += 1) {
      const ler = page.getByRole('button', { name: /Continuar lendo/ });
      if (!(await ler.isVisible().catch(() => false))) break;
      await g.tocar(ler, { rotulo: 'continuar lendo' });
      await g.segurar(1300);
    }
    await g.segurar(700);
    await g.cortar();
    await g.fechar();
  }

  // Minhas trilhas: várias trilhas, cada uma num ponto do caminho.
  {
    const conta = preparar({ trilhas: [
      { objetivo: 'Quero aprender violão do zero', concluir: 4 },
      { objetivo: 'Inglês para conversar em viagens', concluir: 2 },
      { objetivo: 'Culinária: receitas básicas', concluir: 6 },
      { objetivo: 'História do Brasil para a prova', concluir: 1 },
      { objetivo: 'Fotografia com o celular', concluir: 3 },
    ] });
    const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, saida });
    const { page } = g;
    await g.ir(`${WEB}/`, 'main h1');
    await g.segurar(1500);
    const lista = page.getByRole('button', { name: /^Minhas trilhas$/ }).last();
    await g.tocar(lista, { ...L.RITMO.rapido, rotulo: 'minhas trilhas' });
    await g.segurar(1500);
    await g.gravar('trilhas');
    await g.segurar(1800);
    await g.rolar(330, 1500);
    await g.segurar(1500);
    await g.cortar();
    await g.fechar();
  }
  console.log('assuntos ok');
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
