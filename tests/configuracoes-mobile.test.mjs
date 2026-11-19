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

test('os textos da tela vêm do contrato, nenhum escrito no JSX', () => {
  const fonte = ts.createSourceFile('configuracoes.tsx', app, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const achados = [];
  const visitar = (no) => {
    if (ts.isJsxText(no) && /\p{L}/u.test(no.text)) achados.push(no.text.trim());
    if (ts.isJsxAttribute(no) && no.initializer && ts.isStringLiteral(no.initializer)
      && /^(accessibilityLabel|accessibilityHint|aria-label|rotulo|nomeAcessivel|titulo|texto)$/.test(no.name.getText())
      && /\p{L}/u.test(no.initializer.text)) achados.push(`${no.name.getText()}="${no.initializer.text}"`);
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
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
  assert.match(app, /avisar\(k\.capaSalva, \{ icone: 'check' \}\)/);
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
  assert.doesNotMatch(app, /presentationStyle|ActionSheetIOS|Alert\b|ToastAndroid|Picker\b/);
  assert.match(app, /<Modal transparent visible animationType="fade"/);
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
