import {
  configuracaoRealtime,
  criarChamadaVozAoVivo,
  encerrarChamadaVozAoVivo,
  montarInstrucoesVozAoVivo,
} from "../src/servidor/ia/realtime";

const SDP_MINIMO_CONFERENCIA = [
  "v=0",
  "o=- 0 0 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "c=IN IP4 0.0.0.0",
  "a=rtpmap:111 opus/48000/2",
  "",
].join("\r\n");

async function main() {
  const config = configuracaoRealtime();
  if (!config) {
    console.error("Voz ao vivo desativada. Defina STUDOO_VOZ_AO_VIVO=1, IA=openai e OPENAI_API_KEY.");
    process.exit(1);
  }

  const instrucoes = montarInstrucoesVozAoVivo({
    titulo: "Conferência técnica da voz ao vivo",
    objetivo: "Validar criação e encerramento da chamada Realtime sem áudio",
    conceito: "A interface unificada negocia SDP pelo servidor e encerra por call_id.",
    exemplo: "Uma troca curta de cumprimento e encerramento.",
  });

  const sessao = await criarChamadaVozAoVivo("conferencia-cli", SDP_MINIMO_CONFERENCIA, instrucoes);
  await encerrarChamadaVozAoVivo("conferencia-cli", sessao.chamadaId);

  console.log(
    JSON.stringify({
      ok: true,
      modelo: sessao.modelo,
      voz: sessao.voz,
      chamadaId: sessao.chamadaId,
      sdpRecebido: sessao.sdpResposta.includes("v=0"),
      limiteSegundos: sessao.limiteSegundos,
    }),
  );
}

main().catch((erro) => {
  console.error("Falha ao conferir voz ao vivo:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
