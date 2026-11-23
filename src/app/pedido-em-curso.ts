/*
 * O pedido em andamento da tela de estudo (`executar`, em estudo.tsx) e a regra de sair da lição enquanto ele corre. Fila C, pedido do Lead de 23/11, igual ao app:
 * com a rede lenta, a correção de uma resposta pode deixar a lição parada em "Verificando…" por uns 30 s, e o X ficava travado. Só a CORREÇÃO (`avaliar`) pode ser abandonada: a
 * resposta digitada continua no andamento guardado no navegador e é corrigida de novo na volta. A CONCLUSÃO não: ela grava o progresso e leva à festa, e sair no meio dela deixaria o
 * mapa e a tela da conclusão brigando.
 */

/** A única ação que a pessoa pode abandonar no meio: a correção de uma resposta da lição. */
export const ACAO_ABANDONAVEL = 'avaliar';

/**
 * Na lição, o X (e o voltar) só saem sem pedido em andamento ou durante a correção de uma resposta; durante a conclusão (e qualquer outro pedido) ficam travados.
 * `peloVoltar`: o voltar do navegador ou do celular, que já tinha o passe livre antes e continua com ele (quem decide se ele sai de fato é `voltar()`).
 */
export function podeSairDaLicao(pendente: string | null, peloVoltar = false): boolean {
  return pendente === null || pendente === ACAO_ABANDONAVEL || peloVoltar;
}

/**
 * A vez de cada pedido de `executar` e a ação que está em curso. Um pedido abandonado deixa de ser o atual, e o que ele fizer ao terminar (soltar a trava, mostrar um erro, levar ao
 * login) já não vale: a trava pode ser de outro pedido, e o erro cairia em outra tela. Pura e sem DOM, para o teste conferir as regras sem navegador.
 */
export function criarVezes<A extends string>() {
  let vez = 0;
  let acao: A | null = null;
  return {
    /** Começa um pedido (quem chama já conferiu que não há outro em curso) e devolve a vez dele. */
    comecar(nova: A): number {
      vez += 1;
      acao = nova;
      return vez;
    },
    /** O pedido desta vez ainda é o atual (não foi abandonado nem trocado por outro)? */
    ehAtual(minhaVez: number): boolean {
      return minhaVez === vez;
    },
    /** O pedido desta vez terminou: devolve se ele era o atual, e só então a trava é dele para soltar. Um pedido abandonado não solta nada. */
    terminar(minhaVez: number): boolean {
      if (minhaVez !== vez) return false;
      acao = null;
      return true;
    },
    /** Abandona o pedido em curso se ele for da ação `permitida`; devolve se abandonou, e então quem chama solta a trava na hora. */
    abandonar(permitida: A): boolean {
      if (acao !== permitida) return false;
      vez += 1;
      acao = null;
      return true;
    },
    /** A ação em curso, ou `null`. */
    acao(): A | null {
      return acao;
    },
  };
}
