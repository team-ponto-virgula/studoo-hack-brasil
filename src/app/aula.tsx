'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type Ref } from 'react';
import {
  AUTOAVALIACOES,
  codificarResposta,
  etapasDaLicao,
  exerciciosDaLicao,
  linhasDePassos,
  partesDaLacuna,
  respostaCompleta,
  semAspas,
  sintetizarAcorde,
  type AutoAvaliacao,
  type Avaliacao,
  type EtapaAula,
  type ExercicioPublico,
  type Fala,
  type LicaoDetalhe,
  type Opcao,
  type Pratica,
  type Recurso,
  type TipoTrecho,
} from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Confete, Icone, Stu, type NomeIcone } from '../ui';
import { ApoioDaLicao } from './estudio';

const t = mensagens.licao;

/** O que a pessoa fez na lição, para o resumo da conclusão. */
export type ResumoLicao = { segundos: number; tentativas: number; dePrimeira: boolean; etapas: number; pratica?: AutoAvaliacao };

const iconesDaEtapa: Record<EtapaAula['tipo'], NomeIcone> = { conceito: 'livro', exemplo: 'lampada', exercicio: 'alvo', pratica: 'relogio' };

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo). */
function tituloDoAcerto(id: string) {
  let soma = 0;
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) >>> 0;
  return t.certas[soma % t.certas.length];
}

/** Minutos e segundos, como 1:05. */
export function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Aula por etapas (spec 02), com o número de etapas de cada lição: conceito, exemplo (ou demonstração, com recurso,
 * passos e frases para ouvir), de um a três exercícios de formatos variados e, quando a lição pede, a prática no mundo
 * real com cronômetro. A barra no topo mostra o andamento. Depois da resposta, o rodapé vira o painel de retorno, verde
 * no acerto (com confete) ou âmbar no erro (o exercício treme), e dá para tentar de novo. Continuar segue para a próxima
 * etapa; na última, registra a conclusão. O título de cada etapa e o do retorno recebem o foco.
 */
