// Página de apresentação (spec 18), o que a página entrega: o HTML de servidor por aparelho (o mesmo que o navegador hidrata), o QR, as imagens,
// o seletor do S4, as fichas e as regras de animação do CSS. As ilhas de cliente rodam aqui só no desenho de servidor; o comportamento delas
// (laço, troca de tela, fichas que correm) está nas capturas e nas medidas do navegador (refino/site... da entrega).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'next/navigation') return { url: 'data:text/javascript,' + encodeURIComponent('export const useRouter = () => ({ replace() {}, push() {}, refresh() {}, back() {}, prefetch() {} }); export const usePathname = () => "/conheca"; export const useSearchParams = () => new URLSearchParams(); export const useParams = () => ({}); export const redirect = () => {}; export const notFound = () => {};'), shortCircuit: true };
  return proximo(especificador, contexto);
}
export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { PaginaVista } = await import('../src/app/conheca/pagina.tsx');
const { APK_PADRAO } = await import('../src/app/conheca/links.ts');
const { svgDoQr } = await import('../src/app/conheca/qr.ts');
const { textos } = await import('../src/app/conheca/textos.ts');
const { IDEIAS_DO_S3, iconeDaIdeia } = await import('../src/app/conheca/ideias.ts');
const { iconesDosTemas } = await import('../src/app/pedido.tsx');
const { mensagens } = await import('../src/mensagens/pt-BR.ts');
const { foraDoSafariNoIphone } = await import('../src/app/conheca/ilhas/folha-iphone.tsx');
const { CAPTURAS } = await import('../src/app/conheca/imagens.gerado.ts');

const ORIGEM = 'https://studoo.exemplo.test';
const base = { aparelho: 'computador', links: { apk: APK_PADRAO, testflight: null }, origem: ORIGEM, comSessao: false, visitante: true };
const desenhar = (extra = {}) => renderToStaticMarkup(createElement(PaginaVista, { ...base, ...extra, links: { ...base.links, ...(extra.links ?? {}) } }));
const texto = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const botoes = (html) => [...html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(([, tag, atributos, miolo]) => ({ tag, atributos, texto: texto(miolo).trim() }));
const achar = (html, rotulo) => botoes(html).filter((b) => b.texto === rotulo);

test('a página tem o título do herói, o subtítulo da spec, um só h1 e a ordem de títulos S2 a S5', () => {
  const html = desenhar();
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(texto(html), new RegExp(textos.heroi.titulo.replace(/[.]/g, '\\.')));
  assert.ok(texto(html).includes(textos.heroi.subtitulo));
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => texto(m[1]).trim());
  for (const titulo of [textos.s2.titulo, textos.s3.titulo, textos.s4.titulo, textos.s5.titulo]) assert.ok(h2.includes(titulo), titulo);
  assert.deepEqual(textos.s2.momentos.map((m) => m.titulo), ['Seu material vira lição', 'Errou? Tem outro jeito', 'Explique do seu jeito', 'No computador e no celular']);
  for (const momento of textos.s2.momentos) { assert.ok(texto(html).includes(momento.titulo)); assert.ok(texto(html).includes(momento.linha)); }
  assert.match(texto(html), /Com uma conta, a sua trilha é a mesma no site e no app\./, 'o momento 4 diz "com uma conta": o progresso do visitante fica só no aparelho dele');
});

test('Android: "Baixar para Android" leva ao APK, a linha de apoio traz o tamanho medido, e não há QR', () => {
  const html = desenhar({ aparelho: 'android' });
  const [botao] = achar(html, 'Baixar para Android');
  assert.ok(botao, 'o botão principal do Android existe');
  assert.equal(botao.tag, 'a');
  assert.match(botao.atributos, new RegExp(`href="${APK_PADRAO.replace(/[.]/g, '\\.')}"`));
  assert.match(botao.atributos, /aria-label="Baixar para Android, versão de teste do Studoo"/, 'o nome para o leitor de tela começa pelo texto visível');
  assert.ok(texto(html).includes('Versão de teste para Android 7 ou mais novo, com 114,9 MB. O arquivo instala direto, sem loja.'));
  assert.equal(achar(html, 'Experimentar sem conta').length >= 2, true, 'o botão de texto está no herói e na chamada final');
  assert.doesNotMatch(html, /cn-qr__codigo/);
  assert.doesNotMatch(texto(html), /Instale no celular/);
});

