import type { Avaliacao, ExercicioPublico, LicaoDetalhe, TipoTrecho } from './aprendizado';

/*
 * Regras da aula compartilhadas pela web e pelo app: as etapas de cada lição, o formato das respostas e o visual do
 * trecho quando o conteúdo não diz. Cada cliente desenha do seu jeito; a sequência e os dados são os mesmos.
 */

/** Uma etapa da aula: conceito e exemplo, de um a três exercícios e, quando a lição pede, a prática no mundo real. */
export type EtapaAula =
  | { tipo: 'conceito' }
  | { tipo: 'exemplo' }
  | { tipo: 'exercicio'; indice: number }
  | { tipo: 'ensino' }
  | { tipo: 'pratica' };

/** Os exercícios da lição; uma lição salva antes dos exercícios extras tem só o principal. */
export function exerciciosDaLicao(licao: Pick<LicaoDetalhe, 'exercicio'> & Partial<Pick<LicaoDetalhe, 'exercicios'>>): ExercicioPublico[] {
  return Array.isArray(licao.exercicios) && licao.exercicios.length > 0 ? licao.exercicios : [licao.exercicio];
}

/** As etapas da lição, em ordem. O número de etapas muda de uma lição para outra. */
export function etapasDaLicao(licao: Pick<LicaoDetalhe, 'exercicio'> & Partial<Pick<LicaoDetalhe, 'exercicios' | 'pratica'>>): EtapaAula[] {
  return [
    { tipo: 'conceito' },
    { tipo: 'exemplo' },
    ...exerciciosDaLicao(licao).map((_, indice): EtapaAula => ({ tipo: 'exercicio', indice })),
    { tipo: 'ensino' },
    ...(licao.pratica ? [{ tipo: 'pratica' } as const] : []),
  ];
}

export const VERSAO_ETAPAS_AULA = 2;

/** A prática da versão antiga ficava logo após o último exercício. */
export function migrarPassoAula(etapas: readonly EtapaAula[], passo: number, versao?: number): number {
  const pratica = etapas.findIndex(etapa => etapa.tipo === 'pratica');
  return versao !== VERSAO_ETAPAS_AULA && pratica > 0 && passo === pratica - 1 ? pratica : passo;
}

/** Posição da última etapa de exercício (a aula volta para ela se a confirmação da conclusão expirar). */
export function ultimoExercicio(etapas: readonly EtapaAula[]): number {
  for (let posicao = etapas.length - 1; posicao >= 0; posicao -= 1) {
    if (etapas[posicao].tipo === 'exercicio') return posicao;
  }
  return 0;
}

/** Monta a resposta de cada formato do jeito que o servidor confere. */
export const codificarResposta = {
  /** Ordenar: os ids na ordem escolhida. */
  ordem: (ids: readonly string[]) => ids.join(','),
  /** Associar: cada item da esquerda com o par escolhido na direita. */
  pares: (pares: readonly (readonly [string, string])[]) => pares.map(([esquerda, direita]) => `${esquerda}=${direita}`).join(','),
  /** Verdadeiro ou falso: o valor e a justificativa escolhida. */
  verdadeiroFalso: (verdadeiro: boolean, justificativa: string) => `${verdadeiro ? 'verdadeiro' : 'falso'}:${justificativa}`,
};

/**
 * Ordenar em lista única (spec 08, revisão de 19/11): a ordem com que a tentativa começou. Na primeira, a do servidor
 * (`exercicio.itens`, que nunca é a resposta); na nova tentativa, quem chama passa a ordem do começo dela.
 */
export function ordemInicial(exercicio: Extract<ExercicioPublico, { tipo: 'ordenar' }>): string {
  return codificarResposta.ordem(exercicio.itens.map((item) => item.id));
}

/** A ordem está completa (todos os itens, sem vaga) e mudou em relação à ordem com que a tentativa começou. */
function ordemMudou(exercicio: Extract<ExercicioPublico, { tipo: 'ordenar' }>, valor: string, inicial?: string): 'incompleta' | 'igual' | 'mudou' {
  const ids = valor.split(',').map((id) => id.trim());
  if (ids.filter(Boolean).length !== exercicio.itens.length) return 'incompleta';
  return ids.join(',') === (inicial ?? ordemInicial(exercicio)).split(',').map((id) => id.trim()).join(',') ? 'igual' : 'mudou';
}