export function Licao({ licao, pendente, avaliar, concluir, voltar }: {
  licao: LicaoDetalhe;
  pendente: string | null;
  avaliar: (resposta: string, indice: number) => Promise<Avaliacao | null>;
  concluir: (comprovante: string, resumo: ResumoLicao, pratica?: AutoAvaliacao) => Promise<boolean>;
  voltar: () => void;
}) {
  const etapas = useMemo(() => etapasDaLicao(licao), [licao]);
  const exercicios = useMemo(() => exerciciosDaLicao(licao), [licao]);
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<string[]>(() => exercicios.map(() => ''));
  const [avaliacoes, setAvaliacoes] = useState<(Avaliacao | null)[]>(() => exercicios.map(() => null));
  const [primeiras, setPrimeiras] = useState<(boolean | null)[]>(() => exercicios.map(() => null));
  const [tentativas, setTentativas] = useState(0);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [autoAvaliacao, setAutoAvaliacao] = useState<AutoAvaliacao | null>(null);
  const [inicio] = useState(() => Date.now());
  const tituloEtapa = useRef<HTMLHeadingElement>(null);
  const tituloRetorno = useRef<HTMLHeadingElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const continuarAgora = useRef<() => void>(() => undefined);

  const etapa = etapas[passo];
  const indice = etapa.tipo === 'exercicio' ? etapa.indice : -1;
  const exercicio = indice >= 0 ? exercicios[indice] : null;
  const resposta = indice >= 0 ? respostas[indice] : '';
  const avaliacao = indice >= 0 ? avaliacoes[indice] : null;
  const ocupado = pendente !== null;
  const total = etapas.length;
  const ultima = passo === total - 1;
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : undefined;
  const andamento = t.posicao(passo + 1, total);
  let nomeEtapa: string = t.conceito;
  if (etapa.tipo === 'exemplo') nomeEtapa = licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo;
  else if (etapa.tipo === 'pratica') nomeEtapa = t.pratica.etapa;
  else if (etapa.tipo === 'exercicio') nomeEtapa = exercicios.length > 1 ? t.exercicioDe(indice + 1, exercicios.length) : t.exercicio;

  useEffect(() => {
    if (passo > 0) tituloEtapa.current?.focus();
  }, [passo]);

  useEffect(() => {
    if (avaliacao) tituloRetorno.current?.focus();
  }, [avaliacao]);

  // A voz para quando a pessoa sai da aula.
  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // Atalhos: no exercício de escolha, 1, 2, 3… marcam a opção; depois do retorno, Enter continua.
  useEffect(() => {
    function teclas(evento: KeyboardEvent) {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const alvo = evento.target instanceof HTMLElement ? evento.target : null;
      if (alvo?.closest('.estudio-apoio')) return;
      if (avaliacao) {
        if (evento.key === 'Enter' && !alvo?.closest('button, a, textarea')) {
          evento.preventDefault();
          continuarAgora.current();
        }
        return;
      }
      if (exercicio?.tipo !== 'multipla_escolha' || alvo?.matches('input[type="text"], textarea')) return;
      const numero = Number.parseInt(evento.key, 10) - 1;
      if (numero >= 0 && numero < exercicio.opcoes.length) {
        evento.preventDefault();
        mudarResposta(exercicio.opcoes[numero].id);
      }
    }
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  function mudarResposta(valor: string) {
    setRespostas((atuais) => atuais.map((atual, posicao) => (posicao === indice ? valor : atual)));
  }

  async function responder(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || !exercicio || avaliacao || !respostaCompleta(exercicio, resposta)) return;
    const resultado = await avaliar(resposta, indice);
    if (!resultado) return;
    setTentativas((soma) => soma + 1);
    setPrimeiras((atuais) => atuais.map((atual, posicao) => (posicao === indice ? atual ?? resultado.correta : atual)));
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? resultado : atual)));
    setComprovante(resultado.comprovante);
  }

  function tentarDeNovo() {
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? null : atual)));
    mudarResposta('');
    window.requestAnimationFrame(() => {
      formulario.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button')?.focus();
    });
  }

  async function avancar() {
    if (ocupado) return;
    if (!ultima) {
      setPasso((atual) => atual + 1);
      return;
    }
    if (!comprovante) return;
    const resumo: ResumoLicao = {
      segundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
      tentativas,
      dePrimeira: primeiras.every((primeira) => primeira === true),
      etapas: total,
      ...(autoAvaliacao ? { pratica: autoAvaliacao } : {}),
    };
    if (await concluir(comprovante, resumo, autoAvaliacao ?? undefined)) return;
    // A confirmação expirou: a aula volta ao último exercício para a pessoa responder de novo.
    const ultimoExercicio = etapas.findLastIndex((item) => item.tipo === 'exercicio');
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === exercicios.length - 1 ? null : atual)));
    setPasso(ultimoExercicio);
  }

  continuarAgora.current = () => {
    if (avaliacao) void avancar();
  };

  let acao: ReactNode;
  if (etapa.tipo === 'exercicio' && avaliacao) {
    acao = (
      <Botao variante={avaliacao.correta ? 'sucesso' : 'texto'} disabled={ocupado} onClick={() => void avancar()}>
        {pendente === 'concluir' ? t.concluindo : t.continuar}
      </Botao>
    );
  } else if (exercicio) {
    acao = (
      <Botao type="submit" form="resposta-licao" disabled={ocupado || !respostaCompleta(exercicio, resposta)}>
        {pendente === 'avaliar' ? t.avaliando : t.avaliar}
      </Botao>
    );
  } else if (etapa.tipo === 'pratica') {
    acao = (
      <Botao variante="sucesso" disabled={ocupado || !autoAvaliacao} onClick={() => void avancar()}>
        {pendente === 'concluir' ? t.concluindo : t.pratica.concluir}
      </Botao>
    );
  } else {
    acao = <Botao disabled={ocupado} onClick={() => setPasso((atual) => atual + 1)}>{t.seguir}<Icone nome="seta" /></Botao>;
  }

  return (
    <article className="painel painel--aula" data-retorno={retorno}>
      <header className="aula-topo">
        <button type="button" className="aula-fechar" aria-label={t.voltar} disabled={ocupado} onClick={voltar}>
          <Icone nome="fechar" />
        </button>
        <div className="aula-andamento">
          <div className="aula-barra" role="progressbar" aria-label={andamento} aria-valuemin={0} aria-valuemax={total} aria-valuenow={passo + 1}>
            <span className="aula-barra__preenchimento"
              style={{ '--progresso': (avaliacao?.correta ? passo + 1 : passo + 0.5) / total } as CSSProperties} />
          </div>
          <span className="aula-posicao" aria-hidden="true">{andamento}</span>
        </div>
      </header>
      <div className="aula-miolo" key={passo}>
        <p className="aula-etapa" data-etapa={etapa.tipo}><Icone nome={iconesDaEtapa[etapa.tipo]} />{nomeEtapa}</p>
        <h1 tabIndex={-1}>{licao.titulo}</h1>
        {etapa.tipo === 'conceito' && (
          <>
            {licao.concluida && <p className="aula-revisao"><Icone nome="check" />{mensagens.trilha.revisitando}</p>}
            <p className="introducao">{licao.objetivo}</p>
            <div className="aula-explicacao">
              <Stu />
              <section className="aula-balao" aria-labelledby="etapa-aula">
                <h2 id="etapa-aula">{t.conceito}</h2>
                <p>{licao.conceito}</p>
                <p className="licao-origem">{t.origem} · {licao.origem}</p>
              </section>
            </div>
          </>
        )}
        {etapa.tipo === 'exemplo' && <EtapaExemplo licao={licao} titulo={tituloEtapa} />}
        {exercicio && (
          <EtapaExercicio exercicio={exercicio} indice={indice} total={exercicios.length} resposta={resposta} mudar={mudarResposta}
            avaliacao={avaliacao} ocupado={ocupado} responder={responder} formulario={formulario} titulo={tituloEtapa} />
        )}
        {etapa.tipo === 'pratica' && licao.pratica && (
          <EtapaPratica pratica={licao.pratica} titulo={tituloEtapa} escolha={autoAvaliacao} escolher={setAutoAvaliacao} />
        )}
      </div>
      {exercicio && <ApoioDaLicao licao={licao} avaliacao={avaliacao} />}
      <footer className="aula-rodape" data-retorno={retorno}>
        <div className="aula-rodape__conteudo">
          {avaliacao && (
            <section className="aula-retorno" aria-labelledby="aula-retorno-titulo">
              <span className="aula-retorno__icone" aria-hidden="true">
                <Icone nome={avaliacao.correta ? 'check' : 'fechar'} />
                {avaliacao.correta && <Confete quantidade={14} />}
              </span>
              <div>
                <h2 id="aula-retorno-titulo" ref={tituloRetorno} tabIndex={-1}>
                  {avaliacao.correta ? tituloDoAcerto(`${licao.id}-${indice}`) : t.errada}
                  <span className="somente-leitor"> {avaliacao.correta ? t.correta : t.incorreta}.</span>
                </h2>
                <p>{avaliacao.feedback}</p>
                {avaliacao.observacao && <p className="aula-retorno__observacao">{avaliacao.observacao}</p>}
                {!avaliacao.correta && avaliacao.certos && exercicio && (exercicio.tipo === 'ordenar' || exercicio.tipo === 'associar') && (
                  <p className="aula-retorno__observacao">
                    {exercicio.tipo === 'ordenar'
                      ? t.ordenar.certos(avaliacao.certos.length, exercicio.itens.length)
                      : t.associar.certos(avaliacao.certos.length, exercicio.esquerda.length)}
                  </p>
                )}
                {!avaliacao.correta && (
                  <span className="aula-retorno__link">
                    <Botao variante="texto" disabled={ocupado} onClick={() => {
                      const alvo = document.querySelector<HTMLElement>('.estudio-ponte');
                      alvo?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
                      alvo?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
                    }}>{mensagens.estudio.verPonte}</Botao>
                  </span>
                )}
              </div>
            </section>
          )}
          {etapa.tipo === 'pratica' && !autoAvaliacao && <p className="aula-rodape__nota">{t.pratica.escolha}</p>}
          <div className="aula-rodape__acoes">
            {avaliacao && !avaliacao.correta && <Botao disabled={ocupado} onClick={tentarDeNovo}>{t.tentarDeNovo}</Botao>}
            {acao}
          </div>
        </div>
      </footer>
    </article>
  );
}

