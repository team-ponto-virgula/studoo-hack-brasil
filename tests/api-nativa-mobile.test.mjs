import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { criarClienteOnboarding } from '../packages/contratos/src/onboarding.ts';
import { criarClienteStudoo, ErroStudoo } from '../packages/contratos/src/aprendizado.ts';
import { codigoDaResposta, lerEventos } from '../apps/mobile/src/geracao-ao-vivo.ts';

// O cliente do app (apps/mobile/src/api-nativa.ts): /api/auth/config é pública e recusa pedido com Authorization (rotaPublica
// responde 401). Com sessão, o app mandava o token também nela, e a configuração nunca chegava (o compartilhar não aparecia
// e o aviso do material ficava sem o provedor). Sem React Native e sem rede: o módulo roda transpilado, com dublês.

const fonte = await readFile(new URL('../apps/mobile/src/api-nativa.ts', import.meta.url), 'utf8');
const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function montar({ semRede = false, responder } = {}) {
  const pedidos = [];
  const sons = [];
  const prazos = [];
  const fetch = async (url, opcoes) => {
    const pedido = { url, metodo: opcoes.method, headers: opcoes.headers, corpo: opcoes.body && JSON.parse(opcoes.body), credenciais: opcoes.credentials };
    pedidos.push(pedido);
    if (semRede) throw new TypeError('Network request failed');
    return responder ? responder(pedido) : Response.json({ ok: true });
  };
  const exports = {};
  runInNewContext(codigo, {
    exports,
    process: { env: { EXPO_PUBLIC_STUDOO_API_URL: 'https://studoo.example.test/' } },
    AbortController, clearTimeout, URL, JSON, Promise,
    setTimeout(f, ms) { prazos.push(ms); return setTimeout(f, ms); },
    require: (nome) => {
      const modulos = {
        '@studoo/contratos': { criarClienteStudoo, ErroStudoo },
        '@studoo/contratos/onboarding': { criarClienteOnboarding },
        'expo/fetch': { fetch },
        'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
        './geracao-ao-vivo': { codigoDaResposta, lerEventos },
        // O toca-sons: só conta os efeitos (o erro de rede, numa ação sem rede).
        './sons': { tocaSons: { tocarEfeito: async (id) => { sons.push(id); } } },
      };
      assert.ok(nome in modulos, `módulo sem dublê: ${nome}`);
      return modulos[nome];
    },
  });
  return { ...exports, pedidos, sons, prazos };
}

test('com sessão, a configuração vai sem o token e os outros pedidos vão com ele', async () => {
  const api = montar();
  const cliente = api.criarClienteNativo('a'.repeat(43));
  await cliente.configuracaoAcesso();
  await cliente.listarPlanos();
  const [config, planos] = api.pedidos;
  assert.equal(config.url, 'https://studoo.example.test/api/auth/config');
  assert.equal(config.headers.Authorization, undefined, 'a rota pública recusa Authorization (401)');
  assert.equal(planos.url, 'https://studoo.example.test/api/aprendizado/planos');
  assert.equal(planos.headers.Authorization, `Bearer ${'a'.repeat(43)}`);
  assert.deepEqual(api.prazos, [15_000, 15_000], 'as leituras comuns preservam o prazo');
});

test('sem sessão, nada muda: a configuração vai sem token, como na entrada', async () => {
  const api = montar();
  await api.criarClienteNativo().configuracaoAcesso();
  assert.equal(api.pedidos[0].headers.Authorization, undefined);
});

test('a foto do perfil vai pelo canal do app, com o token e sem cookie', async () => {
  const api = montar();
  await api.criarClienteNativo('b'.repeat(43)).enviarFoto('QUJD');
  const [foto] = api.pedidos;
  assert.equal(foto.metodo, 'PUT');
  assert.equal(foto.url, 'https://studoo.example.test/api/perfil/foto');
  assert.equal(foto.headers.Authorization, `Bearer ${'b'.repeat(43)}`);
  assert.equal(foto.headers.Cookie, undefined);
});

