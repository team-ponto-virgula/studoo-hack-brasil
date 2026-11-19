/*
 * Ponto de extensão da revisão de conteúdo (spec 10, etapa C2): chamado antes de gravar foto, nome, resumo e legenda.
 * Hoje aprova tudo e não chama nenhum serviço externo. Um revisor de verdade (moderação automática) entra aqui depois,
 * com aviso ao Lead; os testes trocam o revisor para conferir que ele é chamado antes de gravar.
 */

export type ConteudoParaRevisar =
  | { tipo: "nome" | "resumo" | "legenda" | "titulo"; usuarioId: string; texto: string }
  | { tipo: "foto"; usuarioId: string; bytes: Uint8Array };

export type Revisao = { aprovado: true } | { aprovado: false; motivo: string };
export type Revisor = (conteudo: ConteudoParaRevisar) => Promise<Revisao>;

const aprovarTudo: Revisor = async () => ({ aprovado: true });
let revisor: Revisor = aprovarTudo;

/** Troca o revisor (testes e, no futuro, a moderação automática). Sem argumento, volta a aprovar tudo. */
export function definirRevisor(novo?: Revisor) {
  revisor = novo ?? aprovarTudo;
}

export async function revisarConteudo(conteudo: ConteudoParaRevisar): Promise<Revisao> {
  return revisor(conteudo);
}
