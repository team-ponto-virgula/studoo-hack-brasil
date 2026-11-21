import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// As telas sociais do app (perfil, compartilhar e a comunidade: Explorar, cartão de trilha, perfil de outra pessoa,
// Novidades) só mostram textos do contrato (`packages/contratos/src/experiencia.ts`, como a web): nenhuma palavra escrita
// direto no JSX. Sem React Native: só a árvore do TypeScript de cada arquivo.

const ARQUIVOS = ['comunidade.tsx', 'social.tsx', 'perfil.tsx'];

async function textosSoltos(arquivo) {
  const caminho = new URL(`../apps/mobile/src/${arquivo}`, import.meta.url);
  const fonte = ts.createSourceFile(arquivo, await readFile(caminho, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const achados = [];
  const visitar = (no) => {
    // Texto entre tags (<Text>Seguir</Text>) e texto em atributo de rótulo (accessibilityLabel="Seguir").
    if (ts.isJsxText(no) && /\p{L}/u.test(no.text)) achados.push(no.text.trim());
    if (ts.isJsxAttribute(no) && no.initializer && ts.isStringLiteral(no.initializer)
      && /^(accessibilityLabel|accessibilityHint|aria-label|rotulo|nomeAcessivel|titulo|texto|frase)$/.test(no.name.getText())
      && /\p{L}/u.test(no.initializer.text)) achados.push(`${no.name.getText()}="${no.initializer.text}"`);
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return achados;
}

for (const arquivo of ARQUIVOS) {
  test(`${arquivo}: os textos vêm do contrato, nenhum escrito no JSX`, async () => {
    assert.deepEqual(await textosSoltos(arquivo), []);
  });
}

test('a barra de baixo segue a ordem da web: Minhas trilhas, Nova trilha, Explorar e Perfil', async () => {
  const fonte = await readFile(new URL('../apps/mobile/src/interface.tsx', import.meta.url), 'utf8');
  const inicio = fonte.indexOf('function NavegacaoInferior');
  assert.ok(inicio > 0, 'NavegacaoInferior não encontrada');
  const corpo = fonte.slice(inicio, fonte.indexOf('\n}\n', inicio));
  const ordem = [...corpo.matchAll(/\{ id: '(planos|objetivo|explorar|perfil)', rotulo/g)].map((achado) => achado[1]);
  assert.deepEqual(ordem, ['planos', 'objetivo', 'explorar', 'perfil']);
});

// Acabamento do item 4 (Designer, 19/11): menu de ações com o leitor de tela da spec 11, folha da foto e barra de salvar da
// spec 10 e o número do Curtir que rola.
const corpoDe = (fonte, inicio) => {
  const comeco = fonte.indexOf(inicio);
  assert.ok(comeco >= 0, `${inicio} não encontrado`);
  return fonte.slice(comeco, fonte.indexOf('\n}\n', comeco));
};

test('menu de ações no app: o balão anuncia "Menu, N opções", recebe o foco do leitor ao abrir e cada item é um botão', async () => {
  const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
  assert.equal(mensagens.componentes.menuRotulo(1), 'Menu, 1 opção');
  assert.equal(mensagens.componentes.menuRotulo(3), 'Menu, 3 opções');
  const corpo = corpoDe(await readFile(new URL('../apps/mobile/src/interface.tsx', import.meta.url), 'utf8'), 'export function MenuDeAcoes');
  assert.match(corpo, /accessibilityLabel=\{mensagens\.componentes\.menuRotulo\(acoes\.length\)\}/);
  assert.match(corpo, /onShow=\{\(\) => focarSemRolar\(rotuloDoBalao\.current\)\}/);
  assert.match(corpo, /accessibilityViewIsModal/);
  assert.match(corpo, /onAccessibilityEscape=/);
  assert.doesNotMatch(corpo, /role="menuitem"|role=\{?'menuitem'/);
});

test('perfil: a folha da foto se chama "Foto do perfil" e a barra diz "Não salvo" com Cancelar e Salvar até 400 px', async () => {
  const fonte = await readFile(new URL('../apps/mobile/src/perfil.tsx', import.meta.url), 'utf8');
  assert.match(fonte, /<FolhaDeAcoes[^>]*titulo=\{p\.fotoFolhaTitulo\}/);
  assert.match(fonte, /comCancelar && width <= 400 \? p\.naoSalvoCurto : p\.alteracoesNaoSalvas/);
});

test('Curtir: o número antigo fica na tela enquanto sai, para o lado oposto ao do novo', async () => {
  const corpo = corpoDe(await readFile(new URL('../apps/mobile/src/comunidade.tsx', import.meta.url), 'utf8'), 'function BotaoValeu');
  assert.match(corpo, /testID=\{`\$\{testID\}-n-antigo`\}/);
  assert.match(corpo, /outputRange: \[0, -distancia\]/);
});
