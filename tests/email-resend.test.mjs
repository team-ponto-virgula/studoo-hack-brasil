import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, mock } from 'node:test';
import { enviarRecuperacao, recuperacaoDisponivel } from '../src/servidor/email/recuperacao.ts';

beforeEach(() => {
  process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  process.env.EMAIL = 'resend';
  process.env.RESEND_API_KEY = 're_chave_sintetica';
  process.env.EMAIL_FROM = 'Studoo <acesso@example.test>';
  mock.method(globalThis, 'fetch', async () => { throw new Error('Nenhuma chamada externa é permitida neste teste'); });
});
afterEach(() => mock.restoreAll());

test('Resend envia o código pelo servidor para um único destinatário', async () => {
  let chamadas = 0;
  globalThis.fetch.mock.mockImplementation(async (url, opcoes) => {
    chamadas++;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(opcoes.method, 'POST');
    assert.equal(opcoes.headers.Authorization, 'Bearer re_chave_sintetica');
    assert.equal(opcoes.headers['Content-Type'], 'application/json');
    assert.equal(opcoes.redirect, 'error');
    assert.equal(opcoes.cache, 'no-store');
    assert.ok(opcoes.signal instanceof AbortSignal);
    const corpo = JSON.parse(opcoes.body);
    assert.deepEqual(corpo.to, ['pessoa@example.test']);
    assert.equal(corpo.from, process.env.EMAIL_FROM);
    assert.match(corpo.subject, /Studoo/);
    assert.match(corpo.text, /123456/);
    assert.match(corpo.text, /15 minutos/);
    assert.match(corpo.text, /https:\/\/studoo.example.test\/recuperar/);
    assert.equal(corpo.text.includes(process.env.RESEND_API_KEY), false);
    return Response.json({ id: 'email-sintetico' });
  });
  assert.equal(recuperacaoDisponivel(), true);
  await enviarRecuperacao('pessoa@example.test', '123456');
  assert.equal(chamadas, 1);
});

test('configuração incompleta, modo SMTP antigo e modo falso público não enviam', async () => {
  for (const [nome, valor] of [['RESEND_API_KEY', ''], ['EMAIL_FROM', ''], ['EMAIL_FROM', 'nome\r\nBcc: outro@example.test'], ['EMAIL', 'smtp'], ['EMAIL', 'falso']]) {
    const anterior = process.env[nome]; process.env[nome] = valor;
    assert.equal(recuperacaoDisponivel(), false);
    await assert.rejects(enviarRecuperacao('pessoa@example.test', '123456'), { message: 'E-mail indisponível' });
    process.env[nome] = anterior;
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('falhas HTTP, respostas malformadas e falhas de rede não expõem detalhes do provedor', async () => {
  const falhas = [
    ...[401, 403, 429, 500].map(status => async () => Response.json({ message: 'segredo-do-provedor' }, { status })),
    async () => Response.json({}),
    async () => Response.json({ id: '' }),
    async () => new Response('não é JSON'),
    async () => { throw new Error('segredo-do-provedor'); },
    async () => { throw new DOMException('prazo', 'TimeoutError'); },
  ];
  for (const falha of falhas) {
    globalThis.fetch.mock.mockImplementation(falha);
    await assert.rejects(enviarRecuperacao('pessoa@example.test', '123456'), { message: 'E-mail indisponível' });
  }
});
