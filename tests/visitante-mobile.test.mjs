import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// "Experimentar sem conta" no app (rodada 4.3), no molde do test:google-mobile: o módulo nativo roda com o cliente e o
// SecureStore simulados.
const fonte = await readFile(new URL('../apps/mobile/src/visitante-nativo.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function ambiente({ token = randomBytes(32).toString('base64url'), erro, falharArmazenamento = false, atraso } = {}) {
  const chamadas = { pedidos: 0, salvo: null, logout: 0, tokenDoLogout: null };
  class ErroStudoo extends Error { constructor(codigo) { super(codigo); this.codigo = codigo; } }
  const modulos = {
    '@studoo/contratos': { ErroStudoo },
    './api-nativa': {
      guardarToken: async (valor) => { if (falharArmazenamento) throw new Error('SecureStore indisponível'); chamadas.salvo = valor; },
      criarClienteNativo: (comToken) => ({
        entrarVisitanteNativo: async () => {
          chamadas.pedidos += 1;
          if (atraso) await atraso;
          if (erro) throw new ErroStudoo(erro);
          return { token, expiraEm: new Date(Date.now() + 86_400_000).toISOString() };
        },
        logout: async () => { chamadas.logout += 1; chamadas.tokenDoLogout = comToken; },
      }),
    },
  };
  const exports = {};
  runInNewContext(outputText, { exports, require: (nome) => modulos[nome] });
  return { api: exports, chamadas, token };
}

test('visitante: pede a conta temporária pela rota do app e guarda o token no SecureStore', async () => {
  const a = ambiente();
  assert.equal(await a.api.entrarComoVisitante(), a.token);
  assert.equal(a.chamadas.pedidos, 1);
  assert.equal(a.chamadas.salvo, a.token);
  assert.equal(a.chamadas.logout, 0);
});

test('visitante: dois toques seguidos fazem um pedido só', async () => {
  let liberar;
  const atraso = new Promise((resolve) => { liberar = resolve; });
  const a = ambiente({ atraso });
  const primeiro = a.api.entrarComoVisitante();
  const segundo = a.api.entrarComoVisitante();
  liberar();
  assert.equal(await primeiro, a.token);
  assert.equal(await segundo, a.token);
  assert.equal(a.chamadas.pedidos, 1);
});

test('visitante: limite_visitante chega com o código e nada é guardado', async () => {
  const a = ambiente({ erro: 'limite_visitante' });
  await assert.rejects(a.api.entrarComoVisitante(), (erro) => erro.codigo === 'limite_visitante');
  assert.equal(a.chamadas.salvo, null);
  // Depois de um erro, um toque novo faz outro pedido (não fica preso no anterior).
  await assert.rejects(a.api.entrarComoVisitante());
  assert.equal(a.chamadas.pedidos, 2);
});

test('visitante: token fora do formato não é guardado', async () => {
  const a = ambiente({ token: 'curto' });
  await assert.rejects(a.api.entrarComoVisitante(), (erro) => erro.codigo === 'falha');
  assert.equal(a.chamadas.salvo, null);
});

test('visitante: falha ao guardar encerra no servidor a sessão recém-criada', async () => {
  const a = ambiente({ falharArmazenamento: true });
  await assert.rejects(a.api.entrarComoVisitante());
  assert.equal(a.chamadas.logout, 1);
  assert.equal(a.chamadas.tokenDoLogout, a.token);
});

test('entrada: o botão só aparece com visitante: true e usa o aviso do aparelho e o texto do limite', async () => {
  const sessao = await readFile(new URL('../apps/mobile/src/sessao.tsx', import.meta.url), 'utf8');
  assert.match(sessao, /setVisitanteDisponivel\(c\.visitante === true\)/);
  assert.match(sessao, /visitanteDisponivel && \(\s*<View testID="acesso-visitante"/);
  assert.match(sessao, /mensagens\.acesso\.experimentarAvisoApp/);
  assert.match(sessao, /entrarComoVisitante\(\)/);
  const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
  assert.match(mensagens.acesso.experimentarAvisoApp, /neste aparelho/);
  assert.ok(mensagens.erros.limite_visitante.length > 0);
});