test('Android com o link trocado pela variável: a frase sai sem o tamanho', () => {
  const html = desenhar({ aparelho: 'android', links: { apk: 'https://exemplo.test/novo.apk', testflight: null } });
  assert.ok(texto(html).includes('Versão de teste para Android 7 ou mais novo. O arquivo instala direto, sem loja.'));
  assert.doesNotMatch(texto(html), /com 114,9 MB|MB\./);
  assert.match(achar(html, 'Baixar para Android')[0].atributos, /href="https:\/\/exemplo\.test\/novo\.apk"/);
});

test('iPhone e iPad: sem link do TestFlight, "Usar no iPhone agora" abre a folha; com link, "Instalar no iPhone" leva ao TestFlight', () => {
  for (const aparelho of ['iphone', 'ipad']) {
    const sem = desenhar({ aparelho });
    const [usar] = achar(sem, 'Usar no iPhone agora');
    assert.ok(usar, aparelho);
    assert.equal(usar.tag, 'button');
    assert.match(usar.atributos, /aria-haspopup="dialog"/);
    assert.match(usar.atributos, /aria-label="Usar no iPhone agora, o Studoo na Tela de Início"/);
    assert.ok(texto(sem).includes('O app para iPhone chega em breve pelo TestFlight.'));
    assert.equal(achar(sem, 'Instalar no iPhone').length, 0);
    const com = desenhar({ aparelho, links: { testflight: 'https://testflight.apple.com/join/ABC123' } });
    const [instalar] = achar(com, 'Instalar no iPhone');
    assert.ok(instalar, aparelho);
    assert.equal(instalar.tag, 'a');
    assert.match(instalar.atributos, /href="https:\/\/testflight\.apple\.com\/join\/ABC123"/);
    assert.ok(texto(com).includes('Versão de teste pelo TestFlight, o app de testes da Apple.'));
    assert.equal(achar(com, 'Usar no iPhone agora').length, 0, 'com o link público a página troca sozinha, sem mexer nela');
  }
});

