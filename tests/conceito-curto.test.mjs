// Onboarding (spec 17, mudança 6): o balão "O Stu explica" é curto: até 3 frases e cerca de 50 palavras em todas as lições, e até 2 frases na lição 1 de cada trilha.
// O servidor pede isso à IA e, se ela passar do limite, corta na última frase que cabe (nunca no meio de uma frase, nunca derrubando a lição). As trilhas de demonstração (IA falsa) já cumprem.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LIMITE_DO_CONCEITO, conceitoCabe, encurtarConceito, frasesDoConceito, medirConceito, tirarRotuloDoConceito } from '@studoo/contratos';

// Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= 'postgresql://teste:teste@127.0.0.1:5432/teste';
process.env.STUDOO_CHAVE_ASSINATURA ??= '0123456789abcdef'.repeat(4);
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { normalizarLicao, instrucoesDaLicao, promptDaLicao } = await import('../src/servidor/ia/comum.ts');
const { DEMOS } = await import('../src/servidor/ia/demos.ts');
const { criarGeradorFalso } = await import('../src/servidor/ia/falsa.ts');
const { planoGenerico, conteudoGenerico } = await import('../src/servidor/ia/falsa-generica.ts');
const { conteudoValido } = await import('../src/dominio/aprendizado/plano.ts');
const { conteudosDasLicoes, INSTRUCOES_DAS_LICOES_DO_MATERIAL } = await import('../src/servidor/estudio/licoes-do-material.ts');
const { conteudoDaGerada, licaoGeradaValida } = await import('../src/servidor/estudio/ia.ts');
const { obterGerador } = await import('../src/servidor/ia/gerador.ts');
const { GERADOR_OPENAI } = await import('../src/servidor/ia/openai.ts');

test('os limites do balão: 3 frases, 2 na lição 1, cerca de 50 palavras (passa até 60)', () => {
  assert.deepEqual({ ...LIMITE_DO_CONCEITO }, { frases: 3, frasesNaLicao1: 2, palavras: 50, folgaDePalavras: 10 });
});

test('as frases: ponto, exclamação e interrogação fecham; decimal, abreviação, inicial, lista, citação, fórmula e código não', () => {
  const frases = (texto) => frasesDoConceito(texto);
  assert.deepEqual(frases('Primeira. Segunda! Terceira? Quarta.'), ['Primeira.', 'Segunda!', 'Terceira?', 'Quarta.']);
  assert.deepEqual(frases('O valor é 3,5 ou 3.5 metros. Depois some 2.'), ['O valor é 3,5 ou 3.5 metros.', 'Depois some 2.']);
  assert.deepEqual(frases('Veja a fig. 3 e a pág. 12. Depois leia o texto.'), ['Veja a fig. 3 e a pág. 12.', 'Depois leia o texto.'], 'abreviação antes de número');
  assert.deepEqual(frases('O Dr. Silva chegou. J. Silva também.'), ['O Dr. Silva chegou.', 'J. Silva também.'], 'título e inicial');
  assert.deepEqual(frases('Diga “Excuse me, where is the station?” para pedir ajuda. Depois agradeça com “Thank you.” Pronto.'),
    ['Diga “Excuse me, where is the station?” para pedir ajuda.', 'Depois agradeça com “Thank you.” Pronto.'], 'a pontuação dentro da citação não fecha a frase');
  assert.deepEqual(frases('O ponto médio $M$ tem $x_M = (x_A + x_B) / 2$. Some as coordenadas. Divida por 2. Pronto.'),
    ['O ponto médio $M$ tem $x_M = (x_A + x_B) / 2$.', 'Some as coordenadas.', 'Divida por 2.', 'Pronto.'], 'fórmula inteira; um número no fim da frase fecha a frase');
  assert.deepEqual(frases('Passos: 1. Corte as cebolas. 2. Frite. Depois sirva.'), ['Passos: 1. Corte as cebolas.', '2. Frite.', 'Depois sirva.'], 'número de lista não fecha');
  assert.deepEqual(frases('Custa R$ 25,00. Pague na entrada. Obrigado.'), ['Custa R$ 25,00.', 'Pague na entrada.', 'Obrigado.'], '"R$" não abre fórmula');
  assert.deepEqual(frases('Isso... é estranho. Muito estranho!'), ['Isso... é estranho.', 'Muito estranho!']);
  assert.deepEqual(frases('SELECT * FROM t WHERE a.b = 1. Depois use `a.b` assim. Fim.'), ['SELECT * FROM t WHERE a.b = 1.', 'Depois use `a.b` assim.', 'Fim.'], 'ponto dentro de código não fecha');
  assert.deepEqual(frases('Sem ponto final'), ['Sem ponto final']);
  assert.deepEqual(frases('  Uma só.  '), ['Uma só.']);
  assert.deepEqual(frases(''), []);
  assert.deepEqual(frases('e.g. isto e aquilo. fim'), ['e.g. isto e aquilo. fim'], 'depois de ponto, minúscula não abre frase nova');
});

