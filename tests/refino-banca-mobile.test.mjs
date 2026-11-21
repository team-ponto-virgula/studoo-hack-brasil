import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Banca do Mobile & QA (21/11), itens do app. P0-3: a trilha recebida de quem excluiu a conta nunca monta "Esta trilha é de "
// (nem "Compartilhada por ") com o nome vazio; a linha some, e a trilha continua recebida (sem compartilhar de novo).
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const social = await ler('social.tsx');
const configuracoes = await ler('configuracoes.tsx');
const estudo = await ler('estudo.tsx');

function funcao(fonte, nome) {
  const inicio = fonte.indexOf(`export function ${nome}(`);
  const fim = fonte.indexOf('\n}\n', inicio) + 2;
  const js = ts.transpileModule(fonte.slice(inicio, fim).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(`${js}; return ${nome};`)();
}

test('P0-3: sem nome (vazio, espaços ou null), não há nome de quem compartilhou', () => {
  const nomeDeQuemCompartilhou = funcao(social, 'nomeDeQuemCompartilhou');
  assert.equal(nomeDeQuemCompartilhou({ nome: 'Carla Mendes' }), 'Carla Mendes');
  assert.equal(nomeDeQuemCompartilhou({ nome: '  Ana ' }), 'Ana');
  for (const vazio of [{ nome: '' }, { nome: '   ' }, { nome: null }, {}, null, undefined]) assert.equal(nomeDeQuemCompartilhou(vazio), null);
});

test('P0-3: o mapa, a marca do cartão e as configurações só montam a frase com nome', () => {
  const recebida = social.slice(social.indexOf('export function TrilhaRecebida('), social.indexOf('\n}\n', social.indexOf('export function TrilhaRecebida(')));
  assert.match(recebida, /const nome = nomeDeQuemCompartilhou\(recebida\);/);
  assert.match(recebida, /\{nome && <FraseComNome frase=\{m\.recebidaDe\(nome\)\}/);
  assert.doesNotMatch(recebida, /m\.recebidaDe\(recebida\.nome\)/);
  const marca = social.slice(social.indexOf('export function MarcaCompartilhar('), social.indexOf('export function TrilhaRecebida('));
  assert.match(marca, /const nome = nomeDeQuemCompartilhou\(marcas\.recebida\);\n    if \(!nome\) return null;/);
  // Configurações: '' continua recebida (sem "Quem pode ver" e com a capa de quem recebe), mas sem a frase.
  assert.match(estudo, /recebidaDe=\{resumo\?\.recebida \? resumo\.recebida\.nome \?\? '' : null\}/);
  assert.match(configuracoes, /\{recebidaDe\?\.trim\(\) \? <Text testID="configuracoes-recebida"/);
  assert.match(configuracoes, /daDona=\{recebidaDe == null\}/);
  assert.match(configuracoes, /\{compartilhar && recebidaDe == null && \(/);
});