/** Exemplo resolvido ou demonstração: o texto, o recurso (acorde, linha do tempo, foto), os passos e as frases para ouvir. */
function EtapaExemplo({ licao, titulo }: { licao: LicaoDetalhe; titulo: Ref<HTMLHeadingElement> }) {
  return (
    <section className="aula-quadro" data-etapa="exemplo" aria-labelledby="etapa-aula">
      <h2 id="etapa-aula" ref={titulo} tabIndex={-1}>{licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo}</h2>
      <p>{licao.exemplo}</p>
      {licao.recurso && <RecursoDaLicao recurso={licao.recurso} />}
      {licao.passos && (
        <section className="aula-passos" aria-labelledby="aula-passos-titulo">
          <h3 id="aula-passos-titulo">{t.recursos.passos}</h3>
          <ol>
            {licao.passos.map((passo, posicao) => (
              <li key={posicao}><span className="aula-passos__numero" aria-hidden="true">{posicao + 1}</span><span>{passo}</span></li>
            ))}
          </ol>
        </section>
      )}
      {licao.falas && <Falas falas={licao.falas} />}
    </section>
  );
}

function RecursoDaLicao({ recurso }: { recurso: Recurso }) {
  if (recurso.tipo === 'acorde') return <DiagramaAcorde recurso={recurso} />;
  if (recurso.tipo === 'fracao') {
    const descricao = t.recursos.fracaoDescricao(recurso.numerador, recurso.denominador);
    return (
      <figure className="fracao">
        <div className="fracao__barra" role="img" aria-label={`${recurso.numerador}/${recurso.denominador}: ${descricao}`}
          style={{ '--partes': recurso.denominador } as CSSProperties}>
          {Array.from({ length: recurso.denominador }, (_, posicao) => (
            <span key={posicao} data-cheia={posicao < recurso.numerador || undefined} />
          ))}
        </div>
        <figcaption>
          <strong>{recurso.rotulo ?? `${recurso.numerador}/${recurso.denominador}`}</strong>
          <span>{descricao}</span>
        </figcaption>
      </figure>
    );
  }
  if (recurso.tipo === 'linha_do_tempo') {
    return (
      <section className="linha-tempo" aria-labelledby="linha-tempo-titulo">
        <h3 id="linha-tempo-titulo">{t.recursos.linhaDoTempo}</h3>
        <ol>
          {recurso.eventos.map((evento, posicao) => (
            <li key={posicao}>
              <span className="linha-tempo__quando">{evento.quando}</span>
              <span className="linha-tempo__texto">{evento.texto}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <figure className="recurso-imagem">
      {/* A foto vem do próprio material da pessoa, como data URL: não passa pelo otimizador de imagens. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={recurso.src} alt={`${t.recursos.doMaterial}: ${recurso.descricao}`} />
      <figcaption><strong>{t.recursos.doMaterial}</strong> · {recurso.descricao}</figcaption>
    </figure>
  );
}

/**
 * Diagrama do acorde desenhado em SVG (cordas, trastes, dedos, X e O) e o som do acorde, sintetizado na hora (Karplus-
 * Strong, o mesmo código do app). O leitor de tela ouve a posição de cada corda.
 */
function DiagramaAcorde({ recurso }: { recurso: Extract<Recurso, { tipo: 'acorde' }> }) {
  const [tocando, setTocando] = useState(false);
  const endereco = useRef<string | null>(null);
  const tocadas = recurso.casas.filter((casa) => casa > 0);
  const base = Math.max(0, ...tocadas) > 4 ? Math.min(...tocadas) : 1;
  const x = (corda: number) => 30 + corda * 26;
  const y = (casa: number) => 48 + (casa - base + 0.5) * 34;
  const descricao = recurso.casas
    .map((casa, corda) => t.recursos.corda(6 - corda, casa, t.recursos.dedos[recurso.dedos?.[corda] ?? 0] ?? ''))
    .join('; ');

  useEffect(() => () => {
    if (endereco.current) URL.revokeObjectURL(endereco.current);
  }, []);

  function tocar() {
    endereco.current ??= URL.createObjectURL(new Blob([sintetizarAcorde(recurso.casas) as BlobPart], { type: 'audio/wav' }));
    const audio = new Audio(endereco.current);
    setTocando(true);
    audio.onended = () => setTocando(false);
    audio.play().catch(() => setTocando(false));
  }

  return (
    <figure className="acorde">
      <svg viewBox="0 0 190 200" role="img" aria-label={`${t.recursos.acorde(recurso.nome)}: ${descricao}.`}>
        {base === 1
          ? <rect x={27} y={43} width={136} height={7} rx={3.5} className="acorde__pestana" />
          : <text x={8} y={y(base) + 5} className="acorde__base">{base}</text>}
        {[0, 1, 2, 3, 4].map((traste) => <line key={traste} x1={30} x2={160} y1={48 + traste * 34} y2={48 + traste * 34} className="acorde__traste" />)}
        {[0, 1, 2, 3, 4, 5].map((corda) => (
          <line key={corda} x1={x(corda)} x2={x(corda)} y1={48} y2={184} className="acorde__corda" style={{ strokeWidth: 3.4 - corda * 0.4 }} />
        ))}
        {recurso.casas.map((casa, corda) => (casa <= 0 ? (
          <text key={corda} x={x(corda)} y={33} textAnchor="middle" className={casa < 0 ? 'acorde__abafada' : 'acorde__solta'}>{casa < 0 ? 'X' : 'O'}</text>
        ) : (
          <g key={corda}>
            <circle cx={x(corda)} cy={y(casa)} r={11.5} className="acorde__dedo" />
            {Boolean(recurso.dedos?.[corda]) && <text x={x(corda)} y={y(casa) + 5} textAnchor="middle" className="acorde__numero">{recurso.dedos?.[corda]}</text>}
          </g>
        )))}
      </svg>
      <figcaption>
        <strong>{t.recursos.acorde(recurso.nome)}</strong>
        <span>{t.recursos.legendaAcorde}</span>
        <Botao variante="secundario" disabled={tocando} onClick={tocar}><Icone nome="som" />{tocando ? t.recursos.tocando : t.recursos.ouvirAcorde}</Botao>
      </figcaption>
    </figure>
  );
}

function vozDisponivel() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** A voz do navegador só existe no cliente: o botão aparece depois de montar, sem divergir da página do servidor. */
function useVozDisponivel() {
  const [disponivel, setDisponivel] = useState(false);
  useEffect(() => setDisponivel(vozDisponivel()), []);
  return disponivel;
}

/** Lê a fala em voz alta, no idioma dela, com a voz do próprio navegador (sem rede). */
function falar(fala: Fala, devagar: boolean) {
  if (!vozDisponivel()) return;
  const sintese = window.speechSynthesis;
  sintese.cancel();
  const frase = new SpeechSynthesisUtterance(fala.texto);
  frase.lang = fala.idioma;
  frase.rate = devagar ? 0.6 : 0.95;
  const idioma = fala.idioma.toLowerCase();
  const vozes = sintese.getVoices();
  const voz = vozes.find((item) => item.lang.toLowerCase().replace('_', '-') === idioma)
    ?? vozes.find((item) => item.lang.toLowerCase().startsWith(idioma.slice(0, 2)));
  if (voz) frase.voice = voz;
  sintese.speak(frase);
}

function BotoesOuvir({ fala }: { fala: Fala }) {
  if (!useVozDisponivel()) return null;
  return (
    <span className="ouvir">
      <button type="button" className="ouvir__botao" aria-label={t.audio.ouvirFrase(fala.texto)} onClick={() => falar(fala, false)}>
        <Icone nome="som" /><span aria-hidden="true">{t.audio.ouvir}</span>
      </button>
      <button type="button" className="ouvir__botao ouvir__botao--devagar" aria-label={t.audio.ouvirDevagar(fala.texto)} onClick={() => falar(fala, true)}>
        <span aria-hidden="true">{t.audio.devagar}</span>
      </button>
    </span>
  );
}

/** Frases para ouvir e repetir, com a tradução. */
function Falas({ falas }: { falas: Fala[] }) {
  return (
    <section className="falas" aria-labelledby="falas-titulo">
      <h3 id="falas-titulo">{t.audio.falasTitulo}</h3>
      <ul>
        {falas.map((fala, posicao) => (
          <li key={posicao}>
            <div className="falas__textos">
              <p className="falas__texto" lang={fala.idioma}>{fala.texto}</p>
              {fala.traducao && <p className="falas__traducao">{fala.traducao}</p>}
            </div>
            <BotoesOuvir fala={fala} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Exercício de escuta: o áudio primeiro; o texto aparece só quando a pessoa pede (ou quando não há voz). */
function Escuta({ fala }: { fala: Fala }) {
  const disponivel = useVozDisponivel();
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="escuta">
      <p className="escuta__rotulo"><Icone nome="som" />{t.audio.escuta}</p>
      {disponivel
        ? (
          <span className="ouvir ouvir--grande">
            <button type="button" className="ouvir__botao" onClick={() => falar(fala, false)}><Icone nome="som" />{t.audio.ouvirExercicio}</button>
            <button type="button" className="ouvir__botao ouvir__botao--devagar" onClick={() => falar(fala, true)}>{t.audio.devagar}</button>
          </span>
        )
        : <p className="escuta__aviso">{t.audio.semVoz}</p>}
      <button type="button" className="escuta__texto" aria-expanded={mostrar} onClick={() => setMostrar((atual) => !atual)}>
        {mostrar ? t.audio.esconderTexto : t.audio.mostrarTexto}
      </button>
      {mostrar && <p className="trecho trecho--frase" lang={fala.idioma}>{fala.texto}</p>}
    </div>
  );
}

/** Texto com as lacunas destacadas. */
function ComLacunas({ texto }: { texto: string }) {
  const partes = partesDaLacuna(texto);
  return (
    <>
      {partes.map((parte, posicao) => (
        <span key={posicao}>
          {parte}
          {posicao < partes.length - 1 && <span className="trecho-lacuna" aria-label="lacuna">{'  '}</span>}
        </span>
      ))}
    </>
  );
}

/** Trecho no visual do conteúdo: código em fonte monoespaçada; frase, citação, fórmula e passos com o visual de cada um. */
function Trecho({ texto, tipo = 'frase', fala }: { texto: string; tipo?: TipoTrecho; fala?: Fala }) {
  switch (tipo) {
    case 'codigo':
      return <pre className="licao-codigo"><code><ComLacunas texto={texto} /></code></pre>;
    case 'citacao':
      return <blockquote className="trecho trecho--citacao"><p><ComLacunas texto={semAspas(texto)} /></p></blockquote>;
    case 'formula':
      return <p className="trecho trecho--formula"><ComLacunas texto={texto} /></p>;
    case 'passos':
      return <ol className="trecho trecho--passos">{linhasDePassos(texto).map((linha, posicao) => <li key={posicao}><ComLacunas texto={linha} /></li>)}</ol>;
    default:
      return (
        <div className="trecho trecho--frase">
          <p lang={fala?.idioma}><ComLacunas texto={texto} /></p>
          {fala && <BotoesOuvir fala={fala} />}
        </div>
      );
  }
}

function EtapaExercicio({ exercicio, indice, total, resposta, mudar, avaliacao, ocupado, responder, formulario, titulo }: {
  exercicio: ExercicioPublico;
  indice: number;
  total: number;
  resposta: string;
  mudar: (valor: string) => void;
  avaliacao: Avaliacao | null;
  ocupado: boolean;
  responder: (evento: FormEvent<HTMLFormElement>) => void;
  formulario: Ref<HTMLFormElement>;
  titulo: Ref<HTMLHeadingElement>;
}) {
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : undefined;
  const respondido = avaliacao !== null;
  let campo: ReactNode;
  switch (exercicio.tipo) {
    case 'lacuna':
      campo = (
        <div className="campo campo--resposta">
          <label htmlFor="resposta">{t.resposta}</label>
          <input id="resposta" name="resposta" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
            value={resposta} onChange={(evento) => mudar(evento.target.value)} required disabled={ocupado}
            readOnly={respondido} data-retorno={retorno} />
        </div>
      );
      break;
    case 'multipla_escolha':
      campo = (
        <fieldset className="opcoes" disabled={ocupado || respondido}>
          <legend>{t.resposta}</legend>
          {exercicio.opcoes.map((opcao, posicao) => (
            <label key={opcao.id} data-retorno={resposta === opcao.id ? retorno : undefined}>
              <input type="radio" name="resposta" value={opcao.id} required checked={resposta === opcao.id} onChange={() => mudar(opcao.id)} />
              <span className="opcao-tecla" aria-hidden="true">{posicao + 1}</span>
              <span>{opcao.texto}</span>
            </label>
          ))}
          <p className="opcoes-atalho">{t.atalho(exercicio.opcoes.length)}</p>
        </fieldset>
      );
      break;
    case 'ordenar':
      campo = <Ordenar itens={exercicio.itens} valor={resposta} mudar={mudar} desativado={ocupado || respondido} certos={avaliacao?.certos} />;
      break;
    case 'associar':
      campo = (
        <Associar esquerda={exercicio.esquerda} direita={exercicio.direita} valor={resposta} mudar={mudar}
          desativado={ocupado || respondido} certos={avaliacao?.certos} />
      );
      break;
    case 'verdadeiro_falso':
      campo = (
        <VerdadeiroFalso afirmacao={exercicio.afirmacao} justificativas={exercicio.justificativas} valor={resposta} mudar={mudar}
          desativado={ocupado || respondido} retorno={retorno} />
      );
      break;
    case 'aberta':
      campo = (
        <div className="campo campo--aberta">
          <label htmlFor="resposta">{t.aberta.rotulo}</label>
          <textarea id="resposta" name="resposta" rows={5} maxLength={1000} value={resposta} required disabled={ocupado}
            readOnly={respondido} data-retorno={retorno} aria-describedby="aberta-dica aberta-contador"
            onChange={(evento) => mudar(evento.target.value)} />
          <p id="aberta-dica" className="campo__dica">{t.aberta.dica}</p>
          <p id="aberta-contador" className="campo__contador" data-pronto={resposta.trim().length >= exercicio.minimo || undefined}>
            {t.aberta.contador(resposta.trim().length, exercicio.minimo)}
          </p>
        </div>
      );
      break;
  }

  return (
    <section className="aula-quadro" data-etapa="exercicio" data-tipo={exercicio.tipo} aria-labelledby="etapa-aula">
      <h2 id="etapa-aula" ref={titulo} tabIndex={-1}>{total > 1 ? t.exercicioDe(indice + 1, total) : t.exercicio}</h2>
      <p>{exercicio.enunciado}</p>
      {exercicio.contexto && <p>{exercicio.contexto}</p>}
      {exercicio.trecho && <Trecho texto={exercicio.trecho} tipo={exercicio.trechoTipo} fala={exercicio.fala} />}
      {!exercicio.trecho && exercicio.fala && <Escuta fala={exercicio.fala} />}
      <form id="resposta-licao" ref={formulario} className="formulario" method="post" onSubmit={responder}>
        {campo}
      </form>
      {exercicio.tipo === 'aberta' && avaliacao && <CorrecaoAberta avaliacao={avaliacao} />}
    </section>
  );
}

/** Ordenar tocando: cada toque coloca o item na próxima posição; tocar num item já colocado tira ele da ordem. */
function Ordenar({ itens, valor, mudar, desativado, certos }: {
  itens: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
}) {
  const ordem = valor.split(',').filter((id) => itens.some((item) => item.id === id));
  const restantes = itens.filter((item) => !ordem.includes(item.id));
  const texto = (id: string) => itens.find((item) => item.id === id)?.texto ?? '';
  return (
    <div className="ordenar">
      <p className="ordenar__instrucao">{t.ordenar.instrucao}</p>
      <p className="ordenar__rotulo" id="ordenar-escolhidos">{t.ordenar.suaOrdem}</p>
      <ol className="ordenar__escolhidos" aria-labelledby="ordenar-escolhidos">
        {ordem.length === 0 && <li className="ordenar__vazio">{t.ordenar.vazio}</li>}
        {ordem.map((id, posicao) => (
          <li key={id}>
            <button type="button" disabled={desativado} aria-label={t.ordenar.tirar(texto(id), posicao + 1)}
              data-estado={certos ? (certos.includes(id) ? 'certo' : 'errado') : undefined}
              onClick={() => mudar(codificarResposta.ordem(ordem.filter((item) => item !== id)))}>
              <span className="ordenar__numero" aria-hidden="true">{t.ordenar.posicao(posicao + 1)}</span>
              <span>{texto(id)}</span>
            </button>
          </li>
        ))}
      </ol>
      {restantes.length > 0 && (
        <div className="ordenar__disponiveis" role="group" aria-label={t.ordenar.disponiveis}>
          {restantes.map((item) => (
            <button key={item.id} type="button" disabled={desativado} aria-label={t.ordenar.colocar(item.texto)}
              onClick={() => mudar(codificarResposta.ordem([...ordem, item.id]))}>
              {item.texto}
            </button>
          ))}
        </div>
      )}
      {ordem.length > 0 && !desativado && (
        <button type="button" className="exercicio-recomecar" onClick={() => mudar('')}>{t.ordenar.recomecar}</button>
      )}
    </div>
  );
}

/** Associar tocando: escolha um item da esquerda e depois o par na direita. Cada par ganha um número e uma cor. */
function Associar({ esquerda, direita, valor, mudar, desativado, certos }: {
  esquerda: Opcao[];
  direita: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const pares = valor.split(',').filter(Boolean).map((par) => par.split('=') as [string, string]);
  const parDaEsquerda = (id: string) => pares.find(([item]) => item === id);
  const parDaDireita = (id: string) => pares.find(([, item]) => item === id);
  const numero = (id: string) => pares.findIndex(([item, outro]) => item === id || outro === id) + 1;
  const texto = (lista: Opcao[], id: string) => lista.find((item) => item.id === id)?.texto ?? '';
  const salvar = (novos: [string, string][]) => mudar(codificarResposta.pares(novos));

  function tocarEsquerda(id: string) {
    if (parDaEsquerda(id)) {
      salvar(pares.filter(([item]) => item !== id));
      setEscolhida(null);
      return;
    }
    setEscolhida((atual) => (atual === id ? null : id));
  }

  function tocarDireita(id: string) {
    if (!escolhida) {
      if (parDaDireita(id)) salvar(pares.filter(([, item]) => item !== id));
      return;
    }
    salvar([...pares.filter(([item, outro]) => item !== escolhida && outro !== id), [escolhida, id]]);
    setEscolhida(null);
  }

  return (
    <div className="associar">
      <p className="associar__instrucao" aria-live="polite">
        {escolhida ? t.associar.escolhido(texto(esquerda, escolhida)) : t.associar.instrucao}
      </p>
      <div className="associar__colunas">
        <div role="group" aria-label={t.associar.esquerda}>
          {esquerda.map((item) => {
            const par = parDaEsquerda(item.id);
            return (
              <button key={item.id} type="button" disabled={desativado} aria-pressed={escolhida === item.id}
                aria-label={par ? t.associar.desfazer(item.texto, texto(direita, par[1])) : item.texto}
                data-par={par ? numero(item.id) : undefined} data-escolhida={escolhida === item.id || undefined}
                data-estado={certos ? (certos.includes(item.id) ? 'certo' : 'errado') : undefined}
                onClick={() => tocarEsquerda(item.id)}>
                {par && <span className="associar__numero" aria-hidden="true">{numero(item.id)}</span>}
                <span>{item.texto}</span>
              </button>
            );
          })}
        </div>
        <div role="group" aria-label={t.associar.direita}>
          {direita.map((item) => {
            const par = parDaDireita(item.id);
            const rotulo = escolhida ? t.associar.ligar(texto(esquerda, escolhida), item.texto)
              : par ? t.associar.desfazer(texto(esquerda, par[0]), item.texto) : item.texto;
            return (
              <button key={item.id} type="button" disabled={desativado} aria-label={rotulo} data-par={par ? numero(item.id) : undefined}
                data-estado={certos && par ? (certos.includes(par[0]) ? 'certo' : 'errado') : undefined}
                onClick={() => tocarDireita(item.id)}>
                {par && <span className="associar__numero" aria-hidden="true">{numero(item.id)}</span>}
                <span>{item.texto}</span>
              </button>
            );
          })}
        </div>
      </div>
      {pares.length > 0 && !desativado && (
        <button type="button" className="exercicio-recomecar" onClick={() => { mudar(''); setEscolhida(null); }}>{t.associar.recomecar}</button>
      )}
    </div>
  );
}

/** Verdadeiro ou falso com justificativa: o valor e o porquê. */
function VerdadeiroFalso({ afirmacao, justificativas, valor, mudar, desativado, retorno }: {
  afirmacao: string;
  justificativas: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  retorno?: 'certa' | 'errada';
}) {
  const [escolha = '', justificativa = ''] = valor.split(':');
  const salvar = (novaEscolha: string, novaJustificativa: string) => mudar(`${novaEscolha}:${novaJustificativa}`);
  return (
    <div className="vf">
      <blockquote className="vf__afirmacao"><p>{afirmacao}</p></blockquote>
      <fieldset className="vf__valores" disabled={desativado}>
        <legend>{t.verdadeiroFalso.valor}</legend>
        {(['verdadeiro', 'falso'] as const).map((opcao) => (
          <label key={opcao} data-valor={opcao} data-retorno={escolha === opcao ? retorno : undefined}>
            <input type="radio" name="vf-valor" value={opcao} checked={escolha === opcao} onChange={() => salvar(opcao, justificativa)} />
            <Icone nome={opcao === 'verdadeiro' ? 'check' : 'fechar'} />
            <span>{opcao === 'verdadeiro' ? t.verdadeiroFalso.verdadeiro : t.verdadeiroFalso.falso}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="opcoes" disabled={desativado}>
        <legend>{t.verdadeiroFalso.porque}</legend>
        {justificativas.map((opcao, posicao) => (
          <label key={opcao.id} data-retorno={justificativa === opcao.id ? retorno : undefined}>
            <input type="radio" name="vf-justificativa" value={opcao.id} checked={justificativa === opcao.id}
              onChange={() => salvar(escolha, opcao.id)} />
            <span className="opcao-tecla" aria-hidden="true">{posicao + 1}</span>
            <span>{opcao.texto}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** Depois da resposta aberta: o que a correção procurou, se a resposta trouxe, e uma boa resposta de exemplo. */
function CorrecaoAberta({ avaliacao }: { avaliacao: Avaliacao }) {
  return (
    <section className="correcao-aberta" aria-labelledby="correcao-titulo">
      {avaliacao.criterios && (
        <>
          <h3 id="correcao-titulo">{t.aberta.criterios}</h3>
          <ul>
            {avaliacao.criterios.map((criterio, posicao) => (
              <li key={posicao} data-atendido={criterio.atendido || undefined}>
                <Icone nome={criterio.atendido ? 'check' : 'fechar'} />
                <span><span className="somente-leitor">{criterio.atendido ? t.aberta.atendido : t.aberta.faltou}: </span>{criterio.texto}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {avaliacao.modelo && (
        <div className="correcao-aberta__modelo">
          <h3>{t.aberta.modelo}</h3>
          <p>{avaliacao.modelo}</p>
        </div>
      )}
      {avaliacao.simulado && <p className="correcao-aberta__nota">{t.aberta.simulada}</p>}
    </section>
  );
}

/**
 * Prática no mundo real: a tarefa, os passos para conferir, a dica e um cronômetro; na volta, a pessoa conta como foi e
 * o Stu responde. A lição só conclui depois dessa resposta.
 */
function EtapaPratica({ pratica, titulo, escolha, escolher }: {
  pratica: Pratica;
  titulo: Ref<HTMLHeadingElement>;
  escolha: AutoAvaliacao | null;
  escolher: (valor: AutoAvaliacao) => void;
}) {
  const total = pratica.minutos * 60;
  const [restante, setRestante] = useState(total);
  const [rodando, setRodando] = useState(false);
  const comoFoi = useRef<HTMLLegendElement>(null);
  const acabou = restante === 0;

  useEffect(() => {
    if (!rodando) return;
    const intervalo = window.setInterval(() => {
      setRestante((atual) => {
        if (atual > 1) return atual - 1;
        setRodando(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(intervalo);
  }, [rodando]);

  useEffect(() => {
    if (acabou) comoFoi.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [acabou]);

  let rotuloPrincipal: string = t.pratica.comecar;
  if (rodando) rotuloPrincipal = t.pratica.pausar;
  else if (restante < total) rotuloPrincipal = t.pratica.retomar;

  return (
    <section className="aula-quadro aula-pratica" data-etapa="pratica" aria-labelledby="etapa-aula">
      <h2 id="etapa-aula" ref={titulo} tabIndex={-1}>{t.pratica.titulo}</h2>
      <p className="aula-pratica__subtitulo">{t.pratica.subtitulo}</p>
      <p className="aula-pratica__tarefa">{pratica.tarefa}</p>
      {pratica.passos && (
        <ul className="aula-pratica__passos" aria-label={t.pratica.passos}>
          {pratica.passos.map((passo, posicao) => (
            <li key={posicao}><label><input type="checkbox" /><span>{passo}</span></label></li>
          ))}
        </ul>
      )}
      {pratica.dica && <p className="aula-pratica__dica"><Icone nome="lampada" /><span><strong>{t.pratica.dica}:</strong> {pratica.dica}</span></p>}
      <div className="cronometro" data-estado={acabou ? 'fim' : rodando ? 'rodando' : 'parado'}
        style={{ '--andamento': 1 - restante / total } as CSSProperties}>
        <div className="cronometro__mostrador" role="timer" aria-label={`${t.pratica.cronometro}: ${t.pratica.restante(formatarTempo(restante))}`}>
          <span aria-hidden="true">{formatarTempo(restante)}</span>
        </div>
        <div className="cronometro__acoes">
          {!acabou && <Botao variante={rodando ? 'secundario' : 'primario'} onClick={() => setRodando((atual) => !atual)}>{rotuloPrincipal}</Botao>}
          {restante < total && <Botao variante="texto" onClick={() => { setRodando(false); setRestante(total); }}>{t.pratica.recomecar}</Botao>}
        </div>
      </div>
      <fieldset className="como-foi">
        <legend ref={comoFoi}>{acabou ? t.pratica.acabou : t.pratica.comoFoi}</legend>
        <div className="como-foi__opcoes">
          {AUTOAVALIACOES.map((valor) => (
            <label key={valor} data-valor={valor}>
              <input type="radio" name="como-foi" value={valor} checked={escolha === valor} onChange={() => escolher(valor)} />
              <span>{t.pratica.opcoes[valor]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {escolha && (
        <div className="aula-explicacao aula-pratica__resposta" role="status">
          <Stu />
          <p className="aula-balao">{t.pratica.respostas[escolha]}</p>
        </div>
      )}
    </section>
  );
}
