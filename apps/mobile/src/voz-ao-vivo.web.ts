import {
  classificarErroServidorVoz,
  estadoInicialVozAoVivo,
  extrairTranscricaoUsuario,
  reduzirEventoRealtime,
  textoErroVozAoVivo,
  TEXTO_AVISO_FECHAMENTO_VOZ,
  type CodigoErroVozAoVivo,
  type EstadoSessaoVozAoVivo,
  type EventoRealtime,
  type SessaoVozAoVivo,
} from '@studoo/contratos';
import { mensagens } from './mensagens';
import type { ControladorVozAoVivo, OpcoesControladorVoz } from './voz-ao-vivo';

/*
 * Voz ao vivo na prévia web do app (spec 08, parte B): o mesmo fluxo de `src/app/voz-ao-vivo.ts`, pelo WebRTC do navegador.
 * Microfone → RTCPeerConnection com a trilha → canal `oai-events` → oferta para `iniciarVozAoVivo` → resposta SDP; o canal
 * leva os eventos ao redutor de `@studoo/contratos` (estados, legendas, transcrição), aos 150 s vai o item de sistema do
 * fechamento e aos 180 s a conversa encerra (com 10 s de folga se o Stu estiver falando). No aparelho, `voz-ao-vivo.ts`.
 */

export type DependenciasVoz = {
  pedirMic?: () => Promise<MediaStream>;
  criarPeer?: () => RTCPeerConnection;
  agoraMs?: () => number;
  criarAudio?: () => HTMLAudioElement;
};

