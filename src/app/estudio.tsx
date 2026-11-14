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
}: {
  objetivo: string;
  onProposta: (p: PropostaPlano) => void;
}) {
  const [material, setMaterial] = useState<MaterialEstudo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [erro, setErro] = useState('');
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
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
      aria-labelledby="material-titulo"
      aria-busy={ocupado}
    >
      <div className="estudio-cabeca">
        <Stu />
        <div>
          <h2 id="material-titulo">{mensagens.inicio.materialTitulo}</h2>
          <p>{mensagens.inicio.materialTexto}</p>
        </div>
      </div>
      <p className="estudio-legenda">{mensagens.inicio.enviarSeguro}</p>
      <details><summary>{mensagens.inicio.detalhes}</summary><p className="estudio-legenda">{m.limites}</p><p className="estudio-legenda">{m.privacidade}</p></details>
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
          {material.paginas.map((p) => (
            <details key={p.numero}>
              <summary>{p.rotulo ?? m.pagina(p.numero)}</summary>
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
                      {p.tabela.map((linha, i) => (
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
                <p className="estudio-transcricao">{p.texto}</p>
              )}
            </details>
          ))}
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
}: {
  licao: LicaoDetalhe;
  avaliacao: Avaliacao | null;
}) {
  const [apoio, setApoio] = useState<ApoioEstudo | null>(null);
  const revisaoApoio = useRef(0);
  function atualizarApoio(valor: Parameters<typeof setApoio>[0]) {
    revisaoApoio.current += 1;
    setApoio(valor);
  }
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const vivo = useRef(true);
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
      } catch {
        stream.current?.getTracks().forEach((t) => t.stop());
        throw new ErroStudoo('voz_indisponivel');
      }
    });
  }
  const ponte = apoio?.ponte;
  const ensino = apoio?.ensino;
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
      {((apoio && apoio.erros > 0) || avaliacao?.correta === false) && (
        <section className="estudio-card estudio-ponte">
          <div className="ponte-desenho" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <h2>{ponte?.concluida ? m.pontePronta : m.ponte}</h2>
          <p>{ponte?.motivo ?? m.ponteDica}</p>
          {!ponte ? (
            <Botao
              disabled={ocupado || gravando}
              onClick={() =>
                void executar(async () =>
                  atualizarApoio(await cliente.criarPonte(licao.id)),
                )
              }
            >
              {m.construir}
            </Botao>
          ) : (
            <>
              {ponte.simulado && <p className="estudio-selo">{m.simulado}</p>}
              <p>{ponte.conceito}</p>
              <div className="estudio-exemplo">{ponte.exemplo}</div>
              <fieldset disabled={ocupado || gravando || ponte.concluida}>
                <legend>{ponte.exercicio.enunciado}</legend>
                {ponte.exercicio.tipo !== 'lacuna' &&
                  ponte.exercicio.opcoes.map((o) => (
                    <label className="estudio-opcao" key={o.id}>
                      <input
                        type="radio"
                        name="reforco"
                        checked={resposta === o.id}
                        onChange={() => setResposta(o.id)}
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
                      setFeedback(r.feedback);
                    })
                  }
                >
                  {m.verificar}
                </Botao>
              )}
              <p role="status">{feedback}</p>
              {ponte.concluida && <p>{m.ponteVoltar}</p>}
            </>
          )}
        </section>
      )}
      <details
        className="estudio-card"
        onToggle={(e) => {
          if (!e.currentTarget.open && recorder.current?.state === 'recording')
            recorder.current.stop();
        }}
      >
        <summary>{m.ensinar}</summary>
        <p>{m.ensinoDica}</p>
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
              })
            }
          >
            {m.enviar}
          </Botao>
        </div>
        {gravando && (
          <p role="status">
            {m.gravando} {segundos}/60 s
          </p>
        )}
        {aviso && <p role="status">{aviso}</p>}
        {ensino && (
          <div className="estudio-feedback" role="status">
            {ensino.simulado && <p className="estudio-selo">{m.simulado}</p>}
            <h3>{m.acertos}</h3>
            <ul>
              {ensino.acertos.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
            <h3>{m.lacuna}</h3>
            <p>{ensino.lacuna}</p>
            <h3>{m.pergunta}</h3>
            <p>{ensino.pergunta}</p>
            <h3>{m.proximo}</h3>
            <p>{ensino.proximoPasso}</p>
          </div>
        )}
      </details>
      {ocupado && <p role="status">{m.pensando}</p>}
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
