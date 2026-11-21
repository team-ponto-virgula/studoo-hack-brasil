// Refinamento da UI (spec 16), item 23: a ordem das opções é a mesma na web e no app para a mesma tentativa, e a revisão embaralha de verdade.
// Antes, cada cliente sorteava a sua semente (Math.random) a cada visita; agora a semente sai do id da lição, do índice do exercício e da rodada,
// e a função é do contrato (@studoo/contratos), a mesma para os dois clientes. O servidor não muda: ordenar e associar já chegam em ordem fixa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { embaralharExercicioDaRodada, embaralharExercicio, sementeDasOpcoes } from '@studoo/contratos';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const ids = (lista) => lista.map(({ id }) => id).join('');
const escolha = (letras = 'abcd') => ({ tipo: 'multipla_escolha', enunciado: 'Qual?', opcoes: [...letras].map((id) => ({ id, texto: id.toUpperCase() })) });
const verdadeiroOuFalso = (letras = 'pqr') => ({ tipo: 'verdadeiro_falso', enunciado: 'Julgue.', afirmacao: 'A água ferve a 100 °C.', justificativas: [...letras].map((id) => ({ id, texto: id.toUpperCase() })) });

test('item 23: a semente é uma função só do id da lição, do índice do exercício e da rodada (valores fixos: o app e a web precisam bater byte a byte)', () => {
  assert.equal(sementeDasOpcoes('licao-1', 0, 0), 274213621);
  assert.equal(sementeDasOpcoes('licao-1', 0, 1), 257436002);
  assert.equal(sementeDasOpcoes('licao-1', 1, 0), 2715051442);
  assert.equal(sementeDasOpcoes('clx9a8b7c0001', 2, 3), 22203236);
  assert.equal(sementeDasOpcoes('licao-7', 1, 0), 3552558328);
  // Sempre um inteiro sem sinal de 32 bits (é o que o mulberry32 do contrato consome) e sem depender de relógio nem de sorteio.
  for (let rodada = 0; rodada < 50; rodada += 1) {
    const semente = sementeDasOpcoes('licao-x', 3, rodada);
    assert.ok(Number.isInteger(semente) && semente >= 0 && semente < 2 ** 32, String(semente));
    assert.equal(semente, sementeDasOpcoes('licao-x', 3, rodada));
  }
});

test('item 23: a mesma tentativa tem a mesma ordem (a escolha e os porquês do verdadeiro/falso), em qualquer chamada, de qualquer cliente', () => {
  // Valores fixos da ordem: se o algoritmo mudasse, a web e o app (que usam esta mesma função) mudariam juntos, e este teste avisaria.
  const ordens = [0, 1, 2, 3, 4].map((rodada) => ids(embaralharExercicioDaRodada(escolha(), 'licao-7', 1, rodada).opcoes));
  assert.deepEqual(ordens, ['bcda', 'dcba', 'badc', 'bdca', 'cadb']);
  const porques = [0, 1, 2, 3].map((rodada) => ids(embaralharExercicioDaRodada(verdadeiroOuFalso(), 'licao-7', 2, rodada).justificativas));
  assert.deepEqual(porques, ['qpr', 'rqp', 'qrp', 'rpq']);
  // "Outro cliente": o exercício chega do servidor como JSON novo, e a ordem sai igual.
  const doServidor = JSON.parse(JSON.stringify(escolha()));
  assert.equal(ids(embaralharExercicioDaRodada(doServidor, 'licao-7', 1, 0).opcoes), 'bcda');
  // O original não muda, e nenhuma opção se perde nem se repete.
  const original = escolha();
  embaralharExercicioDaRodada(original, 'licao-7', 1, 2);
  assert.equal(ids(original.opcoes), 'abcd');
  for (const rodada of [0, 1, 2, 5, 9]) assert.deepEqual([...ids(embaralharExercicioDaRodada(escolha('abcde'), 'licao-9', 0, rodada).opcoes)].sort(), [...'abcde']);
});

