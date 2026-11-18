import { randomBytes } from "node:crypto";
import {
  configuracaoRealtime,
  criarChamadaVozAoVivo,
  encerrarChamadaVozAoVivo,
  montarInstrucoesVozAoVivo,
} from "../src/servidor/ia/realtime";

function gerarSdpRealista(): string {
  const ufrag = randomBytes(4).toString("hex");
  const pwd = randomBytes(16).toString("hex");
  const fp = Array.from(randomBytes(32), (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
  return [
    "v=0",
    "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=group:BUNDLE 0 1",
    "a=extmap-allow-mixed",
    "a=msid-semantic: WMS studoo-conferencia",
    "m=audio 9 UDP/TLS/RTP/SAVPF 111",
    "c=IN IP4 0.0.0.0",
    "a=rtcp:9 IN IP4 0.0.0.0",
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    "a=ice-options:trickle",
    `a=fingerprint:sha-256 ${fp}`,
    "a=setup:actpass",
    "a=mid:0",
    "a=sendrecv",
    "a=rtcp-mux",
    "a=rtpmap:111 opus/48000/2",
    "a=fmtp:111 minptime=10;useinbandfec=1",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
    "c=IN IP4 0.0.0.0",
    `a=ice-ufrag:${ufrag}`,
    `a=ice-pwd:${pwd}`,
    `a=fingerprint:sha-256 ${fp}`,
    "a=setup:actpass",
    "a=mid:1",
    "a=sctp-port:5000",
    "a=max-message-size:262144",
    "",
  ].join("\r\n");
}

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

  const sessao = await criarChamadaVozAoVivo("conferencia-cli", gerarSdpRealista(), instrucoes);
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
  const codigo = (erro as { codigo?: string } | null)?.codigo ?? "desconhecido";
  console.error(`Falha ao conferir voz ao vivo: codigo=${codigo}`);
  process.exit(1);
});
