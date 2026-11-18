import type { ApoioEstudo, LicaoDetalhe, SessaoVozAoVivo } from "@studoo/contratos";
import { FalhaApi } from "../acesso/http";
import { assinatura, consumirLimite } from "../acesso/seguranca";
import { ehEmailVisitante } from "../acesso/visitante";
import { banco } from "../banco/cliente";
import { provedorIaAtivo } from "./gerador";
import { configuracaoOpenAi } from "./openai";

const MODELO_REALTIME_PADRAO = "gpt-realtime-2.1";
const VOZ_REALTIME_PADRAO = "marin";
const LIMITE_CONVERSA_SEGUNDOS = 180;
const AVISO_TEMPO_SEGUNDOS = 150;
const TETO_SERVIDOR_MS = 195_000;
const TIMEOUT_CHAMADA_MS = 15_000;

const LIMITE_HORA_PADRAO = 3;
const LIMITE_DIA_PADRAO = 10;
const LIMITE_VISITANTE_PADRAO = 1;
const LIMITE_VISITANTES_DIA_PADRAO = 20;

export type ConfiguracaoRealtime = {
  chave: string;
  base: string;
  modelo: string;
  voz: string;
};

type ChamadaAtiva = {
  usuarioId: string;
  timer: ReturnType<typeof setTimeout>;
};

const globalRealtime = globalThis as typeof globalThis & {
  chamadasVozAtivas?: Map<string, ChamadaAtiva>;
};
const chamadasAtivas: Map<string, ChamadaAtiva> = globalRealtime.chamadasVozAtivas ?? new Map();
globalRealtime.chamadasVozAtivas = chamadasAtivas;

