import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ErroStudoo, criarClienteStudoo } from '../packages/contratos/src/aprendizado.ts';
import * as privacidade from '../packages/contratos/src/privacidade.ts';

const { CONFIRMACAO_EXCLUSAO, VERSAO_CONSENTIMENTO_IA, provedoresDaIa } = privacidade;

// Privacidade no app (Apple 5.1.1(v) e 5.1.2(i)): a trava do consentimento de IA no cliente do app
// (apps/mobile/src/consentimento-ia.tsx), o contrato das rotas de privacidade e onde as telas entram. Sem React Native e
// sem rede: o módulo roda transpilado, com dublês.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const fonte = await ler('apps/mobile/src/consentimento-ia.tsx');
const codigo = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function carregar() {
  const exports = {};
  const vazio = () => null;
  runInNewContext(codigo, {
    exports, Promise, Error, Object, Boolean, Math, URL,
    require: (nome) => {
      const modulos = {
        '@studoo/contratos': { ErroStudoo },
        '@studoo/contratos/privacidade': privacidade,
        react: { createContext: () => ({}), useCallback: (f) => f, useContext: vazio, useEffect: vazio, useMemo: (f) => f(), useRef: (v) => ({ current: v }), useState: (v) => [v, vazio] },
        'react/jsx-runtime': { jsx: vazio, jsxs: vazio, Fragment: 'f' },
        'react-native': { StyleSheet: { create: (s) => s }, Text: 'Text', View: 'View', ScrollView: 'ScrollView', useWindowDimensions: () => ({ width: 390, height: 844 }) },
        './api-nativa': { origemConfigurada: () => new URL('https://studoo.example.test/') },
        './interface': { CartaoConfirmacao: 'CartaoConfirmacao' },
        './mensagens': { mensagens: { privacidade: {} }, mensagemDeErro: String },
        './social': { abrirNoNavegador: vazio },
        './tema': { cores: {}, fontes: {} },
      };
      assert.ok(nome in modulos, `módulo sem dublê: ${nome}`);
      return modulos[nome];
    },
  });
  return exports;
}

const { comConsentimento, recusaDeConsentimento, permissaoVigente } = carregar();

/** As que o servidor recusa com 428 sem aceite (0b05acf): as que mandam dado a IA de terceiro sem alternativa local. */
const ACOES_IA = ['iniciarDiagnostico', 'responderDiagnostico', 'gerarProposta', 'aceitarProposta', 'enviarMaterial', 'proporMaterial', 'transcrever', 'iniciarVozAoVivo'];
/** Com retorno local no servidor sem aceite: a jornada segue, sem cartão. */
const ACOES_COM_RETORNO_LOCAL = ['avaliarLicao', 'criarPonte', 'avaliarPonte', 'ensinarStu'];

/** Um cliente de mentira que registra as chamadas; `falhas[nome]` faz a próxima chamada falhar com aquele código. */
function clienteDuble() {
  const chamadas = [];
  const falhas = {};
  const cliente = {};
  for (const nome of [...ACOES_IA, ...ACOES_COM_RETORNO_LOCAL, 'listarPlanos', 'apoioLicao', 'materialDemo']) {
    cliente[nome] = async (...args) => {
      chamadas.push(nome);
      if (falhas[nome]) { const codigo = falhas[nome]; delete falhas[nome]; throw new ErroStudoo(codigo); }
      return { nome, args };
    };
  }
  cliente.gerarTrilhaAoVivo = async function* (objetivo) {
    chamadas.push('gerarTrilhaAoVivo');
    if (falhas.gerarTrilhaAoVivo) { const codigo = falhas.gerarTrilhaAoVivo; delete falhas.gerarTrilhaAoVivo; throw new ErroStudoo(codigo); }
    yield { tipo: 'plano', titulo: objetivo, objetivo };
  };
  return { cliente, chamadas, falhas };
}

function trava({ aceita }) {
  const perguntas = [];
  let invalidacoes = 0;
  let permitido = false;
  return {
    perguntas,
    invalidacoes: () => invalidacoes,
    garantir: async () => {
      if (permitido) return;
      perguntas.push('cartao');
      if (!aceita) throw new ErroStudoo('consentimento_ia');
      permitido = true;
    },
    invalidar: () => { invalidacoes += 1; permitido = false; },
  };
}

