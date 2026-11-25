import type { EventoGeracao } from "@studoo/contratos";
import { cabecalhosSeguros } from "@/servidor/acesso/http";

/**
 * Transmite os eventos como NDJSON, uma linha por evento. A geração só avança quando o cliente lê
 * e para quando a conexão cai ou o pedido é cancelado: nada fica gerando para ninguém.
 */
export function respostaNdjson(
  eventos: (sinal: AbortSignal) => AsyncGenerator<EventoGeracao>,
  sinalDoPedido: AbortSignal,
  manterAberto = false,
): Response {
  const controle = new AbortController();
  const abortar = () => controle.abort();
  if (sinalDoPedido.aborted) abortar();
  else sinalDoPedido.addEventListener("abort", abortar, { once: true });

  const origem = eventos(controle.signal);
  const codificador = new TextEncoder();
  const encerrar = () => sinalDoPedido.removeEventListener("abort", abortar);

  let ativo = true;
  const linhaVazia = codificador.encode("\n");
  const corpo = new ReadableStream<Uint8Array>({
    start(canal) {
      if (manterAberto) canal.enqueue(linhaVazia);
    },
    async pull(canal) {
      // Linhas em branco não são eventos. Evitam espera sem bytes durante a triagem.
      const pulso = manterAberto ? setInterval(() => {
        if (ativo && !controle.signal.aborted && (canal.desiredSize ?? 0) > 0) canal.enqueue(linhaVazia);
      }, 10_000) : null;
      try {
        const passo = await origem.next();
        if (!ativo) return;
        if (passo.done) {
          encerrar();
          canal.close();
          return;
        }
        canal.enqueue(codificador.encode(`${JSON.stringify(passo.value)}\n`));
      } catch (erro) {
        encerrar();
        if (ativo) canal.error(erro);
      } finally {
        if (pulso) clearInterval(pulso);
      }
    },
    async cancel() {
      ativo = false;
      encerrar();
      controle.abort();
      await origem.return(undefined);
    },
  });

  return new Response(corpo, {
    status: 200,
    headers: {
      ...cabecalhosSeguros,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
