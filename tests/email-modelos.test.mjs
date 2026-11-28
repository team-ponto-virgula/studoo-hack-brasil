import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { test } from 'node:test';
import {
  CORES_EMAIL,
  FONTES_EMAIL,
  IMAGENS_EMAIL,
  emailCodigoCadastro,
  emailContaExistente,
  emailRecuperacao,
} from '../src/servidor/email/modelos.ts';
import { enviarAvisoContaExistente, enviarCodigoCadastro, enviarRecuperacao } from '../src/servidor/email/recuperacao.ts';

// Os modelos dos e-mails (issue #114): o HTML e o texto simples de cada mensagem, sem servidor, sem banco e sem envio.
const SITE = 'https://app.hellostudoo.com.br';
const ORIGEM = 'https://studoo.example.test';
const enderecos = { cadastro: `${ORIGEM}/cadastro`, recuperar: `${ORIGEM}/recuperar`, entrar: `${ORIGEM}/login`, suporte: `${ORIGEM}/suporte` };
const CODIGO = '482913';
/** Os botões dos e-mails com código: a tela com o código no fragmento, que não sai do aparelho. */
const comOCodigo = { cadastro: `${ORIGEM}/cadastro#codigo=${CODIGO}`, recuperacao: `${ORIGEM}/recuperar#codigo=${CODIGO}` };
const cadastro = emailCodigoCadastro({ codigo: CODIGO, enderecos });
const recuperacao = emailRecuperacao({ codigo: CODIGO, enderecos });
const existente = emailContaExistente({ enderecos });
const modelos = { cadastro, recuperacao, existente };
const comCodigo = { cadastro, recuperacao };

