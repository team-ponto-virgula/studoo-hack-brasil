import { VALIDADE_CODIGO_MIN } from '@studoo/contratos/autenticacao';
import { mensagens } from '@studoo/contratos/experiencia';
import { ORIGEM_APP_STUDOO } from '@/enderecos-publicos';

/**
 * Os e-mails do Studoo: código de cadastro, código de recuperação de senha e aviso de conta existente.
 * Cada modelo devolve o assunto, o HTML e o texto simples. Aqui só há conteúdo e apresentação: quem recebe, quando e por qual provedor fica em `recuperacao.ts`.
 *
 * O que o HTML segue (e `tests/email-modelos.test.mjs` confere):
 * - layout em tabelas com `role="presentation"` e estilos inline, até 600 px e fluido abaixo disso. O `<style>` do `<head>` só melhora (fontes da marca, modo escuro, respiro
 *   no celular): o cliente de e-mail que o remove mostra a mesma mensagem, clara e com a pilha de reserva;
 * - nada de JavaScript, formulário, folha de estilo externa ou imagem de fundo;
 * - imagens com endereço absoluto do site publicado, tamanho fixo e texto alternativo. O cabeçalho usa o ícone (com fundo próprio) e o nome em texto: o logo em PNG é
 *   azul-marinho sobre transparente e some nos clientes que escurecem o fundo;
 * - o código é um texto só, sem espaço nem elemento entre os dígitos: dois cliques (ou tocar e segurar) selecionam os 6 de uma vez.
 */

export type EnderecosEmail = {
  /** A recuperação de senha (`/recuperar`), na origem de quem pediu. */
  recuperar: string;
  /** A entrada (`/login`). */
  entrar: string;
  /** O suporte (`/suporte`), o mesmo de "Precisa de ajuda?" na entrada e na recuperação. */
  suporte: string;
};
export type Email = { assunto: string; html: string; texto: string };

/** As cores do produto (`:root` de `src/app/globals.css`) e a versão escura, que só existe nos e-mails. Todo par de texto e fundo passa no contraste AA. */
export const CORES_EMAIL = {
  claro: {
    pagina: '#F1F4FD', cartao: '#FFFFFF', borda: '#E1E7FA', caixa: '#F1F4FD', halo: '#E9E7FF',
    texto: '#0B1B5C', texto2: '#5E6A85', link: '#1D4ED8',
    acao: '#2563FF', acaoLabio: '#1D4ED8', acaoTexto: '#FFFFFF',
    secundario: '#FFFFFF', secundarioBorda: '#E1E7FA', secundarioTexto: '#2563FF',
  },
  escuro: {
    pagina: '#0A1030', cartao: '#121B47', borda: '#27357A', caixa: '#0A1030', halo: '#E9E7FF',
    texto: '#F1F4FD', texto2: '#B9C4EA', link: '#A9C1FF',
    acao: '#2563FF', acaoLabio: '#1D4ED8', acaoTexto: '#FFFFFF',
    secundario: '#121B47', secundarioBorda: '#3A4A99', secundarioTexto: '#C9D6FF',
  },
} as const;
const C = CORES_EMAIL.claro;
const E = CORES_EMAIL.escuro;

/** Nunito no corpo e Quicksand nos títulos, como no produto. Sem elas, a letra arredondada do sistema (Apple) e depois as fontes seguras de e-mail. */
const FONTE = "Nunito,ui-rounded,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const FONTE_TITULO = `Quicksand,${FONTE}`;

/** Sempre do site publicado: o e-mail é aberto fora dele, e a origem local ou antiga do servidor não serve imagem a ninguém. */
const MARCA = `${ORIGEM_APP_STUDOO}/marca`;
export const IMAGENS_EMAIL = {
  icone: `${MARCA}/icone-192.png`,
  stu: `${MARCA}/stu/stu-acolhida-480.png`,
} as const;
export const FONTES_EMAIL = {
  nunito: `${MARCA}/nunito-wght-latim.woff2`,
  quicksand: `${MARCA}/quicksand-wght-latim.woff2`,
} as const;

