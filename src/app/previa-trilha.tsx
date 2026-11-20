'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { origemLegivel, type PlanoResumo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Desenho, Fronteira, Icone, Mascote, coresDaRegiao } from '../ui';
import { desenhosQueBalancam, enfeitesDaLinha } from '../ui/mundo-desenhos';
import { posicaoX, semQuebrarHifen } from '../ui/caminho';
import { nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { tocaSons } from './sons';
import './previa-trilha.css';

export type EstadoAceite = 'livre' | 'salvando' | 'erro' | 'expirada';
export type PassagemCriada = { geracao: TrilhaEmGeracao; estilo: CSSProperties; reduzida: boolean; rolagem: number };
const t = mensagens.geracao;
const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function origemDoCirculo(painel: HTMLElement, faltaRolar = 0) {
  const caixa = painel.getBoundingClientRect();
  const no = painel.querySelector('[data-primeiro] .previa-no__face')?.getBoundingClientRect();
  const x = no ? no.left + no.width / 2 : caixa.left + caixa.width / 2;
  const y = no ? no.top + no.height / 2 + faltaRolar : caixa.top + caixa.height / 2;
  return { '--origem-x': `${x}px`, '--origem-y': `${y}px`,
    '--raio': `${Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)))}px` };
}

export function medirPassagem(geracao: TrilhaEmGeracao, painel: HTMLElement): PassagemCriada {
  const area = painel.querySelector<HTMLElement>('.previa-mapa');
  const reduzida = movimentoReduzido();
  if (area && (reduzida || area.scrollTop > innerHeight)) area.scrollTop = 0;
  const rolagem = area?.scrollTop ?? 0;
  const caixa = painel.getBoundingClientRect();
  return { geracao, reduzida, rolagem, estilo: { left: caixa.left, top: caixa.top,
    width: caixa.width, height: caixa.height, ...origemDoCirculo(painel, rolagem) } as CSSProperties };
}

function LigacaoRascunho({ de, ate }: { de: number; ate: number }) {
  return <span className="previa-ligacao" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d={`M${de} 0 C${de} 48 ${ate} 52 ${ate} 100`} vectorEffect="non-scaling-stroke" />
  </svg></span>;
}

function CenarioDaPrevia({ trecho, indice }: { trecho: number; indice: number }) {
  const perto = enfeitesDaLinha(trecho, indice), longe = enfeitesDaLinha(trecho, indice + 2);
  return <div className="previa-cenario" aria-hidden="true">
    {[perto.grande, perto.miudo, longe.grande, longe.miudo].map((nome, i) =>
      <Desenho key={i} nome={nome} className={desenhosQueBalancam.has(nome) ? 'mundo-balanca' : ''} />)}
  </div>;
}

export function PreviaTrilha({ geracao, aceite, passagem, sair, cancelar, ajustar, aceitar, remontar, existente, abrirExistente }: {
  geracao: TrilhaEmGeracao; aceite: EstadoAceite; passagem: PassagemCriada | null;
  sair: () => void; cancelar: () => void; ajustar: () => void; aceitar: (painel: HTMLElement) => void;
  remontar: () => void; existente?: PlanoResumo; abrirExistente: (id: string) => void;
}) {
  const nos = useMemo(() => nosDaPrevia(geracao), [geracao]);
  const { proposta } = geracao;
  const painel = useRef<HTMLElement>(null);
  const mapa = useRef<HTMLDivElement>(null);
  const [acompanhando, setAcompanhando] = useState(true);
  const maiorRolagem = useRef(0);
  const propostaApresentada = useRef<string | null>(null);
  const trofeu = useRef<HTMLDivElement>(null);
  const [trofeuAVista, setTrofeuAVista] = useState(false);
  const [viuTrofeu, setViuTrofeu] = useState(false);
  const [licaoAnunciada, setLicaoAnunciada] = useState('');
  const ultimoPouso = useRef(-Infinity);
  const [explicacao, setExplicacao] = useState<string | null>(null);
  const [semNovidade, setSemNovidade] = useState(false);
  const [demorou, setDemorou] = useState(false);
  const salvando = aceite === 'salvando' || !!passagem;
  const falhou = aceite === 'erro' || aceite === 'expirada';
  const stuNoTrofeu = !!proposta && trofeuAVista && !salvando && !falhou;
  const fase = passagem ? 'criada' : salvando ? 'salvando' : proposta ? 'pronta' : 'montando';
  const placa = proposta ? t.propostaPronta(nos.length, proposta.fluxos.length) : semNovidade ? t.aguardandoLicao : t.montandoTitulo;

  useEffect(() => {
    tocaSons.prepararEfeitos('geracao_licao', 'geracao_pronta');
  }, []);
  useEffect(() => {
    setSemNovidade(false);
    if (proposta) return;
    const relogio = window.setTimeout(() => setSemNovidade(true), 12000);
    return () => window.clearTimeout(relogio);
  }, [nos.length, proposta]);
  useEffect(() => {
    setDemorou(false);
    if (aceite !== 'salvando' || passagem) return;
    const relogio = window.setTimeout(() => setDemorou(true), 1500);
    return () => window.clearTimeout(relogio);
  }, [aceite, passagem]);

  // O caminho acompanha a vaga a 60% do mapa, até a pessoa voltar para ler um nó anterior.
  useLayoutEffect(() => {
    const area = mapa.current;
    if (!area) return;
    if (proposta) {
      if (propostaApresentada.current === proposta.token) return;
      propostaApresentada.current = proposta.token;
      if (acompanhando && trofeu.current) {
        const destino = trofeu.current.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom + area.scrollTop;
        area.scrollTo({ top: Math.max(0, destino), behavior: movimentoReduzido() ? 'instant' : 'smooth' });
        painel.current?.querySelector<HTMLButtonElement>('.previa-comecar')?.focus({ preventScroll: true });
      }
      return;
    }
    propostaApresentada.current = null;
    const vaga = area.querySelector<HTMLElement>('[data-mais-novo]');
    if (!vaga || !acompanhando) return;
    const centro = vaga.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop + vaga.offsetHeight / 2;
    area.scrollTo({ top: Math.max(0, centro - area.clientHeight * 0.6), behavior: movimentoReduzido() ? 'instant' : 'smooth' });
  }, [nos.length, proposta, acompanhando]);

  function voltarAAcompanhar() {
    const area = mapa.current;
    if (!area) return;
    const alvo = proposta ? trofeu.current : area.querySelector<HTMLElement>('[data-mais-novo]');
    if (!alvo) return;
    area.focus({ preventScroll: true });
    maiorRolagem.current = 0;
    setAcompanhando(true);
    if (proposta) {
      const destino = alvo.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom + area.scrollTop;
      area.scrollTo({ top: Math.max(0, destino), behavior: movimentoReduzido() ? 'instant' : 'smooth' });
    }
  }

  useLayoutEffect(() => {
    const area = mapa.current;
    if (!area) return;
    if (aceite === 'erro' || aceite === 'expirada') { area.scrollTop = 0; return; }
    if (aceite !== 'salvando' && !passagem) return;
    const de = passagem?.rolagem ?? area.scrollTop;
    const duracao = passagem ? 120 : 240;
    if (movimentoReduzido() || !de) { area.scrollTop = 0; return; }
    area.scrollTop = de;
    const inicio = performance.now();
    let quadro: number;
    function rolar(agora: number) {
      const fracao = Math.min(1, (agora - inicio) / duracao);
      area!.scrollTop = de * (1 - fracao) ** 3;
      if (fracao < 1) quadro = requestAnimationFrame(rolar);
    }
    quadro = requestAnimationFrame(rolar);
    return () => cancelAnimationFrame(quadro);
  }, [aceite, passagem]);

  useEffect(() => {
    if (!proposta || !mapa.current || !trofeu.current) {
      setViuTrofeu(false); setTrofeuAVista(false); return;
    }
    const observador = new IntersectionObserver(([entrada]) => {
      setTrofeuAVista(entrada.isIntersecting);
      if (entrada.isIntersecting) setViuTrofeu(true);
    }, { root: mapa.current, threshold: 0.45 });
    observador.observe(trofeu.current);
    return () => observador.disconnect();
  }, [proposta]);

  function pousou(face: HTMLElement, numero: number, titulo: string) {
    const area = mapa.current;
    if (proposta || !area) return;
    setLicaoAnunciada(t.anuncioLicao(numero, titulo));
    if (performance.now() - ultimoPouso.current < 400) return;
    const no = face.getBoundingClientRect(), janela = area.getBoundingClientRect();
    if (no.bottom < janela.top || no.top > janela.bottom) return;
    ultimoPouso.current = performance.now();
    void tocaSons.tocarEfeito('geracao_licao');
  }

  return <section ref={painel} className="painel painel--geracao" data-fase={fase} data-passagem={passagem ? (passagem.reduzida ? 'reduzida' : 'circulo') : undefined}
    style={passagem?.estilo} inert={!!passagem}>
    <header className="previa-cabecalho">
      <button type="button" className="previa-voltar" aria-label={mensagens.planos.titulo} onClick={sair}><Icone nome="seta" /></button>
      <h1 tabIndex={-1}>{geracao.titulo || geracao.objetivo}</h1>
    </header>
    <div className="previa-palco">
      <p className="previa-placa" role="status">{placa}{proposta && <span className="somente-leitor"> {t.comecarLicao1}.</span>}</p>
      {!proposta && <span className="somente-leitor" role="status">{licaoAnunciada}</span>}
      <div className="previa-mapa" ref={mapa} tabIndex={-1} style={coresDaRegiao(nos.at(-1)?.trecho ?? 0)} onScroll={ev => {
        const area = ev.currentTarget;
        if (salvando) return;
        const { scrollTop, scrollHeight, clientHeight } = area;
        if (scrollHeight - clientHeight - scrollTop < 24) {
          maiorRolagem.current = scrollTop;
          setAcompanhando(true);
        } else if (scrollTop < maiorRolagem.current - 40) {
          setAcompanhando(false);
        } else {
          maiorRolagem.current = Math.max(maiorRolagem.current, scrollTop);
        }
      }}>
        <ol className="previa-percurso" aria-label={t.contexto}>
          {nos.map((no, i) => {
            const x = posicaoX(i), antes = posicaoX(i - 1);
            const novaParte = i > 0 && no.trecho !== nos[i - 1].trecho;
            const seguinte = nos[i + 1], fronteira = seguinte && seguinte.trecho !== no.trecho;
            const comStu = proposta ? i === 0 && !stuNoTrofeu : i === nos.length - 1;
            const pose = passagem ? 'stu-comemorando' : salvando ? 'stu-estudando' : falhou ? 'stu-encorajador' : proposta ? 'stu-feliz' : 'stu-curioso';
            const mostrar = explicacao === no.id && !salvando;
            return <li key={no.id} className="previa-no" data-lado={x >= 50 ? 'direita' : 'esquerda'} data-fronteira={fronteira || undefined} data-nova-parte={novaParte || undefined} data-primeiro={i === 0 || undefined} data-mais-novo={i === nos.length - 1 || undefined}
              style={{ ...coresDaRegiao(no.trecho), '--x': `${x}%` } as CSSProperties}>
              <CenarioDaPrevia trecho={no.trecho} indice={i} />
              {fronteira && <>
                <Fronteira trechoSeguinte={seguinte.trecho} />
                <span className="previa-marco" style={coresDaRegiao(seguinte.trecho)}><Icone nome="bandeira" />{mensagens.trilha.parte(seguinte.trecho + 1)}</span>
              </>}
              {i > 0 && <LigacaoRascunho de={antes} ate={x} />}
              <div className="previa-no__centro">
                <button type="button" className="previa-no__alvo" disabled={salvando} aria-expanded={mostrar} aria-label={no.titulo}
                  onFocus={ev => {
                    if (ev.currentTarget.matches(':focus-visible')) setAcompanhando(false);
                  }} onClick={() => setExplicacao(mostrar ? null : no.id)}>
                  <span className="previa-no__face" onAnimationEnd={ev => {
                    if (ev.animationName === 'previa-pousar' || ev.animationName === 'previa-aparecer') pousou(ev.currentTarget, i + 1, no.titulo);
                  }}><Icone nome={no.titulo.startsWith('Revis') ? 'revisao' : 'livro'} /></span>
                  <span className="previa-no__titulo">{semQuebrarHifen(no.titulo)}</span>
                </button>
                {comStu && <div className="previa-stu" data-esquerda={x > 64 || undefined}>
                  <Mascote key={pose} expressao={pose} tamanho={80} animado={falhou || (viuTrofeu && !salvando) ? undefined : !proposta || !passagem && salvando ? 'laco' : 'uma-vez'} sombra />
                </div>}
                {mostrar && <p className="previa-no__explicacao">{no.resumo || mensagens.licao.audio.previaAbre}</p>}
              </div>
            </li>;
          })}
        </ol>
        {!proposta && <div className="previa-vaga" aria-hidden="true"><span />{!nos.length && <Mascote expressao="stu-curioso" tamanho={80} animado="laco" sombra />}</div>}
        {proposta && <div ref={trofeu} className="previa-chegada" data-visto={viuTrofeu || undefined}>
          <LigacaoRascunho de={posicaoX(Math.max(0, nos.length - 1))} ate={50} />
          <div className="previa-premio">
            <Mascote expressao="acessorio-trofeu" tamanho={64} />
            {stuNoTrofeu && <div className="previa-stu"><Mascote expressao="stu-feliz" tamanho={80} animado="uma-vez" sombra /></div>}
          </div>
          <span>{mensagens.trilha.chegada}</span>
          <small>{t.origem(origemLegivel(proposta.origem))}</small>
        </div>}
        {proposta && existente && !salvando && <aside className="geracao-repetida"><p>{t.repetida(existente.titulo)}</p>
          <Botao variante="secundario" onClick={() => abrirExistente(existente.id)}>{t.abrirExistente}</Botao></aside>}
      </div>
      {!acompanhando && !salvando && nos.length > 0 && !(proposta && trofeuAVista) && (
        <button type="button" className="previa-seguir" onClick={voltarAAcompanhar}>
          <Icone nome="seta" />{proposta ? t.verFimDaTrilha : t.verLicaoNova(nos.length)}
        </button>
      )}
    </div>
    <footer className="previa-rodape">
      <div className="previa-botoes">
        {!salvando && <Botao variante="secundario" onClick={proposta ? ajustar : cancelar}>{proposta ? t.ajustar : t.cancelar}</Botao>}
        {proposta && <Botao className="previa-comecar" aria-disabled={salvando} onClick={() => {
          if (!painel.current || salvando) return;
          if (aceite === 'expirada') { remontar(); return; }
          aceitar(painel.current);
        }}>{salvando && <span className="previa-giro" aria-hidden="true" />}{salvando ? t.criandoTrilha : aceite === 'expirada' ? t.montarDeNovo : t.comecarLicao1}</Botao>}
      </div>
      {demorou && salvando && !passagem && <p className="previa-espera" role="status">{t.escrevendoLicoes}</p>}
      {(aceite === 'erro' || aceite === 'expirada') && <p className="previa-erro" role="alert">{aceite === 'expirada' ? t.propostaExpirada : t.erroCriacao}</p>}
    </footer>
    {passagem && !passagem.reduzida && <div className="previa-circulo" aria-hidden="true" onAnimationStart={() => {
      if (!painel.current || !mapa.current) return;
      mapa.current.scrollTop = 0;
      for (const [nome, valor] of Object.entries(origemDoCirculo(painel.current))) painel.current.style.setProperty(nome, valor);
    }} />}
  </section>;
}
