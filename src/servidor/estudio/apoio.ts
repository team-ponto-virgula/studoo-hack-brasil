import type {
  ApoioEstudo,
  FeedbackEnsino,
  LicaoDetalhe,
} from '@studoo/contratos';
import {
  apresentarExercicio,
  avaliarResposta,
  conteudoValido,
  type ConteudoLicao,
} from '@/dominio/aprendizado/plano';
import { banco } from '../banco/cliente';
import { Prisma } from '../banco/gerado/client';
import { FalhaApi } from '../acesso/http';
import { buscarLicao } from '../aprendizado/servico';
import { quota } from './materiais';
import {
  conteudoDaGerada,
  esquemaLicao,
  licaoGeradaValida,
  lista,
  objeto,
  pedirJson,
  texto,
} from './ia';

type Reforco = ConteudoLicao & { motivo: string; simulado: boolean };
export async function buscarApoio(
  usuarioId: string,
  licaoId: string,
): Promise<ApoioEstudo> {
  await buscarLicao(usuarioId, licaoId);
  const apoio = await banco.apoioLicao.findUnique({
    where: { usuarioId_licaoId: { usuarioId, licaoId } },
  });
  const ponte = apoio?.reforco as Reforco | null;
  return {
    erros: apoio?.erros ?? 0,
    ponte:
      ponte && conteudoValido(ponte)
        ? {
            motivo: ponte.motivo,
            conceito: ponte.conceito,
            exemplo: ponte.exemplo,
            exercicio: apresentarExercicio(ponte.exercicio),
            concluida: apoio!.reforcoConcluido,
            simulado: ponte.simulado,
          }
        : null,
    ensino: (apoio?.ensino as FeedbackEnsino | null) ?? null,
  };
}
function reforcoFalso(licao: LicaoDetalhe): Reforco {
  const fracao = /numerador|denominador/i.test(licao.titulo);
  return {
    objetivo: licao.objetivo,
    origem: 'Demonstração simulada',
    motivo:
      'Uma resposta incorreta indica que vale revisar esta ideia antes de continuar.',
    simulado: true,
    conceito: fracao
      ? 'Pense numa barra de chocolate: o número de baixo conta todos os pedaços iguais; o de cima conta apenas os pedaços escolhidos.'
      : `Vamos olhar novamente para a ideia central: ${licao.conceito}`,
    exemplo: fracao
      ? 'Uma barra tem 10 quadradinhos iguais. Você comeu 4. A fração é 4/10: quatro escolhidos de dez no total.'
      : `Aplique esta regra ao exemplo: ${licao.exemplo}`,
    exercicio: {
      tipo: 'multipla_escolha',
      enunciado: fracao
        ? 'Um bolo tem 6 fatias iguais e 2 foram servidas. Qual é o denominador da fração servida?'
        : 'Qual ideia desta lição deve orientar sua próxima tentativa?',
      opcoes: [
        { id: '0', texto: fracao ? '2' : 'Ignorar as condições do enunciado.' },
        { id: '1', texto: fracao ? '6' : licao.conceito.slice(0, 350) },
        {
          id: '2',
          texto: fracao ? '8' : 'Escolher uma resposta sem conferir o exemplo.',
        },
      ],
      gabarito: ['1'],
      feedbackCorreto: fracao
        ? 'Isso! As seis fatias formam o inteiro. Agora volte ao exercício original.'
        : 'Essa é a ideia central. Use-a para resolver o exercício original.',
      feedbackIncorreto: fracao
        ? 'Conte todas as partes iguais do bolo: são seis. Duas é a quantidade servida.'
        : 'Compare com a explicação: a ideia central orienta a solução, em vez de adivinhar.',
    },
  };
}
const gerando = new Map<string, Promise<ApoioEstudo>>();
export async function criarPonte(usuarioId: string, licaoId: string) {
  const chave = `${usuarioId}:${licaoId}`;
  const anterior = gerando.get(chave);
  if (anterior) return anterior;
  const tarefa = gerarPonte(usuarioId, licaoId).finally(() =>
    gerando.delete(chave),
  );
  gerando.set(chave, tarefa);
  return tarefa;
}
async function gerarPonte(
  usuarioId: string,
  licaoId: string,
): Promise<ApoioEstudo> {
  const licao = await buscarLicao(usuarioId, licaoId);
  const apoio = await banco.apoioLicao.findUnique({
    where: { usuarioId_licaoId: { usuarioId, licaoId } },
  });
  if (!apoio || apoio.erros < 1) throw new FalhaApi('reforco_indisponivel');
  if (apoio.reforco) return buscarApoio(usuarioId, licaoId);
  await quota(usuarioId, 'ponte');
  let ponte: Reforco;
  if (process.env.IA === 'falsa') ponte = reforcoFalso(licao);
  else {
    const result = await pedirJson(
      'ponte_reforco',
      objeto({ motivo: texto, licao: esquemaLicao }),
      'Identifique uma possível dificuldade a partir da resposta, sem afirmar um diagnóstico. Explique com uma analogia diferente e um exemplo resolvido NOVO. Crie outro exercício, diferente do original, com 3 alternativas e correta como índice 0..2. Não copie o enunciado original. A motivação deve ser gentil e específica. pagina=0 e trecho="" pois este reforço deriva da lição fornecida. Textos até 1800 caracteres.',
      { licao, resposta: apoio.ultimaResposta },
    );
    const r = result as { motivo: string; licao: unknown };
    if (
      !r ||
      typeof r.motivo !== 'string' ||
      !r.motivo.trim() ||
      r.motivo.length > 600 ||
      !licaoGeradaValida(r.licao) ||
      r.licao.pergunta.trim() === licao.exercicio.enunciado.trim()
    )
      throw new FalhaApi('ia_indisponivel');
    ponte = {
      ...conteudoDaGerada(r.licao, 'Reforço gerado a partir da lição'),
      motivo: r.motivo,
      simulado: false,
    };
  }
  await banco.apoioLicao.updateMany({
    where: { usuarioId, licaoId, reforco: { equals: Prisma.DbNull } },
    data: { reforco: JSON.parse(JSON.stringify(ponte)) },
  });
  return buscarApoio(usuarioId, licaoId);
}
export async function avaliarPonte(
  usuarioId: string,
  licaoId: string,
  resposta: string,
) {
  await buscarLicao(usuarioId, licaoId);
  const registro = await banco.apoioLicao.findUnique({
    where: { usuarioId_licaoId: { usuarioId, licaoId } },
  });
  if (!registro || !conteudoValido(registro.reforco))
    throw new FalhaApi('reforco_indisponivel');
  const resultado = avaliarResposta(registro.reforco.exercicio, resposta);
  if (!resultado) throw new FalhaApi('invalido');
  if (resultado.correta)
    await banco.apoioLicao.update({
      where: { usuarioId_licaoId: { usuarioId, licaoId } },
      data: { reforcoConcluido: true },
    });
  return { ...resultado, apoio: await buscarApoio(usuarioId, licaoId) };
}
export async function ensinarStu(
  usuarioId: string,
  licaoId: string,
  explicacao: string,
): Promise<FeedbackEnsino> {
  if (explicacao.trim().length < 20 || explicacao.length > 3000)
    throw new FalhaApi('invalido');
  const licao = await buscarLicao(usuarioId, licaoId);
  await quota(usuarioId, 'ensino');
  let feedback: FeedbackEnsino;
  if (process.env.IA === 'falsa') {
    feedback = {
      acertos: ['Você formulou uma explicação com suas palavras.'],
      lacuna: `Compare sua explicação com esta ideia: ${licao.conceito}`,
      pergunta: `Como você aplicaria “${licao.titulo}” em outro exemplo?`,
      proximoPasso:
        'Demonstração: este retorno não avalia a correção do texto. Revise a ideia e tente explicar com um exemplo concreto.',
      simulado: true,
    };
  } else {
    const result = await pedirJson(
      'ensine_ao_stu',
      objeto({
        acertos: lista(texto),
        lacuna: texto,
        pergunta: texto,
        proximoPasso: texto,
      }),
      'Avalie a explicação em relação à lição. Liste de zero a três pontos realmente corretos; não elogie afirmações falsas. Identifique uma lacuna ou diga que não identificou lacuna neste recorte. Faça uma pergunta de transferência para um contexto novo e proponha uma ação curta. Não atribua nota nem declare domínio do assunto. Se o texto for alheio ao tema, diga isso. Cada texto até 800 caracteres.',
      { licao, explicacao },
    );
    const x = result as FeedbackEnsino;
    if (
      !x ||
      !Array.isArray(x.acertos) ||
      x.acertos.length > 3 ||
      !x.acertos.every(
        (s) => typeof s === 'string' && s.trim() && s.length <= 800,
      ) ||
      ![x.lacuna, x.pergunta, x.proximoPasso].every(
        (s) => typeof s === 'string' && s.trim() && s.length <= 800,
      )
    )
      throw new FalhaApi('ia_indisponivel');
    feedback = {
      acertos: x.acertos,
      lacuna: x.lacuna,
      pergunta: x.pergunta,
      proximoPasso: x.proximoPasso,
      simulado: false,
    };
  }
  await banco.apoioLicao.upsert({
    where: { usuarioId_licaoId: { usuarioId, licaoId } },
    create: {
      usuarioId,
      licaoId,
      ensino: JSON.parse(JSON.stringify(feedback)),
    },
    update: { ensino: JSON.parse(JSON.stringify(feedback)) },
  });
  return feedback;
}