/**
 * A resposta já pode ser verificada: ordem completa e mudada, todos os pares, valor e justificativa, mínimo de
 * caracteres… `inicial` (só no ordenar): a ordem com que a tentativa começou; sem ela, a do servidor.
 */
export function respostaCompleta(exercicio: ExercicioPublico, resposta: string, inicial?: string): boolean {
  const valor = resposta.trim();
  switch (exercicio.tipo) {
    case 'ordenar':
      return ordemMudou(exercicio, valor, inicial) === 'mudou';
    case 'associar':
      return valor.split(',').filter(Boolean).length === exercicio.esquerda.length;
    case 'verdadeiro_falso': {
      const [escolha, justificativa] = valor.split(':');
      return Boolean(escolha && justificativa);
    }
    case 'aberta':
      return tamanhoDaResposta(valor) >= exercicio.minimo;
    default:
      return valor.length > 0;
  }
}

/** Tamanho da resposta aberta, em letras e números (sem os espaços): é o que o contador mostra e o mínimo confere. */
export function tamanhoDaResposta(texto: string): number {
  return texto.replace(/\s+/gu, '').length;
}

/** O que ainda falta para a resposta poder ser verificada (null quando já pode). Cada plataforma diz isso com os seus textos. */
export type FaltaParaVerificar =
  | { tipo: 'escrever' }
  | { tipo: 'escolher' }
  | { tipo: 'ordenar'; faltam: number }
  /** Ordenar em lista única: a ordem ainda é a do começo da tentativa. */
  | { tipo: 'mudarOrdem' }
  | { tipo: 'associar'; faltam: number }
  | { tipo: 'valor' }
  | { tipo: 'justificativa' }
  | { tipo: 'caracteres'; faltam: number };

export function faltaParaVerificar(exercicio: ExercicioPublico, resposta: string, inicial?: string): FaltaParaVerificar | null {
  if (respostaCompleta(exercicio, resposta, inicial)) return null;
  const valor = resposta.trim();
  switch (exercicio.tipo) {
    case 'ordenar':
      // Lista única: completa desde o começo, falta só mudar. Fichas (o modelo antigo, até as plataformas migrarem): faltam itens.
      return ordemMudou(exercicio, valor, inicial) === 'igual'
        ? { tipo: 'mudarOrdem' }
        : { tipo: 'ordenar', faltam: exercicio.itens.length - valor.split(',').filter(Boolean).length };
    case 'associar':
      return { tipo: 'associar', faltam: exercicio.esquerda.length - valor.split(',').filter(Boolean).length };
    case 'verdadeiro_falso':
      return valor.split(':')[0] ? { tipo: 'justificativa' } : { tipo: 'valor' };
    case 'aberta':
      return { tipo: 'caracteres', faltam: exercicio.minimo - tamanhoDaResposta(valor) };
    case 'multipla_escolha':
      return { tipo: 'escolher' };
    default:
      return { tipo: 'escrever' };
  }
}

/** Embaralha uma lista sempre do mesmo jeito para a mesma semente (mulberry32): a mesma semente, a mesma ordem, em qualquer plataforma. */
export function embaralharComSemente<T>(lista: readonly T[], semente: number): T[] {
  let estado = semente >>> 0;
  const aleatorio = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let valor = estado;
    valor = Math.imul(valor ^ (valor >>> 15), valor | 1);
    valor ^= valor + Math.imul(valor ^ (valor >>> 7), valor | 61);
    return ((valor ^ (valor >>> 14)) >>> 0) / 4294967296;
  };
  const copia = [...lista];
  for (let indice = copia.length - 1; indice > 0; indice -= 1) {
    const outro = Math.floor(aleatorio() * (indice + 1));
    [copia[indice], copia[outro]] = [copia[outro], copia[indice]];
  }
  return copia;
}

/**
 * O exercício com as opções numa ordem nova (as da escolha e os porquês), para a resposta certa não ficar sempre no mesmo
 * lugar nem dar para decorar a posição ao refazer. As respostas são por id. Os pares do associar e os itens de ordenar
 * ficam na ordem do servidor, que garante que a ordem mostrada nunca é a própria resposta.
 */
