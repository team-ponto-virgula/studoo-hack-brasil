/*
 * Limite do provedor de IA (OpenAI): em 429, espera o que o provedor pede (`retry-after-ms` ou
 * `retry-after`, em segundos ou data HTTP) e tenta de novo, no máximo 2 vezes e com espera total de até 8 s. Se o
 * provedor pedir mais do que cabe nesse orçamento, desiste na hora e devolve o 429 a quem chamou (que já trata o erro).
 * Sem objetivo, conteúdo ou chave no log (SEGURANCA.md §8).
 */

export const MAX_NOVAS_TENTATIVAS = 2;
export const ESPERA_TOTAL_MAXIMA_MS = 8_000;
const ESPERA_PADRAO_MS = [1_000, 2_000];

/** Quanto o provedor pediu para esperar, em ms, ou null quando não disse (ou disse algo ilegível). */
export function esperaPedida(cabecalhos: Headers, agora = Date.now()): number | null {
  const ms = cabecalhos.get("retry-after-ms")?.trim();
  if (ms && /^\d+(\.\d+)?$/.test(ms)) return Math.ceil(Number(ms));
  const bruto = cabecalhos.get("retry-after")?.trim();
  if (!bruto) return null;
  if (/^\d+(\.\d+)?$/.test(bruto)) return Math.ceil(Number(bruto) * 1000);
  const data = Date.parse(bruto);
  return Number.isNaN(data) ? null : Math.max(0, data - agora);
}

function esperar(ms: number, sinal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sinal?.aborted) return reject(sinal.reason);
    const id = setTimeout(() => {
      sinal?.removeEventListener("abort", aoAbortar);
      resolve();
    }, ms);
    function aoAbortar() {
      clearTimeout(id);
      reject(sinal?.reason);
    }
    sinal?.addEventListener("abort", aoAbortar, { once: true });
  });
}

/**
 * Faz o pedido e, em 429, repete conforme as regras acima. `rota` vai no log (por exemplo, `ia-openai`).
 * Devolve a última resposta (ok ou não); o aborto do sinal durante a espera sobe como exceção.
 */
export async function comNovasTentativas(
  enviar: () => Promise<Response>,
  opcoes: { rota: string; sinal?: AbortSignal },
): Promise<Response> {
  let gasto = 0;
  let resposta = await enviar();
  for (let tentativa = 1; tentativa <= MAX_NOVAS_TENTATIVAS && resposta.status === 429; tentativa += 1) {
    const pedida = esperaPedida(resposta.headers);
    const espera = pedida ?? ESPERA_PADRAO_MS[tentativa - 1] ?? 2_000;
    if (gasto + espera > ESPERA_TOTAL_MAXIMA_MS) {
      console.error(JSON.stringify({ rota: opcoes.rota, codigo: "limite_do_provedor", motivo: "espera_longa", espera_ms: espera, tentativa }));
      break;
    }
    console.error(JSON.stringify({ rota: opcoes.rota, codigo: "limite_do_provedor", motivo: "nova_tentativa", espera_ms: espera, tentativa }));
    await resposta.body?.cancel().catch(() => {});
    await esperar(espera, opcoes.sinal);
    gasto += espera;
    resposta = await enviar();
  }
  return resposta;
}