function inteiroPositivo(bruto: string | undefined, padrao: number): number {
  const valor = Number(bruto);
  return bruto !== undefined && Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

export function vozAoVivoAtiva(): boolean {
  return process.env.STUDOO_VOZ_AO_VIVO === "1" && provedorIaAtivo() === "openai" && configuracaoOpenAi() !== null;
}

export function vozAoVivoVisitanteAtiva(): boolean {
  return vozAoVivoAtiva() && process.env.STUDOO_VOZ_AO_VIVO_VISITANTE === "1";
}

export function configuracaoRealtime(): ConfiguracaoRealtime | null {
  if (!vozAoVivoAtiva()) return null;
  const openai = configuracaoOpenAi();
  if (!openai) return null;
  return {
    chave: openai.chave,
    base: openai.base,
    modelo: process.env.OPENAI_REALTIME_MODELO?.trim() || MODELO_REALTIME_PADRAO,
    voz: process.env.OPENAI_REALTIME_VOZ?.trim() || VOZ_REALTIME_PADRAO,
  };
}

export type DadosLicaoVoz = Pick<LicaoDetalhe, "titulo" | "objetivo" | "conceito" | "exemplo" | "passos" | "falas">;

/**
 * Monta as instruções pedagógicas do Stu para a conversa de voz ao vivo.
 * Função pura para permitir validação determinística nos testes.
 */
export function montarInstrucoesVozAoVivo(licao: DadosLicaoVoz, apoio?: ApoioEstudo | null): string {
  const linhas: string[] = [
    "Você é o Stu, mascote do Studoo. Nesta conversa de voz ao vivo, você faz o papel de um estudante curioso que pede para a pessoa explicar a lição com as próprias palavras para você entender.",
    "Comece a conversa falando primeiro: dê um cumprimento breve e peça para a pessoa explicar a ideia desta lição.",
    `Lição: ${licao.titulo}.`,
    `Ideia central: ${licao.objetivo}.`,
    `Conteúdo de referência: ${licao.conceito}.`,
  ];

  if (licao.exemplo?.trim()) {
    linhas.push(`Exemplo da lição: ${licao.exemplo.trim()}`);
  }
  if (licao.passos?.length) {
    linhas.push(`Passos: ${licao.passos.join(" | ")}`);
  }
  if (licao.falas?.length) {
    linhas.push(`Falas de prática: ${licao.falas.map((f) => (f.traducao ? `${f.texto} (${f.traducao})` : f.texto)).join(" | ")}`);
  }

  if (apoio && (apoio.erros > 0 || apoio.ponte)) {
    const detalhes: string[] = [];
    if (apoio.erros > 0) detalhes.push(`${apoio.erros} erro(s) anteriores no exercício`);
    if (apoio.ponte?.motivo) detalhes.push(`dificuldade observada: ${apoio.ponte.motivo}`);
    if (apoio.ponte?.conceito) detalhes.push(`ponto de reforço: ${apoio.ponte.conceito}`);
    linhas.push(`Contexto de erros comuns desta pessoa na lição (${detalhes.join("; ")}): dê atenção especial a essa lacuna nas suas perguntas.`);
  }

  linhas.push(
    "Regras obrigatórias de condução:",
    "1. Faça no máximo 3 perguntas curtas ao longo da conversa, sempre uma pergunta por vez, focando lacunas da explicação e possíveis erros comuns do assunto.",
    "2. Fale no máximo 2 frases curtas por turno.",
    "3. Se a pessoa travar ou errar, dê uma dica ou um exemplo simples antes de explicar; só dê a explicação direta em 1 frase depois de 2 tentativas sem acerto.",
    "4. Peça pelo menos 1 exemplo do dia a dia ou situação real criado pela própria pessoa.",
    "5. Ao encerrar, faça um fechamento em no máximo 2 frases; nunca mencione XP, nota, pontuação ou ranking.",
    "6. Fale sempre em português do Brasil, mantenha o foco estrito no tema da lição e nunca peça ou repita dados pessoais.",
    "7. Perto de 2 minutos e 30 segundos, avise brevemente que o tempo está acabando; aos 3 minutos, despeça-se com gentileza e encerre.",
  );

  return linhas.join("\n");
}

/**
 * Aplica os limites persistentes de voz ao vivo no PostgreSQL (reaproveita `tentativaLogin` via `consumirLimite`).
 */
export async function consumirLimiteVozAoVivo(usuarioId: string): Promise<void> {
  const dentro = await banco.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { email: true } });
    if (usuario && ehEmailVisitante(usuario.email)) {
      if (!vozAoVivoVisitanteAtiva()) throw new FalhaApi("origem_invalida");
      const tetoVisitantesDia = inteiroPositivo(process.env.STUDOO_LIMITE_VOZ_VISITANTES_DIA, LIMITE_VISITANTES_DIA_PADRAO);
      const dentroDiaGlobal = await consumirLimite(tx, "ia:voz:visitantes:dia", tetoVisitantesDia, 24 * 60 * 60_000);
      if (!dentroDiaGlobal) return false;
      const tetoVisitante = inteiroPositivo(process.env.STUDOO_LIMITE_VOZ_VISITANTE, LIMITE_VISITANTE_PADRAO);
      return consumirLimite(tx, `ia:voz:usuario:${usuarioId}`, tetoVisitante, 24 * 60 * 60_000);
    }

    const tetoHora = inteiroPositivo(process.env.STUDOO_LIMITE_VOZ_HORA, LIMITE_HORA_PADRAO);
    const dentroHora = await consumirLimite(tx, `ia:voz:hora:${usuarioId}`, tetoHora, 60 * 60_000);
    if (!dentroHora) return false;

    const tetoDia = inteiroPositivo(process.env.STUDOO_LIMITE_VOZ_DIA, LIMITE_DIA_PADRAO);
    return consumirLimite(tx, `ia:voz:dia:${usuarioId}`, tetoDia, 24 * 60 * 60_000);
  });

  if (!dentro) throw new FalhaApi("limite_estudio");
}

function extrairCallId(location: string | null): string | null {
  if (!location) return null;
  const limpo = location.split("?")[0].split("#")[0];
  const partes = limpo.split("/").filter(Boolean);
  const ultimo = partes[partes.length - 1]?.trim();
  return ultimo && /^[a-zA-Z0-9_-]{4,128}$/.test(ultimo) ? ultimo : null;
}

function validarSdpOferta(sdp: string): string {
  const limpo = typeof sdp === "string" ? sdp.trim() : "";
  if (!limpo || limpo.length > 32_768 || !limpo.includes("v=0")) {
    throw new FalhaApi("invalido");
  }
  return limpo;
}

