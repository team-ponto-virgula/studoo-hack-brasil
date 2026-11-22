// Defeito B5 da spec 17: no exercício de lacuna, a dica depois do erro mostrava a resposta ("6 sobre 10", numa lacuna que pede 6). A dica aponta o caminho e nunca o valor da resposta
// (a mesma regra da frase do "Sua vez", spec 15). O servidor pede isso à IA, apara a dica que ainda traz a resposta antes de guardar a lição, e o retorno do erro também apara a dica de uma
// lição já guardada. Este teste cobre a conta, o gerador, o retorno do erro, o pedido à IA e as trilhas prontas (demonstração e IA falsa).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= 'postgresql://teste:teste@127.0.0.1:5432/teste';
process.env.STUDOO_CHAVE_ASSINATURA ??= '0123456789abcdef'.repeat(4);
const { normalizarLicao, instrucoesDaLicao, instrucoesDaLicaoDeMatematica } = await import('../src/servidor/ia/comum.ts');
const { DEMOS } = await import('../src/servidor/ia/demos.ts');
const { planoGenerico, conteudoGenerico } = await import('../src/servidor/ia/falsa-generica.ts');
const { criarGeradorFalso } = await import('../src/servidor/ia/falsa.ts');
const { exemploDeMatematica } = await import('../src/servidor/ia/matematica.ts');
const { PYTHON, SOCORROS, FISICA, ORATORIA } = await import('../src/servidor/compartilhar/demonstracao-trilhas.ts');
const {
  DICA_PADRAO_DA_LACUNA, avaliarResposta, avisoDaLacunaSemAResposta, conteudoValido, dicaDaLacunaSemAResposta, exercicioValido, textoDizARespostaDaLacuna,
} = await import('../src/dominio/aprendizado/plano.ts');

const diz = textoDizARespostaDaLacuna;

test('a conta: a resposta aceita aparece no texto como palavra ou número inteiro, sem diferença de acento ou de maiúsculas', () => {
  assert.equal(diz('Multiplique por 2: 3/5 vira 6 sobre 10.', ['6']), true, 'o exemplo da spec: "6 sobre 10" diz o 6');
  assert.equal(diz('A resposta é 6.', ['6']), true);
  assert.equal(diz('Dá 6,5 no total.', ['6,5']), true, 'a vírgula decimal');
  assert.equal(diz('Dá 6.5 no total.', ['6,5']), true, 'e o ponto decimal valem o mesmo número');
  assert.equal(diz('As tarraxas ficam na cabeça.', ['tarraxa']), true, 'o plural não esconde a resposta');
  assert.equal(diz('É uma FRAÇÃO própria.', ['fracao']), true, 'sem diferença de acento nem de maiúsculas');
  assert.equal(diz('Pergunte: How much is it?', ['how much']), true, 'a resposta de duas palavras');
  assert.equal(diz('Escreva $\\frac{6}{10}$.', ['6']), true, 'dentro de uma fórmula');
  assert.equal(diz('Fica 6 sobre 10.', ['6/10']), true, 'a resposta só de números (6/10) vale também com palavras no meio, na ordem');
  assert.equal(diz('São 10 partes e 6 pintadas.', ['6/10']), false, 'os números fora de ordem não dizem 6/10');
});

test('a conta: a resposta feita só de símbolos (>=) vale quando o símbolo aparece inteiro, sem outro símbolo de operação colado a ele', () => {
  assert.equal(diz('Use >= para incluir a nota 7.', ['>=']), true, 'o caso da trilha de SQL');
  assert.equal(diz('Use “>=” para incluir a nota 7.', ['>=']), true);
  assert.equal(diz('O operador (>=), que inclui o limite.', ['>=']), true);
  assert.equal(diz('Com >, apenas Caio aparece.', ['>=']), false, '">" não é ">="');
  assert.equal(diz('O limite entra no resultado: use <= ou >.', ['>=']), false);
  assert.equal(diz('Use > ou >= conforme o caso.', ['>']), true, 'o ">" solto aparece');
  assert.equal(diz('Compare com >= e veja.', ['>']), false, '">" colado a "=" é outro operador');
  assert.equal(diz('Escreva o símbolo de porcentagem: %.', ['%']), true);
  assert.equal(diz('Sem símbolos aqui.', ['>=', '%']), false);
});

