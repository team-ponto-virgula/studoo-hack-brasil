// A raiz "/" (spec 18 + decisão do Lead): quem não tem sessão vê a página de apresentação, no próprio "/" (o proxy serve a de /conheca por baixo,
// sem redirecionar nem desenhar o app antes); quem tem sessão, visitante incluído, vê o app como sempre. A escolha é do servidor, pelo cookie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'next/navigation') return { url: 'data:text/javascript,' + encodeURIComponent('export const useRouter = () => ({ replace() {}, push() {}, refresh() {}, back() {}, prefetch() {} }); export const usePathname = () => "/"; export const useSearchParams = () => new URLSearchParams(); export const useParams = () => ({}); export const redirect = () => {}; export const notFound = () => {};'), shortCircuit: true };
  return proximo(especificador, contexto);
}
export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { proxy, config } = await import('../src/proxy.ts');
const { lerCookieSessao, nomeCookieSessao } = await import('../src/servidor/acesso/origem.ts');
const { CABECALHO_NA_RAIZ } = await import('../src/servidor/acesso/raiz.ts');
const { escolherInicio, temCookieDeSessao } = await import('../src/app/conheca/inicio.ts');
const { PaginaVista } = await import('../src/app/conheca/pagina.tsx');
const { APK_PADRAO } = await import('../src/app/conheca/links.ts');

const TOKEN = 'A'.repeat(43);
const pedido = (caminho, cabecalhos = {}) => new NextRequest(`http://localhost:3000${caminho}`, { headers: cabecalhos });
const cabecalhoDoPedido = (resposta, nome) => resposta.headers.get(`x-middleware-request-${nome}`);
const sobrescritos = (resposta) => (resposta.headers.get('x-middleware-override-headers') ?? '').split(',');

