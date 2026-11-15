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
import { FalhaApi } from '../acesso/http';
import { buscarLicao, conteudoDaLicao } from '../aprendizado/servico';
import { exercicioDaResposta, reforcoDoExercicio } from '@/dominio/aprendizado/reforco';
import { armadilhaNoTexto, termosDaLicao, termosPresentes } from '@/dominio/aprendizado/plano';
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

/** O reforço guardado: `resposta` é o erro de onde ele veio (um erro novo, em outro exercício, pede outro reforço). */
type Reforco = ConteudoLicao & { motivo: string; simulado: boolean; resposta?: string | null };
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
/**
 * Reforço sem IA. A lição de numerador e denominador mantém a explicação com chocolate da demonstração do material;
 * as outras ganham uma pergunta mais simples sobre o exercício que a pessoa errou (veja `reforcoDoExercicio`).
 */
/**
 * O “outro jeito” sem IA: o que a lição traz escrito para isso (`outroJeito`, uma analogia ou regra prática); sem ele,
 * o passo a passo ou as frases (uma por linha) e, por último, o exemplo da lição.
 */
function outroExemplo(licao: LicaoDetalhe, interno: ConteudoLicao): string {
  if (interno.outroJeito) return interno.outroJeito;
  if (licao.passos?.length) return `Pelo passo a passo:\n${licao.passos.map((passo, posicao) => `${posicao + 1}) ${passo}`).join('\n')}`;
  if (licao.falas?.length) return `Frases da lição:\n${licao.falas.map(({ texto, traducao }) => (traducao ? `“${texto}” (${traducao})` : `“${texto}”`)).join('\n')}`;
  return `Lembre do exemplo da lição: ${licao.exemplo}`;
}

const PALAVRAS_COMUNS = new Set([
  'quando', 'sobre', 'porque', 'entre', 'depois', 'antes', 'assim', 'ainda', 'muito', 'muita', 'mesmo', 'mesma', 'outra',
  'outro', 'outras', 'outros', 'todas', 'todos', 'sempre', 'pelos', 'pelas', 'desta', 'deste', 'dessa', 'desse', 'nessa',
  'nesse', 'nesta', 'neste', 'essas', 'esses', 'estas', 'estes', 'aquela', 'aquele', 'tambem', 'apenas', 'podem', 'devem',
  'fazem', 'estao', 'ficam', 'tinha', 'tinham', 'cada', 'principais', 'primeiro', 'primeira', 'segundo', 'segunda',
  'coisa', 'coisas', 'parte', 'partes', 'forma', 'formas', 'tempo', 'vezes', 'lugar', 'grande', 'grandes', 'menos',
  'estou', 'estava', 'estar', 'estamos', 'tenho', 'temos', 'quero', 'queria', 'fazer', 'dizer', 'falar', 'usar', 'serve',
]);

/**
 * As palavras da explicação da lição (5 letras ou mais, sem as muito comuns nem as do título, como “violão”) que também
 * aparecem no texto da pessoa: são as ideias que ela trouxe, não o nome do assunto.
 */
function palavrasDoConceito(conceito: string, explicacao: string, titulo = ''): string[] {
  const comparavel = (palavra: string) => palavra.normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('pt-BR');
  const usadas = new Set((explicacao.match(/\p{L}+/gu) ?? []).map(comparavel));
  const vistas = new Set((titulo.match(/\p{L}+/gu) ?? []).map(comparavel));
  return (conceito.replace(/“[^”]*”/g, ' ').match(/\p{L}{5,}/gu) ?? []).filter((palavra) => {
    const chave = comparavel(palavra);
    if (PALAVRAS_COMUNS.has(chave) || vistas.has(chave) || !usadas.has(chave)) return false;
    vistas.add(chave);
    return true;
  }).map((palavra) => palavra.toLocaleLowerCase('pt-BR'));
}