test('onboarding usa o contrato real: leitura e meta seguem pelo canal Bearer, sem cookie', async () => {
  const api = montar();
  const cliente = api.criarClienteNativo('c'.repeat(43));
  await cliente.obterOnboarding();
  const acao = { acao: 'definir-meta', metaLicoesDia: 2, fuso: 'America/Sao_Paulo' };
  await cliente.atualizarOnboarding(acao);
  const [leitura, escrita] = api.pedidos;
  assert.equal(leitura.metodo, 'GET');
  assert.equal(leitura.corpo, undefined);
  assert.equal(escrita.metodo, 'POST');
  assert.equal(escrita.headers['Content-Type'], 'application/json');
  assert.deepEqual(escrita.corpo, acao);
  for (const pedido of api.pedidos) {
    assert.equal(pedido.url, 'https://studoo.example.test/api/onboarding');
    assert.equal(pedido.headers.Authorization, `Bearer ${'c'.repeat(43)}`);
    assert.equal(pedido.headers.Cookie, undefined);
    assert.equal(pedido.credenciais, 'omit');
  }
});

test('sem rede: numa ação da pessoa (pedido que não é GET) toca o erro de rede; nas leituras, nada (spec 12, como a web)', async () => {
  const api = montar({ semRede: true });
  const cliente = api.criarClienteNativo('a'.repeat(43));
  await assert.rejects(() => cliente.listarPlanos());
  assert.deepEqual(api.sons, [], 'a leitura falha calada');
  await assert.rejects(() => cliente.enviarFoto('AAAA'));
  assert.deepEqual(api.sons, ['erro_rede']);
});

test('a API antiga sem rota de diagnóstico devolve 404 em HTML e o app reconhece a ausência da rota', async () => {
  const api = montar({ responder: () => new Response('<h1>404</h1>', { status: 404 }) });
  const cliente = api.criarClienteNativo('sessao-sintetica');
  await assert.rejects(cliente.iniciarDiagnostico('Aprender história'), { codigo: 'nao_encontrado' });
  await assert.rejects(cliente.gerarProposta('Aprender história'), { codigo: 'falha' });
});

test('diagnóstico, propostas antigas, material e aceite mantêm separados recusa, indisponibilidade e consentimento', async () => {
  const objetivo = 'Tema sintético recusado';
  const casos = [['conteudo_nocivo', 422], ['ia_indisponivel', 503], ['consentimento_ia', 428]];
  for (const [codigo, status] of casos) {
    const api = montar({ responder: () => Response.json({ codigo }, { status }) });
    const cliente = api.criarClienteNativo('sessao-sintetica');
    for (const acao of [() => cliente.iniciarDiagnostico(objetivo), () => cliente.responderDiagnostico('diagnostico', 'pergunta', 'opcao'),
      () => cliente.gerarProposta(objetivo), () => cliente.enviarMaterial({ nome: 'qa.txt', tipo: 'text/plain', base64: 'UUE=' }),
      () => cliente.proporMaterial('material', objetivo), () => cliente.aceitarProposta('token-sintetico')]) {
      await assert.rejects(acao, { codigo });
    }
    assert.deepEqual(api.prazos, [85_000, 85_000, 120_000, 120_000, 150_000, 300_000]);
  }
});

test('a geração recebe recusa e falha temporária em HTTP e no NDJSON, com o mesmo tema e diagnóstico', async () => {
  const objetivo = 'Tema sintético';
  const consumir = async (cliente) => {
    const eventos = [];
    for await (const evento of cliente.gerarTrilhaAoVivo(objetivo, new AbortController().signal, 'diagnostico')) eventos.push(evento);
    return eventos;
  };
  for (const [codigo, status] of [['conteudo_nocivo', 422], ['ia_indisponivel', 503]]) {
    const api = montar({ responder: () => Response.json({ codigo }, { status }) });
    await assert.rejects(consumir(api.criarClienteNativo()), { codigo });
    const evento = { tipo: 'erro', codigo };
    const fluxo = montar({ responder: () => new Response(`\n${JSON.stringify(evento)}\n`, { headers: { 'Content-Type': 'application/x-ndjson' } }) });
    assert.deepEqual(await consumir(fluxo.criarClienteNativo()), [evento], 'a linha vazia da espera é ignorada');
    assert.deepEqual(fluxo.pedidos.map(p => p.corpo), [{ objetivo, diagnosticoId: 'diagnostico' }]);
    assert.deepEqual(fluxo.prazos, [15_000], 'o prazo só vale para abrir o fluxo');
  }
  const corpo = { codigo: 'consentimento_ia', privacidade: { politica: '/privacidade' } };
  const semAceite = montar({ responder: () => Response.json(corpo, { status: 428 }) });
  await assert.rejects(consumir(semAceite.criarClienteNativo()), { codigo: corpo.codigo, corpo });
});
