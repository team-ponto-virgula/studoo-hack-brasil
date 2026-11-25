'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ErroStudoo,
  LIMITES_ESTUDIO,
  type ApoioEstudo,
  type Avaliacao,
  type LicaoDetalhe,
  type MaterialEstudo,
  type PropostaPlano,
  type ProvedorIa,
} from '@studoo/contratos';
import {
  estadoInicialVozAoVivo,
  formatarTempoVoz,
  prepararExplicacaoParaAvaliacao,
  textoErroVozAoVivo,
  type EstadoSessaoVozAoVivo,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens } from '../mensagens/pt-BR';
import { AcaoPrincipal, Botao, Stu } from '../ui';
import { medirAcaoFixa } from '../ui/rodape-movel';
import {
  iniciarControladorVozAoVivo,
  type ControladorVozAoVivo,
} from './voz-ao-vivo';
import { tocaSons } from './sons';
import { PonteReforco } from './ponte-reforco';
import { linhaDoPassoDoEnsino, passoAtivoDoEnsino } from './ensino-passos';
import { TextoComFormulas } from './texto-com-formulas';
import './estudio.css';
const m = mensagens.estudio;
/** Uma consulta a `/api/auth/config` por carga, compartilhada pela voz ao vivo e pela gravação (refeita se falhar). */
type ConfigAcesso = Awaited<ReturnType<typeof cliente.configuracaoAcesso>>;
let promessaConfig: Promise<ConfigAcesso> | null = null;
function consultarConfig(): Promise<ConfigAcesso> {
  if (!promessaConfig) {
    promessaConfig = cliente.configuracaoAcesso().catch((erro) => {
      promessaConfig = null;
      throw erro;
    });
  }
  return promessaConfig;
}
/** Provedor de texto quando a voz ao vivo está liberada para esta conta (para o aviso de privacidade), ou null. */
let promessaElegibilidadeVoz: Promise<'openai' | null> | null = null;
export function invalidarElegibilidadeVozAoVivo(): void {
  promessaElegibilidadeVoz = null;
  promessaGravacao = null;
  promessaConfig = null;
}
function consultarElegibilidadeVozAoVivo(): Promise<'openai' | null> {
  if (!promessaElegibilidadeVoz) {
    promessaElegibilidadeVoz = consultarConfig()
      .then(async (cfg) => {
        if (!cfg.vozAoVivo || cfg.ia !== 'openai') return null;
        const sessao = await cliente.sessao();
        return !sessao.visitante || Boolean(cfg.vozAoVivoVisitante) ? cfg.ia : null;
      })
      .catch(() => null);
  }
  return promessaElegibilidadeVoz;
}
/** Provedor de texto quando a gravação está disponível (para dizer quem recebe o áudio), ou null. */
let promessaGravacao: Promise<'openai' | null> | null = null;
function consultarGravacao(): Promise<'openai' | null> {
  if (!promessaGravacao) {
    promessaGravacao = consultarConfig()
      .then((cfg) => (cfg.transcricao && cfg.ia === 'openai' ? cfg.ia : null))
      .catch(() => null);
  }
  return promessaGravacao;
}
function erroTexto(e: unknown) {
  return e instanceof ErroStudoo
    ? (mensagens.erros[e.codigo as keyof typeof mensagens.erros] ?? m.erro)
    : m.erro;
}
export function lerBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.readAsDataURL(blob);
  });
}

