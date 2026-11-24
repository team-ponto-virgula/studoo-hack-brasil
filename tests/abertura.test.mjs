import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abertura, criarControleAbertura, permiteAbertura, progressoDaCoreografia, duracaoDaCoreografia } from '@studoo/contratos/abertura';

function cenario(tempoRestanteMs) {
  let agora = 0, sequencia = 0;
  const tarefas = new Map();
  const publicados = [];
  const agendar = (acao, atraso) => {
    const id = ++sequencia;
    tarefas.set(id, { quando: agora + atraso, acao });
    return () => tarefas.delete(id);
  };
  const controle = criarControleAbertura((fase, motivo) => publicados.push({ fase, motivo, em: agora }), agendar, tempoRestanteMs);
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

test('prontidão antecipada aguarda a coreografia e termina o caso nominal em 1040 ms', () => {
  const c = cenario(); c.controle.pronto(true);
  c.avancar(abertura.sequenciaMs);
  assert.equal(c.controle.fase(), 'visivel');
  assert.deepEqual(c.publicados, []);
  c.controle.animacaoConcluida();
  assert.deepEqual(c.publicados, [{ fase: 'saindo', motivo: 'pronto', em: 880 }]);
  c.avancar(abertura.saidaMs);
  assert.deepEqual(c.publicados.at(-1), { fase: 'concluida', motivo: 'pronto', em: 1040 });
  assert.equal(c.pendentes(), 0);
});

test('a coreografia pode terminar antes da prontidão sem iniciar uma saída prematura', () => {
  const c = cenario(); c.avancar(abertura.sequenciaMs); c.controle.animacaoConcluida();
  assert.equal(c.controle.fase(), 'visivel');
  c.avancar(60); c.controle.pronto(true);
  assert.equal(c.publicados[0].em, abertura.sequenciaMs + 60);
  c.avancar(abertura.saidaMs);
  assert.equal(c.publicados.at(-1).em, abertura.sequenciaMs + 60 + abertura.saidaMs);
});

test('sem movimento permitido a prontidão encerra imediatamente, antes ou durante a saída', () => {
  for (const saindo of [false, true]) {
    const c = cenario();
    if (saindo) { c.controle.pronto(true); c.controle.animacaoConcluida(); }
    c.avancar(20); c.controle.pronto(false);
    assert.equal(c.controle.fase(), 'concluida');
    assert.equal(c.publicados.at(-1).em, 20);
    assert.equal(c.pendentes(), 0);
  }
});

test('o teto prevalece quando recursos ou animação não respondem', () => {
  for (const sinal of ['nenhum', 'pronto', 'animacao']) {
    const c = cenario();
    if (sinal === 'pronto') c.controle.pronto(true);
    if (sinal === 'animacao') c.controle.animacaoConcluida();
    c.avancar(abertura.limiteMs - 1); assert.equal(c.controle.fase(), 'visivel');
    c.avancar(1);
    assert.deepEqual(c.publicados.at(-1), { fase: 'concluida', motivo: 'limite', em: abertura.limiteMs });
    assert.equal(c.pendentes(), 0);
  }
});

test('ambos os sinais no último milissegundo não estendem o teto, em qualquer ordem', () => {
  for (const ordem of ['pronto-primeiro', 'animacao-primeiro']) {
    const c = cenario(); c.avancar(abertura.limiteMs - 1);
    if (ordem === 'pronto-primeiro') { c.controle.pronto(true); c.controle.animacaoConcluida(); }
    else { c.controle.animacaoConcluida(); c.controle.pronto(true); }
    assert.equal(c.controle.fase(), 'saindo');
    c.avancar(1);
    assert.deepEqual(c.publicados.at(-1), { fase: 'concluida', motivo: 'limite', em: abertura.limiteMs });
    assert.equal(c.pendentes(), 0);
  }
});

test('interação, contexto, preferência e falha dispensam antes ou depois de ready', () => {
  for (const motivo of ['interacao', 'contexto', 'preferencia', 'falha']) {
    for (const sinalizou of [false, true]) {
      const c = cenario(); if (sinalizou) c.controle.pronto(true);
      c.avancar(30); c.controle.pular(motivo);
      c.controle.animacaoConcluida(); c.controle.pronto(true); c.avancar(2000);
      assert.deepEqual(c.publicados, [{ fase: 'concluida', motivo, em: 30 }]);
      assert.equal(c.pendentes(), 0);
    }
  }
});

test('interromper dissolve não entrega outra conclusão por callback tardio da animação', () => {
  const c = cenario(); c.controle.pronto(true); c.controle.animacaoConcluida();
  c.avancar(15); c.controle.pular('interacao');
  c.controle.animacaoConcluida(); c.controle.pronto(true); c.avancar(5000);
  assert.deepEqual(c.publicados.map(p => p.fase), ['saindo', 'concluida']);
  assert.equal(c.publicados.at(-1).em, 15);
  assert.equal(c.pendentes(), 0);
});

test('sinais repetidos não reiniciam dissolve nem seu prazo', () => {
  const c = cenario(); c.controle.pronto(true); c.controle.animacaoConcluida();
  c.avancar(50); c.controle.pronto(true); c.controle.animacaoConcluida();
  c.avancar(abertura.saidaMs - 50);
  assert.deepEqual(c.publicados.map(p => p.em), [0, abertura.saidaMs]);
  assert.equal(c.pendentes(), 0);
});

test('desmontagem cancela o teto e saída; callbacks posteriores não publicam', () => {
  for (const estado of ['inicial', 'pronto', 'animacao', 'saindo']) {
    const c = cenario();
    if (estado === 'pronto' || estado === 'saindo') c.controle.pronto(true);
    if (estado === 'animacao' || estado === 'saindo') c.controle.animacaoConcluida();
    const antes = [...c.publicados]; c.controle.destruir();
    c.controle.pronto(true); c.controle.animacaoConcluida(); c.controle.pular(); c.avancar(5000);
    assert.deepEqual(c.publicados, antes);
    assert.equal(c.pendentes(), 0);
  }
});

test('os dados da coreografia respeitam orçamento e interpolações válidas', () => {
  assert.ok(abertura.sequenciaMs + abertura.saidaMs <= abertura.limiteMs);
  assert.equal(abertura.marcos[0], 0);
  assert.equal(abertura.marcos.at(-1), 1);
  assert.ok(abertura.marcos.every((n, i) => !i || n > abertura.marcos[i - 1]));
  for (const chave of ['oculosX', 'oculosY', 'oculosEscala', 'oculosRotacao', 'palavraOpacidade', 'palavraX', 'sorrisoOpacidade', 'sorrisoEscala', 'lenteOpacidade', 'reflexoOpacidade', 'reflexoX']) {
    assert.equal(abertura[chave].length, abertura.marcos.length, chave);
    assert.ok(abertura[chave].every(Number.isFinite), chave);
  }
});

test('montagem tardia recebe só o orçamento restante da origem compartilhada', () => {
  const origemAoMontar = 200;
  const saldo = abertura.limiteMs - origemAoMontar;
  const c = cenario(saldo);
  c.controle.pronto(true);
  c.avancar(saldo - 1); assert.equal(c.controle.fase(), 'visivel');
  c.avancar(1);
  assert.deepEqual(c.publicados.at(-1), { fase: 'concluida', motivo: 'limite', em: saldo });
  assert.equal(origemAoMontar + c.publicados.at(-1).em, abertura.limiteMs);
  assert.equal(c.pendentes(), 0);
});

test('prazo esgotado ou inválido dispensa sincronicamente, sem agendar outra abertura', () => {
  for (const restante of [0, -20, NaN, Infinity]) {
    const c = cenario(restante);
    assert.equal(c.controle.fase(), 'concluida');
    assert.deepEqual(c.publicados, [{ fase: 'concluida', motivo: 'limite', em: 0 }]);
    assert.equal(c.pendentes(), 0);
    c.controle.pronto(true); c.controle.animacaoConcluida();
    assert.equal(c.publicados.length, 1);
  }
});

test('um chamador não consegue aumentar o teto pelo parâmetro de prazo restante', () => {
  const c = cenario(2000);
  c.avancar(abertura.limiteMs);
  assert.equal(c.controle.fase(), 'concluida');
  assert.equal(c.publicados.at(-1).em, abertura.limiteMs);
  assert.equal(c.pendentes(), 0);
});

test('curva única preserva marcos, monotonicidade e limites sem callbacks intermediários', () => {
  assert.equal(progressoDaCoreografia(0), 0);
  assert.equal(progressoDaCoreografia(1), 1);
  for (const marco of abertura.marcos) assert.ok(Math.abs(progressoDaCoreografia(marco) - marco) < 1e-7);
  let anterior = 0;
  for (let i = 0; i <= 2000; i++) {
    const valor = progressoDaCoreografia(i / 2000);
    assert.ok(valor >= anterior && valor <= 1, `${i}: ${valor}`);
    anterior = valor;
  }
  assert.equal(progressoDaCoreografia(-1), 0);
  assert.equal(progressoDaCoreografia(2), 1);
});

test('coreografia usa somente o saldo disponível e reserva o dissolve antes de começar', () => {
  assert.equal(duracaoDaCoreografia(1400), 880);
  assert.equal(duracaoDaCoreografia(1040), 832);
  assert.equal(duracaoDaCoreografia(888), 680);
  for (let restante = 888; restante <= 2000; restante++) {
    const duracao = duracaoDaCoreografia(restante);
    assert.ok(duracao >= abertura.sequenciaMinimaMs && duracao <= abertura.sequenciaMs);
    assert.ok(duracao + abertura.saidaMs + abertura.margemQuadroMs <= Math.min(restante, abertura.limiteMs));
  }
});

test('sem orçamento para movimento legível, dispensa antes de animar em vez de cortar no meio', () => {
  for (const restante of [887, 100, 0, -1, NaN, Infinity]) assert.equal(duracaoDaCoreografia(restante), 0);
});

test('o ritmo alongado suaviza a entrada e a chegada, com inclinação contida', () => {
  assert.ok(abertura.sequenciaMs >= 850 && abertura.sequenciaMs <= 900);
  assert.ok(abertura.sequenciaMinimaMs >= 650 && abertura.sequenciaMinimaMs <= 700);
  assert.ok(abertura.sequenciaMs + abertura.saidaMs >= 1000);
  assert.ok(abertura.marcos[1] * abertura.sequenciaMs >= 200);
  assert.ok(abertura.oculosRotacao.every((graus) => graus >= -5 && graus <= 2));
  const entrada = abertura.marcos[1];
  const partida = progressoDaCoreografia(entrada * 0.1) / entrada;
  const chegada = progressoDaCoreografia(entrada * 0.9) / entrada;
  assert.ok(partida > 0 && partida < 0.1, 'os primeiros 10% não arrancam acima da velocidade média');
  assert.ok(chegada < 1 && 1 - chegada < 0.1, 'os últimos 10% desaceleram antes do foco');
});
