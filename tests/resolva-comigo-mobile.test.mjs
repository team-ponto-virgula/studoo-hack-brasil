import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { normalizarResolucao, resolucaoParaCliente, responderSuaVez } from '../packages/contratos/src/aprendizado.ts';
import {
  acaoDoRodape, aplicarResposta, avancar, comecarResolva, contextoDoPasso, formulaDeContexto, indiceDoSuaVez, noSuaVez,
  resolucaoUtil, respostaValida, tentarDeNovo, visualDoPasso, voltar,
} from '../apps/mobile/src/resolva-comigo-regras.ts';

// "Resolva comigo" no app (spec 15, seção 4): as regras dos passos e do "Sua vez" contra a resolução das fixtures, com o
// servidor simulado pelas funções do contrato (resolucaoParaCliente antes da escolha, responderSuaVez na escolha).

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const guardada = async (nome) => normalizarResolucao(JSON.parse(await ler(`tests/fixtures/matematica/${nome}.json`)).licao.resolucao);
const ate = (estado, alvo) => { let atual = estado; while (atual.atual < alvo) atual = avancar(atual); return atual; };
const escolher = (estado, opcao) => ({ ...estado, escolha: opcao });

test('antes da escolha, o app não tem a resposta do "Sua vez" nem os passos depois dele', async () => {
  for (const nome of ['baricentro', 'abscissas', 'colinearidade']) {
    const cliente = resolucaoParaCliente(await guardada(nome));
    assert.ok(resolucaoUtil(cliente), nome);
    const corte = indiceDoSuaVez(cliente.passos);
    assert.equal(corte, cliente.passos.length - 1, `${nome}: os passos param no "Sua vez"`);
    const json = JSON.stringify(cliente);
    assert.doesNotMatch(json, /correta|porque|\\resposta/, `${nome}: sem correta, porquê nem \\resposta`);
    assert.equal(cliente.passos[corte].formula, undefined); assert.equal(cliente.passos[corte].visual, undefined);
  }
});

test('passos um a um; no "Sua vez", "Verificar" até corrigir; a primeira errada só traz o porquê e pede "Tentar de novo"', async () => {
  const resolucao = await guardada('baricentro');
  const cliente = resolucaoParaCliente(resolucao);
  let estado = comecarResolva(cliente);
  assert.equal(acaoDoRodape(estado), 'proximo');
  assert.equal(voltar(estado).atual, 0, 'no primeiro passo não volta');
  estado = ate(estado, indiceDoSuaVez(cliente.passos));
  assert.ok(noSuaVez(estado)); assert.equal(acaoDoRodape(estado), 'verificar');
  assert.equal(avancar(estado).atual, estado.atual, 'não passa do "Sua vez" sem responder');
  assert.ok(formulaDeContexto(estado), 'a fórmula do passo anterior fica de contexto');
  estado = escolher(estado, 1);
  const errada = responderSuaVez(resolucao, { opcao: 1, tentativa: 1 });
  assert.ok(respostaValida(errada)); assert.equal(errada.depois, undefined, 'a primeira errada não revela');
  estado = aplicarResposta(estado, errada);
  assert.equal(acaoDoRodape(estado), 'tentar'); assert.equal(estado.revelado, false);
  estado = tentarDeNovo(estado);
  assert.equal(estado.tentativa, 2); assert.equal(estado.escolha, null); assert.equal(acaoDoRodape(estado), 'verificar');
  estado = escolher(estado, 0);
  const certa = responderSuaVez(resolucao, { opcao: 0, tentativa: 2 });
  estado = aplicarResposta(estado, certa);
  assert.ok(estado.revelado); assert.equal(estado.passos.length, estado.total, 'os passos que faltavam chegaram');
  assert.ok(estado.passos[indiceDoSuaVez(estado.passos)].formula, 'a revelação do passo');
  assert.equal(acaoDoRodape(estado), 'proximo');
  estado = avancar(estado);
  assert.equal(estado.atual, estado.total - 1); assert.equal(acaoDoRodape(estado), 'agora');
  assert.deepEqual(contextoDoPasso(estado), { tipo: 'passo', ultimo: true }, 'o procurado vira resposta só no último');
  assert.deepEqual(contextoDoPasso(voltar(estado)), { tipo: 'passo', ultimo: false });
});

test('a segunda errada mostra a certa e segue; nunca trava', async () => {
  const resolucao = await guardada('abscissas');
  let estado = ate(comecarResolva(resolucaoParaCliente(resolucao)), indiceDoSuaVez(resolucao.passos));
  estado = aplicarResposta(escolher(estado, 1), responderSuaVez(resolucao, { opcao: 1, tentativa: 1 }));
  estado = tentarDeNovo(estado);
  const segunda = responderSuaVez(resolucao, { opcao: 2, tentativa: 2 });
  assert.equal(segunda.correta, false); assert.equal(segunda.certa, 0); assert.ok(segunda.porqueDaCerta);
  estado = aplicarResposta(escolher(estado, 2), segunda);
  assert.ok(estado.revelado); assert.notEqual(acaoDoRodape(estado), 'tentar');
});

