import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Voltar do app (spec 07, P17): o botão do Android e o gesto de borda do iPhone chamam a mesma função de cada tela.
// Sem React Native: o módulo roda transpilado, com um BackHandler de mentira que imita o do Android.

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const transpilar = (fonte) =>
  ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const codigo = transpilar(await ler('apps/mobile/src/voltar.ts'));

/** Carrega um voltar.ts novo (estado zerado) com um BackHandler que guarda os ouvintes e aperta "voltar" como o Android. */
function montar() {
  const doAndroid = [];
  const BackHandler = {
    addEventListener(evento, ouvinte) {
      assert.equal(evento, 'hardwareBackPress');
      doAndroid.push(ouvinte);
      return { remove: () => doAndroid.splice(doAndroid.indexOf(ouvinte), 1) };
    },
  };
  const exports = {};
  runInNewContext(codigo, {
    exports,
    require: (nome) => {
      assert.equal(nome, 'react-native', `módulo sem dublê: ${nome}`);
      return { BackHandler };
    },
  });
  // O Android chama do mais recente ao mais antigo até um devolver true; sem nenhum, fecha o app.
  const apertarVoltar = () => {
    for (const ouvinte of [...doAndroid].reverse()) if (ouvinte()) return 'tratado';
    return 'fecha o app';
  };
  return { ...exports, doAndroid, apertarVoltar };
}

test('o Android continua recebendo a mesma função pelo BackHandler, na mesma ordem', () => {
  const v = montar();
  const chamadas = [];
  const antiga = v.ouvirVoltar(() => { chamadas.push('antiga'); return true; });
  const nova = v.ouvirVoltar(() => { chamadas.push('nova'); return false; });
  assert.equal(v.doAndroid.length, 2);
  assert.equal(v.apertarVoltar(), 'tratado');
  assert.deepEqual(chamadas, ['nova', 'antiga']);
  nova.remove();
  antiga.remove();
  assert.equal(v.doAndroid.length, 0);
  assert.equal(v.apertarVoltar(), 'fecha o app');
});

test('o gesto do iPhone chama a mesma lista: a mais recente primeiro, até uma tratar; sem nenhuma, nada acontece', () => {
  const v = montar();
  const chamadas = [];
  v.ouvirVoltar(() => { chamadas.push('estudo'); return true; });
  const recuperar = v.ouvirVoltar(() => { chamadas.push('recuperar'); return true; });
  assert.equal(v.voltarPeloGesto(), true);
  assert.deepEqual(chamadas, ['recuperar']);
  recuperar.remove();
  assert.equal(v.voltarPeloGesto(), true);
  assert.deepEqual(chamadas, ['recuperar', 'estudo']);

  const vazio = montar();
  assert.equal(vazio.voltarPeloGesto(), false);
  vazio.ouvirVoltar(() => false, false);
  assert.equal(vazio.voltarPeloGesto(), false, 'Minhas trilhas: o ouvinte devolve false e o gesto não faz nada');
});

test('o gesto só começa onde há para onde voltar e sem trava; quem assina é avisado de cada mudança', () => {
  const v = montar();
  let avisos = 0;
  const parar = v.assinarGesto(() => { avisos += 1; });
  assert.equal(v.gestoLigado(), false, 'sem tela registrada (entrada): nada a fazer');
  const planos = v.ouvirVoltar(() => false, false);
  assert.equal(v.gestoLigado(), false, 'Minhas trilhas: o gesto não começa');
  planos.remove();
  const licao = v.ouvirVoltar(() => true, true);
  assert.equal(v.gestoLigado(), true);
  const soltar = v.travarGesto();
  assert.equal(v.gestoLigado(), false, 'carrossel da apresentação: o arrasto é dele');
  soltar();
  soltar();
  assert.equal(v.gestoLigado(), true, 'soltar duas vezes não desconta duas travas');
  licao.remove();
  licao.remove();
  assert.equal(v.gestoLigado(), false);
  assert.equal(avisos, 6);
  parar();
  v.ouvirVoltar(() => true);
  assert.equal(avisos, 6, 'depois de parar, sem aviso');
});

test('as telas usam o voltar comum, e só o pacote do iPhone conhece o gesto', async () => {
  const [estudo, apresentacao, recuperar, borda, bordaIos, layout] = await Promise.all([
    ler('apps/mobile/src/estudo.tsx'), ler('apps/mobile/src/apresentacao.tsx'), ler('apps/mobile/src/recuperar.tsx'),
    ler('apps/mobile/src/borda-voltar.tsx'), ler('apps/mobile/src/borda-voltar.ios.tsx'), ler('apps/mobile/app/_layout.tsx'),
  ]);
  for (const [nome, fonte] of [['estudo', estudo], ['apresentacao', apresentacao], ['recuperar', recuperar]]) {
    assert.doesNotMatch(fonte, /BackHandler/, `${nome}: o voltar passa por voltar.ts`);
    assert.match(fonte, /ouvirVoltar\(/, nome);
  }
  const arvore = ts.createSourceFile('estudo.tsx', estudo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const assinaturas = [];
  const visitar = (no) => {
    if (ts.isCallExpression(no) && no.expression.getText(arvore) === 'ouvirVoltar') assinaturas.push(no);
    ts.forEachChild(no, visitar);
  };
  visitar(arvore);
  assert.equal(assinaturas.length, 1, 'o estudo registra uma política única de gesto');
  const habilitarGesto = new Function('etapa', 'preparandoPrimeiroEstudo', `return (${assinaturas[0].arguments[1].getText(arvore)});`);
  assert.equal(habilitarGesto({ tipo: 'planos' }, false), false, 'em Minhas trilhas o gesto não começa');
  assert.equal(habilitarGesto({ tipo: 'licao' }, false), true, 'na lição o gesto chama o voltar comum');
  assert.equal(habilitarGesto({ tipo: 'objetivo' }, false), true, 'o pedido normal mantém o voltar');
  assert.equal(habilitarGesto({ tipo: 'objetivo' }, true), false, 'na preparação a navegação é do onboarding');
  assert.match(apresentacao, /useEffect\(\(\) => travarGesto\(\), \[\]\)/, 'o carrossel trava o gesto');
  assert.doesNotMatch(borda, /react-native-gesture-handler/, 'Android e web não carregam a biblioteca de gestos');
  assert.match(bordaIos, /hitSlop: \{ left: 0, width: BORDA \}/, 'só a partir da borda esquerda');
  assert.match(bordaIos, /failOffsetY: \[-12, 12\]/, 'rolagem vertical não vira voltar');
  assert.match(bordaIos, /voltarPeloGesto\(\)/);
  assert.match(layout, /<BordaDeVoltar>/);
});