const t = mensagens;
const VALIDADE = `${VALIDADE_CODIGO_MIN} minutos`;
/** No HTML, número e unidade ficam na mesma linha. */
const VALIDADE_HTML = `${VALIDADE_CODIGO_MIN}&nbsp;minutos`;
const MARCA_NOME = 'Studoo';
const MOTIVO = 'Você recebeu este e-mail porque este endereço foi informado no Studoo.';
const USO_UNICO = 'Só pode ser usado uma vez.';
const SO_O_MAIS_RECENTE = 'Pediu mais de um código? Só o mais recente funciona.';
const NAO_COMPARTILHE = 'Não compartilhe este código com ninguém.';
const COMO_COPIAR = 'Para copiar, toque no código e segure. No computador, dê dois cliques nele.';

const esc = (texto: string) => texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Texto corrido: escapado e com "e-mail" inteiro na mesma linha (no produto, o hífen também não quebra). */
const frase = (texto: string) => esc(texto).replace(/e-mail/g, '<span style="white-space:nowrap;">e-mail</span>');

const tabela = (linhas: string, extra = '') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${extra}>\n${linhas}\n</table>`;

type Texto = { topo?: number; tamanho?: number; altura?: number; peso?: number; tom?: 'texto' | 'texto2'; centro?: boolean };
/** Uma linha de texto. O respiro vem do `padding` da célula, não da margem do parágrafo (que alguns clientes zeram ou dobram). */
function linha(html: string, { topo = 0, tamanho = 17, altura = 26, peso = 400, tom = 'texto', centro = false }: Texto = {}) {
  return `<tr><td${centro ? ' align="center"' : ''} style="padding:${topo}px 0 0;">`
    + `<p class="s-${tom}" style="margin:0;font-family:${FONTE};font-size:${tamanho}px;line-height:${altura}px;mso-line-height-rule:exactly;font-weight:${peso};color:${C[tom]};${centro ? 'text-align:center;' : ''}">${html}</p>`
    + '</td></tr>';
}
/** `html` já vem escapado. */
const forte = (html: string) => `<strong class="s-texto" style="font-weight:800;color:${C.texto};">${html}</strong>`;
/** Subtítulo de seção: um `<h2>`, para quem percorre a mensagem pelos títulos no leitor de tela. */
function secao(titulo: string, { topo, tamanho = 17, altura = 26 }: { topo: number; tamanho?: number; altura?: number }) {
  return `<tr><td style="padding:${topo}px 0 0;">`
    + `<h2 class="s-texto" style="margin:0;font-family:${FONTE};font-size:${tamanho}px;line-height:${altura}px;mso-line-height-rule:exactly;font-weight:800;color:${C.texto};">${frase(titulo)}</h2>`
    + '</td></tr>';
}

/** O título com o Stu ao lado, como na entrada do produto no celular. O halo lavanda é o fundo dos momentos do Stu (spec 13). */
function cabeca(titulo: string) {
  return '<tr><td>' + tabela(
    '<tr>'
    + `<td valign="middle" style="padding:0 12px 0 0;"><h1 class="s-texto" style="margin:0;font-family:${FONTE_TITULO};font-size:26px;line-height:32px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:-0.5px;color:${C.texto};">${esc(titulo)}</h1></td>`
    + '<td width="88" valign="middle" align="right" style="width:88px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>'
    + `<td width="88" height="88" align="center" valign="middle" bgcolor="${C.halo}" style="width:88px;height:88px;border-radius:44px;background-color:${C.halo};">`
    + `<img src="${IMAGENS_EMAIL.stu}" width="64" height="62" alt="Stu, o mascote do Studoo, acenando" style="display:block;margin:0 auto;width:64px;height:62px;border:0;outline:none;text-decoration:none;">`
    + '</td></tr></table></td>'
    + '</tr>',
  ) + '</td></tr>';
}

/** O código em destaque, com o rótulo do campo em que ele é digitado e a validade logo abaixo. */
function caixaDoCodigo(codigo: string) {
  return '<tr><td style="padding:20px 0 0;">' + tabela(
    `<tr><td align="center" bgcolor="${C.caixa}" class="s-caixa" style="padding:18px 12px 18px;border:2px solid ${C.borda};border-radius:20px;background-color:${C.caixa};">`
    + tabela(
      linha(frase(t.acesso.codigo), { tamanho: 14, altura: 20, peso: 800, tom: 'texto2', centro: true })
      + '\n<tr><td align="center" style="padding:6px 0 0;">'
      + `<p class="s-texto" style="margin:0;padding:0 0 0 6px;font-family:${FONTE};font-size:40px;line-height:48px;mso-line-height-rule:exactly;font-weight:800;letter-spacing:6px;font-variant-numeric:tabular-nums;color:${C.texto};text-align:center;-webkit-user-select:all;user-select:all;">${esc(codigo)}</p>`
      + '</td></tr>\n'
      + linha(`Vale por ${VALIDADE_HTML}`, { topo: 8, tamanho: 16, altura: 22, peso: 800, centro: true }) + '\n'
      + linha(frase(USO_UNICO), { topo: 2, tamanho: 14, altura: 20, tom: 'texto2', centro: true }),
    )
    + '</td></tr>',
    ' style="border-collapse:separate;"',
  ) + '</td></tr>\n'
    + linha(frase(COMO_COPIAR), { topo: 10, tamanho: 14, altura: 20, tom: 'texto2', centro: true });
}

/**
 * Botão na largura toda. O link, que é a área de toque, tem 48 px de altura; o lábio do botão do produto é a borda de baixo da célula. No Outlook de computador, que
 * ignora o `padding` do link, o respiro vem do `mso-padding-alt` da célula.
 */
function botao(rotulo: string, endereco: string, variante: 'primario' | 'secundario', topo = 14) {
  const primario = variante === 'primario';
  const celula = primario
    ? `bgcolor="${C.acao}" class="s-botao" style="border-radius:16px;border-bottom:4px solid ${C.acaoLabio};background-color:${C.acao};mso-padding-alt:14px 20px;"`
    : `bgcolor="${C.secundario}" class="s-botao2" style="border:2px solid ${C.secundarioBorda};border-bottom:6px solid ${C.secundarioBorda};border-radius:16px;background-color:${C.secundario};mso-padding-alt:14px 20px;"`;
  const link = `display:block;padding:14px 20px;border-radius:16px;font-family:${FONTE};font-size:17px;line-height:20px;font-weight:800;`
    + `color:${primario ? C.acaoTexto : C.secundarioTexto};text-align:center;text-decoration:none;`;
  return `<tr><td style="padding:${topo}px 0 0;">` + tabela(
    `<tr><td align="center" ${celula}><a href="${esc(endereco)}" target="_blank" rel="noopener" style="${link}">${esc(rotulo)}</a></td></tr>`,
    ' style="border-collapse:separate;"',
  ) + '</td></tr>';
}

/** O fim de toda mensagem: o que fazer se a pessoa não pediu nada. */
function seNaoFoiVoce(titulo: string, texto: string) {
  return `<tr><td style="padding:24px 0 0;">${tabela(`<tr><td class="s-regua" height="2" style="height:2px;border-top:2px solid ${C.caixa};font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr>`)}</td></tr>\n`
    + secao(titulo, { topo: 18, tamanho: 15, altura: 22 }) + '\n'
    + linha(frase(texto), { topo: 4, tamanho: 15, altura: 22, tom: 'texto2' });
}

/** Regras de `<style>` que só melhoram: sem elas, valem os estilos inline. As fontes ficam num bloco separado (e fora do Outlook), para um bloco recusado não levar o outro. */
const ESTILO = [
  ':root{color-scheme:light dark;supported-color-schemes:light dark;}',
  'body{margin:0;padding:0;}',
  'img{-ms-interpolation-mode:bicubic;}',
  // Telefones, datas e endereços que o cliente transforma em link continuam com a cor e a letra do texto.
  'a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font:inherit!important;}',
  'u+#corpo a{color:inherit;text-decoration:none;font:inherit;}',
  '#MessageViewBody a{color:inherit;text-decoration:none;font:inherit;}',
  '@media (max-width:480px){.s-margem{padding:16px 10px 28px!important;}.s-miolo{padding:22px 20px 24px!important;}}',
  '@media (prefers-color-scheme:dark){'
  + `.s-pagina{background-color:${E.pagina}!important;}`
  + `.s-cartao{background-color:${E.cartao}!important;border-color:${E.borda}!important;}`
  + `.s-caixa{background-color:${E.caixa}!important;border-color:${E.borda}!important;}`
  + `.s-regua{border-color:${E.borda}!important;}`
  + `.s-texto{color:${E.texto}!important;}`
  + `.s-texto2{color:${E.texto2}!important;}`
  + `.s-link{color:${E.link}!important;}`
  + `.s-botao2{background-color:${E.secundario}!important;border-color:${E.secundarioBorda}!important;}`
  + `.s-botao2 a{color:${E.secundarioTexto}!important;}`
  + '}',
  // O Outlook.com escurece por conta própria e marca o que mudou: as mesmas cores da versão escura.
  `[data-ogsb] .s-pagina{background-color:${E.pagina}!important;}`,
  `[data-ogsb] .s-cartao{background-color:${E.cartao}!important;}`,
  `[data-ogsb] .s-caixa{background-color:${E.caixa}!important;}`,
  `[data-ogsb] .s-botao2{background-color:${E.secundario}!important;}`,
  `[data-ogsc] .s-texto{color:${E.texto}!important;}`,
  `[data-ogsc] .s-texto2{color:${E.texto2}!important;}`,
  `[data-ogsc] .s-link{color:${E.link}!important;}`,
  `[data-ogsc] .s-botao2 a{color:${E.secundarioTexto}!important;}`,
].join('\n');

const FONTES = [
  `@font-face{font-family:Nunito;font-style:normal;font-weight:200 1000;font-display:swap;src:url(${FONTES_EMAIL.nunito}) format('woff2');}`,
  `@font-face{font-family:Quicksand;font-style:normal;font-weight:300 700;font-display:swap;src:url(${FONTES_EMAIL.quicksand}) format('woff2');}`,
].join('\n');

/** A linha que aparece ao lado do assunto na caixa de entrada. O enchimento impede o cliente de completar a prévia com o resto da mensagem. */
function previa(texto: string) {
  return '<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:transparent;mso-hide:all;">'
    + `${esc(texto)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`;
}

function documento({ assunto, resumo, titulo, miolo, suporte }: { assunto: string; resumo: string; titulo: string; miolo: string; suporte: string }) {
  const rodape = tabela([
    linha(MARCA_NOME, { tamanho: 15, altura: 22, peso: 800, centro: true }),
    linha(frase(t.login.titulo), { topo: 2, tamanho: 14, altura: 20, tom: 'texto2', centro: true }),
    '<tr><td align="center" style="padding:0;">'
    + `<a href="${esc(suporte)}" target="_blank" rel="noopener" class="s-link" style="display:inline-block;padding:12px 6px;font-family:${FONTE};font-size:14px;line-height:20px;font-weight:700;color:${C.link};text-decoration:underline;">${esc(t.seguranca.precisaDeAjuda)}</a>`
    + '</td></tr>',
    linha(frase(MOTIVO), { tamanho: 14, altura: 20, tom: 'texto2', centro: true }),
  ].join('\n'));

  return `<!DOCTYPE html>
<html lang="pt-BR" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(assunto)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,p,a,h1,h2,strong,span{font-family:'Segoe UI',Arial,sans-serif!important;}</style>
<![endif]-->
<!--[if !mso]><!-->
<style>
${FONTES}
</style>
<!--<![endif]-->
<style>
${ESTILO}
</style>
</head>
<body id="corpo" class="s-pagina" style="margin:0;padding:0;width:100%;background-color:${C.pagina};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div role="article" aria-roledescription="e-mail" aria-label="${esc(assunto)}" lang="pt-BR" dir="ltr" class="s-pagina" style="background-color:${C.pagina};">
${previa(resumo)}
${tabela(`<tr><td align="center" class="s-margem" style="padding:24px 12px 32px;">
<!--[if mso]><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
${tabela([
    '<tr><td style="padding:0 4px 16px;">'
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
    + `<td width="40" valign="middle" style="width:40px;"><img src="${IMAGENS_EMAIL.icone}" width="40" height="40" alt="${MARCA_NOME}" style="display:block;width:40px;height:40px;border:0;outline:none;text-decoration:none;"></td>`
    + `<td valign="middle" aria-hidden="true" class="s-texto" style="padding:0 0 0 10px;font-family:${FONTE_TITULO};font-size:24px;line-height:40px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:-0.5px;color:${C.texto};">${MARCA_NOME}</td>`
    + '</tr></table></td></tr>',
    `<tr><td bgcolor="${C.cartao}" class="s-cartao s-miolo" style="padding:28px 28px 30px;border:2px solid ${C.borda};border-radius:24px;background-color:${C.cartao};">`
    + tabela(`${cabeca(titulo)}\n${miolo}`)
    + '</td></tr>',
    `<tr><td style="padding:20px 12px 0;">${rodape}</td></tr>`,
  ].join('\n'), ' style="max-width:600px;margin:0 auto;border-collapse:separate;"')}
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>`, ` bgcolor="${C.pagina}" class="s-pagina" style="background-color:${C.pagina};"`)}
</div>
</body>
</html>
`;
}

function rodapeDoTexto(suporte: string) {
  return `${MARCA_NOME} · ${t.login.titulo}\n${t.seguranca.precisaDeAjuda}:\n${suporte}\n${MOTIVO}`;
}

/** As duas mensagens com código têm o mesmo desenho; muda o porquê, o que fazer e o que acontece se a pessoa ignorar. */
function emailComCodigo(d: {
  assunto: string; titulo: string; motivo: string; tela: string; depois: string; codigo: string; suporte: string;
  retomar?: { texto: string; rotulo: string; endereco: string };
  naoFoiVoce: { titulo: string; texto: string };
}): Email {
  const resumo = `Seu código é ${d.codigo}. Vale por ${VALIDADE} e só pode ser usado uma vez.`;
  const miolo = [
    linha(frase(d.motivo), { topo: 14, tom: 'texto2' }),
    caixaDoCodigo(d.codigo),
    linha(`Volte para a tela ${forte(esc(d.tela))}, no app ou no site, digite o código e ${esc(d.depois)}.`, { topo: 22 }),
    linha(frase(SO_O_MAIS_RECENTE), { topo: 10, tamanho: 15, altura: 22, tom: 'texto2' }),
    ...(d.retomar ? [
      linha(frase(d.retomar.texto), { topo: 10, tamanho: 15, altura: 22, tom: 'texto2' }),
      botao(d.retomar.rotulo, d.retomar.endereco, 'secundario', 12),
    ] : []),
    seNaoFoiVoce(d.naoFoiVoce.titulo, `${d.naoFoiVoce.texto} ${NAO_COMPARTILHE}`),
  ].join('\n');
  const texto = [
    // A primeira linha é a que aparece na notificação, e os roteiros de teste leem o código dela.
    `Seu código do Studoo é: ${d.codigo}`,
    `Ele vale por ${VALIDADE} e só pode ser usado uma vez.`,
    d.motivo,
    [
      'O que fazer agora',
      `Volte para a tela “${d.tela}”, no app ou no site, digite o código e ${d.depois}.`,
      SO_O_MAIS_RECENTE,
      ...(d.retomar ? [`${d.retomar.texto.replace(/\.$/, ':')}\n${d.retomar.endereco}`] : []),
    ].join('\n'),
    `${d.naoFoiVoce.titulo}\n${d.naoFoiVoce.texto}\n${NAO_COMPARTILHE}`,
    rodapeDoTexto(d.suporte),
  ].join('\n\n') + '\n';
  return { assunto: d.assunto, html: documento({ assunto: d.assunto, resumo, titulo: d.titulo, miolo, suporte: d.suporte }), texto };
}

/** Código de posse do e-mail para criar a conta. Não leva link para o cadastro: a tela aberta do zero pede outro código. */
export function emailCodigoCadastro({ codigo, enderecos }: { codigo: string; enderecos: Pick<EnderecosEmail, 'suporte'> }): Email {
  return emailComCodigo({
    assunto: 'Seu código para criar a conta no Studoo',
    titulo: 'Falta pouco para criar sua conta',
    motivo: 'Recebemos um pedido para criar uma conta no Studoo com este e-mail. O código confirma que ele é seu.',
    tela: t.cadastro.titulo,
    depois: 'crie sua senha',
    codigo,
    suporte: enderecos.suporte,
    naoFoiVoce: { titulo: 'Não foi você?', texto: 'Pode ignorar este e-mail. Sem o código, nenhuma conta é criada.' },
  });
}

/** Código para trocar a senha. O link leva à recuperação, onde "Já tenho um código" abre o campo sem pedir outro. */
export function emailRecuperacao({ codigo, enderecos }: { codigo: string; enderecos: Pick<EnderecosEmail, 'recuperar' | 'suporte'> }): Email {
  return emailComCodigo({
    assunto: 'Seu código para recuperar a senha do Studoo',
    titulo: 'Vamos recuperar seu acesso',
    motivo: 'Recebemos um pedido para trocar a senha da sua conta no Studoo. Com o código, você cria uma nova senha.',
    tela: t.acesso.recuperar,
    depois: 'escolha a nova senha',
    codigo,
    suporte: enderecos.suporte,
    retomar: {
      texto: `Fechou a tela? Abra a recuperação de senha e toque em “${t.acesso.tenhoCodigo}”.`,
      rotulo: 'Abrir a recuperação de senha',
      endereco: enderecos.recuperar,
    },
    naoFoiVoce: { titulo: 'Não pediu a troca?', texto: 'Pode ignorar este e-mail. Sua senha continua a mesma.' },
  });
}

/** Quem tenta criar conta com um e-mail que já tem conta recebe este aviso, sem código: como entrar e como recuperar a senha. */
export function emailContaExistente({ enderecos }: { enderecos: EnderecosEmail }): Email {
  const assunto = 'Você já tem uma conta no Studoo';
  const motivo = 'Recebemos um pedido para criar uma conta no Studoo com este e-mail. Como ele já tem uma conta, não enviamos nenhum código.';
  const entrar = 'Entre do mesmo jeito de sempre, no app ou no site: com e-mail e senha, com o Google ou, no iPhone, com a Apple.';
  const recuperar = 'Peça um código de recuperação e crie uma nova senha em poucos minutos.';
  const naoFoiVoce = { titulo: 'Não foi você?', texto: 'Pode ignorar este e-mail. Nada mudou na sua conta.' };
  const miolo = [
    linha(frase(motivo), { topo: 14, tom: 'texto2' }),
    secao('Para entrar', { topo: 24 }),
    linha(frase(entrar), { topo: 4, tamanho: 15, altura: 22, tom: 'texto2' }),
    botao('Entrar no Studoo', enderecos.entrar, 'primario'),
    secao('Esqueceu a senha?', { topo: 26 }),
    linha(frase(recuperar), { topo: 4, tamanho: 15, altura: 22, tom: 'texto2' }),
    botao('Recuperar a senha', enderecos.recuperar, 'secundario'),
    seNaoFoiVoce(naoFoiVoce.titulo, naoFoiVoce.texto),
  ].join('\n');
  const texto = [
    assunto,
    motivo,
    `Para entrar\n${entrar}\n${enderecos.entrar}`,
    `Esqueceu a senha?\n${recuperar}\n${enderecos.recuperar}`,
    `${naoFoiVoce.titulo}\n${naoFoiVoce.texto}`,
    rodapeDoTexto(enderecos.suporte),
  ].join('\n\n') + '\n';
  return {
    assunto,
    html: documento({ assunto, resumo: 'Entre do jeito de sempre ou recupere a senha. Nada mudou na sua conta.', titulo: 'Você já tem uma conta', miolo, suporte: enderecos.suporte }),
    texto,
  };
}