test('computador: nenhum botão baixa o arquivo; "Experimentar sem conta" é o principal e ao lado fica o cartão do QR para /baixar', () => {
  const html = desenhar();
  assert.equal(achar(html, 'Baixar para Android').length, 0, 'nenhum botão principal baixa o APK no computador');
  const principais = botoes(html).filter((b) => /botao--primario/.test(b.atributos));
  assert.ok(principais.length >= 2, 'o herói e a chamada final');
  for (const botao of principais) assert.doesNotMatch(botao.atributos, /\.apk|href="https:\/\/expo\.dev/, 'nenhum botão principal leva ao arquivo');
  assert.equal(principais.filter((b) => b.texto === 'Experimentar sem conta').length >= 2, true);
  assert.match(html, /<section class="cn-qr[^"]*" aria-labelledby="cn-qr-heroi-titulo">/);
  assert.ok(texto(html).includes('Instale no celular'));
  assert.ok(texto(html).includes('Aponte a câmera do celular'));
  assert.ok(texto(html).includes('Para instalar no celular, aponte a câmera para o código.'));
  assert.match(html, /role="img" aria-label="Código QR para baixar o Studoo no celular"/);
  // O arquivo só aparece como o link pequeno do cartão, com o tamanho.
  const link = botoes(html).find((b) => /cn-qr__arquivo/.test(b.atributos));
  assert.ok(link);
  assert.equal(link.texto, 'Baixar o arquivo para Android (114,9 MB)');
  assert.match(link.atributos, new RegExp(`href="${APK_PADRAO.replace(/[.]/g, '\\.')}"`));
  // O QR é o Código Studoo de `<origem>/baixar`, em https.
  assert.ok(html.includes(svgDoQr(`${ORIGEM}/baixar`)), 'o QR leva ao /baixar da origem pública');
  assert.doesNotMatch(html, /localhost|(?:href|src|action|srcSet)="http:/i, 'nem localhost nem http em endereço da página (o xmlns do SVG não conta)');
  // A mesma regra no S4 (aba Android) e a chamada final: "Experimentar sem conta" principal e "Instalar no celular" que leva ao S4.
  assert.match(html, /aria-labelledby="cn-qr-s4-titulo"/);
  assert.ok(botoes(html).some((b) => b.texto === 'Instalar no celular' && /href="#baixar"/.test(b.atributos)));
});

test('computador sem origem pública confiável (sem https ou local): nenhum QR, e "Instalar no celular" leva ao S4', () => {
  for (const origem of [null]) {
    const html = desenhar({ origem });
    assert.doesNotMatch(html, /cn-qr__codigo|Código QR/);
    assert.doesNotMatch(texto(html), /aponte a câmera/i);
    assert.ok(botoes(html).some((b) => b.texto === 'Instalar no celular' && /href="#baixar"/.test(b.atributos)));
    assert.match(botoes(html).find((b) => b.texto === 'Instalar no celular').atributos, /class="[^"]*cn-instalar-celular(?! cn-instalar-celular--sem-qr)/, 'sem QR o botão de texto aparece em qualquer largura');
  }
});

test('o QR só vai para quem usa computador (celular e tablet não carregam o desenho)', () => {
  for (const aparelho of ['android', 'iphone', 'ipad']) assert.doesNotMatch(desenhar({ aparelho }), /cn-qr__codigo/, aparelho);
});

test('modo visitante desligado: no lugar de "Experimentar sem conta" entra "Entrar", que leva ao login; ligado, é botão', () => {
  const desligado = desenhar({ aparelho: 'android', visitante: false });
  assert.equal(achar(desligado, 'Experimentar sem conta').length, 0);
  assert.ok(botoes(desligado).filter((b) => b.texto === 'Entrar' && /href="\/login"/.test(b.atributos)).length >= 3, 'cabeçalho, herói, final e rodapé');
  const ligado = desenhar({ aparelho: 'android' });
  assert.ok(achar(ligado, 'Experimentar sem conta').every((b) => b.tag === 'button'));
});

test('quem já tem sessão: "Entrar" e "Experimentar sem conta" viram "Abrir o Studoo", que abre o app com a sessão que existe', () => {
  const fora = desenhar({ aparelho: 'android' });
  assert.equal(achar(fora, 'Abrir o Studoo').length, 0);
  assert.equal(achar(fora, 'Entrar').filter((b) => /href="\/login"/.test(b.atributos)).length >= 2, true);
  const dentro = desenhar({ aparelho: 'android', comSessao: true });
  const links = achar(dentro, 'Abrir o Studoo').filter((b) => b.tag === 'a');
  assert.equal(links.length, 2, 'cabeçalho e rodapé');
  for (const botao of links) assert.match(botao.atributos, /href="\/"/);
  assert.equal(achar(dentro, 'Entrar').filter((b) => /href="\/login"/.test(b.atributos)).length, 0);
  assert.equal(achar(dentro, 'Experimentar sem conta').length, 0, 'com sessão o botão não oferece criar outra');
  assert.ok(achar(dentro, 'Abrir o Studoo').filter((b) => b.tag === 'button').length >= 2, 'o herói e a chamada final');
  // Com o modo visitante desligado, quem tem sessão continua abrindo o app (não cai no login).
  const semVisitante = desenhar({ aparelho: 'android', comSessao: true, visitante: false });
  assert.equal(achar(semVisitante, 'Entrar').filter((b) => /href="\/login"/.test(b.atributos)).length, 0);
  assert.ok(achar(semVisitante, 'Abrir o Studoo').filter((b) => b.tag === 'button').length >= 2);
});

test('a ideia da ficha vai para o rascunho que o app já lê e apaga (a mesma chave do estudo.tsx), e com sessão não se cria outra sessão', () => {
  const ilha = ler('src/app/conheca/ilhas/visitante.tsx');
  const chave = ilha.match(/CHAVE_IDEIA_INICIAL = '([^']+)'/)?.[1];
  assert.equal(chave, 'studoo.rascunho.objetivo');
  const app = ler('src/app/estudo.tsx');
  assert.ok(app.includes(`sessionStorage.getItem('${chave}')`), 'o app lê o rascunho ao abrir');
  assert.ok(app.includes(`sessionStorage.removeItem('${chave}')`), 'e o apaga');
  assert.match(ilha, /if \(!comSessao\) await cliente\.entrarVisitante\(\)/, 'quem tem sessão não troca o cookie por um de visitante');
  assert.ok(!/studoo:ideia-inicial/.test(ilha), 'sem a chave antiga, que ninguém lia');
});

test('o link "Pular para o conteúdo" é o primeiro da página e leva ao herói (S1)', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.ok(html.indexOf('class="pular"') < html.indexOf('<header'));
  assert.match(html, /<a class="pular" href="#conteudo">Pular para o conteúdo<\/a>/);
  assert.match(html, /<section id="conteudo" class="cn-heroi"/);
});

