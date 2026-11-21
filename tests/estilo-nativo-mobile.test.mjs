import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Estilo que some no aparelho e aparece no navegador. No Yoga do React Native (useWebDefaults desligado), um `flex`
// positivo troca a base `auto` por 0 (Node::processFlexBasis): um `flexBasis: 'auto'` escrito por cima não vale, e com
// `flexGrow: 0` o elemento fica com largura zero. No navegador (a prévia web do app), a base `auto` vale e tudo aparece.
// Foi o que esvaziou as fichas do Ordenar no iPhone (lote 3 do dono, 19/11). Este teste lê os estilos do app e recusa
// a mistura em qualquer lista de estilos e em qualquer estilo sozinho.

const pasta = new URL('../apps/mobile/src/', import.meta.url);
const arquivos = readdirSync(pasta).filter((nome) => /\.(tsx|ts)$/.test(nome));
const CHAVES = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis']);

function literal(no) {
  if (ts.isNumericLiteral(no)) return Number(no.text);
  if (ts.isPrefixUnaryExpression(no) && no.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(no.operand)) return -Number(no.operand.text);
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return no.text;
  return undefined;
}

function propsDe(objeto) {
  const props = {};
  for (const prop of objeto.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const nome = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (!nome || !CHAVES.has(nome)) continue;
    const valor = literal(prop.initializer);
    if (valor !== undefined) props[nome] = valor;
  }
  return props;
}

/** `flex` positivo com a base `auto` escrita ou sem crescer: no Yoga do aparelho, a base vira 0. */
function problema(props) {
  if (!(typeof props.flex === 'number' && props.flex > 0)) return null;
  if (props.flexBasis === 'auto') return 'flex positivo com flexBasis "auto" (no aparelho a base vira 0)';
  if (props.flexGrow === 0) return 'flex positivo com flexGrow 0 (no aparelho a largura vira 0)';
  return null;
}

const fontes = new Map(arquivos.map((nome) => [nome, ts.createSourceFile(nome, readFileSync(new URL(nome, pasta), 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)]));

// As folhas de estilo de cada arquivo: const NOME = StyleSheet.create({ chave: { ... } }).
const folhas = new Map();
for (const [nome, fonte] of fontes) {
  const visitar = (no) => {
    if (ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) && no.initializer && ts.isCallExpression(no.initializer)
      && no.initializer.expression.getText(fonte) === 'StyleSheet.create' && no.initializer.arguments[0] && ts.isObjectLiteralExpression(no.initializer.arguments[0])) {
      const chaves = new Map();
      for (const prop of no.initializer.arguments[0].properties) {
        if (ts.isPropertyAssignment(prop) && ts.isObjectLiteralExpression(prop.initializer)) chaves.set(prop.name.getText(fonte), { props: propsDe(prop.initializer), no: prop });
      }
      folhas.set(`${nome}:${no.name.text}`, chaves);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
}

/** `estilos.texto` no arquivo; sem folha com esse nome nele, a de outro arquivo (as exportadas de interface.tsx). */
function resolver(arquivo, folha, chave) {
  const propria = folhas.get(`${arquivo}:${folha}`);
  if (propria) return propria.get(chave)?.props;
  const deFora = folhas.get(`interface.tsx:${folha}`) ?? [...folhas.entries()].find(([id]) => id.endsWith(`:${folha}`))?.[1];
  return deFora?.get(chave)?.props;
}

function propsDoItem(arquivo, fonte, item) {
  if (ts.isParenthesizedExpression(item)) return propsDoItem(arquivo, fonte, item.expression);
  if (ts.isPropertyAccessExpression(item) && ts.isIdentifier(item.expression)) return resolver(arquivo, item.expression.text, item.name.text) ?? {};
  if (ts.isObjectLiteralExpression(item)) return propsDe(item);
  if (ts.isBinaryExpression(item) && item.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return propsDoItem(arquivo, fonte, item.right);
  if (ts.isConditionalExpression(item)) return { ...propsDoItem(arquivo, fonte, item.whenFalse), ...propsDoItem(arquivo, fonte, item.whenTrue) };
  return {};
}

test('nenhum estilo sozinho mistura flex positivo com base "auto" ou sem crescer', () => {
  const achados = [];
  for (const [id, chaves] of folhas) {
    for (const [chave, { props, no }] of chaves) {
      const motivo = problema(props);
      if (motivo) achados.push(`${id}.${chave} (linha ${fontes.get(id.split(':')[0]).getLineAndCharacterOfPosition(no.getStart()).line + 1}): ${motivo}`);
    }
  }
  assert.deepEqual(achados, []);
});

test('nenhuma lista de estilos do app soma flex positivo com base "auto" ou sem crescer', () => {
  const achados = [];
  for (const [arquivo, fonte] of fontes) {
    const visitar = (no) => {
      if (ts.isJsxAttribute(no) && /^(style|face|estilo\w*)$/.test(no.name.getText(fonte)) && no.initializer && ts.isJsxExpression(no.initializer)
        && no.initializer.expression && ts.isArrayLiteralExpression(no.initializer.expression)) {
        const props = Object.assign({}, ...no.initializer.expression.elements.map((item) => propsDoItem(arquivo, fonte, item)));
        const motivo = problema(props);
        if (motivo) achados.push(`${arquivo}:${fonte.getLineAndCharacterOfPosition(no.getStart()).line + 1} ${no.initializer.expression.getText(fonte).slice(0, 120)}: ${motivo}`);
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
  }
  assert.deepEqual(achados, []);
});

test('o texto do cartão do Ordenar (lista única) encolhe e quebra em linhas, sem o atalho `flex`', () => {
  // As fichas do modelo antigo ficavam vazias no iPhone (lote 3): no Yoga do aparelho, `flex: 1` troca a base `auto` por 0.
  // No cartão da lista única, a linha tem a largura toda: o texto cresce, encolhe e quebra com as três propriedades à parte.
  const props = resolver('ordenar.tsx', 'estilosOrdenar', 'texto') ?? {};
  assert.equal(props.flex, undefined, 'sem o atalho flex');
  assert.equal(props.flexShrink, 1, 'o texto encolhe e quebra quando passa da largura');
  assert.equal(props.flexGrow, 1, 'e ocupa o que sobra da linha, entre o número e a alça');
});
