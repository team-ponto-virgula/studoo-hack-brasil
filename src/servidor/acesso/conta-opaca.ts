import { createHmac } from "node:crypto";

/**
 * Um identificador opaco e estável da conta (spec 04, Retomada da criação), para o aparelho guardar o que é de cada conta (a criação de trilha pendente) sem conhecer o id dela. Sai de
 * GET /api/sessao. Não é o id da conta, não se desfaz e muda se a chave de assinatura mudar. Sem chave válida, não há identificador (a rota segue sem ele).
 */
export function contaOpaca(usuarioId: string): string | null {
  const chave = process.env.STUDOO_CHAVE_ASSINATURA;
  if (!chave || !/^(?:[\da-f]{2}){32,}$/i.test(chave)) return null;
  return createHmac("sha256", Buffer.from(chave, "hex")).update(JSON.stringify(["conta", usuarioId])).digest("base64url").slice(0, 22);
}
