// Refinamento da UI (spec 16), a criação da trilha na web. Item 1: quando a proposta fica pronta, a tela vai para a lição 1, não para o troféu.
// A conta da rolagem é pura (src/app/previa-trilha-regras.ts) e o teste a confere; o fonte da tela confere o resto (o nó 1, o Stu ao lado, o troféu a uma rolagem).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DURACAO_ATE_O_NO_1_MS, rolagemNoInstante, rolagemParaCentrarNo, saidaSuave } from '../src/app/previa-trilha-regras.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('item 1: a rolagem até o nó 1 dura 600 ms, com saída suave (começa depressa e pousa devagar)', () => {
  assert.equal(DURACAO_ATE_O_NO_1_MS, 600);
  assert.equal(saidaSuave(0), 0);
  assert.equal(saidaSuave(1), 1);
  assert.ok(saidaSuave(0.5) > 0.85, 'na metade do tempo já andou mais de 85% (saída suave)');
  let anterior = -1;
  for (let passo = 0; passo <= 20; passo += 1) {
    const valor = saidaSuave(passo / 20);
    assert.ok(valor >= anterior, 'nunca volta');
    anterior = valor;
  }
  assert.equal(saidaSuave(-1), 0, 'antes do começo');
  assert.equal(saidaSuave(7), 1, 'depois do fim');
});

test('item 1: a rolagem no instante: de onde estava até o nó 1; com duração 0 (movimento reduzido), já no destino', () => {
  assert.equal(rolagemNoInstante(611, 0, 0, 600), 611, 'no começo, onde estava (no troféu)');
  assert.equal(rolagemNoInstante(611, 0, 600, 600), 0, 'no fim, no nó 1');
  assert.equal(rolagemNoInstante(611, 0, 9999, 600), 0, 'além do fim, segue no nó 1');
  assert.ok(rolagemNoInstante(611, 0, 300, 600) < 611 * 0.2, 'na metade já está perto do destino');
  assert.equal(rolagemNoInstante(611, 0, 0, 0), 0, 'movimento reduzido: direto ao nó 1');
  assert.equal(rolagemNoInstante(0, 240, 100, 0), 240);
});

test('item 1: o nó 1 vai para o centro da área livre; no começo ou no fim do mapa, o que a rolagem permitir', () => {
  // O nó está 800 px abaixo do topo do conteúdo; a área tem 600 px: rolar 500 põe o centro dele no meio da área.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 100 + 800 - 0, topoDaArea: 100, alturaDaArea: 600, rolagem: 0, alturaDoConteudo: 2000 }), 500);
  // Já rolado 300: o centro do nó está em 400 na janela, a área começa em 100: no conteúdo ele está em 400 − 100 + 300 = 600; área de 500 → 350.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 400, topoDaArea: 100, alturaDaArea: 500, rolagem: 300, alturaDoConteudo: 1500 }), 350);
  // Nó perto do topo do conteúdo (o caso da lição 1): não há como centrar, fica no começo.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 100 + 63 - 365, topoDaArea: 100, alturaDaArea: 605, rolagem: 365, alturaDoConteudo: 1216 }), 0);
  // Nó perto do fim: nunca passa do fim da rolagem.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 100 + 1500, topoDaArea: 100, alturaDaArea: 600, rolagem: 0, alturaDoConteudo: 1600 }), 1000);
  // Conteúdo menor que a área: nada rola.
  assert.equal(rolagemParaCentrarNo({ centroDoNoNaTela: 300, topoDaArea: 100, alturaDaArea: 600, rolagem: 0, alturaDoConteudo: 500 }), 0);
});

test('item 1: a tela da proposta vai ao nó 1 (e não mais ao troféu), com o Stu ao lado, e o troféu fica a um toque de "Ver o fim da trilha"', () => {
  const tela = ler('src/app/previa-trilha.tsx');
  // Ao ficar pronta (e a pessoa acompanhando): acha o nó 1, calcula o centro da área livre e rola; movimento reduzido vai direto.
  assert.match(tela, /area\.querySelector<HTMLElement>\('\[data-primeiro\] \.previa-no__face'\)/);
  assert.match(tela, /rolagemParaCentrarNo\(\{/);
  assert.match(tela, /rolarAte\(area, alvo, movimentoReduzido\(\) \? 0 : DURACAO_ATE_O_NO_1_MS, \(\) => setIndoAoPrimeiro\(false\)\)/);
  // O trecho de "proposta pronta" não rola mais até o troféu.
  const trechoPronta = tela.slice(tela.indexOf('propostaApresentada.current = proposta.token;'), tela.indexOf('painel.current?.querySelector<HTMLButtonElement>(\'.previa-comecar\')'));
  assert.ok(trechoPronta.length > 200 && !/trofeu\.current/.test(trechoPronta), 'o troféu não é mais o destino da proposta pronta');
  // O Stu (stu-feliz) fica no nó 1 enquanto a tela vai para lá, e só vai para o troféu quando a pessoa chega nele.
  assert.match(tela, /const stuNoTrofeu = !!proposta && trofeuAVista && !indoAoPrimeiro && !salvando && !falhou;/);
  assert.match(tela, /const comStu = proposta \? i === 0 && !stuNoTrofeu : i === nos\.length - 1;/);
  assert.match(tela, /proposta \? 'stu-feliz'/);
  // O troféu continua a uma rolagem de distância: "Ver o fim da trilha" rola até ele.
  const voltar = tela.slice(tela.indexOf('function voltarAAcompanhar()'), tela.indexOf('useLayoutEffect(() => {', tela.indexOf('function voltarAAcompanhar()')));
  assert.match(voltar, /const alvo = proposta \? trofeu\.current/);
  assert.match(voltar, /area\.scrollTo\(\{ top: Math\.max\(0, destino\)/);
  // Se a pessoa mexer na rolagem no meio, a animação sai da frente; ao sair da tela, ela é cancelada.
  assert.match(tela, /Math\.abs\(area\.scrollTop - ultimo\) > 2/);
  assert.match(tela, /useEffect\(\(\) => \(\) => cancelarRolagem\.current\?\.\(\), \[\]\);/);
});
