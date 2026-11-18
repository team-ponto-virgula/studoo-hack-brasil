import { consumirLimite } from "@/servidor/acesso/seguranca";

/**
 * Teto de gerações por pessoa. Em produção (e rotas HTTP), usa `consumirLimite` no PostgreSQL (`tentativaLogin`),
 * sobrevivendo a reinícios sem migração nova; em testes unitários sem banco, `registrarGeracao` mantém a mesma regra.
 *
 * STUDOO_LIMITE_GERACOES: gerações permitidas por janela (padrão 20).
 * STUDOO_JANELA_GERACOES_MIN: tamanho da janela em minutos (padrão 60).
 */
const LIMITE_PADRAO = 20;
const JANELA_PADRAO_MIN = 60;

type Registro = Map<string, number[]>;

const instancia = globalThis as typeof globalThis & { geracoesStudoo?: Registro };
const geracoes: Registro = instancia.geracoesStudoo ?? new Map();
instancia.geracoesStudoo = geracoes;

function inteiroPositivo(bruto: string | undefined, padrao: number): number {
  const valor = Number(bruto);
  return bruto !== undefined && Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

/** Registra uma geração de `usuarioId`. Devolve false, sem registrar, quando o teto da janela foi atingido. */
export function registrarGeracao(usuarioId: string, agora = Date.now()): boolean {
  const limite = inteiroPositivo(process.env.STUDOO_LIMITE_GERACOES, LIMITE_PADRAO);
  const janela = inteiroPositivo(process.env.STUDOO_JANELA_GERACOES_MIN, JANELA_PADRAO_MIN) * 60_000;

  const recentes = (geracoes.get(usuarioId) ?? []).filter((momento) => agora - momento < janela);
  if (recentes.length >= limite) {
    geracoes.set(usuarioId, recentes);
    return false;
  }

  geracoes.set(usuarioId, [...recentes, agora]);
  if (geracoes.size > 10_000) {
    for (const [chave, momentos] of geracoes) {
      if (momentos.every((momento) => agora - momento >= janela)) geracoes.delete(chave);
    }
  }
  return true;
}

export function reiniciarLimiteDeGeracoes(): void {
  geracoes.clear();
}

/** Limite persistente de gerações no PostgreSQL (reaproveita `tentativaLogin` via `consumirLimite`). */
export async function consumirGeracaoPersistente(usuarioId: string): Promise<boolean> {
  const limite = inteiroPositivo(process.env.STUDOO_LIMITE_GERACOES, LIMITE_PADRAO);
  const janela = inteiroPositivo(process.env.STUDOO_JANELA_GERACOES_MIN, JANELA_PADRAO_MIN) * 60_000;
  const { banco } = await import("@/servidor/banco/cliente");
  return banco.$transaction((tx) => consumirLimite(tx, `ia:geracao:${usuarioId}`, limite, janela));
}