export function embaralharExercicio(exercicio: ExercicioPublico, semente: number): ExercicioPublico {
  switch (exercicio.tipo) {
    case 'multipla_escolha':
      return { ...exercicio, opcoes: embaralharComSemente(exercicio.opcoes, semente) };
    case 'verdadeiro_falso':
      return { ...exercicio, justificativas: embaralharComSemente(exercicio.justificativas, semente) };
    default:
      return exercicio;
  }
}

/**
 * A semente da ordem das opções de um exercício (spec 16, item 23). A mesma tentativa tem a mesma ordem na web e no app: a semente sai só do id da
 * lição, do índice do exercício e da rodada (0 ao abrir a lição; cada revisão rápida sobe 1). Hash FNV-1a em inteiros de 32 bits: igual em qualquer
 * plataforma, sem sorteio e sem relógio.
 */
export function sementeDasOpcoes(licaoId: string, indiceDoExercicio: number, rodada: number): number {
  let resultado = 0x811c9dc5;
  for (const caractere of `${licaoId}|${indiceDoExercicio}|${rodada}`) resultado = Math.imul(resultado ^ caractere.codePointAt(0)!, 0x01000193) >>> 0;
  return resultado;
}

/**
 * O exercício como a tentativa o mostra: as opções (as da escolha e os porquês do verdadeiro/falso) na ordem da `rodada`, a mesma na web e no app.
 * A rodada 0 é a abertura da lição e cada revisão rápida sobe a rodada. A ordem de uma rodada nunca repete a da anterior (com 2 ou mais opções):
 * a revisão embaralha de verdade, não só "quase sempre". Ordenar e associar ficam na ordem do servidor, que já é a mesma para todos.
 */
export function embaralharExercicioDaRodada(exercicio: ExercicioPublico, licaoId: string, indiceDoExercicio: number, rodada: number): ExercicioPublico {
  const ultima = Math.max(0, Math.trunc(rodada) || 0);
  const ordenar = <T>(lista: readonly T[]): T[] => {
    let anterior: T[] | null = null;
    let atual: T[] = [...lista];
    for (let passo = 0; passo <= ultima; passo += 1) {
      atual = embaralharComSemente(lista, sementeDasOpcoes(licaoId, indiceDoExercicio, passo));
      const previa: T[] | null = anterior;
      if (previa && atual.length > 1 && atual.every((item, indice) => item === previa[indice])) atual.push(atual.shift() as T);
      anterior = atual;
    }
    return atual;
  };
  switch (exercicio.tipo) {
    case 'multipla_escolha':
      return { ...exercicio, opcoes: ordenar(exercicio.opcoes) };
    case 'verdadeiro_falso':
      return { ...exercicio, justificativas: ordenar(exercicio.justificativas) };
    default:
      return exercicio;
  }
}

/** Por que vale rever uma lição concluída: muitos erros antes do acerto, a prática que ainda não saiu, ou os dois. */
export type MotivoRever = 'erros' | 'pratica' | 'erros_e_pratica';

/**
 * Vale rever quando a maior parte dos exercícios saiu errada antes do acerto ou quando a prática ficou em "ainda não".
 * Um erro só, numa lição de dois ou três exercícios, faz parte de aprender e não marca a lição.
 */
export function motivoParaRever({ acertosDePrimeira, exercicios, pratica }: {
  acertosDePrimeira?: number | null;
  exercicios?: number | null;
  pratica?: string | null;
}): MotivoRever | null {
  const erros = typeof exercicios === 'number' && exercicios > 0 && (acertosDePrimeira ?? 0) * 2 < exercicios;
  const praticaPendente = pratica === 'ainda_nao';
  if (erros && praticaPendente) return 'erros_e_pratica';
  if (erros) return 'erros';
  return praticaPendente ? 'pratica' : null;
}

/**
 * Errou, mas acertou uma parte (itens na posição, pares, o valor ou o porquê, critérios da resposta aberta): o retorno
 * diz “Quase lá!”. Sem nenhuma parte certa, o título é outro, para não dizer “quase” a quem ainda está longe.
 */
export function acertouParte(avaliacao: Avaliacao): boolean {
  if (avaliacao.correta) return false;
  // Um aviso no erro é um “foi por pouco” (grafia quase certa, valor certo e porquê errado…).
  return (avaliacao.certos?.length ?? 0) > 0 || (avaliacao.criterios?.some(({ atendido }) => atendido) ?? false) || Boolean(avaliacao.observacao);
}

