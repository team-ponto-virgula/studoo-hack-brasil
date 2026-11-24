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
const { textos, frasesDoTitulo } = await import('../src/app/conheca/textos.ts');
const { IDEIAS_DO_S3, iconeDaIdeia } = await import('../src/app/conheca/ideias.ts');
const { iconesDosTemas } = await import('../src/app/pedido.tsx');
const { mensagens } = await import('../src/mensagens/pt-BR.ts');
const { foraDoSafariNoIphone } = await import('../src/app/conheca/ilhas/folha-iphone.tsx');
const { CAPTURAS } = await import('../src/app/conheca/imagens.gerado.ts');
const { telasDoHeroi, escolherTelasDoHeroi, ALTS_DO_HEROI } = await import('../src/app/conheca/heroi.ts');
const { TAMANHOS } = await import('../src/app/conheca/celular.tsx');
const sharp = (await import('sharp')).default;

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

test('o título do herói é uma frase por linha ("Aprenda qualquer coisa." e "Uma lição por vez."), cada uma equilibrada por dentro, e continua lendo-se como uma frase só', () => {
  const html = desenhar({ aparelho: 'android' });
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.equal(h1, '<span class="cn-heroi__frase">Aprenda qualquer coisa.</span> <span class="cn-heroi__frase">Uma lição por vez.</span>', 'duas frases, com um espaço entre elas para o leitor de tela e a cópia do texto');
  assert.equal(texto(h1).trim(), textos.heroi.titulo);
  assert.deepEqual(frasesDoTitulo(textos.heroi.titulo), ['Aprenda qualquer coisa.', 'Uma lição por vez.']);
  assert.match(ler('src/app/conheca/conheca.css'), /\.cn-heroi__frase \{ display: block; text-wrap: balance; \}/);
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
  // O cartão é um grupo (aparece duas vezes: duas regiões com o mesmo nome confundem os leitores de tela), e o título dele não é um título de seção.
  assert.match(html, /<div class="cn-qr[^"]*" role="group" aria-labelledby="cn-qr-heroi-titulo"><p id="cn-qr-heroi-titulo" class="cn-qr__titulo">Instale no celular<\/p>/);
  assert.doesNotMatch(html, /<section[^>]*cn-qr/, 'sem região duplicada');
  assert.doesNotMatch(html, /<h2[^>]*cn-qr__titulo/);
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
  const baixa = imagens.filter((img) => /fetchPriority="low"|fetchpriority="low"/i.test(img) && /\/landing\//.test(img));
  assert.equal(baixa.length, imagens.filter((img) => /\/landing\//.test(img)).length - 1, 'as outras capturas (herói 2 e 3, momentos e janela) com prioridade baixa: não disputam a banda com a primeira');
  const [primeira, segunda, terceira] = telasDoHeroi('android').map((t) => t.captura);
  assert.match(alta[0], new RegExp(primeira.src1x.replace(/[.]/g, '\\.')), 'e é a primeira do herói');
  // A segunda e a terceira do herói só entram no carregamento quando o laço começa (hidden + lazy).
  for (const captura of [segunda, terceira]) {
    const img = imagens.find((i) => i.includes(captura.src1x));
    assert.match(img, /loading="lazy"/, captura.src1x);
    assert.match(img, /\bhidden=""/, captura.src1x);
  }
  // Nenhuma captura passa de 120 KB em 2x (spec 18, seção 5).
  for (const id of Object.keys(CAPTURAS)) {
    const bytes = readFileSync(join(raiz, 'public', CAPTURAS[id].src2x)).length;
    assert.ok(bytes <= 120 * 1024, `${id}: ${bytes} bytes`);
  }
});

test('as capturas chegam em AVIF em três larguras, com o sizes de cada lugar e o WebP de reserva, e nenhuma é esticada: a altura segue a proporção da própria captura', async () => {
  const html = desenhar({ aparelho: 'android' });
  // O herói (a imagem do LCP): o AVIF em 320, 480 e 640 com o sizes do herói e, dentro do mesmo <picture>, o <img> com o WebP de reserva, a prioridade alta e o carregamento já.
  const [primeira] = telasDoHeroi('android').map((t) => t.captura);
  const srcSetAvif = primeira.avif.map((a) => `${a.src} ${a.largura}w`).join(', ');
  const figura = html.match(new RegExp(`<picture><source type="image/avif" srcSet="${srcSetAvif.replace(/[.]/g, '\\.')}" sizes="[^"]*"/><img [^>]*>`));
  assert.ok(figura, 'a primeira captura do herói vem num <picture> com o AVIF');
  assert.ok(figura[0].includes(`sizes="${TAMANHOS.heroi}"/><img`), 'o herói usa o sizes do herói');
  assert.match(figura[0], new RegExp(`<img [^>]*src="${primeira.src1x.replace(/[.]/g, '\\.')}" srcSet="${primeira.src1x.replace(/[.]/g, '\\.')} ${primeira.largura}w, ${primeira.src2x.replace(/[.]/g, '\\.')} ${primeira.largura * 2}w" sizes="${TAMANHOS.heroi.replace(/[().]/g, '\\$&')}"`), 'o WebP de reserva leva o mesmo sizes');
  assert.match(figura[0], /loading="eager" fetchPriority="high"/);
  assert.deepEqual(primeira.avif.map((a) => a.largura), [320, 480, 640]);
  // Cada lugar com o seu sizes (a largura da TELA do celular em cada faixa, sem as bordas): o herói, os momentos, o celular do composto e a janela.
  assert.equal(TAMANHOS.heroi, '(min-width: 1024px) 320px, (min-width: 768px) 280px, 240px');
  const ocorrencias = (sizes) => [...html.matchAll(/<source type="image\/avif" srcSet="[^"]*" sizes="([^"]*)"\/>/g)].filter((m) => m[1] === sizes).length;
  assert.equal(ocorrencias(TAMANHOS.heroi), 3, 'as três telas do herói');
  assert.equal(ocorrencias(TAMANHOS.momento), 3, 'os momentos 1 a 3');
  assert.equal(ocorrencias(TAMANHOS.celularDoComposto), 1, 'o celular do momento 4');
  assert.equal(ocorrencias(TAMANHOS.janela), 1, 'a janela do navegador');
  // Os arquivos: AVIF de verdade, bem menor que o WebP do dobro, e com a MESMA proporção do WebP e da largura/altura declaradas (nada esticado nem achatado).
  for (const [id, captura] of Object.entries(CAPTURAS)) {
    assert.deepEqual(captura.avif.map((a) => a.largura), captura.plataforma === 'web' ? [440, 640, 880] : [320, 480, 640], id);
    const proporcao = captura.altura / captura.largura;
    for (const arquivo of captura.avif) {
      const dados = readFileSync(join(raiz, 'public', arquivo.src));
      assert.equal(dados.subarray(4, 12).toString('latin1'), 'ftypavif', `${id}: ${arquivo.src} é AVIF`);
      const meta = await sharp(dados).metadata();
      assert.equal(meta.width, arquivo.largura, arquivo.src);
      assert.ok(Math.abs(meta.height / meta.width - proporcao) / proporcao < 0.005, `${id} ${arquivo.largura}w: ${meta.width}x${meta.height} não tem a proporção declarada (${captura.largura}x${captura.altura})`);
    }
    for (const [src, largura] of [[captura.src1x, captura.largura], [captura.src2x, captura.largura * 2]]) {
      const meta = await sharp(readFileSync(join(raiz, 'public', src))).metadata();
      assert.equal(meta.width, largura, src);
      assert.ok(Math.abs(meta.height / meta.width - proporcao) / proporcao < 0.005, `${id} WebP ${largura}: ${meta.width}x${meta.height}`);
    }
    const bytesAvif = readFileSync(join(raiz, 'public', captura.avif[1].src)).length;
    const bytesWebp = readFileSync(join(raiz, 'public', captura.src2x)).length;
    assert.ok(bytesAvif <= bytesWebp * 0.65, `${id}: o AVIF de ${captura.avif[1].largura}w (${bytesAvif} B) não é bem menor que o WebP 2x (${bytesWebp} B)`);
  }
  // O momento 1 (1080×2400, 20:9) entra com a proporção que tem: a tela da moldura a encaixa inteira, sem esticar (object-fit: contain) e sem recorte.
  const m1 = CAPTURAS['momento-1'];
  assert.ok(Math.abs(m1.altura / m1.largura - 2400 / 1080) / (2400 / 1080) < 0.002, `momento 1: ${m1.largura}x${m1.altura}`);
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-captura \{ display: block; width: 100%; height: 100%; object-fit: contain; \}/, 'a captura é encaixada inteira, nunca esticada (object-fit: fill esticava a do momento 1)');
  assert.doesNotMatch(css, /object-fit: (fill|cover)/);
  assert.match(css, /\.cn-celular__tela picture, \.cn-janela__tela picture \{ display: contents; \}/);
  // O roteiro que gera as imagens: a largura manda e a altura acompanha (nada de esticar para a proporção da plataforma).
  const roteiro = ler('scripts/otimizar-capturas-landing.mjs');
  assert.match(roteiro, /const alturaPara = \(largura\) => Math\.round\(largura \* proporcao\);/);
  assert.doesNotMatch(roteiro, /Math\.round\(largura \/ razao\)/, 'a altura não vem mais da proporção da plataforma');
});

test('momento 4: o site numa janela de navegador desenhada pelo Studoo (captura real da web) ao lado do app, e nenhuma prévia web dentro de moldura de celular', () => {
  const html = desenhar({ aparelho: 'android' });
  const momentos = [...html.matchAll(/<article class="cn-momento"[^>]*data-momento="(\d)"[\s\S]*?<\/article>/g)].map((m) => [m[1], m[0]]);
  assert.equal(momentos.length, 4);
  for (const [numero, bloco] of momentos) {
    if (numero !== '4') assert.doesNotMatch(bloco, /cn-composto|cn-janela/, `só o momento 4 tem a janela (${numero})`);
  }
  const quatro = momentos[3][1];
  assert.match(quatro, /<div class="cn-momento__visual cn-momento__visual--composto"><div class="cn-composto">/);
  const janela = quatro.match(/<div class="cn-janela">[\s\S]*?<div class="cn-janela__tela">([\s\S]*?)<\/div><\/div>/);
  assert.ok(janela, 'a janela e a tela dela');
  assert.ok(janela[1].includes(CAPTURAS['janela-4'].src1x) && janela[1].includes(CAPTURAS['janela-4'].src2x), 'a captura da web, em 1x e 2x');
  assert.ok(janela[1].includes(`alt="${textos.s2.janelaAlt}"`));
  assert.equal(CAPTURAS['janela-4'].plataforma, 'web');
  assert.match(janela[1], /loading="lazy"/);
  // A barra é só desenho (escondida do leitor de tela) e não inventa endereço: tem a aba "Studoo" e nada com cara de URL.
  const barra = quatro.match(/<div class="cn-janela__barra" aria-hidden="true">([\s\S]*?)<\/div>/)[1];
  assert.ok(texto(barra).includes('Studoo'));
  assert.doesNotMatch(texto(barra), /https?:|www\.|\.com|\.app|\.br|sslip/i);
  // A captura da web nunca está dentro de uma moldura de celular, e a do app nunca dentro da janela.
  const celulares = [...html.matchAll(/<div class="cn-celular[^"]*"[\s\S]*?<\/div><\/div>/g)].map((m) => m[0]);
  assert.ok(celulares.length >= 5);
  for (const celular of celulares) assert.ok(!celular.includes('janela-4-'), 'a web fora do celular');
  assert.ok(!janela[1].includes(CAPTURAS['momento-4'].src1x), 'o app fora da janela');
  // O selo "Progresso salvo agora" fica no composto e o celular dele (o do app) mostra o mapa.
  assert.match(quatro, /<p class="cn-selo-sincronia">[\s\S]*Progresso salvo agora<\/p>/);
  assert.ok(quatro.includes(CAPTURAS['momento-4'].src1x));
  // Frases do texto do momento: "com uma conta" (o progresso do visitante fica só no aparelho dele).
  assert.match(texto(quatro), /Com uma conta, a sua trilha é a mesma no site e no app\./);
});

test('contraste: os botões de texto da página usam o azul escuro do app (o azul da ação não chega a 4,5:1 sobre o céu do herói)', () => {
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-pagina \.cn-entrar, \.cn-pagina \.cn-visitante-texto, \.cn-pagina \.cn-instalar-celular \{ color: var\(--acao-escura\); \}/);
  assert.match(ler('src/app/globals.css'), /--acao-escura: #1d4ed8;/);
  // A conta: #1D4ED8 sobre #EAF0FF (o céu do cabeçalho) e sobre o branco.
  const luz = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const razao = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(razao('#1d4ed8', '#eaf0ff') >= 4.5, 'sobre o céu');
  assert.ok(razao('#1d4ed8', '#ffffff') >= 4.5, 'sobre o branco');
  assert.ok(razao('#2563ff', '#eaf0ff') < 4.5, 'e é por isso que o azul da ação não serve ali');
});

test('o celular preso: as molduras dos momentos 1 a 3 se sobrepõem, e só a do primeiro tem fundo e borda (as outras cobririam a tela que está à vista); a ilha é a da captura à vista', () => {
  const css = ler('src/app/conheca/conheca.css');
  const preso = css.slice(css.indexOf('@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {'));
  assert.match(preso, /\.cn-momento \.cn-celular \{ box-shadow: none; background: transparent; border-color: transparent; \}/);
  assert.match(preso, /\.cn-momento:first-child \.cn-celular \{ background: var\(--cn-marinho\); border-color: var\(--cn-marinho\); box-shadow: 0 24px 48px/);
  assert.match(preso, /\.cn-momento \.cn-celular__ilha \{ opacity: 0; transition: opacity 300ms linear; \}/);
  assert.match(preso, /\.cn-momento\[data-ativo\] \.cn-celular__ilha,\n  \.cn-s2__momentos:not\(:has\(\[data-ativo\]\)\) \.cn-momento:first-child \.cn-celular__ilha \{ opacity: 1; \}/);
  // O momento 4 leva a moldura inteira com ele (o celular dele não está na pilha).
  assert.match(preso, /\.cn-momento\[data-momento='4'\] \.cn-celular \{ background: var\(--cn-marinho\); border-color: var\(--cn-marinho\); \}/);
});

test('o CSS do momento 4: o celular preso cobre só os momentos 1 a 3, o composto é uma linha comum, e tudo respeita o movimento reduzido', () => {
  const css = ler('src/app/conheca/conheca.css');
  const preso = css.slice(css.indexOf('@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {'));
  assert.match(preso, /grid-row: 1 \/ span 3;\n    position: sticky;/, 'o celular preso termina no momento 3');
  assert.match(preso, /\.cn-momento__visual--composto \{ grid-row: 4; position: relative;/);
  assert.match(preso, /\.cn-s2__momentos:has\(\.cn-momento\[data-momento='4'\]\[data-ativo\]\) \.cn-momento__visual:not\(\.cn-momento__visual--composto\) \{ opacity: 0; \}/, 'no momento 4 o celular preso sai, em 300 ms');
  assert.match(preso, /\.cn-momento\[data-momento='4'\]\[data-ativo\] \.cn-momento__visual--composto \{ opacity: 1; \}/);
  // Fora do movimento permitido (reduzido ou sem JavaScript) nada fica escondido: o composto só some dentro do bloco de movimento.
  const fora = css.slice(0, css.indexOf('@media (min-width: 1024px) and (prefers-reduced-motion: no-preference) {'));
  assert.doesNotMatch(fora, /cn-momento__visual--composto[^}]*opacity: 0/);
});

test('o herói escolhe as três telas pela plataforma do aparelho: Android vê as do Android, os outros as do iPhone, e sem as da rodada limpa vale o conjunto provisório', () => {
  const fabrica = (id, plataforma) => ({ plataforma, provisoria: false, src1x: `/landing/${id}-1x.webp`, src2x: `/landing/${id}-2x.webp`, largura: 320, altura: 696, origem: 'teste' });
  const provisorio = { 'heroi-1': fabrica('heroi-1', 'iphone'), 'heroi-2': fabrica('heroi-2', 'android'), 'heroi-3': fabrica('heroi-3', 'iphone') };
  // Só o conjunto provisório: o mesmo para todos (ele mistura as plataformas, e por isso é provisório).
  for (const aparelho of ['android', 'iphone', 'ipad', 'computador']) assert.deepEqual(escolherTelasDoHeroi(provisorio, aparelho).map((t) => t.captura.src1x), ['/landing/heroi-1-1x.webp', '/landing/heroi-2-1x.webp', '/landing/heroi-3-1x.webp']);
  // Com a rodada limpa: cada plataforma com as suas três, sem misturar.
  const limpo = { ...provisorio };
  for (const n of [1, 2, 3]) { limpo[`heroi-${n}-iphone`] = fabrica(`heroi-${n}-iphone`, 'iphone'); limpo[`heroi-${n}-android`] = fabrica(`heroi-${n}-android`, 'android'); }
  const doAndroid = escolherTelasDoHeroi(limpo, 'android');
  assert.deepEqual(doAndroid.map((t) => t.captura.plataforma), ['android', 'android', 'android']);
  for (const aparelho of ['iphone', 'ipad', 'computador']) assert.deepEqual(escolherTelasDoHeroi(limpo, aparelho).map((t) => t.captura.plataforma), ['iphone', 'iphone', 'iphone'], aparelho);
  assert.deepEqual(doAndroid.map((t) => t.alt), [...ALTS_DO_HEROI]);
  // Captura da web nunca entra numa moldura de celular, e a falta de uma é um erro alto (não uma tela vazia).
  assert.throws(() => escolherTelasDoHeroi({ ...provisorio, 'heroi-2': fabrica('heroi-2', 'web') }, 'android'), /Falta a captura 2 do herói/);
  assert.throws(() => escolherTelasDoHeroi({ 'heroi-1': provisorio['heroi-1'] }, 'iphone'), /Falta a captura 2 do herói/);
  // A página usa a escolha: o conjunto do aparelho vira o do HTML.
  for (const aparelho of ['android', 'iphone']) {
    const html = desenhar({ aparelho });
    for (const tela of telasDoHeroi(aparelho)) assert.ok(html.includes(tela.captura.src1x), `${aparelho}: ${tela.captura.src1x}`);
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

test('S3: as seis ideias da tela inicial estão UMA vez no código, em grade que quebra linha com todas à vista, com o ícone da área de origem e sem fileira em laço', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.deepEqual([...IDEIAS_DO_S3], [...mensagens.pedido.temas[0].exemplos], 'as mesmas seis, na ordem do app');
  for (const ideia of IDEIAS_DO_S3) assert.equal(html.split(`>${ideia}</button>`).length - 1, 1, ideia);
  for (const ideia of IDEIAS_DO_S3) {
    const origem = mensagens.pedido.temas.find((tema) => tema.id !== 'populares' && tema.exemplos.includes(ideia));
    assert.equal(iconeDaIdeia(ideia), iconesDosTemas[origem?.id ?? 'populares'], `ícone de "${ideia}"`);
  }
  // Uma lista só, com o nome para o leitor de tela e a marca da entrada uma a uma; nada de cópia escondida nem de fileira que corre.
  const lista = html.match(/<ul class="cn-fichas__lista"[^>]*>([\s\S]*?)<\/ul>/);
  assert.ok(lista, 'a lista de fichas');
  assert.match(html, /<ul class="cn-fichas__lista" aria-label="[^"]+" data-revelar-itens="true">/);
  assert.equal((lista[1].match(/<li class="cn-ficha-item">/g) ?? []).length, 6);
  assert.equal((html.match(/cn-fichas__lista/g) ?? []).length, 1);
  assert.doesNotMatch(html, /cn-fichas__copia|aria-hidden="true" inert|data-correndo|cn-fichas__pista/);
  const fichas = ler('src/app/conheca/ilhas/fichas.tsx');
  assert.doesNotMatch(fichas, /use client|useEffect|cloneNode|setAttribute\('inert'/, 'a lista é de servidor: não copia nada no navegador');
  const css = ler('src/app/conheca/conheca.css');
  assert.doesNotMatch(css, /cn-correr|data-correndo|cn-fichas__pista|cn-fichas__copia/, 'sem a fileira em laço');
  assert.match(css, /\.cn-fichas__lista \{ display: flex; flex-wrap: wrap; justify-content: center; gap: 12px;/, 'grade que quebra linha');
});

test('S3: as fichas entram uma a uma, uma vez (300 ms cada, 60 ms entre elas, subindo 8 px), só com movimento permitido; sem movimento, todas à vista', () => {
  const css = ler('src/app/conheca/conheca.css');
  const abertura = css.indexOf('@media (prefers-reduced-motion: no-preference) {\n  /* As seis entram uma a uma');
  assert.ok(abertura > 0, 'a entrada das fichas vive dentro do bloco com movimento permitido');
  const bloco = css.slice(abertura, css.indexOf('/* ---------- S4', abertura));
  assert.match(bloco, /\.cn-ficha-item \{ transition: opacity 300ms ease-out, transform 300ms ease-out; \}/);
  const atrasos = [...bloco.matchAll(/\.cn-ficha-item:nth-child\((\d)\) \{ transition-delay: (\d+)ms; \}/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(atrasos, [[2, 60], [3, 120], [4, 180], [5, 240], [6, 300]], '60 ms entre uma e outra');
  assert.match(bloco, /\[data-revelar-itens\]\[data-oculto\]:not\(\[data-revelado\]\) > \.cn-ficha-item \{ opacity: 0; transform: translateY\(8px\); \}/);
  // A ilha que revela cuida das duas marcas, e a lista das fichas não tem entrada própria da seção inteira.
  assert.match(ler('src/app/conheca/ilhas/revelar.tsx'), /querySelectorAll<HTMLElement>\('\[data-revelar\], \[data-revelar-itens\]'\)/);
  const html = desenhar({ aparelho: 'android' });
  assert.match(html, /<div class="cn-s3__cabeca" data-revelar="true">/, 'o Stu, o título e a linha entram com a seção; as fichas, uma a uma');
  assert.doesNotMatch(html, /<section class="cn-secao cn-s3"[^>]*data-revelar/);
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

test('a música de fundo (cerca de 0,9 MB) não é baixada ao abrir a página: só no primeiro gesto; no resto do app continua preparada como antes', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.match(html, /<div class="cn-pagina"[^>]* data-fundo-so-no-gesto=""/);
  const som = ler('src/app/ambiente-som.tsx');
  assert.match(som, /if \(!naApresentacao\(\)\) tocaSons\.prepararFundo\(\);/);
  assert.match(som, /const naApresentacao = \(\) => document\.querySelector\(PAGINA_DE_APRESENTACAO\) !== null;/);
  assert.equal((som.match(/prepararFundo\(\)/g) ?? []).length, 1, 'uma única chamada, a protegida');
  // O som já começa do frio no primeiro gesto (mostra "carregando" e toca quando chega): a rotina que o gesto dispara carrega o arquivo se faltar.
  const sons = ler('src/app/sons.ts');
  assert.match(sons, /if \(!this\.cacheBuffers\.has\(arquivoSonoro\('fundos', def\.arquivo\)\)\) \{\n      this\.estadoFundo = 'carregando';/);
  assert.match(sons, /const buf = await this\.carregarBuffer\(arquivoSonoro\('fundos', def\.arquivo\), TIMEOUT_CARREGAMENTO_MS\);/);
});

test('a página não importa o banco ao carregar (o módulo do visitante abre o cliente do banco): só na hora do pedido; por isso a suíte roda sem DATABASE_URL', () => {
  const pagina = ler('src/app/conheca/pagina.tsx');
  assert.doesNotMatch(pagina, /^import[^\n]*acesso\/visitante/m, 'sem importação estática do módulo do visitante');
  assert.match(pagina, /const \{ visitanteAtivo \} = await import\('@\/servidor\/acesso\/visitante'\);/);
  for (const arquivo of ['src/app/conheca/pagina.tsx', 'src/app/conheca/page.tsx', 'src/app/conheca/inicio.ts', 'src/app/conheca/links.ts']) {
    assert.doesNotMatch(ler(arquivo), /^import[^\n]*(servidor\/banco|compartilhar\/servico|acesso\/sessao|acesso\/visitante)/m, `${arquivo} não importa o banco`);
  }
});

test('a folha do iPhone vai para a raiz da página por portal (dentro do herói, o celular do herói passava por cima dela e do escurecimento)', () => {
  const folha = ler('src/app/conheca/ilhas/folha-iphone.tsx');
  assert.match(folha, /import \{ createPortal \} from 'react-dom';/);
  assert.match(folha, /document\.querySelector<HTMLElement>\('\.cn-pagina'\) \?\? document\.body/);
  assert.match(folha, /return createPortal\(\n    <div className="folha-fundo"/);
  // A raiz da página não cria contexto de empilhamento (sem z-index), então o z-index da folha (40) vale contra o cabeçalho (4) e o herói (1).
  const css = ler('src/app/conheca/conheca.css');
  assert.doesNotMatch(css.slice(css.indexOf('.cn-pagina {'), css.indexOf('}', css.indexOf('.cn-pagina {'))), /z-index|isolation|transform/);
  assert.match(ler('src/app/compartilhar.css'), /\.folha-fundo \{[^}]*z-index: 40;/s);
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
  // As animações da página: o laço do herói, a entrada das seções e o pulso do selo (as fichas entram por transição, uma a uma, e não correm).
  for (const nome of ['cn-entrar', 'cn-pulso']) assert.match(css, new RegExp(`@keyframes ${nome}`));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.cn-heroi__celular \.cn-tela \{ opacity: 0 !important; transition: none; \}\n  \.cn-heroi__celular \.cn-tela:nth-child\(2\) \{ opacity: 1 !important; \}/);
  assert.match(css, /cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  assert.match(css, /\[data-revelar\]\[data-oculto\]:not\(\[data-revelado\]\) \{ opacity: 0; transform: translateY\(16px\); \}/);
  assert.match(css, /transition: opacity 300ms linear/, 'a troca da tela do S2: 300 ms, sumir e aparecer');
});

test('a troca de tela do herói não deixa quadro vazio: a nova entra por cima da que sai, que fica inteira por baixo até a nova terminar, e só troca com a próxima captura carregada', () => {
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-tela\[data-ativa\] \{ opacity: 1; z-index: 2; \}/, 'a tela de agora fica por cima');
  assert.match(css, /\.cn-tela\[data-saindo\] \{ opacity: 1; z-index: 1; \}/, 'a que sai fica inteira por baixo (a soma das opacidades nunca cai abaixo de 1)');
  assert.doesNotMatch(css, /\.cn-heroi__celular \.cn-tela \{ transition: opacity/, 'sem transição de opacidade nas telas (a que saía sumia na hora e a nova subia do zero)');
  assert.match(css, /\.cn-heroi__celular \.cn-tela\[data-entrando\] \{ animation: cn-entrar 400ms cubic-bezier\(0\.2, 0\.8, 0\.2, 1\) both; \}/, 'a troca continua em 400 ms, com a nova subindo 12 px');
  assert.doesNotMatch(css, /\.cn-tela\[data-ativa\] \{ animation/, 'a animação NÃO é da tela ativa em geral: reiniciava na primeira tela quando a página hidratava e ela piscava a 0 na carga');
  assert.doesNotMatch(css, /\[data-pronto\] \.cn-tela/, 'nada de animação ligada pela hidratação (data-pronto)');
  assert.match(css, /@keyframes cn-entrar \{ from \{ opacity: 0; transform: translateY\(12px\); \} to \{ opacity: 1; transform: none; \} \}/);
  const ilha = ler('src/app/conheca/ilhas/celular-heroi.tsx');
  assert.match(ilha, /data-saindo=\{indice === troca\.anterior \|\| undefined\}/, 'a que sai leva a marca na mesma troca em que a nova leva data-ativa');
  assert.match(ilha, /data-entrando=\{\(indice === troca\.ativa && troca\.anterior !== null\) \|\| undefined\}/, 'só a tela que entra numa troca anima (a primeira, no carregamento, nunca)');
  assert.match(ilha, /setTroca\(\{ ativa: proxima, anterior: ativaAgora\.current \}\);/, 'um estado só: nova e anterior mudam juntas');
  assert.match(ilha, /onAnimationEnd=\{\(evento\) => \{ if \(evento\.target === evento\.currentTarget && indice === troca\.ativa\) soltarAnterior\(\); \}\}/, 'a que saiu só é solta quando a nova terminou de entrar');
  assert.match(ilha, /imagem && imagem\.complete && imagem\.naturalWidth > 0/, 'só entra uma captura que já chegou');
  assert.match(ilha, /if \(!pronta\(proxima\)\) \{ agendar\(250\); return; \}/, 'rede lenta: a atual fica e a pergunta se repete (nunca uma tela vazia)');
  // Com movimento reduzido nada muda: só a proposta pronta, parada (o laço nem roda).
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n  \.cn-heroi__celular \.cn-tela \{ opacity: 0 !important; transition: none; \}\n  \.cn-heroi__celular \.cn-tela:nth-child\(2\) \{ opacity: 1 !important; \}/);
  assert.match(ilha, /!reduzido\.matches/);
  // O teste de navegador (Chromium e WebKit, a cada 50 ms, dois ciclos, soma mínima 0,95) mora em scripts/qa/heroi-troca.mjs.
  const roteiro = ler('scripts/qa/heroi-troca.mjs');
  assert.match(roteiro, /ciclos \* 3 \* 3500/);
  assert.match(roteiro, /setTimeout\(passo, 50\)/);
  assert.match(roteiro, /argumento\("minimo", "0\.95"\)/);
  assert.match(roteiro, /addInitScript/, 'a carga é amostrada desde o começo do documento (a primeira tela piscava na hidratação)');
  assert.match(roteiro, /cargaOk && abaixo\.length === 0/);
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
  assert.match(ler('src/app/globals.css'), /html\[data-pausado='true'\] \*/, 'a aba escondida pausa toda animação CSS do site');
});
