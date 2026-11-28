/**
 * Entrada sem rolar (regra do dono, lote 1 do iPhone; spec 04): a decisão de tamanho da entrada, sem React, para o teste
 * travar a regra. Cede, nesta ordem: a ilustração (da altura que sobra até 140; abaixo de 44, sai), os espaços (nível 1),
 * o tamanho do título e da descrição (nível 2) e a descrição (nível 3). A ilustração só aparece no nível 0: é a primeira a
 * sair e a última a voltar. O que sobra fica metade acima do título e metade acima do formulário (o respiro).
 */

export const ILUSTRACAO_MAXIMA = 140;
export const ILUSTRACAO_MINIMA = 44;
/** O vão entre a ilustração e o título. */
export const MARGEM_DA_ILUSTRACAO = 24;
/** Níveis: 0 (como desenhada), 1 (espaços menores), 2 (título e descrição menores), 3 (sem a descrição). */
export const NIVEL_MAXIMO = 3;
/** A decisão espera as medidas pararem por este tempo (a primeira passada de layout ainda mexe). */
export const ESPERA_DA_MEDIDA_MS = 200;

export type EstadoDaEntrada = { nivel: number; ilustracao: number; respiro: number };
export const ESTADO_INICIAL_DA_ENTRADA: EstadoDaEntrada = { nivel: 0, ilustracao: 0, respiro: 0 };

/**
 * O próximo estado a partir das medidas paradas: `visivel` é a altura útil (a rolagem menos o que as barras cobrem) e
 * `conteudo`, a altura natural do conteúdo desenhado com o estado `atual`. Devolve o próprio `atual` quando nada muda. O
 * nível só sobe: quem desce é a troca de altura da janela, que recomeça do estado inicial.
 */
export function proximoEstadoDaEntrada(visivel: number, conteudo: number, atual: EstadoDaEntrada): EstadoDaEntrada {
  const semIlustracao = conteudo - atual.ilustracao - (atual.ilustracao > 0 ? MARGEM_DA_ILUSTRACAO : 0) - 2 * atual.respiro;
  const sobra = visivel - semIlustracao;
  if (sobra < 0 && atual.nivel < NIVEL_MAXIMO) return { nivel: atual.nivel + 1, ilustracao: 0, respiro: 0 };
  const ideal = atual.nivel === 0 ? Math.min(ILUSTRACAO_MAXIMA, sobra - MARGEM_DA_ILUSTRACAO) : 0;
  const ilustracao = ideal >= ILUSTRACAO_MINIMA ? Math.floor(ideal) : 0;
  const respiro = Math.max(0, Math.floor((sobra - (ilustracao > 0 ? ilustracao + MARGEM_DA_ILUSTRACAO : 0)) / 2));
  // Diferença de 1 pt é arredondamento da medida: sem essa folga, a tela ficaria trocando de altura.
  const novaIlustracao = Math.abs(ilustracao - atual.ilustracao) > 1 ? ilustracao : atual.ilustracao;
  const novoRespiro = Math.abs(respiro - atual.respiro) > 1 ? respiro : atual.respiro;
  if (novaIlustracao === atual.ilustracao && novoRespiro === atual.respiro) return atual;
  return { nivel: atual.nivel, ilustracao: novaIlustracao, respiro: novoRespiro };
}
