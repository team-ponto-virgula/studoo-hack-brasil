import { FalhaApi, lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { buscarLicao } from "@/servidor/aprendizado/servico";
import { buscarApoio } from "@/servidor/estudio/apoio";
import {
  consumirLimiteVozAoVivo,
  criarChamadaVozAoVivo,
  encerrarChamadaVozAoVivo,
  montarInstrucoesVozAoVivo,
  validarSdpOferta,
  vozAoVivoAtiva,
} from "@/servidor/ia/realtime";
import { exigirConsentimentoIa } from "@/servidor/privacidade/consentimento";

export async function POST(
  request: Request,
  contexto: { params: Promise<{ id: string }> },
) {
  return rotaPrivada(request, async (usuarioId) => {
    if (!vozAoVivoAtiva()) throw new FalhaApi("nao_encontrado");
    await exigirConsentimentoIa(usuarioId);

    const corpo = await lerJson(request, 65_536) as { sdp?: unknown };
    const sdp = validarSdpOferta(corpo?.sdp);

    const { id } = await contexto.params;
    const licao = await buscarLicao(usuarioId, id);
    const apoio = await buscarApoio(usuarioId, id);

    await consumirLimiteVozAoVivo(usuarioId);

    const instrucoes = montarInstrucoesVozAoVivo(licao, apoio);
    const sessao = await criarChamadaVozAoVivo(usuarioId, sdp, instrucoes, {
      idiomaLivre: Boolean(licao.falas?.length),
    });
    // A permissão pode ter sido retirada em outro aparelho enquanto a chamada era negociada.
    try {
      await exigirConsentimentoIa(usuarioId);
    } catch (erro) {
      await encerrarChamadaVozAoVivo(usuarioId, sessao.chamadaId);
      throw erro;
    }
    return responder(sessao);
  });
}
