// Onboarding e primeira vez (spec 17, mudanças 1 e 2): os textos do contrato que a web e o app leem (as frases da espera da geração, a faixa da proposta e o tour
// "Ver como funciona") e a conta da espera, a mesma nas duas plataformas. A tela de cada cliente tem o teste dela; aqui é só o contrato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICAS_DA_ESPERA_LONGA, ESPERA_DA_GERACAO, dicaDaEspera, dicaDaEsperaLonga, faltaParaTrocarADica, faltaParaTrocarADicaLonga } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';

const g = mensagens.geracao;
const passos = mensagens.apresentacao.passos;

test('as frases da espera: as três da spec 17 (revista em 23/11), em ordem, verdadeiras para conta e visitante, sem número nem promessa; "Escrevendo suas lições…" não promete segundos', () => {
  assert.deepEqual(g.dicas, [
    'Lições curtas, com exercício e retorno na hora.',
    'Errou? O Stu explica de outro jeito.',
    'Cada lição concluída fica marcada no mapa.',
  ]);
  for (const frase of g.dicas) {
    assert.doesNotMatch(frase, /\d/, `sem número que não medimos: ${frase}`);
    assert.doesNotMatch(frase, /minuto|segundo|\bsempre\b|\bnunca\b|garant|salv/i, `sem promessa (nem "salvo": o progresso do visitante dura 24 h neste aparelho): ${frase}`);
    assert.doesNotMatch(frase, /^Dica:/, 'as dicas antigas, que ninguém usava, saíram');
    assert.ok(frase.length <= 48, `cabe em 2 linhas de 15 px em 320 px (${frase.length} caracteres): ${frase}`);
    assert.ok(frase.endsWith('.'), frase);
  }
  assert.equal(new Set(g.dicas).size, 3, 'nenhuma repetida');
  assert.ok(!g.dicas.includes('Você confere a trilha antes de começar.'), 'saiu: na criação a pessoa já conferiu a trilha, e a frase deixaria de ser verdadeira');
  // A linha embaixo do botão: a criação leva de 12 a 21 s, então o texto não diz "alguns segundos" (a nota fixa de antes saiu).
  assert.equal(g.escrevendoLicoes, 'Escrevendo suas lições…');
  assert.doesNotMatch(g.escrevendoLicoes, /segundo|\bIA\b/);
  // Não existe a etapa "Pronto!" nem a chave nova que a ideia antiga pedia: ao ficar pronta, a placa mostra a faixa da proposta.
  assert.equal(g.pronta, 'Trilha pronta', 'a chave que já existia segue como está (a ideia do "Pronto!" saiu)');
  assert.equal(g.montandoTitulo, 'Montando sua trilha');
  assert.equal(g.criandoTrilha, 'Criando sua trilha…');
  assert.equal(g.anuncioCriando, 'Criando sua trilha.');
  assert.equal(g.aguardandoLicao, 'Ainda montando a próxima lição…', 'a espera longa da geração não muda');
});

test('a faixa da proposta: "Sua trilha está pronta: N lições curtas em M partes.", sem "em M partes" com uma parte só e "1 lição curta" com uma só', () => {
  assert.equal(g.propostaPronta(10, 3), 'Sua trilha está pronta: 10 lições curtas em 3 partes.');
  assert.equal(g.propostaPronta(6, 3), 'Sua trilha está pronta: 6 lições curtas em 3 partes.');
  assert.equal(g.propostaPronta(7, 2), 'Sua trilha está pronta: 7 lições curtas em 2 partes.');
  assert.equal(g.propostaPronta(4, 1), 'Sua trilha está pronta: 4 lições curtas.');
  assert.equal(g.propostaPronta(2, 1), 'Sua trilha está pronta: 2 lições curtas.');
  assert.equal(g.propostaPronta(1, 1), 'Sua trilha está pronta: 1 lição curta.');
  assert.doesNotMatch(g.propostaPronta(10, 3), /Proposta/, '"proposta" é palavra de dentro do produto');
});