test('o desenho de cima: o do passo mais recente que mexe nele, senão o do problema', async () => {
  const resolucao = await guardada('baricentro');
  const cliente = resolucaoParaCliente(resolucao);
  let estado = comecarResolva(cliente);
  assert.equal(visualDoPasso(cliente, estado), cliente.visual);
  estado = ate(estado, indiceDoSuaVez(cliente.passos));
  estado = aplicarResposta(escolher(estado, 0), responderSuaVez(resolucao, { opcao: 0, tentativa: 1 }));
  estado = ate(estado, estado.total - 1);
  const ultimoComVisual = [...estado.passos].reverse().find((passo) => passo.visual)?.visual ?? cliente.visual;
  assert.equal(visualDoPasso(cliente, estado), ultimoComVisual);
});

test('resposta que não serve não passa (vira o exemplo em texto)', () => {
  assert.equal(respostaValida(null), false);
  assert.equal(respostaValida({ correta: 'sim', porque: 'x' }), false);
  assert.equal(respostaValida({ correta: false, porque: 'x', certa: 7 }), false);
  assert.equal(respostaValida({ correta: true, porque: 'x', depois: {} }), false);
  assert.equal(respostaValida({ correta: true, porque: 'x', depois: { passos: [] } }), true);
});

test('a tela: forma da etapa Exemplo, rodapé preso, POST da escolha e o exemplo em texto sem rede', async () => {
  const licao = await ler('apps/mobile/src/licao.tsx');
  assert.match(licao, /nomeEtapa = resolva\.ativo \? mensagens\.resolvaComigo\.selo/, 'o selo no lugar de "Exemplo", sem etapa nova');
  assert.match(licao, /etapa\.tipo === 'exemplo' && resolva\.ativo\) \{[\s\S]{0,200}rodape = resolva\.rodape;/);
  assert.match(licao, /etapa\.tipo === 'exemplo' && !resolva\.ativo && \(/, 'sem resolução (ou sem rede), o exemplo em texto de sempre');
  const tela = await ler('apps/mobile/src/resolva-comigo.tsx');
  assert.match(tela, /setEstado\(\(atual\) => \(atual \? \{ \.\.\.atual, emTexto: true \} : atual\)\);/, 'sem rede no "Sua vez": exemplo em texto');
  assert.match(tela, /AccessibilityInfo\.announceForAccessibility\(descricao \? `\$\{t\.passo\(estado\.atual \+ 1, estado\.total\)\}\. \$\{descricao\}` : t\.passo\(estado\.atual \+ 1, estado\.total\)\)/);
  assert.match(tela, /accessibilityRole="radiogroup" accessibilityLabel=\{falarTextoComFormulas\(tentativa\.pergunta\)\}/);
  assert.match(tela, /tocarEfeito\(corpo\.correta \? 'acerto' : 'erro'\)/);
  const api = await ler('apps/mobile/src/api-nativa.ts');
  assert.match(api, /\/api\/aprendizado\/licoes\/\$\{encodeURIComponent\(id\)\}\/resolucao/);
  assert.match(api, /JSON\.stringify\(\{ opcao: escolha\.opcao, tentativa: escolha\.tentativa \}\)/);
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  assert.match(estudo, /responderSuaVez=\{\(escolha\) => cliente\.responderSuaVez\(etapa\.licao\.id, escolha\)\}/);
});


test('paridade com a web (auditoria): leitor de tela e texto grande no "Resolva comigo"', async () => {
  const tela = await ler('apps/mobile/src/resolva-comigo.tsx');
  // O passo novo é anunciado uma vez só: sem região viva no indicador (no Android ela repetia o anúncio).
  assert.doesNotMatch(tela, /testID="resolva-indicador" accessibilityLiveRegion/);
  assert.match(tela, /AccessibilityInfo\.announceForAccessibility\(descricao \?/);
  // No iPhone (o VoiceOver não lê região viva), o porquê e o "Isso!" são anunciados depois do "Verificar", como o role="status" da web.
  assert.match(tela, /if \(Platform\.OS === 'ios'\) AccessibilityInfo\.announceForAccessibility\(falaDaCorrecao\(corpo\)\);/);
  assert.match(tela, /testID="resolva-porque" accessibilityLiveRegion="polite"/, 'no Android, a região viva lê');
  // "O método" no fim do exemplo, antes de "Agora é com você" (spec 15, seções 4 e 16), além de "Rever a explicação".
  assert.match(tela, /\{ultimo && <CartaoMetodo passos=\{estado\.passos\}/);
  // A fórmula em bloco cresce com o tamanho de letra do sistema (WCAG 1.4.4), até 2×.
  const desenho = await ler('apps/mobile/src/desenho.tsx');
  assert.match(desenho, /opcoes\.tamanho \* Math\.min\(2, Math\.max\(1, fontScale \|\| 1\)\)/);
});

test('fala da correção do "Sua vez": acerto, primeira errada e segunda errada', async () => {
  const fonte = await ler('apps/mobile/src/resolva-comigo.tsx');
  const corpo = fonte.slice(fonte.indexOf('export function falaDaCorrecao'), fonte.indexOf('function textoDaOpcao'));
  assert.match(corpo, /resposta\.correta \? \[t\.isso, resposta\.porque\]/);
  assert.match(corpo, /resposta\.porqueDaCerta \? \[resposta\.porqueDaCerta\] : \[\]/);
  assert.match(corpo, /falarTextoComFormulas\(parte\)/, 'a fórmula lida pela árvore, nunca o $…$ cru');
});
