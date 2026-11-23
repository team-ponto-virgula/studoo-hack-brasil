import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test, after, before } from 'node:test';
import { banco } from '../src/servidor/banco/cliente.ts';
import { VERSAO_CONSENTIMENTO_IA } from '@studoo/contratos/privacidade';
import { buscarApoio, criarPonte, avaliarPonte, ensinarStu } from '../src/servidor/estudio/apoio.ts';
import { aceitarProposta, gerarProposta, avaliarLicao } from '../src/servidor/aprendizado/servico.ts';

/*
 * Marco 13d, de ponta a ponta (banco + servidor + uma OpenAI que um servidor local imita): a ponte do reforço e o retorno do "Ensine o Stu" que a IA escreve
 * com `$…$` chegam a todos os clientes em texto linear, sem símbolo cru, e o pedido à IA diz para escrever a matemática em texto simples. Numa lição que não
 * é de matemática, "R$ 25,00" e "$HOME" ficam. Nenhuma chamada a provedor de verdade.
 */
const aceiteIa = { consentimentoIaEm: new Date(), consentimentoIaVersao: VERSAO_CONSENTIMENTO_IA };
const usuarios = [];
async function pessoa() {
  const u = await banco.usuario.create({ data: { email: `apoio-ia-${crypto.randomUUID()}@example.test`, fuso: 'UTC', ...aceiteIa } });
  usuarios.push(u.id);
  return u.id;
}

let servidor;
let pedidos = [];
/** O que a IA "escreve" em cada pedido: a ponte (reforço) e o retorno do Ensine o Stu. Troca por teste. */
let escritoPelaIa = {};
const CRU = /[$\\{}^]/;
const semDinheiro = (texto) => texto.replace(/R\$ ?\d[\d.,]*/g, '');
const textos = (valor) => (typeof valor === 'string' ? [valor] : Array.isArray(valor) ? valor.flatMap(textos) : valor && typeof valor === 'object' ? Object.values(valor).flatMap(textos) : []);

