import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { abertura, criarControleAbertura, permiteAbertura } from '@studoo/contratos/abertura';
import { proxy } from '../src/proxy.ts';

function cenario() {
  let agora = 0, sequencia = 0;
  const tarefas = new Map();
  const publicados = [];
  const agendar = (acao, atraso) => {
    const id = ++sequencia;
    tarefas.set(id, { quando: agora + atraso, acao });
    return () => tarefas.delete(id);
  };
  const controle = criarControleAbertura((fase, motivo) => publicados.push({ fase, motivo, em: agora }), agendar);
  function avancar(ms) {
    const fim = agora + ms;
    for (;;) {
      const proxima = [...tarefas].filter(([, t]) => t.quando <= fim).sort((a, b) => a[1].quando - b[1].quando || a[0] - b[0])[0];
      if (!proxima) break;
      tarefas.delete(proxima[0]); agora = proxima[1].quando; proxima[1].acao();
    }
    agora = fim;
  }
  return { controle, publicados, avancar, pendentes: () => tarefas.size };
}

test('somente aberturas limpas de entrada recebem a assinatura; links e retornos seguem direto', () => {
  assert.equal(permiteAbertura('/'), true);
  assert.equal(permiteAbertura('/login'), true);
  for (const path of ['/auth/google', '/api/auth/google/retorno', '/t/compartilhada', '/p/perfil', '/suporte', '/privacidade', '/cadastro', '/recuperar']) {
    assert.equal(permiteAbertura(path), false, path);
  }
  assert.equal(permiteAbertura('/login', '?erro=google_invalido'), false);
  assert.equal(permiteAbertura('/', '?code=oauth&state=x'), false);
  assert.equal(permiteAbertura('/', '', '#licao'), false);
});

test('entrada sem sessão preserva a consulta ao redirecionar ao login da mesma origem', () => {
  for (const consulta of ['', '?retorno=1', '?next=https://externo.example/&redirect_uri=//externo.example']) {
    const origem = 'https://studoo.example.test';
    const resposta = proxy(new NextRequest(`${origem}/${consulta}`));
    assert.equal(resposta.status, 307);
    assert.equal(resposta.headers.get('Cache-Control'), 'no-store');
    assert.equal(resposta.headers.get('Set-Cookie'), null);
    const destino = new URL(resposta.headers.get('Location'));
    assert.equal(destino.origin, origem);
    assert.equal(destino.pathname, '/login');
    assert.equal(destino.search, consulta);
    const login = proxy(new NextRequest(destino, { headers: { 'x-studoo-abertura': 'forjado', 'x-studoo-nonce': 'forjado' } }));
    assert.equal(login.headers.get('x-middleware-request-x-studoo-abertura'), consulta ? '0' : '1');
    const nonce = login.headers.get('x-middleware-request-x-studoo-nonce');
    assert.ok(nonce && nonce !== 'forjado');
    assert.ok(login.headers.get('Content-Security-Policy').includes(`'nonce-${nonce}'`));
  }
});

test('prontidão imediata inicia a saída imediatamente, sem esperar acomodação ou tempo mínimo', () => {
  const c = cenario();
  c.controle.pronto(true);
  assert.deepEqual(c.publicados, [{ fase: 'saindo', motivo: 'pronto', em: 0 }]);
  c.avancar(abertura.saidaMs);
  assert.deepEqual(c.publicados.at(-1), { fase: 'concluida', motivo: 'pronto', em: abertura.saidaMs });
  assert.ok(abertura.saidaMs < abertura.acomodacaoMs);
  assert.equal(c.pendentes(), 0);
});

test('movimento reduzido ou ainda desconhecido conclui a prontidão sem transição', () => {
  const c = cenario();
  c.controle.pronto(false);
  assert.deepEqual(c.publicados, [{ fase: 'concluida', motivo: 'pronto', em: 0 }]);
  assert.equal(c.pendentes(), 0);
});

test('fontes/imagem que nunca respondem não mantêm a camada depois do limite', () => {
  const c = cenario();
  c.avancar(abertura.limiteMs - 1);
  assert.equal(c.controle.fase(), 'visivel');
  c.avancar(1);
  assert.deepEqual(c.publicados, [{ fase: 'concluida', motivo: 'limite', em: abertura.limiteMs }]);
  assert.equal(c.pendentes(), 0);
});

test('prontidão tardia não estende o prazo máximo para terminar a animação', () => {
  const c = cenario();
  c.avancar(abertura.limiteMs - 10);
  c.controle.pronto(true);
  c.avancar(10);
  assert.equal(c.controle.fase(), 'concluida');
  assert.equal(c.publicados.at(-1).motivo, 'limite');
  assert.equal(c.pendentes(), 0);
});

test('interação, ocultação, preferência e falha removem a camada sem aguardar relógio', () => {
  for (const motivo of ['interacao', 'contexto', 'preferencia', 'falha']) {
    const c = cenario(); c.avancar(30); c.controle.pular(motivo);
    assert.deepEqual(c.publicados, [{ fase: 'concluida', motivo, em: 30 }]);
    assert.equal(c.pendentes(), 0);
  }
});

test('interromper a saída não entrega uma segunda conclusão nem deixa timers', () => {
  const c = cenario(); c.controle.pronto(true); c.avancar(15); c.controle.pular('interacao');
  c.controle.pronto(true); c.controle.pular('falha'); c.avancar(5000);
  assert.deepEqual(c.publicados.map(p => p.fase), ['saindo', 'concluida']);
  assert.equal(c.publicados.at(-1).em, 15);
  assert.equal(c.pendentes(), 0);
});

test('prontidão repetida não reinicia nem prolonga a saída', () => {
  const c = cenario(); c.controle.pronto(true); c.avancar(50); c.controle.pronto(true);
  c.avancar(abertura.saidaMs - 50);
  assert.deepEqual(c.publicados.map(p => p.em), [0, abertura.saidaMs]);
  assert.equal(c.pendentes(), 0);
});

test('desmontagem cancela todas as tarefas e não publica mais alterações', () => {
  for (const sair of [false, true]) {
    const c = cenario(); if (sair) c.controle.pronto(true);
    const antes = c.publicados.length; c.controle.destruir(); c.controle.pronto(true); c.controle.pular(); c.avancar(5000);
    assert.equal(c.publicados.length, antes);
    assert.equal(c.pendentes(), 0);
  }
});
