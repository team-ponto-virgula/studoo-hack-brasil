// Página de apresentação (spec 18), peças que não dependem do desenho: o aparelho, os links lidos por pedido, o tamanho do APK, a origem do QR e o /baixar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarAparelho, ehIos, refinarAparelho } from '../src/app/conheca/aparelho.ts';
import { APK_PADRAO, APK_PADRAO_BYTES, TESTFLIGHT_PADRAO, linksDoSite, tamanhoDoApk, tamanhoEmMb } from '../src/app/conheca/links.ts';
import { origemPublica } from '../src/app/conheca/origem-publica.ts';
import { GET } from '../src/app/baixar/route.ts';

const AGENTES = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  androidReduzido: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

test('o aparelho vem do agente do usuário; na dúvida, computador', () => {
  assert.equal(detectarAparelho(AGENTES.android), 'android');
  assert.equal(detectarAparelho(AGENTES.androidReduzido), 'android');
  assert.equal(detectarAparelho(AGENTES.iphone), 'iphone');
  assert.equal(detectarAparelho(AGENTES.ipad), 'ipad');
  assert.equal(detectarAparelho(AGENTES.windows), 'computador');
  assert.equal(detectarAparelho(AGENTES.mac), 'computador');
  for (const vazio of [null, undefined, '']) assert.equal(detectarAparelho(vazio), 'computador');
  assert.ok(ehIos('iphone') && ehIos('ipad') && !ehIos('android') && !ehIos('computador'));
});

test('o navegador corrige só o que o servidor não vê: iPad no modo "site para computador" e a plataforma Android', () => {
  assert.equal(refinarAparelho('computador', { userAgent: AGENTES.mac, pontosDeToque: 5 }), 'ipad');
  assert.equal(refinarAparelho('computador', { userAgent: AGENTES.mac, pontosDeToque: 0 }), 'computador', 'Mac de verdade não tem toque');
  assert.equal(refinarAparelho('computador', { userAgent: AGENTES.windows, pontosDeToque: 10 }), 'computador', 'notebook com tela de toque segue computador');
  assert.equal(refinarAparelho('computador', { userAgent: AGENTES.windows, plataforma: 'Android' }), 'android');
  assert.equal(refinarAparelho('iphone', { userAgent: AGENTES.mac, pontosDeToque: 5 }), 'iphone', 'o que o servidor já sabe não muda');
});

test('os links: APK e convite público por padrão, só HTTPS e opção de desativar o TestFlight', () => {
  assert.deepEqual(linksDoSite({}), { apk: APK_PADRAO, testflight: 'https://testflight.apple.com/join/3zqhGSbD' });
  assert.match(APK_PADRAO, /^https:\/\/expo\.dev\/artifacts\/eas\/nuOIVcSzxIwsigXnnj-UTesEK1NSxGAzoZjAfBoIrbw\.apk$/);
  assert.deepEqual(linksDoSite({ STUDOO_APK_URL: '  ', STUDOO_TESTFLIGHT_URL: '' }), { apk: APK_PADRAO, testflight: null });
  const novo = linksDoSite({ STUDOO_APK_URL: 'https://exemplo.test/studoo.apk', STUDOO_TESTFLIGHT_URL: ' https://testflight.apple.com/join/ABC123 ' });
  assert.deepEqual(novo, { apk: 'https://exemplo.test/studoo.apk', testflight: 'https://testflight.apple.com/join/ABC123' });
  for (const ruim of ['http://exemplo.test/a.apk', 'javascript:alert(1)', 'data:text/html,oi', 'não é endereço', 'https://usuario:senha@exemplo.test/a.apk', '//exemplo.test/a.apk']) {
    assert.deepEqual(linksDoSite({ STUDOO_APK_URL: ruim, STUDOO_TESTFLIGHT_URL: ruim }), { apk: APK_PADRAO, testflight: null }, ruim);
  }
});

test('o tamanho do APK: o medido (114 957 083 bytes) só para o link padrão, cortado e nunca arredondado para cima', () => {
  assert.equal(APK_PADRAO_BYTES, 114_957_083);
  assert.equal(tamanhoEmMb(APK_PADRAO_BYTES), '114,9 MB', '114,957 MB vira 114,9 e não 115,0');
  assert.equal(tamanhoEmMb(99_999_999), '99,9 MB');
  assert.equal(tamanhoEmMb(100_000_000), '100,0 MB');
  assert.equal(tamanhoEmMb(5_000_000), '5,0 MB');
  assert.equal(tamanhoDoApk(linksDoSite({})), '114,9 MB');
  assert.equal(tamanhoDoApk(linksDoSite({ STUDOO_APK_URL: 'https://exemplo.test/outro.apk' })), null, 'link trocado pela variável: tamanho desconhecido, a linha sai sem número');
});

