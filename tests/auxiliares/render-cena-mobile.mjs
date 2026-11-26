import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as visual from '../../packages/contratos/src/onboarding-visual.ts';

// Executa a composição de produção; só os nós nativos e o desenho já aprovado do Stu são representados por nós JSX.
const fonte = await readFile(new URL('../../apps/mobile/src/onboarding-visual.tsx', import.meta.url), 'utf8');
const codigo = ts.transpileModule(fonte, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const elemento = (type, props) => ({ type, props });
const modulos = {
  'react/jsx-runtime': { jsx: elemento, jsxs: elemento },
  'react-native': { View: 'View', StyleSheet: { create: estilos => estilos } },
  '@studoo/contratos/onboarding-visual': visual,
  './mascote': { Stu: 'Stu' },
};
const api = {};
runInNewContext(codigo, {
  exports: api,
  require(nome) { assert.ok(nome in modulos, `módulo da cena sem dublê: ${nome}`); return modulos[nome]; },
});

export const renderizarCenaStu = props => api.CenaStuOnboarding(props);
export function nosDaCena(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nosDaCena);
  if (!arvore || typeof arvore !== 'object') return [];
  return [arvore, ...nosDaCena(arvore.props?.children)];
}
export const estiloDaCena = valor => Object.assign({}, ...[valor].flat(Infinity).filter(Boolean));
