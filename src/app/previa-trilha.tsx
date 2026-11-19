'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { origemLegivel, type PlanoResumo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Icone, Mascote, coresDaRegiao } from '../ui';
import { posicaoX } from '../ui/caminho';
import { nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { tocaSons } from './sons';
import './previa-trilha.css';

export type EstadoAceite = 'livre' | 'salvando' | 'erro' | 'expirada';
export type PassagemCriada = { geracao: TrilhaEmGeracao; estilo: CSSProperties; reduzida: boolean };
const t = mensagens.geracao;
const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Guarda a posição antes que a aula troque a largura e a rolagem da página. */
export function medirPassagem(geracao: TrilhaEmGeracao, painel: HTMLElement): PassagemCriada {
  const caixa = painel.getBoundingClientRect();
  const no = painel.querySelector('[data-primeiro] .previa-no__face')?.getBoundingClientRect();
  const x = no ? no.left + no.width / 2 : caixa.left + caixa.width / 2;
  const y = no ? no.top + no.height / 2 : caixa.top + caixa.height / 2;
  return { geracao, reduzida: movimentoReduzido(), estilo: {
    left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height,
    '--origem-x': `${x}px`, '--origem-y': `${y}px`,
    '--raio': `${Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)))}px`,
  } as CSSProperties };
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
  const acompanhar = useRef(true);
  const anterior = useRef(0);
  const ultimoPouso = useRef(-Infinity);
  const [explicacao, setExplicacao] = useState<string | null>(null);
  const [semNovidade, setSemNovidade] = useState(false);
  const [demorou, setDemorou] = useState(false);
  const salvando = aceite === 'salvando' || !!passagem;
  const fase = passagem ? 'criada' : salvando ? 'salvando' : proposta ? 'pronta' : 'montando';
  const placa = proposta ? t.propostaPronta(nos.length, proposta.fluxos.length) : semNovidade ? t.aguardandoLicao : t.montandoTitulo;

  useEffect(() => {
    tocaSons.prepararEfeitos('geracao_licao', 'geracao_pronta', 'toque_opcao');
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
      if (acompanhar.current || salvando) area.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const vaga = area.querySelector<HTMLElement>('[data-mais-novo]');
    if (!vaga || !acompanhar.current) return;
    const centro = vaga.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop + vaga.offsetHeight / 2;
    area.scrollTo({ top: Math.max(0, centro - area.clientHeight * 0.6), behavior: movimentoReduzido() ? 'instant' : 'smooth' });
  }, [nos.length, proposta, salvando]);

  function pousou(face: HTMLElement) {
    const area = mapa.current;
    if (proposta || !area || performance.now() - ultimoPouso.current < 400) return;
    const no = face.getBoundingClientRect(), janela = area.getBoundingClientRect();
    if (no.bottom < janela.top || no.top > janela.bottom) return;
    ultimoPouso.current = performance.now();
    void tocaSons.tocarEfeito('geracao_licao');
  }

  return <section ref={painel} className="painel painel--geracao" data-fase={fase} data-passagem={passagem ? (passagem.reduzida ? 'reduzida' : 'circulo') : undefined}
    style={passagem?.estilo} inert={!!passagem} aria-hidden={passagem ? true : undefined}>
    <header className="previa-cabecalho">
      <button type="button" className="previa-voltar" aria-label={mensagens.planos.titulo} onClick={sair}><Icone nome="seta" /></button>
      <h1 tabIndex={-1}>{geracao.titulo || geracao.objetivo}</h1>
    </header>
    <div className="previa-palco">
      <p className="previa-placa" role="status">{placa}</p>
      <div className="previa-mapa" ref={mapa} onScroll={ev => {
        const area = ev.currentTarget;
        if (area.scrollTop < anterior.current - 2) acompanhar.current = false;
        if (area.scrollHeight - area.clientHeight - area.scrollTop < 24) acompanhar.current = true;
        anterior.current = area.scrollTop;
      }}>
        <ol className="previa-percurso" aria-label={t.contexto}>
          {nos.map((no, i) => {
            const x = posicaoX(i), antes = posicaoX(i - 1);
            const comStu = proposta ? i === 0 : i === nos.length - 1;
            const pose = passagem ? 'stu-comemorando' : salvando ? 'stu-estudando' : proposta ? 'stu-feliz' : 'stu-curioso';
            const mostrar = explicacao === no.id && !salvando;
            return <li key={no.id} className="previa-no" data-primeiro={i === 0 || undefined} data-mais-novo={i === nos.length - 1 || undefined}
              style={{ ...coresDaRegiao(no.trecho), '--x': `${x}%` } as CSSProperties}>
              {i > 0 && <span className="previa-ligacao" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d={`M${antes} 0 C${antes} 48 ${x} 52 ${x} 100`} vectorEffect="non-scaling-stroke" /></svg></span>}
              <div className="previa-no__centro">
                <button type="button" className="previa-no__alvo" disabled={salvando} aria-expanded={mostrar} aria-label={no.titulo}
                  onClick={() => setExplicacao(mostrar ? null : no.id)}>
                  <span className="previa-no__face" onAnimationEnd={ev => {
                    if (ev.animationName === 'previa-pousar' || ev.animationName === 'previa-aparecer') pousou(ev.currentTarget);
                  }}><Icone nome={no.titulo.startsWith('Revis') ? 'revisao' : 'livro'} /></span>
                  <span className="previa-no__titulo">{no.titulo}</span>
                </button>
                {comStu && <div className="previa-stu" data-esquerda={x > 64 || undefined}>
                  <Mascote key={pose} expressao={pose} tamanho={80} animado={!proposta || (salvando && !passagem) ? 'laco' : 'uma-vez'} sombra />
                </div>}
                {mostrar && <p className="previa-no__explicacao">{no.resumo || mensagens.licao.audio.previaAbre}</p>}
              </div>
            </li>;
          })}
        </ol>
        {!proposta && <div className="previa-vaga" aria-hidden="true"><span />{!nos.length && <Mascote expressao="stu-curioso" tamanho={80} animado="laco" sombra />}</div>}
        {proposta && <div className="previa-chegada" style={coresDaRegiao(nos.at(-1)?.trecho ?? 0)}>
          <Mascote expressao="acessorio-trofeu" tamanho={64} />
          <span>{mensagens.trilha.chegada}</span>
          <small>{t.origem(origemLegivel(proposta.origem))}</small>
        </div>}
        {proposta && existente && !salvando && <aside className="geracao-repetida"><p>{t.repetida(existente.titulo)}</p>
          <Botao variante="secundario" onClick={() => abrirExistente(existente.id)}>{t.abrirExistente}</Botao></aside>}
      </div>
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
    {passagem && !passagem.reduzida && <div className="previa-circulo" aria-hidden="true" />}
  </section>;
}
