'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { dicaDaEspera, type PlanoResumo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Desenho, Fronteira, Icone, Mascote, coresDaRegiao } from '../ui';
import { desenhosQueBalancam, enfeitesDaLinha } from '../ui/mundo-desenhos';
import { posicaoX, semQuebrarHifen } from '../ui/caminho';
import { nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { DURACAO_ACOMPANHAR_MS, DURACAO_ATE_O_NO_1_MS, entradaMaisNova, rolagemParaCentrarNo, rolarAte, trocarDicasDaEspera, type EstadoDaEspera } from './previa-trilha-regras';
import { tocaSons } from './sons';
import './previa-trilha.css';
import { ResumoDiagnostico } from './diagnostico';

export type EstadoAceite = 'livre' | 'salvando' | 'erro' | 'expirada';
export type PassagemCriada = { geracao: TrilhaEmGeracao; estilo: CSSProperties; reduzida: boolean; rolagem: number };
const t = mensagens.geracao;
const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A frase da linha de espera da criação (spec 17, mudança 1, revista em 23/11). Só a criação da trilha, depois de "Começar a lição 1" (de 12 a 21 s), tem frases: a linha embaixo do botão diz
 * "Escrevendo suas lições…" quando entra (1,5 s depois do toque) e, 3 s depois de entrar, a MESMA linha troca para a frase 1 de `geracao.dicas` e, a cada 5 s, para a seguinte, em laço (`dicaDaEspera`,
 * do contrato, o mesmo relógio do app). O tempo conta desde que a linha aparece: `ativa` liga quando ela entra e desliga quando ela sai (a lição abriu ou a criação falhou), e a próxima espera começa do zero.
 * `indice` é a frase da vez em `geracao.dicas` (`null` é "Escrevendo suas lições…") e `saindo` marca a primeira metade do efeito de 300 ms. A placa do alto ("Montando sua trilha") não tem frases.
 */
function useDicaDaEspera(ativa: boolean): EstadoDaEspera {
  const [estado, setEstado] = useState<EstadoDaEspera>({ indice: null, saindo: false });
  useEffect(() => {
    setEstado({ indice: null, saindo: false });
    if (!ativa) return;
    return trocarDicasDaEspera({ qualDica: (decorridoMs) => dicaDaEspera(decorridoMs, t.dicas.length), reduzido: movimentoReduzido, aoMudar: setEstado });
  }, [ativa]);
  return estado;
}

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

/**
 * A placa do alto da geração. A linha que se vê (`aria-hidden`) e o que o leitor de tela ouve são separados: a região viva (`role="status"`) só tem o texto anunciado ("Montando sua trilha", a espera
 * longa ou a proposta pronta). A placa não tem frases que se revezam (spec 17, mudança 1, revista em 23/11): elas moram na linha embaixo do botão "Começar a lição 1".
 */
export function PlacaDaGeracao({ texto, anunciado }: { texto: string; anunciado: string }) {
  return (
    <p className="previa-placa" role="status">
      <span className="somente-leitor">{anunciado}</span>
      <span className="previa-placa__linha" aria-hidden="true">{texto}</span>
    </p>
  );
}

export function PreviaTrilha({ geracao, aceite, passagem, sair, cancelar, ajustar, aceitar, salvar, visitante, remontar, existente, abrirExistente }: {
  geracao: TrilhaEmGeracao; aceite: EstadoAceite; passagem: PassagemCriada | null;
  sair: () => void; cancelar: () => void; ajustar: () => void; aceitar: (painel: HTMLElement) => void;
  salvar?: (painel: HTMLElement) => void; visitante?: boolean;
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
  const [estreito, setEstreito] = useState(false);
  /** Do momento em que a trilha fica pronta até a rolagem até o nó 1 terminar: o Stu já fica no lado do nó 1, e não pula para o troféu que passa pela tela. */
  const [indoAoPrimeiro, setIndoAoPrimeiro] = useState(false);
  const cancelarRolagem = useRef<(() => void) | null>(null);
  const salvando = aceite === 'salvando' || !!passagem;
  const falhou = aceite === 'erro' || aceite === 'expirada';
  const stuNoTrofeu = !!proposta && trofeuAVista && !indoAoPrimeiro && !salvando && !falhou;
  const fase = passagem ? 'criada' : salvando ? 'salvando' : proposta ? 'pronta' : 'montando';
  // A linha de espera embaixo do botão (spec 17, mudança 1, revista em 23/11): só enquanto a trilha é criada (depois de "Começar a lição 1"), a partir de 1,5 s depois do toque. O relógio das frases
  // começa quando ela aparece. A placa não tem frases: na geração, "Montando sua trilha" (e a espera longa de 12 s sem lição nova); com a proposta pronta, e também durante a criação, a faixa dela.
  const linhaDaEspera = !!proposta && demorou && aceite === 'salvando' && !passagem;
  const espera = useDicaDaEspera(linhaDaEspera);
  const textoDaLinha = espera.indice === null ? t.escrevendoLicoes : t.dicas[espera.indice];
  const placa = proposta ? t.propostaPronta(nos.length, proposta.fluxos.length) : semNovidade ? t.aguardandoLicao : t.montandoTitulo;
  // O leitor de tela ouve só "Montando sua trilha", a espera longa e a proposta pronta; a criação da trilha é anunciada uma vez por `anuncioCriando` (em estudo.tsx, no toque em "Começar a lição 1"),
  // e a linha de espera, com as frases, não é região viva: a troca a cada 5 s não é anunciada.
  const placaAnunciada = proposta ? `${t.propostaPronta(nos.length, proposta.fluxos.length)} ${t.comecarLicao1}.` : semNovidade ? t.aguardandoLicao : t.montandoTitulo;

  useLayoutEffect(() => {
    const largura = window.matchMedia('(max-width: 600px)');
    const atualizar = () => setEstreito(largura.matches);
    atualizar();
    largura.addEventListener('change', atualizar);
    return () => largura.removeEventListener('change', atualizar);
  }, []);
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
      if (acompanhando) {
        // Spec 16, item 1: a trilha pronta mostra a lição 1, não o fim. O nó 1 vai para o centro da área livre em 600 ms (direto, com movimento reduzido), o Stu fica ao lado
        // dele, e o troféu continua a uma rolagem de distância ("Ver o fim da trilha").
        const primeiro = area.querySelector<HTMLElement>('[data-primeiro] .previa-no__face');
        if (primeiro) {
          const caixa = primeiro.getBoundingClientRect();
          const alvo = rolagemParaCentrarNo({
            centroDoNoNaTela: caixa.top + caixa.height / 2, topoDaArea: area.getBoundingClientRect().top, alturaDaArea: area.clientHeight, rolagem: area.scrollTop, alturaDoConteudo: area.scrollHeight,
          });
          cancelarRolagem.current?.();
          setIndoAoPrimeiro(true);
          cancelarRolagem.current = rolarAte(area, alvo, movimentoReduzido() ? 0 : DURACAO_ATE_O_NO_1_MS, () => setIndoAoPrimeiro(false));
        }
        painel.current?.querySelector<HTMLButtonElement>('.previa-comecar')?.focus({ preventScroll: true });
      }
      return;
    }
    propostaApresentada.current = null;
    const vaga = area.querySelector<HTMLElement>('[data-mais-novo]');
    if (!vaga || !acompanhando) return;
    const centro = vaga.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop + vaga.offsetHeight / 2;
    // A mesma rolagem própria da trilha pronta (sem `scrollTo` suave nativo): o que anda nesta área é sempre uma só, e a proposta que chega no meio dela a substitui.
    cancelarRolagem.current?.();
    cancelarRolagem.current = rolarAte(area, Math.max(0, centro - area.clientHeight * 0.6), movimentoReduzido() ? 0 : DURACAO_ACOMPANHAR_MS, () => undefined);
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
      cancelarRolagem.current?.();
      cancelarRolagem.current = rolarAte(area, Math.max(0, destino), movimentoReduzido() ? 0 : DURACAO_ACOMPANHAR_MS, () => undefined);
    }
  }

  useLayoutEffect(() => {
    const area = mapa.current;
    if (!area) return;
    if (aceite === 'erro' || aceite === 'expirada') { area.scrollTop = 0; return; }
    if (aceite !== 'salvando' && !passagem) return;
    // A pessoa tocou em "Começar a lição 1" no meio da rolagem até o nó 1: a volta ao topo da passagem assume.
    cancelarRolagem.current?.();
    setIndoAoPrimeiro(false);
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

  useEffect(() => () => cancelarRolagem.current?.(), []);
  useEffect(() => {
    if (!proposta || !mapa.current || !trofeu.current) {
      setViuTrofeu(false); setTrofeuAVista(false); return;
    }
    const observador = new IntersectionObserver((entradas) => {
      const entrada = entradaMaisNova(entradas);
      if (!entrada) return;
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

  const acaoPrincipal = proposta && (
    <Botao key="principal" className="previa-comecar" aria-disabled={salvando} aria-busy={salvando || undefined} onClick={() => {
      if (!painel.current || salvando) return;
      if (aceite === 'expirada') { remontar(); return; }
      aceitar(painel.current);
    }}>
      {salvando && <span className="previa-giro" aria-hidden="true" />}
      {salvando ? t.criandoTrilha : aceite === 'expirada' ? t.montarDeNovo : t.comecarLicao1}
    </Botao>
  );
  const acaoSecundaria = (
    <Botao key="secundaria" className="previa-ajustar" variante="secundario" disabled={salvando} onClick={proposta ? ajustar : cancelar}>
      {proposta ? t.ajustar : t.cancelar}
    </Botao>
  );
  const erroDoAceite = falhou && (
    <p key="erro" className="previa-erro" role="alert">{aceite === 'expirada' ? t.propostaExpirada : t.erroCriacao}</p>
  );

  return <section ref={painel} className="painel painel--geracao" data-fase={fase} data-passagem={passagem ? (passagem.reduzida ? 'reduzida' : 'circulo') : undefined}
    style={passagem?.estilo} inert={!!passagem}>
    <header className="previa-cabecalho">
      <button type="button" className="previa-voltar" aria-label={mensagens.planos.titulo} onClick={sair}><Icone nome="seta" /></button>
      <h1 tabIndex={-1}>{geracao.titulo || geracao.objetivo}</h1>
    </header>
    <div className="previa-palco">
      <PlacaDaGeracao texto={placa} anunciado={placaAnunciada} />
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
              {fronteira && <>
                <Fronteira trechoSeguinte={seguinte.trecho} />
                <span className="previa-marco" style={coresDaRegiao(seguinte.trecho)}><Icone nome="bandeira" />{mensagens.trilha.parte(seguinte.trecho + 1)}</span>
              </>}
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
    {proposta?.diagnostico && <div className="previa-diagnostico"><ResumoDiagnostico perfil={proposta.diagnostico} /></div>}
    <footer className="previa-rodape" data-proposta={!!proposta || undefined} data-salvando={salvando || undefined} data-falha={falhou || undefined}>
      <div className="previa-botoes">
        {estreito ? [acaoPrincipal, erroDoAceite, acaoSecundaria] : [acaoSecundaria, acaoPrincipal, erroDoAceite]}
        {proposta && salvar && !salvando && aceite !== 'expirada' && <div className="previa-salvar">
          <Botao variante="texto" onClick={() => { if (painel.current) salvar(painel.current); }}>Salvar para depois</Botao>
          <p>{visitante ? 'Depois de salvar, disponível por até 24 h a partir da entrada neste navegador.' : 'A proposta entra em Minhas trilhas ao salvar ou começar.'}</p>
        </div>}
        {proposta && <p className="previa-espera" data-visivel={linhaDaEspera || undefined}>
          <span className="previa-espera__linha" data-saindo={espera.saindo || undefined}>{textoDaLinha}</span>
        </p>}
      </div>
    </footer>
    {passagem && !passagem.reduzida && <div className="previa-circulo" aria-hidden="true" onAnimationStart={() => {
      if (!painel.current || !mapa.current) return;
      mapa.current.scrollTop = 0;
      for (const [nome, valor] of Object.entries(origemDoCirculo(painel.current))) painel.current.style.setProperty(nome, valor);
    }} />}
  </section>;
}
