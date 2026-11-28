export type ConteudoParaRevisar =
  | { tipo: "nome" | "resumo" | "legenda" | "titulo"; usuarioId: string; texto: string }
  | { tipo: "foto"; usuarioId: string; bytes: Uint8Array };

export type Revisao = { aprovado: true } | { aprovado: false; motivo: string };
export type Revisor = (conteudo: ConteudoParaRevisar) => Promise<Revisao>;

// A triagem local impede ameaças explícitas e propaganda recorrente antes de salvar.
// Passar pela triagem permite enviar para a fila. Só a decisão humana torna o conteúdo público.
const termosRecusados = /\b(?:vou te matar|vou te estuprar|heil hitler|supremacia branca|pornografia infantil|compre seguidores|compre curtidas)\b/u;
function normalizar(texto: string) {
  return texto.normalize("NFKD").replace(/\p{M}|\p{Cf}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
const triagemLocal: Revisor = async conteudo =>
  conteudo.tipo !== "foto" && termosRecusados.test(normalizar(conteudo.texto))
    ? { aprovado: false, motivo: "conteudo_recusado" } : { aprovado: true };

let revisor = triagemLocal;
export function definirRevisor(novo?: Revisor) {
  revisor = novo ?? triagemLocal;
}
export const revisarConteudo = (conteudo: ConteudoParaRevisar) => revisor(conteudo);
