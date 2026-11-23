// Banca (P0-2): o "Ensine ao Stu" / "Explique com suas palavras" sem IA (demonstração ou IA fora do ar) reconhece um exemplo concreto, com ou sem marca,
// e não responde "Faltou só um exemplo seu" a quem acabou de dar um. A IA de verdade não passa por esta função (só o retorno local).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { explicacaoTemExemplo } from '../src/servidor/estudio/exemplo-na-explicacao.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('o exemplo concreto sem marca conta: situação com objeto, quantidade, conta, fração, preço e comparação', () => {
  for (const texto of [
    'Numa pizza de 8 fatias, comer 3 é 3/8.', // o caso da banca
    'Num jogo de futebol, o time que faz mais gols ganha.',
    'Eu comprei 3 maçãs e comi 1.',
    'O resultado de 2 + 3 é 5.',
    'Metade de uma laranja é 1/2.',
    'Um lanche de R$ 25 dividido por 5 dá R$ 5 para cada.',
    'É como uma pizza dividida em fatias iguais.',
    'Se eu tenho metade de uma laranja, tenho 1/2.',
  ]) assert.equal(explicacaoTemExemplo(texto), true, texto);
});

test('o exemplo marcado, do jeito escrito e do jeito falado, continua contando', () => {
  for (const texto of [
    'Por exemplo, dividir um bolo.',
    'Ex.: a tarraxa afina a corda.',
    'Imagine uma barra de chocolate.',
    'Digamos que você tem um violão.',
    'Suponha que a corda esteja solta.',
    'Tipo quando a corda tá desafinada eu giro a tarraxa dela.',
    'Tipo uma pizza cortada ao meio.',
    'No meu caso, eu uso o dedo indicador.',
    'Quando eu estudo, começo pela cabeça do violão.',
  ]) assert.equal(explicacaoTemExemplo(texto), true, texto);
});

test('a explicação abstrata, a lista de termos da lição e o número solto NÃO contam (o pedido do exemplo continua valendo)', () => {
  for (const texto of [
    'Frações são partes de um inteiro: o numerador conta quantas partes e o denominador, em quantas o inteiro foi dividido.',
    'As partes que importam: cabeça, braço, corpo, tarraxa, cordas.',
    'Esse tipo de acorde é maior.', // "tipo de" é o assunto, não um exemplo
    'Quando a gente divide, a gente reparte.', // um "quando" solto
    'O número 8 é par.', // número sem o que ele conta
    '',
  ]) assert.equal(explicacaoTemExemplo(texto), false, texto);
});

test('o avaliador falso usa a função e a IA de verdade não passa por ela', () => {
  const apoio = ler('src/servidor/estudio/apoio.ts');
  assert.match(apoio, /const marcouExemplo = explicacaoTemExemplo\(explicacao\);/);
  assert.match(apoio, /const comExemplo = marcouExemplo \|\| citou \|\| frasesUsadas\.length > 0;/, 'a citação e as frases da lição continuam sendo exemplo');
  // O retorno que a IA escreve (pedirJson) não lê esta função: ela vive só dentro do retorno local.
  const funcao = apoio.slice(apoio.indexOf('function ensinoFalso('), apoio.indexOf('/** O retorno do "Explique com suas palavras" pela IA.'));
  assert.match(funcao, /explicacaoTemExemplo/);
  assert.doesNotMatch(apoio.slice(apoio.indexOf('/** O retorno do "Explique com suas palavras" pela IA.')), /explicacaoTemExemplo/);
});