test('a conta: o que é outro número ou outra palavra não conta como a resposta', () => {
  assert.equal(diz('São 16 partes.', ['6']), false, '6 não está em 16');
  assert.equal(diz('Dá 2,5 no total.', ['5']), false, '5 não está em 2,5');
  assert.equal(diz('Dá 1.000 no total.', ['1']), false, '1 não está em 1.000');
  assert.equal(diz('Fica 6 partes.', ['6/10']), false, 'só uma parte de 6/10 não diz a resposta');
  assert.equal(diz('Pense no caminho até a cabeça do violão.', ['tarraxa']), false);
  assert.equal(diz('', ['6']), false);
  assert.equal(diz('Qualquer dica.', []), false, 'sem resposta aceita, nada a esconder');
  assert.equal(diz('Qualquer dica.', ['', '   ']), false);
});

test('a conta: as respostas de uma ou duas letras (a, de, to) só contam entre aspas, porque a dica usa essas palavras por outros motivos', () => {
  assert.equal(diz('A palavra que mostra de quem é a coisa.', ['de']), false);
  assert.equal(diz('É a palavra que vem antes do país.', ['a']), false);
  assert.equal(diz('Use “de” para mostrar posse.', ['de']), true);
  assert.equal(diz('Use "de" para mostrar posse.', ['de']), true);
  assert.equal(diz('Use ‘to’ antes do verbo.', ['to']), true);
  assert.equal(diz('Escolha o 7 ou o 9.', ['7']), true, 'número de um dígito conta sempre: não é palavra de ligação');
});

test('a dica: sai a frase que diz a resposta, as outras ficam na ordem; sem nenhuma que sirva, entra a dica padrão; a dica boa volta igual', () => {
  const gabarito = ['6'];
  assert.equal(dicaDaLacunaSemAResposta('Multiplique o numerador e o denominador pelo mesmo número. Assim 3/5 = 6/10.', gabarito), 'Multiplique o numerador e o denominador pelo mesmo número.');
  assert.equal(dicaDaLacunaSemAResposta('Lembre da regra. A resposta é 6. Confira o enunciado.', gabarito), 'Lembre da regra. Confira o enunciado.');
  assert.equal(dicaDaLacunaSemAResposta('A resposta é 6.', gabarito), DICA_PADRAO_DA_LACUNA);
  const boa = 'Multiplique o numerador e o denominador pelo mesmo número: 3 vezes quanto dá 6?';
  assert.equal(dicaDaLacunaSemAResposta(boa, ['2']), boa, 'a dica que não diz a resposta volta igual');
  assert.equal(dicaDaLacunaSemAResposta('É a peça da cabeça do violão.', ['tarraxa']), 'É a peça da cabeça do violão.');
  // A dica padrão aponta o caminho e não diz a resposta de lacuna nenhuma.
  assert.doesNotMatch(DICA_PADRAO_DA_LACUNA, /\d/);
  assert.equal(diz(DICA_PADRAO_DA_LACUNA, ['conceito', 'exemplo', 'lição', 'caminho']), true, 'sanidade: a conta acha as palavras dela');
  assert.equal(dicaDaLacunaSemAResposta('A resposta é 6.', ['6']).length > 0, true);
});

test('o aviso de uma armadilha da lacuna que diz a resposta certa não serve: sem texto no lugar', () => {
  assert.equal(avisoDaLacunaSemAResposta('O nome certo é tarraxa.', ['tarraxa']), undefined);
  assert.equal(avisoDaLacunaSemAResposta('“Chave” é o nome popular de outra peça.', ['tarraxa']), '“Chave” é o nome popular de outra peça.');
  assert.equal(avisoDaLacunaSemAResposta(undefined, ['tarraxa']), undefined);
});

/** Uma lição como a IA a devolve, com uma lacuna (e, se vier, um segundo exercício de outro tipo). */
function licaoDaIa(lacuna, { extras = [] } = {}) {
  return {
    objetivo: 'Reconhecer frações equivalentes.',
    conceito: 'Frações equivalentes representam a mesma parte do todo. Multiplicar em cima e embaixo pelo mesmo número não muda o valor.',
    exemplo: 'Meio é igual a dois quartos: multiplicamos o 1 e o 2 por 2.',
    exemploTipo: 'exemplo',
    passos: null,
    recurso: null,
    falas: null,
    pratica: null,
    outroJeito: null,
    exercicios: [{
      tipo: 'lacuna', enunciado: 'Complete a fração equivalente.', contexto: null, trecho: '3/5 = ___/10', trechoTipo: 'frase', fala: null, opcoes: null, itens: null,
      esquerda: null, direita: null, afirmacao: null, gabarito: ['6'], exata: false, criterios: null, modelo: null, armadilhas: null,
      feedbackCorreto: 'Isso! 3 × 2 = 6 e 5 × 2 = 10.', feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número.',
      ...lacuna,
    }, ...extras],
  };
}

