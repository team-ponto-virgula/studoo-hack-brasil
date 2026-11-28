// Página de apresentação, o que a página entrega: o HTML de servidor por aparelho (o mesmo que o navegador hidrata), a trilha das paradas, o QR,
// as imagens, as abas de instalar, as fichas e as regras de movimento do CSS. As ilhas de cliente rodam aqui só no desenho de servidor; o que
// elas fazem com o toque e com a rolagem (a fonte, a ponte, o retorno do Stu, os marcos) é conferido pelas contas que cada uma exporta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
const { textos, linhasDoTitulo } = await import('../src/app/conheca/textos.ts');
const { IDEIAS_DO_S3, fichaDaIdeia } = await import('../src/app/conheca/ideias.ts');
const { iconesDosTemas } = await import('../src/app/pedido.tsx');
const { mensagens } = await import('../src/mensagens/pt-BR.ts');
const { foraDoSafariNoIphone } = await import('../src/app/conheca/ilhas/folha-iphone.tsx');
const { CAPTURAS } = await import('../src/app/conheca/imagens.gerado.ts');
const { telasDoHeroi, escolherTelasDoHeroi, ALTS_DO_HEROI } = await import('../src/app/conheca/heroi.ts');
const { TAMANHOS } = await import('../src/app/conheca/celular.tsx');
const { STU_DA_PAGINA } = await import('../src/app/conheca/stu.gerado.ts');
const { paradaAtual, estadoDoMarco } = await import('../src/app/conheca/ilhas/trilha.tsx');
const { estadoDaPonte } = await import('../src/app/conheca/ilhas/ponte.tsx');
const { stuDoEnsino } = await import('../src/app/conheca/ilhas/ensinar.tsx');
const { regioesMundo, coresMundo } = await import('../src/ui/mundo-desenhos.ts');
const sharp = (await import('sharp')).default;

const ORIGEM = 'https://studoo.exemplo.test';
const base = { aparelho: 'computador', links: { apk: APK_PADRAO, testflight: null }, origem: ORIGEM, comSessao: false, visitante: true };
const desenhar = (extra = {}) => renderToStaticMarkup(createElement(PaginaVista, { ...base, ...extra, links: { ...base.links, ...(extra.links ?? {}) } }));
const texto = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const botoes = (html) => [...html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(([, tag, atributos, miolo]) => ({ tag, atributos, texto: texto(miolo).trim() }));
const achar = (html, rotulo) => botoes(html).filter((b) => b.texto === rotulo);

test('a página tem o título do alto, o subtítulo, um só h1 e as paradas na ordem, cada uma com o título, a linha e a fala do Stu', () => {
  const html = desenhar();
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(texto(html), new RegExp(textos.heroi.titulo.replace(/[.]/g, '\\.')));
  assert.ok(texto(html).includes(textos.heroi.subtitulo));
  assert.ok(texto(html).includes(textos.falaDoStu + textos.heroi.ola), 'o Stu se apresenta, e o leitor de tela ouve quem está falando');
  const h2 = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => texto(m[1]).trim());
  assert.deepEqual(h2, [...textos.paradas.map((parada) => parada.titulo), textos.s5.titulo], 'as cinco paradas e a chegada, nessa ordem');
  assert.deepEqual(textos.paradas.map((parada) => parada.id), ['material', 'ponte', 'ensinar', 'assuntos', 'baixar']);
  for (const parada of textos.paradas) {
    assert.ok(texto(html).includes(parada.linha), parada.id);
    assert.ok(texto(html).includes(textos.falaDoStu + parada.fala), `a fala do Stu em ${parada.id}`);
  }
  assert.match(texto(html), /Com uma conta, a sua trilha é a mesma no site e no app\./, 'a parada do app diz "com uma conta": o progresso do visitante fica só no aparelho dele');
});

