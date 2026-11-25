// Fila C (pedido do Lead, 23/11): com a rede lenta, a correção de uma resposta deixava a lição parada em "Verificando…" por uns 30 s, com o X travado. Agora o X (e o voltar) saem durante a
// CORREÇÃO, como no app: o pedido é abandonado, a resposta digitada fica no andamento guardado e é corrigida de novo na volta. Na CONCLUSÃO o X segue travado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ACAO_ABANDONAVEL, criarVezes, podeSairDaLicao } from '../src/app/pedido-em-curso.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const semComentarios = (texto) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('a regra do X: livre sem pedido em andamento e durante a correção; travado na conclusão e nos outros pedidos; o voltar do navegador mantém o passe livre', () => {
  assert.equal(ACAO_ABANDONAVEL, 'avaliar');
  assert.equal(podeSairDaLicao(null), true, 'sem pedido em andamento');
  assert.equal(podeSairDaLicao('avaliar'), true, 'durante a correção da resposta');
  for (const outro of ['concluir', 'abrir', 'plano', 'sair', 'apagar']) assert.equal(podeSairDaLicao(outro), false, `travado durante "${outro}"`);
  for (const qualquer of [null, 'avaliar', 'concluir', 'abrir']) assert.equal(podeSairDaLicao(qualquer, true), true, `o voltar do navegador (${qualquer}) já tinha o passe livre`);
});

test('a vez dos pedidos: um pedido normal começa, é o atual e, ao terminar, solta a trava', () => {
  const vezes = criarVezes();
  assert.equal(vezes.acao(), null);
  const vez = vezes.comecar('avaliar');
  assert.equal(vezes.acao(), 'avaliar');
  assert.equal(vezes.ehAtual(vez), true);
  assert.equal(vezes.terminar(vez), true, 'o pedido era o atual: a trava é dele para soltar');
  assert.equal(vezes.acao(), null);
});

test('abandonar a correção: o pedido deixa de ser o atual, não solta a trava de quem veio depois e o pedido seguinte segue normal', () => {
  const vezes = criarVezes();
  const correcao = vezes.comecar('avaliar');
  assert.equal(vezes.abandonar('avaliar'), true, 'a correção pode ser abandonada');
  assert.equal(vezes.acao(), null, 'a trava já está solta para o pedido seguinte');
  assert.equal(vezes.ehAtual(correcao), false, 'o pedido abandonado já não vale: a falha que chegar depois não vira erro em outra tela');
  // A pessoa abre a trilha (o pedido seguinte) enquanto a correção abandonada ainda está no ar.
  const abrirTrilha = vezes.comecar('plano');
  assert.equal(vezes.ehAtual(abrirTrilha), true);
  assert.equal(vezes.terminar(correcao), false, 'a correção abandonada termina depois e NÃO solta a trava do pedido da trilha');
  assert.equal(vezes.acao(), 'plano', 'o pedido da trilha segue em curso');
  assert.equal(vezes.ehAtual(abrirTrilha), true);
  assert.equal(vezes.terminar(abrirTrilha), true);
  assert.equal(vezes.acao(), null);
});

test('só a correção pode ser abandonada: a conclusão (e qualquer outro pedido) segue, e sem pedido não há o que abandonar', () => {
  const vezes = criarVezes();
  assert.equal(vezes.abandonar('avaliar'), false, 'sem pedido em curso');
  for (const outra of ['concluir', 'plano', 'abrir', 'sair', 'apagar']) {
    const vez = vezes.comecar(outra);
    assert.equal(vezes.abandonar('avaliar'), false, `"${outra}" não pode ser abandonado`);
    assert.equal(vezes.ehAtual(vez), true);
    assert.equal(vezes.terminar(vez), true);
  }
  // Abandonar duas vezes seguidas só vale na primeira.
  const correcao = vezes.comecar('avaliar');
  assert.equal(vezes.abandonar('avaliar'), true);
  assert.equal(vezes.abandonar('avaliar'), false);
  assert.equal(vezes.terminar(correcao), false);
});

