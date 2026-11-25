import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// Configurações da trilha no app (apps/mobile/src/configuracoes.tsx), espelho de src/app/configuracoes.tsx com as
// medidas da revisão de design de 19/11 (spec 10). Sem React Native: só o texto e a árvore do TypeScript dos arquivos.

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const app = await ler('apps/mobile/src/configuracoes.tsx');
const web = await ler('src/app/configuracoes.tsx');
const estudo = await ler('apps/mobile/src/estudo.tsx');
const recorte = await ler('apps/mobile/src/recorte.tsx');
const perfil = await ler('apps/mobile/src/perfil.tsx');
const k = mensagens.configuracoes;

/** A posição de cada trecho no arquivo, na ordem pedida; falha se um faltar. */
function posicoes(fonte, trechos, onde) {
  return trechos.map((trecho) => {
    const posicao = fonte.indexOf(trecho);
    assert.ok(posicao >= 0, `${onde}: não achei ${trecho}`);
    return posicao;
  });
}
const crescente = (lista) => lista.every((valor, indice) => indice === 0 || valor > lista[indice - 1]);

test('os textos da tela e do recorte vêm do contrato, nenhum escrito no JSX', () => {
  const achados = [];
  for (const [nome, codigo] of [['configuracoes.tsx', app], ['recorte.tsx', recorte]]) {
  const fonte = ts.createSourceFile(nome, codigo, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const visitar = (no) => {
    if (ts.isJsxText(no) && /\p{L}/u.test(no.text)) achados.push(no.text.trim());
    if (ts.isJsxAttribute(no) && no.initializer && ts.isStringLiteral(no.initializer)
      && /^(accessibilityLabel|accessibilityHint|aria-label|rotulo|nomeAcessivel|titulo|texto)$/.test(no.name.getText())
      && /\p{L}/u.test(no.initializer.text)) achados.push(`${no.name.getText()}="${no.initializer.text}"`);
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  }
  assert.deepEqual(achados, []);
});

test('as seções e os campos seguem a ordem da web: capa, nome, descrição, tema, quem pode ver e apagar', () => {
  const ordem = ['k.capaENome', 'k.nomeRotulo', 'k.descricaoRotulo', 'k.temaRotulo', 'k.quemPodeVer', 'k.apagarTitulo'];
  const corpoDoApp = app.slice(app.indexOf('export function TelaConfiguracoes'));
  const corpoDaWeb = web.slice(web.indexOf('export function TelaConfiguracoes'));
  assert.ok(crescente(posicoes(corpoDaWeb, ordem.map((chave) => `{${chave}}`), 'web')), 'a web mudou a ordem das seções');
  assert.ok(crescente(posicoes(corpoDoApp, ordem, 'app')), 'o app não segue a ordem da web');
});

test('cada campo salva ao sair dele, sem diálogo de sair sem salvar; apagar usa a confirmação de Minhas trilhas', () => {
  assert.match(app, /onBlur=\{sairDoTitulo\}/);
  assert.match(app, /onBlur=\{sairDaDescricao\}/);
  assert.match(app, /void salvar\('tema', \{ tema \}\)/);
  assert.doesNotMatch(app, /CartaoConfirmacao/, 'a tela não tem confirmação própria: não há sair sem salvar');
  assert.match(estudo, /apagar=\{\(\) => \{ if \(resumo\) pedirParaApagar\(resumo\); \}\}/);
});

test('o estado do salvamento fica no rótulo do campo: "Salvo" some em 2,5 s e a galeria fecha em 300 ms', () => {
  assert.match(app, /const SALVO_VISIVEL_MS = 2500;/);
  assert.match(app, /const SALVO_SAIDA_MS = 200;/);
  assert.match(app, /const GALERIA_FECHA_MS = 300;/);
  for (const campo of ['titulo', 'descricao', 'tema']) {
    assert.match(app, new RegExp(`<RotuloDoCampo rotulo=\\{k\\.[a-zA-Z]+\\} estado=\\{estados\\.${campo}\\}`), `o rótulo de ${campo} mostra o estado`);
  }
  // O leitor de tela ouve a frase do campo; a capa avisa pelo aviso do app.
  assert.match(app, /announceForAccessibility\(k\.salvoLeitor\[campo\]\)/);
  assert.match(app, /avisar\(k\.capaSalva, \{ icone: 'check', som: 'salvo' \}\)/);
  assert.equal(k.salvoLeitor.titulo, 'Nome da trilha salvo.');
  assert.equal(k.salvoLeitor.descricao, 'Descrição salva.');
  assert.equal(k.salvoLeitor.tema, 'Tema salvo.');
});

test('a capa é desenhada pelo contrato, e a galeria é um grupo de escolha única com a padrão e as 12 capas', () => {
  assert.match(app, /svgCapa\(\{ codigo: semente, tema, capa:/);
  assert.match(app, /coresDaCapa\(tema, capa\)\.de/);
  assert.match(app, /\.\.\.CAPAS_GALERIA\.map\(/);
  assert.match(app, /\{ id: null, nome: k\.capaPadrao, dica: k\.capaPadraoDoTema \}/);
  const galeria = app.slice(app.indexOf('function GaleriaDeCapas'));
  assert.match(galeria, /accessibilityRole="radiogroup" accessibilityLabel=\{k\.capaTitulo\}/);
  assert.match(galeria, /accessibilityRole="radio"/);
  assert.match(galeria, /accessibilityState=\{\{ selected: escolhida, checked: escolhida/);
  // O nome acessível da prévia diz a capa atual ("Capa: X" saiu da tela).
  assert.equal(k.trocarCapaRotulo('Pôr do sol'), 'Trocar capa. Capa atual: Pôr do sol');
  assert.equal(k.capaPadraoDoTema, 'Do tema');
  assert.match(app, /accessibilityLabel=\{k\.trocarCapaRotulo\(nomeDaCapa\(conf\.capa\)\)\}/);
});

test('sem janela do sistema: a galeria é uma folha do Studoo, sem apresentação nativa nem seletor', () => {
  for (const fonte of [app, recorte]) assert.doesNotMatch(fonte, /presentationStyle|ActionSheetIOS|Alert\b|ToastAndroid|\bSlider\b/);
  assert.match(app, /<Modal transparent visible=\{visivel\} animationType="fade"/);
  // A folha fica montada e avisa quando saiu: no iPhone, a escolha da foto só abre depois dela (janelas.ts).
  assert.match(app, /onDismiss=\{aoSair\}/);
  assert.match(app, /acao=\{\(\) => \{ aoFechar\(\); depoisDeSair\(aoUsarFoto\); \}\}/);
});

test('a capa com foto: galeria ou câmera do sistema, sem o recorte do sistema, e o recorte 2:1 do Studoo com a área dos selos', () => {
  // Do sistema ficam só a galeria e a câmera (spec 07, P18): o seletor abre sem edição, e o recorte é o componente do app.
  assert.match(recorte, /allowsEditing: false/);
  assert.doesNotMatch(app, /allowsEditing/);
  assert.match(app, /<RecorteImagem imagem=\{paraRecortar\} proporcao=\{2\} titulo=\{k\.capaFotoTitulo\} dica=\{k\.capaFotoDica\} aviso=\{k\.capaFotoAviso\} comSelos/);
  assert.match(app, /cliente\.enviarCapa\(origem\.planoId, base64\)/);
  // "Usar uma foto" na largura da folha, com a ajuda embaixo, numa linha só; a escolha entre galeria e câmera é a folha do Studoo.
  assert.match(app, /<Botao rotulo=\{k\.usarFoto\} iconeAntes="camera" variante="secundario" testID="capa-usar-foto"/);
  assert.equal(k.usarFotoAjuda, 'JPG, PNG ou WebP, até 2 MB.');
  assert.match(app, /<FolhaDeAcoes visivel=\{origemDaFoto && conf\?\.planoId === planoId\} titulo=\{k\.usarFoto\}/);
  assert.equal(k.capaFotoDica, 'Arraste para posicionar e afaste os dedos para aproximar. A área marcada fica embaixo dos selos.');
  // O véu da foto só nos 45% de cima.
  assert.match(app, /capaVeu: \{ position: 'absolute', left: 0, right: 0, top: 0, height: '45%' \}/);
});

test('a foto do perfil usa o mesmo recorte, quadrado, no lugar do recorte do sistema', () => {
  assert.doesNotMatch(perfil, /allowsEditing|expo-image-picker|expo-image-manipulator/, 'o seletor e a redução da imagem moram em recorte.tsx');
  assert.match(perfil, /const imagem = await escolherImagem\(camera\);/);
  // Sem `proporcao`, o recorte é 1:1, com o círculo do avatar e os textos do perfil.
  assert.match(perfil, /<RecorteImagem imagem=\{paraRecortar\} aoCancelar=\{\(\) => setParaRecortar\(null\)\} enviar=\{enviarFotoRecortada\} \/>/);
  assert.match(recorte, /proporcao = 1, titulo = p\.recorteTitulo, dica = p\.recorteDicaToque, aviso = p\.fotoAviso/);
  // A foto vai na hora e atualiza o perfil (spec 14: o aviso diz se ela ficou em revisão).
  assert.match(perfil, /const novo = await cliente\.enviarFoto\(base64\);\s*atualizarPerfil\(novo\);/);
});

test('o recorte faz a conta da web: a foto cobre o quadro e sai com 256 a 1024 px de largura', async () => {
  // As funções puras do recorte, tiradas do arquivo e avaliadas aqui (sem React Native).
  const trecho = (nome) => {
    const inicio = recorte.indexOf(`export function ${nome}`);
    assert.ok(inicio >= 0, `${nome} não encontrada`);
    return recorte.slice(inicio, recorte.indexOf('\n}\n', inicio) + 3).replace('export ', '');
  };
  const js = ts.transpileModule(`const LADO_ENVIO_FOTO = 1024;\n${trecho('retanguloDoRecorte')}\n${trecho('limitarPosicao')}\n${trecho('bytesDoBase64')}\nexport { retanguloDoRecorte, limitarPosicao, bytesDoBase64 };`,
    { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { retanguloDoRecorte, limitarPosicao, bytesDoBase64 } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

  // Foto 4000 × 3000 num quadro de 330 de largura, 2:1, sem zoom e centrada: a largura toda e a faixa do meio.
  const foto = { largura: 4000, altura: 3000 };
  const quadro = { largura: 330, proporcao: 2 };
  const escala = 330 / 4000;
  const centro = retanguloDoRecorte(foto, quadro, { zoom: 1, x: 0, y: (165 - 3000 * escala) / 2 });
  assert.deepEqual(centro, { originX: 0, originY: 500, width: 4000, height: 2000, saida: 1024 });
  // Com zoom 4 no canto de cima à esquerda: um quarto da largura; a saída acompanha (1000 px).
  assert.deepEqual(retanguloDoRecorte(foto, quadro, { zoom: 4, x: 0, y: 0 }), { originX: 0, originY: 0, width: 1000, height: 500, saida: 1000 });
  // Foto pequena: a saída não cai abaixo de 256.
  assert.equal(retanguloDoRecorte({ largura: 200, altura: 200 }, { largura: 300, proporcao: 1 }, { zoom: 1, x: 0, y: 0 }).saida, 256);
  // O retângulo nunca passa da borda, mesmo com uma posição fora do limite.
  const fora = retanguloDoRecorte(foto, quadro, { zoom: 2, x: -5000, y: -5000 });
  assert.ok(fora.originX + fora.width <= 4000 && fora.originY + fora.height <= 3000);

  // A foto nunca deixa o fundo aparecer: a posição fica entre (quadro − tamanho) e 0.
  assert.deepEqual(limitarPosicao(50, 20, { largura: 660, altura: 495 }, { largura: 330, altura: 165 }), { x: 0, y: 0 });
  assert.deepEqual(limitarPosicao(-900, -900, { largura: 660, altura: 495 }, { largura: 330, altura: 165 }), { x: -330, y: -330 });
  assert.equal(bytesDoBase64('QUJD'), 3);
  assert.equal(bytesDoBase64('QUI='), 2);
});

test('as entradas: "Configurações" no menu do cartão, entre Compartilhar e Apagar, e a engrenagem no alto do mapa', () => {
  const menu = estudo.slice(estudo.indexOf('function MenuDoCartao'));
  const corpo = menu.slice(0, menu.indexOf('\n}\n'));
  assert.ok(crescente(posicoes(corpo, ['mensagens.compartilhar.entrada', 'mensagens.configuracoes.entrada', 'mensagens.planos.apagar'], 'MenuDoCartao')),
    'a ordem do menu é Compartilhar, Configurações e Apagar (spec 11)');
  assert.match(corpo, /testID: `\$\{testID\}-configuracoes`/);
  assert.match(estudo, /<BotaoConfigurar titulo=\{plano\.titulo\} desativado=\{ocupado\} acao=\{configurar\} \/>/);
  assert.match(app, /accessibilityLabel=\{k\.entradaRotulo\(titulo\)\}/);
  // A tela fica na seção Minhas trilhas da barra de baixo, e o voltar do aparelho devolve ao mapa quando ela veio de lá.
  assert.match(estudo, /if \(etapa\.tipo === 'configuracoes'\) return 'planos';/);
  assert.match(estudo, /etapa\.tipo === 'configuracoes' && etapa\.volta === 'plano'\) void abrirPlano\(etapa\.planoId\)/);
});

test('a capa escolhida aparece nos cartões de Minhas trilhas e no alto do mapa, como na web', () => {
  const corpoDe = (nome) => {
    const inicio = estudo.indexOf(`function ${nome}(`);
    assert.ok(inicio >= 0, `não achei ${nome}`);
    return estudo.slice(inicio, estudo.indexOf('\n}\n', inicio));
  };
  // Nos dois cartões, a capa entra no lugar da ilustração, na área inteira da cena (.plano-destaque__capa e
  // .plano-cartao__capa da web); sem capa, a ilustração de sempre.
  for (const nome of ['CartaoDestaque', 'CartaoPlano']) {
    const corpo = corpoDe(nome);
    assert.match(corpo, /\{plano\.capa \? <CapaDaTrilha semente=\{plano\.id\} tema=\{plano\.tema \?\? null\} capa=\{plano\.capa\} estilo=\{StyleSheet\.absoluteFill\} \/> : \(/,
      `${nome}: a capa no lugar da ilustração`);
    assert.ok(corpo.indexOf('<CapaDaTrilha') < corpo.indexOf('cartaoColina'), `${nome}: a colina só sem capa`);
  }
  // O selo de concluída continua por cima da capa (fica fora do condicional).
  const cartao = corpoDe('CartaoPlano');
  assert.ok(cartao.indexOf('{concluido && (') > cartao.indexOf('</>\n        )}'), 'o selo de concluída vem depois do condicional da capa');
  assert.match(web, /export function CapaDaTrilha/);

  // No mapa: .trilha-capa (4:1, até 140, cantos de 20), na imagem grande; no celular, acima da faixa parada.
  const mapa = corpoDe('TelaPlano');
  assert.match(mapa, /<CapaDaTrilha semente=\{plano\.id\} tema=\{plano\.tema \?\? null\} capa=\{plano\.capa\} grande estilo=\{estudoEstilos\.capaTrilha\} \/>/);
  assert.match(mapa, /acimaDaFaixa=\{largo \|\| !capa \? undefined : <View testID=\"capa-do-mapa\" style=\{estudoEstilos\.capaTrilhaFaixa\}>\{capa\}<\/View>\}/);
  assert.match(estudo, /capaTrilha: \{ width: '100%', aspectRatio: 4, maxHeight: 140, borderRadius: 20 \}/);
  assert.match(estudo, /capaTrilhaFaixa: \{[^}]*paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 \}/);
});

test('o Tela conta a altura do que fica acima da faixa parada, para a tela rolar até o ponto certo', async () => {
  const interfaceApp = await ler('apps/mobile/src/interface.tsx');
  assert.match(interfaceApp, /acimaDaFaixa\?: ReactNode;/);
  // O que fica acima entra entre o vão e a faixa, e a faixa presa continua sendo a última da lista de cima.
  assert.ok(crescente(posicoes(interfaceApp, ['key="vao"', 'key="acima"', 'const indiceDaFaixa'], 'Tela')));
  // A altura dele entra no deslocamento do conteúdo e na altura natural; enquanto não é medida, o deslocamento é null.
  assert.equal((interfaceApp.match(/\(faixaColada \? 0 : 20\) \+ acima \+ alturaFaixa/g) ?? []).length, 2);
  assert.match(interfaceApp, /\(comAcima && !alturaAcima\) \? null/);
});

test('a engrenagem alinha pelo centro com "Compartilhar": com o botão, os 10 de cima ficam na fileira, não nele', () => {
  assert.match(estudo, /acoesTopo: \{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 \}/);
  assert.match(estudo, /acoesTopoComCompartilhar: \{ marginTop: 10 \}/);
  assert.match(estudo, /<View style=\{\[estudoEstilos\.acoesTopo, comCompartilhar && estudoEstilos\.acoesTopoComCompartilhar\]\}>/);
  assert.match(estudo, /const comCompartilhar = Boolean\(!plano\.recebida && compartilhar\);/);
  assert.doesNotMatch(estudo, /compartilharTopo/);
  // Sem nenhum dos dois botões, a fileira nem aparece.
  assert.match(estudo, /\{\(comCompartilhar \|\| configurar\) && \(/);
});

test('salvar um campo alterado toca "salvo" (spec 12); a capa toca pelo aviso "Capa salva."', () => {
  const salvar = app.slice(app.indexOf('async function salvar('), app.indexOf('} catch (falha) {', app.indexOf('async function salvar(')));
  assert.match(salvar, /if \(!vigente\(\)\) return false;[\s\S]*marcar\(campo, 'salvo'\);/);
  const campoSalvo = /if \(campo !== 'capa'\) \{([^}]+)\}/.exec(salvar)?.[1] ?? '';
  assert.match(campoSalvo, /AccessibilityInfo\.announceForAccessibility\(k\.salvoLeitor\[campo\]\);/);
  assert.match(campoSalvo, /void tocaSons\.tocarEfeito\('salvo'\);/);
  // "Capa salva." toca "salvo" pelo aviso do app (o padrão do aviso seria o efeito "aviso").
  // A capa com foto pode ficar em revisão (spec 14): o mesmo aviso, com o texto da revisão no lugar de "Capa salva.".
  assert.equal((app.match(/avisar\(k\.capaSalva, \{ icone: 'check', som: 'salvo' \}\);/g) ?? []).length, 1);
  assert.match(app, /avisar\(novo\.capaModeracao === 'pendente' \? mensagens\.seguranca\.enviadaParaRevisao : k\.capaSalva, \{ icone: 'check', som: 'salvo' \}\);/);
  assert.doesNotMatch(app, /avisar\(k\.capaSalva, \{ icone: 'check' \}\)/);
  // Só chega ao salvar com mudança: o nome e a descrição comparam com o que está salvo; o tema, com o tema atual.
  assert.match(app, /if \(normal === salvo\.titulo && !ultimasEmFila\.current\.titulo\) \{/);
  assert.match(app, /if \(normal === \(salvo\.descricao \?\? ''\) && !ultimasEmFila\.current\.descricao\) return;/);
  assert.match(app, /if \(!desativado && conf\.tema !== tema\) void salvar\('tema', \{ tema \}\);/);
});

test('o "Voltar" tem 48 de altura e o toque cresce 12 por fora, como todo botão de texto (spec 04, banca da noite §9)', () => {
  const voltar = app.slice(app.indexOf('function Voltar('), app.indexOf('\n}\n', app.indexOf('function Voltar(')));
  assert.match(voltar, /<Pressable testID="configuracoes-voltar" accessibilityRole="button" onPress=\{acao\} hitSlop=\{12\}/);
  // O desenho não muda: 48 de altura, 10 de respiro nos lados e a margem de -8 que alinha a seta com o título.
  assert.match(app, /voltar: \{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 48, marginLeft: -8, paddingHorizontal: 10 \}/);
});
