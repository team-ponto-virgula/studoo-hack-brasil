// A raiz "/" (spec 18 + decisão do Lead): quem não tem sessão vê a página de apresentação; quem tem sessão, visitante incluído, vê o app como sempre. Quem decide é a própria
// página (src/app/page.tsx), no servidor, só pelo cookie: nada de redirecionamento nem de reescrita no proxy (uma reescrita dependia da URL que o Next monta atrás de um proxy HTTPS,
// com X-Forwarded-Proto, e podia virar 500 em produção).
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
  if (especificador === 'next/headers') return { url: 'data:text/javascript,' + encodeURIComponent('export const cookies = async () => ({ get: (nome) => globalThis.__biscoitos?.[nome] === undefined ? undefined : { name: nome, value: globalThis.__biscoitos[nome] } }); export const headers = async () => ({ get: (nome) => globalThis.__cabecalhos?.[nome.toLowerCase()] ?? null });'), shortCircuit: true };
  return proximo(especificador, contexto);
}
export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  if (/\\.(png|webp|jpe?g|gif|svg)$/.test(url)) return { format: 'module', source: 'export default { src: "/x", width: 1, height: 1 };', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { proxy, config } = await import('../src/proxy.ts');
const { lerCookieSessao, nomeCookieSessao } = await import('../src/servidor/acesso/origem.ts');
const { escolherInicio, temCookieDeSessao } = await import('../src/app/conheca/inicio.ts');
const { PaginaVista, PaginaDeApresentacao } = await import('../src/app/conheca/pagina.tsx');
const { metadadosDaApresentacao, IMAGEM_DE_COMPARTILHAR } = await import('../src/app/conheca/metadados.ts');
const { APK_PADRAO } = await import('../src/app/conheca/links.ts');
const Pagina = await import('../src/app/page.tsx');
const { Estudo } = await import('../src/app/estudo.tsx');

const TOKEN = 'A'.repeat(43);
const pedido = (caminho, cabecalhos = {}) => new NextRequest(`http://localhost:3000${caminho}`, { headers: cabecalhos });
const comOrigem = async (valor, corpo) => {
  const antes = process.env.STUDOO_ORIGEM;
  if (valor === undefined) delete process.env.STUDOO_ORIGEM; else process.env.STUDOO_ORIGEM = valor;
  try { return await corpo(); } finally { if (antes === undefined) delete process.env.STUDOO_ORIGEM; else process.env.STUDOO_ORIGEM = antes; }
};
const comCookie = async (biscoitos, corpo) => { globalThis.__biscoitos = biscoitos; try { return await corpo(); } finally { delete globalThis.__biscoitos; } };

test('o proxy deixa a raiz passar, com e sem sessão: nem redireciona nem reescreve (atrás de um proxy HTTPS a reescrita podia dar 500)', () => {
  const variantes = [{}, { 'x-forwarded-proto': 'http' }, { 'x-forwarded-proto': 'https' }, { 'x-forwarded-proto': 'https', host: 'studoo.exemplo.com' }, { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'studoo.exemplo.com' }];
  for (const cabecalhos of variantes) {
    for (const cookie of [undefined, `${nomeCookieSessao()}=${TOKEN}`, `${nomeCookieSessao()}=curto`]) {
      const resposta = proxy(pedido('/', { ...cabecalhos, ...(cookie ? { cookie } : {}) }));
      const rotulo = `${JSON.stringify(cabecalhos)} ${cookie ? 'com cookie' : 'sem cookie'}`;
      assert.equal(resposta.status, 200, rotulo);
      assert.equal(resposta.headers.get('location'), null, `${rotulo}: sem redirecionamento`);
      assert.equal(resposta.headers.get('x-middleware-rewrite'), null, `${rotulo}: sem reescrita`);
      assert.equal(resposta.headers.get('x-middleware-next'), '1', rotulo);
      assert.equal(resposta.headers.get('cache-control'), 'no-store', rotulo);
      assert.match(resposta.headers.get('content-security-policy') ?? '', /script-src 'self' 'nonce-[^']+'/, `${rotulo}: a página recebe o nonce`);
    }
  }
  const fonte = ler('src/proxy.ts');
  assert.doesNotMatch(fonte, /NextResponse\.(rewrite|redirect)/, 'o proxy não reescreve nem redireciona');
  assert.doesNotMatch(fonte, /lerCookieSessao|x-studoo-na-raiz|acesso\/raiz/, 'e não decide a raiz pelo cookie');
  assert.ok(config.matcher.includes('/') && config.matcher.includes('/conheca'), 'continua cobrindo a raiz (o nonce do CSP) e /conheca');
});

test('as outras rotas seguem como eram (login, cadastro, privacidade…)', () => {
  for (const caminho of ['/login', '/cadastro', '/recuperar', '/privacidade', '/suporte', '/explorar', '/conheca']) {
    const resposta = proxy(pedido(caminho));
    assert.equal(resposta.headers.get('x-middleware-rewrite'), null, caminho);
    assert.equal(resposta.headers.get('x-middleware-next'), '1', caminho);
  }
});

test('"/" escolhe no servidor pelo cookie: sessão → o app (visitante incluído); sem sessão, com cookie torto ou vazio → a página de apresentação, já com "naRaiz"', async () => {
  const nome = nomeCookieSessao();
  const app = await comCookie({ [nome]: TOKEN }, () => Pagina.default());
  assert.equal(app.type, Estudo, 'com sessão, o app');
  for (const biscoitos of [{}, { [nome]: '' }, { [nome]: 'A'.repeat(42) }, { [nome]: 'A'.repeat(44) }, { [nome]: `${'A'.repeat(42)}!` }, { outro: TOKEN }]) {
    const pagina = await comCookie(biscoitos, () => Pagina.default());
    assert.equal(pagina.type, PaginaDeApresentacao, `sem sessão válida: ${JSON.stringify(biscoitos)}`);
    assert.equal(pagina.props.naRaiz, true);
  }
  assert.equal(Pagina.dynamic, 'force-dynamic', 'lê o cookie a cada pedido');
  // O cookie com o nome do https (__Host-) vale do mesmo jeito, e o do http não vale no https.
  await comOrigem('https://studoo.exemplo.test', async () => {
    assert.equal(nomeCookieSessao(), '__Host-studoo-sessao');
    assert.equal((await comCookie({ '__Host-studoo-sessao': TOKEN }, () => Pagina.default())).type, Estudo);
    assert.equal((await comCookie({ 'studoo-sessao': TOKEN }, () => Pagina.default())).type, PaginaDeApresentacao);
  });
});

test('a raiz carrega a página de apresentação e o app de forma estática e só decide qual desenha (a "/conheca" continua sem "naRaiz")', () => {
  const fonte = ler('src/app/page.tsx');
  assert.match(fonte, /escolherInicio\(\(await cookies\(\)\)\.get\(nomeCookieSessao\(\)\)\?\.value\)/);
  assert.match(fonte, /=== 'app' \? <Estudo \/> : <PaginaDeApresentacao naRaiz \/>/);
  assert.match(ler('src/app/conheca/page.tsx'), /return <PaginaDeApresentacao \/>;/);
});

test('o cookie conta só no formato da sessão (o mesmo da API e da página): vazio, curto, longo ou com caracteres de fora não é sessão', () => {
  const casos = [
    [TOKEN, true], ['aB3_-'.repeat(8) + 'abc', true], ['', false], ['A'.repeat(42), false], ['A'.repeat(44), false], [`${'A'.repeat(42)}!`, false], [`${'A'.repeat(42)}=`, false], [`${'A'.repeat(42)} `, false],
  ];
  for (const [valor, esperado] of casos) {
    const daApi = lerCookieSessao(pedido('/', valor === '' ? {} : { cookie: `${nomeCookieSessao()}=${valor}` })) !== null;
    assert.equal(daApi, esperado, `API: "${valor}"`);
    assert.equal(temCookieDeSessao(valor), esperado, `página: "${valor}"`);
    assert.equal(escolherInicio(valor), esperado ? 'app' : 'apresentacao');
  }
  assert.equal(escolherInicio(undefined), 'apresentacao');
  assert.equal(escolherInicio(null), 'apresentacao');
});

test('os metadados da raiz levam a imagem de compartilhar com endereço completo (a convenção só vale em /conheca); em /conheca ela vem da convenção', async () => {
  const comImagem = await comOrigem('https://studoo.exemplo.test', () => metadadosDaApresentacao({ imagem: true }));
  assert.equal(comImagem.metadataBase.origin, 'https://studoo.exemplo.test');
  assert.equal(comImagem.title, 'Studoo: aprenda qualquer coisa, uma lição por vez');
  assert.equal(comImagem.openGraph.images[0].url, IMAGEM_DE_COMPARTILHAR);
  assert.equal(IMAGEM_DE_COMPARTILHAR, '/conheca/opengraph-image');
  assert.deepEqual([comImagem.openGraph.images[0].width, comImagem.openGraph.images[0].height], [1200, 630]);
  assert.equal(comImagem.twitter.images[0].url, IMAGEM_DE_COMPARTILHAR);
  assert.equal(comImagem.twitter.card, 'summary_large_image');
  const semImagem = await comOrigem('https://studoo.exemplo.test', () => metadadosDaApresentacao());
  assert.equal('images' in semImagem.openGraph, false, 'em /conheca a imagem vem da convenção opengraph-image');
  assert.equal('images' in semImagem.twitter, false);
  // Com sessão a raiz não traz metadados da apresentação (vale o do layout, o do app).
  assert.deepEqual(await comCookie({ [nomeCookieSessao()]: TOKEN }, () => Pagina.generateMetadata()), {});
  const sem = await comCookie({}, () => Pagina.generateMetadata());
  assert.equal(sem.title, 'Studoo: aprenda qualquer coisa, uma lição por vez');
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
  assert.match(pagina, /naRaiz=\{naRaiz\}/);
});