test('sem permissão, "Agora não" barra o envio: nenhuma ação de IA chega ao servidor', async () => {
  for (const nome of ACOES_IA) {
    const { cliente, chamadas } = clienteDuble();
    const t = trava({ aceita: false });
    const seguro = comConsentimento(cliente, t.garantir, t.invalidar);
    await assert.rejects(seguro[nome]('x'), (erro) => recusaDeConsentimento(erro), nome);
    assert.deepEqual(chamadas, [], `${nome} não pode sair sem permissão`);
    assert.equal(t.perguntas.length, 1);
  }
});

test('diagnóstico: recusar duas vezes preserva a tentativa, e permitir envia a primeira pergunta ou a opção original uma vez', async () => {
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  const inicio = estudo.indexOf('async function pedirPassoDiagnostico(');
  const fim = estudo.indexOf('function iniciarPedido(', inicio);
  assert.ok(inicio >= 0 && fim > inicio);
  const consultar = ts.transpileModule(estudo.slice(inicio, fim), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const pergunta = { tipo: 'pergunta', id: 'diagnostico', numero: 1, pergunta: { id: 'pergunta' } };
  for (const passo of [null, pergunta]) {
    const atual = { current: { objetivo: 'Frações', anteriores: [], revisando: null, passo } };
    const opcaoId = passo ? 'opcao-b' : undefined;
    let permissao = false;
    let cartoes = 0;
    const chamadas = [];
    const enviar = async (...args) => { chamadas.push(args); return { tipo: 'resultado' }; };
    const cliente = comConsentimento({ iniciarDiagnostico: enviar, responderDiagnostico: enviar }, async () => {
      cartoes++;
      if (!permissao) throw new ErroStudoo('consentimento_ia');
    }, assert.fail);
    const pedir = runInNewContext(consultar + '\npedirPassoDiagnostico', {
      cliente, diagnosticoAtual: atual, diagnosticoVisivel: { current: true }, passoVisivel: s => s.passo,
      salvarDiagnostico: s => { atual.current = s; }, passoValido: () => true,
      codigoDaFalha: e => e.codigo, sessaoInvalida: () => false, navegar: () => assert.fail('saiu do diagnóstico'),
    });
    await pedir(atual.current, opcaoId);
    assert.equal(atual.current.erro.codigo, 'consentimento_ia');
    await pedir(atual.current, atual.current.erro.opcaoId);
    assert.equal(atual.current.erro.codigo, 'consentimento_ia');
    assert.equal(atual.current.erro.opcaoId, opcaoId);
    assert.equal(atual.current.passo, passo);
    assert.deepEqual(chamadas, []);
    permissao = true;
    await pedir(atual.current, atual.current.erro.opcaoId);
    assert.equal(cartoes, 3);
    assert.equal(atual.current.erro, null);
    assert.equal(atual.current.passo.tipo, 'resultado');
    assert.deepEqual(chamadas, [passo ? ['diagnostico', 'pergunta', opcaoId] : ['Frações']]);
  }
  const tela = await ler('apps/mobile/src/diagnostico.tsx');
  assert.match(tela, /erro === 'consentimento_ia' \? mensagens\.privacidade\.permitirAgora : mensagens\.tentarNovamente/);
  assert.match(tela, /erro === 'consentimento_ia' \|\| erro === 'ia_indisponivel' \? mensagemDoCodigo\(erro\) : 'Não foi possível carregar a pergunta\./);
  assert.match(tela, /acao=\{erro \? repetir : \(\) => consultar\(\)\}/);
  assert.match(estudo, /repetir=\{\(\) => \{[^}]+pedirPassoDiagnostico\(atual, atual\.erro\.opcaoId\)/);
});

test('permitida uma vez, as ações seguem direto, sem perguntar de novo', async () => {
  const { cliente, chamadas } = clienteDuble();
  const t = trava({ aceita: true });
  const seguro = comConsentimento(cliente, t.garantir, t.invalidar);
  await seguro.gerarProposta('Aprender violão');
  await seguro.transcrever({ base64: 'x' });
  assert.deepEqual(chamadas, ['gerarProposta', 'transcrever']);
  assert.equal(t.perguntas.length, 1);
});

test('correção, reforço, Explique, leituras e a demonstração não passam pela trava (sem aceite, o servidor responde local)', async () => {
  const { cliente, chamadas } = clienteDuble();
  const t = trava({ aceita: false });
  const seguro = comConsentimento(cliente, t.garantir, t.invalidar);
  for (const nome of ACOES_COM_RETORNO_LOCAL) await seguro[nome]('l1', 'resposta', 0);
  await seguro.listarPlanos();
  await seguro.apoioLicao('l1');
  await seguro.materialDemo();
  assert.deepEqual(chamadas, [...ACOES_COM_RETORNO_LOCAL, 'listarPlanos', 'apoioLicao', 'materialDemo']);
  assert.equal(t.perguntas.length, 0);
});

test('recusa do servidor (desligada em outro aparelho): invalida, pergunta de novo e repete uma vez', async () => {
  const { cliente, chamadas, falhas } = clienteDuble();
  const t = trava({ aceita: true });
  const seguro = comConsentimento(cliente, t.garantir, t.invalidar);
  await seguro.proporMaterial('m1');
  falhas.proporMaterial = 'consentimento_ia';
  const resposta = await seguro.proporMaterial('m1');
  assert.equal(resposta.nome, 'proporMaterial');
  assert.deepEqual(chamadas, ['proporMaterial', 'proporMaterial', 'proporMaterial']);
  assert.equal(t.invalidacoes(), 1);
  assert.equal(t.perguntas.length, 2);
});

test('outras falhas passam como estão, sem pedir permissão de novo', async () => {
  const { cliente, falhas } = clienteDuble();
  const t = trava({ aceita: true });
  const seguro = comConsentimento(cliente, t.garantir, t.invalidar);
  falhas.enviarMaterial = 'material_invalido';
  await assert.rejects(seguro.enviarMaterial({}), (erro) => erro.codigo === 'material_invalido');
  assert.equal(t.invalidacoes(), 0);
});

test('recusa de conteúdo ou erro temporário nunca reabre o consentimento nem reenvia o pedido', async () => {
  for (const codigo of ['conteudo_nocivo', 'ia_indisponivel']) {
    const { cliente, chamadas, falhas } = clienteDuble();
    const travaIa = trava({ aceita: true });
    const seguro = comConsentimento(cliente, travaIa.garantir, travaIa.invalidar);
    falhas.responderDiagnostico = codigo;
    await assert.rejects(seguro.responderDiagnostico('d', 'p', 'o'), { codigo });
    assert.deepEqual(chamadas, ['responderDiagnostico']);
    assert.equal(travaIa.invalidacoes(), 0);
  }
});

test('geração ao vivo: pergunta antes de abrir o pedido e repete uma vez se o servidor recusar', async () => {
  const recusada = clienteDuble();
  const semPermissao = comConsentimento(recusada.cliente, trava({ aceita: false }).garantir, () => {});
  await assert.rejects(async () => { for await (const _ of semPermissao.gerarTrilhaAoVivo('Física', new AbortController().signal)) { /* nada */ } },
    (erro) => recusaDeConsentimento(erro));
  assert.deepEqual(recusada.chamadas, []);

  const { cliente, chamadas, falhas } = clienteDuble();
  const t = trava({ aceita: true });
  const seguro = comConsentimento(cliente, t.garantir, t.invalidar);
  falhas.gerarTrilhaAoVivo = 'consentimento_ia';
  const eventos = [];
  for await (const evento of seguro.gerarTrilhaAoVivo('Física', new AbortController().signal)) eventos.push(evento);
  assert.deepEqual(eventos, [{ tipo: 'plano', titulo: 'Física', objetivo: 'Física' }]);
  assert.deepEqual(chamadas, ['gerarTrilhaAoVivo', 'gerarTrilhaAoVivo']);
  assert.equal(t.invalidacoes(), 1);
});

const estadoServidor = (aceitoEm = null, ia = 'openai') => ({
  consentimentoIa: { necessario: ia !== 'falsa', versao: VERSAO_CONSENTIMENTO_IA, aceitoEm, provedores: provedoresDaIa(ia, true) },
  politica: '/privacidade',
});

test('contrato do Web & API: rotas de privacidade, revogação e exclusão com a confirmação; 428 traz o estado', async () => {
  const pedidos = [];
  const cliente = criarClienteStudoo(async (caminho, opcoes) => {
    pedidos.push({ caminho, metodo: opcoes.method, corpo: opcoes.body ? JSON.parse(opcoes.body) : undefined });
    if (caminho === '/api/conta') return { status: 204, ok: true, json: async () => null };
    return { status: 200, ok: true, json: async () => estadoServidor() };
  });
  await cliente.privacidade();
  await cliente.aceitarIa(VERSAO_CONSENTIMENTO_IA);
  await cliente.revogarIa();
  assert.equal(await cliente.excluirConta(), null);
  assert.deepEqual(pedidos, [
    { caminho: '/api/privacidade', metodo: 'GET', corpo: undefined },
    { caminho: '/api/privacidade/consentimento-ia', metodo: 'POST', corpo: { versao: VERSAO_CONSENTIMENTO_IA } },
    { caminho: '/api/privacidade/consentimento-ia', metodo: 'DELETE', corpo: undefined },
    { caminho: '/api/conta', metodo: 'DELETE', corpo: { confirmacao: CONFIRMACAO_EXCLUSAO } },
  ]);
  const recusa = criarClienteStudoo(async () => ({ status: 428, ok: false, json: async () => ({ codigo: 'consentimento_ia', privacidade: estadoServidor() }) }));
  await assert.rejects(recusa.gerarProposta('x'), (erro) => recusaDeConsentimento(erro) && privacidade.privacidadeDoErro(erro)?.consentimentoIa.necessario === true);
});

test('a recusa do servidor traz o estado: a trava guarda o que veio, sem outra ida ao servidor', async () => {
  const { cliente } = clienteDuble();
  const recebidos = [];
  cliente.transcrever = async () => {
    if (!recebidos.length) throw new ErroStudoo('consentimento_ia', { codigo: 'consentimento_ia', privacidade: estadoServidor() });
    return 'ok';
  };
  const travado = comConsentimento(cliente, async () => {}, (falha) => { recebidos.push(privacidade.privacidadeDoErro(falha)); });
  assert.equal(await travado.transcrever({ base64: 'x' }), 'ok');
  assert.equal(recebidos.length, 1);
  assert.deepEqual(recebidos[0].consentimentoIa.provedores.map((p) => p.id), ['openai']);
});

test('a permissão vale com o aceite da versão vigente, ou sempre com a IA simulada', () => {
  assert.equal(permissaoVigente(null), false);
  assert.equal(permissaoVigente(estadoServidor(null)), false);
  assert.equal(permissaoVigente(estadoServidor('2026-11-20T12:00:00.000Z')), true);
  assert.equal(permissaoVigente(estadoServidor(null, 'falsa')), true, 'IA=falsa: nada sai do servidor, nada é pedido');
});

test('exclusão: só com a palavra digitada, e os textos dizem o que some e quem recebe', async () => {
  assert.equal(privacidade.confirmacaoExclusaoValida(' excluir '), true);
  assert.equal(privacidade.confirmacaoExclusaoValida('EXCLUI'), false);
  const tela = await ler('apps/mobile/src/privacidade.tsx');
  assert.match(tela, /const valido = confirmacaoExclusaoValida\(digitado\)/);
  assert.match(tela, /confirmarDesativado=\{!valido\}/);
  assert.match(tela, /testID="excluir-conta-campo"/);
  assert.match(tela, /visitante \? t\.excluirVisitante : t\.excluirTexto/, 'visitante lê o texto dele, como na web');
  const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
  assert.equal(mensagens.privacidade.excluirDigite, 'Para confirmar, digite EXCLUIR');
  assert.equal(mensagens.privacidade.politicaDe('OpenAI'), 'Política de privacidade da OpenAI');
  // Os mesmos textos da web (src/app/privacidade-perfil.tsx e aceite-ia.tsx).
  assert.match(await ler('apps/mobile/src/perfil.tsx'), /mensagens\.privacidade\.secaoTitulo/);
  // Spec 16, item 19: a política de privacidade do Studoo fica só em "Ajuda" (a seção não usa mais privacidade.politica).
  for (const chave of ['iaSimulada', 'iaPermitida', 'iaNaoPermitida', 'verQuem', 'revogar', 'permitirAgora', 'excluir']) {
    assert.match(tela, new RegExp(`t\\.${chave}\\b`), `Perfil usa privacidade.${chave}`);
  }
  const cartao = await ler('apps/mobile/src/consentimento-ia.tsx');
  for (const chave of ['aceiteTitulo', 'aceiteTexto', 'aceiteQuem', 'aceiteSemIa', 'permitir', 'agoraNao', 'politicaDe']) {
    assert.match(cartao, new RegExp(`k\\.${chave}\\b`), `cartão usa privacidade.${chave}`);
  }
});

test('telas: Privacidade e dados entre Som e Conta (com Excluir conta no fim, como na web) e o app inteiro dentro da trava', async () => {
  const perfil = await ler('apps/mobile/src/perfil.tsx');
  const som = perfil.indexOf('<SomNoPerfil />');
  const privacidade = perfil.indexOf('<SecaoPrivacidade');
  const conta = perfil.indexOf('{p.conta}');
  const sair = perfil.indexOf('testID="sair"');
  assert.ok(som > 0 && som < privacidade && privacidade < conta && conta < sair, 'ordem: Som, Privacidade e dados, Conta (Sair)');
  assert.match(perfil, /<SecaoPrivacidade desativado=\{desativado\} \/>/);
  // Spec 16, item 20: "Excluir conta" vem logo depois de "Sair", na seção Conta.
  assert.ok(perfil.indexOf('<BotaoExcluirConta desativado={desativado} visitante={perfil.visitante} />') > sair, 'Excluir conta depois de Sair');
  const tela = await ler('apps/mobile/src/privacidade.tsx');
  assert.doesNotMatch(tela, /testID="privacidade-politica"/, 'a política fica só em Ajuda (spec 16, item 19)');

  const sessao = await ler('apps/mobile/src/sessao.tsx');
  assert.match(sessao, /<ConsentimentoIa cliente=\{sessao\.cliente\} aoExcluida=\{aoExcluida\}>\s*\{\(cliente\) => <Estudo cliente=\{cliente\}/);
  assert.match(sessao, /async function aoExcluida\(\) \{[\s\S]*apagarPreferenciasDaConta\(\)[\s\S]*encerrarNoAparelho\(\)/);
});

test('telas: Perfil com Privacidade e dados e Excluir conta também sem o compartilhar (como a web, revisão 20/11)', async () => {
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  // A barra de baixo e o "Perfil" do alto existem com ou sem o compartilhar; "Sair" fica dentro do Perfil.
  assert.match(estudo, /perfil: \(\) => abrir\(\{ tipo: 'perfil' \}\),/);
  assert.doesNotMatch(estudo, /perfil: compartilhar \?/);
  assert.match(estudo, /\{!comNavegacaoAgora && <Botao rotulo=\{mensagens\.perfil\.navegacao\} testID="perfil-cabecalho"/);
  assert.doesNotMatch(estudo, /: <Botao rotulo=\{mensagens\.sair\} testID="sair"/);
  assert.match(estudo, /etapa\.tipo === 'perfil' && !compartilhar\) \{\s*return <PerfilSemSocial cliente=\{cliente\}/);

  const perfil = await ler('apps/mobile/src/perfil.tsx');
  const inicio = perfil.indexOf('export function PerfilSemSocial');
  assert.ok(inicio > 0, 'PerfilSemSocial existe');
  const fim = perfil.indexOf('\nconst perfilEstilos', inicio);
  const corpo = perfil.slice(inicio, fim);
  // Sem a parte social: nada do /api/perfil nem do perfil público; visitante vem de /api/sessao.
  assert.doesNotMatch(corpo, /obterPerfil|perfilPublico|atualizarPerfil/);
  assert.match(corpo, /cliente\.sessao\(\)\.then\(\(dados\) => \{ if \(ativo\) setVisitante\(dados\.visitante === true\)/);
  const som = corpo.indexOf('<SomNoPerfil />');
  const privacidadeSecao = corpo.indexOf('<SecaoPrivacidade desativado={desativado} />');
  const conta = corpo.indexOf('{p.conta}');
  const sair = corpo.indexOf('testID="sair"');
  const excluir = corpo.indexOf('<BotaoExcluirConta desativado={desativado} visitante={visitante} />');
  assert.ok(som > 0 && som < privacidadeSecao && privacidadeSecao < conta && conta < sair && sair < excluir, 'ordem: Som, Privacidade e dados, Conta (Sair, Excluir conta)');
});

test('telas: o Perfil volta à entrada quando a sessão terminou no servidor (conta excluída em outro aparelho)', async () => {
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  assert.equal((estudo.match(/aoSessaoTerminada=\{\(\) => void expirarGuardando\(\)\}/g) ?? []).length, 2, 'TelaPerfil e PerfilSemSocial');
  const perfil = await ler('apps/mobile/src/perfil.tsx');
  assert.match(perfil, /if \(sessaoInvalida\(falha\) && aoSessaoTerminada\) \{ aoSessaoTerminada\(\); return; \}/);
  assert.match(perfil, /\.catch\(\(falha\) => \{ if \(ativo && sessaoInvalida\(falha\)\) aoSessaoTerminada\?\.\(\); \}\)/);
});
