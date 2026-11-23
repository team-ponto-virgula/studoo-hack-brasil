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

/** O lugar do aviso: 8 px abaixo do cabeçalho, centrado nele, com a largura dele no máximo. Sem cabeçalho (os estilos do CSS valem): no alto, 8 px da borda. */
export function lugarDoAviso(cabecalho: Retangulo | null, larguraDaJanela: number): { top: string; left: string; maxWidth: string } {
  if (!cabecalho) return { top: '', left: '', maxWidth: '' };
  return {
    top: `${Math.max(RESPIRO_DO_AVISO, cabecalho.bottom + RESPIRO_DO_AVISO)}px`,
    left: `${cabecalho.left + cabecalho.width / 2}px`,
    maxWidth: `${Math.min(larguraDaJanela - 32, cabecalho.width)}px`,
  };
}