const estilos = (html) => [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
/** O HTML como chega a um cliente que remove o `<style>` e os comentários condicionais: só o que está inline. */
const soInline = (html) => html.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
const tags = (html, nome) => [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, 'g'))].map((m) => m[0]);
const atributo = (tag, nome) => new RegExp(`\\s${nome}="([^"]*)"`).exec(tag)?.[1];
const entidades = (texto) => texto.replace(/&nbsp;/g, ' ').replace(/&zwnj;/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
/** O que a pessoa lê no corpo: sem o `<head>`, sem a linha de prévia (escondida) e sem as marcas. */
const lido = (html) => entidades(
  soInline(html).replace(/<head>[\s\S]*?<\/head>/, '').replace(/<div style="display:none[\s\S]*?<\/div>/, '')
    .replace(/<\/?(strong|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' '),
).replace(/\u034f/g, '').replace(/\s+/g, ' ').trim();
const previa = (html) => entidades(/<div style="display:none[^>]*>([\s\S]*?)<\/div>/.exec(html)[1]).replace(/[\u034f\u200c\u00a0]/g, '').trim();

function contraste(a, b) {
  const luz = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [clara, escura] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (escura + 0.05);
}

test('cada modelo traz assunto, HTML completo em pt-BR e texto simples', () => {
  assert.equal(cadastro.assunto, 'Seu código para criar a conta no Studoo');
  assert.equal(recuperacao.assunto, 'Seu código para recuperar a senha do Studoo');
  assert.equal(existente.assunto, 'Você já tem uma conta no Studoo');
  for (const [nome, { assunto, html, texto }] of Object.entries(modelos)) {
    assert.ok(html.startsWith('<!DOCTYPE html>'), nome);
    assert.match(html, /<html lang="pt-BR" dir="ltr"/, nome);
    // O Gmail descarta o <html> e o <body>: o idioma também fica no contêiner que sobra.
    assert.match(html, /<div role="article"[^>]* lang="pt-BR"/, nome);
    assert.match(html, /<meta charset="utf-8">/, nome);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, nome);
    assert.ok(html.includes(`<title>${assunto}</title>`), nome);
    assert.equal(tags(html, 'h1').length, 1, `${nome}: um título só`);
    // Os subtítulos são títulos de verdade: quem usa leitor de tela percorre a mensagem por eles.
    assert.deepEqual([...html.matchAll(/<h2\b[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]), {
      cadastro: ['Não foi você?'], recuperacao: ['Não pediu a troca?'], existente: ['Para entrar', 'Esqueceu a senha?', 'Não foi você?'],
    }[nome], nome);
    assert.ok(texto.trim().length > 200, nome);
    // O assunto não leva o código: assunto aparece em registros de provedor e na tela de bloqueio.
    assert.doesNotMatch(assunto, /\d/, nome);
  }
});

test('cadastro e recuperação destacam o código e a validade, no HTML, na prévia e no texto', () => {
  for (const [nome, { html, texto }] of Object.entries(comCodigo)) {
    // Um texto só, sem espaço nem elemento entre os dígitos: dois cliques ou tocar e segurar selecionam o código inteiro.
    const destaque = [...html.matchAll(/<p[^>]*style="([^"]*)"[^>]*>482913<\/p>/g)];
    assert.equal(destaque.length, 1, nome);
    const estilo = destaque[0][1];
    assert.ok(Number(/font-size:(\d+)px/.exec(estilo)[1]) >= 36, `${nome}: o código é o maior texto da mensagem`);
    assert.match(estilo, /font-weight:800/);
    // O espaço entre os dígitos é só visual (em px, que o Outlook de computador entende): a cópia sai sem espaços.
    assert.match(estilo, /padding:0 0 0 6px;.*letter-spacing:6px;/);
    assert.match(estilo, new RegExp(`color:${CORES_EMAIL.claro.texto}`));
    assert.match(estilo, /user-select:all/);
    assert.equal(lido(html).split(CODIGO).length - 1, 1, `${nome}: o código aparece uma vez no corpo`);
    // O rótulo é o do campo em que o código é digitado, e a validade vem logo abaixo, em negrito.
    assert.ok(html.indexOf('Código de 6 dígitos') < html.indexOf(`>${CODIGO}<`), nome);
    const depois = html.slice(html.indexOf(`>${CODIGO}<`));
    assert.match(depois, /^>482913<\/p><\/td><\/tr>\s*<tr><td[^>]*><p[^>]*font-weight:800[^>]*>Vale por 15&nbsp;minutos<\/p>/, nome);
    assert.ok(lido(html).includes('Vale por 15 minutos Só pode ser usado uma vez.'), nome);
    assert.ok(lido(html).includes('Para copiar, toque no código e segure. No computador, dê dois cliques nele.'), nome);
    assert.ok(lido(html).includes('Pediu mais de um código? Só o mais recente funciona.'), nome);
    assert.equal(previa(html), `Seu código é ${CODIGO}. Vale por 15 minutos e só pode ser usado uma vez.`, nome);

    // No texto, o código abre a mensagem (é a linha da notificação) e a validade vem em seguida.
    const linhas = texto.split('\n');
    assert.equal(linhas[0], `Seu código do Studoo é: ${CODIGO}`, nome);
    assert.equal(linhas[2], 'Ele vale por 15 minutos e só pode ser usado uma vez.', nome);
    // É assim que os testes com banco e o roteiro de QA leem o código da caixa falsa.
    assert.equal(/é: (\d{6})/.exec(texto)[1], CODIGO, nome);
    assert.equal(texto.match(/\b\d{6}\b/)[0], CODIGO, nome);
    // Além da primeira linha, o código só aparece no link do botão, no fragmento.
    assert.equal(texto.split(CODIGO).length - 1, 2, nome);
    assert.deepEqual(linhas.filter((l) => l.includes(CODIGO)), [linhas[0], comOCodigo[nome]], nome);
  }
});

test('o botão principal abre a tela com o código já preenchido, no app ou no site', () => {
  const rotulos = { cadastro: 'Criar minha conta', recuperacao: 'Criar nova senha' };
  for (const [nome, { html, texto }] of Object.entries(comCodigo)) {
    const botoes = [...html.matchAll(/<td align="center" bgcolor="(#[0-9A-F]{6})" class="(s-botao2?)"[^>]*><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => m.slice(1));
    assert.deepEqual(botoes, [[CORES_EMAIL.claro.acao, 's-botao', comOCodigo[nome], rotulos[nome]]], nome);
    // O código vai no fragmento, nunca na query: o fragmento não chega ao servidor, aos registros nem ao Referer.
    assert.doesNotMatch(html, /\?codigo=/, nome);
    assert.doesNotMatch(texto, /\?codigo=/, nome);
    // O botão vem logo depois do código, e digitar o código na tela continua sendo um caminho.
    const corpo = lido(html);
    assert.ok(corpo.indexOf('Para copiar') < corpo.indexOf(rotulos[nome]), nome);
    assert.ok(corpo.includes(`${rotulos[nome]} Abre o app, se ele estiver instalado, ou o site, já com o código preenchido. Ou volte para a tela`), nome);
    assert.ok(texto.includes(`\n\n${rotulos[nome]} (abre o app, se ele estiver instalado, ou o site, já com o código preenchido):\n${comOCodigo[nome]}\n\n`), nome);
  }
});

test('cada mensagem diz por que chegou e o que fazer a seguir', () => {
  const partes = {
    cadastro: [
      'Falta pouco para criar sua conta',
      'Recebemos um pedido para criar uma conta no Studoo com este e-mail. O código confirma que ele é seu.',
      'Criar minha conta Abre o app, se ele estiver instalado, ou o site, já com o código preenchido.',
      'Ou volte para a tela Criar sua conta, no app ou no site, digite o código e crie sua senha.',
      'Não foi você? Pode ignorar este e-mail. Sem o código, nenhuma conta é criada. Não compartilhe este código com ninguém.',
    ],
    recuperacao: [
      'Vamos recuperar seu acesso',
      'Recebemos um pedido para trocar a senha da sua conta no Studoo. Com o código, você cria uma nova senha.',
      'Criar nova senha Abre o app, se ele estiver instalado, ou o site, já com o código preenchido.',
      'Ou volte para a tela Recuperar acesso, no app ou no site, digite o código e escolha a nova senha.',
      'Não pediu a troca? Pode ignorar este e-mail. Sua senha continua a mesma. Não compartilhe este código com ninguém.',
    ],
    existente: [
      'Você já tem uma conta',
      'Recebemos um pedido para criar uma conta no Studoo com este e-mail. Como ele já tem uma conta, não enviamos nenhum código.',
      'Para entrar Entre do mesmo jeito de sempre, no app ou no site: com e-mail e senha, com o Google ou, no iPhone, com a Apple. Entrar no Studoo',
      'Esqueceu a senha? Peça um código de recuperação e crie uma nova senha em poucos minutos. Recuperar a senha',
      'Não foi você? Pode ignorar este e-mail. Nada mudou na sua conta.',
    ],
  };
  for (const [nome, frases] of Object.entries(partes)) {
    const corpo = lido(modelos[nome].html);
    let onde = 0;
    for (const frase of frases) {
      const achado = corpo.indexOf(frase, onde);
      assert.ok(achado >= 0, `${nome}: falta, nesta ordem, “${frase}” em “${corpo}”`);
      onde = achado + frase.length;
    }
    // O rodapé é o mesmo: a marca, a ajuda e o motivo do envio.
    assert.ok(corpo.endsWith('Studoo Aprenda qualquer coisa, um passo de cada vez. Precisa de ajuda? Fale com o suporte Você recebeu este e-mail porque este endereço foi informado no Studoo.'), nome);
  }
  // O texto simples diz as mesmas coisas, linha a linha (lá a tela vem entre aspas, e os links, por extenso).
  const noTexto = {
    cadastro: [
      'Recebemos um pedido para criar uma conta no Studoo com este e-mail. O código confirma que ele é seu.',
      'Criar minha conta (abre o app, se ele estiver instalado, ou o site, já com o código preenchido):', comOCodigo.cadastro,
      'Volte para a tela “Criar sua conta”, no app ou no site, digite o código e crie sua senha.',
      'Pediu mais de um código? Só o mais recente funciona.',
      'Não foi você?', 'Pode ignorar este e-mail. Sem o código, nenhuma conta é criada.', 'Não compartilhe este código com ninguém.',
    ],
    recuperacao: [
      'Recebemos um pedido para trocar a senha da sua conta no Studoo. Com o código, você cria uma nova senha.',
      'Criar nova senha (abre o app, se ele estiver instalado, ou o site, já com o código preenchido):', comOCodigo.recuperacao,
      'Volte para a tela “Recuperar acesso”, no app ou no site, digite o código e escolha a nova senha.',
      'Pediu mais de um código? Só o mais recente funciona.',
      'Não pediu a troca?', 'Pode ignorar este e-mail. Sua senha continua a mesma.', 'Não compartilhe este código com ninguém.',
    ],
    existente: [
      'Recebemos um pedido para criar uma conta no Studoo com este e-mail. Como ele já tem uma conta, não enviamos nenhum código.',
      'Para entrar', 'Entre do mesmo jeito de sempre, no app ou no site: com e-mail e senha, com o Google ou, no iPhone, com a Apple.',
      'Esqueceu a senha?', 'Peça um código de recuperação e crie uma nova senha em poucos minutos.',
      'Não foi você?', 'Pode ignorar este e-mail. Nada mudou na sua conta.',
    ],
  };
  for (const [nome, esperadas] of Object.entries(noTexto)) {
    const linhas = modelos[nome].texto.split('\n');
    let onde = 0;
    for (const esperada of esperadas) {
      const achada = linhas.indexOf(esperada, onde);
      assert.ok(achada >= 0, `${nome}: o texto simples não traz, nesta ordem, a linha “${esperada}”`);
      onde = achada + 1;
    }
  }
});

test('“e-mail” não quebra no hífen, como no produto', () => {
  for (const [nome, { html }] of Object.entries(modelos)) {
    const corpo = soInline(html).replace(/<head>[\s\S]*?<\/head>/, '').replace(/<div style="display:none[\s\S]*?<\/div>/, '').replace(/ (aria-roledescription|aria-label|alt)="[^"]*"/g, '');
    const protegidos = corpo.split('<span style="white-space:nowrap;">e-mail</span>').length - 1;
    assert.ok(protegidos >= 2, nome);
    assert.equal(corpo.split('e-mail').length - 1, protegidos, `${nome}: há “e-mail” que pode quebrar no hífen`);
  }
});

test('o aviso de conta existente explica como entrar e como recuperar a senha, sem nenhum código', () => {
  const { html, texto } = existente;
  assert.doesNotMatch(lido(html), /\d{4,}/);
  assert.doesNotMatch(texto, /\d{4,}/);
  assert.doesNotMatch(texto, /é: /, 'não pode ser lido como mensagem de código');
  assert.doesNotMatch(lido(html), /Código de 6 dígitos|Vale por/);
  // A entrada é a ação principal e vem antes da recuperação.
  const botoes = [...html.matchAll(/<td align="center" bgcolor="(#[0-9A-F]{6})" class="(s-botao2?)"[^>]*><a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => m.slice(1));
  assert.deepEqual(botoes, [
    [CORES_EMAIL.claro.acao, 's-botao', enderecos.entrar, 'Entrar no Studoo'],
    [CORES_EMAIL.claro.secundario, 's-botao2', enderecos.recuperar, 'Recuperar a senha'],
  ]);
  assert.match(previa(html), /^Entre do jeito de sempre ou recupere a senha\. Nada mudou na sua conta\.$/);
  // No texto, cada endereço fica sozinho na linha, logo depois da explicação.
  assert.ok(texto.includes(`com o Google ou, no iPhone, com a Apple.\n${enderecos.entrar}\n`));
  assert.ok(texto.includes(`Peça um código de recuperação e crie uma nova senha em poucos minutos.\n${enderecos.recuperar}\n`));
});

test('os links levam ao destino certo, na origem recebida, e não há outros', () => {
  const esperados = {
    cadastro: [comOCodigo.cadastro, enderecos.suporte],
    recuperacao: [comOCodigo.recuperacao, enderecos.suporte],
    existente: [enderecos.entrar, enderecos.recuperar, enderecos.suporte],
  };
  for (const [nome, { html, texto }] of Object.entries(modelos)) {
    const links = tags(html, 'a');
    assert.deepEqual(links.map((a) => atributo(a, 'href')), esperados[nome], nome);
    for (const a of links) {
      assert.equal(atributo(a, 'target'), '_blank', nome);
      assert.match(atributo(a, 'style'), /color:#[0-9A-F]{6}/, `${nome}: a cor do link é inline`);
    }
    // O texto simples traz os mesmos endereços, cada um sozinho na linha (nenhuma pontuação gruda no link).
    const linhas = texto.split('\n');
    assert.deepEqual(linhas.filter((l) => /https?:\/\//.test(l)), esperados[nome], nome);
    // Nenhum outro endereço no HTML além dos links, das imagens e das fontes da marca.
    const outros = [...html.matchAll(/https?:\/\/[^\s"'<)]+/g)].map((m) => m[0])
      .filter((u) => !esperados[nome].includes(u) && !Object.values(IMAGENS_EMAIL).includes(u) && !Object.values(FONTES_EMAIL).includes(u));
    assert.deepEqual(outros, ['http://www.w3.org/1999/xhtml'], nome);
  }
  // A origem vem de quem chama: outra origem permitida leva os links junto, com o código no fragmento.
  const outra = { cadastro: 'http://localhost:3100/cadastro', recuperar: 'http://localhost:3100/recuperar', entrar: 'http://localhost:3100/login', suporte: 'http://localhost:3100/suporte' };
  assert.deepEqual(tags(emailContaExistente({ enderecos: outra }).html, 'a').map((a) => atributo(a, 'href')), [outra.entrar, outra.recuperar, outra.suporte]);
  assert.deepEqual(tags(emailCodigoCadastro({ codigo: CODIGO, enderecos: outra }).html, 'a').map((a) => atributo(a, 'href')), [`${outra.cadastro}#codigo=${CODIGO}`, outra.suporte]);
  assert.deepEqual(tags(emailRecuperacao({ codigo: CODIGO, enderecos: outra }).html, 'a').map((a) => atributo(a, 'href')), [`${outra.recuperar}#codigo=${CODIGO}`, outra.suporte]);
});

test('regras de e-mail: tabelas, estilos inline, até 600 px, sem JavaScript nem recurso que o cliente bloqueia', () => {
  for (const [nome, { html }] of Object.entries(modelos)) {
    assert.doesNotMatch(html, /<script|javascript:|\son[a-z]+\s*=|<link\b|<form\b|<input\b|<button\b|<iframe\b|<object\b|<embed\b|<video\b|<audio\b|<svg\b|<picture\b|@import|expression\(/i, nome);
    assert.doesNotMatch(html, /\.webp|\.svg|\.gif|data:image/i, `${nome}: só PNG por endereço`);
    for (const tabela of tags(html, 'table')) assert.equal(atributo(tabela, 'role'), 'presentation', `${nome}: ${tabela}`);
    assert.doesNotMatch(html, /<div\b(?! role="article"| style="display:none)/, `${nome}: o layout é de tabelas`);
    const inline = soInline(html);
    assert.doesNotMatch(inline, /display:\s*(flex|grid|inline-flex)|position:\s*(absolute|fixed|relative|sticky)|float:|background-image|url\(|calc\(|var\(|clamp\(|\d(rem|em|vw|vh)[;" ]/, nome);
    // Largura: fluida, com teto de 600 px (e a tabela fantasma de 600 para o Outlook, que ignora max-width).
    assert.equal(inline.split('max-width:600px').length - 1, 1, nome);
    assert.ok(html.includes('<!--[if mso]><table role="presentation" align="center" width="600"'), nome);
    assert.doesNotMatch(inline, /width="(?!100%|40"|64"|88")[^"]+"/, `${nome}: nenhuma largura fixa além das imagens`);
    // Todo texto tem letra, tamanho e cor inline: o que o <style> faz é só troca de cor e respiro.
    for (const marca of [...tags(inline, 'p'), ...tags(inline, 'h1'), ...tags(inline, 'h2'), ...tags(inline, 'a')]) {
      const estilo = atributo(marca, 'style') ?? '';
      assert.match(estilo, /font-family:(Quicksand,)?Nunito,ui-rounded,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;/, `${nome}: ${marca}`);
      assert.ok(Number(/font-size:(\d+)px/.exec(estilo)[1]) >= 14, `${nome}: texto de pelo menos 14 px (${marca})`);
      assert.match(estilo, /color:#[0-9A-F]{6}/, `${nome}: ${marca}`);
    }
    for (const marca of inline.match(/<[a-z0-9]+\b[^>]*\sclass="[^"]*"[^>]*>/g)) {
      assert.match(marca, /\sstyle="[^"]+"/, `${nome}: a classe só troca o que já está inline (${marca})`);
    }
    // Os limites do Gmail: mensagem cortada acima de 102 kB e <style> ignorado acima de 8192 caracteres.
    assert.ok(Buffer.byteLength(html) < 40_000, `${nome}: ${Buffer.byteLength(html)} B`);
    for (const estilo of estilos(html)) assert.ok(estilo.length < 8192, nome);
  }
});

test('sem o <style>, a mensagem continua inteira e com as cores do produto', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  const token = (nome) => new RegExp(`--${nome}:\\s*(#[0-9a-f]{3,6});`, 'i').exec(css)[1].toUpperCase().replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3');
  const { claro } = CORES_EMAIL;
  assert.deepEqual(
    { pagina: claro.pagina, caixa: claro.caixa, cartao: claro.cartao, borda: claro.borda, texto: claro.texto, texto2: claro.texto2, acao: claro.acao, labio: claro.acaoLabio, link: claro.link, halo: claro.halo },
    { pagina: token('nevoa'), caixa: token('nevoa'), cartao: token('fundo'), borda: token('gelo'), texto: token('texto'), texto2: token('texto2'), acao: token('acao'), labio: token('acao-escura'), link: token('acao-escura'), halo: token('lavanda') },
  );
  for (const [nome, { html }] of Object.entries(modelos)) {
    const inline = soInline(html);
    // Só as cores da versão clara aparecem inline; as da escura moram no <style>.
    const usadas = new Set(inline.match(/#[0-9A-F]{6}\b/g));
    for (const cor of usadas) assert.ok(Object.values(claro).includes(cor), `${nome}: ${cor} não é do produto`);
    assert.ok(inline.includes(`bgcolor="${claro.pagina}"`) && inline.includes(`bgcolor="${claro.cartao}"`), nome);
    assert.match(inline, new RegExp(`<h1 class="s-texto" style="[^"]*font-size:26px;line-height:32px;[^"]*font-weight:700;[^"]*color:${claro.texto};`), nome);
    assert.match(inline, new RegExp(`border:2px solid ${claro.borda};border-radius:24px;background-color:${claro.cartao};`), nome);
  }
});

test('imagens: endereço absoluto do site publicado, tamanho fixo, proporção certa e texto alternativo', () => {
  assert.deepEqual(IMAGENS_EMAIL, { icone: `${SITE}/marca/icone-192.png`, stu: `${SITE}/marca/stu/stu-acolhida-480.png` });
  const medida = (arquivo) => { const png = readFileSync(arquivo); return { largura: png.readUInt32BE(16), altura: png.readUInt32BE(20) }; };
  for (const [nome, { html }] of Object.entries(modelos)) {
    const imagens = tags(html, 'img');
    assert.deepEqual(imagens.map((i) => [atributo(i, 'src'), atributo(i, 'alt')]), [
      [IMAGENS_EMAIL.icone, 'Studoo'],
      [IMAGENS_EMAIL.stu, 'Stu, o mascote do Studoo, acenando'],
    ], nome);
    for (const imagem of imagens) {
      const arquivo = `public${new URL(atributo(imagem, 'src')).pathname}`;
      assert.ok(existsSync(arquivo), `${nome}: ${arquivo} existe no site`);
      const [largura, altura] = [Number(atributo(imagem, 'width')), Number(atributo(imagem, 'height'))];
      const real = medida(arquivo);
      assert.ok(Math.abs(largura / altura - real.largura / real.altura) < 0.02, `${nome}: ${arquivo} sem esticar`);
      assert.ok(real.largura >= largura * 3, `${nome}: nítida em tela de densidade 3`);
      assert.match(atributo(imagem, 'style'), new RegExp(`display:block;.*width:${largura}px;height:${altura}px;border:0;`), nome);
    }
    // O logo em PNG é azul-marinho sobre transparente e some no modo escuro: o cabeçalho usa o ícone (fundo próprio) e o nome em texto.
    assert.equal(html.includes('logo-com-sorriso'), false, nome);
    assert.match(html, /<img src="[^"]+icone-192\.png"[^>]*><\/td><td valign="middle" aria-hidden="true" class="s-texto"[^>]*>Studoo<\/td>/, nome);
  }
});

test('fontes da marca são um extra: bloco próprio, fora do Outlook, com a pilha de reserva em todo texto', () => {
  for (const [nome, { html }] of Object.entries(modelos)) {
    const [fontes, ...resto] = estilos(html.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, ''));
    assert.match(fontes, /^\s*@font-face\{font-family:Nunito;[^}]*src:url\(https:\/\/app\.hellostudoo\.com\.br\/marca\/nunito-wght-latim\.woff2\) format\('woff2'\);\}\s*@font-face\{font-family:Quicksand;[^}]*quicksand-wght-latim\.woff2\) format\('woff2'\);\}\s*$/, nome);
    assert.ok(html.includes('<!--[if !mso]><!-->\n<style>\n@font-face'), `${nome}: o Outlook de computador não vê o @font-face`);
    assert.equal(resto.length, 1, nome);
    assert.doesNotMatch(resto[0], /@font-face|url\(/, `${nome}: um bloco recusado não leva o outro`);
    assert.match(html, /<!--\[if mso\]>[\s\S]*<style>table,td,p,a,h1,h2,strong,span\{font-family:'Segoe UI',Arial,sans-serif!important;\}<\/style>\s*<!\[endif\]-->/, nome);
  }
  for (const fonte of Object.values(FONTES_EMAIL)) assert.ok(existsSync(`public${new URL(fonte).pathname}`), fonte);
  // Fonte de outro domínio só carrega com CORS: o site manda o cabeçalho nas fontes da marca.
  const regra = /source: "\/marca\/:arquivo\(\.\*\\\\\.woff2\)",\s*headers: \[([\s\S]*?)\],/.exec(readFileSync('next.config.ts', 'utf8'))[1];
  assert.match(regra, /\{ key: "Access-Control-Allow-Origin", value: "\*" \}/);
});

test('modo escuro: declarado, com as cores da versão escura, e contraste AA nos dois esquemas', () => {
  for (const [esquema, c] of Object.entries(CORES_EMAIL)) {
    const pares = {
      'texto no cartão': [c.texto, c.cartao], 'texto secundário no cartão': [c.texto2, c.cartao], 'texto na caixa do código': [c.texto, c.caixa],
      'texto secundário na caixa do código': [c.texto2, c.caixa], 'texto na página': [c.texto, c.pagina], 'texto secundário na página': [c.texto2, c.pagina],
      'link na página': [c.link, c.pagina], 'botão principal': [c.acaoTexto, c.acao], 'botão secundário': [c.secundarioTexto, c.secundario],
    };
    for (const [par, [frente, fundo]] of Object.entries(pares)) {
      assert.ok(contraste(frente, fundo) >= 4.5, `${esquema}, ${par}: ${contraste(frente, fundo).toFixed(2)}:1`);
    }
    // O Stu nunca fica sobre o azul de ação nem sobre o fundo escuro: o halo lavanda é o mesmo nos dois esquemas.
    assert.equal(c.halo, CORES_EMAIL.claro.halo);
  }
  const e = CORES_EMAIL.escuro;
  for (const [nome, { html }] of Object.entries(modelos)) {
    assert.match(html, /<meta name="color-scheme" content="light dark">\n<meta name="supported-color-schemes" content="light dark">/, nome);
    const escuro = /@media \(prefers-color-scheme:dark\)\{(.*)\}\n/.exec(html)[1];
    assert.equal(escuro, [
      `.s-pagina{background-color:${e.pagina}!important;}`, `.s-cartao{background-color:${e.cartao}!important;border-color:${e.borda}!important;}`,
      `.s-caixa{background-color:${e.caixa}!important;border-color:${e.borda}!important;}`, `.s-regua{border-color:${e.borda}!important;}`,
      `.s-texto{color:${e.texto}!important;}`, `.s-texto2{color:${e.texto2}!important;}`, `.s-link{color:${e.link}!important;}`,
      `.s-botao2{background-color:${e.secundario}!important;border-color:${e.secundarioBorda}!important;}`, `.s-botao2 a{color:${e.secundarioTexto}!important;}`,
    ].join(''), nome);
    // Toda cor inline de texto, fundo claro e borda tem a classe que a troca no escuro.
    const inline = soInline(html);
    for (const marca of inline.match(/<[a-z0-9]+\b[^>]*>/g)) {
      const estilo = atributo(marca, 'style') ?? '';
      const classe = atributo(marca, 'class') ?? '';
      const c = CORES_EMAIL.claro;
      if (estilo.includes(`;color:${c.texto};`)) assert.match(classe, /\bs-texto\b/, `${nome}: ${marca}`);
      if (estilo.includes(`;color:${c.texto2};`)) assert.match(classe, /\bs-texto2\b/, `${nome}: ${marca}`);
      if (estilo.includes(`color:${c.link};`)) assert.match(classe, /\bs-link\b/, `${nome}: ${marca}`);
      if (estilo.includes(`background-color:${c.pagina};`)) assert.match(classe, /\bs-(pagina|caixa)\b/, `${nome}: ${marca}`);
      if (estilo.includes(`background-color:${c.cartao};`)) assert.match(classe, /\bs-(cartao|botao2)\b/, `${nome}: ${marca}`);
      if (new RegExp(`border(-top)?:2px solid (${c.borda}|${c.caixa});`).test(estilo)) assert.match(classe, /\bs-(cartao|caixa|regua|botao2)\b/, `${nome}: ${marca}`);
    }
  }
});

test('botões: largura toda, área de toque de 48 px e rótulo que diz aonde leva', () => {
  for (const [nome, { html }] of Object.entries(modelos)) {
    const botoes = [...html.matchAll(/<table role="presentation" width="100%"[^>]*>\s*<tr><td align="center" bgcolor="[^"]+" class="s-botao2?" style="([^"]*)"><a [^>]*style="([^"]*)">([^<]+)<\/a>/g)];
    assert.equal(botoes.length, { cadastro: 1, recuperacao: 1, existente: 2 }[nome], nome);
    for (const [, celula, link, rotulo] of botoes) {
      const [, cima, lados] = /padding:(\d+)px (\d+)px;/.exec(link);
      const altura = Number(cima) * 2 + Number(/line-height:(\d+)px/.exec(link)[1]);
      assert.ok(altura >= 48, `${nome}: “${rotulo}” tem ${altura} px de toque`);
      assert.match(link, /display:block;/);
      assert.match(link, /font-size:17px;.*font-weight:800;.*text-decoration:none;/);
      // O Outlook de computador ignora o padding do link: o respiro vem da célula.
      assert.ok(celula.includes(`mso-padding-alt:${cima}px ${lados}px;`), nome);
      assert.match(celula, /border-radius:16px;/);
      assert.match(celula, /border-bottom:[46]px solid #/, `${nome}: o lábio do botão do produto`);
      assert.ok(rotulo.length > 12 && !/clique aqui|saiba mais/i.test(rotulo), rotulo);
    }
  }
});

test('o texto simples é legível sozinho: sem marcação, sem caractere invisível, em blocos curtos', () => {
  for (const [nome, { texto }] of Object.entries(modelos)) {
    assert.doesNotMatch(texto, /<[a-z/!]|&[a-z#0-9]+;|\*\*|__|\t/i, nome);
    assert.doesNotMatch(texto, /[\u00a0\u034f\u200b-\u200f\u2060\ufeff]/, nome);
    assert.doesNotMatch(texto, /[ ]\n|\n{3,}|\r/, nome);
    assert.ok(texto.endsWith('.\n') && !texto.startsWith('\n'), nome);
    const blocos = texto.trim().split('\n\n');
    assert.ok(blocos.length >= 5, nome);
    for (const linha of texto.split('\n')) assert.ok(linha.length <= 130, `${nome}: “${linha}”`);
    assert.equal(blocos.at(-1), [
      'Studoo · Aprenda qualquer coisa, um passo de cada vez.', 'Precisa de ajuda? Fale com o suporte:', enderecos.suporte,
      'Você recebeu este e-mail porque este endereço foi informado no Studoo.',
    ].join('\n'), nome);
  }
  assert.ok(recuperacao.texto.includes(`Criar nova senha (abre o app, se ele estiver instalado, ou o site, já com o código preenchido):\n${comOCodigo.recuperacao}\n`));
  assert.equal(existente.texto.split('\n')[0], 'Você já tem uma conta no Studoo');
});

test('valores vindos de fora entram escapados no HTML', () => {
  const hostil = { cadastro: enderecos.cadastro, recuperar: 'https://studoo.example.test/recuperar?a=1&b="2"><img src=x>', entrar: enderecos.entrar, suporte: "https://studoo.example.test/suporte?x='y'" };
  const { html, texto } = emailRecuperacao({ codigo: '<b>1"&\'', enderecos: hostil });
  assert.equal(html.includes('<b>1'), false);
  assert.equal(html.includes('<img src=x>'), false);
  assert.ok(html.includes('&#60;b&#62;1&#34;&#38;&#39;</p>'));
  // O código entra no fragmento codificado para URL, e o endereço inteiro, escapado para HTML.
  assert.ok(html.includes('href="https://studoo.example.test/recuperar?a=1&#38;b=&#34;2&#34;&#62;&#60;img src=x&#62;#codigo=%3Cb%3E1%22%26&#39;"'));
  assert.ok(html.includes('href="https://studoo.example.test/suporte?x=&#39;y&#39;"'));
  assert.equal(tags(html, 'img').length, 2);
  // O texto simples não é HTML: o valor vai como veio.
  assert.ok(texto.includes(hostil.recuperar));
});

test('nenhum dado da pessoa ou do servidor entra na mensagem, e a caixa falsa guarda HTML e texto', async () => {
  const anterior = { ...process.env };
  process.env.STUDOO_ORIGEM = 'http://localhost:3100';
  process.env.EMAIL = 'falso';
  process.env.EMAIL_FROM = 'Studoo <remetente-secreto@example.test>';
  process.env.RESEND_API_KEY = 're_chave_que_nao_pode_aparecer';
  process.env.MILLIONSEND_API_KEY = 'ms_chave_que_nao_pode_aparecer';
  const para = `modelo-${randomUUID()}@example.test`;
  const pasta = '.studoo-local/emails';
  try {
    await enviarCodigoCadastro(para, '135790');
    await enviarRecuperacao(para, '246801');
    await enviarAvisoContaExistente(para);
    const cartas = [];
    for (const arquivo of await readdir(pasta)) {
      const carta = JSON.parse(await readFile(`${pasta}/${arquivo}`, 'utf8'));
      if (carta.to === para) { cartas.push(carta); await unlink(`${pasta}/${arquivo}`); }
    }
    assert.equal(cartas.length, 3);
    for (const carta of cartas) {
      assert.deepEqual(Object.keys(carta).sort(), ['html', 'subject', 'text', 'to']);
      for (const parte of [carta.subject, carta.html, carta.text]) {
        for (const segredo of [para, para.split('@')[0], 'remetente-secreto', 're_chave', 'ms_chave', 'example.test']) {
          assert.equal(parte.includes(segredo), false, `${carta.subject}: “${segredo}” não pode aparecer`);
        }
      }
      // Os links ficam na origem do servidor (aqui, a local); as imagens, sempre no site publicado.
      assert.ok(tags(carta.html, 'a').every((a) => atributo(a, 'href').startsWith('http://localhost:3100/')), carta.subject);
      assert.ok(tags(carta.html, 'img').every((i) => atributo(i, 'src').startsWith(`${SITE}/marca/`)), carta.subject);
    }
    const porAssunto = Object.fromEntries(cartas.map((c) => [c.subject, c]));
    assert.match(porAssunto['Seu código para criar a conta no Studoo'].html, />135790<\/p>/);
    assert.match(porAssunto['Seu código para criar a conta no Studoo'].text, /^Seu código do Studoo é: 135790\n/);
    assert.match(porAssunto['Seu código para recuperar a senha do Studoo'].html, />246801<\/p>/);
    assert.ok(porAssunto['Seu código para recuperar a senha do Studoo'].text.includes('\nhttp://localhost:3100/recuperar#codigo=246801\n'));
    assert.ok(porAssunto['Seu código para criar a conta no Studoo'].text.includes('\nhttp://localhost:3100/cadastro#codigo=135790\n'));
    assert.ok(porAssunto['Você já tem uma conta no Studoo'].text.includes('\nhttp://localhost:3100/login\n'));
  } finally {
    for (const chave of Object.keys(process.env)) if (!(chave in anterior)) delete process.env[chave];
    Object.assign(process.env, anterior);
  }
});
