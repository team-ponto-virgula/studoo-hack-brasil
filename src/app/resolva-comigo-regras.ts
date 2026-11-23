import type { ContextoDoDesenho, PassoDaResolucao, Resolucao, RespostaDoSuaVez, Visual, VisualFigura } from '@studoo/contratos';

/*
 * As regras do "Resolva comigo" (spec 15, seção 4), sem React: o andamento dos passos, o "Sua vez" e o que o rodapé oferece.
 * O cliente nunca tem a resposta do "Sua vez" antes da escolha: o passo dele chega sem fórmula nem desenho, e os passos que
 * faltam só chegam na resposta de `POST /api/aprendizado/licoes/[id]/resolucao` (acerto ou segunda errada).
 */

export type EstadoResolva = {
  /** Os passos que o app já tem: até o "Sua vez" no começo; todos depois da revelação. */
  passos: PassoDaResolucao[];
  /** O número de passos da resolução inteira ("Passo 2 de 4"). */
  total: number;
  atual: number;
  /** A opção marcada no "Sua vez" (antes do "Verificar"). */
  escolha: number | null;
  /** A próxima escolha é a primeira ou a segunda (na segunda errada, o servidor mostra a certa). */
  tentativa: 1 | 2;
  /** A última correção do "Sua vez". */
  resposta: RespostaDoSuaVez | null;
  /** A opção que a última correção corrigiu (fica verde ou âmbar). */
  corrigida: number | null;
  /** O "Sua vez" acabou (acerto ou segunda errada): os passos que faltavam chegaram. */
  revelado: boolean;
  /** Sem rede (ou resposta que não serve) no "Sua vez": o exemplo segue em texto, sem travar a pessoa. */
  emTexto: boolean;
};

export type AcaoDoRodape = 'proximo' | 'verificar' | 'tentar' | 'agora';

export function indiceDoSuaVez(passos: readonly PassoDaResolucao[]): number {
  return passos.findIndex((passo) => passo.tentativa);
}

/** A resolução só vale com passos e o total coerente; sem isso, o exemplo fica em texto como antes. */
export function resolucaoUtil(resolucao: Resolucao | undefined): resolucao is Resolucao {
  return Boolean(resolucao && resolucao.passos.length > 0 && resolucao.total >= resolucao.passos.length && resolucao.problema);
}

export function comecarResolva(resolucao: Resolucao): EstadoResolva {
  return {
    passos: resolucao.passos, total: resolucao.total, atual: 0, escolha: null, tentativa: 1, resposta: null, corrigida: null,
    revelado: indiceDoSuaVez(resolucao.passos) < 0, emTexto: false,
  };
}

/** A correção tem a forma do contrato? Uma resposta estranha não pode travar a pessoa: vira o exemplo em texto. */
export function respostaValida(valor: unknown): valor is RespostaDoSuaVez {
  if (typeof valor !== 'object' || valor === null) return false;
  const resposta = valor as Partial<RespostaDoSuaVez>;
  if (typeof resposta.correta !== 'boolean' || typeof resposta.porque !== 'string') return false;
  if (resposta.certa !== undefined && !(Number.isInteger(resposta.certa) && resposta.certa >= 0 && resposta.certa <= 2)) return false;
  if (resposta.depois !== undefined && !Array.isArray(resposta.depois?.passos)) return false;
  return true;
}

/**
 * Aplica a correção do "Sua vez". No acerto e na segunda errada, o passo dele ganha a revelação (fórmula e desenho) e os passos
 * que faltam entram depois dele; na primeira errada, só o porquê.
 */
export function aplicarResposta(estado: EstadoResolva, resposta: RespostaDoSuaVez): EstadoResolva {
  const corrigida = estado.escolha;
  if (!resposta.depois) return { ...estado, resposta, corrigida, tentativa: 2 };
  const corte = indiceDoSuaVez(estado.passos);
  const { formula, visual, passos: restantes } = resposta.depois;
  const passos = estado.passos.slice(0, corte + 1).map((passo, posicao) => (posicao === corte
    ? { ...passo, ...(formula ? { formula } : {}), ...(visual ? { visual } : {}) }
    : passo));
  const todos = [...passos, ...restantes].slice(0, estado.total);
  return { ...estado, passos: todos, total: Math.max(todos.length, corte + 1), resposta, corrigida, revelado: true };
}

/** O passo atual é o "Sua vez" ainda sem resposta final. */
export function noSuaVez(estado: EstadoResolva): boolean {
  return !estado.revelado && estado.atual === indiceDoSuaVez(estado.passos);
}

export function acaoDoRodape(estado: EstadoResolva): AcaoDoRodape {
  if (noSuaVez(estado)) return estado.resposta && !estado.resposta.correta && estado.escolha === estado.corrigida ? 'tentar' : 'verificar';
  return estado.atual >= estado.total - 1 ? 'agora' : 'proximo';
}

export function avancar(estado: EstadoResolva): EstadoResolva {
  if (noSuaVez(estado) || estado.atual + 1 >= estado.passos.length) return estado;
  return { ...estado, atual: estado.atual + 1 };
}

export function voltar(estado: EstadoResolva): EstadoResolva {
  return estado.atual > 0 ? { ...estado, atual: estado.atual - 1 } : estado;
}

/** "Tentar de novo": a marca sai e a próxima escolha é a segunda. */
export function tentarDeNovo(estado: EstadoResolva): EstadoResolva {
  return { ...estado, escolha: null, corrigida: null, resposta: null, tentativa: 2 };
}

/**
 * O desenho de cima no passo atual: o do passo mais recente que mexe nele (o desenho troca no mesmo lugar) ou o do problema.
 * No "Sua vez" sem resposta, o passo não tem desenho (a revelação não veio): fica o anterior.
 */
export function visualDoPasso(resolucao: Resolucao, estado: EstadoResolva): VisualFigura | undefined {
  for (let posicao = Math.min(estado.atual, estado.passos.length - 1); posicao >= 0; posicao--) {
    const visual = estado.passos[posicao]?.visual;
    if (visual) return visual;
  }
  return resolucao.visual;
}

/** O procurado só aparece na posição dele no último passo (spec 15: "A resposta nunca aparece antes da hora"). */
export function contextoDoPasso(estado: EstadoResolva): ContextoDoDesenho {
  return { tipo: 'passo', ultimo: estado.revelado && estado.atual === estado.total - 1 };
}

/** A fórmula que fica de contexto no "Sua vez" antes da escolha: a do passo anterior com fórmula. */
export function formulaDeContexto(estado: EstadoResolva): string | undefined {
  for (let posicao = estado.atual - 1; posicao >= 0; posicao--) {
    const formula = estado.passos[posicao]?.formula;
    if (formula) return formula;
  }
  return undefined;
}

/** A fórmula geral do cartão "O método": a primeira fórmula da lição. */
export function formulaDoMetodo(visuais: readonly Visual[] | undefined): string | undefined {
  return visuais?.find((visual) => visual.tipo === 'formula')?.latex;
}