export function MaterialParaTrilha({
  objetivo,
  onProposta,
  mostrarCabeca = true,
  aoDesconectar,
  aoMudarLeitura,
}: {
  objetivo: string;
  onProposta: (p: PropostaPlano) => void;
  mostrarCabeca?: boolean;
  aoDesconectar?: () => void;
  aoMudarLeitura?: (lendo: boolean) => void;
}) {
  const [material, setMaterial] = useState<MaterialEstudo | null>(null);
  const [provedorIa, setProvedorIa] = useState<ProvedorIa>('falsa');
  const [toque, setToque] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [erro, setErro] = useState('');
  const vivo = useRef(true);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const inputCameraRef = useRef<HTMLInputElement>(null);
  const acoesMaterialRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    vivo.current = true;
    setToque(window.matchMedia('(pointer: coarse)').matches);
    void cliente.configuracaoAcesso().then((cfg) => {
      if (vivo.current) setProvedorIa(cfg.ia);
    }).catch(() => undefined);
    return () => {
      vivo.current = false;
    };
  }, []);
  useEffect(() => {
    if (!material) return;
    const quadro = window.requestAnimationFrame(() => {
      const el = acoesMaterialRef.current;
      if (!el?.getClientRects().length) return;
      const acaoPrincipal = el.querySelector('.acao-principal');
      // Com a ação já presa à vista, a prévia não precisa saltar até o botão de remoção.
      if (acaoPrincipal && window.getComputedStyle(acaoPrincipal).position === 'fixed') return;
      const barra = document.querySelector<HTMLElement>('.navegacao-mobile');
      const limite = (barra?.getClientRects().length ? barra.getBoundingClientRect().top : window.innerHeight) - 16;
      const sobra = el.getBoundingClientRect().bottom - limite;
      if (sobra > 0) {
        const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({ top: sobra + 16, behavior: reduzido ? 'auto' : 'smooth' });
      }
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [material]);
  async function executar(tarefa: () => Promise<void>, lendo = false) {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setOcupado(true);
    setErro('');
    if (lendo) aoMudarLeitura?.(true);
    try {
      await tarefa();
    } catch (e) {
      if (!vivo.current) return;
      if (aoDesconectar && e instanceof ErroStudoo && e.codigo === 'nao_autenticado') {
        aoDesconectar();
        return;
      }
      setErro(erroTexto(e));
    } finally {
      emExecucao.current = false;
      if (vivo.current) {
        setOcupado(false);
        if (lendo) aoMudarLeitura?.(false);
      }
    }
  }
  async function selecionar(f?: File) {
    if (!f) return;
    await executar(async () => {
      if (f.size > LIMITES_ESTUDIO.arquivoBytes)
        throw new ErroStudoo('material_invalido');
      const novo = await cliente.enviarMaterial({
        nome: f.name,
        tipo: f.type,
        base64: await lerBase64(f),
      });
      if (vivo.current) setMaterial(novo);
    }, true);
  }
  return (
    <section
      className="estudio-card"
      aria-labelledby={mostrarCabeca ? 'material-titulo' : undefined}
      aria-label={mostrarCabeca ? undefined : mensagens.inicio.materialTitulo}
      aria-busy={ocupado}
    >
      {mostrarCabeca && (
        <div className="estudio-cabeca">
          <Stu expressao="stu-feliz" tamanho={56} animado="uma-vez" />
          <div>
            <h2 id="material-titulo">{mensagens.inicio.materialTitulo}</h2>
            <p>{mensagens.inicio.materialTexto}</p>
          </div>
        </div>
      )}
      <p className="estudio-legenda">{mensagens.inicio.enviarSeguro}</p>
      <details><summary>{mensagens.inicio.detalhes}</summary><p className="estudio-legenda">{m.limites}</p><p className="estudio-legenda">{m.privacidadePorProvedor(provedorIa)}</p></details>
      {!material ? (
        <div className="estudio-acoes">
          <Botao
            variante="secundario"
            className="estudio-arquivo"
            disabled={ocupado}
            onClick={() => inputArquivoRef.current?.click()}
          >
            {mensagens.inicio.arquivo}
          </Botao>
          <input
            ref={inputArquivoRef}
            className="estudio-arquivo-input"
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            accept=".pdf,.docx,.csv,image/jpeg,image/png,image/webp"
            disabled={ocupado}
            onChange={(e) => {
              void selecionar(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {toque && (
            <>
              <Botao
                variante="secundario"
                className="estudio-arquivo"
                disabled={ocupado}
                onClick={() => inputCameraRef.current?.click()}
              >
                {mensagens.inicio.camera}
              </Botao>
              <input
                ref={inputCameraRef}
                className="estudio-arquivo-input"
                type="file"
                tabIndex={-1}
                aria-hidden="true"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={ocupado}
                onChange={(e) => {
                  void selecionar(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </>
          )}
          <Botao
            variante="secundario"
            disabled={ocupado}
            onClick={() =>
              void executar(async () => {
                const x = await cliente.materialDemo();
                if (vivo.current) setMaterial(x);
              }, true)
            }
          >
            {mensagens.inicio.demo}
          </Botao>
        </div>
      ) : (
        <>
          <h3>{material.nome}</h3>
          {material.leitura === 'demonstracao' && (
            <p className="estudio-selo">{m.simulado}</p>
          )}
          <p>{m.revisar}</p>
          {material.leitura === 'ocr' && <p>{m.ocr}</p>}
          <div className="estudio-paginas">
            {material.paginas.map((p) => (
              <article key={p.numero} className="estudio-pagina-card">
                <header className="estudio-pagina-card__topo">
                  <strong>{p.rotulo ?? m.pagina(p.numero)}</strong>
                </header>
                {p.imagem && (
                  <img className="estudio-pagina-thumb" src={p.imagem} alt={p.rotulo ?? m.pagina(p.numero)} />
                )}
                {p.tabela ? (
                  <div
                    className="estudio-tabela"
                    role="region"
                    aria-label={m.tabela}
                    tabIndex={0}
                  >
                    <table>
                      <caption>
                        {m.tabela} · {p.rotulo}
                      </caption>
                      <tbody>
                        {p.tabela.slice(0, 6).map((linha, i) => (
                          <tr key={i}>
                            <th scope="row">{(p.numero - 1) * 40 + i + 1}</th>
                            {linha.map((c, j) => (
                              <td key={j}>{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    <p className="estudio-pagina-previa">{p.texto}</p>
                    {p.texto.length > 180 && (
                      <details>
                        <summary>{m.paginaExpandir}</summary>
                        <p className="estudio-transcricao">{p.texto}</p>
                      </details>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
          {/* Spec 16, item 35: com o material lido, "Criar trilha deste material" é a ação presa da tela (no celular, até 767 px: 12 px acima da cápsula, sempre à vista, e o fim da rolagem reserva a
              altura dela mais 12 px); "Remover material" fica no fim do conteúdo, no fluxo. Do tablet para cima a ação fica no fluxo, como as outras ações principais. */}
          <div ref={acoesMaterialRef} className="estudio-acoes estudio-acoes--previa estudio-acoes--material">
            <AcaoPrincipal ref={medirAcaoFixa}>
              <Botao
                disabled={ocupado}
                onClick={() =>
                  void executar(async () => {
                    const p = await cliente.proporMaterial(
                      material.id,
                      objetivo.trim() || m.objetivo,
                    );
                    if (vivo.current) onProposta(p);
                  })
                }
              >
                {m.gerar}
              </Botao>
            </AcaoPrincipal>
            <Botao
              variante="texto"
              disabled={ocupado}
              onClick={() =>
                void executar(async () => {
                  await cliente.excluirMaterial(material.id);
                  if (vivo.current) setMaterial(null);
                })
              }
            >
              {m.remover}
            </Botao>
          </div>
        </>
      )}
      {ocupado && <p role="status">{m.pensando}</p>}
      {erro && <p role="alert">{erro}</p>}
    </section>
  );
}

export function ApoioDaLicao({
  licao,
  avaliacao,
  pedidoPonte = 0,
  ultimo = true,
  ensinoDireto = false,
  ultimaResposta = '',
  aoVoltarExercicio,
  aoConcluirPonte,
  aoEnsinar,
  aoAbrirExplique,
  aoDesconectar,
}: {
  licao: LicaoDetalhe;
  avaliacao: Avaliacao | null;
  /** Cada vez que muda, o reforço é pedido (o "Ver outro jeito de entender" do painel de retorno) e o cartão aparece. */
  pedidoPonte?: number;
  /** Último exercício da lição: só nele aparece o "Ensine ao Stu", quando a pessoa já viu a lição toda. */
  ultimo?: boolean;
  ensinoDireto?: boolean;
  /** Resposta que gerou o erro, exibida na 1ª tábua da ponte. */
  ultimaResposta?: string;
  /** Volta ao exercício recolhido quando a ponte está em tela cheia. */
  aoVoltarExercicio?: () => void;
  /** A pessoa acertou a pergunta do reforço: a lição troca o "Quase lá!" do painel pelo convite a tentar de novo. */
  aoConcluirPonte?: () => void;
  /** A explicação foi enviada: a lição tira o convite para explicar. */
  aoEnsinar?: () => void;
  /** O "Explique" abriu ou fechou: a lição deixa o rodapé só com as ações enquanto ele está aberto. */
  aoAbrirExplique?: (aberto: boolean) => void;
  /** Sessão encerrada ou inválida (401): redireciona para o login sem mascarar o erro. */
  aoDesconectar?: () => void;
}) {
  const [apoio, setApoio] = useState<ApoioEstudo | null>(null);
  // O retorno do "Ensine ao Stu" é o desta visita: o guardado de outra vez não volta com o campo vazio.
  const [ensino, setEnsino] = useState<ApoioEstudo['ensino']>(null);
  const retornoDoEnsino = useRef<HTMLDivElement>(null);
  const acoesEnsinoRef = useRef<HTMLDivElement>(null);
  // O aviso do microfone (ou da transcrição) aparece junto do botão Gravar, no pé da página: a tela leva até ele.
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const revisaoApoio = useRef(0);
  function garantirAcoesEnsinoVisiveis() {
    window.requestAnimationFrame(() => {
      const el = acoesEnsinoRef.current;
      if (!el) return;
      const rodape = document.querySelector<HTMLElement>('.aula-rodape');
      const alturaRodape = rodape ? rodape.getBoundingClientRect().height : 0;
      const rect = el.getBoundingClientRect();
      const limite = window.innerHeight - alturaRodape - 20;
      if (rect.bottom > limite) {
        const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({ top: rect.bottom - limite, behavior: reduzido ? 'auto' : 'smooth' });
      }
    });
  }
  function atualizarApoio(valor: Parameters<typeof setApoio>[0]) {
    revisaoApoio.current += 1;
    setApoio(valor);
  }
  const [texto, setTexto] = useState('');
  const textoRef = useRef('');
  textoRef.current = texto;
  const [vozAoVivoDisponivel, setVozAoVivoDisponivel] = useState(false);
  const [provedorTextoVoz, setProvedorTextoVoz] = useState<'openai'>('openai');
  const [provedorGravacao, setProvedorGravacao] = useState<'openai' | null>(null);
  useEffect(() => {
    let ativo = true;
    if (!cliente.configuracaoAcesso) return;
    void consultarGravacao().then((provedor) => {
      if (ativo) setProvedorGravacao(provedor);
    });
    return () => {
      ativo = false;
    };
  }, []);
  const [etapaVoz, setEtapaVoz] = useState<'inativa' | 'privacidade' | 'ativa'>('inativa');
  const [estadoVoz, setEstadoVoz] = useState<EstadoSessaoVozAoVivo>(() => estadoInicialVozAoVivo());
  const controladorVozRef = useRef<ControladorVozAoVivo | null>(null);
  const ondasVozRef = useRef<HTMLDivElement>(null);
  const controlesVozRef = useRef<HTMLDivElement>(null);
  const campoEnsinoRef = useRef<HTMLTextAreaElement>(null);
  const painelPrivacidadeRef = useRef<HTMLDivElement>(null);
  const painelVozRef = useRef<HTMLDivElement>(null);
  const legendasVozRef = useRef<HTMLDivElement>(null);
  const usuarioRolouLegendasRef = useRef(false);
  useEffect(() => {
    let ativo = true;
    const suporteWebRtc =
      typeof RTCPeerConnection !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    if (!suporteWebRtc || !cliente.configuracaoAcesso) return;
    void consultarElegibilidadeVozAoVivo().then((provedor) => {
      if (!ativo) return;
      setVozAoVivoDisponivel(provedor !== null);
      if (provedor) setProvedorTextoVoz(provedor);
    });
    return () => {
      ativo = false;
      controladorVozRef.current?.descartar();
      controladorVozRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (etapaVoz === 'privacidade') {
      painelPrivacidadeRef.current?.scrollIntoView?.({ block: 'center' });
      painelPrivacidadeRef.current?.querySelector('button')?.focus();
    } else if (etapaVoz === 'ativa') {
      painelVozRef.current?.scrollIntoView?.({ block: 'center' });
    }
  }, [etapaVoz]);

  useEffect(() => {
    if (etapaVoz === 'ativa' && estadoVoz.avisoTempo) {
      controlesVozRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [etapaVoz, estadoVoz.avisoTempo]);

  useEffect(() => {
    const el = legendasVozRef.current;
    if (!el || usuarioRolouLegendasRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [estadoVoz.legendas]);

  function atualizarOndasVoz(nivel: number) {
    const barras = ondasVozRef.current?.querySelectorAll<HTMLElement>('span');
    if (!barras) return;
    const pesos = [0.6, 0.9, 1, 0.85, 0.65];
    barras.forEach((barra, i) => {
      const escala = Math.max(0.28, Math.min(1, 0.28 + nivel * (pesos[i] ?? 0.8)));
      barra.style.transform = `scaleY(${escala.toFixed(2)})`;
    });
  }

  function concluirComTranscricao(bruta: string) {
    controladorVozRef.current = null;
    const rascunho = textoRef.current;
    const preparada = prepararExplicacaoParaAvaliacao(bruta, rascunho);
    setEtapaVoz('inativa');
    if (!preparada) {
      if (bruta.trim() && !rascunho.trim()) setTexto(bruta.trim());
      setAviso(m.vozAoVivo.erros.curta);
      window.requestAnimationFrame(() => campoEnsinoRef.current?.focus());
      return;
    }
    setTexto(preparada);
    void executar(async () => {
      const r = await cliente.ensinarStu(licao.id, preparada);
      atualizarApoio((a) => ({ ...(a ?? { erros: 0, ponte: null }), ensino: r }));
      setEnsino(r);
      setAviso('');
      aoEnsinar?.();
    });
  }

  function iniciarConversaAoVivo() {
    // O som de início antes de abrir o microfone (o efeito abaixo pausa o fundo e os outros efeitos).
    void tocaSons.tocarEfeito('gravacao_inicio');
    setAviso('');
    usuarioRolouLegendasRef.current = false;
    setEtapaVoz('ativa');
    setEstadoVoz(estadoInicialVozAoVivo());
    controladorVozRef.current?.descartar();
    controladorVozRef.current = iniciarControladorVozAoVivo({
      licaoId: licao.id,
      cliente,
      aoMudar: setEstadoVoz,
      aoTempoEsgotado: concluirComTranscricao,
      aoNivelMic: atualizarOndasVoz,
      aoErroFatal: (_codigo, parcial) => {
        controladorVozRef.current = null;
        if (parcial.trim()) {
          const combinado = prepararExplicacaoParaAvaliacao(parcial, textoRef.current) ??
            [textoRef.current.trim(), parcial.trim()].filter(Boolean).join('\n\n');
          setEtapaVoz('inativa');
          setTexto(combinado);
          setAviso(m.vozAoVivo.parcialNoCampo);
          window.requestAnimationFrame(() => campoEnsinoRef.current?.focus());
        }
      },
    });
  }
  // Voz ao vivo: enquanto a conversa está aberta, o fundo para e só o fim da gravação toca; ao fechar, `gravacao_fim`.
  useEffect(() => {
    if (etapaVoz !== 'ativa') return;
    tocaSons.entrarEmGravacaoOuVoz();
    return () => { tocaSons.sairDeGravacaoOuVoz(); void tocaSons.tocarEfeito('gravacao_fim'); };
  }, [etapaVoz]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioRaf = useRef<number | null>(null);
  const ondasRef = useRef<HTMLDivElement>(null);
  const vivo = useRef(true);
  function pararOndas() {
    if (audioRaf.current !== null) {
      window.cancelAnimationFrame(audioRaf.current);
      audioRaf.current = null;
    }
    if (audioCtx.current) {
      void audioCtx.current.close().catch(() => undefined);
      audioCtx.current = null;
    }
    if (ondasRef.current) {
      const barras = ondasRef.current.querySelectorAll<HTMLElement>('span');
      const padrao = [0.25, 0.45, 0.65, 0.45, 0.25];
      barras.forEach((barra, i) => { barra.style.transform = `scaleY(${padrao[i] ?? 0.3})`; });
    }
  }
  useEffect(() => {
    vivo.current = true;
    const parar = () => {
      if (document.hidden && recorder.current?.state === 'recording')
        recorder.current.stop();
    };
    document.addEventListener('visibilitychange', parar);
    return () => {
      vivo.current = false;
      document.removeEventListener('visibilitychange', parar);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      pararOndas();
    };
  }, []);
  useEffect(() => {
    let ativo = true;
    const revisao = revisaoApoio.current;
    cliente
      .apoioLicao(licao.id)
      .then((x) => {
        if (ativo && revisao === revisaoApoio.current) setApoio(x);
      })
      .catch((e) => {
        if (!ativo || revisao !== revisaoApoio.current) return;
        if (aoDesconectar && e instanceof ErroStudoo && e.codigo === 'nao_autenticado') {
          aoDesconectar();
          return;
        }
        setErro(erroTexto(e));
      });
    return () => {
      ativo = false;
    };
  }, [licao.id, avaliacao]);
  // Gravação: o mesmo, do microfone aberto até fechar (o `gravando` cai depois de parar as faixas).
  useEffect(() => {
    if (!gravando) return;
    tocaSons.entrarEmGravacaoOuVoz();
    return () => { tocaSons.sairDeGravacaoOuVoz(); void tocaSons.tocarEfeito('gravacao_fim'); };
  }, [gravando]);
  useEffect(() => {
    if (!gravando) return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [gravando]);
  useEffect(() => {
    if (segundos >= 60 && recorder.current?.state === 'recording')
      recorder.current.stop();
  }, [segundos]);
  async function executar(tarefa: () => Promise<void>) {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setOcupado(true);
    setErro('');
    try {
      await tarefa();
    } catch (e) {
      if (!vivo.current) return;
      if (aoDesconectar && e instanceof ErroStudoo && e.codigo === 'nao_autenticado') {
        aoDesconectar();
        return;
      }
      setErro(erroTexto(e));
    } finally {
      emExecucao.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  async function gravar() {
    await executar(async () => {
      try {
        void tocaSons.tocarEfeito('gravacao_inicio');
        const midia = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (!vivo.current || document.hidden) {
          midia.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = midia;
        const rec = new MediaRecorder(midia);
        recorder.current = rec;
        const partes: Blob[] = [];
        let falhou = false;
        rec.onerror = () => {
          falhou = true;
          midia.getTracks().forEach((t) => t.stop());
          pararOndas();
          if (vivo.current) {
            setGravando(false);
            setErro(m.vozErro);
          }
        };
        rec.ondataavailable = (e) => {
          if (e.data.size) partes.push(e.data);
        };
        rec.onstop = () => {
          midia.getTracks().forEach((t) => t.stop());
          pararOndas();
          if (!vivo.current || falhou) return;
          setGravando(false);
          void executar(async () => {
            const blob = new Blob(partes, { type: rec.mimeType });
            const tipo = rec.mimeType.split(';')[0];
            if (blob.size > LIMITES_ESTUDIO.arquivoBytes)
              throw new ErroStudoo('material_invalido');
            const x = await cliente.transcrever({
              nome: tipo.includes('mp4') ? 'explicacao.m4a' : 'explicacao.webm',
              tipo,
              base64: await lerBase64(blob),
            });
            if (vivo.current) {
              setTexto(x.texto);
              setAviso(m.vozRevisar);
            }
          });
        };
        rec.start();
        setEnsino(null);
        setAviso('');
        setSegundos(0);
        setGravando(true);
        const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduzido) {
          try {
            const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (Ctx) {
              const ctx = new Ctx();
              audioCtx.current = ctx;
              void ctx.resume().catch(() => undefined);
              const fonte = ctx.createMediaStreamSource(midia);
              const analisador = ctx.createAnalyser();
              analisador.fftSize = 32;
              fonte.connect(analisador);
              const dados = new Uint8Array(analisador.frequencyBinCount);
              const atualizar = () => {
                if (!vivo.current || !audioCtx.current) return;
                analisador.getByteFrequencyData(dados);
                const barras = ondasRef.current?.querySelectorAll<HTMLElement>('span');
                barras?.forEach((barra, i) => {
                  const escala = Math.max(0.28, Math.min(1, (dados[i] ?? 0) / 140));
                  barra.style.transform = `scaleY(${escala.toFixed(2)})`;
                });
                audioRaf.current = window.requestAnimationFrame(atualizar);
              };
              audioRaf.current = window.requestAnimationFrame(atualizar);
            }
          } catch {
            // Sem Web Audio: barras ficam estáticas.
          }
        }
      } catch {
        stream.current?.getTracks().forEach((t) => t.stop());
        // O aviso fica junto do botão Gravar, onde a pessoa está olhando.
        setAviso(m.vozErro);
      }
    });
  }
  const ponte = apoio?.ponte;
  function carregarPonte() {
    void executar(async () => atualizarApoio(await cliente.criarPonte(licao.id)));
  }
  useEffect(() => {
    if (pedidoPonte > 0 && !gravando) carregarPonte();
    // O pedido ou o fim da gravação inicia a leitura do reforço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoPonte, gravando]);
  useEffect(() => {
    if (pedidoPonte > 0 && ponte?.concluida) aoConcluirPonte?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoPonte, ponte?.concluida]);
  useEffect(() => {
    if (!aviso) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    avisoRef.current?.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
  }, [aviso]);
  // O retorno do "Ensine ao Stu" aparece embaixo do formulário: a tela rola até ele.
  useEffect(() => {
    if (!ensino) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    retornoDoEnsino.current?.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' });
  }, [ensino]);
  // "De onde veio esta ideia" (a citação do material): fica sob o exercício e, spec 16 item 27, também na ponte, depois do cartão do passo. Lição sem material não o mostra.
  const cartaoOrigem = !!licao.referencias?.length && (
    <details className="estudio-card">
      <summary>{m.origem}</summary>
      {licao.referencias.map((r, i) => (
        <blockquote key={i}>
          <strong>
            {r.nome} · {r.localizacao ?? m.pagina(r.pagina)}
          </strong>
          <p>{r.trecho}</p>
          {r.leitura === 'ocr' && <small>{m.ocr}</small>}
        </blockquote>
      ))}
    </details>
  );
  if (avaliacao?.correta === false && pedidoPonte > 0 && !gravando && etapaVoz !== 'ativa') {
    return (
      <div className="estudio-apoio">
        <PonteReforco key={pedidoPonte} ponte={ponte} tentativa={ultimaResposta} feedbackOriginal={avaliacao.feedback} origem={cartaoOrigem || undefined}
          ocupado={ocupado || gravando} erro={erro} voltar={aoVoltarExercicio} tentarCarregar={carregarPonte}
          verificar={async (resposta) => {
            let resultado;
            await executar(async () => {
              const r = await cliente.avaliarPonte(licao.id, resposta);
              resultado = { correta: r.correta, feedback: r.feedback };
              atualizarApoio(r.apoio);
            });
            return resultado;
          }} />
      </div>
    );
  }
  // Spec 16, item 25: o indicador de passos do "Explique" (a mesma conta do app).
  const passoDoEnsino = linhaDoPassoDoEnsino(
    passoAtivoDoEnsino({ gravando, vozAtiva: etapaVoz === 'ativa', temRetorno: Boolean(ensino), temTexto: Boolean(texto.trim()) }),
    [vozAoVivoDisponivel ? m.vozAoVivo.passoComVoz : m.ensinoEtapas[0], m.ensinoEtapas[1], m.ensinoEtapas[2]],
    m.ponteIndicador,
  );
  return (
    <div className="estudio-apoio">
      {cartaoOrigem}
      {ultimo && <details
        className="estudio-card estudio-ensino"
        open={ensinoDireto || undefined}
        onToggle={(e) => {
          aoAbrirExplique?.(e.currentTarget.open);
          if (e.currentTarget.open) {
            if (!ensinoDireto) garantirAcoesEnsinoVisiveis();
          } else {
            if (recorder.current?.state === 'recording') recorder.current.stop();
            controladorVozRef.current?.descartar();
            controladorVozRef.current = null;
            setEtapaVoz('inativa');
          }
        }}
      >
        <summary hidden={ensinoDireto}>{m.ensinar}</summary>
        <div
          className="ensino-stu"
          data-gravando={gravando || (etapaVoz === 'ativa' && estadoVoz.estado === 'ouvindo') || undefined}
          data-falando={etapaVoz === 'ativa' && estadoVoz.estado === 'stu_falando' ? 'true' : undefined}
        >
          {/* Ouvindo: concentrado; falando: animado (laço enquanto dura); anotou: encorajador; aluno: curioso, parado. */}
          {(() => {
            const ouvindo = gravando || (etapaVoz === 'ativa' && estadoVoz.estado === 'ouvindo');
            const falando = etapaVoz === 'ativa' && estadoVoz.estado === 'stu_falando';
            if (ouvindo) return <Stu expressao="stu-concentrado" tamanho={56} animado="laco" />;
            if (falando) return <Stu expressao="stu-animado" tamanho={56} animado="laco" />;
            if (ensino) return <Stu expressao="stu-encorajador" tamanho={56} animado="acontecimento" acontecimento="anotou" />;
            return <Stu expressao="stu-curioso" tamanho={56} />;
          })()}
          <p className="ensino-stu__balao">
            {etapaVoz === 'ativa'
              ? m.vozAoVivo.estados[estadoVoz.estado]
              : gravando
                ? m.ensinoStuOuvindo
                : ensino
                  ? m.ensinoStuAnotou
                  : m.ensinoStuAluno}
          </p>
        </div>
        {/* Spec 16, item 25: os três passos viram uma linha só de indicador, como a da ponte (não tocável); o leitor de tela ouve "Passo 1 de 3: Gravar ou escrever". */}
        <p className="ensino-indicador">
          <span aria-hidden="true">{passoDoEnsino.visivel}</span>
          <span className="somente-leitor">{passoDoEnsino.leitor}</span>
        </p>
        <p>{m.ensinoDica}</p>
        <TextoComFormulas como="p" className="estudio-legenda" texto={m.ensinoIdeia(licao.objetivo)} />
        {vozAoVivoDisponivel && etapaVoz === 'inativa' && (
          <div className="voz-ao-vivo-entrada">
            <div className="voz-ao-vivo-entrada__cabeca">
              <span className="voz-ao-vivo-entrada__icone" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="17" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </span>
              <span className="voz-ao-vivo-entrada__beneficio">{m.vozAoVivo.abrirBeneficio}</span>
            </div>
            <Botao
              variante="secundario"
              disabled={ocupado || gravando}
              onClick={() => {
                let visto = false;
                try {
                  visto = window.localStorage.getItem('studoo.vozAoVivo.avisoVisto') === '1';
                } catch { /* ignore */ }
                if (!visto) {
                  setEtapaVoz('privacidade');
                  return;
                }
                iniciarConversaAoVivo();
              }}
            >
              {m.vozAoVivo.abrir}
            </Botao>
            <p className="estudio-legenda voz-ao-vivo-nota">{m.vozAoVivo.notaPrivacidadePorProvedor(provedorTextoVoz)}</p>
          </div>
        )}
        {etapaVoz === 'privacidade' && (
          <div ref={painelPrivacidadeRef} className="voz-ao-vivo-painel voz-ao-vivo-privacidade" role="region" aria-label={m.vozAoVivo.privacidadeTitulo}>
            <h3 className="voz-ao-vivo-titulo">{m.vozAoVivo.privacidadeTitulo}</h3>
            <p className="voz-ao-vivo-texto">{m.vozAoVivo.privacidadeTextoPorProvedor(provedorTextoVoz)}</p>
            <div className="voz-ao-vivo-controles">
              <Botao
                variante="primario"
                onClick={() => {
                  try {
                    window.localStorage.setItem('studoo.vozAoVivo.avisoVisto', '1');
                  } catch { /* ignore */ }
                  iniciarConversaAoVivo();
                }}
              >
                {m.vozAoVivo.privacidadeAceitar}
              </Botao>
              <Botao
                variante="secundario"
                onClick={() => setEtapaVoz('inativa')}
              >
                {m.vozAoVivo.privacidadeCancelar}
              </Botao>
            </div>
          </div>
        )}
        {etapaVoz === 'ativa' && (
          <div ref={painelVozRef} className="voz-ao-vivo-painel" data-estado={estadoVoz.estado} data-aviso-tempo={estadoVoz.avisoTempo || undefined}>
            <p className="somente-leitor" aria-live="polite">{estadoVoz.anuncioSr}</p>
            <div className="voz-ao-vivo-cabeca">
              <span className="voz-ao-vivo-estado">
                {m.vozAoVivo.estados[estadoVoz.estado]}
              </span>
              <span className="voz-ao-vivo-tempo">
                {formatarTempoVoz(estadoVoz.segundos)} / {formatarTempoVoz(estadoVoz.limiteSegundos)}
              </span>
            </div>
            {!estadoVoz.avisoTempo && (estadoVoz.estado === 'ouvindo' || estadoVoz.estado === 'stu_falando') && (
              <p className="voz-ao-vivo-dica">
                {estadoVoz.estado === 'stu_falando' ? m.vozAoVivo.dicaInterromper : m.vozAoVivo.dicaOuvindo}
              </p>
            )}
            {(estadoVoz.estado === 'pedindo_mic' || estadoVoz.estado === 'conectando') && (
              <div className="voz-ao-vivo-progresso" aria-hidden="true"><span /></div>
            )}
            {estadoVoz.estado === 'ouvindo' && !estadoVoz.mudo && (
              <div ref={ondasVozRef} className="ensino-ondas voz-ao-vivo-ondas" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            )}
            {estadoVoz.avisoTempo && estadoVoz.estado !== 'erro' && (
              <p className="voz-ao-vivo-aviso" role="status">{m.vozAoVivo.avisoTempo}</p>
            )}
            {estadoVoz.estado === 'erro' && estadoVoz.erro ? (
              <p className="voz-ao-vivo-erro" role="alert">
                {textoErroVozAoVivo(estadoVoz.erro)}
              </p>
            ) : (
              <div
                ref={legendasVozRef}
                className="voz-ao-vivo-legendas"
                onScroll={() => {
                  const el = legendasVozRef.current;
                  if (!el) return;
                  usuarioRolouLegendasRef.current = el.scrollTop + el.clientHeight < el.scrollHeight - 24;
                }}
              >
                {estadoVoz.legendas.map((turno) => (
                  <p key={`${turno.autor}-${turno.id}`} className="voz-ao-vivo-turno" data-autor={turno.autor}>
                    <strong>{turno.autor === 'stu' ? m.vozAoVivo.stuDisse : m.vozAoVivo.voceDisse}:</strong>{' '}
                    <span>{turno.texto}</span>
                  </p>
                ))}
              </div>
            )}
            <div ref={controlesVozRef} className="voz-ao-vivo-controles">
              {estadoVoz.estado !== 'erro' && (
                <>
                  <Botao
                    variante="secundario"
                    disabled={estadoVoz.estado === 'pedindo_mic' || estadoVoz.estado === 'conectando' || estadoVoz.estado === 'encerrando'}
                    onClick={() => {
                      controladorVozRef.current?.alternarMudo();
                    }}
                  >
                    {estadoVoz.mudo ? m.vozAoVivo.ativarMic : m.vozAoVivo.mudo}
                  </Botao>
                  <Botao
                    variante="primario"
                    disabled={estadoVoz.estado === 'pedindo_mic' || estadoVoz.estado === 'conectando' || estadoVoz.estado === 'encerrando'}
                    onClick={() => {
                      const ctrl = controladorVozRef.current;
                      if (!ctrl) return;
                      void ctrl.encerrar().then(concluirComTranscricao);
                    }}
                  >
                    {m.vozAoVivo.encerrar}
                  </Botao>
                </>
              )}
              <Botao
                variante="texto"
                onClick={() => {
                  controladorVozRef.current?.descartar();
                  controladorVozRef.current = null;
                  setEtapaVoz('inativa');
                  window.requestAnimationFrame(() => campoEnsinoRef.current?.focus());
                }}
              >
                {m.vozAoVivo.alternativaTexto}
              </Botao>
            </div>
          </div>
        )}
        <label htmlFor="ensino-texto">{m.explicacao}</label>
        <textarea
          ref={campoEnsinoRef}
          id="ensino-texto"
          rows={5}
          maxLength={3000}
          value={texto}
          onFocus={garantirAcoesEnsinoVisiveis}
          onChange={(e) => setTexto(e.target.value)}
          disabled={ocupado || gravando || etapaVoz === 'ativa'}
        />
        <p className="estudio-legenda">
          {m.vozDica}
          {provedorGravacao && ` ${m.vozProvedorPorProvedor(provedorGravacao)}`}
        </p>
        <div ref={acoesEnsinoRef} className="estudio-acoes">
          <Botao
            variante="secundario"
            disabled={ocupado || etapaVoz === 'ativa'}
            onClick={() =>
              gravando ? recorder.current?.stop() : void gravar()
            }
          >
            {gravando ? m.parar : m.gravar}
          </Botao>
          {gravando && (
            <div className="ensino-gravando" role="status">
              <div className="ensino-ondas" ref={ondasRef} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <span>{m.gravando} {segundos}/60 s</span>
            </div>
          )}
          <Botao
            disabled={ocupado || gravando || etapaVoz === 'ativa' || texto.trim().length < 20}
            aria-busy={ocupado || undefined}
            onClick={() =>
              void executar(async () => {
                const r = await cliente.ensinarStu(licao.id, texto);
                atualizarApoio((a) => ({
                  ...(a ?? { erros: 0, ponte: null }),
                  ensino: r,
                }));
                setEnsino(r);
                setAviso('');
                aoEnsinar?.();
              })
            }
          >
            {ocupado ? m.pensando : m.enviar}
          </Botao>
        </div>
        {aviso && <p role="status" ref={avisoRef}>{aviso}</p>}
        {ensino && (
          <div className="estudio-feedback ensino-caderno" role="status" ref={retornoDoEnsino}>
            <div className="ensino-caderno__cartao" data-tipo="acertos">
              <h2>{m.acertos}</h2>
              <ul>
                {ensino.acertos.map((x, i) => (
                  <li key={i}><span className="ensino-caderno__visto" aria-hidden="true">✓</span><span>{x}</span></li>
                ))}
              </ul>
            </div>
            <div className="ensino-caderno__cartao" data-tipo="lacuna">
              <h2>{m.lacuna}</h2>
              <p>{ensino.lacuna}</p>
            </div>
            <div className="ensino-caderno__cartao ensino-caderno__pergunta" data-tipo="pergunta">
              <div className="ensino-caderno__stu" aria-hidden="true">
                <Stu expressao="stu-concentrado" tamanho={48} />
                <span className="ensino-caderno__duvida">?</span>
              </div>
              <div>
                <h2>{m.pergunta}</h2>
                <p>{ensino.pergunta}</p>
              </div>
            </div>
            <div className="ensino-caderno__cartao" data-tipo="proximo">
              <h2>{m.proximo}</h2>
              <p>{ensino.proximoPasso}</p>
            </div>
            {/* Sem a IA, o retorno confere as ideias-chave da lição: a nota fica no pé, como legenda. */}
            {ensino.simulado && <p className="estudio-legenda">{m.ensinoAutomatico}</p>}
          </div>
        )}
      </details>}
      {ocupado && <p role="status">{m.pensando}</p>}
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