test('a origem do QR: a configurada em https; senão o cabeçalho do proxy, só https e nunca da máquina local', () => {
  assert.equal(origemPublica({ origem: 'https://studoo.exemplo.test' }), 'https://studoo.exemplo.test');
  assert.equal(origemPublica({ origem: 'https://studoo.exemplo.test', protocolo: 'https', host: 'outro.test' }), 'https://studoo.exemplo.test', 'a configurada manda mais que o cabeçalho');
  assert.equal(origemPublica({ origem: 'http://localhost:3011', protocolo: 'https', host: 'studoo.exemplo.test' }), 'https://studoo.exemplo.test');
  assert.equal(origemPublica({ origem: null, protocolo: 'https, http', host: 'studoo.exemplo.test:8443, interno' }), 'https://studoo.exemplo.test:8443', 'vale o primeiro valor da lista do proxy');
  const sem = [
    { origem: null, protocolo: 'http', host: 'studoo.exemplo.test' },
    { origem: null, protocolo: undefined, host: 'studoo.exemplo.test' },
    { origem: null, protocolo: 'https', host: 'localhost:3000' },
    { origem: null, protocolo: 'https', host: '127.0.0.1' },
    { origem: null, protocolo: 'https', host: 'studoo.local' },
    { origem: null, protocolo: 'https', host: '0.0.0.0:3000' },
    { origem: null, protocolo: 'https', host: 'a b' },
    { origem: null, protocolo: 'https', host: 'evil.test/path' },
    { origem: 'http://localhost:3011', protocolo: null, host: null },
    { origem: null, protocolo: 'https', host: '' },
  ];
  for (const entrada of sem) assert.equal(origemPublica(entrada), null, JSON.stringify(entrada));
});

const baixar = (agente, env = {}) => {
  const guardado = { apk: process.env.STUDOO_APK_URL, testflight: process.env.STUDOO_TESTFLIGHT_URL };
  for (const [chave, valor] of [['STUDOO_APK_URL', env.apk], ['STUDOO_TESTFLIGHT_URL', env.testflight]]) { if (valor === undefined) delete process.env[chave]; else process.env[chave] = valor; }
  try {
    return GET(new Request('https://studoo.exemplo.test/baixar', { headers: agente === null ? {} : { 'user-agent': agente } }));
  } finally {
    if (guardado.apk === undefined) delete process.env.STUDOO_APK_URL; else process.env.STUDOO_APK_URL = guardado.apk;
    if (guardado.testflight === undefined) delete process.env.STUDOO_TESTFLIGHT_URL; else process.env.STUDOO_TESTFLIGHT_URL = guardado.testflight;
  }
};
const destino = (r) => r.headers.get('location');

test('/baixar no Android leva ao APK (o padrão ou o da variável), com 302 e sem cache', () => {
  const padrao = baixar(AGENTES.android);
  assert.equal(padrao.status, 302);
  assert.equal(destino(padrao), APK_PADRAO);
  assert.equal(padrao.headers.get('cache-control'), 'no-store');
  assert.match(padrao.headers.get('vary') ?? '', /User-Agent/i);
  assert.equal(destino(baixar(AGENTES.android, { apk: 'https://exemplo.test/novo.apk' })), 'https://exemplo.test/novo.apk');
  assert.equal(destino(baixar(AGENTES.androidReduzido, { apk: 'http://exemplo.test/inseguro.apk' })), APK_PADRAO, 'link inseguro é ignorado');
});

test('/baixar usa TestFlight só no iPhone; o iPad sempre abre as instruções da Tela de Início', () => {
  for (const agente of [AGENTES.iphone, AGENTES.ipad]) {
    assert.equal(destino(baixar(agente)), agente === AGENTES.iphone ? TESTFLIGHT_PADRAO : '/conheca#iphone');
    assert.equal(destino(baixar(agente, { testflight: '' })), '/conheca#iphone');
    assert.equal(destino(baixar(agente, { testflight: 'https://testflight.apple.com/join/ABC123' })), agente === AGENTES.ipad ? '/conheca#iphone' : 'https://testflight.apple.com/join/ABC123');
    assert.equal(destino(baixar(agente, { testflight: 'javascript:alert(1)' })), '/conheca#iphone', 'link inválido vale "em breve"');
    const r = baixar(agente);
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('/baixar no computador (ou sem agente) leva à seção de baixar da página, nunca ao APK nem ao TestFlight', () => {
  for (const agente of [AGENTES.windows, AGENTES.mac, null, '']) {
    const r = baixar(agente, { apk: 'https://exemplo.test/novo.apk', testflight: 'https://testflight.apple.com/join/ABC123' });
    assert.equal(r.status, 302);
    assert.equal(destino(r), '/conheca#baixar');
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('/baixar lê as variáveis a cada pedido: trocar o valor entre dois pedidos muda o destino sem recarregar nada', () => {
  assert.equal(destino(baixar(AGENTES.iphone, { testflight: '' })), '/conheca#iphone');
  assert.equal(destino(baixar(AGENTES.iphone, { testflight: 'https://testflight.apple.com/join/NOVO' })), 'https://testflight.apple.com/join/NOVO');
  assert.equal(destino(baixar(AGENTES.iphone, { testflight: '' })), '/conheca#iphone');
});
