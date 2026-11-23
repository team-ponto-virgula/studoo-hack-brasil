/**
 * O que ESTE site sabe desenhar (spec 15): vai em toda chamada no cabeçalho `X-Studoo-Capacidades` (`cliente-web.ts` e a geração ao vivo).
 * É uma constante da web, não a do contrato (`CAPACIDADES_DESTE_CLIENTE`): se o contrato subir de versão antes de a web desenhar os tipos novos, a web
 * não passa a pedir o que não sabe mostrar. `visuais@2` (marco 12a): a web desenha o gráfico de função (`funcao`) com o motor do contrato, no enunciado, na lição e no retorno. Sem o cabeçalho, o servidor manda o desenho como PNG no `recurso`.
 * Num arquivo sozinho, sem dependências, para quem só precisa do texto (os testes, a geração ao vivo).
 */
export const CAPACIDADES_DO_SITE = "visuais@2,resolucao@1";
