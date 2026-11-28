// O tempo das respostas da API (esperas vivas): o cabeçalho Server-Timing em toda rota e o log das lentas, sem dados.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const http = await import('../src/servidor/acesso/http.ts');

test('o caminho vai ao log sem ids, códigos nem tokens; os trechos fixos ficam', () => {
  const { rotaSemIdentificadores: rota } = http;
  assert.equal(rota('http://localhost/api/estudio/licoes/cm3x9k2l10000abcd1234efgh/ponte'), '/api/estudio/licoes/:id/ponte');
  assert.equal(rota('https://app.hellostudoo.com.br/api/aprendizado/propostas/ao-vivo'), '/api/aprendizado/propostas/ao-vivo');
  assert.equal(rota('/api/compartilhar/Ab3dE9/adicionar?x=1'), '/api/compartilhar/:id/adicionar');
  assert.equal(rota('/api/capas/tok_en-123/160'), '/api/capas/:id/:id');
  assert.equal(rota('/api/estudio/licoes/abc/voz-ao-vivo/encerrar'), '/api/estudio/licoes/abc/voz-ao-vivo/encerrar');
});

test('toda resposta leva Server-Timing; só a lenta vira uma linha no log, sem conteúdo', () => {
  const linhas = [];
  const original = console.info;
  console.info = (texto) => linhas.push(texto);
  try {
    const rapida = http.marcarTempoDaResposta(http.responder({ ok: true }), performance.now() - 120, new Request('http://localhost/api/aprendizado/planos'));
    assert.match(rapida.headers.get('server-timing'), /^app;dur=\d+$/);
    assert.equal(linhas.length, 0);

    const pedido = new Request('http://localhost/api/estudio/licoes/cm3x9k2l10000abcd1234efgh/ponte', { method: 'POST' });
    const lenta = http.marcarTempoDaResposta(http.responder({ segredo: 'conteudo da licao' }), performance.now() - http.RESPOSTA_LENTA_MS - 50, pedido);
    assert.ok(Number(/dur=(\d+)/.exec(lenta.headers.get('server-timing'))[1]) >= http.RESPOSTA_LENTA_MS);
    assert.equal(linhas.length, 1);
    const registro = JSON.parse(linhas[0]);
    assert.deepEqual(Object.keys(registro).sort(), ['duracaoMs', 'lenta', 'metodo', 'rota', 'status']);
    assert.equal(registro.rota, '/api/estudio/licoes/:id/ponte');
    assert.equal(registro.metodo, 'POST');
    assert.equal(registro.status, 200);
    assert.doesNotMatch(linhas[0], /segredo|conteudo|cm3x9k2l/);

    // Cabeçalhos imutáveis (redirecionamento): a resposta segue, sem erro.
    const redirecionada = http.marcarTempoDaResposta(Response.redirect('http://localhost/login', 307), performance.now());
    assert.equal(redirecionada.status, 307);
  } finally {
    console.info = original;
  }
});

test('as rotas medem o tempo também quando falham', async () => {
  const ok = await http.rotaPublica(new Request('http://localhost/api/teste'), async () => http.responder({ ok: true }));
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('server-timing'), /^app;dur=\d+$/);
  const falha = await http.rotaPublica(new Request('http://localhost/api/teste'), async () => { throw new http.FalhaApi('invalido'); });
  assert.equal(falha.status, 400);
  assert.match(falha.headers.get('server-timing'), /^app;dur=\d+$/);
});
