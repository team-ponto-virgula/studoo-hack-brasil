'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Stu } from './componentes';
import './caminho.css';

export type EstadoNo = 'concluida' | 'atual' | 'bloqueada' | 'previa';
/** Lição no caminho; `trecho` é a posição do fluxo e só serve para desenhar o marco entre um trecho e outro. */
export type NoCaminho = { id: string; titulo: string; estado: EstadoNo; trecho: number };

type NomeIcone = 'check' | 'livro' | 'revisao' | 'cadeado' | 'bandeira' | 'trofeu' | 'fechar';

const desenhos: Record<NomeIcone, ReactNode> = {
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  livro: <path d="M12 6.5C10.3 5.3 8 4.8 4.5 5v12.5c3.5-.2 5.8.3 7.5 1.5 1.7-1.2 4-1.7 7.5-1.5V5c-3.5-.2-5.8.3-7.5 1.5zM12 6.5V19" />,
  revisao: <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6" />,
  cadeado: <><rect x="5.5" y="10.5" width="13" height="9" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  bandeira: <path d="M6 20V4.5M6 5h10.5l-2 3.5 2 3.5H6" />,
  trofeu: <path d="M8 4.5h8V10a4 4 0 0 1-8 0V4.5zM8 6.5H5.5a2.5 2.5 0 0 0 2.5 3.5M16 6.5h2.5a2.5 2.5 0 0 1-2.5 3.5M12 14v3.5M8.5 20h7" />,
  fechar: <path d="M7 7l10 10M17 7L7 17" />,
};

export function Icone({ nome }: { nome: NomeIcone }) {
  return (
    <svg className="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {desenhos[nome]}
    </svg>
  );
}

/**
 * Ícone do nó: concluída mostra o visto e bloqueada o cadeado; a atual e a prévia mostram o tipo da lição.
 * O contrato ainda não tem o tipo da lição, então a revisão é reconhecida pelo título ("Revisão…").
 */
function iconeDoNo(no: NoCaminho): NomeIcone {
  if (no.estado === 'concluida') return 'check';
  if (no.estado === 'bloqueada') return 'cadeado';
  return no.titulo.trim().toLocaleLowerCase('pt-BR').startsWith('revis') ? 'revisao' : 'livro';
}

/** Curva da ligação: de um lado ao outro entre dois nós, ou do último nó até a chegada, no centro. */
function tracado(lado: 'esquerda' | 'direita', ateChegada: boolean) {
  const de = lado === 'esquerda' ? 25 : 75;
  const ate = ateChegada ? 50 : 100 - de;
  return `M${de} 0C${de} 50 ${ate} 50 ${ate} 100`;
}

/** O que falta para liberar um nó: as lições pendentes antes dele, a começar pela atual. */
function explicar(nos: readonly NoCaminho[], indice: number) {
  if (nos[indice].estado === 'concluida') return mensagens.trilha.concluidaTexto;
  const pendentes = nos.slice(0, indice).filter((anterior) => anterior.estado !== 'concluida');
  const comeco = pendentes.find((anterior) => anterior.estado === 'atual') ?? pendentes[0];
  if (!comeco) return mensagens.trilha.bloqueadaSemPasso;
  return pendentes.length === 1
    ? mensagens.trilha.bloqueadaUma(comeco.titulo)
    : mensagens.trilha.bloqueadaVarias(pendentes.length, comeco.titulo);
}

/**
 * Caminho único e contínuo de lições, na ordem de aprendizado, com nós que alternam de lado.
 * Não agrupa por assunto: entre um trecho e outro aparece só um marco discreto, sem nome.
 * O nó atual abre a lição; concluído ou bloqueado abre um balão que explica o estado.
 * Com `stu`, o Stu abre o caminho com essa frase curta (uma vez por tela, sem balão de fala).
 * Com `chegada`, o caminho termina num marco de chegada, que fica cheio quando todas as lições estão concluídas.
 */
