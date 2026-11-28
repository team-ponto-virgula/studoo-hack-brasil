import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, mock } from 'node:test';
import {
  enviarAvisoContaExistente,
  enviarCodigoCadastro,
  enviarRecuperacao,
  recuperacaoDisponivel,
} from '../src/servidor/email/recuperacao.ts';

const chavesAmbiente = [
  'STUDOO_ORIGEM',
  'EMAIL',
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'MILLIONSEND_BASE_URL',
  'MILLIONSEND_API_KEY',
];
let ambienteOriginal;

beforeEach(() => {
  ambienteOriginal = Object.fromEntries(chavesAmbiente.map((k) => [k, process.env[k]]));
  process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  process.env.EMAIL = 'millionsend';
  process.env.MILLIONSEND_BASE_URL = 'https://api-mail.usecenora.com.br';
  process.env.MILLIONSEND_API_KEY = 'ms_chave_sintetica';
  process.env.EMAIL_FROM = 'Studoo <acesso@example.test>';
  delete process.env.RESEND_API_KEY;
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('Nenhuma chamada externa é permitida neste teste');
  });
});

afterEach(() => {
  mock.restoreAll();
  for (const chave of chavesAmbiente) {
    if (ambienteOriginal[chave] === undefined) delete process.env[chave];
    else process.env[chave] = ambienteOriginal[chave];
  }
});

test('MillionSend envia recuperação de senha via POST /emails transacional para destinatário único', async () => {
  let chamadas = 0;
  globalThis.fetch.mock.mockImplementation(async (url, opcoes) => {
    chamadas++;
    assert.equal(url, 'https://api-mail.usecenora.com.br/emails');
    assert.equal(opcoes.method, 'POST');
    assert.equal(opcoes.headers.Authorization, 'Bearer ms_chave_sintetica');
    assert.equal(opcoes.headers['Content-Type'], 'application/json');
    assert.equal(opcoes.redirect, 'error');
    assert.equal(opcoes.cache, 'no-store');
    assert.ok(opcoes.signal instanceof AbortSignal);
    const corpo = JSON.parse(opcoes.body);
    // HTML e texto simples vão juntos, e nada além deles: sem cópia, sem resposta, sem marcador nem tópico.
    assert.deepEqual(Object.keys(corpo).sort(), ['from', 'html', 'subject', 'text', 'to']);
    assert.deepEqual(corpo.to, ['pessoa@example.test']);
    assert.equal(corpo.from, process.env.EMAIL_FROM);
    assert.match(corpo.subject, /recuperar a senha/i);
    assert.match(corpo.text, /654321/);
    assert.match(corpo.text, /15 minutos/);
    assert.match(corpo.text, /https:\/\/studoo\.example\.test\/recuperar/);
    assert.match(corpo.html, /^<!DOCTYPE html>\n<html lang="pt-BR"/);
    assert.match(corpo.html, />654321<\/p>/);
    assert.match(corpo.html, /Vale por 15&nbsp;minutos/);
    assert.match(corpo.html, /<a href="https:\/\/studoo\.example\.test\/recuperar#codigo=654321"/);
    for (const parte of [corpo.subject, corpo.html, corpo.text]) {
      for (const segredo of [process.env.MILLIONSEND_API_KEY, 'pessoa@example.test', 'acesso@example.test']) assert.equal(parte.includes(segredo), false);
    }
    assert.equal('topic_id' in corpo, false, 'envio transacional não entra em tópico de campanha');
    return Response.json({ id: '11111111-1111-4111-8111-111111111111' });
  });

  assert.equal(recuperacaoDisponivel(), true);
  await enviarRecuperacao('pessoa@example.test', '654321');
  assert.equal(chamadas, 1);
});