test('as imagens: largura e altura declaradas, só do site, a primeira do herói com prioridade e as outras sem, e nunca o stu-oi', () => {
  const html = desenhar({ aparelho: 'android' });
  const imagens = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imagens.length >= 8);
  for (const img of imagens) {
    assert.match(img, /\bwidth="\d+"/, img.slice(0, 80));
    assert.match(img, /\bheight="\d+"/, img.slice(0, 80));
    const origens = [...img.matchAll(/(?:src|srcSet)="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((p) => p.trim().split(' ')[0]));
    for (const origem of origens) assert.match(origem, /^\/(landing|marca)\//, `só do próprio site: ${origem}`);
  }
  assert.doesNotMatch(html, /stu-oi/, 'o Stu "oi" fica de fora');
  const alta = imagens.filter((img) => /fetchPriority="high"|fetchpriority="high"/i.test(img));
  assert.equal(alta.length, 1, 'só uma imagem com prioridade alta');
  assert.match(alta[0], new RegExp(CAPTURAS['heroi-1'].src1x.replace(/[.]/g, '\\.')), 'e é a primeira do herói');
  // A segunda e a terceira do herói só entram no carregamento quando o laço começa (hidden + lazy).
  for (const id of ['heroi-2', 'heroi-3']) {
    const img = imagens.find((i) => i.includes(CAPTURAS[id].src1x));
    assert.match(img, /loading="lazy"/, id);
    assert.match(img, /\bhidden=""/, id);
  }
  // Nenhuma captura passa de 120 KB em 2x (spec 18, seção 5).
  for (const id of Object.keys(CAPTURAS)) {
    const bytes = readFileSync(join(raiz, 'public', CAPTURAS[id].src2x)).length;
    assert.ok(bytes <= 120 * 1024, `${id}: ${bytes} bytes`);
  }
});

test('o celular do herói é um grupo com um rótulo só e cada captura tem o seu alt da spec', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.match(html, /role="group" aria-label="Telas do Studoo: escolher o que aprender, a trilha pronta e uma lição com o acerto"/);
  for (const alt of ['Tela do Studoo perguntando o que você quer aprender', 'Tela do Studoo com a trilha pronta', 'Lição do Studoo com a resposta certa e o Stu comemorando',
    'A ponte do Studoo: outro jeito de entender, em 3 passos', 'O retorno do Stu à sua explicação', 'O mapa da trilha no app']) assert.ok(html.includes(`alt="${alt}"`), alt);
  assert.doesNotMatch(html, /aria-live/, 'a troca das telas nunca é anunciada');
});

test('as molduras seguem a plataforma da captura: ilha no iPhone, ponto de câmera no Android, e nenhum relógio desenhado', () => {
  const html = desenhar({ aparelho: 'android' });
  const plataformas = [...html.matchAll(/class="cn-celular[^"]*" data-plataforma="(iphone|android)"/g)].map((m) => m[1]);
  assert.ok(plataformas.includes('iphone') && plataformas.includes('android'));
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-celular\[data-plataforma='android'\] \.cn-celular__ilha \{[^}]*width: 10px; height: 10px; border-radius: 50%/);
  assert.match(css, /border: 10px solid var\(--cn-marinho\);\n  border-radius: 44px;/);
  assert.doesNotMatch(ler('src/app/conheca/celular.tsx'), /\d\d:\d\d|relogio|hora/i, 'o relógio que aparece é o da captura');
});

test('S3: as seis ideias da tela inicial aparecem UMA vez no código (o laço copia no navegador), com o ícone da área de origem', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.deepEqual([...IDEIAS_DO_S3], [...mensagens.pedido.temas[0].exemplos], 'as mesmas seis, na ordem do app');
  for (const ideia of IDEIAS_DO_S3) assert.equal(html.split(`>${ideia}</button>`).length - 1, 1, ideia);
  for (const ideia of IDEIAS_DO_S3) {
    const origem = mensagens.pedido.temas.find((tema) => tema.id !== 'populares' && tema.exemplos.includes(ideia));
    assert.equal(iconeDaIdeia(ideia), iconesDosTemas[origem?.id ?? 'populares'], `ícone de "${ideia}"`);
  }
  assert.doesNotMatch(html, /cn-fichas__copia|aria-hidden="true" inert/);
  const fichas = ler('src/app/conheca/ilhas/fichas.tsx');
  assert.match(fichas, /copia\.setAttribute\('aria-hidden', 'true'\);\n    copia\.setAttribute\('inert', ''\);/, 'a cópia do laço é escondida do leitor de tela e inerte');
  assert.match(fichas, /prefers-reduced-motion: reduce/);
});

