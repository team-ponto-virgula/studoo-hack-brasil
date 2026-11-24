/*
 * Onde fica o aviso "Música de fundo ligada." (spec 16, item 14): sempre no alto, 8 px abaixo do cabeçalho (ou da barra da marca) da tela, em todas as telas, para nunca cobrir o balão do nó, os
 * botões do rodapé nem a barra de abas. Sem DOM aqui: o componente (ambiente-som.tsx) mede os cabeçalhos e passa os retângulos.
 * E o que ele cobriria embaixo: enquanto o aviso está à vista, o que vem logo depois do cabeçalho desce a altura dele mais o respiro, e o aviso fica na faixa aberta, sem cobrir título, campo
 * nem botão (defeito do Lead, 23/11: o título "O que você quer aprender?" ficava sob o aviso em 768 px).
 */

export interface Retangulo { top: number; bottom: number; left: number; width: number; height: number }

/** O que o aviso pede aos cabeçalhos: o que ele fica abaixo. A barra da marca da entrada, o cabeçalho do app, o do mapa e o da aula, o do tour e o da geração (com a placa que diz o que acontece). */
export const CABECALHOS_DO_ALTO = '.som-marca, .recuperar-topo, .estudo-cabecalho, .trilha-topo, .aula-topo, .apresentacao-topo, .previa-cabecalho, .previa-placa';

/** O balão de um nó do mapa: com ele aberto, o aviso fecha na hora. */
export const BALAO_DO_NO = '.caminho-balao';

/** Afastamento entre o cabeçalho e o aviso. */
export const RESPIRO_DO_AVISO = 8;

/** O mais baixo entre os cabeçalhos que estão visíveis no alto da janela (um que já rolou para fora, ou que está no pé, não conta). */
export function cabecalhoDoAlto(retangulos: readonly Retangulo[], alturaDaJanela: number): Retangulo | null {
  let mais: Retangulo | null = null;
  for (const r of retangulos) {
    if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top > alturaDaJanela * 0.45) continue;
    if (!mais || r.bottom > mais.bottom) mais = r;
  }
  return mais;
}

/** Quanto o conteúdo desce para dar lugar ao aviso: a altura dele mais o respiro entre os dois. */
export function reservaDoAviso(alturaDoAviso: number): number {
  return Math.ceil(alturaDoAviso) + RESPIRO_DO_AVISO;
}

/** Até onde a página ainda está no alto (o cabeçalho na janela). Rolada além disso, descer o conteúdo moveria o que a pessoa está lendo. */
export const TOPO_DA_PAGINA = 4;

/**
 * Quem desce para dar lugar ao aviso. Com um cabeçalho à vista, o elemento que vem logo depois dele (o conteúdo da tela). Sem cabeçalho à vista (o computador não tem a faixa, ou a página já rolou),
 * o conteúdo principal, mas só se a página está no alto: rolada, o aviso fica sobre o que passa por ali e nada se mexe.
 */
export function quemDesce<T>(indiceDoCabecalho: number, seguintes: readonly (T | null)[], principal: T | null, rolagem: number): T | null {
  if (indiceDoCabecalho >= 0) return seguintes[indiceDoCabecalho] ?? null;
  return rolagem < TOPO_DA_PAGINA ? principal : null;
}

/** A marca da tela do app: o cabeçalho do app leva `data-tela` (planos, objetivo, plano, licao, perfil, explorar…), mesmo quando a faixa dele está escondida. */
export const MARCA_DA_TELA = '.estudo-cabecalho[data-tela]';

/** A "tela" do app web, para saber quando a pessoa trocou de tela: o endereço e a marca `data-tela` (mapa, lição, perfil, nova trilha…). Mudar de etapa dentro da lição não troca de tela. */
export function chaveDaTela(caminho: string, tela: string | null): string {
  return `${caminho}|${tela ?? ''}`;
}

/**
 * O espaço reservado para o aviso (spec 16, item 14, regra da saída). Ao entrar, o conteúdo desce. Ao sair (7 s, "Desligar" ou o balão do nó) o aviso some, mas o espaço continua até a pessoa trocar de tela:
 * um salto de 56 px para cima, 7 s depois, mudaria de lugar o botão que ela ia tocar. Na tela seguinte o espaço não existe mais. Sem DOM aqui: quem usa diz como marcar, soltar e saber se o elemento ainda está na página.
 */
export function criarEspacoDoAviso<T>(como: { marcar(elemento: T, px: number): void; soltar(elemento: T): void; vivo(elemento: T): boolean }) {
  let atual: { elemento: T; tela: string } | null = null;
  function soltar() {
    if (!atual) return;
    como.soltar(atual.elemento);
    atual = null;
  }
  return {
    /**
     * O aviso está à vista: o espaço vai para `elemento`, com `px` de altura, na tela `tela`. Trocar de elemento solta o anterior na hora. Sem elemento (a página rolou e o cabeçalho saiu da janela), o que já
     * estava reservado fica: o espaço só sai pela troca de tela, nunca pela rolagem.
     */
    reservar(elemento: T | null, px: number, tela: string) {
      if (!elemento) return;
      if (atual && atual.elemento !== elemento) soltar();
      como.marcar(elemento, px);
      atual = { elemento, tela };
    },
    /** Com o aviso fora de cena: se a pessoa trocou de tela, ou o elemento saiu da página, o espaço sai na hora. Na mesma tela, nada se mexe. */
    conferir(tela: string) {
      if (atual && (atual.tela !== tela || !como.vivo(atual.elemento))) soltar();
    },
    /** Quem está com o espaço agora (ninguém, depois de soltar). */
    elemento(): T | null {
      return atual?.elemento ?? null;
    },
  };
}

/** O lugar do aviso: 8 px abaixo do cabeçalho, centrado nele, com a largura dele no máximo. Sem cabeçalho (os estilos do CSS valem): no alto, 8 px da borda. */
export function lugarDoAviso(cabecalho: Retangulo | null, larguraDaJanela: number): { top: string; left: string; maxWidth: string } {
  if (!cabecalho) return { top: '', left: '', maxWidth: '' };
  return {
    top: `${Math.max(RESPIRO_DO_AVISO, cabecalho.bottom + RESPIRO_DO_AVISO)}px`,
    left: `${cabecalho.left + cabecalho.width / 2}px`,
    maxWidth: `${Math.min(larguraDaJanela - 32, cabecalho.width)}px`,
  };
}