test('medir e caber: cada fórmula conta como uma palavra; até 3 frases (2 na lição 1) e 60 palavras', () => {
  assert.deepEqual(medirConceito('O ponto médio $M$ tem $x_M = (x_A + x_B) / 2$. Some tudo.'), { frases: 2, palavras: 8 }, 'as duas fórmulas valem uma palavra cada');
  assert.deepEqual(medirConceito(''), { frases: 0, palavras: 0 });
  assert.equal(conceitoCabe('Uma. Duas. Três.'), true);
  assert.equal(conceitoCabe('Uma. Duas. Três. Quatro.'), false);
  assert.equal(conceitoCabe('Uma. Duas.', { primeiraLicao: true }), true);
  assert.equal(conceitoCabe('Uma. Duas. Três.', { primeiraLicao: true }), false, 'na lição 1, 3 frases já passam');
  const palavras = (n) => ['Ba', ...Array.from({ length: n - 1 }, () => 'ba')].join(' ');
  assert.equal(conceitoCabe(`${palavras(60)}.`), true);
  assert.equal(conceitoCabe(`${palavras(61)}.`), false);
});

test('encurtar: corta na última frase que cabe, guarda o resto, nunca corta no meio e nunca deixa vazio', () => {
  const longo = 'Para começar, três frases resolvem. Treine cada uma em voz alta. Depois combine as três. Por fim, repita ouvindo.';
  assert.deepEqual(encurtarConceito(longo), { conceito: 'Para começar, três frases resolvem. Treine cada uma em voz alta. Depois combine as três.', resto: 'Por fim, repita ouvindo.', cortou: true });
  assert.deepEqual(encurtarConceito(longo, { primeiraLicao: true }), { conceito: 'Para começar, três frases resolvem. Treine cada uma em voz alta.', resto: 'Depois combine as três. Por fim, repita ouvindo.', cortou: true });
  assert.deepEqual(encurtarConceito('Curta. Cabe.'), { conceito: 'Curta. Cabe.', resto: '', cortou: false }, 'o que cabe volta igual');
  assert.deepEqual(encurtarConceito(''), { conceito: '', resto: '', cortou: false });
  // As palavras: tira frases do fim enquanto passar de 60, mas a 1ª frase fica mesmo longa (cortar no meio dela é pior).
  const frase = (n, fim) => `${['Ba', ...Array.from({ length: n - 1 }, () => 'ba')].join(' ')}${fim}`;
  const pesado = `${frase(30, '.')} ${frase(30, '.')} ${frase(30, '.')}`;
  assert.equal(frasesDoConceito(encurtarConceito(pesado).conceito).length, 2, 'três frases de 30 palavras: ficam 2 (60 palavras)');
  const gigante = `${frase(90, '.')} Curta.`;
  assert.equal(encurtarConceito(gigante).conceito, frase(90, '.'), 'a 1ª frase de 90 palavras fica inteira, sem corte no meio');
  // O que o espaço original tinha (quebras de linha) fica.
  const comQuebra = 'Primeira frase.\nSegunda frase.\n\nTerceira frase. Quarta frase.';
  assert.equal(encurtarConceito(comQuebra).conceito, 'Primeira frase.\nSegunda frase.\n\nTerceira frase.');
  // Fórmula e citação não são quebradas pelo corte.
  const formula = 'Vale $x_M = (x_A + x_B) / 2$. Some as pontas. Divida por 2. Pronto.';
  assert.equal(encurtarConceito(formula).conceito, 'Vale $x_M = (x_A + x_B) / 2$. Some as pontas. Divida por 2.');
});