test('o estudo: `executar` guarda a vez do pedido, a falha de um pedido abandonado não vira erro nem leva ao login, e só o pedido atual solta a trava', () => {
  const estudo = ler('src/app/estudo.tsx');
  assert.match(estudo, /import \{ ACAO_ABANDONAVEL, criarVezes \} from '\.\/pedido-em-curso';/);
  assert.match(estudo, /const vezes = useRef\(criarVezes<Acao>\(\)\)\.current;/);
  const corpo = semComentarios(estudo.slice(estudo.indexOf('async function executar<T>('), estudo.indexOf('function abandonarCorrecao()')));
  assert.match(corpo, /emExecucao\.current = true;\s*const vez = vezes\.comecar\(acao\);\s*setPendente\(acao\);/);
  // A conferência da vez vem ANTES de mostrar o erro ou de levar ao login.
  assert.ok(corpo.indexOf('if (!vezes.ehAtual(vez)) return { ok: false, codigo };') > 0);
  assert.ok(corpo.indexOf('if (!vezes.ehAtual(vez))') < corpo.indexOf("irParaLogin(true)"), 'a vez é conferida antes do login');
  assert.ok(corpo.indexOf('if (!vezes.ehAtual(vez))') < corpo.indexOf('setErro(codigo)'), 'a vez é conferida antes do erro');
  assert.match(corpo, /finally \{\s*if \(vezes\.terminar\(vez\)\) \{\s*setPendente\(null\);\s*emExecucao\.current = false;\s*\}\s*\}/, 'só o pedido atual solta a trava e o "pendente"');
});

test('o estudo: abandonar a correção solta a trava e o "pendente" na hora, só para a correção, e o voltar da lição abandona antes de abrir a trilha', () => {
  const estudo = ler('src/app/estudo.tsx');
  const abandonar = semComentarios(estudo.slice(estudo.indexOf('function abandonarCorrecao()'), estudo.indexOf('/** Apaga uma trilha depois da confirmação')));
  assert.match(abandonar, /function abandonarCorrecao\(\) \{\s*if \(!vezes\.abandonar\(ACAO_ABANDONAVEL\)\) return false;\s*emExecucao\.current = false;\s*setPendente\(null\);\s*return true;\s*\}/);
  assert.match(estudo, /voltar=\{\(\) => \{ abandonarCorrecao\(\); void abrirPlano\(tela\.plano\.id, tela\.licao\.id\); \}\}/, 'o X da lição abandona a correção (se houver) e abre a trilha');
  // O resto da tela da lição segue como era: a conclusão não ganha esse passe.
  assert.match(estudo, /concluir=\{\(comprovante, resumo, pratica\) => concluir\(tela\.plano, tela\.licao, comprovante, resumo, pratica\)\}/);
  assert.equal((estudo.match(/abandonarCorrecao\(\)/g) ?? []).length, 2, 'a função e a única chamada: nenhuma outra saída ganha o passe');
});

test('a lição: o X e o voltar usam a regra (livres na correção, travados na conclusão), e o resto dos botões segue travado durante qualquer pedido', () => {
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /import \{ podeSairDaLicao \} from '\.\/pedido-em-curso';/);
  assert.match(aula, /<button type="button" className="aula-fechar" aria-label=\{t\.voltar\} disabled=\{!podeSairDaLicao\(pendente\)\} onClick=\{\(\) => sairAgora\.current\(\)\}>/);
  assert.match(aula, /sairAgora\.current = \(peloVoltar = false\) => \{\s*if \(!podeSairDaLicao\(pendente, peloVoltar\)\) return false;\s*voltar\(\);\s*return true;\s*\};/);
  // "Verificar", o campo, as opções e o "Etapa anterior" continuam travados enquanto a correção corre (a pessoa só pode sair).
  assert.match(aula, /<Botao type="submit" form="resposta-licao" disabled=\{ocupado \|\| !respostaCompleta\(exercicio, resposta, iniciais\[indice\]\)\} aria-busy=\{pendente === 'avaliar' \|\| undefined\}>/);
  assert.match(aula, /<button type="button" className="aula-voltar-etapa" disabled=\{ocupado\}/);
  // A resposta digitada já fica no andamento guardado a cada tecla (passo > 0), que é o que a volta usa para corrigir de novo.
  assert.match(aula, /if \(passo === 0 && tentativas === 0\) return;[\s\S]*?guardarAndamento\(licao\.id, \{\s*passo, versaoEtapas: VERSAO_ETAPAS_AULA, respostas, avaliacoes,/);
  // A resposta de uma correção abandonada, se chegar depois, não mexe na lição que saiu: o envio é abortado quando ela desmonta.
  assert.match(aula, /useEffect\(\(\) => \(\) => \{\s*envioAtual\.current\?\.abort\(\);\s*envioAtual\.current = null;\s*\}, \[passo, licao\.id\]\);/);
  assert.match(aula, /if \(!resultado \|\| envio\.signal\.aborted\) return;/);
});
