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
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Stu } from '../ui';
import './estudio.css';
const m = mensagens.estudio;
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
}: {
  objetivo: string;
  onProposta: (p: PropostaPlano) => void;
  mostrarCabeca?: boolean;
}) {
  const [material, setMaterial] = useState<MaterialEstudo | null>(null);
  const [provedorIa, setProvedorIa] = useState<ProvedorIa>('falsa');
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [erro, setErro] = useState('');
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    void cliente.configuracaoAcesso().then((cfg) => {
      if (vivo.current) setProvedorIa(cfg.ia);
    }).catch(() => undefined);
    return () => {
      vivo.current = false;
    };
  }, []);
  async function executar(tarefa: () => Promise<void>) {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setOcupado(true);
    setErro('');
    try {
      await tarefa();
    } catch (e) {
      if (vivo.current) setErro(erroTexto(e));
    } finally {
      emExecucao.current = false;
      if (vivo.current) setOcupado(false);
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
    });
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
          <Stu />
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
          <label className="estudio-arquivo">
            {mensagens.inicio.arquivo}
            <input
              type="file"
              accept=".pdf,.docx,.csv,image/jpeg,image/png,image/webp"
              disabled={ocupado}
              onChange={(e) => {
                void selecionar(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <label className="estudio-arquivo">
            {mensagens.inicio.camera}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={ocupado}
              onChange={(e) => {
                void selecionar(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <Botao
            variante="secundario"
            disabled={ocupado}
            onClick={() =>
              void executar(async () => {
                const x = await cliente.materialDemo();
                if (vivo.current) setMaterial(x);
              })
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
          <div className="estudio-acoes">
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
  ultimaResposta = '',
  aoConcluirPonte,
  aoEnsinar,
  aoAbrirExplique,
}: {
  licao: LicaoDetalhe;
  avaliacao: Avaliacao | null;
  /** Cada vez que muda, o reforço é pedido (o "Ver outro jeito de entender" do painel de retorno) e o cartão aparece. */
  pedidoPonte?: number;
  /** Último exercício da lição: só nele aparece o "Ensine ao Stu", quando a pessoa já viu a lição toda. */
  ultimo?: boolean;
  /** Resposta que gerou o erro, exibida na 1ª tábua da ponte. */
  ultimaResposta?: string;
  /** A pessoa acertou a pergunta do reforço: a lição troca o "Quase lá!" do painel pelo convite a tentar de novo. */
  aoConcluirPonte?: () => void;
  /** A explicação foi enviada: a lição tira o convite para explicar. */
  aoEnsinar?: () => void;
  /** O "Explique" abriu ou fechou: a lição deixa o rodapé só com as ações enquanto ele está aberto. */
  aoAbrirExplique?: (aberto: boolean) => void;
}) {
  const [apoio, setApoio] = useState<ApoioEstudo | null>(null);
  // O retorno do "Ensine ao Stu" é o desta visita: o guardado de outra vez não volta com o campo vazio.
  const [ensino, setEnsino] = useState<ApoioEstudo['ensino']>(null);
  const cartaoPonte = useRef<HTMLElement>(null);
  const retornoDoEnsino = useRef<HTMLDivElement>(null);
  // O aviso do microfone (ou da transcrição) aparece junto do botão Gravar, no pé da página: a tela leva até ele.
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const revisaoApoio = useRef(0);
  function atualizarApoio(valor: Parameters<typeof setApoio>[0]) {
    revisaoApoio.current += 1;
    setApoio(valor);
  }
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');
  /** O resultado da pergunta do reforço, para a opção marcada ficar verde (certa) ou âmbar (errada). */
  const [resultadoPonte, setResultadoPonte] = useState<{ id: string; correta: boolean } | null>(null);
  const retornoPonte = useRef<HTMLParagraphElement>(null);
  // O "Isso! Você pegou a ideia." aparece no fim do cartão, às vezes atrás do painel de retorno: a tela leva até ele.
  useEffect(() => {
    if (!feedback) return;
    window.requestAnimationFrame(() => {
      const alvo = retornoPonte.current;
      if (!alvo) return;
      const rodape = document.querySelector<HTMLElement>('.aula-rodape')?.getBoundingClientRect().height ?? 0;
      const sobra = alvo.getBoundingClientRect().bottom - (window.innerHeight - rodape - 16);
      const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (sobra > 0) window.scrollBy({ top: sobra, behavior: reduzido ? 'auto' : 'smooth' });
    });
  }, [feedback]);
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
        if (ativo && revisao === revisaoApoio.current) setErro(erroTexto(e));
      });
    return () => {
      ativo = false;
    };
  }, [licao.id, avaliacao]);
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
      if (vivo.current) setErro(erroTexto(e));
    } finally {
      emExecucao.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  async function gravar() {
    await executar(async () => {
      try {
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
                  const escala = Math.max(0.2, Math.min(1, (dados[i] ?? 0) / 160));
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
  // "Ver outro exemplo" no painel de retorno: pede o reforço, se ainda não existe (durante uma gravação, espera ela acabar).
  useEffect(() => {
    if (pedidoPonte === 0 || gravando) return;
    void executar(async () => atualizarApoio(await cliente.criarPonte(licao.id)));
    // Só o pedido e o fim da gravação disparam; o resto é lido no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoPonte, gravando]);
  // ... e leva ao alto do cartão, acima do painel de retorno. Rola de novo quando o reforço chega: antes, a página ainda
  // é curta e a rolagem para no meio do caminho.
  const pontePronta = Boolean(ponte);
  const ponteConcluida = ponte?.concluida === true;
  useEffect(() => {
    if (ponteConcluida && pedidoPonte > 0) aoConcluirPonte?.();
    // Só a conclusão do reforço dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ponteConcluida]);
  useEffect(() => {
    if (pedidoPonte === 0) return;
    const quadro = window.requestAnimationFrame(() => {
      const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cartaoPonte.current?.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' });
      cartaoPonte.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(quadro);
    // Só o pedido e a chegada do reforço disparam; o resto é lido no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoPonte, pontePronta]);
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
  return (
    <div className="estudio-apoio">
      {!!licao.referencias?.length && (
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
      )}
      {/* O reforço é do exercício que a pessoa acabou de errar (ou de um reforço começado e não terminado): não fica
          sobrando em outros exercícios nem em outra visita à lição. */}
      {avaliacao?.correta === false && pedidoPonte > 0 && (
        <section className="estudio-card estudio-ponte" ref={cartaoPonte}>
          <div className="ponte-cabeca">
            <h2 tabIndex={-1}>{ponte?.concluida ? m.pontePronta : m.ponte}</h2>
            {ponte?.simulado && <p className="estudio-selo">{m.retornoAutomatico}</p>}
          </div>
          <div className="ponte-cena" data-concluida={ponte?.concluida || undefined} aria-hidden="true">
            <div className="ponte-margem ponte-margem--esquerda">
              <div className="ponte-stu" data-atravessou={ponte?.concluida || undefined}>
                <Stu />
              </div>
              <span>{m.ponteMargemErro}</span>
            </div>
            <div className="ponte-vao">
              <span className="ponte-tabua" data-ativa="true" data-erro="true">
                {ultimaResposta ? m.pontePassoErro(ultimaResposta.slice(0, 24)) : m.ponteMargemErro}
              </span>
              <span className="ponte-tabua" data-ativa={Boolean(ponte) || undefined}>
                {m.pontePassoExplicacao}
              </span>
              <span className="ponte-tabua" data-ativa={Boolean(ponte) || undefined}>
                {m.pontePassoExemplo}
              </span>
              <span className="ponte-tabua" data-ativa={Boolean(ponte?.concluida || resposta) || undefined}>
                {m.pontePassoDesafio}
              </span>
            </div>
            <div className="ponte-margem ponte-margem--direita">
              <span>{m.ponteMargemVolta}</span>
            </div>
          </div>
          <p>{ponte?.motivo ?? m.ponteDica}</p>
          {!ponte ? (
            <p role="status">{erro || m.pensando}</p>
          ) : (
            <>
              {/* A explicação do erro já está no painel de retorno: aqui só aparece se for outra. */}
              {ponte.conceito !== avaliacao?.feedback && <p>{ponte.conceito}</p>}
              <div className="estudio-exemplo">{ponte.exemplo}</div>
              <fieldset disabled={ocupado || gravando || ponte.concluida}>
                <legend>{ponte.exercicio.enunciado}</legend>
                {ponte.exercicio.tipo === 'multipla_escolha' &&
                  ponte.exercicio.opcoes.map((o) => (
                    <label className="estudio-opcao" key={o.id}
                      data-estado={resultadoPonte?.id === o.id ? (resultadoPonte.correta ? 'certa' : 'errada') : undefined}>
                      <input
                        type="radio"
                        name="reforco"
                        checked={resposta === o.id}
                        onChange={() => {
                          setResposta(o.id);
                          // Outra escolha depois de um erro: o retorno anterior sai, para não parecer que é desta.
                          setResultadoPonte(null);
                          setFeedback('');
                          // O "Conferir" fica embaixo das opções, às vezes atrás do painel: a tela leva até ele.
                          window.requestAnimationFrame(() => {
                            const botao = cartaoPonte.current?.querySelector<HTMLElement>('.botao');
                            const rodape = document.querySelector<HTMLElement>('.aula-rodape')?.getBoundingClientRect().height ?? 0;
                            if (!botao) return;
                            const sobra = botao.getBoundingClientRect().bottom - (window.innerHeight - rodape - 16);
                            if (sobra > 0) window.scrollBy({ top: sobra, behavior: 'smooth' });
                          });
                        }}
                      />
                      {o.texto}
                    </label>
                  ))}
              </fieldset>
              {!ponte.concluida && (
                <Botao
                  disabled={ocupado || gravando || !resposta}
                  onClick={() =>
                    void executar(async () => {
                      const r = await cliente.avaliarPonte(licao.id, resposta);
                      atualizarApoio(r.apoio);
                      setResultadoPonte({ id: resposta, correta: r.correta });
                      setFeedback(r.feedback);
                    })
                  }
                >
                  {m.verificar}
                </Botao>
              )}
              <p role="status" ref={retornoPonte} className="estudio-retorno-ponte"
                data-estado={resultadoPonte && feedback ? (resultadoPonte.correta ? 'certa' : 'errada') : undefined}>{feedback}</p>
              {/* O "tente de novo" já está no painel de retorno: aqui não repete. */}
            </>
          )}
        </section>
      )}
      {ultimo && <details
        className="estudio-card estudio-ensino"
        onToggle={(e) => {
          aoAbrirExplique?.(e.currentTarget.open);
          if (!e.currentTarget.open && recorder.current?.state === 'recording')
            recorder.current.stop();
        }}
      >
        <summary>{m.ensinar}</summary>
        <div className="ensino-stu" data-gravando={gravando || undefined}>
          <Stu />
          <p className="ensino-stu__balao">
            {gravando
              ? m.ensinoStuOuvindo
              : ensino
                ? m.ensinoStuAnotou
                : m.ensinoStuAluno}
          </p>
        </div>
        <ol className="ensino-passos" aria-label={m.ensinoEtapasLabel}>
          <li data-ativo={!texto.trim() || gravando || undefined}>{m.ensinoEtapas[0]}</li>
          <li data-ativo={(Boolean(texto.trim()) && !gravando && !ensino) || undefined}>{m.ensinoEtapas[1]}</li>
          <li data-ativo={Boolean(ensino) || undefined}>{m.ensinoEtapas[2]}</li>
        </ol>
        <p>{m.ensinoDica}</p>
        <p className="estudio-legenda">{m.ensinoIdeia(licao.objetivo)}</p>
        <label htmlFor="ensino-texto">{m.explicacao}</label>
        <textarea
          id="ensino-texto"
          rows={5}
          maxLength={3000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={ocupado || gravando}
        />
        <p className="estudio-legenda">{m.vozDica}</p>
        <div className="estudio-acoes">
          <Botao
            variante="secundario"
            disabled={ocupado}
            onClick={() =>
              gravando ? recorder.current?.stop() : void gravar()
            }
          >
            {gravando ? m.parar : m.gravar}
          </Botao>
          <Botao
            disabled={ocupado || gravando || texto.trim().length < 20}
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
            {m.enviar}
          </Botao>
        </div>
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
        {aviso && <p role="status" ref={avisoRef}>{aviso}</p>}
        {ensino && (
          <div className="estudio-feedback ensino-caderno" role="status" ref={retornoDoEnsino}>
            <div className="ensino-caderno__cartao" data-tipo="acertos">
              <h3>{m.acertos}</h3>
              <ul>
                {ensino.acertos.map((x, i) => (
                  <li key={i}><span className="ensino-caderno__visto" aria-hidden="true">✓</span><span>{x}</span></li>
                ))}
              </ul>
            </div>
            <div className="ensino-caderno__cartao" data-tipo="lacuna">
              <h3>{m.lacuna}</h3>
              <p>{ensino.lacuna}</p>
            </div>
            <div className="ensino-caderno__cartao ensino-caderno__pergunta" data-tipo="pergunta">
              <div className="ensino-caderno__stu" aria-hidden="true">
                <Stu />
                <span className="ensino-caderno__duvida">?</span>
              </div>
              <div>
                <h3>{m.pergunta}</h3>
                <p>{ensino.pergunta}</p>
              </div>
            </div>
            <div className="ensino-caderno__cartao" data-tipo="proximo">
              <h3>{m.proximo}</h3>
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