test('o tour: os passos 1 a 4 da spec 17, sem palavras de dentro do produto; o 5º (só com sessão) não mudou', () => {
  assert.deepEqual(passos.slice(0, 4), [
    { titulo: 'Seu material vira lição', texto: 'Mande um PDF ou uma foto. O Stu monta lições e mostra de onde tirou cada ideia.' },
    { titulo: 'Errou? Tem outro jeito', texto: 'O Stu explica a mesma ideia por outro caminho, em 3 passos curtos, e você tenta de novo.' },
    { titulo: 'Explique do seu jeito', texto: 'Conte ao Stu o que entendeu. Ele mostra o que fez sentido e o que revisar.' },
    { titulo: 'Seu caminho fica no mapa', texto: 'Cada lição concluída fica marcada, e você continua de onde parou.' },
  ]);
  assert.deepEqual(passos[4], { titulo: 'O que te interessa?', texto: 'Escolha uma área para ver ideias de trilha primeiro. Dá para mudar depois.' });
  assert.equal(passos.length, 5);
  for (const { titulo, texto } of passos.slice(0, 4)) {
    assert.doesNotMatch(`${titulo} ${texto}`, /\bponte\b|cartões|citação|proposta|objetivos/i, `palavra de dentro: ${titulo}`);
  }
  // O 4º passo vale para conta e para visitante: não promete "salvo" nem "no computador ou no celular" (o progresso do visitante dura 24 h neste aparelho).
  assert.doesNotMatch(`${passos[3].titulo} ${passos[3].texto}`, /salv|computador|celular/i);
});

