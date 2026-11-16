'use strict';
// App (prévia web do Expo em 390x844 @3x, falando com a API de verdade): o mapa com o mesmo progresso e a lição.
const path = require('path');
const { abrir, preparar, APP } = require('../gravador.cjs');

(async () => {
  const conta = preparar({ trilhas: [{ objetivo: 'Quero aprender violão do zero', concluir: 3 }] });
  const g = await abrir({ largura: 390, altura: 844, escala: 3, token: conta.token, app: true, saida: path.join(__dirname, '../clipes') });
  const { page } = g;
  await g.ir(`${APP}/`, null);
  await g.ate(() => Boolean(document.querySelector('[data-testid="titulo-plano"]')), null, 9000);
  await g.segurar(3500);
  await g.foto(path.join(__dirname, '../folhas/_app-mapa.jpg'));

  await g.gravar('app');
  await g.segurar(1500);
  const atual = page.getByRole('button', { name: /^(Começar|Continuar): / }).first();
  await g.tocar(atual, { rotulo: 'abrir lição no app' });
  await g.ate(() => Boolean(document.querySelector('[data-testid="titulo-licao"]')), null, 3000);
  await g.segurar(1900);
  const ler = page.getByTestId('ler-mais').first();
  if (await ler.count()) {
    await g.tocar(ler, { rotulo: 'continuar lendo' });
    await g.segurar(1700);
  }
  await g.segurar(900);
  await g.cortar();
  await g.foto(path.join(__dirname, '../folhas/_app-licao.jpg'));

  const clipes = await g.fechar();
  console.log(JSON.stringify(clipes.map(({ nome, quadros, segundos }) => ({ nome, quadros, segundos }))));
})().catch((erro) => { console.error('FALHOU:', erro.message.slice(0, 900)); process.exit(1); });