test('"/" sem sessão: o proxy serve a página de apresentação (rewrite para /conheca, sem redirecionar) e avisa a página que está na raiz', () => {
  const resposta = proxy(pedido('/'));
  assert.equal(resposta.status, 200, 'sem redirecionamento para o login');
  assert.equal(resposta.headers.get('location'), null);
  assert.equal(new URL(resposta.headers.get('x-middleware-rewrite')).pathname, '/conheca');
  assert.equal(cabecalhoDoPedido(resposta, CABECALHO_NA_RAIZ), '1');
  assert.ok(sobrescritos(resposta).includes(CABECALHO_NA_RAIZ));
  assert.equal(resposta.headers.get('cache-control'), 'no-store');
  assert.match(resposta.headers.get('content-security-policy') ?? '', /script-src 'self' 'nonce-[^']+'/, 'a página recebe o mesmo nonce das outras');
  assert.match(cabecalhoDoPedido(resposta, 'content-security-policy') ?? '', /'nonce-/, 'e o Next lê o nonce do pedido');
});

test('"/" com sessão (conta ou visitante): o proxy deixa passar, o app abre e a página não é servida', () => {
  const resposta = proxy(pedido('/', { cookie: `${nomeCookieSessao()}=${TOKEN}` }));
  assert.equal(resposta.headers.get('x-middleware-rewrite'), null);
  assert.equal(resposta.headers.get('x-middleware-next'), '1');
  assert.equal(cabecalhoDoPedido(resposta, CABECALHO_NA_RAIZ), null);
  assert.ok(!sobrescritos(resposta).includes(CABECALHO_NA_RAIZ));
  assert.equal(resposta.headers.get('cache-control'), 'no-store');
});

test('o cookie conta só no formato da sessão (o mesmo do proxy e da página): vazio, curto, longo ou com caracteres de fora não é sessão', () => {
  const casos = [
    [TOKEN, true], ['aB3_-'.repeat(8) + 'abc', true], ['', false], ['A'.repeat(42), false], ['A'.repeat(44), false], [`${'A'.repeat(42)}!`, false], [`${'A'.repeat(42)}=`, false], [`${'A'.repeat(42)} `, false],
  ];
  for (const [valor, esperado] of casos) {
    const doProxy = lerCookieSessao(pedido('/', valor === '' ? {} : { cookie: `${nomeCookieSessao()}=${valor}` })) !== null;
    assert.equal(doProxy, esperado, `proxy: "${valor}"`);
    assert.equal(temCookieDeSessao(valor), esperado, `página: "${valor}"`);
    assert.equal(escolherInicio(valor), esperado ? 'app' : 'apresentacao');
    if (valor !== '' ) assert.equal(proxy(pedido('/', { cookie: `${nomeCookieSessao()}=${valor}` })).headers.get('x-middleware-rewrite') === null, esperado, `escolha da raiz: "${valor}"`);
  }
  assert.equal(escolherInicio(undefined), 'apresentacao');
  assert.equal(escolherInicio(null), 'apresentacao');
});

test('o cookie com o nome do https (__Host-) vale do mesmo jeito', () => {
  const origem = process.env.STUDOO_ORIGEM;
  process.env.STUDOO_ORIGEM = 'https://studoo.exemplo.test';
  try {
    assert.equal(nomeCookieSessao(), '__Host-studoo-sessao');
    assert.equal(proxy(pedido('/', { cookie: `__Host-studoo-sessao=${TOKEN}` })).headers.get('x-middleware-rewrite'), null);
    assert.equal(new URL(proxy(pedido('/', { cookie: `studoo-sessao=${TOKEN}` })).headers.get('x-middleware-rewrite')).pathname, '/conheca', 'o nome do http não vale no https');
  } finally {
    if (origem === undefined) delete process.env.STUDOO_ORIGEM; else process.env.STUDOO_ORIGEM = origem;
  }
});

test('o aviso de "estou na raiz" é só do servidor: o que o navegador mandar com esse nome é descartado, em "/conheca" e em qualquer rota', () => {
  for (const caminho of ['/conheca', '/login', '/cadastro', '/']) {
    const resposta = proxy(pedido(caminho, { [CABECALHO_NA_RAIZ]: '1', cookie: `${nomeCookieSessao()}=${TOKEN}` }));
    assert.equal(cabecalhoDoPedido(resposta, CABECALHO_NA_RAIZ), null, caminho);
    assert.ok(!sobrescritos(resposta).includes(CABECALHO_NA_RAIZ), caminho);
  }
  const direta = proxy(pedido('/conheca', { [CABECALHO_NA_RAIZ]: '1' }));
  assert.equal(direta.headers.get('x-middleware-rewrite'), null, '/conheca não é reescrita');
  assert.equal(cabecalhoDoPedido(direta, CABECALHO_NA_RAIZ), null);
});

test('as outras rotas seguem como eram (login, cadastro, privacidade…) e o proxy continua cobrindo a raiz e /conheca', () => {
  for (const caminho of ['/login', '/cadastro', '/recuperar', '/privacidade', '/suporte', '/explorar']) {
    const resposta = proxy(pedido(caminho));
    assert.equal(resposta.headers.get('x-middleware-rewrite'), null, caminho);
    assert.equal(resposta.headers.get('x-middleware-next'), '1', caminho);
  }
  assert.ok(config.matcher.includes('/') && config.matcher.includes('/conheca'));
});

test('a rota "/" do app continua só com o app: a página de apresentação não entra no pacote de quem já entrou', () => {
  const pagina = ler('src/app/page.tsx');
  assert.match(pagina, /<Estudo \/>/);
  assert.ok(!/conheca/.test(pagina), 'nenhuma importação da página de apresentação');
});

const base = { aparelho: 'android', links: { apk: APK_PADRAO, testflight: null }, origem: null, comSessao: false, visitante: true };

test('servida na raiz, a página leva a marca que o CSS usa para sumir no app instalado e a ilha que o leva ao login; em /conheca, não', () => {
  const naRaiz = renderToStaticMarkup(createElement(PaginaVista, { ...base, naRaiz: true }));
  assert.match(naRaiz, /<div class="cn-pagina" data-na-raiz="true" data-fundo-so-no-gesto="">/);
  const emConheca = renderToStaticMarkup(createElement(PaginaVista, base));
  assert.match(emConheca, /<div class="cn-pagina" data-fundo-so-no-gesto="">/);
  assert.ok(!/data-na-raiz/.test(emConheca));
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /@media \(display-mode: standalone\) \{ \.cn-pagina\[data-na-raiz\] \{ visibility: hidden; \} \}/);
  const ilha = ler('src/app/conheca/ilhas/saida-do-app.tsx');
  assert.match(ilha, /matchMedia\('\(display-mode: standalone\)'\)\.matches/);
  assert.match(ilha, /navigator as Navigator & \{ standalone\?: boolean \}\)\.standalone === true/, 'o iPhone usa navigator.standalone');
  assert.match(ilha, /roteador\.replace\('\/login'\)/);
  const pagina = ler('src/app/conheca/pagina.tsx');
  assert.match(pagina, /\{naRaiz && <SaidaDoApp \/>\}/);
  assert.match(pagina, /naRaiz=\{cabecalhos\.get\(CABECALHO_NA_RAIZ\) === '1'\}/);
});