test('a conta da espera: 3 s de "Escrevendo suas lições…", depois uma frase nova a cada 5 s, em laço (a mesma na web e no app)', () => {
  assert.deepEqual([ESPERA_DA_GERACAO.antesDaPrimeiraMs, ESPERA_DA_GERACAO.trocaACadaMs, ESPERA_DA_GERACAO.efeitoMs], [3000, 5000, 300]);
  const n = g.dicas.length;
  assert.equal(n, 3);
  assert.equal(dicaDaEspera(0, n), null);
  assert.equal(dicaDaEspera(2999, n), null, 'ainda "Escrevendo suas lições…"');
  assert.equal(dicaDaEspera(3000, n), 0, 'aos 3 s entra a 1ª frase');
  assert.equal(dicaDaEspera(7999, n), 0);
  assert.equal(dicaDaEspera(8000, n), 1, 'aos 8 s, a 2ª');
  assert.equal(dicaDaEspera(13000, n), 2, 'aos 13 s, a 3ª');
  assert.equal(dicaDaEspera(17999, n), 2);
  assert.equal(dicaDaEspera(18000, n), 0, 'aos 18 s, volta à 1ª (laço de 3)');
  assert.equal(dicaDaEspera(22999, n), 0);
  assert.equal(dicaDaEspera(23000, n), 1, 'aos 23 s, a 2ª');
  assert.equal(dicaDaEspera(3000 + 5000 * 3 * 25 + 5000 * 2, n), 2, 'o laço segue depois de muitas voltas');
  // Entradas inválidas valem como o começo; sem frases, nunca há troca.
  for (const invalido of [-1, -5000, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) assert.equal(dicaDaEspera(invalido, n), null, String(invalido));
  assert.equal(dicaDaEspera(9000, 0), null);
  assert.equal(dicaDaEspera(9000, -2), null);
  assert.equal(dicaDaEspera(9000, 2.5), null);
  // Com outro número de frases, o laço acompanha.
  assert.deepEqual([3000, 8000, 13000, 18000].map((t) => dicaDaEspera(t, 2)), [0, 1, 0, 1]);
});

test('quanto falta para a próxima troca: o relógio do cliente dorme esse tempo e acorda exatamente quando a frase muda', () => {
  assert.equal(faltaParaTrocarADica(0), 3000);
  assert.equal(faltaParaTrocarADica(2999), 1);
  assert.equal(faltaParaTrocarADica(3000), 5000);
  assert.equal(faltaParaTrocarADica(3001), 4999);
  assert.equal(faltaParaTrocarADica(7999), 1);
  assert.equal(faltaParaTrocarADica(8000), 5000);
  assert.equal(faltaParaTrocarADica(-300), 3000);
  assert.equal(faltaParaTrocarADica(Number.NaN), 3000);
  const n = g.dicas.length;
  for (let t = 0; t <= 60000; t += 137) {
    const falta = faltaParaTrocarADica(t);
    assert.ok(falta >= 1 && falta <= 5000, `${t}: ${falta}`);
    assert.equal(dicaDaEspera(t + falta - 1, n), dicaDaEspera(t, n), `${t}: antes do fim da espera, a mesma frase`);
    assert.notEqual(dicaDaEspera(t + falta, n), dicaDaEspera(t, n), `${t}: ao fim da espera, a frase muda`);
  }
});

test('a criação depois de "Começar a lição 1": a linha entra 1,5 s depois do toque, a 1ª frase 3 s depois dela (aos 4,5 s) e as três giram a cada 5 s, em laço', () => {
  const LINHA_ENTRA_MS = 1500;
  // O cliente conta o tempo desde que a LINHA apareceu; antes dela (0 a 1,5 s) só há o botão afundado com "Criando sua trilha…".
  const noToque = (t) => (t < LINHA_ENTRA_MS ? 'sem linha' : dicaDaEspera(t - LINHA_ENTRA_MS, g.dicas.length));
  assert.equal(noToque(0), 'sem linha');
  assert.equal(noToque(1499), 'sem linha');
  assert.equal(noToque(1500), null, 'aos 1,5 s: "Escrevendo suas lições…"');
  assert.equal(noToque(4499), null);
  assert.equal(noToque(4500), 0, 'aos 4,5 s: a frase 1');
  assert.equal(noToque(9499), 0);
  assert.equal(noToque(9500), 1, 'a cada 5 s a seguinte');
  assert.equal(noToque(14500), 2);
  assert.equal(noToque(19500), 0, 'e a 1 de novo (laço)');
  // Espera curta medida (12 s): a pessoa vê "Escrevendo suas lições…", a frase 1 e o começo da 2. Espera longa (25 s): as três frases e a 1 de novo.
  const sequencia = (ate) => {
    const vistos = [];
    for (let t = LINHA_ENTRA_MS; t <= ate; t += 100) { const i = noToque(t); if (vistos.length === 0 || vistos[vistos.length - 1] !== i) vistos.push(i); }
    return vistos;
  };
  assert.deepEqual(sequencia(12000), [null, 0, 1]);
  assert.deepEqual(sequencia(25000), [null, 0, 1, 2, 0, 1]);
  // O efeito de 300 ms cabe dentro da frase, e todo índice devolvido existe nas frases.
  assert.ok(ESPERA_DA_GERACAO.efeitoMs < ESPERA_DA_GERACAO.trocaACadaMs);
  for (let t = 0; t <= 120000; t += 250) { const i = noToque(t); if (typeof i === 'number') assert.ok(g.dicas[i], `índice ${i}`); }
});

test('os nomes obsoletos da espera longa continuam exportados e valem para as três frases (não quebram as versões do app que ainda os leem)', () => {
  assert.deepEqual([...DICAS_DA_ESPERA_LONGA], [0, 1, 2], 'os índices das três frases (antes [0, 1, 3], quando a 3ª de quatro ficava de fora)');
  assert.equal(faltaParaTrocarADicaLonga, faltaParaTrocarADica);
  const vistos = new Set();
  for (let t = 0; t <= 120000; t += 137) {
    assert.equal(dicaDaEsperaLonga(t), dicaDaEspera(t, g.dicas.length), `${t}: a mesma conta da espera`);
    const i = dicaDaEsperaLonga(t);
    if (i !== null) { vistos.add(i); assert.ok(g.dicas[i], `índice ${i}`); }
    const falta = faltaParaTrocarADicaLonga(t);
    assert.equal(dicaDaEsperaLonga(t + falta - 1), dicaDaEsperaLonga(t), `${t}: antes do fim da espera, a mesma frase`);
    assert.notEqual(dicaDaEsperaLonga(t + falta), dicaDaEsperaLonga(t), `${t}: ao fim da espera, a frase muda`);
  }
  assert.deepEqual([...vistos].sort(), [0, 1, 2]);
  for (const invalido of [-1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(dicaDaEsperaLonga(invalido), null, String(invalido));
});