async function enviarHangup(config: ConfiguracaoRealtime, chamadaId: string): Promise<void> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 5_000);
  limite.unref?.();
  try {
    await fetch(`${config.base}/realtime/calls/${encodeURIComponent(chamadaId)}/hangup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.chave}` },
      signal: controlador.signal,
    });
  } catch {
    // Encerramento é idempotente; falha de rede não deve derrubar o fluxo do usuário.
  } finally {
    clearTimeout(limite);
  }
}

/**
 * Cria a chamada WebRTC pela interface unificada (`POST /v1/realtime/calls`), agenda o corte no servidor
 * aos 3m15s e devolve a resposta SDP sem expor nenhuma credencial da OpenAI ao navegador.
 */
export async function criarChamadaVozAoVivo(
  usuarioId: string,
  sdpOferta: string,
  instrucoes: string,
): Promise<SessaoVozAoVivo> {
  const config = configuracaoRealtime();
  if (!config) throw new FalhaApi("voz_indisponivel");
  const sdp = validarSdpOferta(sdpOferta);

  const sessao = {
    type: "realtime",
    model: config.modelo,
    instructions: instrucoes,
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: "gpt-4o-transcribe", language: "pt" },
        turn_detection: {
          type: "semantic_vad",
          eagerness: "low",
          interrupt_response: true,
        },
      },
      output: { voice: config.voz },
    },
  };

  const corpo = new FormData();
  corpo.set("sdp", sdp);
  corpo.set("session", JSON.stringify(sessao));

  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), TIMEOUT_CHAMADA_MS);
  limite.unref?.();

  let resposta: Response;
  try {
    resposta = await fetch(`${config.base}/realtime/calls`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.chave}`,
        "OpenAI-Safety-Identifier": assinatura(usuarioId),
      },
      body: corpo,
      signal: controlador.signal,
    });
  } catch (erro) {
    const motivo = erro instanceof Error && erro.name === "AbortError" ? "timeout" : "rede";
    console.warn(`[voz-ao-vivo] falha ao iniciar chamada (${motivo})`);
    throw new FalhaApi("voz_falha");
  } finally {
    clearTimeout(limite);
  }

  if (!resposta.ok) {
    console.warn(`[voz-ao-vivo] resposta OpenAI status=${resposta.status}`);
    throw new FalhaApi(resposta.status === 429 ? "limite_estudio" : "voz_falha");
  }

  const chamadaId = extrairCallId(resposta.headers.get("location"));
  const sdpResposta = await resposta.text();
  if (!chamadaId || !sdpResposta.trim()) {
    console.warn("[voz-ao-vivo] resposta sem Location ou SDP válido");
    throw new FalhaApi("voz_falha");
  }

  const anterior = chamadasAtivas.get(chamadaId);
  if (anterior) clearTimeout(anterior.timer);
  const timer = setTimeout(() => {
    chamadasAtivas.delete(chamadaId);
    void enviarHangup(config, chamadaId);
  }, TETO_SERVIDOR_MS);
  timer.unref?.();
  chamadasAtivas.set(chamadaId, { usuarioId, timer });

  return {
    chamadaId,
    sdpResposta,
    modelo: config.modelo,
    voz: config.voz,
    limiteSegundos: LIMITE_CONVERSA_SEGUNDOS,
    avisoSegundos: AVISO_TEMPO_SEGUNDOS,
  };
}

/** Encerra uma chamada WebRTC ativa no servidor (`hangup`), validando posse do usuário. */
export async function encerrarChamadaVozAoVivo(usuarioId: string, chamadaId: string): Promise<void> {
  if (!chamadaId || typeof chamadaId !== "string" || !/^[a-zA-Z0-9_-]{4,128}$/.test(chamadaId)) {
    throw new FalhaApi("invalido");
  }
  const ativa = chamadasAtivas.get(chamadaId);
  if (ativa && ativa.usuarioId !== usuarioId) {
    throw new FalhaApi("nao_encontrado");
  }
  if (ativa) {
    clearTimeout(ativa.timer);
    chamadasAtivas.delete(chamadaId);
  }
  const config = configuracaoRealtime();
  if (!config) return;
  await enviarHangup(config, chamadaId);
}
