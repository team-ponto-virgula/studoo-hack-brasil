import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [registros] = process.argv.slice(2);
if (!registros) throw new Error('Informe a pasta de registros da prova.');
const arquivo = nome => readFileSync(join(registros, nome), 'utf8');
const aposFechar = Number(arquivo('retomada-processo-fechado.txt').trim());
const proxy = arquivo('proxy.log');
const eventos = proxy.split('\n').filter(linha => linha.startsWith('[retomada] '))
  .map(linha => JSON.parse(linha.slice('[retomada] '.length)));
const ia = arquivo('ia-retomada.log').trim().split('\n').map(linha => JSON.parse(linha));
const depois = JSON.parse(arquivo('retomada-depois.json'));

assert.ok(Number.isSafeInteger(aposFechar) && aposFechar > 0);
assert.equal(eventos.filter(e => e.etapa === 'post').length, 1, 'um único POST do aparelho');
const corte = eventos.find(e => e.etapa === 'corte-aceite');
const resposta = eventos.find(e => e.etapa === 'post-servidor');
assert.ok(corte?.em < aposFechar, 'o proxy cortou o socket do cliente antes de fechar o app');
assert.equal(resposta?.cortado, true, 'o mesmo POST terminou no servidor');
assert.equal(resposta.status, 200);
assert.ok(resposta.em > aposFechar, 'o servidor salvou depois de o processo do app fechar');

const consultas = eventos.filter(e => e.etapa === 'consulta');
assert.ok(consultas.some(e => e.cortada && e.status === 200 && e.em < aposFechar),
  'houve uma consulta que chegou à API com rede ativa e cuja resposta não voltou ao app');
assert.ok(consultas.some(e => !e.cortada && e.estado === 'em_preparo' && e.em >= aposFechar),
  'o processo relançado recuperou o preparo');
const prontas = consultas.filter(e => !e.cortada && e.estado === 'pronto' && e.em >= aposFechar);
assert.ok(prontas.length > 0, 'o processo relançado consultou o plano salvo');
const pronto = prontas.at(-1);
assert.equal(pronto.tentativas, 1);
assert.equal(pronto.total, 10);
assert.equal(pronto.partes, 3);
assert.equal(new Set(consultas.map(e => e.pedidoId)).size, 1, 'a consulta conservou o mesmo pedido');
assert.ok(pronto.primeiraLicao && proxy.includes(`GET /api/aprendizado/licoes/${pronto.primeiraLicao} 200 `),
  'o app recebeu a primeira lição pelo caminho regular');
const lotes = arquivo('servidor-retomada.log').split('\n').filter(linha => linha.startsWith('{"rota":"criacao-trilha",'))
  .map(linha => JSON.parse(linha)).filter(e => e.pedido === pronto.pedidoId.slice(0, 8));
assert.equal(lotes.filter(e => e.evento === 'lote').length, 1, 'o servidor registrou um lote para o pedido');
assert.ok(lotes.some(e => e.evento === 'resultado' && e.resultado === 'pronto' && e.tentativa === 1));

assert.equal(ia.filter(e => e.etapa === 'falha').length, 0);
assert.equal(ia.filter(e => e.etapa === 'proposta').length, 1);
assert.equal(ia.filter(e => e.etapa === 'triagem-aceite').length, 1);
assert.equal(ia.filter(e => e.etapa === 'triagem-licoes').length, 1);
assert.deepEqual(ia.filter(e => e.etapa === 'licao').map(e => e.numero).sort((a, b) => a - b),
  Array.from({ length: 10 }, (_, posicao) => posicao + 1), 'uma única chamada de geração por lição apesar das consultas');
assert.equal(depois.caso, 'apagada', 'a conta tinha uma única trilha nova e somente ela foi removida ao final da prova');
assert.equal(depois.novas.length, 1);
assert.equal(depois.novas[0].id, pronto.pedidoId);
assert.equal(depois.novas[0].titulo, 'Observar o céu noturno');

const veredito = {
  proposta: { licoes: pronto.total, partes: pronto.partes },
  lotes: pronto.tentativas, escritasDeLicao: 10, postsDoAparelho: 1, trilhasNovas: depois.novas.length,
  consultas: consultas.length, consultasComRespostaCortada: consultas.filter(e => e.cortada).length,
  primeiraLicaoAberta: true, apiLocal: true, iaDeTesteLocal: true,
};
writeFileSync(join(registros, 'retomada-veredito.json'), JSON.stringify(veredito, null, 2) + '\n');
console.log('Retomada verificada: uma trilha, um lote, dez escritas de lição, consultas sem nova geração e lição 1 aberta.');