test('o gerador: a dica da IA que diz a resposta é aparada antes de guardar, a lição segue válida e o ajuste fica registrado', () => {
  const ia = licaoDaIa({ feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número. Assim, 3/5 vira 6 sobre 10.' });
  const lida = normalizarLicao(ia, 'IA de teste');
  assert.ok(lida.conteudo, 'a lição não cai por causa da dica');
  assert.equal(lida.conteudo.exercicio.feedbackIncorreto, 'Multiplique o numerador e o denominador pelo mesmo número.');
  assert.equal(lida.dicaDaLacunaAparada, true);
  assert.deepEqual(lida.descartados, [], 'o exercício não é descartado: só a dica muda');
  assert.equal(conteudoValido(lida.conteudo), true);
  assert.equal(textoDizARespostaDaLacuna(lida.conteudo.exercicio.feedbackIncorreto, lida.conteudo.exercicio.gabarito), false);
  // O retorno do acerto não muda: ali a resposta pode (e deve) aparecer.
  assert.match(lida.conteudo.exercicio.feedbackCorreto, /6/);
});

test('o gerador: se toda a dica diz a resposta, entra a dica padrão, e o exercício fica', () => {
  const lida = normalizarLicao(licaoDaIa({ feedbackIncorreto: 'A resposta correta é 6, porque 3 vezes 2 dá 6.' }), 'IA de teste');
  assert.ok(lida.conteudo);
  assert.equal(lida.conteudo.exercicio.tipo, 'lacuna');
  assert.equal(lida.conteudo.exercicio.feedbackIncorreto, DICA_PADRAO_DA_LACUNA);
  assert.equal(lida.dicaDaLacunaAparada, true);
});

test('o gerador: a dica que já aponta só o caminho passa igual e não há ajuste registrado', () => {
  const dica = 'Multiplique o numerador e o denominador pelo mesmo número: 3 vezes quanto dá 6?';
  const lida = normalizarLicao(licaoDaIa({ gabarito: ['2'], feedbackIncorreto: dica, trecho: '3 × ___ = 6', feedbackCorreto: 'Isso! 3 × 2 = 6.' }), 'IA de teste');
  assert.ok(lida.conteudo);
  assert.equal(lida.conteudo.exercicio.feedbackIncorreto, dica);
  assert.equal(lida.dicaDaLacunaAparada, undefined);
});

test('o gerador: a armadilha cujo aviso diz a resposta sai, a que não diz fica; as respostas aceitas seguem sem armadilha', () => {
  const lida = normalizarLicao(licaoDaIa({
    gabarito: ['tarraxa'], trecho: 'A peça que afina a corda é a ___.', enunciado: 'Complete a frase.', feedbackCorreto: 'Isso! A tarraxa afina a corda.', feedbackIncorreto: 'É a peça da cabeça do violão.',
    armadilhas: [
      { termos: 'chave', aviso: 'Chave é o nome popular, mas o nome certo é tarraxa.' },
      { termos: 'parafuso', aviso: 'Parece uma boa ideia, mas o parafuso fica em outro lugar do violão.' },
    ],
  }), 'IA de teste');
  assert.ok(lida.conteudo);
  assert.deepEqual(lida.conteudo.exercicio.armadilhas, [{ termos: 'parafuso', aviso: 'Parece uma boa ideia, mas o parafuso fica em outro lugar do violão.' }]);
});

test('o gerador: uma lacuna com a dica limpa e outros tipos de exercício não mudam (a regra é só da lacuna)', () => {
  const multipla = {
    tipo: 'multipla_escolha', enunciado: 'Qual é a fração equivalente a 3/5?', contexto: null, trecho: null, trechoTipo: null, fala: null,
    opcoes: [{ id: 'a', texto: '6/10' }, { id: 'b', texto: '4/6' }, { id: 'c', texto: '3/10' }], itens: null, esquerda: null, direita: null, afirmacao: null,
    gabarito: ['a'], exata: null, criterios: null, modelo: null, armadilhas: null, feedbackCorreto: 'Isso! 6/10 equivale a 3/5.', feedbackIncorreto: 'A opção certa é a 6/10: multiplique cima e embaixo por 2.',
  };
  const lida = normalizarLicao({ ...licaoDaIa({ feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número.' }), exercicios: [multipla, licaoDaIa({}).exercicios[0]] }, 'IA de teste');
  assert.ok(lida.conteudo);
  assert.equal(lida.conteudo.exercicio.tipo, 'multipla_escolha');
  assert.equal(lida.conteudo.exercicio.feedbackIncorreto, 'A opção certa é a 6/10: multiplique cima e embaixo por 2.', 'a múltipla escolha segue como a IA escreveu');
});

/** Uma lacuna já guardada (como as lições de antes desta regra) com uma dica que entrega a resposta. */
const guardada = {
  tipo: 'lacuna', enunciado: 'Complete a fração equivalente.', trecho: '3/5 = ___/10', trechoTipo: 'frase', gabarito: ['6'],
  feedbackCorreto: 'Isso! 3 × 2 = 6 e 5 × 2 = 10.', feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número. Assim, 3/5 vira 6 sobre 10.',
  armadilhas: [{ termos: '3', aviso: 'O 3 já está no numerador; o número que falta é o que vem depois de multiplicar por 2: 6.' }, { termos: '5', aviso: 'Esse é o denominador de antes: confira o que muda no de depois.' }],
};

test('o retorno do erro: uma lição já guardada com a dica que entrega a resposta mostra a dica aparada (e a lição guardada continua válida)', () => {
  assert.equal(exercicioValido(guardada), true, 'as lições guardadas seguem abrindo: a regra não entra no validador de leitura');
  const errada = avaliarResposta(guardada, '7');
  assert.equal(errada.correta, false);
  assert.equal(errada.feedback, 'Multiplique o numerador e o denominador pelo mesmo número.');
  assert.equal(diz(`${errada.feedback} ${errada.observacao ?? ''}`, guardada.gabarito), false, 'nem a dica nem o aviso dizem a resposta');
  // A armadilha cujo aviso diz a resposta: o aviso sai (o retorno fica com a dica); a outra armadilha segue com o aviso dela.
  const armadilhaQueEntrega = avaliarResposta(guardada, '3');
  assert.equal(armadilhaQueEntrega.correta, false);
  assert.equal(armadilhaQueEntrega.observacao, undefined);
  assert.equal(armadilhaQueEntrega.feedback, 'Multiplique o numerador e o denominador pelo mesmo número.');
  const armadilhaBoa = avaliarResposta(guardada, '5');
  assert.equal(armadilhaBoa.observacao, 'Esse é o denominador de antes: confira o que muda no de depois.');
});

test('o retorno do erro: o acerto não muda (a resposta pode aparecer ali), e uma dica limpa volta igual', () => {
  const certa = avaliarResposta(guardada, '6');
  assert.equal(certa.correta, true);
  assert.equal(certa.feedback, guardada.feedbackCorreto);
  const limpa = { ...guardada, feedbackIncorreto: 'Multiplique o numerador e o denominador pelo mesmo número.' };
  assert.equal(avaliarResposta(limpa, '7').feedback, limpa.feedbackIncorreto);
  // Um erro de grafia quando a grafia é a lição segue com o aviso de "quase", que não diz a palavra.
  const exata = { tipo: 'lacuna', enunciado: 'Escreva a peça que afina a corda.', gabarito: ['tarraxa'], exata: true, feedbackCorreto: 'Isso!', feedbackIncorreto: 'É a peça da cabeça do violão que você gira.' };
  const quase = avaliarResposta(exata, 'tarraxo');
  assert.equal(quase.correta, false);
  assert.equal(diz(`${quase.feedback} ${quase.observacao ?? ''}`, exata.gabarito), false);
  // Um acerto com deslize de grafia diz a forma certa, e isso continua assim: quem acertou pode ver a resposta.
  const deslize = avaliarResposta({ ...exata, exata: false }, 'tarrachas');
  assert.equal(deslize.correta, true);
});

test('o pedido à IA: a dica da lacuna aponta o caminho e nunca escreve a resposta (texto das trilhas e das trilhas de matemática)', () => {
  for (const instrucoes of [instrucoesDaLicao, instrucoesDaLicaoDeMatematica]) {
    assert.match(instrucoes, /Na lacuna, a pessoa lê o feedbackIncorreto e tenta de novo/);
    assert.match(instrucoes, /nunca escreve a resposta, nem um valor do gabarito, nem o resultado da conta/);
    assert.doesNotMatch(instrucoes, /mostra o caminho certo/, 'o texto antigo, que pedia para mostrar o caminho certo, pode ser lido como "diga a resposta"');
  }
});

test('o pedido à IA: o exemplo de lacuna de matemática que o prompt mostra (o DeepSeek imita o exemplo) não diz a resposta', () => {
  const lacuna = exemploDeMatematica.exercicios.find((exercicio) => exercicio.tipo === 'lacuna');
  assert.ok(lacuna, 'o exemplo de matemática tem uma lacuna');
  assert.deepEqual(lacuna.gabarito, ['2']);
  assert.equal(diz(lacuna.feedbackIncorreto, lacuna.gabarito), false, `a dica do exemplo não diz o 2: ${lacuna.feedbackIncorreto}`);
  // O exemplo é uma lição válida que o normalizador não precisa consertar.
  const lida = normalizarLicao(JSON.parse(JSON.stringify(exemploDeMatematica)), 'IA de teste');
  assert.ok(lida.conteudo);
  assert.equal(lida.dicaDaLacunaAparada, undefined);
});

function lacunasDaTrilha(plano) {
  return plano.fluxos.flatMap((fluxo) => fluxo.licoes).flatMap((licao) => [licao.exercicio, ...(licao.extras ?? [])]).filter((exercicio) => exercicio.tipo === 'lacuna');
}

/** Todas as lições da trilha de SQL da IA falsa (a que aparece quando o objetivo fala de SQL), pelo gerador, como o servidor as pede. */
async function lacunasDoSqlDaIaFalsa() {
  const gerador = criarGeradorFalso();
  const esqueleto = { objetivo: 'Aprender SQL do zero', titulo: 'SQL', gerador: 'x', origem: 'x', fluxos: [] };
  const it = gerador.gerarEstrutura('Aprender SQL do zero', new AbortController().signal, { aoVivo: false });
  const fluxos = [];
  let meta;
  for (;;) {
    const passo = await it.next();
    if (passo.done) { meta = passo.value; break; }
    if (passo.value.tipo === 'fluxo') fluxos.push({ titulo: passo.value.titulo, licoes: [] });
    if (passo.value.tipo === 'licao') fluxos[passo.value.fluxo].licoes.push({ titulo: passo.value.titulo });
  }
  const lacunas = [];
  for (let f = 0; f < fluxos.length; f += 1) {
    for (let l = 0; l < fluxos[f].licoes.length; l += 1) {
      const conteudo = await gerador.gerarConteudo({ ...esqueleto, ...meta, fluxos }, f, l, new AbortController().signal);
      lacunas.push(...[conteudo.exercicio, ...(conteudo.extras ?? [])].filter((exercicio) => exercicio.tipo === 'lacuna'));
    }
  }
  return lacunas;
}

test('as trilhas prontas (demonstração, compartilhar e IA falsa): nenhuma dica de lacuna diz a resposta, nem o aviso das armadilhas', async () => {
  const objetivos = ['aprender a pilotar drones', 'organizar minhas finanças', 'tocar teclado', 'entender de astronomia', 'cuidar de plantas', 'fazer yoga em casa'];
  const trilhas = [
    ...DEMOS.map((demo) => [`demonstração ${demo.chave}`, lacunasDaTrilha(demo.plano)]),
    ...[['python', PYTHON], ['socorros', SOCORROS], ['física', FISICA], ['oratória', ORATORIA]].map(([nome, plano]) => [`compartilhar ${nome}`, lacunasDaTrilha(plano)]),
    ['IA falsa: SQL', await lacunasDoSqlDaIaFalsa()],
    ...objetivos.map((objetivo) => {
      const plano = planoGenerico(objetivo);
      const lacunas = plano.fluxos.flatMap((fluxo, f) => fluxo.licoes.flatMap((_, l) => {
        const conteudo = conteudoGenerico(objetivo, f, l);
        return conteudo ? [conteudo.exercicio, ...(conteudo.extras ?? [])].filter((exercicio) => exercicio.tipo === 'lacuna') : [];
      }));
      return [`IA falsa: ${objetivo}`, lacunas];
    }),
  ];
  let total = 0;
  for (const [nome, lacunas] of trilhas) {
    for (const lacuna of lacunas) {
      total += 1;
      const dicas = [lacuna.feedbackIncorreto, ...(lacuna.armadilhas ?? []).map(({ aviso }) => aviso)];
      for (const dica of dicas) assert.equal(diz(dica, lacuna.gabarito), false, `${nome}: a dica diz a resposta ${JSON.stringify(lacuna.gabarito)}: ${dica}`);
    }
  }
  assert.ok(total >= 25, `varreu as lacunas das trilhas prontas (${total})`);
});