function reforcoFalso(licao: LicaoDetalhe, interno: ConteudoLicao, resposta: string | null): Reforco {
  const fracao = /numerador|denominador/i.test(licao.titulo);
  if (!fracao) {
    const exercicio = exercicioDaResposta([interno.exercicio, ...(interno.extras ?? [])], resposta);
    return { objetivo: licao.objetivo, origem: 'Modo demonstração', simulado: true, ...reforcoDoExercicio(exercicio, resposta, outroExemplo(licao, interno)) };
  }
  return {
    objetivo: licao.objetivo,
    origem: 'Modo demonstração',
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
        ? 'Isso! As seis fatias formam o inteiro.'
        : 'Isso: essa é a ideia central da lição.',
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
  // O reforço é do último erro: se o guardado veio de outro erro (outro exercício), faz um novo.
  if (apoio.reforco && (apoio.reforco as unknown as Reforco).resposta === apoio.ultimaResposta) return buscarApoio(usuarioId, licaoId);
  await quota(usuarioId, 'ponte');
  let ponte: Reforco;
  if (process.env.IA === 'falsa') ponte = reforcoFalso(licao, await conteudoDaLicao(usuarioId, licaoId), apoio.ultimaResposta);
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
    where: { usuarioId, licaoId },
    data: { reforco: JSON.parse(JSON.stringify({ ...ponte, resposta: apoio.ultimaResposta })), reforcoConcluido: false },
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
    // Sem IA: o retorno não confere se o texto está certo, mas diz quais ideias-chave da lição (tiradas das respostas dos
    // exercícios) a explicação trouxe, quais faltaram e se a pessoa já deu um exemplo.
    const semAcento = explicacao.normalize('NFD').replace(/\p{M}+/gu, '');
    // Exemplo é o que a pessoa marca como exemplo (números e "quando" aparecem em qualquer explicação de violão).
    const comExemplo = /\b(?:por exemplo|exemplo|ex\.|imagine|como quando|digamos|tipo assim|e o caso de|no caso de)\b/i.test(semAcento);
    const conteudo = await conteudoDaLicao(usuarioId, licaoId);
    const termos = termosDaLicao(conteudo);
    const trouxe = termosPresentes(explicacao, termos);
    const faltou = termos.filter((termo) => !trouxe.includes(termo));
    // Trouxe a maior parte das ideias: o que falta vira um complemento opcional, não um "que tal incluir".
    const cobriu = termos.length > 0 && trouxe.length * 2 >= termos.length;
    // Um erro comum no próprio texto (“I here”, sem o verbo) vem antes de tudo no "O que revisar".
    const armadilha = armadilhaNoTexto(conteudo, explicacao);
    const lista = (itens: string[]) => {
      const citados = itens.map((item) => `“${item}”`);
      return citados.length > 1 ? `${citados.slice(0, -1).join(', ')} e ${citados.at(-1)}` : citados[0] ?? '';
    };
    // As palavras da explicação do Stu que a pessoa também usou (“cabeça, braço e corpo”): contam como acerto, mesmo
    // quando não são as respostas dos exercícios.
    const doConceito = palavrasDoConceito(licao.conceito, explicacao, licao.titulo)
      .filter((palavra) => !trouxe.some((termo) => termo.toLocaleLowerCase('pt-BR').includes(palavra.toLocaleLowerCase('pt-BR'))));
    feedback = {
      acertos: [
        ...(trouxe.length > 0
          ? [`Você falou de ${lista(trouxe)}, ${trouxe.length === 1 ? 'uma ideia-chave' : 'ideias-chave'} desta lição.`]
          : []),
        // As palavras da explicação só entram quando nenhuma ideia-chave apareceu (senão, a lista soava mecânica).
        ...(trouxe.length === 0 && doConceito.length > 0 ? [`Você usou ideias da explicação da lição, como ${lista(doConceito.slice(0, 3))}.`] : []),
        ...(trouxe.length === 0 && doConceito.length === 0 ? ['Você explicou com as suas palavras.'] : []),
        ...(comExemplo ? ['Você usou um exemplo, e isso ajuda a lembrar.'] : []),
      ],
      lacuna: armadilha
        ?? (faltou.length > 0 && !cobriu
          ? `Que tal incluir ${lista(faltou.slice(0, 3))}? ${faltou.length === 1 ? 'É uma ideia-chave' : 'São ideias-chave'} desta lição.`
          : faltou.length > 0
            ? `Você trouxe a maior parte das ideias. Para completar, se quiser: ${lista(faltou.slice(0, 2))}.`
            : comExemplo
              ? 'Nenhuma ideia importante ficou de fora.'
              : 'Faltou só um exemplo seu: uma situação concreta em que você usaria isso.'),
      pergunta: faltou.length > 0 && !cobriu
        ? `Se alguém te perguntasse sobre “${faltou[0]}”, o que você diria, com um exemplo seu?`
        : trouxe.length > 0
          ? `E numa situação diferente da sua explicação? Conte como “${trouxe[0]}” aparece num caso novo, com um exemplo seu.`
          : 'Se você fosse ensinar isso a alguém que nunca viu o assunto, por onde começaria?',
      proximoPasso: armadilha
        ? 'Reescreva a frase com a correção acima e leia em voz alta: é assim que a forma certa fica.'
        : faltou.length > 0 && !cobriu
        ? `Releia a explicação do Stu procurando “${faltou[0]}” e reescreva a sua com essa ideia, em uma frase.`
        : faltou.length > 0
        ? `Amanhã, tente explicar de novo sem olhar, incluindo “${faltou[0]}”.`
        : 'Sua explicação já cobre as ideias da lição. Amanhã, tente explicar de novo sem olhar: é assim que a ideia fica.',
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
