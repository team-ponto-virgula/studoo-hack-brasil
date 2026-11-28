// A raiz "/" (spec 18 + decisão do Lead): quem tem sessão, visitante incluído, vê o app como sempre. Quem não tem sessão vê a página de apresentação SÓ com STUDOO_ENTRADA_APRESENTACAO=1
// (lida a cada pedido); sem a variável (o padrão) ou com outro valor vai ao /login (307, Location relativo), como era antes da página. A PÁGINA decide pelo cookie e pela variável, no
// servidor (`redirect('/login')`, sem montar URL nenhuma); o proxy não decide a raiz: nem reescreve (ela dependia da URL que o Next monta atrás de um proxy HTTPS, com X-Forwarded-Proto, e
// dava 500 em produção) nem redireciona (um Location relativo vindo do proxy dá 500 no Next: ERR_INVALID_URL). "/conheca" e "/baixar" ficam sempre no ar.
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
  if (especificador === 'next/navigation') return { url: 'data:text/javascript,' + encodeURIComponent('export const useRouter = () => ({ replace() {}, push() {}, refresh() {}, back() {}, prefetch() {} }); export const usePathname = () => "/"; export const useSearchParams = () => new URLSearchParams(); export const useParams = () => ({}); export const redirect = (destino) => { const erro = new Error("NEXT_REDIRECT"); erro.destino = destino; throw erro; }; export const notFound = () => {};'), shortCircuit: true };
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
const { entradaPelaApresentacao } = await import('../src/servidor/acesso/entrada-apresentacao.ts');
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
const comEntrada = async (valor, corpo) => {
  const antes = process.env.STUDOO_ENTRADA_APRESENTACAO;
  if (valor === undefined) delete process.env.STUDOO_ENTRADA_APRESENTACAO; else process.env.STUDOO_ENTRADA_APRESENTACAO = valor;
  try { return await corpo(); } finally { if (antes === undefined) delete process.env.STUDOO_ENTRADA_APRESENTACAO; else process.env.STUDOO_ENTRADA_APRESENTACAO = antes; }
};
const comCookie = async (biscoitos, corpo) => { globalThis.__biscoitos = biscoitos; try { return await corpo(); } finally { delete globalThis.__biscoitos; } };

const VARIANTES_DE_PROXY = [{}, { 'x-forwarded-proto': 'http' }, { 'x-forwarded-proto': 'https' }, { 'x-forwarded-proto': 'https', host: 'studoo.exemplo.com' }, { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'studoo.exemplo.com' }];