test('o título contém uma única frase com quebra visual e espaço para o leitor de tela', () => {
  const html = desenhar({ aparelho: 'android' });
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)[1];
  assert.equal(h1, '<span class="cn-heroi__frase">Seu caderno</span> <span class="cn-heroi__frase">vira lição.</span>');
  assert.equal(texto(h1).trim(), textos.heroi.titulo);
  assert.deepEqual(linhasDoTitulo, ['Seu caderno', 'vira lição.']);
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

test('iPhone: sem link do TestFlight, "Usar no iPhone agora" abre a folha; com link, "Instalar no iPhone" leva ao TestFlight', () => {
  for (const aparelho of ['iphone']) {
    const sem = desenhar({ aparelho });
    const [usar] = achar(sem, 'Usar no iPhone agora');
    assert.ok(usar, aparelho);
    assert.equal(usar.tag, 'button');
    assert.match(usar.atributos, /aria-haspopup="dialog"/);
    assert.match(usar.atributos, /aria-label="Usar no iPhone agora, o Studoo na Tela de Início"/);
    assert.ok(texto(sem).includes('Adicione o Studoo pelo Safari para abrir pela Tela de Início.'));
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

test('iPad: o app nativo é só de iPhone, então o caminho é sempre a Tela de Início ("Usar no iPad agora"), com ou sem o TestFlight; o S4 abre na aba "iPad"', () => {
  for (const testflight of [null, 'https://testflight.apple.com/join/ABC123']) {
    const html = desenhar({ aparelho: 'ipad', links: { testflight } });
    const usar = achar(html, 'Usar no iPad agora');
    assert.ok(usar.length >= 1, String(testflight));
    for (const botao of usar) {
      assert.equal(botao.tag, 'button');
      assert.match(botao.atributos, /aria-haspopup="dialog"/);
      assert.match(botao.atributos, /aria-label="Usar no iPad agora, o Studoo na Tela de Início"/);
    }
    assert.ok(texto(html).includes(textos.acoes.ipad.apoio));
    assert.equal(achar(html, 'Instalar no iPhone').length, 0, 'nenhum caminho do TestFlight no iPad');
    assert.equal(achar(html, 'Usar no iPhone agora').length, 0);
    const [abrirApp] = achar(html, textos.folhaIphone.abrirApp);
    assert.equal(abrirApp.tag, 'a');
    assert.match(abrirApp.atributos, /href="https:\/\/app\.hellostudoo\.com\.br\/"/);
    const abas = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => texto(m[1]).trim());
    assert.deepEqual(abas, ['Android', 'iPad']);
    assert.doesNotMatch(html, /testflight\.apple\.com/);
  }
  const desktopPossivelIpad = desenhar({ podeSerIpad: true });
  assert.ok(desktopPossivelIpad.includes(`class="cn-apoio cn-reserva-ipad" aria-hidden="true">${textos.acoes.ipad.apoio}</p>`));
  assert.doesNotMatch(desenhar(), /cn-reserva-ipad/);
  assert.doesNotMatch(desenhar({ aparelho: 'ipad', podeSerIpad: true }), /cn-reserva-ipad/);
  assert.equal(textos.folhaIphone.tituloIpad, 'Use o Studoo no iPad hoje');
  assert.match(achar(desenhar({ aparelho: 'ipad', comSessao: true }), textos.folhaIphone.abrirApp)[0].atributos, /href="\/"/, 'abertura pela sessão do endereço atual');
  assert.match(achar(desenhar({ aparelho: 'ipad', dominioProprio: true }), textos.folhaIphone.abrirApp)[0].atributos, /href="https:\/\/app\.hellostudoo\.com\.br\/"/, 'instala pelo domínio do app');
  assert.match(ler('src/app/conheca/ilhas/folha-iphone.tsx'), /\{ipad \? t\.tituloIpad : t\.titulo\}/);
  assert.match(ler('apps/mobile/app.json'), /"supportsTablet": false/, 'se o app nativo passar a ter iPad, o caminho do iPad volta a seguir o do iPhone');
});

test('a trilha do cabeçalho é a navegação da página: as cinco paradas numa lista, cada nó levando à sua região, e cada região com o seu marco numerado', () => {
  const html = desenhar();
  const trilha = html.match(/<nav class="cn-trilha" aria-label="Paradas desta página">([\s\S]*?)<\/nav>/)[1];
  assert.match(trilha, /^<ol class="cn-trilha__lista">/);
  const links = [...trilha.matchAll(/<a href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], texto(m[2]).trim()]);
  assert.deepEqual(links, textos.paradas.map((parada) => [parada.id, parada.atalho]));
  assert.doesNotMatch(trilha, /aria-current/, 'no desenho do servidor ninguém está em parada nenhuma: a ilha marca conforme a rolagem');
  const marcos = [...html.matchAll(/<div class="cn-marco" data-marco="(\d)">[\s\S]*?<p class="cn-marco__rotulo">([\s\S]*?)<\/p>/g)].map((m) => [Number(m[1]), texto(m[2]).trim()]);
  assert.deepEqual(marcos, [...textos.paradas.map((parada, indice) => [indice + 1, `Parada ${indice + 1} de 5 ${parada.lugar}`]), [6, textos.s5.lugar]], 'a chegada não é uma parada numerada');
  // A conta da ilha: a parada da vez é a última cuja região já passou do meio da janela; as de trás viram ouro.
  assert.equal(paradaAtual([{ numero: 1, topo: 900 }, { numero: 2, topo: 1800 }], 800), 0, 'no alto da página, nenhuma');
  assert.equal(paradaAtual([{ numero: 1, topo: 390 }, { numero: 2, topo: 1200 }], 800), 1);
  assert.equal(paradaAtual([{ numero: 1, topo: -900 }, { numero: 2, topo: 100 }, { numero: 3, topo: 1000 }], 800), 2);
  assert.deepEqual([1, 2, 3].map((numero) => estadoDoMarco(numero, 2)), ['feito', 'atual', 'adiante']);
  const ilha = ler('src/app/conheca/ilhas/trilha.tsx');
  assert.match(ilha, /addEventListener\('scroll', pedir, \{ passive: true \}\)/, 'ouve a rolagem sem segurar a página');
  assert.match(ilha, /if \(!quadro\) quadro = window\.requestAnimationFrame\(medir\)/, 'uma medida por quadro');
  assert.match(ilha, /window\.cancelAnimationFrame\(quadro\)/, 'limpa ao sair');
  assert.doesNotMatch(ilha, /setInterval|setTimeout/, 'nada roda sozinho: a trilha só responde à rolagem');
});

test('fontes: cada família em duas partes complementares (o latim, pré-carregado e com menos de 60% do tamanho, e a fonte inteira para o resto), e o latim tem todos os caracteres especiais do texto do app', async () => {
  const { CARACTERES_ESPECIAIS_DO_TEXTO } = await import('@studoo/contratos');
  const css = ler('src/app/globals.css');
  const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => ({ familia: m[1].match(/font-family: ([^;]+);/)[1], arquivo: m[1].match(/url\('([^']+)'\)/)[1], faixa: m[1].match(/unicode-range: ([^;]+);/)?.[1] ?? '' }));
  const faixas = (txt) => txt.split(',').map((p) => p.trim().replace(/^U\+/, '').split('-').map((h) => parseInt(h, 16))).map(([a, b = a]) => [a, b]);
  const cobre = (lista, c) => lista.some(([a, b]) => c >= a && c <= b);
  for (const [familia, nome] of [['Quicksand', 'quicksand-wght'], ['Nunito', 'nunito-wght']]) {
    const daFamilia = faces.filter((f) => f.familia === familia);
    assert.deepEqual(daFamilia.map((f) => f.arquivo), [`/marca/${nome}.woff2`, `/marca/${nome}-latim.woff2`], 'a inteira primeiro e o latim por último (o navegador tenta primeiro a última declarada)');
    const [inteira, latim] = daFamilia.map((f) => faixas(f.faixa));
    const todas = [...inteira, ...latim].sort((x, y) => x[0] - y[0]);
    let proximo = 0;
    for (const [a, b] of todas) { assert.equal(a, proximo, `${familia}: sem buraco nem sobreposição em U+${a.toString(16)}`); proximo = b + 1; }
    assert.equal(proximo, 0x110000, 'as duas partes cobrem todos os pontos de código');
    for (const ch of CARACTERES_ESPECIAIS_DO_TEXTO + 'Seu assunto. Sua trilha. “—…”ÁÉÍÓÚÂÊÔÃÕÇàáâãéêíóôõúüç→') assert.ok(cobre(latim, ch.codePointAt(0)), `${ch} no latim`);
    const inteiraBytes = statSync(join(raiz, 'public/marca', `${nome}.woff2`)).size;
    const latimBytes = statSync(join(raiz, 'public/marca', `${nome}-latim.woff2`)).size;
    assert.ok(latimBytes < inteiraBytes * 0.6, `${nome}: ${latimBytes} de ${inteiraBytes} bytes`);
  }
  const layout = ler('src/app/layout.tsx');
  assert.match(layout, /href="\/marca\/nunito-wght-latim\.woff2"/);
  assert.match(layout, /href="\/marca\/quicksand-wght-latim\.woff2"/);
  assert.doesNotMatch(layout, /href="\/marca\/(nunito|quicksand)-wght\.woff2"/, 'a fonte inteira não é pré-carregada');
});

test('as regiões vêm na ordem da trilha, cada uma com o chão e o relevo do mapa do app, e o convite do alto leva à primeira parada', () => {
  const html = desenhar();
  const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map(([, id]) => id);
  assert.deepEqual(ids, ['conteudo', ...textos.paradas.map((parada) => parada.id)]);
  for (const parada of textos.paradas) {
    const regiao = regioesMundo.find((r) => r.id === parada.regiao);
    assert.ok(regiao, `${parada.regiao} é uma região do mapa do app`);
    const abertura = html.match(new RegExp(`<section id="${parada.id}" class="cn-regiao cn-regiao--${parada.regiao}"[^>]*>`));
    assert.ok(abertura, parada.id);
    assert.ok(abertura[0].includes(`--chao:${coresMundo[regiao.chao]}`) && abertura[0].includes(`--relevo:${coresMundo[regiao.relevo]}`), `${parada.id}: as cores vêm de mundo-desenhos.ts`);
  }
  assert.equal(new Set(textos.paradas.map((parada) => parada.regiao)).size, textos.paradas.length, 'cada parada numa região diferente');
  // Os desenhos do mundo não dependem da folha do mundo para ter tamanho: no build de produção ela pode chegar depois da folha da página (ou num pedaço à parte).
  const css = ler('src/app/conheca/conheca.css');
  const regraDoMundo = ler('src/ui/mundo.css').match(/\.mundo-desenho \{ ([^}]*) \}/)[1];
  assert.ok(css.includes(`.cn-pagina .mundo-desenho { ${regraDoMundo} }`), 'a página repete a regra de tamanho dos desenhos, com a mesma conta de mundo.css');
  assert.ok(css.indexOf('.cn-pagina .mundo-desenho {') < css.indexOf('.cn-cabecalho {'), 'e no alto da folha, antes das regras de cada lugar');
  assert.match(html, /<a class="cn-comecar" href="#material">/);
  assert.match(html, /<section class="cn-chegada" data-parada="6" aria-labelledby="cn-titulo-chegada"/);
  // As ondas das fronteiras são as do mapa do app (a mesma forma, com o relevo atrás e o chão na frente).
  assert.equal((html.match(/<svg class="cn-onda"/g) ?? []).length, textos.paradas.length + 1);
  const onda = ler('src/app/conheca/cenario.tsx');
  const mundo = ler('src/ui/mundo.tsx');
  for (const caminho of ['M0 22C36 6 70 4 104 14S170 36 212 22 290 2 332 12 380 26 400 18V48H0Z', 'M0 32C40 16 76 14 110 24S176 44 218 30 296 10 338 20 384 34 400 28V48H0Z']) {
    assert.ok(onda.includes(caminho) && mundo.includes(caminho), 'a onda da página é a da fronteira do mapa');
  }
});

test('a anotação, a lição com a fonte e a questão chegam no HTML, inclusive sem conta ou com o visitante desligado', () => {
  for (const visitante of [true, false]) {
    const html = desenhar({ visitante });
    const material = html.match(/<section id="material"[\s\S]*?<\/section>/)[0];
    assert.match(material, /<figcaption>Anotação de exemplo<\/figcaption>/);
    assert.match(material, /<mark class="cn-marca" id="cn-trecho-1">O número de baixo conta todas as partes iguais\.<\/mark>/);
    assert.match(material, /<button type="button" class="cn-citar" aria-expanded="false" aria-controls="cn-fonte-1">/);
    assert.match(material, /<div class="cn-fonte" id="cn-fonte-1" hidden="">/, 'a fonte abre quando a pessoa toca no [1]');
    assert.ok(texto(material).includes('“O número de baixo conta todas as partes iguais.”'), 'a fonte cita a frase da anotação');
    assert.ok(texto(material).includes(textos.material.licao.legenda), 'a lição é um exemplo, e a página diz');
    const ponte = html.match(/<section id="ponte"[\s\S]*?<\/section>/)[0];
    assert.match(ponte, /role="img" aria-label="Retângulo dividido em oito partes iguais\. Três estão pintadas com listras\."/);
    assert.equal((ponte.match(/data-pintada=/g) ?? []).length, 3);
    assert.deepEqual(botoes(ponte).filter((b) => b.tag === 'button').map((b) => b.texto), ['3/5', '3/8', '5/8']);
    assert.match(ponte, /<noscript><details><summary>Ver a resposta/);
    assert.match(ponte, /role="status" aria-atomic="true"/);
    assert.match(ponte, /<div class="cn-lago" aria-hidden="true">/, 'o lago é só o desenho do que o cartão diz');
    assert.doesNotMatch(ponte, /cn-tabuas/, 'a ponte só aparece depois do erro (ou a pedido de quem acertou de primeira)');
    assert.match(html, /<label for="cn-assunto-campo"/);
    assert.ok(html.includes(visitante ? 'Continuar' : 'Continuar no login'));
  }
  assert.deepEqual([estadoDaPonte(false, false), estadoDaPonte(true, false), estadoDaPonte(true, true), estadoDaPonte(false, true)], ['vazia', 'montada', 'atravessada', 'vazia']);
  assert.equal(textos.ponte.respostas.filter((resposta) => resposta.fracao === textos.ponte.certa).length, 1, 'uma resposta certa só');
  assert.equal(textos.ponte.passos.length, 3, 'a ponte tem três tábuas, como no app');
});

test('computador: nenhum botão baixa o arquivo; "Experimentar sem conta" é o principal e o QR está na seção de instalação', () => {
  const html = desenhar();
  assert.equal(achar(html, 'Baixar para Android').length, 0, 'nenhum botão principal baixa o APK no computador');
  const principais = botoes(html).filter((b) => /botao--primario/.test(b.atributos));
  assert.ok(principais.length >= 2, 'o herói e a chamada final');
  for (const botao of principais) assert.doesNotMatch(botao.atributos, /\.apk|href="https:\/\/expo\.dev/, 'nenhum botão principal leva ao arquivo');
  assert.equal(principais.filter((b) => b.texto === 'Experimentar sem conta').length >= 2, true);
  const heroi = html.match(/<section id="conteudo"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(heroi, /cn-qr__codigo/);
  assert.ok(heroi.includes('href="#baixar"'));
  assert.match(html, /role="group" aria-labelledby="cn-qr-s4-titulo"/);
  assert.doesNotMatch(html, /<section[^>]*cn-qr/, 'sem região duplicada');
  assert.doesNotMatch(html, /<h2[^>]*cn-qr__titulo/);
  assert.ok(texto(html).includes('Instale no celular'));
  assert.ok(texto(html).includes('Aponte a câmera do celular'));
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
  assert.match(ilha, /if \(!comSessao && ativo\) await entrarComoVisitante\(\)/, 'quem tem sessão não troca o cookie por um de visitante');
  assert.ok(!/studoo:ideia-inicial/.test(ilha), 'sem a chave antiga, que ninguém lia');
});

test('o link "Pular para o conteúdo" é o primeiro da página e leva ao herói (S1)', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.ok(html.indexOf('class="pular"') < html.indexOf('<header'));
  assert.match(html, /<a class="pular" href="#conteudo">Pular para o conteúdo<\/a>/);
  assert.match(html, /<section id="conteudo" class="cn-heroi"/);
});

test('no domínio próprio a entrada e o assunto vão ao app, inclusive com acentos e símbolos', async () => {
  const html = desenhar({ origem: 'https://hellostudoo.com.br', dominioProprio: true });
  assert.ok(html.includes('href="https://app.hellostudoo.com.br/login"'));
  const { enderecoParaExperimentar, lerContinuacao } = await import('../src/app/conheca/continuacao.ts');
  const ideia = 'Frações, 100% & razões #2';
  const destino = new URL(enderecoParaExperimentar(ideia));
  assert.equal(destino.origin, 'https://app.hellostudoo.com.br');
  assert.equal(destino.pathname, '/conheca/continuar');
  assert.equal(destino.search, '');
  assert.deepEqual(lerContinuacao(destino.hash), { ideia });
  assert.deepEqual(lerContinuacao(new URL(enderecoParaExperimentar()).hash), { ideia: undefined });
  assert.equal(lerContinuacao('#assunto=irrelevante'), null);
});

test('as imagens: largura e altura declaradas, só do site, o Stu do alto com prioridade, as telas do app só perto da tela, e nunca o stu-oi', async () => {
  const html = desenhar({ aparelho: 'android' });
  const imagens = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imagens.length >= 12);
  for (const img of imagens) {
    assert.match(img, /\bwidth="\d+"/, img.slice(0, 80));
    assert.match(img, /\bheight="\d+"/, img.slice(0, 80));
    const origens = [...img.matchAll(/(?:src|srcSet|data-src|data-srcset)="([^"]+)"/g)].flatMap((m) => m[1].replace(/^data:image\/gif;base64,[A-Za-z0-9+/=]+$/, '').split(',').map((p) => p.trim().split(' ')[0])).filter(Boolean);
    for (const origem of origens) assert.match(origem, /^\/(landing|marca)\//, `só do próprio site: ${origem}`);
  }
  assert.doesNotMatch(html, /stu-oi/, 'o Stu "oi" fica de fora');
  // A maior imagem da primeira dobra é o Stu do alto: é a única com prioridade alta.
  const alta = imagens.filter((img) => /fetchPriority="high"|fetchpriority="high"/i.test(img));
  assert.equal(alta.length, 1, 'só uma imagem com prioridade alta');
  const acolhida = STU_DA_PAGINA['stu-acolhida'];
  assert.ok(alta[0].includes(`src="${acolhida.fontes[0].src}"`), 'e é o Stu do alto');
  for (const fonte of acolhida.fontes) assert.ok(alta[0].includes(`${fonte.src} ${fonte.largura}w`), `${fonte.largura}w no srcSet`);
  assert.match(alta[0], /loading="eager"/);
  assert.doesNotMatch(html, /fetchPriority="low"/);
  // Os outros Stus grandes da página só entram perto da tela, e todos são decorativos (o texto ao lado diz tudo).
  const stus = imagens.filter((img) => /\/landing\/stu-/.test(img));
  assert.ok(stus.length >= 9);
  for (const img of stus) {
    assert.match(img, /\balt=""/, 'decorativo');
    if (img !== alta[0]) assert.match(img, /loading="lazy"/);
  }
  // Os arquivos do Stu da página existem, têm a largura declarada e a mesma proporção, e nenhum passa de 90 KB.
  for (const [nome, stu] of Object.entries(STU_DA_PAGINA)) {
    for (const fonte of stu.fontes) {
      const dados = readFileSync(join(raiz, 'public', fonte.src));
      assert.ok(dados.length <= 90 * 1024, `${nome} ${fonte.largura}w: ${dados.length} bytes`);
      const meta = await sharp(dados).metadata();
      assert.equal(meta.width, fonte.largura, fonte.src);
      assert.ok(Math.abs(meta.height / meta.width - stu.altura / stu.largura) < 0.01, `${nome} ${fonte.largura}w: ${meta.width}x${meta.height}`);
    }
  }
  // As seis capturas do app e do site (as três das paradas, a trilha pronta, o mapa e a janela) NÃO são buscadas na carga: pixel transparente no src e o endereço de verdade em
  // data-src/data-srcset (a ilha `CarregarPerto` os passa para os atributos de verdade quando a página já carregou e a captura chega perto da tela); sem JavaScript, o <noscript> traz a de verdade.
  const adiadas = imagens.filter((img) => /\bdata-srcset=/.test(img));
  assert.equal(adiadas.length, 6, 'material, ponte, ensinar, trilha pronta, mapa e janela');
  for (const img of adiadas) {
    assert.match(img, /\bsrc="data:image\/gif;base64,[^"]+"/, 'o src é um pixel transparente (nada a baixar)');
    assert.doesNotMatch(img, /\bloading=|fetchPriority/, 'sem loading nem prioridade: o navegador decide quando a imagem de verdade entrar');
    assert.match(img, /\bdata-src="\/landing\/[^"]+\.webp"/);
  }
  assert.equal([...html.matchAll(/<picture data-carregar-perto="">/g)].length, 6);
  const semScript = [...html.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)].map((m) => m[1]).filter((miolo) => miolo.includes('/landing/'));
  assert.equal(semScript.length, 6, 'cada captura adiada tem o seu <noscript>');
  for (const miolo of semScript) assert.match(miolo, /<picture><source type="image\/avif" srcSet="[^"]+" sizes="[^"]+"\/><img [^>]*src="\/landing\/[^"]+\.webp" srcSet="[^"]+"/);
  // Os dois SVG que não são do alto da página (o ícone da aba da janela e o logo do rodapé) não são buscados na carga.
  for (const svg of ['/marca/icone.svg', '/marca/logo-com-sorriso.svg']) {
    const achada = imagens.find((img) => img.includes(`src="${svg}"`));
    assert.ok(achada, svg);
    assert.match(achada, /loading="lazy"/, `${svg}: preguiçoso`);
  }
  // Nenhuma captura passa de 120 KB em 2x.
  for (const id of Object.keys(CAPTURAS)) {
    const bytes = readFileSync(join(raiz, 'public', CAPTURAS[id].src2x)).length;
    assert.ok(bytes <= 120 * 1024, `${id}: ${bytes} bytes`);
  }
  // O roteiro que gera o Stu da página usa o recorte e a qualidade do kit, sem mexer no kit nem no catálogo do contrato.
  const roteiro = ler('scripts/otimizar-stu-landing.mjs');
  assert.match(roteiro, /assets\/mascote\/tabela\.json/);
  assert.match(roteiro, /\.webp\(\{ \.\.\.tabela\.web\.webp, effort: 6 \}\)/);
  assert.doesNotMatch(roteiro, /catalogo-mascote|public\/marca/, 'o kit do produto fica como está');
});

test('a ilha que busca as capturas perto da tela: só depois da carga, a uns 700 px da tela, trocando os data- pelos atributos (e pelo <source> do AVIF)', () => {
  const ilha = ler('src/app/conheca/ilhas/carregar-perto.tsx');
  assert.match(ilha, /const MARGEM = '700px 0px';/);
  assert.match(ilha, /document\.readyState === 'complete'/, 'espera a página carregar');
  assert.match(ilha, /addEventListener\('load', depoisDaCarga, \{ once: true \}\)/);
  assert.match(ilha, /const ESPERA_DEPOIS_DA_CARGA_MS = 300;/);
  assert.match(ilha, /source\[data-srcset\]/, 'o <source> do AVIF também');
  assert.match(ilha, /imagem\.srcset = imagem\.dataset\.srcset/);
  assert.match(ilha, /imagem\.src = imagem\.dataset\.src/);
  assert.match(ilha, /new IntersectionObserver/);
  assert.match(ilha, /observador\?\.unobserve\(entrada\.target\)/, 'cada uma é buscada uma vez só');
  assert.match(ilha, /return \(\) => \{[\s\S]*observador\?\.disconnect\(\)/, 'limpa ao sair');
  assert.match(ler('src/app/conheca/pagina.tsx'), /<Revelar \/>\n      <CarregarPerto \/>/);
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /@media \(scripting: none\) \{ \.cn-celular__tela picture\[data-carregar-perto\], \.cn-janela__tela picture\[data-carregar-perto\] \{ display: none; \} \}/, 'sem JavaScript o pixel some e o <noscript> traz a captura');
  assert.match(css, /\.cn-captura \{ display: block; width: 100%; height: 100%; object-fit: contain; \}\n\.cn-captura\[hidden\] \{ display: none; \}/);
});

test('as capturas chegam em AVIF em três larguras, com o sizes de cada lugar e o WebP de reserva, e nenhuma é esticada: a altura segue a proporção da própria captura', async () => {
  const html = desenhar({ aparelho: 'android' });
  // Cada lugar com o seu sizes (a largura da TELA do celular em cada faixa, sem as bordas): as telas das paradas, o celular do composto e a janela.
  assert.deepEqual(Object.keys(TAMANHOS), ['momento', 'celularDoComposto', 'janela']);
  const ocorrencias = (sizes) => [...html.matchAll(/<source type="image\/avif" srcSet="[^"]*" sizes="([^"]*)"\/>/g)].filter((m) => m[1] === sizes).length;
  assert.equal(ocorrencias(TAMANHOS.momento), 4, 'material, ponte, ensinar e a trilha pronta');
  assert.equal(ocorrencias(TAMANHOS.celularDoComposto), 1, 'o celular ao lado da janela');
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
  // A captura nativa e seu PDF de origem estão acessíveis sem recortar nem esticar a imagem.
  const m1 = CAPTURAS['momento-1'];
  assert.ok(Math.abs(m1.altura / m1.largura - 1560 / 720) / (1560 / 720) < 0.002, `momento 1: ${m1.largura}x${m1.altura}`);
  assert.ok(desenhar().includes('href="/landing/regra-dos-tercos.pdf"'));
  assert.equal(readFileSync(join(raiz, 'public/landing/regra-dos-tercos.pdf')).subarray(0, 5).toString(), '%PDF-');
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-captura \{ display: block; width: 100%; height: 100%; object-fit: contain; \}/, 'a captura é encaixada inteira, nunca esticada');
  assert.doesNotMatch(css, /object-fit: (fill|cover)/);
  assert.match(css, /\.cn-celular__tela picture, \.cn-janela__tela picture \{ display: contents; \}/);
  // O roteiro que gera as imagens: a largura manda e a altura acompanha (nada de esticar para a proporção da plataforma).
  const roteiro = ler('scripts/otimizar-capturas-landing.mjs');
  assert.match(roteiro, /const alturaPara = \(largura\) => Math\.round\(largura \* proporcao\);/);
  assert.doesNotMatch(roteiro, /Math\.round\(largura \/ razao\)/, 'a altura não vem mais da proporção da plataforma');
});

test('a parada do app: o site numa janela de navegador desenhada pelo Studoo (captura real da web) ao lado do app, e nenhuma prévia web dentro de moldura de celular', () => {
  const html = desenhar({ aparelho: 'android' });
  const regiao = (id) => html.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`))[0];
  for (const parada of textos.paradas.filter((p) => p.id !== 'baixar')) assert.doesNotMatch(regiao(parada.id), /cn-composto|cn-janela/, `só a parada do app tem a janela (${parada.id})`);
  const baixar = regiao('baixar');
  assert.match(baixar, /<div class="cn-composto"><div class="cn-janela">/);
  const janela = baixar.match(/<div class="cn-janela">[\s\S]*?<div class="cn-janela__tela">([\s\S]*?)<\/div><\/div>/);
  assert.ok(janela, 'a janela e a tela dela');
  assert.ok(janela[1].includes(CAPTURAS['janela-4'].src1x) && janela[1].includes(CAPTURAS['janela-4'].src2x), 'a captura da web, em 1x e 2x (WebP de reserva)');
  assert.ok(CAPTURAS['janela-4'].avif.every((a) => janela[1].includes(a.src)), 'e em AVIF, nas três larguras');
  assert.ok(janela[1].includes(`alt="${textos.sincronia.janelaAlt}"`));
  assert.equal(CAPTURAS['janela-4'].plataforma, 'web');
  assert.match(janela[1], /<picture data-carregar-perto="">/, 'a captura da web só é buscada perto da tela');
  // A barra é só desenho (escondida do leitor de tela) e não inventa endereço: tem a aba "Studoo" e nada com cara de URL.
  const barra = baixar.match(/<div class="cn-janela__barra" aria-hidden="true">([\s\S]*?)<\/div>/)[1];
  assert.ok(texto(barra).includes('Studoo'));
  assert.doesNotMatch(texto(barra), /https?:|www\.|\.com|\.app|\.br|sslip/i);
  // A captura da web nunca está dentro de uma moldura de celular, e a do app nunca dentro da janela.
  const celulares = [...html.matchAll(/<div class="cn-celular[^"]*"[\s\S]*?<\/div><\/div>/g)].map((m) => m[0]);
  assert.equal(celulares.length, 5, 'material, ponte, ensinar, trilha pronta e o mapa');
  for (const celular of celulares) assert.ok(!celular.includes('janela-4-'), 'a web fora do celular');
  assert.ok(!janela[1].includes(CAPTURAS['momento-4'].src1x), 'o app fora da janela');
  assert.match(ler('src/app/conheca/cenario.tsx'), /if \(captura\.plataforma === 'web'\) throw new Error/, 'a tela "no app" de uma parada recusa captura da web');
  // O selo "Progresso salvo agora" fica no composto e o celular dele (o do app) mostra o mapa.
  assert.match(baixar, /<p class="cn-selo-sincronia">[\s\S]*Progresso salvo agora<\/p>/);
  assert.ok(baixar.includes(CAPTURAS['momento-4'].src1x));
  assert.match(texto(baixar), /Com uma conta, a sua trilha é a mesma no site e no app\./);
});

test('contraste: o texto passa de 4,5:1 sobre o céu do alto, sobre o chão e o relevo de cada região e na chegada', () => {
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-pagina \.cn-entrar:not\(\.cn-entrar--abrir\), \.cn-pagina \.cn-visitante-texto, \.cn-pagina \.cn-instalar-celular \{ color: var\(--acao-escura\); \}/);
  assert.match(ler('src/app/globals.css'), /--acao-escura: #1d4ed8;/);
  const canais = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luz = (hex) => { const [r, g, b] = canais(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const razao = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  /** A cor que se vê com `cima` a `opacidade` sobre `baixo` (as manchas do relevo ficam a 55% sobre o chão). */
  const mistura = (cima, baixo, opacidade) => '#' + canais(cima).map((c, i) => Math.round(c * opacidade + canais(baixo)[i] * (1 - opacidade)).toString(16).padStart(2, '0')).join('');
  const tinta = css.match(/--cn-tinta: (#[0-9a-f]{6});/)[1];
  const marinho = css.match(/--cn-marinho: (#[0-9a-f]{6});/)[1];
  const azulEscuro = '#1d4ed8';
  // O céu do alto: o cabeçalho, o título, o subtítulo e os botões de texto ficam sobre ele.
  const ceu = [...css.match(/\.cn-heroi \{[\s\S]*?background: linear-gradient\(180deg, ([^)]*)\)/)[1].matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]);
  assert.equal(ceu.length, 4);
  for (const fundo of ceu) {
    for (const cor of [azulEscuro, tinta, marinho, '#47557a']) assert.ok(razao(cor, fundo) >= 4.5, `${cor} sobre o céu ${fundo}: ${razao(cor, fundo).toFixed(2)}`);
  }
  assert.ok(razao('#2563ff', ceu[0]) < 4.5, 'e é por isso que o azul da ação não serve de texto ali');
  // Cada região: o texto fica sobre o chão e, às vezes, sobre uma mancha do relevo (a 55%).
  assert.match(css, /\.cn-regiao__enfeites::before, \.cn-regiao__enfeites::after \{[^}]*background: var\(--relevo\); opacity: 0\.55; \}/);
  for (const parada of textos.paradas) {
    const regiao = regioesMundo.find((r) => r.id === parada.regiao);
    for (const fundo of [coresMundo[regiao.chao].toLowerCase(), mistura(coresMundo[regiao.relevo].toLowerCase(), coresMundo[regiao.chao].toLowerCase(), 0.55)]) {
      for (const cor of [azulEscuro, tinta, marinho]) assert.ok(razao(cor, fundo) >= 4.5, `${parada.id}: ${cor} sobre ${fundo}: ${razao(cor, fundo).toFixed(2)}`);
    }
  }
  // Os cartões e os avisos de dentro deles.
  for (const [cor, fundo, onde] of [['#ffffff', '#2563ff', 'botão principal'], ['#ffffff', css.match(/--cn-madeira: (#[0-9a-f]{6});/)[1], 'número da tábua'], ['#5a3f0c', '#fff6de', 'pista'], ['#1c4c33', '#e6f6eb', 'acerto'],
    ['#6b4424', '#fff9f1', 'título da ponte'], ['#505b78', '#ffffff', 'legenda'], ['#6d28d9', '#eef3ff', 'rótulo da explicação'], ['#ffffff', '#0d1f6b', 'chegada'], ['#d9e2ff', '#0a1750', 'rodapé'], ['#3d2900', '#ffd666', 'marco da chegada']]) {
    assert.ok(razao(cor, fundo) >= 4.5, `${onde}: ${cor} sobre ${fundo}: ${razao(cor, fundo).toFixed(2)}`);
  }
});

test('cada tela do app pode ser ampliada, e a parada do app também mostra o site', () => {
  const html = desenhar();
  const regiao = (id) => html.match(new RegExp(`<section id="${id}"[\\s\\S]*?</section>`))[0];
  const esperadas = { material: CAPTURAS['momento-1'], ponte: CAPTURAS['momento-2'], ensinar: CAPTURAS['momento-3'], assuntos: telasDoHeroi('computador')[1].captura, baixar: CAPTURAS['momento-4'] };
  for (const [id, captura] of Object.entries(esperadas)) {
    const app = achar(regiao(id), 'Ampliar tela do app');
    assert.equal(app.length, 1, id);
    assert.ok(app[0].atributos.includes(`href="${captura.src2x}"`), id);
    assert.ok(app[0].atributos.includes('aria-haspopup="dialog"'));
    const site = achar(regiao(id), 'Ampliar tela do site');
    assert.equal(site.length, id === 'baixar' ? 1 : 0, id);
    if (id === 'baixar') assert.ok(site[0].atributos.includes(`href="${CAPTURAS['janela-4'].src2x}"`));
  }
  assert.match(html, /<dialog class="cn-visor"><\/dialog>/, 'a imagem grande só é carregada ao abrir a captura');
});

test('as demonstrações usam controles nativos, dizem que são exemplo e, sem JavaScript, a página ainda mostra a fonte e a resposta', () => {
  const html = desenhar();
  const ensinar = html.match(/<section id="ensinar"[\s\S]*?<\/section>/)[0];
  assert.match(ensinar, /<fieldset class="cn-explicacoes"><legend>Escolha uma explicação de exemplo<\/legend>/);
  const opcoes = [...ensinar.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(([opcao]) => opcao);
  assert.equal(opcoes.length, textos.ensinar.explicacoes.length);
  for (const opcao of opcoes) {
    assert.ok(opcao.includes('name="cn-explicacao"'), 'um grupo só: toque e setas do teclado');
    assert.doesNotMatch(opcao, /checked=""/, 'nenhuma vem escolhida: o retorno é de quem escolhe');
  }
  for (const explicacao of textos.ensinar.explicacoes) assert.ok(texto(ensinar).includes(explicacao.texto));
  assert.ok(texto(ensinar).includes(textos.ensinar.vazio));
  assert.ok(texto(ensinar).includes(textos.ensinar.aviso), 'o retorno é de exemplo, e a página diz');
  assert.doesNotMatch(ensinar, /cn-retorno-stu__bloco/, 'o retorno só aparece depois da escolha');
  // A expressão do Stu em cada fase, como no "Ensine ao Stu" do app.
  assert.deepEqual([stuDoEnsino('vazio', false), stuDoEnsino('ouvindo', true), stuDoEnsino('retorno', false), stuDoEnsino('retorno', true)], ['stu-curioso', 'stu-concentrado', 'stu-animado', 'stu-encorajador']);
  assert.match(ler('src/app/conheca/ilhas/ensinar.tsx'), /prefers-reduced-motion: reduce\)'\)\.matches\) \{ setFase\('retorno'\); return; \}/, 'com movimento reduzido, o retorno vem sem a pausa do "ouvindo"');
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /@media \(scripting: none\) \{ \.cn-fonte\[hidden\] \{ display: block; \} \.cn-citar \{ display: none; \} \}/, 'sem JavaScript a fonte já vem aberta');
  assert.match(css, /@media \(scripting: none\) \{ \.cn-respostas, \.cn-retorno, \.cn-assunto, \.cn-explicacoes, \.cn-retorno-stu \{ display: none; \} \}/, 'e o que depende de toque sai (a resposta fica no <noscript>)');
  assert.match(css, /\.cn-explicacao input:focus-visible \+ \.cn-explicacao__cartao \{ outline: 3px solid var\(--acao\); outline-offset: 3px; \}/);
});

test('as telas do app seguem a plataforma do aparelho: Android vê a trilha pronta do Android, os outros a do iPhone, e sem as da rodada limpa vale o conjunto provisório', () => {
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
  // A página usa a segunda (a trilha pronta), na parada dos assuntos, e só ela.
  for (const aparelho of ['android', 'iphone']) {
    const html = desenhar({ aparelho });
    const [primeira, trilha, terceira] = telasDoHeroi(aparelho).map((t) => t.captura);
    const assuntos = html.match(/<section id="assuntos"[\s\S]*?<\/section>/)[0];
    assert.ok(assuntos.includes(trilha.src1x), `${aparelho}: ${trilha.src1x}`);
    assert.ok(!html.includes(primeira.src1x) && !html.includes(terceira.src1x), `${aparelho}: só a trilha pronta`);
  }
});

test('cada tela do app tem a sua descrição, e nada é anunciado sozinho', () => {
  const html = desenhar({ aparelho: 'android' });
  for (const alt of [textos.material.noApp.alt, textos.ponte.noApp.alt, textos.ensinar.noApp.alt, textos.assuntos.noApp.alt, textos.sincronia.celularAlt, textos.sincronia.janelaAlt]) assert.ok(html.includes(`alt="${alt}"`), alt);
  assert.doesNotMatch(html, /aria-live/);
  assert.equal((html.match(/role="status"/g) ?? []).length, 2, 'só o retorno da questão e o retorno do Stu: os dois respondem a um toque da pessoa');
  // O cenário é desenho: fica fora do leitor de tela.
  for (const classe of ['cn-heroi__ceu', 'cn-heroi__chao', 'cn-regiao__enfeites', 'cn-chegada__ceu', 'cn-entradas']) assert.match(html, new RegExp(`class="${classe}" aria-hidden="true"`), classe);
});

test('as molduras seguem a plataforma da captura: ilha no iPhone, ponto de câmera no Android, e nenhum relógio desenhado', () => {
  const html = desenhar({ aparelho: 'android' });
  const plataformas = [...html.matchAll(/class="cn-celular[^"]*" data-plataforma="(iphone|android)"/g)].map((m) => m[1]);
  assert.ok(plataformas.includes('iphone') && plataformas.includes('android'));
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-celular\[data-plataforma='android'\] \.cn-celular__ilha \{ top: 4px; width: 7px; height: 7px; border-radius: 50%; \}/);
  assert.match(css, /border: 7px solid var\(--cn-marinho\); border-radius: 32px;/);
  assert.doesNotMatch(ler('src/app/conheca/celular.tsx'), /\d\d:\d\d|relogio|hora/i, 'o relógio que aparece é o da captura');
});

test('S3: as seis ideias da tela inicial estão UMA vez no código, em grade que quebra linha com todas à vista, com o ícone da área de origem e sem fileira em laço', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.deepEqual([...IDEIAS_DO_S3], [...mensagens.pedido.temas[0].exemplos], 'as mesmas seis, na ordem do app');
  for (const ideia of IDEIAS_DO_S3) {
    const [ficha] = achar(html, fichaDaIdeia(ideia).nome);
    assert.ok(ficha.atributos.includes(`aria-label="${ideia}"`), ideia);
  }
  for (const ideia of IDEIAS_DO_S3) {
    const origem = mensagens.pedido.temas.find((tema) => tema.id !== 'populares' && tema.exemplos.includes(ideia));
    assert.equal(fichaDaIdeia(ideia).icone, iconesDosTemas[origem?.id ?? 'populares'], `ícone de "${ideia}"`);
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
  assert.match(css, /\.cn-fichas__lista \{ display: grid; grid-template-columns: repeat\(3,/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test('as fichas dos assuntos entram uma a uma, uma vez (300 ms cada, 60 ms entre elas, subindo 8 px), só com movimento permitido; sem movimento, todas à vista', () => {
  const css = ler('src/app/conheca/conheca.css');
  const abertura = css.indexOf('/* Parada 4: as seis fichas entram uma a uma');
  assert.ok(abertura > css.indexOf('@media (prefers-reduced-motion: no-preference) {'), 'a entrada das fichas vive dentro do bloco com movimento permitido');
  const bloco = css.slice(abertura, css.indexOf('@media (hover: hover)', abertura));
  assert.match(bloco, /\.cn-ficha-item \{ transition: opacity 300ms ease-out, transform 300ms ease-out; \}/);
  const atrasos = [...bloco.matchAll(/\.cn-ficha-item:nth-child\((\d)\) \{ transition-delay: (\d+)ms; \}/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(atrasos, [[2, 60], [3, 120], [4, 180], [5, 240], [6, 300]], '60 ms entre uma e outra');
  assert.match(bloco, /\[data-revelar-itens\]\[data-oculto\]:not\(\[data-revelado\]\) > \.cn-ficha-item \{ opacity: 0; transform: translateY\(8px\); \}/);
  // A ilha que revela cuida das duas marcas, e a região inteira não tem entrada própria (só os blocos de dentro dela).
  assert.match(ler('src/app/conheca/ilhas/revelar.tsx'), /querySelectorAll<HTMLElement>\('\[data-revelar\], \[data-revelar-itens\]'\)/);
  const html = desenhar({ aparelho: 'android' });
  assert.doesNotMatch(html, /<section id="[^"]+" class="cn-regiao[^>]*data-revelar/);
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
  // No computador (com o cartão do QR ao lado) os passos falam do celular; no celular, são os de sempre (com o botão "Baixar para Android").
  for (const passo of textos.s4.android.passosNoComputador) assert.ok(texto(html).includes(passo), `computador: ${passo}`);
  const painelAndroid = html.match(/<div role="tabpanel" id="cn-painel-android"[\s\S]*?<\/ol>/)[0];
  assert.doesNotMatch(texto(painelAndroid), /Toque em “Baixar para Android”/, 'o botão "Baixar para Android" não existe no computador: o passo não o cita');
  const noAndroid = desenhar({ aparelho: 'android' });
  for (const passo of textos.s4.android.passos) assert.ok(texto(noAndroid).includes(passo), `celular: ${passo}`);
  assert.doesNotMatch(texto(noAndroid), /código ao lado/, 'no celular não há código ao lado');
  const semLink = desenhar({ aparelho: 'iphone' });
  for (const passo of textos.folhaIphone.passos) assert.ok(texto(semLink).includes(passo), `iPhone sem TestFlight: ${passo}`);
  const comLink = desenhar({ aparelho: 'iphone', links: { testflight: 'https://testflight.apple.com/join/ABC123' } });
  for (const passo of textos.s4.iphone.testflightPassos) assert.ok(texto(comLink).includes(passo), `iPhone com TestFlight: ${passo}`);
  assert.doesNotMatch(texto(comLink), /Com o app aberto, toque em Compartilhar/, 'com o TestFlight os passos da Tela de Início saem');
  assert.match(html, /id="cn-painel-iphone"[^>]*hidden=""/, 'o painel do iPhone fica escondido no Android');
  const iphone = desenhar({ aparelho: 'iphone' });
  assert.match(iphone, /id="cn-aba-iphone"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="cn-aba-iphone"/, 'no iPhone abre em iPhone');
  assert.match(iphone, /id="cn-painel-android"[^>]*hidden=""/);
  assert.ok(texto(iphone).includes(textos.acoes.iphoneEmBreve.disponibilidade));
});

test('S4 no computador (spec 18, seção 3, d7f2abb): os passos de cada aba falam do celular, com o cartão do QR ao lado também na aba do iPhone (sem o arquivo do Android), e só no computador', () => {
  const computador = desenhar();
  const painel = (html, id) => html.match(new RegExp(`<div role="tabpanel" id="cn-painel-${id}"[\\s\\S]*?(?=<div role="tabpanel"|<\\/section>|$)`))[0];
  // Android: os três passos do computador e o cartão do QR (o do S4, com o link do arquivo).
  const android = painel(computador, 'android');
  assert.deepEqual([...android.matchAll(/<span class="cn-passo__texto">([^<]*)<\/span>/g)].map((m) => m[1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'")), [...textos.s4.android.passosNoComputador]);
  assert.match(android, /id="cn-qr-s4-titulo"/);
  assert.match(android, /class="cn-qr__arquivo"/);
  // iPhone antes do TestFlight: os passos do computador, o QR sem o arquivo do Android e o estado do convite público.
  const iphone = painel(computador, 'iphone');
  for (const passo of textos.s4.iphone.passosNoComputador) assert.ok(texto(iphone).includes(passo), passo);
  assert.deepEqual(textos.s4.iphone.passosNoComputador, ['Leia o código com a câmera do iPhone. No Safari, toque em “Abrir o app para adicionar”.', 'Toque em Compartilhar e escolha “Adicionar à Tela de Início”.', 'Toque em Adicionar. O Studoo fica com os seus apps.']);
  assert.match(iphone, /id="cn-qr-s4-iphone-titulo"/, 'o cartão do QR também na aba do iPhone, ao lado dos passos');
  assert.doesNotMatch(iphone, /cn-qr__arquivo/, 'sem o arquivo do Android no cartão do iPhone');
  assert.ok(texto(iphone).includes(textos.acoes.iphoneEmBreve.disponibilidade));
  assert.doesNotMatch(texto(iphone), /Com o app aberto, toque em Compartilhar/, 'os passos da folha (do celular) não aparecem no computador');
  // A âncora #iphone não é item da grade do painel (tomava uma linha e empurrava o cartão do QR para baixo do alinhamento dos passos): fica solta, posicionada no painel.
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-ancora \{ position: absolute; top: -16px; left: 0; display: block; width: 0; height: 0; scroll-margin-top: 110px; \}/);
  // A aba do iPhone antes do TestFlight, no computador: o estado do convite e o botão embaixo dos passos, na coluna da esquerda, alinhados ao texto dos passos e na
  // largura do botão principal; o cartão do QR sozinho à direita.
  assert.match(iphone, /<div role="tabpanel" id="cn-painel-iphone"[^>]*class="cn-painel cn-painel--iphone-com-qr"/, 'só a aba do iPhone sem TestFlight e com QR leva a variante');
  assert.doesNotMatch(painel(computador, 'android').slice(0, 300), /cn-painel--iphone-com-qr/);
  assert.doesNotMatch(desenhar({ aparelho: 'iphone' }), /cn-painel--iphone-com-qr/, 'no celular nada muda');
  assert.match(css, /--cn-passo-numero: 32px;\n  --cn-passo-vao: 14px;\n  --cn-botao-principal-computador: 280px;/);
  assert.match(css, /\.cn-passo \{ display: grid; grid-template-columns: var\(--cn-passo-numero, 32px\) minmax\(0, 1fr\) auto; align-items: start; gap: var\(--cn-passo-vao, 14px\);/);
  assert.match(css, /\.cn-painel--iphone-com-qr \.cn-passos \{ grid-row: 1; \}/);
  assert.match(css, /\.cn-painel--iphone-com-qr \.cn-painel__qr \{ grid-row: 1 \/ span 3; align-self: start; \}/);
  assert.match(css, /\.cn-painel--iphone-com-qr \.cn-apoio--painel, \.cn-painel--iphone-com-qr \.cn-painel__acao \{ grid-column: 1; margin-left: calc\(var\(--cn-passo-numero, 32px\) \+ var\(--cn-passo-vao, 14px\)\); \}/, 'na coluna da esquerda, no recuo do texto dos passos');
  assert.match(css, /\.cn-painel--iphone-com-qr \.cn-painel__acao \{ width: var\(--cn-botao-principal-computador, 280px\); max-width: 100%; \}/, 'na largura do botão principal, não a coluna toda');
  assert.match(css, /\.cn-painel \{ position: relative; display: grid; gap: 22px; justify-items: start; margin-top: 24px; \}/);
  // iPhone com o TestFlight: QR e alternativa de texto para abrir ou compartilhar o convite.
  const comLink = desenhar({ links: { testflight: 'https://testflight.apple.com/join/ABC123' } });
  const iphoneComLink = painel(comLink, 'iphone');
  assert.deepEqual([...iphoneComLink.matchAll(/<span class="cn-passo__texto">([^<]*)<\/span>/g)].map((m) => m[1].replace(/&quot;/g, '"')), [...textos.s4.iphone.testflightPassosNoComputador]);
  assert.match(iphoneComLink, /id="cn-qr-s4-iphone-titulo"/);
  assert.match(iphoneComLink, /href="https:\/\/testflight\.apple\.com\/join\/ABC123"[^>]*>Abrir convite do TestFlight<\/a>/);
  assert.doesNotMatch(painel(comLink, 'iphone').slice(0, 300), /cn-painel--iphone-com-qr/, 'com o TestFlight não há linha nem botão embaixo: não leva a variante');
  // No celular nada muda: os passos de sempre, sem cartão de QR, e o botão do TestFlight.
  const noIphone = desenhar({ aparelho: 'iphone', links: { testflight: 'https://testflight.apple.com/join/ABC123' } });
  for (const passo of textos.s4.iphone.testflightPassos) assert.ok(texto(noIphone).includes(passo), passo);
  assert.doesNotMatch(noIphone, /cn-qr-s4/, 'sem QR no celular');
  assert.match(noIphone, /href="https:\/\/testflight\.apple\.com\/join\/ABC123"/);
  // Sem origem pública (sem QR) o computador volta aos passos com botão: não há "código ao lado" para citar.
  const semQr = desenhar({ origem: null });
  assert.doesNotMatch(texto(semQr), /código ao lado/);
  for (const passo of textos.s4.android.passos) assert.ok(texto(semQr).includes(passo), passo);
});

test('o endereço /baixar abre a parada do app: o id baixar na região e o id iphone no painel do iPhone', () => {
  const html = desenhar({ aparelho: 'iphone' });
  assert.match(html, /<section id="baixar" class="cn-regiao cn-regiao--nuvens"/);
  assert.match(html, /<span id="iphone" class="cn-ancora"/);
  const css = ler('src/app/conheca/conheca.css');
  assert.match(css, /\.cn-regiao, \.cn-chegada \{ position: relative; scroll-margin-top: 124px; \}/, 'a âncora para abaixo da cápsula do cabeçalho, com o marco à vista');
});

test('rodapé e metadados: logo, a linha do HackBrasil e os três links; o título e a descrição da spec', () => {
  const html = desenhar({ aparelho: 'android' });
  assert.ok(texto(html).includes('Feito para o HackBrasil 2026.'));
  assert.match(html, /<a href="\/privacidade">Política de privacidade<\/a>/);
  assert.match(html, /<a href="\/suporte">Suporte<\/a>/);
  const pagina = ler('src/app/conheca/page.tsx');
  assert.equal(textos.pagina.titulo, 'Studoo — Seu caderno vira lição.');
  assert.ok(textos.pagina.descricao.includes('Resolva uma questão com o Stu'));
  assert.doesNotMatch(pagina, /robots\s*:/, 'o noindex do site fica o do layout raiz');
  assert.match(ler('src/app/layout.tsx'), /robots: \{ index: false, follow: false \}/);
});

test('sem selos de loja, sem framer-motion, GSAP nem Lottie', () => {
  const arquivos = (pasta) => readdirSync(join(raiz, pasta), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(join(pasta, e.name)) : [join(pasta, e.name)]));
  const fontes = arquivos('src/app/conheca').filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => [f, ler(f)]);
  for (const [arquivo, conteudo] of fontes) {
    assert.doesNotMatch(conteudo, /framer-motion|gsap|lottie/i, arquivo);
    assert.doesNotMatch(conteudo, /app-store|play\.google|apple\.com\/app|badge|Download on the App Store|GET IT ON/i, `${arquivo}: sem selos oficiais de loja`);
  }
  assert.match(ler('src/proxy.ts'), /"\/conheca"/, 'a política de segurança vale para a página');
});

test('a apresentação é silenciosa em qualquer aparelho e só oferece o controle de som no app', () => {
  for (const aparelho of ['android', 'iphone', 'ipad', 'computador']) {
    const html = desenhar({ aparelho });
    assert.match(html, /<div class="cn-pagina"[^>]* data-sem-musica=""/);
    assert.doesNotMatch(html, /class="aula-som"|Música de fundo ligada/);
  }
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

test('movimento só dentro de prefers-reduced-motion: no-preference, e nada se mexe sozinho sem parar', () => {
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
  assert.deepEqual(semMovimento, [], 'fora do bloco "com movimento" não há animação nem transição');
  // Nenhuma animação em laço: nada passa de uns segundos nem recomeça, então a página não precisa de botão de pausa (WCAG 2.2.2).
  assert.doesNotMatch(css, /\binfinite\b/);
  assert.doesNotMatch(css, /mundo-balanca/, 'os enfeites do mundo não balançam na página');
  for (const nome of ['cn-entrar', 'cn-aceno', 'cn-marcador', 'cn-tabua-cai', 'cn-passos', 'cn-pulo']) assert.match(css, new RegExp(`@keyframes ${nome} `));
  assert.match(css, /cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  assert.match(css, /\[data-revelar\]\[data-oculto\]:not\(\[data-revelado\]\) \{ opacity: 0; transform: translateY\(16px\); \}/);
  // O céu do alto só acompanha a rolagem onde o navegador liga a animação a ela: quem move é a própria pessoa.
  assert.match(css, /@supports \(animation-timeline: scroll\(\)\) \{\n    \.cn-heroi__ceu \{ animation: cn-ceu-se-afasta linear both; animation-timeline: scroll\(root block\); animation-range: 0 90vh; \}/);
  // Parada, a página mostra o estado final inteiro: as tábuas no lugar e o Stu do outro lado.
  assert.ok(sobra.includes(".cn-ponte:not([data-ponte='vazia']) .cn-lago__tabua { opacity: 1; }"));
  assert.ok(sobra.includes(".cn-ponte[data-ponte='atravessada'] .cn-lago__stu { left: 70%; }"));
  assert.ok(sobra.includes('.cn-material[data-fonte-aberta] .cn-marca { background-size: 100% 78%; box-shadow: none; }'));
});

test('as ilhas de movimento respeitam o movimento reduzido e a aba escondida', () => {
  const revelar = ler('src/app/conheca/ilhas/revelar.tsx');
  assert.match(revelar, /prefers-reduced-motion: reduce\)'\)\.matches\) return;/);
  const logo = ler('src/app/conheca/ilhas/logo.tsx');
  assert.match(logo, /source media="\(prefers-reduced-motion: reduce\)" srcSet="\/marca\/logo-com-sorriso\.svg"/);
  assert.match(logo, /setTimeout\(\(\) => setParado\(true\), 3200\)/, 'o logo acorda uma vez (um ciclo de 3 s)');
  assert.match(ler('src/app/conheca/ilhas/ensinar.tsx'), /prefers-reduced-motion: reduce/);
  assert.match(ler('src/app/globals.css'), /html\[data-pausado='true'\] \*/, 'a aba escondida pausa toda animação CSS do site');
  // Nenhuma ilha de cliente importa `ui/mundo` (que traz a folha de estilos dele): os desenhos chegam prontos do servidor. Importado numa ilha, o build com webpack
  // pedia essa folha como script (erro no console) e os desenhos ficavam sem tamanho.
  for (const arquivo of readdirSync(join(raiz, 'src/app/conheca/ilhas'))) {
    const fonte = ler(`src/app/conheca/ilhas/${arquivo}`);
    if (/^'use client'/.test(fonte)) assert.doesNotMatch(fonte, /from '(?:\.\.\/)+ui\/mundo'/, arquivo);
  }
  // As ilhas novas não põem relógio em laço: a ponte e a fonte só mudam com o toque, e a trilha só com a rolagem.
  for (const ilha of ['ponte', 'material', 'trilha']) assert.doesNotMatch(ler(`src/app/conheca/ilhas/${ilha}.tsx`), /setInterval/, ilha);
});