test('invariante: conceito + resto é sempre o texto original (nada some), e o conceito termina numa frase inteira', () => {
  const amostras = JSON.parse(ler('tests/fixtures/licoes-reais-historicas.json'));
  const textos = [
    ...amostras.map((amostra) => amostra.bruto.conceito),
    ...DEMOS.flatMap((demo) => demo.plano.fluxos.flatMap((fluxo) => fluxo.licoes.map((licao) => licao.conceito))),
  ];
  assert.ok(textos.length >= 90, `${textos.length} conceitos`);
  for (const texto of textos) {
    for (const primeiraLicao of [false, true]) {
      const { conceito, resto, cortou } = encurtarConceito(texto, { primeiraLicao });
      assert.equal(`${conceito} ${resto}`.replace(/\s+/g, ' ').trim(), texto.replace(/\s+/g, ' ').trim(), 'nada some');
      assert.equal(cortou, resto !== '');
      assert.ok(texto.trim().startsWith(conceito), 'o conceito é o começo do texto, sem reescrever');
      assert.match(conceito, /[.!?…”"')\]]$/u, `termina numa frase inteira: ${conceito.slice(-40)}`);
      const frases = frasesDoConceito(conceito).length;
      assert.ok(frases >= 1 && frases <= (primeiraLicao ? 2 : 3), `${frases} frases`);
      if (frases > 1) assert.ok(conceitoCabe(conceito, { primeiraLicao }), 'com mais de uma frase, cabe no limite');
    }
  }
});

test('as trilhas de demonstração (IA falsa) já cumprem: 3 frases e cerca de 50 palavras, e 2 frases na lição 1 de cada trilha', async () => {
  let lições = 0;
  for (const demo of DEMOS) {
    demo.plano.fluxos.forEach((fluxo, f) => fluxo.licoes.forEach((licao, l) => {
      lições += 1;
      const primeiraLicao = f === 0 && l === 0;
      assert.ok(conceitoCabe(licao.conceito, { primeiraLicao }), `${demo.chave} ${f + 1}.${l + 1} (${JSON.stringify(medirConceito(licao.conceito))}): ${licao.conceito.slice(0, 90)}`);
    }));
  }
  assert.ok(lições >= 47, `${lições} lições de demonstração`);
  // O violão continua ensinando as mãos na primeira lição (o teste de formatos exige "mão esquerda"), agora em 2 frases.
  const violao = DEMOS.find(({ chave }) => chave === 'violao').plano.fluxos[0].licoes[0];
  assert.match(violao.conceito, /mão esquerda/);
  assert.equal(medirConceito(violao.conceito).frases, 2);
  // A trilha de SQL e a trilha genérica (qualquer outro assunto) da IA falsa.
  const gerador = criarGeradorFalso();
  const esqueletoSql = { objetivo: 'Aprender SQL do zero', titulo: 'SQL', gerador: 'x', origem: 'x', fluxos: [] };
  const it = gerador.gerarEstrutura('Aprender SQL do zero', new AbortController().signal, { aoVivo: false });
  const fluxos = [];
  let meta;
  for (;;) {
    const passo = await it.next();
    if (passo.done) { meta = passo.value; break; }
    if (passo.value.tipo === 'fluxo') fluxos.push({ titulo: passo.value.titulo, licoes: [] });
    if (passo.value.tipo === 'licao') fluxos[passo.value.fluxo].licoes.push({ titulo: passo.value.titulo });
  }
  for (let f = 0; f < fluxos.length; f += 1) {
    for (let l = 0; l < fluxos[f].licoes.length; l += 1) {
      const conteudo = await gerador.gerarConteudo({ ...esqueletoSql, ...meta, fluxos }, f, l, new AbortController().signal);
      assert.ok(conceitoCabe(conteudo.conceito, { primeiraLicao: f === 0 && l === 0 }), `SQL ${f + 1}.${l + 1}: ${conteudo.conceito.slice(0, 80)}`);
    }
  }
  for (const objetivo of ['Quero aprender a desenhar', 'Primeiros socorros essenciais', 'Teoria musical para iniciantes', 'Jardinagem em apartamento', 'Sistema solar']) {
    planoGenerico(objetivo).fluxos.forEach((fluxo, f) => fluxo.licoes.forEach((_, l) => {
      const conteudo = conteudoGenerico(objetivo, f, l);
      assert.ok(conceitoCabe(conteudo.conceito, { primeiraLicao: f === 0 && l === 0 }), `${objetivo} ${f + 1}.${l + 1}`);
    }));
  }
});

const licaoBruta = (conceito) => ({
  objetivo: 'Reconhecer as partes do violão.',
  conceito,
  exemplo: 'Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.',
  exercicio: {
    tipo: 'multipla_escolha', enunciado: 'Onde ficam as tarraxas?', contexto: null, trecho: null,
    opcoes: [{ id: 'a', texto: 'Na cabeça' }, { id: 'b', texto: 'No corpo' }, { id: 'c', texto: 'No braço' }], gabarito: ['a'],
    feedbackCorreto: 'Isso: as tarraxas ficam na cabeça do violão.', feedbackIncorreto: 'As tarraxas ficam na cabeça, a ponta do braço.',
  },
});
const CONCEITO_LONGO = 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete. As tarraxas afinam as cordas. Quem toca aperta o braço com uma mão. A outra mão toca sobre a boca.';

test('a normalização corta o conceito que passou do balão, sem derrubar a lição: 3 frases em geral, 2 na primeira lição', () => {
  const geral = normalizarLicao(licaoBruta(CONCEITO_LONGO), 'IA');
  assert.ok(geral.conteudo && conteudoValido(geral.conteudo), 'a lição segue válida');
  assert.equal(geral.conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete. As tarraxas afinam as cordas.');
  assert.equal(geral.conceitoCortado, true);
  assert.deepEqual(geral.descartados, [], 'os exercícios não foram tocados');
  const primeira = normalizarLicao(licaoBruta(CONCEITO_LONGO), 'IA', { primeiraLicao: true });
  assert.equal(primeira.conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete.');
  assert.equal(primeira.conceitoCortado, true);
  assert.equal(primeira.conteudo.exercicio.enunciado, 'Onde ficam as tarraxas?');
  assert.equal(primeira.conteudo.exemplo, 'Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.');
  // O que já cabe volta igual, sem aviso de corte.
  const curto = normalizarLicao(licaoBruta('O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete.'), 'IA', { primeiraLicao: true });
  assert.equal(curto.conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete.');
  assert.equal(curto.conceitoCortado, undefined);
  // Sem conceito, a lição continua sendo recusada como sempre (o corte não inventa nada).
  assert.equal(normalizarLicao(licaoBruta(''), 'IA').conteudo, null);
  // Também no caminho de "só o essencial": um opcional que não fecha não deixa o conceito longo passar.
  const comOpcionalRuim = { ...licaoBruta(CONCEITO_LONGO), recurso: { tipo: 'acorde', nome: 'Am', casas: [1, 2], dedos: [0] }, pratica: { tarefa: 'x', minutos: 'abc' } };
  assert.equal(normalizarLicao(comOpcionalRuim, 'IA', { primeiraLicao: true }).conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete.');
});

test('as amostras reais históricas (46 lições, escritas quando o pedido dizia "2 ou 3 frases") seguem todas aceitas e saem dentro do balão', () => {
  const amostras = JSON.parse(ler('tests/fixtures/licoes-reais-historicas.json'));
  assert.equal(amostras.length, 46);
  let cortadas = 0;
  for (const amostra of amostras) {
    for (const primeiraLicao of [false, true]) {
      const lida = normalizarLicao(amostra.bruto, 'IA', { primeiraLicao });
      assert.ok(lida.conteudo, `lição rejeitada: ${lida.motivo}`);
      assert.ok(conceitoCabe(lida.conteudo.conceito, { primeiraLicao }) || medirConceito(lida.conteudo.conceito).frases === 1);
      if (!primeiraLicao && lida.conceitoCortado) cortadas += 1;
    }
  }
  // Com o pedido antigo, a IA passava do limite em quase metade das lições (mediana de 59 palavras): o corte é a rede de segurança; o pedido novo é que reduz isso.
  assert.ok(cortadas > 0 && cortadas < 46, `${cortadas} de 46 cortadas`);
});

test('o pedido à IA diz a regra do balão, e a primeira lição da trilha leva o aviso a mais', () => {
  assert.match(instrucoesDaLicao, /conceito \(é o balão “O Stu explica”: no máximo 3 frases simples e cerca de 50 palavras, com um único conceito novo; na primeira lição da trilha, no máximo 2 frases\)/);
  assert.doesNotMatch(instrucoesDaLicao, /de 2 a 4 frases simples/);
  assert.match(instrucoesDaLicao, /\nO conceito é só a explicação: não o comece com “O Stu explica:” nem com outro título, porque o app já mostra “O Stu explica” acima do balão\.\n/, 'o pedido diz para não repetir o título do balão');
  const esqueleto = { objetivo: 'Violão', titulo: 'Violão do zero', fluxos: [{ titulo: 'A', licoes: [{ titulo: 'Partes' }, { titulo: 'Afinar' }] }, { titulo: 'B', licoes: [{ titulo: 'Acordes' }] }] };
  assert.match(promptDaLicao(esqueleto, 0, 0), /\nEsta é a primeira lição da trilha: o conceito tem no máximo 2 frases\.$/);
  assert.doesNotMatch(promptDaLicao(esqueleto, 0, 1), /primeira lição da trilha/);
  assert.doesNotMatch(promptDaLicao(esqueleto, 1, 0), /primeira lição da trilha/, 'a lição 1 do 2º trecho não é a lição 1 da trilha');
  assert.match(INSTRUCOES_DAS_LICOES_DO_MATERIAL, /O conceito é o balão “O Stu explica”: no máximo 3 frases e cerca de 50 palavras \(na primeira lição, no máximo 2 frases\)\./);
  for (const adaptador of ['src/servidor/ia/openai.ts']) {
    assert.match(ler(adaptador), /normalizarLicaoSegura\(bruto, origemDoConteudo\(esqueleto\.origem\), \{ primeiraLicao: fluxo === 0 && licao === 0 \}\)/, `${adaptador} diz qual é a primeira lição (pela leitura protegida, que não deixa uma exceção virar 500)`);
  }
});

// ---- O título do balão repetido no começo do conceito ("O Stu explica: …"): a IA real fez isso na trilha "Enquadramento com a regra dos terços" ----
test('o rótulo repetido: "O Stu explica:" no começo do conceito sai, com ou sem negrito, aspas, travessão ou quebra de linha, e a 1ª palavra só de minúsculas recomeça maiúscula', () => {
  const tirar = tirarRotuloDoConceito;
  const sai = (entrada, esperado) => assert.equal(tirar(entrada), esperado, JSON.stringify(entrada));
  // O que a IA real escreveu: o título do balão, dois-pontos e o texto.
  sai('O Stu explica: A regra dos terços divide a foto em nove partes iguais.', 'A regra dos terços divide a foto em nove partes iguais.');
  sai('O Stu explica: a regra dos terços divide a foto.', 'A regra dos terços divide a foto.');
  sai('Stu explica: o violão tem seis cordas.', 'O violão tem seis cordas.');
  sai('  o stu explica:   a regra.  ', 'A regra.');
  sai('O STU EXPLICA: a regra.', 'A regra.');
  sai('O Stu explica: O Stu explica: A regra.', 'A regra.');
  // O texto exato que a IA real pôs no balão da trilha "Enquadramento com a regra dos terços" (captura da QA em produção): minúscula depois dos dois-pontos, como se escreve em português.
  sai('O Stu explica: a regra dos terços divide a imagem em nove partes iguais com duas linhas horizontais e duas verticais. O assunto fica sobre uma linha ou num ponto de cruzamento.',
    'A regra dos terços divide a imagem em nove partes iguais com duas linhas horizontais e duas verticais. O assunto fica sobre uma linha ou num ponto de cruzamento.');
  // Negrito, itálico, aspas, título de markdown, travessão e quebra de linha.
  sai('**O Stu explica:** A regra dos terços.', 'A regra dos terços.');
  sai('**O Stu explica**: A regra dos terços.', 'A regra dos terços.');
  sai('_O Stu explica:_ a regra.', 'A regra.');
  sai('“O Stu explica”: a regra dos terços.', 'A regra dos terços.');
  sai('"O Stu explica": a regra dos terços.', 'A regra dos terços.');
  sai('«O Stu explica»: a regra.', 'A regra.');
  sai('## O Stu explica\nA regra.', 'A regra.');
  sai('O Stu explica — a regra dos terços.', 'A regra dos terços.');
  sai('O Stu explica - a regra dos terços.', 'A regra dos terços.');
  sai('O Stu explica\nA regra dos terços.', 'A regra dos terços.');
  sai('O Stu explica:\n\nA regra dos terços.', 'A regra dos terços.');
  // O texto que sobra não é reescrito: fórmula, citação, sigla, variável solta e unidade ficam como estão (só a 1ª palavra de minúsculas muda).
  sai('O Stu explica: $x_M = 2$ é o ponto.', '$x_M = 2$ é o ponto.');
  sai('O Stu explica: “Excuse me” serve para pedir licença.', '“Excuse me” serve para pedir licença.');
  sai('O Stu explica: `a.b` aponta para o campo.', '`a.b` aponta para o campo.');
  sai('O Stu explica: iPhone é um telefone.', 'iPhone é um telefone.');
  sai('O Stu explica: pH mede a acidez.', 'pH mede a acidez.');
  sai('O Stu explica: x é a incógnita.', 'x é a incógnita.');
  sai('O Stu explica: km/h mede velocidade.', 'km/h mede velocidade.');
  // Só o rótulo: sobra nada (um conceito vazio, que a lição já recusa).
  sai('O Stu explica:', '');
  sai('**O Stu explica:**', '');
  sai('O Stu explica: O Stu explica:', '');
  // Sem rótulo no começo, o texto volta IGUAL (nem aparar, nem mexer em letra): "O Stu explica" numa frase, no meio do texto ou numa palavra parecida não é rótulo.
  for (const intacto of [
    'O Stu explica que a regra divide a foto.',
    'O Stu explica a regra: ela divide a foto.',
    'A regra dos terços. O Stu explica: isso.',
    'O Stu explicará: a regra.',
    'Estu explica: a regra.',
    'O Stu explica-se: a regra.',
    'O Stu explica -a regra.',
    '"O Stu explica: Excuse me" significa com licença.',
    '  A regra dos terços.  ',
    'a regra dos terços (sem rótulo, minúscula do jeito que veio).',
    '',
  ]) assert.equal(tirar(intacto), intacto, JSON.stringify(intacto));
  // Tirar o rótulo duas vezes dá o mesmo que uma.
  for (const texto of ['O Stu explica: a regra.', '**O Stu explica:** A regra.', 'O Stu explica: O Stu explica: a regra.']) assert.equal(tirar(tirar(texto)), tirar(texto));
});

test('o rótulo repetido: nenhum conceito das amostras reais históricas nem das trilhas de demonstração começa com ele (a conta não mexe no que já está certo)', () => {
  const amostras = JSON.parse(ler('tests/fixtures/licoes-reais-historicas.json'));
  const textos = [
    ...amostras.map((amostra) => amostra.bruto.conceito),
    ...DEMOS.flatMap((demo) => demo.plano.fluxos.flatMap((fluxo) => fluxo.licoes.map((licao) => licao.conceito))),
  ];
  assert.ok(textos.length >= 90, `${textos.length} conceitos`);
  for (const texto of textos) assert.equal(tirarRotuloDoConceito(texto), texto, texto.slice(0, 60));
});

test('a normalização tira o rótulo antes de contar frases e palavras, sem derrubar a lição, e diz que tirou', () => {
  const frases = 'o violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete. As tarraxas afinam as cordas.';
  const lida = normalizarLicao(licaoBruta(`O Stu explica: ${frases}`), 'IA');
  assert.ok(lida.conteudo && conteudoValido(lida.conteudo), 'a lição segue válida');
  assert.equal(lida.conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete. As tarraxas afinam as cordas.');
  assert.equal(lida.rotuloDoConceitoTirado, true);
  assert.equal(lida.conceitoCortado, undefined, 'nada passou do balão');
  assert.deepEqual(lida.descartados, [], 'os exercícios não foram tocados');
  assert.equal(lida.conteudo.exemplo, 'Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.');
  // O caso real da QA, como lição 1 da trilha (2 frases): só o rótulo sai, nada é cortado.
  const real = normalizarLicao(licaoBruta('O Stu explica: a regra dos terços divide a imagem em nove partes iguais com duas linhas horizontais e duas verticais. O assunto fica sobre uma linha ou num ponto de cruzamento.'), 'IA', { primeiraLicao: true });
  assert.equal(real.conteudo.conceito, 'A regra dos terços divide a imagem em nove partes iguais com duas linhas horizontais e duas verticais. O assunto fica sobre uma linha ou num ponto de cruzamento.');
  assert.deepEqual([real.rotuloDoConceitoTirado, real.conceitoCortado], [true, undefined]);
  // Sem rótulo, nada muda e nada é dito.
  const limpa = normalizarLicao(licaoBruta('O violão tem corpo, braço e cabeça.'), 'IA');
  assert.equal(limpa.conteudo.conceito, 'O violão tem corpo, braço e cabeça.');
  assert.equal(limpa.rotuloDoConceitoTirado, undefined);
  // O rótulo não conta como palavra: 60 palavras com ele seriam 63 e a 2ª frase seria cortada. Sem ele, cabe (e a lição 1 mantém as 2 frases).
  const frase = (n) => `${['Ba', ...Array.from({ length: n - 1 }, () => 'ba')].join(' ')}.`;
  const sessenta = `${frase(30)} ${frase(30)}`;
  assert.equal(medirConceito(sessenta).palavras, 60);
  const comRotulo = normalizarLicao(licaoBruta(`O Stu explica: ${sessenta}`), 'IA');
  assert.equal(comRotulo.conteudo.conceito, sessenta, 'as duas frases ficam');
  assert.equal(comRotulo.conceitoCortado, undefined);
  assert.equal(comRotulo.rotuloDoConceitoTirado, true);
  assert.equal(normalizarLicao(licaoBruta(`O Stu explica: ${frase(5)} ${frase(5)}`), 'IA', { primeiraLicao: true }).conteudo.conceito, `${frase(5)} ${frase(5)}`);
  // Rótulo e excesso juntos: tira o rótulo e depois corta na última frase que cabe.
  const dupla = normalizarLicao(licaoBruta(`O Stu explica: ${CONCEITO_LONGO}`), 'IA', { primeiraLicao: true });
  assert.equal(dupla.conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete.');
  assert.deepEqual([dupla.rotuloDoConceitoTirado, dupla.conceitoCortado], [true, true]);
  // Também no caminho de "só o essencial" (um opcional que não fecha) o rótulo sai.
  const comOpcionalRuim = { ...licaoBruta(`O Stu explica: ${frases}`), recurso: { tipo: 'acorde', nome: 'Am', casas: [1, 2], dedos: [0] }, pratica: { tarefa: 'x', minutos: 'abc' } };
  const essencial = normalizarLicao(comOpcionalRuim, 'IA');
  assert.equal(essencial.conteudo.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete. As tarraxas afinam as cordas.');
  assert.equal(essencial.rotuloDoConceitoTirado, true);
  // Um conceito que é só o rótulo é um conceito vazio: a lição é recusada como sempre (nada é inventado).
  assert.equal(normalizarLicao(licaoBruta('O Stu explica:'), 'IA').conteudo, null);
  assert.equal(normalizarLicao(licaoBruta('**O Stu explica:**'), 'IA').conteudo, null);
});

let servidor;
/** O conceito que os servidores falsos devolvem: cada teste pode trocá-lo (e deve voltar ao de sempre). */
let conceitoDoServidor = CONCEITO_LONGO;
before(async () => {
  servidor = createServer((pedido, resposta) => {
    resposta.shouldKeepAlive = false; // cada resposta fecha a conexão: nada de socket velho reaproveitado
    pedido.on('data', () => undefined);
    pedido.on('end', () => {
      const saida = licaoBruta(conceitoDoServidor);
      resposta.writeHead(200, { 'Content-Type': 'application/json' });
      resposta.end(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(saida) }] }] }));
    });
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const porta = servidor.address().port;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${porta}/v1`;
});
after(async () => {
  servidor.closeAllConnections();
  await new Promise((resolver) => servidor.close(resolver));
});

test('de ponta a ponta com a OpenAI simulada: o conceito longo sai com 2 frases na lição 1 e 3 nas outras, e a lição é aceita', async () => {
  const esqueleto = (gerador) => ({
    gerador, titulo: 'Violão do zero', objetivo: 'Tocar as primeiras músicas no violão.', origem: 'IA (teste)',
    fluxos: [{ titulo: 'Primeiros passos', licoes: [{ titulo: 'Conhecer as partes do violão' }, { titulo: 'Afinar as cordas' }] }, { titulo: 'Praticando', licoes: [{ titulo: 'Acordes' }] }],
  });
  for (const [ia, gerador] of [['openai', GERADOR_OPENAI]]) {
    process.env.IA = ia;
    process.env.OPENAI_API_KEY = 'chave-de-teste';
    const adaptador = obterGerador();
    const sinal = new AbortController().signal;
    const trilha = esqueleto(gerador);
    const primeira = await adaptador.gerarConteudo(trilha, 0, 0, sinal);
    const segunda = await adaptador.gerarConteudo(trilha, 0, 1, sinal);
    const outroTrecho = await adaptador.gerarConteudo(trilha, 1, 0, sinal);
    assert.equal(medirConceito(primeira.conceito).frases, 2, `${ia}: lição 1 da trilha`);
    assert.equal(medirConceito(segunda.conceito).frases, 3, `${ia}: lição 2`);
    assert.equal(medirConceito(outroTrecho.conceito).frases, 3, `${ia}: a 1ª lição do 2º trecho não é a lição 1 da trilha`);
    for (const conteudo of [primeira, segunda, outroTrecho]) assert.ok(conteudoValido(conteudo), `${ia}: lição válida`);
  }
  process.env.IA = 'falsa';
});

test('as lições de material: o conceito também sai dentro do balão (2 frases na primeira), sem mexer na citação nem no exercício', () => {
  const pagina = 'O denominador indica em quantas partes iguais o inteiro foi dividido. O numerador conta as partes escolhidas. Por exemplo, em 3/8 há 8 partes iguais e 3 escolhidas.';
  const gerada = (n, conceito) => ({
    titulo: `Lição ${n}`, objetivo: 'Entender a fração.', conceito, exemplo: 'Uma pizza em 8 fatias: comer 3 é 3/8.', pergunta: 'Qual número é o denominador em 3/8?',
    opcoes: ['3', '8', '11'], correta: 1, feedbackCorreto: 'O 8 é o denominador.', feedbackIncorreto: 'O 3 é o numerador.', pagina: 1,
    trecho: 'O denominador indica em quantas partes iguais o inteiro foi dividido.',
  });
  const { conteudos } = conteudosDasLicoes({
    licoes: [gerada(1, CONCEITO_LONGO), gerada(2, CONCEITO_LONGO)], paginas: [{ numero: 1, texto: pagina }], materialId: 'm', nome: 'caderno.pdf', leitura: 'texto', origem: 'Material enviado · caderno',
  });
  assert.equal(medirConceito(conteudos[0].conceito).frases, 2, 'a primeira lição da trilha');
  assert.equal(medirConceito(conteudos[1].conceito).frases, 3);
  for (const conteudo of conteudos) {
    assert.equal(conteudo.exercicio.enunciado, 'Qual número é o denominador em 3/8?');
    assert.equal(conteudo.referencias[0].trecho, 'O denominador indica em quantas partes iguais o inteiro foi dividido.');
  }
});

test('de ponta a ponta com a OpenAI simulada: a IA que repete "O Stu explica:" no começo do conceito sai sem o rótulo, a lição é aceita e o registro diz o ajuste sem conteúdo', async () => {
  const esqueleto = (gerador) => ({
    gerador, titulo: 'Violão do zero', objetivo: 'Tocar as primeiras músicas no violão.', origem: 'IA (teste)',
    fluxos: [{ titulo: 'Primeiros passos', licoes: [{ titulo: 'Conhecer as partes do violão' }, { titulo: 'Afinar as cordas' }] }],
  });
  const original = console.error;
  const registros = [];
  console.error = (...partes) => { registros.push(partes.join(' ')); };
  conceitoDoServidor = `O Stu explica: ${CONCEITO_LONGO[0].toLowerCase()}${CONCEITO_LONGO.slice(1)}`;
  try {
    for (const [ia, gerador, rota] of [['openai', GERADOR_OPENAI, 'ia-openai']]) {
      process.env.IA = ia;
      process.env.OPENAI_API_KEY = 'chave-de-teste';
      registros.length = 0;
      const adaptador = obterGerador();
      const sinal = new AbortController().signal;
      const trilha = esqueleto(gerador);
      const primeira = await adaptador.gerarConteudo(trilha, 0, 0, sinal);
      const segunda = await adaptador.gerarConteudo(trilha, 0, 1, sinal);
      assert.equal(primeira.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete.', `${ia}: lição 1 (2 frases), sem o rótulo e com a inicial maiúscula`);
      assert.equal(segunda.conceito, 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete. As tarraxas afinam as cordas.', `${ia}: lição 2 (3 frases)`);
      for (const conteudo of [primeira, segunda]) {
        assert.ok(conteudoValido(conteudo), `${ia}: lição válida`);
        assert.doesNotMatch(conteudo.conceito, /Stu explica/i);
      }
      const ajustes = registros.flatMap((linha) => { try { const dado = JSON.parse(linha); return dado.codigo === 'licao_ajustada' ? [dado] : []; } catch { return []; } });
      assert.equal(ajustes.length, 2, `${ia}: um registro por lição ajustada`);
      for (const ajuste of ajustes) {
        assert.equal(ajuste.rota, rota);
        assert.match(ajuste.detalhe, /(^|;)conceito:rotulo_tirado(;|$)/);
      }
      assert.ok(!registros.join('\n').includes('violão tem corpo'), `${ia}: o registro não leva o conteúdo da lição`);
    }
  } finally {
    console.error = original;
    conceitoDoServidor = CONCEITO_LONGO;
    process.env.IA = 'falsa';
  }
});

test('as lições de material e o reforço: o conceito também sai sem o rótulo repetido, e um conceito que é só o rótulo não vale', () => {
  const pagina = 'O denominador indica em quantas partes iguais o inteiro foi dividido. O numerador conta as partes escolhidas. Por exemplo, em 3/8 há 8 partes iguais e 3 escolhidas.';
  const gerada = (n, conceito) => ({
    titulo: `Lição ${n}`, objetivo: 'Entender a fração.', conceito, exemplo: 'Uma pizza em 8 fatias: comer 3 é 3/8.', pergunta: 'Qual número é o denominador em 3/8?',
    opcoes: ['3', '8', '11'], correta: 1, feedbackCorreto: 'O 8 é o denominador.', feedbackIncorreto: 'O 3 é o numerador.', pagina: 1,
    trecho: 'O denominador indica em quantas partes iguais o inteiro foi dividido.',
  });
  const material = (licoes) => conteudosDasLicoes({
    licoes, paginas: [{ numero: 1, texto: pagina }], materialId: 'm', nome: 'caderno.pdf', leitura: 'texto', origem: 'Material enviado · caderno',
  }).conteudos;
  const conteudos = material([
    gerada(1, 'O Stu explica: o denominador diz em quantas partes iguais o inteiro foi dividido. O numerador conta as escolhidas. Em 3/8, são 3 de 8.'),
    gerada(2, '**O Stu explica:** O numerador conta as partes escolhidas.'),
    gerada(3, 'O denominador fica embaixo da barra.'),
  ]);
  assert.equal(conteudos[0].conceito, 'O denominador diz em quantas partes iguais o inteiro foi dividido. O numerador conta as escolhidas.', 'sem o rótulo, e a lição 1 do material segue com 2 frases');
  assert.equal(conteudos[1].conceito, 'O numerador conta as partes escolhidas.');
  assert.equal(conteudos[2].conceito, 'O denominador fica embaixo da barra.', 'sem rótulo, igual');
  for (const conteudo of conteudos) assert.equal(conteudo.exercicio.enunciado, 'Qual número é o denominador em 3/8?');
  // O reforço da ponte usa a mesma conversão.
  assert.equal(conteudoDaGerada(gerada(1, 'O Stu explica: outra analogia: a pizza em fatias.'), 'Reforço').conceito, 'Outra analogia: a pizza em fatias.');
  // O conceito que só tem o rótulo é vazio: a lição gerada não vale (o mesmo caminho de qualquer lição gerada inválida).
  assert.equal(licaoGeradaValida(gerada(1, 'O Stu explica:')), false);
  assert.equal(licaoGeradaValida(gerada(1, '   ')), false, 'vazio já era inválido');
  assert.equal(licaoGeradaValida(gerada(1, 'O Stu explica: o denominador.')), true);
  assert.equal(licaoGeradaValida(gerada(1, 'O denominador.')), true);
});

