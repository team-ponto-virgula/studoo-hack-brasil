import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { setTimeout as esperar } from 'node:timers/promises';

const [porta, liberar] = process.argv.slice(2);
if (!porta || !liberar) throw new Error('Informe a porta local e o caminho do sinal de liberação.');

const titulo = 'Observar o céu noturno';
const blocos = [
  ['Primeiras observações', 'Encontrar o horizonte', 'Escolher um local escuro', 'Orientar um mapa', 'Anotar a hora'],
  ['Reconhecer o céu', 'Distinguir planetas de estrelas', 'Registrar a Lua', 'Identificar constelações'],
  ['Estudar as anotações', 'Comparar registros', 'Planejar outra observação', 'Revisão: interpretar os registros'],
];
const licoes = blocos.flatMap(([, ...itens]) => itens);
const estrutura = [{ tipo: 'plano', titulo }, ...blocos.flatMap(([parte, ...itens]) => [
  { tipo: 'fluxo', titulo: parte },
  ...itens.map(nome => ({ tipo: 'licao', titulo: nome, resumo: `Praticar como ${nome.toLowerCase()}.` })),
])];

const diagnostico = {
  escopo: 'Observação do céu noturno', nivelDeclarado: 'nao_declarado', recortes: [],
  questao: {
    habilidade: 'Escolher um local escuro',
    enunciado: 'Qual lugar facilita ver estrelas pouco brilhantes?',
    opcoes: ['Um local afastado de luminárias', 'Uma praça sob holofotes', 'Uma janela com luz acesa'],
    correta: 0,
  },
};

function registrar(etapa, dados = {}) {
  console.log(JSON.stringify({ etapa, em: Date.now(), ...dados }));
}

function json(resposta, dados) {
  resposta.writeHead(200, { 'Content-Type': 'application/json' });
  resposta.end(JSON.stringify({ status: 'completed', output_text: JSON.stringify(dados) }));
}

const servidor = createServer(async (requisicao, resposta) => {
  if (requisicao.method !== 'POST' || requisicao.url !== '/v1/responses') {
    resposta.writeHead(404).end();
    return;
  }
  try {
    let corpo = '';
    for await (const parte of requisicao) corpo += parte;
    const pedido = JSON.parse(corpo);
    const nome = pedido.text?.format?.name;
    if (pedido.stream) {
      if (!String(pedido.input?.[1]?.content).includes('Astronomia')) throw new Error('objetivo');
      registrar('proposta');
      const delta = estrutura.map(linha => JSON.stringify(linha)).join('\n') + '\n';
      resposta.writeHead(200, { 'Content-Type': 'text/event-stream' });
      resposta.end(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\ndata: {"type":"response.completed"}\n\n`);
    } else if (nome === 'triagem_trilha') {
      const dados = JSON.parse(pedido.input[0].content[0].text);
      registrar(dados.plano ? 'triagem-aceite' : dados.conteudo ? 'triagem-licoes' : 'triagem-proposta');
      json(resposta, { decisao: 'permitir' });
    } else if (nome === 'diagnostico') {
      registrar('diagnostico');
      json(resposta, diagnostico);
    } else if (nome === 'licao_studoo') {
      const trecho = pedido.input[1].content;
      const numero = Number(trecho.match(/Escreva a lição (\d+):/)?.[1]);
      if (!Number.isInteger(numero) || numero < 1 || numero > licoes.length) throw new Error('licao');
      registrar('licao', { numero });
      const limite = Date.now() + 150_000;
      while (!existsSync(liberar) && Date.now() < limite && !resposta.destroyed) await esperar(150);
      if (resposta.destroyed) return;
      if (!existsSync(liberar)) throw new Error('liberacao');
      json(resposta, {
        objetivo: licoes[numero - 1],
        conceito: 'O céu fica mais fácil de observar quando há pouca iluminação artificial.',
        exemplo: 'A turma apagou a luz da varanda e encontrou mais estrelas depois de alguns minutos.',
        exercicios: [{
          tipo: 'multipla_escolha',
          enunciado: 'Onde a turma veria estrelas menos brilhantes?',
          opcoes: [{ id: 'a', texto: 'Em um local escuro' }, { id: 'b', texto: 'Sob um holofote' }, { id: 'c', texto: 'Ao lado de um farol' }],
          gabarito: ['a'],
          feedbackCorreto: 'A pouca iluminação ajuda a distinguir estrelas menos brilhantes.',
          feedbackIncorreto: 'Procure o local em que a iluminação não dificulta enxergar o céu.',
        }],
      });
    } else {
      throw new Error('pedido');
    }
  } catch {
    registrar('falha');
    if (!resposta.headersSent) resposta.writeHead(500);
    resposta.end();
  }
});

servidor.listen(Number(porta), '127.0.0.1', () => registrar('escutando'));