/**
 * A origem como a pessoa lê, sem jargão técnico: a do modo demonstração (“Modo demonstração: trilha pronta sobre…”)
 * vira “Trilha pronta do Studoo sobre…”. Vale também para trilhas salvas antes.
 */
export function origemLegivel(origem: string): string {
  const texto = origem.trim();
  const pronta = texto.match(/^modo demonstra[cç][aã]o:\s*trilha pronta sobre\s+(.+)$/i);
  if (pronta) return `Trilha pronta do Studoo sobre ${pronta[1]}`;
  if (/^modo demonstra[cç][aã]o:\s*conte[uú]do de exemplo/i.test(texto)) return 'Conteúdo de exemplo do Studoo';
  const resto = texto.replace(/^modo demonstra[cç][aã]o:\s*/i, '');
  return resto.charAt(0).toLocaleUpperCase('pt-BR') + resto.slice(1);
}

/** A origem da trilha é o modo demonstração (conteúdo pronto, sem a IA)? */
export function origemDemonstracao(origem: string): boolean {
  return /^modo demonstra[cç][aã]o/i.test(origem.trim());
}

/** Tamanho máximo da resposta: a aberta é uma explicação; as outras são curtas. */
export const LIMITES_RESPOSTA = { curta: 300, aberta: 1000 } as const;

/**
 * Visual do trecho quando o conteúdo não informa (lições salvas antes dos tipos de trecho). Só vira código o que parece
 * código, como uma consulta SQL; o resto aparece como frase.
 */
export function inferirTipoTrecho(trecho: string): TipoTrecho {
  const texto = trecho.trim();
  const linhas = texto.split('\n').filter((linha) => linha.trim());
  if (linhas.length > 1 && linhas.every((linha) => /^\s*(?:\d+[.)]|[-•])\s+/.test(linha))) return 'passos';
  if (/;\s*$|\b(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|CREATE|def|function|return|const|console|print)\b|[{}]|=>|==|<=|>=|!=/.test(texto)) {
    return 'codigo';
  }
  if (/^[“"«].*[”"»]$/s.test(texto)) return 'citacao';
  if (/^[\d\s+\-×*/÷=().,²³√π^xyabc_]+$/i.test(texto) && /[=+×*/÷^²³√]/.test(texto)) return 'formula';
  return 'frase';
}

/** Divide o texto nas lacunas (três ou mais sublinhados), para o app destacar o espaço da resposta. */
export function partesDaLacuna(texto: string): string[] {
  return texto.split(/_{3,}/);
}

/** Texto da citação sem as aspas das pontas: o app desenha a aspa decorativa. */
export function semAspas(texto: string): string {
  return texto.trim().replace(/^[“"«]\s*/, '').replace(/\s*[”"»]$/, '');
}

/** Passos de um texto em linhas, sem a numeração que já vier nele (o app numera). */
export function linhasDePassos(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').trim())
    .filter(Boolean);
}

/**
 * O que fica ao tentar de novo: na aberta, o texto todo (para corrigir); no associar, os pares certos; no verdadeiro ou
 * falso, a parte certa; no ordenar, o começo que já estava na posição certa; na lacuna, o que foi escrito (para corrigir
 * a grafia). A escolha recomeça.
 */
export function respostaParaTentarDeNovo(exercicio: ExercicioPublico, resposta: string, avaliacao: Avaliacao): string {
  const certos = new Set(avaliacao.certos ?? []);
  switch (exercicio.tipo) {
    case 'aberta':
    case 'lacuna':
      return resposta;
    case 'associar':
      return resposta.split(',').filter((par) => certos.has(par.split('=')[0])).join(',');
    case 'verdadeiro_falso': {
      const [valor = '', justificativa = ''] = resposta.split(':');
      return `${certos.has('valor') ? valor : ''}:${certos.has('justificativa') ? justificativa : ''}`.replace(/^:$/, '');
    }
    case 'ordenar':
      // Lista única (spec 08, revisão de 19/11): a nova tentativa começa com a ordem toda como estava. Os certos ficam
      // travados no lugar (a tela trava pelos `certos` da avaliação) e os outros continuam onde estavam, sem vagas.
      return resposta;
    default:
      return '';
  }
}
