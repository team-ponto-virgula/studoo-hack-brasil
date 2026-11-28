import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Regra do dono (lote 4, 19/11): nenhum pop-up ou janela do sistema no app. Menus, confirmações, avisos, folhas e
// seletores são componentes do próprio Studoo, os mesmos no iPhone, no Android e na web. Do sistema, só o que ele obriga:
// pedido de permissão, câmera e galeria (e o seletor de arquivo), a lista de apps do "compartilhar com…", o navegador
// (entrar com Google e links de fora) e o teclado. Este teste lê o código do app e trava a volta das janelas do sistema.

const pasta = new URL('../apps/mobile/src/', import.meta.url);
const arquivos = readdirSync(pasta).filter((nome) => /\.(tsx|ts)$/.test(nome));
const fontes = new Map(arquivos.map((nome) => [nome, ts.createSourceFile(nome, readFileSync(new URL(nome, pasta), 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)]));
const PROIBIDOS = new Set(['Alert', 'ActionSheetIOS', 'ToastAndroid']);

function linha(fonte, no) {
  return fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
}

test('nenhum Alert, ActionSheetIOS nem ToastAndroid no app (nem importado, nem chamado)', () => {
  const achados = [];
  for (const [nome, fonte] of fontes) {
    const visitar = (no) => {
      if (ts.isImportDeclaration(no) && ts.isStringLiteral(no.moduleSpecifier) && no.moduleSpecifier.text === 'react-native') {
        for (const elemento of no.importClause?.namedBindings && ts.isNamedImports(no.importClause.namedBindings) ? no.importClause.namedBindings.elements : []) {
          const importado = (elemento.propertyName ?? elemento.name).text;
          if (PROIBIDOS.has(importado)) achados.push(`${nome}:${linha(fonte, elemento)} importa ${importado} de react-native`);
        }
      }
      // Alert.alert(…), Alert.prompt(…), ActionSheetIOS.showActionSheetWithOptions(…), ToastAndroid.show(…), também por
      // outro caminho (ReactNative.Alert.alert).
      if (ts.isPropertyAccessExpression(no) && PROIBIDOS.has(no.name.text) === false && ts.isIdentifier(no.expression) && PROIBIDOS.has(no.expression.text)) {
        achados.push(`${nome}:${linha(fonte, no)} usa ${no.getText(fonte)}`);
      }
      if (ts.isPropertyAccessExpression(no) && PROIBIDOS.has(no.name.text)) achados.push(`${nome}:${linha(fonte, no)} usa ${no.getText(fonte)}`);
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
  }
  assert.deepEqual(achados, []);
});

test('nenhum Modal com apresentação de folha do sistema (pageSheet, formSheet) e nenhum seletor nativo', () => {
  const achados = [];
  for (const [nome, fonte] of fontes) {
    const visitar = (no) => {
      if (ts.isJsxAttribute(no) && no.name.getText(fonte) === 'presentationStyle') achados.push(`${nome}:${linha(fonte, no)} ${no.getText(fonte)}`);
      if (ts.isImportDeclaration(no) && ts.isStringLiteral(no.moduleSpecifier)
        && /(picker\/picker|datetimepicker|date-picker|action-sheet|react-native-modal|menu)$/i.test(no.moduleSpecifier.text)) {
        achados.push(`${nome}:${linha(fonte, no)} importa ${no.moduleSpecifier.text}`);
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
  }
  const pacote = JSON.parse(readFileSync(new URL('../apps/mobile/package.json', import.meta.url), 'utf8'));
  for (const dependencia of Object.keys({ ...pacote.dependencies, ...pacote.devDependencies })) {
    if (/(picker\/picker|datetimepicker|date-picker|action-sheet|react-native-modal$|context-menu|zeego)/i.test(dependencia)) achados.push(`apps/mobile/package.json: ${dependencia}`);
  }
  assert.deepEqual(achados, []);
});

test('o menu de ações, a folha e a confirmação são os mesmos em toda plataforma (sem ramo por Platform)', () => {
  const componentes = [['estudo.tsx', 'MenuDoCartao'], ['comunidade.tsx', 'MenuCartao'], ['interface.tsx', 'MenuDeAcoes'], ['interface.tsx', 'FolhaDeAcoes'],
    ['interface.tsx', 'CartaoConfirmacao']];
  const achados = [];
  for (const [nome, componente] of componentes) {
    const fonte = fontes.get(nome);
    let corpo = null;
    const visitar = (no) => {
      if (ts.isFunctionDeclaration(no) && no.name?.text === componente) corpo = no;
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
    assert.ok(corpo, `${componente} não encontrado em ${nome}`);
    if (/\bPlatform\.OS\b/.test(corpo.getText(fonte))) achados.push(`${nome}: ${componente} decide pela plataforma`);
  }
  assert.deepEqual(achados, []);
});