/** Como a web: a opção só aparece com o WebRTC e o microfone do navegador. */
export function suporteVozAoVivo(): boolean {
  return typeof RTCPeerConnection !== 'undefined' && typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Nasce de forma síncrona, dentro do toque, para o cancelamento valer na hora e para o áudio respeitar o autoplay do Safari. */
export function iniciarControladorVozAoVivo(
  { licaoId, cliente, aoMudar, aoTempoEsgotado, aoErroFatal, aoNivelMic }: OpcoesControladorVoz,
  deps: DependenciasVoz = {},
): ControladorVozAoVivo {
  let estadoAtual = estadoInicialVozAoVivo();
  let stream: MediaStream | null = null;
  let pc: RTCPeerConnection | null = null;
  let canal: RTCDataChannel | null = null;
  let sessao: SessaoVozAoVivo | null = null;
  let relogio: ReturnType<typeof setInterval> | null = null;
  let timerConexao: ReturnType<typeof setTimeout> | null = null;
  let timerDesconexao: ReturnType<typeof setTimeout> | null = null;
  let timerGracaFim: ReturnType<typeof setTimeout> | null = null;
  let timerPendentes: ReturnType<typeof setTimeout> | null = null;
  let timerNivel: ReturnType<typeof setInterval> | null = null;
  let audioCtx: AudioContext | null = null;
  let resolverPendentes: (() => void) | null = null;
  let promessaEncerramento: Promise<string> | null = null;
  let inicioMs = 0;
  let avisoEnviado = false;
  let fimSolicitado = false;
  let cancelado = false;
  let encerrado = false;

  const agora = deps.agoraMs ?? (() => performance.now());

  let audioEl: HTMLAudioElement | null = null;
  if (deps.criarAudio) {
    audioEl = deps.criarAudio();
  } else if (typeof document !== 'undefined') {
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    (audioEl as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    void audioEl.play?.().catch(() => undefined);
  }

  const aplicar = (fn: (a: EstadoSessaoVozAoVivo) => EstadoSessaoVozAoVivo) => {
    estadoAtual = fn(estadoAtual);
    if (estadoAtual.itensPendentes.length === 0 && resolverPendentes) {
      resolverPendentes();
      resolverPendentes = null;
    }
    aoMudar(estadoAtual);
  };

  const limparTemporizadores = () => {
    if (relogio !== null) { clearInterval(relogio); relogio = null; }
    if (timerConexao !== null) { clearTimeout(timerConexao); timerConexao = null; }
    if (timerDesconexao !== null) { clearTimeout(timerDesconexao); timerDesconexao = null; }
    if (timerGracaFim !== null) { clearTimeout(timerGracaFim); timerGracaFim = null; }
    if (timerPendentes !== null) { clearTimeout(timerPendentes); timerPendentes = null; }
    if (timerNivel !== null) { clearInterval(timerNivel); timerNivel = null; }
  };

  const silenciarMidia = () => {
    stream?.getAudioTracks().forEach((t) => { t.enabled = false; });
    if (audioEl) audioEl.muted = true;
    aoNivelMic?.(0);
  };

  const limparMidia = () => {
    limparTemporizadores();
    if (audioCtx) {
      void audioCtx.close().catch(() => undefined);
      audioCtx = null;
    }
    aoNivelMic?.(0);
    try { canal?.close(); } catch { /* ignore */ }
    canal = null;
    try { pc?.close(); } catch { /* ignore */ }
    pc = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl = null;
    }
  };

  const encerrarNoServidor = async () => {
    const chamadaId = sessao?.chamadaId;
    if (!chamadaId) return;
    sessao = null;
    if (cliente.encerrarVozAoVivo) {
      await cliente.encerrarVozAoVivo(licaoId, chamadaId).catch(() => undefined);
    }
  };

  // A web encerra com um fetch keepalive levando o cookie; o app entra com o token do cliente, então o pedido vai por ele.
  // Se a página fechar antes de o pedido sair, o teto de 195 s do servidor desliga a chamada (spec 08).
  const aoPageHide = () => {
    void encerrarNoServidor();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', aoPageHide);
  }

  const removerPageHide = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', aoPageHide);
    }
  };

  const falhar = (codigo: CodigoErroVozAoVivo) => {
    if (encerrado || cancelado) return;
    encerrado = true;
    removerPageHide();
    const parcial = extrairTranscricaoUsuario(estadoAtual);
    limparMidia();
    void encerrarNoServidor();
    aplicar((a) => ({
      ...a,
      estado: 'erro',
      erro: codigo,
      anuncioSr: textoErroVozAoVivo(codigo),
    }));
    aoErroFatal?.(codigo, parcial);
  };

  const tratarFechamentoRemoto = () => {
    if (cancelado || encerrado) return;
    const limite = sessao?.limiteSegundos ?? 180;
    if (inicioMs > 0 && estadoAtual.segundos >= limite) {
      void encerrar().then(aoTempoEsgotado);
    } else {
      falhar(inicioMs > 0 ? 'rede' : 'falhaConexao');
    }
  };

  const esperarTranscricoesPendentes = (): Promise<void> => {
    if (estadoAtual.itensPendentes.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      resolverPendentes = resolve;
      timerPendentes = setTimeout(() => {
        resolverPendentes = null;
        resolve();
      }, 3_000);
    });
  };

  const iniciarMedidorMic = () => {
    if (!aoNivelMic || !stream || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      audioCtx = new AudioCtx();
      const fonte = audioCtx.createMediaStreamSource(stream);
      const analisador = audioCtx.createAnalyser();
      analisador.fftSize = 64;
      fonte.connect(analisador);
      const dados = new Uint8Array(analisador.frequencyBinCount);
      timerNivel = setInterval(() => {
        if (cancelado || encerrado || estadoAtual.mudo || estadoAtual.estado !== 'ouvindo') {
          aoNivelMic(0);
          return;
        }
        analisador.getByteFrequencyData(dados);
        const media = dados.reduce((acc, v) => acc + v, 0) / Math.max(1, dados.length);
        aoNivelMic(Math.min(1, media / 90));
      }, 80);
    } catch {
      // Sem Web Audio: segue sem animação de nível (as ondas ficam cheias, como na web).
    }
  };

  const tentarAtivarConversa = () => {
    if (cancelado || encerrado || inicioMs > 0) return;
    const estadoPc = pc?.connectionState;
    const pcPronto = estadoPc === 'connected' || estadoPc === undefined;
    const canalAberto = canal?.readyState === 'open';
    if (!pcPronto || !canalAberto) return;

    if (timerConexao !== null) { clearTimeout(timerConexao); timerConexao = null; }
    inicioMs = agora();
    aplicar((a) => ({
      ...a,
      estado: 'ouvindo',
      anuncioSr: mensagens.estudio.vozAoVivo.conectado,
    }));
    iniciarMedidorMic();

    try {
      canal?.send(JSON.stringify({ type: 'response.create' }));
    } catch { /* ignore */ }

    const limite = sessao?.limiteSegundos ?? 180;
    const aviso = sessao?.avisoSegundos ?? 150;
    relogio = setInterval(() => {
      if (cancelado || encerrado) return;
      const decorridos = Math.max(0, Math.floor((agora() - inicioMs) / 1000));
      const atingiuAviso = decorridos >= aviso;

      if (atingiuAviso && !avisoEnviado) {
        avisoEnviado = true;
        try {
          canal?.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system',
              content: [{ type: 'input_text', text: TEXTO_AVISO_FECHAMENTO_VOZ }],
            },
          }));
          if (!estadoAtual.pessoaFalando && !estadoAtual.respostaEmCurso) {
            canal?.send(JSON.stringify({ type: 'response.create' }));
          }
        } catch { /* ignore */ }
      }

      aplicar((a) => ({
        ...a,
        segundos: decorridos,
        avisoTempo: a.avisoTempo || atingiuAviso,
        ...(atingiuAviso && !a.avisoTempo ? { anuncioSr: mensagens.estudio.vozAoVivo.avisoTempo } : {}),
      }));

      if (decorridos >= limite && !fimSolicitado) {
        fimSolicitado = true;
        if (estadoAtual.estado === 'stu_falando') {
          timerGracaFim = setTimeout(() => {
            if (!encerrado && !cancelado) void encerrar().then(aoTempoEsgotado);
          }, 10_000);
        } else {
          void encerrar().then(aoTempoEsgotado);
        }
      }
    }, 500);
  };

  async function conectar() {
    if (!cliente.iniciarVozAoVivo) {
      falhar('falhaConexao');
      return;
    }

    aplicar((a) => ({ ...a, estado: 'pedindo_mic', erro: null }));
    try {
      const pedirMic = deps.pedirMic ?? (() => {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem_mic');
        return navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      });
      stream = await pedirMic();
      if (cancelado || encerrado) { limparMidia(); return; }
    } catch {
      falhar('micNegado');
      return;
    }

    try {
      aplicar((a) => ({
        ...a,
        estado: 'conectando',
        anuncioSr: mensagens.estudio.vozAoVivo.estados.conectando,
      }));
      timerConexao = setTimeout(() => {
        falhar('falhaConexao');
      }, 12_000);

      pc = deps.criarPeer ? deps.criarPeer() : new RTCPeerConnection();
      const faixa = stream.getAudioTracks()[0];
      if (faixa) pc.addTrack(faixa, stream);

      pc.ontrack = (ev) => {
        if (audioEl && ev.streams[0]) audioEl.srcObject = ev.streams[0];
      };

      canal = pc.createDataChannel('oai-events');
      canal.onopen = () => {
        tentarAtivarConversa();
      };
      canal.onclose = () => {
        tratarFechamentoRemoto();
      };
      canal.onmessage = (ev) => {
        if (cancelado) return;
        try {
          const evento = JSON.parse(String(ev.data)) as EventoRealtime;
          const antes = estadoAtual;
          aplicar((a) => reduzirEventoRealtime(a, evento));
          if (estadoAtual.estado === 'erro' && antes.estado !== 'erro') {
            encerrado = true;
            removerPageHide();
            const parcial = extrairTranscricaoUsuario(estadoAtual);
            limparMidia();
            void encerrarNoServidor();
            aoErroFatal?.(estadoAtual.erro ?? 'rede', parcial);
            return;
          }
          if (fimSolicitado && antes.estado === 'stu_falando' && estadoAtual.estado === 'ouvindo' && !encerrado && !cancelado) {
            if (timerGracaFim !== null) { clearTimeout(timerGracaFim); timerGracaFim = null; }
            void encerrar().then(aoTempoEsgotado);
          }
        } catch { /* ignore */ }
      };

      pc.onconnectionstatechange = () => {
        if (cancelado || encerrado) return;
        const st = pc?.connectionState;
        if (st === 'connected') {
          if (timerDesconexao !== null) { clearTimeout(timerDesconexao); timerDesconexao = null; }
          tentarAtivarConversa();
          return;
        }
        if (st === 'failed' || st === 'closed') {
          tratarFechamentoRemoto();
          return;
        }
        if (st === 'disconnected' && timerDesconexao === null) {
          timerDesconexao = setTimeout(() => {
            timerDesconexao = null;
            if (!cancelado && !encerrado && pc?.connectionState === 'disconnected') {
              falhar(inicioMs > 0 ? 'rede' : 'falhaConexao');
            }
          }, 5_000);
        }
      };

      const oferta = await pc.createOffer();
      if (cancelado || encerrado) { limparMidia(); return; }
      await pc.setLocalDescription(oferta);
      if (cancelado || encerrado) { limparMidia(); return; }
      if (!oferta.sdp) throw new Error('sdp_vazio');

      const resposta = await cliente.iniciarVozAoVivo(licaoId, oferta.sdp);
      sessao = resposta;
      if (cancelado || encerrado) {
        limparMidia();
        await encerrarNoServidor();
        return;
      }

      aplicar((a) => ({ ...a, limiteSegundos: resposta.limiteSegundos || 180 }));
      await pc.setRemoteDescription({ type: 'answer', sdp: resposta.sdpResposta });
      if (cancelado || encerrado) {
        limparMidia();
        await encerrarNoServidor();
        return;
      }
      tentarAtivarConversa();
    } catch (erro) {
      if (cancelado || encerrado) {
        limparMidia();
        await encerrarNoServidor();
        return;
      }
      falhar(classificarErroServidorVoz(erro));
    }
  }

  void conectar();

  function encerrar(): Promise<string> {
    if (promessaEncerramento) return promessaEncerramento;
    encerrado = true;
    removerPageHide();
    silenciarMidia();
    if (timerGracaFim !== null) { clearTimeout(timerGracaFim); timerGracaFim = null; }
    if (relogio !== null) { clearInterval(relogio); relogio = null; }
    aplicar((a) => ({
      ...a,
      estado: 'encerrando',
      anuncioSr: mensagens.estudio.vozAoVivo.estados.encerrando,
    }));
    promessaEncerramento = (async () => {
      await esperarTranscricoesPendentes();
      const textoFinal = extrairTranscricaoUsuario(estadoAtual);
      limparMidia();
      await encerrarNoServidor();
      return textoFinal;
    })();
    return promessaEncerramento;
  }

  function alternarMudo(): boolean {
    const faixa = stream?.getAudioTracks()[0];
    if (!faixa) return estadoAtual.mudo;
    faixa.enabled = !faixa.enabled;
    const mudo = !faixa.enabled;
    aplicar((a) => ({ ...a, mudo }));
    return mudo;
  }

  function descartar() {
    if (cancelado && encerrado) return;
    cancelado = true;
    encerrado = true;
    removerPageHide();
    limparMidia();
    void encerrarNoServidor();
  }

  return { alternarMudo, encerrar, descartar };
}
