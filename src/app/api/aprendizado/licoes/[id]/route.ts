import { CABECALHO_CAPACIDADES, lerCapacidades } from "@studoo/contratos";
import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { buscarLicao } from "@/servidor/aprendizado/servico";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    // O que a lição leva depende do cabeçalho X-Studoo-Capacidades (visuais@1,resolucao@1): sem ele, nenhum campo novo e o
    // desenho vem como PNG em `recurso`. `Vary` avisa qualquer cache.
    const capacidades = lerCapacidades(request.headers.get(CABECALHO_CAPACIDADES));
    const resposta = responder(await buscarLicao(usuarioId, id, { capacidades, desenharPng: true }));
    resposta.headers.append("Vary", CABECALHO_CAPACIDADES);
    return resposta;
  });
}
