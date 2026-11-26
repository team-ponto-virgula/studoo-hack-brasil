import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as contratos from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';
import { apresentarRetomada } from '../apps/mobile/src/estado-da-retomada.ts';

const t = mensagens.geracao;
const pedidoId = 'c4a2be78-c628-4961-8071-57a84afb69a6';
const agora = 20_000;
const pedido = { versao: 1, pedidoId, token: 'comprovante.sintetico', intencao: 'comecar', titulo: 'O céu', licoes: 10, partes: 3, enviadoEm: agora };
const item = (estado, depois = {}) => ({ pedido: { ...pedido, ...depois }, estado: estado ? { pedidoId, ...estado } : null, semRespostaSeguidas: 1 });

test('a perda de resposta sem evidência de offline mantém consulta neutra e nunca oferece reenviar', () => {
  for (const motivo of ['rede', 'servidor']) {
    const vista = apresentarRetomada(item({ estado: 'desconhecido', motivo }), agora + 90_000);
    assert.equal(vista.texto, t.semConfirmacao);
    assert.equal(vista.acao.tipo, 'consultar');
    assert.equal(vista.consultarEmMs, 2000);
  }
  const ausente = { estado: 'nao_recebido' };
  assert.equal(apresentarRetomada(item(ausente), agora + 20).acao.tipo, 'consultar');
  assert.equal(apresentarRetomada(item(ausente), agora + 20_000).acao.tipo, 'reenviar');
  assert.equal(apresentarRetomada(item(ausente, { propostaExpiraEm: agora + 20_000 }), agora + 20_000).acao.tipo, 'remontar');
});

test('limite conhecido conserva a proposta e consulta de novo antes de liberar a mesma tentativa', () => {
  const limite = { estado: 'falha', causa: 'limite', codigo: 'limite_geracoes', tentativas: 1, repetivel: false };
  const vista = apresentarRetomada(item({ ...limite, aguardarSegundos: 32 }), agora);
  assert.equal(vista.texto, t.falhaDaCriacao.limiteComEspera(32));
  assert.equal(vista.consultarEmMs, 32_000);
  assert.equal(vista.acao.tipo, 'consultar');
  assert.deepEqual(apresentarRetomada(item(limite), agora), { texto: t.falhaDaCriacao.limite, acao: { tipo: 'consultar' } });
  assert.equal(apresentarRetomada(item({ ...limite, repetivel: true }), agora + 32_000).acao.tipo, 'tentar');
});

test('preparo e gravação preservam a intenção de salvar e a confirmação vem com o plano', () => {
  const durante = { estado: 'em_preparo', tentativas: 1, consultarEmMs: 3000, decorridoMs: 12_000, limiteMs: 240_000, etapa: 'licoes' };
  assert.equal(apresentarRetomada(item(durante), agora).texto, t.preparandoTrilha);
  assert.equal(apresentarRetomada(item(durante, { intencao: 'salvar' }), agora).texto, t.salvandoSuaTrilha);
  const plano = { id: pedidoId };
  const pronto = { estado: 'pronto', tentativas: 1, plano };
  assert.deepEqual(apresentarRetomada(item(pronto), agora), { texto: t.trilhaPronta, acao: { tipo: 'abrir', plano } });
  assert.equal(apresentarRetomada(item(pronto, { intencao: 'salvar' }), agora).texto, t.trilhaSalvaPronta);
  const aceites = readFileSync(new URL('../apps/mobile/src/estudo.tsx', import.meta.url), 'utf8');
  assert.match(aceites, /async function abrirCriacaoRecuperada[\s\S]*?if \(pedido\.intencao === 'salvar'\) \{[^}]*guardarRetornoDaTrilha\(plano.id\);/);
});

test('recusa orienta edição, e expiração confirmada orienta remontagem sem enviar', () => {
  const falha = { estado: 'falha', codigo: 'conteudo_nocivo', tentativas: 1, repetivel: false };
  assert.equal(apresentarRetomada(item({ ...falha, causa: 'seguranca' }), agora).acao.tipo, 'editar');
  assert.equal(apresentarRetomada(item({ ...falha, causa: 'proposta_expirada' }), agora).acao.tipo, 'remontar');
  assert.equal(apresentarRetomada(item({ ...falha, causa: 'interrompida', repetivel: true }), agora).acao.tipo, 'tentar');
});

test('escrita nativa é exclusiva, restaura o mesmo comprovante e isola troca ou saída de conta', async () => {
  const dados = new Map();
  const modulos = {
    '@studoo/contratos': contratos,
    'expo-secure-store': {
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6,
      async getItemAsync(chave) { return dados.get(chave) ?? null; },
      async setItemAsync(chave, valor) { dados.set(chave, valor); },
      async deleteItemAsync(chave) { dados.delete(chave); },
    },
    './api-nativa': {
      FalhaMobile: Error, origemConfigurada: () => new URL('https://127.0.0.1:3443'),
    },
  };
  const fonte = readFileSync(new URL('../apps/mobile/src/criacoes-no-aparelho.ts', import.meta.url), 'utf8');
  const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(codigo, {
    exports, Promise,
    require(nome) { assert.ok(nome in modulos); return modulos[nome]; },
  });
  const { abrirCriacoesNoAparelho, guardarCriacaoNoAparelho, esquecerCriacaoNoAparelho, apagarCriacoesNoAparelho } = exports;
  assert.deepEqual(await abrirCriacoesNoAparelho('A'), []);
  const guardas = await Promise.all([guardarCriacaoNoAparelho('A', pedido), guardarCriacaoNoAparelho('A', pedido)]);
  assert.deepEqual(guardas.map(guarda => guarda.enviar), [true, false]);
  assert.deepEqual(await abrirCriacoesNoAparelho('A'), [pedido]);
  const tentativa = { ...pedido, enviadoEm: agora + 32_000 };
  const reenvio = await guardarCriacaoNoAparelho('A', tentativa, true);
  assert.equal(reenvio.enviar, true);
  assert.deepEqual(reenvio.pedido, tentativa);
  assert.deepEqual(await abrirCriacoesNoAparelho('A'), [tentativa]);
  assert.deepEqual(await abrirCriacoesNoAparelho('B'), []);
  await assert.rejects(guardarCriacaoNoAparelho('A', pedido), /armazenamento/);
  assert.deepEqual(await abrirCriacoesNoAparelho('A'), []);
  await guardarCriacaoNoAparelho('A', pedido);
  await esquecerCriacaoNoAparelho('A', pedidoId);
  assert.deepEqual(await abrirCriacoesNoAparelho('A'), []);
  await guardarCriacaoNoAparelho('A', pedido);
  await apagarCriacoesNoAparelho();
  assert.deepEqual(await abrirCriacoesNoAparelho('A'), []);
});

test('o POST aguarda o registro durável e uma montagem não reenvia por conta própria', () => {
  const fonte = readFileSync(new URL('../apps/mobile/src/estudo.tsx', import.meta.url), 'utf8');
  const guarda = fonte.indexOf('await criacoes.guardar(pedido, reenvio)');
  const naoEnvia = fonte.indexOf('if (!enviar)', guarda);
  const post = fonte.indexOf('await aceitarUmaVez(proposta.token)', guarda);
  assert.ok(guarda > 0 && guarda < naoEnvia && naoEnvia < post);
  const cartao = readFileSync(new URL('../apps/mobile/src/acompanhar-criacao.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(cartao, /cliente\.aceitarProposta|await reenviar/);
  assert.match(cartao, /AppState\.addEventListener\('change'/);
});