test('entrada LIGADA (=1): o proxy deixa a raiz passar, com e sem sessão: nem redireciona nem reescreve (atrás de um proxy HTTPS a reescrita podia dar 500)', async () => {
  await comEntrada('1', () => {
    for (const cabecalhos of VARIANTES_DE_PROXY) {
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
  });
});

test('entrada DESLIGADA (sem a variável, 0, true, vazia, " 1", 2): o proxy também deixa a raiz passar (quem leva ao /login é a página, sem reescrita e sem Location montado no proxy)', async () => {
  for (const valor of [undefined, '0', 'true', '', ' 1', '2', 'sim']) {
    await comEntrada(valor, () => {
      for (const cabecalhos of VARIANTES_DE_PROXY) {
        for (const cookie of [undefined, `${nomeCookieSessao()}=curto`, `${nomeCookieSessao()}=${TOKEN}`]) {
          const rotulo = `variável ${JSON.stringify(valor)} ${JSON.stringify(cabecalhos)} ${cookie ? 'com cookie' : 'sem cookie'}`;
          const resposta = proxy(pedido('/', { ...cabecalhos, ...(cookie ? { cookie } : {}) }));
          assert.equal(resposta.status, 200, rotulo);
          assert.equal(resposta.headers.get('location'), null, `${rotulo}: o proxy não redireciona`);
          assert.equal(resposta.headers.get('x-middleware-rewrite'), null, `${rotulo}: sem reescrita`);
          assert.equal(resposta.headers.get('x-middleware-next'), '1', rotulo);
        }
      }
      // "/conheca" e as outras rotas ficam como eram nos dois estados.
      for (const caminho of ['/conheca', '/login', '/cadastro', '/privacidade', '/explorar']) {
        const resposta = proxy(pedido(caminho, { 'x-forwarded-proto': 'https' }));
        assert.equal(resposta.status, 200, caminho);
        assert.equal(resposta.headers.get('location'), null, caminho);
        assert.equal(resposta.headers.get('x-middleware-next'), '1', caminho);
      }
    });
  }
});

test('o proxy não decide a raiz: não reescreve, não redireciona (um Location relativo vindo dele dá 500 no Next) e não lê o cookie nem a variável da entrada', () => {
  const fonte = ler('src/proxy.ts');
  for (const host of ['hellostudoo.com.br', 'www.hellostudoo.com.br', 'app.hellostudoo.com.br', 'studoo.exemplo.com']) {
    const resposta = proxy(pedido('/', { host, 'x-forwarded-proto': 'https' }));
    assert.equal(resposta.headers.get('location'), null);
    assert.equal(resposta.headers.get('x-middleware-rewrite'), null);
  }
  assert.doesNotMatch(fonte, /x-studoo-na-raiz|acesso\/raiz|lerCookieSessao|entradaPelaApresentacao|escolherInicio/, 'nada do cabeçalho antigo, nem do cookie, nem da variável da entrada');
  assert.ok(config.matcher.includes('/') && config.matcher.includes('/conheca'), 'continua cobrindo a raiz (o nonce do CSP) e /conheca');
});

test('STUDOO_ENTRADA_APRESENTACAO: só o valor "1" liga a entrada, lida a cada pedido; o padrão é desligada', () => {
  assert.equal(entradaPelaApresentacao({}), false);
  assert.equal(entradaPelaApresentacao({ STUDOO_ENTRADA_APRESENTACAO: '1' }), true);
  for (const valor of ['0', '', 'true', 'sim', ' 1', '1 ', '11', 'on']) assert.equal(entradaPelaApresentacao({ STUDOO_ENTRADA_APRESENTACAO: valor }), false, JSON.stringify(valor));
  // Sem argumento, lê o ambiente do processo a cada chamada (nada de ler uma vez só).
  const antes = process.env.STUDOO_ENTRADA_APRESENTACAO;
  try {
    delete process.env.STUDOO_ENTRADA_APRESENTACAO;
    assert.equal(entradaPelaApresentacao(), false);
    process.env.STUDOO_ENTRADA_APRESENTACAO = '1';
    assert.equal(entradaPelaApresentacao(), true);
    process.env.STUDOO_ENTRADA_APRESENTACAO = '0';
    assert.equal(entradaPelaApresentacao(), false);
  } finally { if (antes === undefined) delete process.env.STUDOO_ENTRADA_APRESENTACAO; else process.env.STUDOO_ENTRADA_APRESENTACAO = antes; }
  // Está documentada, desligada por padrão.
  assert.match(ler('.env.example'), /^STUDOO_ENTRADA_APRESENTACAO=0$/m);
  assert.match(ler('docs/RODAR-LOCALMENTE.md'), /STUDOO_ENTRADA_APRESENTACAO=1/);
});

test('as outras rotas seguem como eram (login, cadastro, privacidade…)', () => {
  for (const caminho of ['/login', '/cadastro', '/recuperar', '/privacidade', '/suporte', '/explorar', '/conheca']) {
    const resposta = proxy(pedido(caminho));
    assert.equal(resposta.headers.get('x-middleware-rewrite'), null, caminho);
    assert.equal(resposta.headers.get('x-middleware-next'), '1', caminho);
  }
});

test('"/" escolhe no servidor pelo cookie e pela variável: sessão → o app (visitante incluído); sem sessão, com a entrada ligada → a página de apresentação, já com "naRaiz"; desligada → o /login', async () => {
  const nome = nomeCookieSessao();
  const semSessao = [{}, { [nome]: '' }, { [nome]: 'A'.repeat(42) }, { [nome]: 'A'.repeat(44) }, { [nome]: `${'A'.repeat(42)}!` }, { outro: TOKEN }];
  for (const entrada of ['1', undefined, '0']) {
    await comEntrada(entrada, async () => {
      const app = await comCookie({ [nome]: TOKEN }, () => Pagina.default());
      assert.equal(app.type, Estudo, `com sessão, o app (entrada ${entrada})`);
    });
  }
  await comEntrada('1', async () => {
    for (const biscoitos of semSessao) {
      const pagina = await comCookie(biscoitos, () => Pagina.default());
      assert.equal(pagina.type, PaginaDeApresentacao, `sem sessão válida: ${JSON.stringify(biscoitos)}`);
      assert.equal(pagina.props.naRaiz, true);
    }
  });
  for (const entrada of [undefined, '0', 'true']) {
    await comEntrada(entrada, async () => {
      for (const biscoitos of semSessao) {
        await assert.rejects(() => comCookie(biscoitos, () => Pagina.default()), (erro) => erro.message === 'NEXT_REDIRECT' && erro.destino === '/login', `sem sessão com a entrada desligada (${entrada}): ${JSON.stringify(biscoitos)}`);
      }
    });
  }
  assert.equal(Pagina.dynamic, 'force-dynamic', 'lê o cookie e a variável a cada pedido');
  // O cookie com o nome do https (__Host-) vale do mesmo jeito, e o do http não vale no https.
  await comEntrada('1', () => comOrigem('https://studoo.exemplo.test', async () => {
    assert.equal(nomeCookieSessao(), '__Host-studoo-sessao');
    assert.equal((await comCookie({ '__Host-studoo-sessao': TOKEN }, () => Pagina.default())).type, Estudo);
    assert.equal((await comCookie({ 'studoo-sessao': TOKEN }, () => Pagina.default())).type, PaginaDeApresentacao);
  }));
});

test('a raiz carrega a página de apresentação e o app de forma estática e só decide qual desenha (a "/conheca" continua sem "naRaiz")', () => {
  const fonte = ler('src/app/page.tsx');
  assert.match(fonte, /if \(inicio === 'login'\) redirect\('\/login'\);/);
  assert.match(fonte, /inicio === 'app' \? <Estudo \/> : <PaginaDeApresentacao naRaiz \/>/);
  assert.match(ler('src/app/conheca/page.tsx'), /return <PaginaDeApresentacao \/>;/);
});

test('a raiz dos domínios públicos encaminha ao produto certo e preserva sessões no endereço antigo', async () => {
  const anterior = globalThis.__cabecalhos;
  try {
    for (const host of ['hellostudoo.com.br', 'www.hellostudoo.com.br', 'HELLOSTUDOO.COM.BR:443']) {
      globalThis.__cabecalhos = { host };
      await comEntrada(undefined, async () => {
        assert.equal((await comCookie({}, () => Pagina.default())).type, PaginaDeApresentacao);
        assert.equal((await comCookie({ [nomeCookieSessao()]: TOKEN }, () => Pagina.default())).type, PaginaDeApresentacao);
        assert.equal((await Pagina.generateMetadata()).metadataBase.origin, 'https://hellostudoo.com.br');
      });
      const login = proxy(pedido('/login?motivo=teste', { host }));
      assert.equal(login.headers.get('location'), 'https://app.hellostudoo.com.br/login?motivo=teste');
    }
    globalThis.__cabecalhos = { host: 'app.hellostudoo.com.br' };
    await comEntrada('1', async () => {
      await assert.rejects(() => comCookie({}, () => Pagina.default()), (e) => e.destino === '/login');
      assert.equal((await comCookie({ [nomeCookieSessao()]: TOKEN }, () => Pagina.default())).type, Estudo);
    });
    for (const host of ['studoo-web.exemplo.test','hellostudoo.com.br.exemplo.test']) {
      globalThis.__cabecalhos = { host, 'x-forwarded-host': 'hellostudoo.com.br' };
      await comEntrada(undefined, async () => {
        await assert.rejects(() => comCookie({}, () => Pagina.default()), (e) => e.destino === '/login');
        assert.equal((await comCookie({ [nomeCookieSessao()]: TOKEN }, () => Pagina.default())).type, Estudo);
      });
      assert.equal(proxy(pedido('/login', { host })).headers.has('location'), false);
    }
  } finally { globalThis.__cabecalhos = anterior; }
});

test('o cookie conta só no formato da sessão (o mesmo da API e da página): vazio, curto, longo ou com caracteres de fora não é sessão', () => {
  const casos = [
    [TOKEN, true], ['aB3_-'.repeat(8) + 'abc', true], ['', false], ['A'.repeat(42), false], ['A'.repeat(44), false], [`${'A'.repeat(42)}!`, false], [`${'A'.repeat(42)}=`, false], [`${'A'.repeat(42)} `, false],
  ];
  for (const [valor, esperado] of casos) {
    const daApi = lerCookieSessao(pedido('/', valor === '' ? {} : { cookie: `${nomeCookieSessao()}=${valor}` })) !== null;
    assert.equal(daApi, esperado, `API: "${valor}"`);
    assert.equal(temCookieDeSessao(valor), esperado, `página: "${valor}"`);
    assert.equal(escolherInicio(valor, true), esperado ? 'app' : 'apresentacao');
    assert.equal(escolherInicio(valor, false), esperado ? 'app' : 'login', 'com a entrada desligada, quem não tem sessão vai ao login');
  }
  assert.equal(escolherInicio(undefined, true), 'apresentacao');
  assert.equal(escolherInicio(null, true), 'apresentacao');
  assert.equal(escolherInicio(undefined, false), 'login');
  assert.equal(escolherInicio(null, false), 'login');
});

test('os metadados da raiz levam a imagem de compartilhar com endereço completo (a convenção só vale em /conheca); em /conheca ela vem da convenção', async () => {
  const comImagem = await comOrigem('https://studoo.exemplo.test', () => metadadosDaApresentacao({ imagem: true }));
  assert.equal(comImagem.metadataBase.origin, 'https://studoo.exemplo.test');
  assert.equal(comImagem.title, 'Studoo — Seu caderno vira lição.');
  assert.equal(comImagem.openGraph.images[0].url, IMAGEM_DE_COMPARTILHAR);
  assert.equal(IMAGEM_DE_COMPARTILHAR, '/conheca/opengraph-image');
  assert.deepEqual([comImagem.openGraph.images[0].width, comImagem.openGraph.images[0].height], [1200, 630]);
  assert.equal(comImagem.twitter.images[0].url, IMAGEM_DE_COMPARTILHAR);
  assert.equal(comImagem.twitter.card, 'summary_large_image');
  const semImagem = await comOrigem('https://studoo.exemplo.test', () => metadadosDaApresentacao());
  assert.equal('images' in semImagem.openGraph, false, 'em /conheca a imagem vem da convenção opengraph-image');
  assert.equal('images' in semImagem.twitter, false);
  // Com sessão a raiz não traz metadados da apresentação (vale o do layout, o do app).
  assert.deepEqual(await comEntrada('1', () => comCookie({ [nomeCookieSessao()]: TOKEN }, () => Pagina.generateMetadata())), {});
  const sem = await comEntrada('1', () => comCookie({}, () => Pagina.generateMetadata()));
  assert.equal(sem.title, 'Studoo — Seu caderno vira lição.');
  // Com a entrada desligada a raiz vai ao login: não anuncia a página de apresentação.
  assert.deepEqual(await comEntrada(undefined, () => comCookie({}, () => Pagina.generateMetadata())), {});
});

const base = { aparelho: 'android', links: { apk: APK_PADRAO, testflight: null }, origem: null, comSessao: false, visitante: true };

test('servida na raiz, a página leva a marca que o CSS usa para sumir no app instalado e a ilha que o leva ao login; em /conheca, não', () => {
  const naRaiz = renderToStaticMarkup(createElement(PaginaVista, { ...base, naRaiz: true }));
  assert.match(naRaiz, /<div class="cn-pagina" data-na-raiz="true" data-sem-musica="">/);
  const emConheca = renderToStaticMarkup(createElement(PaginaVista, base));
  assert.match(emConheca, /<div class="cn-pagina" data-sem-musica="">/);
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