test('item 23: lição, exercício e rodada diferentes dão ordens diferentes (a certa não fica sempre no mesmo lugar, nem dá para decorar a posição)', () => {
  const primeiras = new Map();
  for (let licao = 0; licao < 400; licao += 1) {
    const primeira = embaralharExercicioDaRodada(escolha(), `licao-${licao}`, 0, 0).opcoes[0].id;
    primeiras.set(primeira, (primeiras.get(primeira) ?? 0) + 1);
  }
  assert.equal(primeiras.size, 4, 'as quatro opções aparecem em primeiro lugar em alguma lição');
  for (const [id, vezes] of primeiras) assert.ok(vezes > 60 && vezes < 140, `${id} em primeiro ${vezes} de 400 vezes: perto de 25% (sorteio parelho)`);
  // Dentro de uma lição, dois exercícios com as mesmas opções não repetem a ordem em fila.
  const seguidos = Array.from({ length: 3 }, (_, indice) => ids(embaralharExercicioDaRodada(escolha(), 'licao-3', indice, 0).opcoes));
  assert.ok(new Set(seguidos).size > 1, seguidos.join(' '));
});

test('item 23: a revisão embaralha de verdade: a ordem de uma rodada nunca repete a da anterior (com 2, 3, 4 ou 5 opções)', () => {
  for (const letras of ['ab', 'abc', 'abcd', 'abcde']) {
    for (let licao = 0; licao < 120; licao += 1) {
      let anterior = ids(embaralharExercicioDaRodada(escolha(letras), `licao-${licao}`, 0, 0).opcoes);
      for (let rodada = 1; rodada <= 6; rodada += 1) {
        const atual = ids(embaralharExercicioDaRodada(escolha(letras), `licao-${licao}`, 0, rodada).opcoes);
        assert.notEqual(atual, anterior, `${letras}, lição ${licao}, rodada ${rodada}`);
        anterior = atual;
      }
    }
  }
  // Com uma opção só (ou nenhuma), não há o que embaralhar e nada quebra.
  assert.equal(ids(embaralharExercicioDaRodada(escolha('a'), 'licao-1', 0, 4).opcoes), 'a');
  assert.deepEqual(embaralharExercicioDaRodada(escolha(''), 'licao-1', 0, 4).opcoes, []);
  // Rodada fora do normal (negativa, fracionária ou NaN) vale como a abertura da lição.
  for (const estranha of [-3, 0.9, Number.NaN]) assert.equal(ids(embaralharExercicioDaRodada(escolha(), 'licao-7', 1, estranha).opcoes), 'bcda');
});

test('item 23: ordenar, associar, aberta e "Sua vez" ficam como o servidor mandou (a ordem deles já é a mesma para todos)', () => {
  const ordenar = { tipo: 'ordenar', enunciado: 'Ordene.', itens: [{ id: 'x', texto: 'X' }, { id: 'y', texto: 'Y' }, { id: 'z', texto: 'Z' }] };
  const associar = { tipo: 'associar', enunciado: 'Una.', esquerda: [{ id: 'e1', texto: '1' }, { id: 'e2', texto: '2' }], direita: [{ id: 'd2', texto: 'B' }, { id: 'd1', texto: 'A' }] };
  const aberta = { tipo: 'aberta', enunciado: 'Explique.', minimo: 40 };
  for (const exercicio of [ordenar, associar, aberta]) assert.equal(embaralharExercicioDaRodada(exercicio, 'licao-1', 0, 3), exercicio, `${exercicio.tipo}: o mesmo objeto, sem mexer`);
  // A função antiga (semente avulsa) continua existindo para quem já a usa; só deixou de ser o jeito da aula.
  assert.deepEqual(ids(embaralharExercicio(escolha(), 3).opcoes).length, 4);
});

test('item 23: a aula da web usa a semente do contrato (id da lição, índice, rodada) e não sorteia mais a cada visita', () => {
  const aula = ler('src/app/aula.tsx');
  assert.match(aula, /embaralharExercicioDaRodada\(exercicio, licao\.id, numero, rodadaDeOpcoes\)/);
  assert.doesNotMatch(aula, /Math\.random/, 'nada de sorteio na aula: a ordem é a mesma na web e no app');
  assert.doesNotMatch(aula, /embaralharExercicio\(/, 'a semente avulsa saiu da aula');
  assert.match(aula, /setRodadaDeOpcoes\(/, 'a revisão rápida continua subindo a rodada');
});