test('MillionSend envia código de cadastro e aviso de conta existente (e aceita barra no fim da base URL e warning de limite)', async () => {
  process.env.MILLIONSEND_BASE_URL = 'https://api-mail.usecenora.com.br/';
  const enviados = [];
  globalThis.fetch.mock.mockImplementation(async (url, opcoes) => {
    assert.equal(url, 'https://api-mail.usecenora.com.br/emails');
    assert.equal(opcoes.headers.Authorization, 'Bearer ms_chave_sintetica');
    enviados.push(JSON.parse(opcoes.body));
    return Response.json({
      id: '22222222-2222-4222-8222-222222222222',
      warning: {
        code: 'new_domain_limit',
        message: 'Domain daily limit reached',
        sends_after: '2026-11-25T00:00:00Z',
      },
    });
  });

  await enviarCodigoCadastro('nova@example.test', '987654');
  await enviarAvisoContaExistente('existente@example.test');

  assert.equal(enviados.length, 2);
  assert.deepEqual(enviados[0].to, ['nova@example.test']);
  assert.match(enviados[0].subject, /criar a conta/i);
  assert.match(enviados[0].text, /987654/);
  assert.match(enviados[0].html, />987654<\/p>/);
  assert.deepEqual(enviados[1].to, ['existente@example.test']);
  assert.match(enviados[1].subject, /já tem uma conta/i);
  assert.match(enviados[1].text, /https:\/\/studoo\.example\.test\/recuperar/);
  // O aviso de conta existente leva à entrada e à recuperação, nas duas versões, e não traz código.
  for (const parte of [enviados[1].html, enviados[1].text]) {
    assert.match(parte, /https:\/\/studoo\.example\.test\/login/);
    assert.match(parte, /https:\/\/studoo\.example\.test\/recuperar/);
  }
  assert.doesNotMatch(enviados[1].text, /\d{6}/);
  for (const enviado of enviados) assert.deepEqual(Object.keys(enviado).sort(), ['from', 'html', 'subject', 'text', 'to']);
});

test('MillionSend rejeita configurações incompletas, URLs inseguras/inválidas e não cruza chaves com o Resend', async () => {
  const invalidos = [
    ['MILLIONSEND_API_KEY', ''],
    ['MILLIONSEND_API_KEY', 'ms_a\r\nX-Test: 1'],
    ['MILLIONSEND_BASE_URL', ''],
    ['MILLIONSEND_BASE_URL', 'http://api-mail.usecenora.com.br'],
    ['MILLIONSEND_BASE_URL', 'https://user:pass@api-mail.usecenora.com.br'],
    ['MILLIONSEND_BASE_URL', 'https://api-mail.usecenora.com.br?a=1'],
    ['MILLIONSEND_BASE_URL', 'https://api-mail.usecenora.com.br#frag'],
    ['MILLIONSEND_BASE_URL', 'https://api-mail.usecenora.com.br/emails'],
    ['MILLIONSEND_BASE_URL', 'nao-e-url'],
    ['EMAIL_FROM', ''],
    ['EMAIL_FROM', 'Studoo\r\nBcc: outro@example.test'],
    ['STUDOO_ORIGEM', ''],
    ['EMAIL', 'smtp'],
  ];

  for (const [nome, valor] of invalidos) {
    const anterior = process.env[nome];
    process.env[nome] = valor;
    assert.equal(recuperacaoDisponivel(), false, `${nome}=${JSON.stringify(valor)} deve ser recusado`);
    await assert.rejects(enviarCodigoCadastro('pessoa@example.test', '123456'), { message: 'E-mail indisponível' });
    process.env[nome] = anterior;
  }

  // Chave do Resend não habilita MillionSend, e chave do MillionSend não habilita Resend.
  process.env.RESEND_API_KEY = 're_chave_sintetica';
  process.env.MILLIONSEND_API_KEY = '';
  assert.equal(recuperacaoDisponivel(), false);

  process.env.EMAIL = 'resend';
  process.env.RESEND_API_KEY = '';
  process.env.MILLIONSEND_API_KEY = 'ms_chave_sintetica';
  assert.equal(recuperacaoDisponivel(), false);

  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('MillionSend aceita HTTP somente em loopback para desenvolvimento local', async () => {
  process.env.MILLIONSEND_BASE_URL = 'http://127.0.0.1:3001';
  globalThis.fetch.mock.mockImplementation(async (url) => {
    assert.equal(url, 'http://127.0.0.1:3001/emails');
    return Response.json({ id: '33333333-3333-4333-8333-333333333333' });
  });
  assert.equal(recuperacaoDisponivel(), true);
  await enviarCodigoCadastro('local@example.test', '112233');
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('falhas HTTP, respostas malformadas e falhas de rede no MillionSend não expõem detalhes do provedor', async () => {
  const falhas = [
    ...[401, 403, 409, 422, 429, 500].map((status) => async () =>
      Response.json({ statusCode: status, name: 'provider_error', message: 'segredo-do-provedor' }, { status }),
    ),
    async () => Response.json({}),
    async () => Response.json({ id: '' }),
    async () => new Response('não é JSON'),
    async () => { throw new Error('segredo-do-provedor'); },
    async () => { throw new DOMException('prazo', 'TimeoutError'); },
  ];

  for (const falha of falhas) {
    globalThis.fetch.mock.mockImplementation(falha);
    await assert.rejects(enviarRecuperacao('pessoa@example.test', '123456'), { message: 'E-mail indisponível' });
    await assert.rejects(enviarCodigoCadastro('pessoa@example.test', '123456'), { message: 'E-mail indisponível' });
  }
});