before(async () => {
  servidor = createServer((pedido, resposta) => {
    resposta.shouldKeepAlive = false; // cada resposta fecha a conexão: nada de socket velho reaproveitado (ECONNRESET ao acaso)
    let corpo = '';
    pedido.on('data', (parte) => { corpo += parte; });
    pedido.on('end', () => {
      const dados = corpo ? JSON.parse(corpo) : {};
      pedidos.push({ nome: dados.text?.format?.name, instrucoes: dados.instructions ?? '' });
      const saida = escritoPelaIa[dados.text?.format?.name];
      resposta.writeHead(saida ? 200 : 500, { 'Content-Type': 'application/json' });
      resposta.end(JSON.stringify(saida ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(saida) }] }] } : { error: { message: 'sem resposta' } }));
    });
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${servidor.address().port}/v1`;
  process.env.OPENAI_API_KEY = 'chave-de-teste';
});

after(async () => {
  servidor.closeAllConnections();
  await new Promise((resolver) => servidor.close(resolver));
  for (const usuarioId of usuarios) {
    await banco.apoioLicao.deleteMany({ where: { usuarioId } });
    await banco.registroEstudo.deleteMany({ where: { usuarioId } });
    await banco.licao.deleteMany({ where: { usuarioId } });
    await banco.fluxo.deleteMany({ where: { usuarioId } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId } });
    await banco.sessao.deleteMany({ where: { usuarioId } });
    await banco.usuario.delete({ where: { id: usuarioId } });
  }
  await banco.$disconnect();
});

/** Uma trilha da demonstração (IA falsa) e o primeiro erro registrado; depois, o apoio passa a falar com a "OpenAI" local. */
async function pessoaComErro(objetivo, respostaErrada, indice = 0) {
  process.env.IA = 'falsa';
  const u = await pessoa();
  const plano = await aceitarProposta(u, (await gerarProposta(u, objetivo)).token);
  const id = plano.fluxos[0].licoes[0].id;
  assert.equal((await avaliarLicao(u, id, respostaErrada, indice)).correta, false);
  process.env.IA = 'openai';
  pedidos = [];
  return { u, id };
}

const ponteEscrita = (extra = {}) => ({
  motivo: 'Você respondeu $\\cos x$, mas $\\sin x$ varia entre $-1$ e $1$. Vamos ver de outro jeito.',
  licao: {
    titulo: 'Reforço',
    objetivo: 'Rever a razão $\\frac{a}{b}$.',
    conceito: 'A razão $\\frac{a}{b}$ só existe se $b \\neq 0$. Complete: $h = $ ___ no ponto zero.',
    exemplo: 'Um lanche de R$ 25,00 e outro de $A reais: $\\frac{6}{3}$ é 2.',
    pergunta: 'Quanto vale $\\sin 0$?',
    opcoes: ['$0$', '$1$', 'R$ 25,00'],
    correta: 0,
    feedbackCorreto: 'Isso: $\\sin 0 = 0$.',
    feedbackIncorreto: 'Releia: $\\sin 0$ vale $0$, e $\\frac{a}{b}$ pede $b \\neq 0$.',
    pagina: 0,
    trecho: '',
    ...extra,
  },
});
const ensinoEscrito = () => ({
  acertos: ['Você disse que $\\sin x$ vai de $-1$ a $1$.', 'E que $\\frac{a}{b}$ pede $b \\neq 0$.'],
  lacuna: 'Faltou dizer quanto vale $h = $ ___ no ponto zero.',
  pergunta: 'E se fosse $\\cos x$? Custa R$ 25,00 aprender isso?',
  proximoPasso: 'Escreva o gráfico de $y = x^2$ e confira.',
});

test('matemática: a ponte (GET, criar e avaliar) e o Ensine o Stu chegam em texto linear, sem símbolo cru; o dinheiro fica', async () => {
  const { u, id } = await pessoaComErro('Quero aprender geometria analítica: ponto médio e baricentro', 'a');
  escritoPelaIa = { ponte_reforco: ponteEscrita(), ensine_ao_stu: ensinoEscrito() };

  const criada = await criarPonte(u, id);
  assert.equal(criada.ponte.simulado, false, 'a ponte veio da IA (a local não escreve fórmula)');
  for (const texto of textos(criada)) assert.doesNotMatch(semDinheiro(texto), CRU, texto);
  assert.equal(criada.ponte.motivo, 'Você respondeu cos x, mas sen x varia entre −1 e 1. Vamos ver de outro jeito.');
  assert.equal(criada.ponte.conceito, 'A razão a/b só existe se b ≠ 0. Complete: h = ___ no ponto zero.');
  assert.equal(criada.ponte.exemplo, 'Um lanche de R$ 25,00 e outro de A reais: 6/3 é 2.', 'o dinheiro fica e o $ solto sai');
  assert.equal(criada.ponte.exercicio.enunciado, 'Quanto vale sen 0?');
  assert.deepEqual(criada.ponte.exercicio.opcoes.map(({ texto }) => texto).sort(), ['0', '1', 'R$ 25,00']);

  // O que está guardado vale também na leitura seguinte (GET do apoio): a ponte já escrita e as antigas ficam limpas.
  const lida = await buscarApoio(u, id);
  for (const texto of textos(lida)) assert.doesNotMatch(semDinheiro(texto), CRU, texto);
  assert.equal(lida.ponte.conceito, criada.ponte.conceito);

  // Avaliar a ponte: o retorno (feedback) também vem limpo, e o apoio que vai junto.
  const opcaoCerta = criada.ponte.exercicio.opcoes.find(({ texto }) => texto === '0');
  const certa = await avaliarPonte(u, id, opcaoCerta.id);
  assert.equal(certa.correta, true);
  for (const texto of textos(certa)) assert.doesNotMatch(semDinheiro(texto), CRU, texto);
  assert.equal(certa.feedback, 'Isso: sen 0 = 0.');
  const errada = await avaliarPonte(u, id, criada.ponte.exercicio.opcoes.find(({ texto }) => texto === '1').id);
  assert.equal(errada.feedback, 'Releia: sen 0 vale 0, e a/b pede b ≠ 0.');

  // O Ensine o Stu: o retorno e o que fica guardado.
  const ensino = await ensinarStu(u, id, 'O seno vai de menos um a um, e uma fração só existe com denominador diferente de zero.');
  assert.equal(ensino.simulado, false);
  for (const texto of textos(ensino)) assert.doesNotMatch(semDinheiro(texto), CRU, texto);
  assert.deepEqual(ensino.acertos, ['Você disse que sen x vai de −1 a 1.', 'E que a/b pede b ≠ 0.']);
  assert.equal(ensino.lacuna, 'Faltou dizer quanto vale h = ___ no ponto zero.');
  assert.equal(ensino.pergunta, 'E se fosse cos x? Custa R$ 25,00 aprender isso?');
  assert.equal(ensino.proximoPasso, 'Escreva o gráfico de y = x² e confira.');
  const guardado = await banco.apoioLicao.findUnique({ where: { usuarioId_licaoId: { usuarioId: u, licaoId: id } } });
  assert.deepEqual(guardado.ensino, JSON.parse(JSON.stringify(ensino)), 'o retorno fica guardado já em texto linear');
  assert.deepEqual((await buscarApoio(u, id)).ensino, ensino);

  // O pedido à IA das duas funções pede a matemática em texto simples.
  for (const nome of ['ponte_reforco', 'ensine_ao_stu']) {
    const pedido = pedidos.find((p) => p.nome === nome);
    assert.ok(pedido, nome);
    assert.match(pedido.instrucoes, /Escreva a matemática em texto simples, sem \$ nem LaTeX \(x², a\/b, raiz de x\)\./, nome);
  }
});

test('o que a ponte guardou ANTES desta regra (com $…$ no banco) também sai limpo na leitura', async () => {
  const { u, id } = await pessoaComErro('Quero aprender geometria analítica: ponto médio e baricentro', 'a');
  escritoPelaIa = { ponte_reforco: ponteEscrita(), ensine_ao_stu: ensinoEscrito() };
  await criarPonte(u, id);
  // O que o banco tem é o texto como a IA o escreveu (a limpeza é na saída): a ponte antiga e a nova passam pela mesma porta.
  const bruto = await banco.apoioLicao.findUnique({ where: { usuarioId_licaoId: { usuarioId: u, licaoId: id } } });
  assert.match(JSON.stringify(bruto.reforco), /\\\\sin x/, 'guardada como veio');
  const lida = await buscarApoio(u, id);
  assert.doesNotMatch(semDinheiro(JSON.stringify(lida)), /\\\\|\$/);
});

test('fora da matemática: "R$ 25,00" e $HOME ficam na ponte e no Ensine o Stu', async () => {
  const { u, id } = await pessoaComErro('Quero aprender violão do zero', 'zzzz', 1);
  escritoPelaIa = {
    ponte_reforco: ponteEscrita({
      objetivo: 'Rever as cordas.', conceito: 'A corda custa R$ 25,00; no shell, $HOME é a pasta da pessoa.', exemplo: 'Afine a corda e confira.',
      pergunta: 'Qual corda custa R$ 25,00?', opcoes: ['A mi', 'A si', 'A $HOME'], correta: 0, feedbackCorreto: 'Isso.', feedbackIncorreto: 'Releia.',
    }),
    ensine_ao_stu: { acertos: ['Você falou das cordas; uma custa R$ 25,00.'], lacuna: 'Falou de $HOME?', pergunta: 'E a afinação?', proximoPasso: 'Toque.' },
  };
  escritoPelaIa.ponte_reforco.motivo = 'Você escreveu zzzz; a corda custa R$ 25,00.';
  const criada = await criarPonte(u, id);
  assert.equal(criada.ponte.simulado, false);
  assert.equal(criada.ponte.conceito, 'A corda custa R$ 25,00; no shell, $HOME é a pasta da pessoa.');
  assert.equal(criada.ponte.motivo, 'Você escreveu zzzz; a corda custa R$ 25,00.');
  assert.deepEqual(criada.ponte.exercicio.opcoes.map(({ texto }) => texto).sort(), ['A $HOME', 'A mi', 'A si']);
  const ensino = await ensinarStu(u, id, 'As cordas do violão soam diferentes porque a espessura muda.');
  assert.deepEqual(ensino.acertos, ['Você falou das cordas; uma custa R$ 25,00.']);
  assert.equal(ensino.lacuna, 'Falou de $HOME?');
});
