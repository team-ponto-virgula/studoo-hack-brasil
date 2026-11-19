import { criarClienteStudoo } from "@studoo/contratos";
import { tocaSons } from "../app/sons";

/**
 * O cliente da web. Sem rede numa ação da pessoa (pedido que não é GET), toca `erro_rede`; as leituras de fundo
 * (sincronia, listas) falham em silêncio. Pedido cancelado (AbortError) não é erro de rede.
 */
export const clienteStudooWeb = criarClienteStudoo((caminho, opcoes) =>
  fetch(caminho, { ...opcoes, credentials: "same-origin", cache: "no-store" }).catch((falha: unknown) => {
    const metodo = (opcoes?.method ?? "GET").toUpperCase();
    if (metodo !== "GET" && !(falha instanceof DOMException && falha.name === "AbortError")) void tocaSons.tocarEfeito("erro_rede");
    throw falha;
  }),
);
