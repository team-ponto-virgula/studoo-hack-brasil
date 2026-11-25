import type { ProvedorIa } from "@studoo/contratos";

/** Só a seleção explícita do modo demonstrativo permite simulação. Valores antigos usam o único provedor real. */
export function provedorIaAtivo(): ProvedorIa {
  return process.env.IA?.trim() === "falsa" ? "falsa" : "openai";
}