export function Caminho({ nos, stu, chegada = true, ocupado = false, abrindo = null, liberadas = [], rolarPara = null, aoAbrir }: {
  nos: readonly NoCaminho[];
  stu?: string;
  chegada?: boolean;
  ocupado?: boolean;
  abrindo?: string | null;
  liberadas?: readonly string[];
  rolarPara?: string | null;
  aoAbrir?: (no: NoCaminho) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const balao = useRef<HTMLDivElement>(null);
  const base = useId();
  const primeiraLiberada = liberadas[0] ?? null;
  const total = nos.length;
  const comChegada = chegada && total > 0;
  const tudoFeito = total > 0 && nos.every((no) => no.estado === 'concluida');

  useEffect(() => {
    if (!primeiraLiberada) return;
    const titulo = nos.find((no) => no.id === primeiraLiberada)?.titulo;
    if (!titulo) return;
    const espera = window.setTimeout(() => setAnuncio(mensagens.trilha.liberada(titulo)), 900);
    return () => window.clearTimeout(espera);
  }, [primeiraLiberada, nos]);

  useEffect(() => {
    if (!rolarPara) return;
    const quadro = window.requestAnimationFrame(() => {
      const item = botoes.current.get(rolarPara)?.closest('li');
      if (!item) return;
      const caixa = item.getBoundingClientRect();
      if (caixa.top < 0 || caixa.bottom > window.innerHeight - 128) item.scrollIntoView({ block: 'center' });
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [rolarPara]);

  useEffect(() => {
    if (ocupado) setAberto(null);
  }, [ocupado]);

  useEffect(() => {
    if (!aberto) return;
    const id = aberto;
    balao.current?.focus({ preventScroll: true });
    balao.current?.scrollIntoView({ block: 'nearest' });

    function aoTocarFora(evento: PointerEvent) {
      const item = botoes.current.get(id)?.closest('li');
      if (item && evento.target instanceof Node && !item.contains(evento.target)) setAberto(null);
    }

    document.addEventListener('pointerdown', aoTocarFora);
    return () => document.removeEventListener('pointerdown', aoTocarFora);
  }, [aberto]);

  function tocar(no: NoCaminho) {
    if (no.estado === 'atual') {
      setAberto(null);
      aoAbrir?.(no);
      return;
    }
    setAberto((atual) => atual === no.id ? null : no.id);
  }

  function fechar() {
    const id = aberto;
    setAberto(null);
    if (id) botoes.current.get(id)?.focus();
  }

  function guardarBotao(id: string, elemento: HTMLButtonElement | null) {
    if (elemento) botoes.current.set(id, elemento);
    else botoes.current.delete(id);
  }

  return (
    <div className="caminho">
      {stu && (
        <div className="caminho-stu">
          <p>{stu}</p>
          <Stu />
        </div>
      )}
      <ol className="caminho-nos" role="list" aria-label={mensagens.trilha.licoes}>
        {nos.map((no, indice) => {
          const seguinte = nos[indice + 1];
          const fimDoTrecho = seguinte !== undefined && seguinte.trecho !== no.trecho;
          const vaiAteChegada = seguinte === undefined && comChegada;
          const lado = indice % 2 === 0 ? 'esquerda' : 'direita';
          const atual = no.estado === 'atual';
          const estaAberto = aberto === no.id;
          const liberada = liberadas.includes(no.id);
          const idBalao = `${base}-balao-${indice}`;
          const posicao = mensagens.trilha.posicao(indice + 1, total);
          const estado = mensagens.trilha.estados[no.estado];
          const nome = atual
            ? mensagens.trilha.nomeNoAtual(no.titulo, posicao)
            : mensagens.trilha.nomeNo(no.titulo, posicao, estado.toLocaleLowerCase('pt-BR'));
          let linha = no.estado === 'previa' ? posicao : estado;
          if (abrindo === no.id) linha = mensagens.trilha.abrindo;

          const conteudo = (
            <>
              <span className="caminho-no__lente" aria-hidden="true">
                <Icone nome={iconeDoNo(no)} />
                {liberada && <span className="caminho-no__cadeado"><Icone nome="cadeado" /></span>}
                {atual && <span className="caminho-no__etiqueta">{mensagens.trilha.comecar}</span>}
              </span>
              <span className="caminho-no__texto" aria-hidden="true">
                <span className="caminho-no__titulo">{no.titulo}</span>
                <span className="caminho-no__estado">{linha}</span>
              </span>
            </>
          );

          return (
            <li key={no.id} className="caminho-no" data-estado={no.estado} data-lado={lado}
              data-fim-trecho={fimDoTrecho || undefined} data-liberada={liberada || undefined} data-aberto={estaAberto || undefined}
              onKeyDown={(evento) => {
                if (evento.key !== 'Escape' || !estaAberto) return;
                evento.stopPropagation();
                fechar();
              }}
              onBlur={(evento) => {
                const destino = evento.relatedTarget;
                if (estaAberto && destino instanceof Node && !evento.currentTarget.contains(destino)) setAberto(null);
              }}>
              {(seguinte || vaiAteChegada) && (
                <span className="caminho-ligacao" data-feita={no.estado === 'concluida' || undefined} aria-hidden="true">
                  <svg className="caminho-conector" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
                    <path d={tracado(lado, vaiAteChegada)} />
                  </svg>
                  {fimDoTrecho && <span className="caminho-marco"><Icone nome="bandeira" /></span>}
                </span>
              )}
              {no.estado === 'previa' ? (
                <div className="caminho-no__alvo">
                  {conteudo}
                  <span className="somente-leitor">{nome}</span>
                </div>
              ) : (
                <button type="button" className="caminho-no__alvo" ref={(elemento) => guardarBotao(no.id, elemento)}
                  aria-label={nome} aria-haspopup={atual ? undefined : 'dialog'} aria-expanded={atual ? undefined : estaAberto}
                  aria-controls={estaAberto ? idBalao : undefined} disabled={ocupado} onClick={() => tocar(no)}>
                  {conteudo}
                </button>
              )}
              {estaAberto && (
                <>
                  <span className="caminho-balao__seta" aria-hidden="true" />
                  <div className="caminho-balao" id={idBalao} ref={balao} role="dialog" tabIndex={-1}
                    aria-labelledby={`${idBalao}-titulo`} aria-describedby={`${idBalao}-texto`}>
                    <div className="caminho-balao__topo">
                      <p className="caminho-balao__titulo" id={`${idBalao}-titulo`}>{no.titulo}</p>
                      <button type="button" className="caminho-balao__fechar" aria-label={mensagens.trilha.fechar} onClick={fechar}>
                        <Icone nome="fechar" />
                      </button>
                    </div>
                    <p className="caminho-balao__texto" id={`${idBalao}-texto`}>{explicar(nos, indice)}</p>
                    {no.estado === 'concluida' && aoAbrir && (
                      <Botao variante="secundario" onClick={() => {
                        setAberto(null);
                        aoAbrir(no);
                      }}>{mensagens.trilha.refazer}</Botao>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {comChegada && (
        <div className="caminho-chegada" data-feita={tudoFeito || undefined}>
          <span className="caminho-chegada__lente" aria-hidden="true"><Icone nome="trofeu" /></span>
          <p className="caminho-chegada__texto">{tudoFeito ? mensagens.trilha.chegadaFeita : mensagens.trilha.chegada}</p>
        </div>
      )}
      <p className="somente-leitor" role="status">{anuncio}</p>
    </div>
  );
}

export function SkeletonTrilha() {
  return (
    <div className="skeleton-trilha" role="status">
      <p className="somente-leitor">{mensagens.trilha.carregando}</p>
      <div className="skeleton-trilha__cabecalho" aria-hidden="true">
        <span /><span /><span />
      </div>
      <div className="skeleton-trilha__caminho" aria-hidden="true">
        <span className="skeleton-trilha__no" data-lado="esquerda" />
        <span className="skeleton-trilha__no" data-lado="direita" />
        <span className="skeleton-trilha__no" data-lado="esquerda" />
        <span className="skeleton-trilha__no" data-lado="direita" />
      </div>
    </div>
  );
}
