import { CABECALHO_CAPACIDADES, criarClienteStudoo, ErroStudoo, interpretarEventoGeracao, type EscolhaNoSuaVez, type TransporteStudoo } from "@studoo/contratos";
import { comAceiteIa } from "../app/aceite-ia";
import { tocaSons } from "../app/sons";
import { CAPACIDADES_DO_SITE } from "./capacidades";

/**
 * O transporte da web. Sem rede numa ação da pessoa (pedido que não é GET), toca `erro_rede`; as leituras de fundo
 * (sincronia, listas) falham em silêncio. Pedido cancelado (AbortError) não é erro de rede.
 * Um 428 `consentimento_ia` abre a folha do aceite de IA; com "Permitir", o pedido é refeito uma vez (`comAceiteIa`).
 */
const transporteDaWeb: TransporteStudoo = (caminho, opcoes) =>
  comAceiteIa(() => fetch(caminho, {
    ...opcoes,
    headers: { [CABECALHO_CAPACIDADES]: CAPACIDADES_DO_SITE, ...opcoes?.headers },
    credentials: "same-origin",
    cache: "no-store",
  })).catch((falha: unknown) => {
    const metodo = (opcoes?.method ?? "GET").toUpperCase();
    if (metodo !== "GET" && !(falha instanceof DOMException && falha.name === "AbortError")) void tocaSons.tocarEfeito("erro_rede");
    throw falha;
  });

export const clienteStudooWeb = criarClienteStudoo(transporteDaWeb);

/**
 * O "Sua vez" do "Resolva comigo" (spec 15): `POST /api/aprendizado/licoes/[id]/resolucao` com a opção e a tentativa. Devolve o corpo cru
 * (quem chama confere a forma, e uma resposta que não serve vira o exemplo em texto); erro da API vira `ErroStudoo`, e sem rede lança a
 * falha do `fetch`. A resposta certa só existe no servidor: antes da escolha, a web não a tem.
 */
export async function responderSuaVez(id: string, escolha: EscolhaNoSuaVez): Promise<unknown> {
  const resposta = await transporteDaWeb(`/api/aprendizado/licoes/${encodeURIComponent(id)}/resolucao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opcao: escolha.opcao, tentativa: escolha.tentativa }),
  });
  const corpo: unknown = await resposta.json();
  if (!resposta.ok) {
    const codigo = typeof corpo === "object" && corpo !== null && "codigo" in corpo ? corpo.codigo : undefined;
    const evento = interpretarEventoGeracao(JSON.stringify({ tipo: "erro", codigo }));
    throw new ErroStudoo(evento?.tipo === "erro" ? evento.codigo : "falha", corpo);
  }
  return corpo;
}
