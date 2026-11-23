import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// iPhone com iOS 26 (vidro): com o teclado aberto, o rodapé com "Verificar" fica acima do teclado (teste nativo 45105021514:
// na lacuna, o rodapé sobreposto, absoluto, ficava atrás do teclado; o KeyboardAvoidingView com "padding" só empurra o fluxo).
const interfaceApp = await readFile(new URL('../apps/mobile/src/interface.tsx', import.meta.url), 'utf8');
const inicio = interfaceApp.indexOf('export function rodapeFicaSobreposto(');
const js = ts.transpileModule(interfaceApp.slice(inicio, interfaceApp.indexOf('\n}\n', inicio) + 2).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const rodapeFicaSobreposto = new Function(`${js}; return rodapeFicaSobreposto;`)();

test('com vidro e o teclado aberto, o rodapé sai de cima do conteúdo e volta ao fluxo (acima do teclado)', () => {
  assert.equal(rodapeFicaSobreposto(true, true, false, false, false), true, 'teclado fechado: por cima, com o vidro');
  assert.equal(rodapeFicaSobreposto(true, true, false, false, true), false, 'teclado aberto: no fluxo, que o padding sobe');
  // Sem vidro (Android, iOS anterior, prévia web), com estilo próprio (retorno verde ou laranja) ou preso: nunca por cima.
  for (const [vidro, temRodape, estilo, preso] of [[false, true, false, false], [true, false, false, false], [true, true, true, false], [true, true, false, true]]) {
    assert.equal(rodapeFicaSobreposto(vidro, temRodape, estilo, preso, false), false);
  }
});

test('a Tela usa a regra, o rodapé fica dentro do KeyboardAvoidingView com "padding" e o iPhone muda o estado já no Will', () => {
  assert.match(interfaceApp, /const rodapeSobreposto = rodapeFicaSobreposto\(VIDRO, Boolean\(rodape\), Boolean\(estiloRodape\), rodapePreso, teclado\);/);
  assert.match(interfaceApp, /<KeyboardAvoidingView style=\{estilos\.tela\} behavior=\{Platform\.OS === 'web' \? undefined : 'padding'\}>/);
  assert.match(interfaceApp, /const posicao = rodapeSobreposto \? estilos\.sobreposto : null;/);
  assert.match(interfaceApp, /Platform\.OS === 'ios' \? Keyboard\.addListener\('keyboardWillShow', \(\) => setTeclado\(true\)\) : null/);
  assert.match(interfaceApp, /Platform\.OS === 'ios' \? Keyboard\.addListener\('keyboardWillHide', \(\) => setTeclado\(false\)\) : null/);
  // O rodapé desenhado depois da rolagem, dentro do KeyboardAvoidingView (o padding o põe acima do teclado).
  const kav = interfaceApp.slice(interfaceApp.indexOf('<KeyboardAvoidingView style={estilos.tela}'), interfaceApp.indexOf('</KeyboardAvoidingView>'));
  assert.match(kav, /<FundoDeBarra testID="rodape"/);
});
