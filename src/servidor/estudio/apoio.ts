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
import { buscarLicao, conteudoDaLicao, licaoEhDeMatematica } from '../aprendizado/servico';
import { comTextoSimples } from '../aprendizado/formulas-na-licao';
import { exercicioDaResposta, reforcoDoExercicio } from '@/dominio/aprendizado/reforco';
import { armadilhaNoTexto, normalizarResposta, termosDaLicao, termosPresentes } from '@/dominio/aprendizado/plano';
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
import { podeUsarIa } from '../privacidade/consentimento';

/**
 * O reforço guardado: `resposta` e `indice` são o erro de onde ele veio (um erro novo, ou o mesmo texto em outro
 * exercício, pede outro reforço).
 */
type Reforco = ConteudoLicao & { motivo: string; simulado: boolean; resposta?: string | null; indice?: number | null };
/**
 * Nenhum cliente desenha fórmula na ponte nem no retorno do "Ensine o Stu" (marco 13d): o texto que a IA escreve ali, e o que já está guardado, chega em texto
 * linear a todos (`comTextoSimples`), e o pedido à IA diz para escrever a matemática em texto simples.
 */
export const PEDIDO_DE_TEXTO_SIMPLES = 'Escreva a matemática em texto simples, sem $ nem LaTeX (x², a/b, raiz de x).';
export async function buscarApoio(
  usuarioId: string,
  licaoId: string,
): Promise<ApoioEstudo> {
  await buscarLicao(usuarioId, licaoId);
  const apoio = await banco.apoioLicao.findUnique({
    where: { usuarioId_licaoId: { usuarioId, licaoId } },
  });
  const ponte = apoio?.reforco as Reforco | null;
  return comTextoSimples({
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
  }, await licaoEhDeMatematica(usuarioId, licaoId));
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

function reforcoFalso(licao: LicaoDetalhe, interno: ConteudoLicao, resposta: string | null, indice: number | null): Reforco {
  const fracao = /numerador|denominador/i.test(licao.titulo);
  if (!fracao) {
    // O exercício do erro é o que a avaliação registrou; sem o registro (erros antigos), o primeiro em que a resposta não serve.
    const exercicios = [interno.exercicio, ...(interno.extras ?? [])];
    const exercicio = (indice !== null ? exercicios[indice] : undefined) ?? exercicioDaResposta(exercicios, resposta);
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
        ? 'As seis fatias formam o inteiro.'
        : 'Essa é a ideia central da lição.',
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
  // O reforço é do último erro: se o guardado veio de outro erro (outra resposta ou outro exercício), faz um novo.
  const guardado = apoio.reforco as unknown as Reforco | null;
  if (guardado && guardado.resposta === apoio.ultimaResposta && (guardado.indice ?? null) === apoio.ultimoIndice) {
    return buscarApoio(usuarioId, licaoId);
  }
  await quota(usuarioId, 'ponte');
  let ponte: Reforco;
  const local = async () => reforcoFalso(licao, await conteudoDaLicao(usuarioId, licaoId), apoio.ultimaResposta, apoio.ultimoIndice);
  // Sem o aceite do envio a IA de terceiros, o reforço é o local (nada da resposta sai do servidor).
  if (process.env.IA === 'falsa' || !(await podeUsarIa(usuarioId))) ponte = await local();
  else {
    try {
      ponte = await reforcoDaIa(licao, apoio.ultimaResposta, apoio.ultimoIndice);
    } catch {
      // A IA fora do ar, uma recusa ou um formato errado não deixam a pessoa sem reforço: vale o local, com o outro
      // jeito que a própria IA escreveu na lição (`outroJeito`).
      ponte = await local();
    }
  }
  const jaVenceu = Boolean((guardado as { algumaConcluida?: boolean } | null)?.algumaConcluida || apoio.reforcoConcluido);
  await banco.apoioLicao.updateMany({
    where: { usuarioId, licaoId },
    data: {
      reforco: JSON.parse(JSON.stringify({
        ...ponte,
        resposta: apoio.ultimaResposta,
        indice: apoio.ultimoIndice,
        ...(jaVenceu ? { algumaConcluida: true } : {}),
      })),
      reforcoConcluido: false,
    },
  });
  return buscarApoio(usuarioId, licaoId);
}

/** O reforço escrito pela IA: outra analogia, um exemplo novo e outra pergunta. Formato fora do esperado é falha. */
async function reforcoDaIa(licao: LicaoDetalhe, resposta: string | null, indice: number | null): Promise<Reforco> {
  // A IA recebe o exercício do erro (não só o principal), para o reforço falar do que a pessoa errou.
  const exercicioErrado = licao.exercicios[indice ?? 0] ?? licao.exercicio;
  const result = await pedirJson(
    'ponte_reforco',
    objeto({ motivo: texto, licao: esquemaLicao }),
    `A resposta é do exercício exercicioErrado. Identifique uma possível dificuldade a partir da resposta, sem afirmar um diagnóstico. Explique com uma analogia diferente e um exemplo resolvido NOVO. Crie outro exercício, diferente do original, com 3 alternativas e correta como índice 0..2. Não copie o enunciado original. A motivação deve ser gentil e específica. pagina=0 e trecho="" pois este reforço deriva da lição fornecida. Textos até 1800 caracteres. ${PEDIDO_DE_TEXTO_SIMPLES}`,
    { licao, exercicioErrado, resposta },
  );
  const r = result as { motivo: string; licao: unknown };
  if (
    !r ||
    typeof r.motivo !== 'string' ||
    !r.motivo.trim() ||
    r.motivo.length > 600 ||
    !licaoGeradaValida(r.licao) ||
    r.licao.pergunta.trim() === exercicioErrado.enunciado.trim()
  )
    throw new FalhaApi('ia_indisponivel');
  return {
    ...conteudoDaGerada(r.licao, 'Reforço gerado a partir da lição'),
    motivo: r.motivo,
    simulado: false,
  };
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
  // O retorno da ponte (`feedback`) também é texto de IA: vai em texto linear, como o apoio que vem junto.
  return comTextoSimples({ ...resultado, apoio: await buscarApoio(usuarioId, licaoId) }, await licaoEhDeMatematica(usuarioId, licaoId));
}

/**
 * O retorno do "Explique com suas palavras" sem IA: não confere se o texto está certo, mas diz quais ideias-chave da lição
 * (tiradas das respostas dos exercícios) a explicação trouxe, quais faltaram e se a pessoa já deu um exemplo.
 */
/** Só letras e números, em minúsculas e sem acento, separados por um espaço: para achar uma frase dentro de outra. */
const soPalavras = (texto: string) => ` ${normalizarResposta(texto).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

/**
 * As frases da lição (as falas e as escutas, numa lição de idioma) que a explicação usa: a frase inteira ou três
 * palavras seguidas dela (“excuse me where” vale para “Excuse me, where is the train station?”).
 */
function frasesDaLicaoNoTexto(conteudo: ConteudoLicao, explicacao: string): string[] {
  const texto = soPalavras(explicacao);
  const falas = [...(conteudo.falas ?? []), ...[conteudo.exercicio, ...(conteudo.extras ?? [])].flatMap(({ fala }) => (fala ? [fala] : []))];
  const vistas = new Set<string>();
  return falas.map(({ texto: frase }) => frase).filter((frase) => {
    const palavras = soPalavras(frase).trim().split(' ');
    if (vistas.has(palavras.join(' ')) || palavras.length < 2) return false;
    vistas.add(palavras.join(' '));
    const janela = Math.min(3, palavras.length);
    return palavras.slice(0, palavras.length - janela + 1).some((_, inicio) => texto.includes(` ${palavras.slice(inicio, inicio + janela).join(' ')} `));
  });
}

function ensinoFalso(licao: LicaoDetalhe, conteudo: ConteudoLicao, explicacao: string): FeedbackEnsino {
  const semAcento = explicacao.normalize('NFD').replace(/\p{M}+/gu, '');
  // Numa lição de idioma, usar uma frase da lição (“I'm here on vacation”) ou citar uma frase entre aspas já é dar um
  // exemplo, mesmo sem escrever “por exemplo”.
  const frasesUsadas = frasesDaLicaoNoTexto(conteudo, explicacao);
  const citou = (conteudo.falas?.length ?? 0) > 0 && /[“"][^”"]*\p{L}+\s+\p{L}+[^”"]*[”"]/u.test(explicacao);
  // Exemplo é o que a pessoa marca como exemplo, inclusive do jeito falado (“tipo quando…”, “quando eu…”). Um “quando”
  // solto não conta: números e “quando” aparecem em qualquer explicação de violão.
  const marcouExemplo = /\b(?:por exemplo|exemplo|ex\.|imagine|como quando|digamos|tipo assim|tipo quando|tipo se|tipo:|quando eu|se eu|no meu caso|comigo|e o caso de|no caso de)(?=\W|$)/i.test(semAcento);
  const comExemplo = marcouExemplo || citou || frasesUsadas.length > 0;
  const termos = termosDaLicao(conteudo);
  const trouxe = termosPresentes(explicacao, termos);
  const faltou = termos.filter((termo) => !trouxe.includes(termo));
  // Trouxe a maior parte das ideias: o que falta vira um complemento opcional, não um "que tal incluir".
  const cobriu = termos.length > 0 && trouxe.length * 2 > termos.length;
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
  return {
    acertos: [
      ...(trouxe.length > 0
        ? [`Você falou de ${lista(trouxe)}, ${trouxe.length === 1 ? 'uma ideia-chave' : 'ideias-chave'} desta lição.`]
        : []),
      // As palavras da explicação só entram quando nenhuma ideia-chave apareceu (senão, a lista soava mecânica).
      ...(trouxe.length === 0 && doConceito.length > 0 ? [`Você usou ideias da explicação da lição, como ${lista(doConceito.slice(0, 3))}.`] : []),
      ...(trouxe.length === 0 && doConceito.length === 0 && frasesUsadas.length === 0 ? ['Você explicou com as suas palavras.'] : []),
      ...(frasesUsadas.length > 0
        ? [`Você usou frases da lição, como “${frasesUsadas[0].replace(/[.!?]+$/u, '')}”: exemplos assim ajudam a lembrar.`]
        : comExemplo ? ['Você usou um exemplo, e isso ajuda a lembrar.'] : []),
    ],
    lacuna: armadilha
      ?? (faltou.length > 0 && !cobriu
        // Quem já trouxe parte das ideias ouve um “para ficar completa”, não uma lista de palavras que faltaram.
        ? trouxe.length > 0 || doConceito.length > 0
          ? `Boa base! Para ficar completa, fale também de ${lista(faltou.slice(0, 3))}: ${faltou.length === 1 ? 'é uma parte' : 'são partes'} importante${faltou.length === 1 ? '' : 's'} desta lição.`
          : `Que tal incluir ${lista(faltou.slice(0, 3))}? ${faltou.length === 1 ? 'É uma ideia-chave' : 'São ideias-chave'} desta lição.`
        : faltou.length > 0
          ? `Você trouxe a maior parte das ideias. Para completar, se quiser: ${lista(faltou.slice(0, 2))}.`
          : comExemplo
            ? 'Nenhuma ideia importante ficou de fora.'
            : 'Faltou só um exemplo seu: uma situação concreta em que você usaria isso.'),
    pergunta: faltou.length > 0 && !cobriu
      ? `Se alguém te perguntasse o que é “${faltou[0]}”, o que você responderia? Tente com um exemplo seu.`
      : trouxe.length > 0
        ? `Para fixar: como você explicaria “${trouxe[0]}” a alguém que nunca viu o assunto, com um exemplo diferente do seu?`
        : 'Se você fosse ensinar isso a alguém que nunca viu o assunto, por onde começaria?',
    proximoPasso: armadilha
      ? 'Reescreva a frase com a correção acima e leia em voz alta: é assim que a forma certa fica.'
      : faltou.length > 0 && !cobriu
      ? `Releia a explicação do Stu procurando “${faltou[0]}” e reescreva a sua com essa ideia, em uma frase.`
      : faltou.length > 0
      ? `Amanhã, tente explicar de novo sem olhar, incluindo “${faltou[0]}”.`
      // Sem exemplo, o próximo passo é o exemplo (e não “já cobre as ideias”, que soava como o contrário do “O que revisar”).
      : !comExemplo
      ? (conteudo.falas?.length ? 'Escreva uma frase sua no idioma da lição, numa situação real, e leia em voz alta.' : 'Escreva uma situação sua em que você usaria isso, em uma frase.')
      : 'Sua explicação já cobre as ideias da lição. Amanhã, tente explicar de novo sem olhar: é assim que a ideia fica.',
    simulado: true,
  };
}

/** O retorno do "Explique com suas palavras" pela IA. Formato fora do esperado é falha. */
/**
 * O recorte de ensino que o avaliador do "Explique com suas palavras" recebe: só a ideia da lição. Sem exercícios,
 * prática, referências nem ids, para que o retorno fale da ideia e nunca cobre a pergunta de um exercício.
 * Vale para texto, gravação e voz ao vivo (todos chegam aqui pela transcrição).
 */
export type RecorteEnsino = Pick<LicaoDetalhe, 'titulo' | 'objetivo' | 'conceito' | 'exemplo' | 'passos' | 'falas'>;
export function recorteDeEnsino(licao: LicaoDetalhe): RecorteEnsino {
  return {
    titulo: licao.titulo,
    objetivo: licao.objetivo,
    conceito: licao.conceito,
    exemplo: licao.exemplo,
    ...(licao.passos?.length ? { passos: [...licao.passos] } : {}),
    ...(licao.falas?.length
      ? {
          falas: licao.falas.map(({ texto: t, idioma, traducao, pronuncia }) => ({
            texto: t,
            idioma,
            ...(traducao ? { traducao } : {}),
            ...(pronuncia ? { pronuncia } : {}),
          })),
        }
      : {}),
  };
}

async function ensinoDaIa(licao: LicaoDetalhe, explicacao: string): Promise<FeedbackEnsino> {
  const result = await pedirJson(
    'ensine_ao_stu',
    objeto({
      acertos: lista(texto),
      lacuna: texto,
      pergunta: texto,
      proximoPasso: texto,
    }),
    `A tarefa da pessoa é explicar a ideia desta lição com as próprias palavras, como se ensinasse um amigo; não é responder a um exercício. Avalie a explicação em relação à ideia da lição (título, objetivo, conceito e exemplo). Liste de zero a três pontos realmente corretos; não elogie afirmações falsas. Identifique uma lacuna na compreensão da ideia ou diga que não identificou lacuna neste recorte. A lacuna e o próximo passo falam da ideia da lição, nunca de uma questão de exercício. Faça uma pergunta de transferência para um contexto novo e proponha uma ação curta. Não atribua nota nem declare domínio do assunto. Se o texto for alheio ao tema, diga isso. Cada texto até 800 caracteres. ${PEDIDO_DE_TEXTO_SIMPLES}`,
    { licao: recorteDeEnsino(licao), explicacao },
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
  return {
    acertos: x.acertos,
    lacuna: x.lacuna,
    pergunta: x.pergunta,
    proximoPasso: x.proximoPasso,
    simulado: false,
  };
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
  const conteudo = () => conteudoDaLicao(usuarioId, licaoId);
  let feedback: FeedbackEnsino;
  // Sem o aceite do envio a IA de terceiros, o retorno é o local (a explicação não sai do servidor).
  if (process.env.IA === 'falsa' || !(await podeUsarIa(usuarioId))) feedback = ensinoFalso(licao, await conteudo(), explicacao);
  else {
    try {
      feedback = await ensinoDaIa(licao, explicacao);
    } catch {
      // Sem resposta da IA, a pessoa ainda recebe o retorno local (identificado como automático).
      feedback = ensinoFalso(licao, await conteudo(), explicacao);
    }
  }
  // O retorno do "Ensine o Stu" chega em texto linear a todos os clientes (a IA devolve `$…$` de vez em quando), e é assim que fica guardado.
  feedback = comTextoSimples(feedback, await licaoEhDeMatematica(usuarioId, licaoId));
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
