/**
 * O que o registro de um erro de servidor (HTTP 500, ou o 503 da IA) pode dizer da causa SEM carregar conteúdo (SEGURANCA.md §8: nada de prompt, resposta da IA, objetivo, e-mail nem token).
 * Só o que é código: o nome da classe do erro, o `code` curto (Prisma `P2024`, Node `ECONNRESET`), o primeiro quadro da pilha (função e arquivo:linha:coluna) e um motivo curto
 * ("formato", "banco", "tempo"…). Nunca a mensagem (a do Prisma traz a chamada com os dados) nem as outras propriedades do erro (`meta`, `cause`, `stack` inteira).
 */
export type CausaDoErro = { nomeDoErro: string; codigoDoErro?: string; quadro?: string; motivo?: string };

const NOME = /^[A-Za-z][A-Za-z0-9_.$]{0,59}$/;
const CODIGO = /^[A-Z][A-Z0-9_]{1,31}$/;
const MOTIVO = /^[a-z][a-z0-9_]{0,23}$/;
const QUADRO = /^[\w$.<>[\] :@-]{1,160}$/;

/**
 * O primeiro quadro da pilha ("funcao arquivo.ts:12:34"), sem o caminho da pasta. A pilha começa pela mensagem do erro, que pode ter várias linhas, conteúdo e até imitar quadros: os quadros de verdade
 * vêm depois dela, então a mensagem é pulada antes de procurar.
 */
function primeiroQuadro(erro: Error): string | undefined {
  const pilha = erro.stack;
  if (!pilha) return undefined;
  const apos = erro.message && pilha.includes(erro.message) ? pilha.slice(pilha.indexOf(erro.message) + erro.message.length) : pilha.split("\n").slice(1).join("\n");
  const linha = apos.split("\n").find((candidata) => /^\s*at\s/.test(candidata));
  if (!linha) return undefined;
  const funcao = /^\s*at\s+(?:async\s+)?([\w$.<>[\] ]+?)\s+\(/.exec(linha)?.[1];
  const dentro = /\(([^()]*)\)\s*$/.exec(linha)?.[1] ?? linha.replace(/^\s*at\s+(?:async\s+)?/, "");
  const lugar = /([^/\\\s()]+:\d+:\d+)\s*$/.exec(dentro)?.[1];
  const quadro = [funcao, lugar].filter(Boolean).join(" ");
  return QUADRO.test(quadro) ? quadro : undefined;
}

export function descreverErroInterno(erro: unknown): CausaDoErro {
  if (!(erro instanceof Error)) return { nomeDoErro: typeof erro === "object" && erro !== null ? "Objeto" : "NaoErro" };
  const classe = erro.constructor?.name;
  // Uma classe própria que não muda o `name` (FalhaApi) aparece pelo nome da classe; as de fora (TypeError, PrismaClientKnownRequestError) pelo `name`.
  const nomeDoErro = erro.name !== "Error" && NOME.test(erro.name) ? erro.name : classe && NOME.test(classe) ? classe : "Error";
  const bruto = (erro as { code?: unknown }).code;
  const codigoDoErro = typeof bruto === "string" && CODIGO.test(bruto) ? bruto : undefined;
  const declarado = (erro as { motivo?: unknown }).motivo;
  const doBanco = nomeDoErro.startsWith("PrismaClient") || (codigoDoErro !== undefined && /^P\d{4}$/.test(codigoDoErro));
  const motivo = typeof declarado === "string" && MOTIVO.test(declarado) ? declarado : doBanco ? "banco" : undefined;
  const quadro = primeiroQuadro(erro);
  return { nomeDoErro, ...(codigoDoErro ? { codigoDoErro } : {}), ...(quadro ? { quadro } : {}), ...(motivo ? { motivo } : {}) };
}