test('S4: grupo de abas acessível com Android e iPhone, e os textos dos passos da spec', () => {
  const html = desenhar();
  assert.match(html, /role="tablist" aria-label="Escolha o seu aparelho"/);
  const abas = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
  assert.equal(abas.length, 2);
  assert.equal(abas.filter((a) => /aria-selected="true"/.test(a)).length, 1);
  assert.match(abas.find((a) => /aria-selected="true"/.test(a)), /id="cn-aba-android"/, 'no computador abre em Android');
  assert.match(abas.find((a) => /aria-selected="true"/.test(a)), /tabindex="0"/);
  assert.match(abas.find((a) => /aria-selected="false"/.test(a)), /tabindex="-1"/);
  for (const aba of abas) { const id = /aria-controls="([^"]+)"/.exec(aba)[1]; assert.ok(html.includes(`id="${id}"`), id); assert.match(html, new RegExp(`role="tabpanel" id="${id}" aria-labelledby="[^"]+"`)); }
  for (const passo of [...textos.s4.android.passos]) assert.ok(texto(html).includes(passo), passo);
  const semLink = desenhar({ aparelho: 'iphone' });
  for (const passo of textos.folhaIphone.passos) assert.ok(texto(semLink).includes(passo), `iPhone sem TestFlight: ${passo}`);
  const comLink = desenhar({ aparelho: 'iphone', links: { testflight: 'https://testflight.apple.com/join/ABC123' } });
  for (const passo of textos.s4.iphone.testflightPassos) assert.ok(texto(comLink).includes(passo), `iPhone com TestFlight: ${passo}`);
  assert.doesNotMatch(texto(comLink), /Toque em Compartilhar, na barra do Safari/, 'com o TestFlight os passos da Tela de Início saem');
  assert.match(html, /id="cn-painel-iphone"[^>]*hidden=""/, 'o painel do iPhone fica escondido no Android');
  const iphone = desenhar({ aparelho: 'iphone' });
  assert.match(iphone, /id="cn-aba-iphone"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="cn-aba-iphone"/, 'no iPhone abre em iPhone');
  assert.match(iphone, /id="cn-painel-android"[^>]*hidden=""/);
  assert.ok(texto(iphone).includes('O app para iPhone chega em breve pelo TestFlight.'));
});

test('o endereço /baixar abre S4: o id baixar na seção e o id iphone no painel do iPhone', () => {
  const html = desenhar({ aparelho: 'iphone' });
  assert.match(html, /<section id="baixar" class="cn-secao cn-s4"/);
  assert.match(html, /<span id="iphone" class="cn-ancora"/);
});

test('rodapé e metadados: logo, a linha do HackBrasil e os três links; o título e a descrição da spec', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.ok(texto(html).includes('Feito para o HackBrasil 2026.'));
  assert.match(html, /<a href="\/privacidade">Política de privacidade<\/a>/);
  assert.match(html, /<a href="\/suporte">Suporte<\/a>/);
  const pagina = ler('src/app/conheca/page.tsx');
  assert.match(ler('src/app/conheca/textos.ts'), /titulo: 'Studoo: aprenda qualquer coisa, uma lição por vez'/);
  assert.match(ler('src/app/conheca/textos.ts'), /descricao: 'O Studoo transforma seu material em prática, usa o erro para oferecer outro caminho e pede que você explique o que entendeu\.'/);
  assert.doesNotMatch(pagina, /robots\s*:/, 'o noindex do site fica o do layout raiz');
  assert.match(ler('src/app/layout.tsx'), /robots: \{ index: false, follow: false \}/);
});

test('sem selos de loja, sem framer-motion, GSAP nem Lottie, e o cabeçalho entra na lista do aviso da música', () => {
  const arquivos = (pasta) => readdirSync(join(raiz, pasta), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(join(pasta, e.name)) : [join(pasta, e.name)]));
  const fontes = arquivos('src/app/conheca').filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => [f, ler(f)]);
  for (const [arquivo, conteudo] of fontes) {
    assert.doesNotMatch(conteudo, /framer-motion|gsap|lottie/i, arquivo);
    assert.doesNotMatch(conteudo, /app-store|play\.google|apple\.com\/app|badge|Download on the App Store|GET IT ON/i, `${arquivo}: sem selos oficiais de loja`);
  }
  assert.match(ler('src/app/aviso-musica-regras.ts'), /export const CABECALHOS_DO_ALTO = '[^']*\.cn-cabecalho'/);
  assert.match(ler('src/proxy.ts'), /"\/conheca"/, 'a política de segurança vale para a página');
});

test('o iPhone fora do Safari (outros navegadores e os de dentro de aplicativos) recebe o pedido para abrir no Safari', () => {
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  assert.equal(foraDoSafariNoIphone(safari), false);
  assert.equal(foraDoSafariNoIphone(safari.replace('Version/17.5', 'CriOS/130.0').replace(' Safari/604.1', ' Safari/604.1')), true, 'Chrome no iPhone');
  assert.equal(foraDoSafariNoIphone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0'), true, 'navegador do Instagram');
  assert.equal(foraDoSafariNoIphone('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36'), false, 'não é iPhone');
});

test('animações só dentro de prefers-reduced-motion: no-preference (com a parada à mão), e o herói parado mostra só a proposta pronta', () => {
  const css = ler('src/app/conheca/conheca.css');
  // Tira os blocos @media (prefers-reduced-motion: no-preference) { ... } (chaves casadas) e vê o que sobra.
  let sobra = css;
  const abertura = /@media [^{]*\(prefers-reduced-motion: no-preference\)[^{]*\{/;
  for (;;) {
    const achado = abertura.exec(sobra);
    if (!achado) break;
    const inicio = achado.index;
    let fundo = 1; let i = inicio + achado[0].length;
    while (fundo > 0 && i < sobra.length) { if (sobra[i] === '{') fundo += 1; else if (sobra[i] === '}') fundo -= 1; i += 1; }
    sobra = sobra.slice(0, inicio) + sobra.slice(i);
  }
  const semMovimento = sobra.split('\n').filter((linha) => /\banimation\b\s*:|\btransition\b\s*:/.test(linha) && !/^\s*\*|^\s*\/\*/.test(linha));
  // Fora do bloco "com movimento" só valem: o desligamento (animation: none / transition: none) e a troca de cor do ponto, que não é movimento.
  for (const linha of semMovimento) assert.match(linha, /animation: none|transition: none|transition: background-color 200ms linear/, linha.trim());
  // As animações da página: o laço do herói, a entrada das seções, o pulso do selo, o correr das fichas.
  for (const nome of ['cn-entrar', 'cn-pulso', 'cn-correr']) assert.match(css, new RegExp(`@keyframes ${nome}`));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.cn-heroi__celular \.cn-tela \{ opacity: 0 !important; transition: none; \}\n  \.cn-heroi__celular \.cn-tela:nth-child\(2\) \{ opacity: 1 !important; \}/);
  assert.match(css, /cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  assert.match(css, /animation: cn-correr 40s linear infinite/, 'as fichas: 40 s por volta, linear, em laço');
  assert.match(css, /\[data-revelar\]\[data-oculto\]:not\(\[data-revelado\]\) \{ opacity: 0; transform: translateY\(16px\); \}/);
  assert.match(css, /transition: opacity 300ms linear/, 'a troca da tela do S2: 300 ms, sumir e aparecer');
});

test('as ilhas de movimento respeitam o movimento reduzido e a aba escondida, e só rodam com o herói na tela', () => {
  const heroi = ler('src/app/conheca/ilhas/celular-heroi.tsx');
  assert.match(heroi, /prefers-reduced-motion: reduce/);
  assert.match(heroi, /document\.hidden/);
  assert.match(heroi, /visibilitychange/);
  assert.match(heroi, /IntersectionObserver/);
  assert.match(heroi, /MS_POR_TELA = 3500/);
  const revelar = ler('src/app/conheca/ilhas/revelar.tsx');
  assert.match(revelar, /prefers-reduced-motion: reduce\)'\)\.matches\) return;/);
  const logo = ler('src/app/conheca/ilhas/logo.tsx');
  assert.match(logo, /source media="\(prefers-reduced-motion: reduce\)" srcSet="\/marca\/logo-com-sorriso\.svg"/);
  assert.match(logo, /setTimeout\(\(\) => setParado\(true\), 3200\)/, 'o logo acorda uma vez (um ciclo de 3 s)');
  assert.match(ler('src/app/globals.css'), /html\[data-pausado='true'\] \*/, 'a aba escondida pausa toda animação CSS do site, inclusive a das fichas');
});
