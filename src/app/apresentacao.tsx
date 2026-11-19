'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Desenho, Icone, Stu, coresDaRegiao } from '../ui';
import { iconesDosTemas, type IdTema } from './pedido';
import './apresentacao.css';
import './aula.css';
import './estudio.css';

const chave = 'studoo.apresentacao';

/** A apresentação aparece uma vez por navegador; sem armazenamento disponível, ela volta a aparecer no próximo acesso. */
export function apresentacaoVista() {
  try {
    return window.localStorage.getItem(chave) === 'vista';
  } catch {
    return false;
  }
}

export function marcarApresentacaoVista() {
  try {
    window.localStorage.setItem(chave, 'vista');
  } catch {
    // Sem armazenamento, a apresentação aparece de novo; nada mais depende disso.
  }
}

/** Áreas para escolher no último passo: as do pedido, menos Populares. */
const areasDaApresentacao = mensagens.pedido.temas.filter((tema) => tema.id !== 'populares');

/**
 * Apresentação do Studoo em cinco passos: o Stu, qualquer assunto, a trilha que nasce, o progresso salvo e, por fim,
 * a área que interessa, que já abre o pedido com as ideias dela. Na primeira vez termina em "Criar minha primeira
 * trilha"; reaberta pelo pedido, termina em "Entendi". Pular encerra a qualquer momento. Cada passo entra deslizando
 * na direção em que a pessoa anda. O título de cada passo recebe o foco e diz a posição ("Passo 2 de 5"); as setas do
 * teclado também avançam e voltam. As ilustrações são decorativas.
 */
export function Apresentacao({
  primeiraVez,
  semSessao = false,
  rotuloFinalUltimo,
  aoEntrar,
  concluir,
}: {
  primeiraVez: boolean;
  semSessao?: boolean;
  rotuloFinalUltimo?: string;
  /**
   * Sem sessão (o tour da entrada), o último passo oferece "Entrar" (banca da noite, item 2): com o modo visitante,
   * empilhado embaixo de "Experimentar sem conta"; sem ele, sozinho, como o principal.
   */
  aoEntrar?: () => void;
  concluir: (area?: IdTema, concluiuFinal?: boolean) => void;
}) {
  const [passo, setPasso] = useState(0);
  const [direcao, setDirecao] = useState<'frente' | 'tras'>('frente');
  const [area, setArea] = useState<IdTema | undefined>();
  const titulo = useRef<HTMLHeadingElement>(null);
  const passos = semSessao ? mensagens.apresentacao.passos.slice(0, 4) : mensagens.apresentacao.passos;
  const total = passos.length;
  const ultimo = passo === total - 1;
  const posicao = mensagens.apresentacao.posicao(passo + 1, total);
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      if (semSessao) titulo.current?.focus();
      return;
    }
    titulo.current?.focus();
  }, [passo, semSessao]);

  useEffect(() => {
    function aoTeclar(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        concluir();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [concluir]);

  function irPara(destino: number) {
    setDirecao(destino < passo ? 'tras' : 'frente');
    setPasso(destino);
  }

  function avancar() {
    if (ultimo) concluir(area, true);
    else irPara(passo + 1);
  }

  function teclas(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      concluir();
      return;
    }
    if (evento.key === 'ArrowRight' && !ultimo) {
      evento.preventDefault();
      irPara(passo + 1);
    } else if (evento.key === 'ArrowLeft' && passo > 0) {
      evento.preventDefault();
      irPara(passo - 1);
    }
  }

  let rotuloFinal: string = mensagens.apresentacao.continuar;
  if (ultimo) rotuloFinal = rotuloFinalUltimo ?? (primeiraVez ? mensagens.apresentacao.comecar : mensagens.apresentacao.entendi);
  // Último passo do tour da entrada: as ações são as de entrar. "Voltar" sobe para o alto (no lugar de "Pular") em todo
  // último passo, com sessão ou sem ela (spec 04, decidido em 20/11), e embaixo ficam só as ações do passo.
  const finalDaEntrada = ultimo && semSessao && aoEntrar !== undefined;
  const voltarNoAlto = ultimo && passo > 0;
  const duasAcoes = finalDaEntrada && Boolean(rotuloFinalUltimo);

  // A arte ocupa 52% da altura útil (entre o alto e o rodapé), de 280 a 420, como no app (277466c). No último passo com
  // as duas ações, numa janela baixa, ela cede até 200 px (nunca abaixo de 80) para o título e o texto caberem sem rolar.
  // No computador fica a altura do CSS.
  const secao = useRef<HTMLElement>(null);
  const [alturaArte, setAlturaArte] = useState<number | null>(null);
  useEffect(() => {
    const medir = () => {
      const raiz = secao.current;
      if (!raiz || window.innerWidth >= 768) { setAlturaArte(null); return; }
      const topo = raiz.querySelector('.apresentacao-topo')?.getBoundingClientRect().bottom ?? 0;
      const rodape = raiz.querySelector('.apresentacao-rodape')?.getBoundingClientRect().height ?? 0;
      const util = window.innerHeight - topo - rodape;
      let arte = Math.round(Math.min(420, Math.max(280, util * 0.52)));
      if (duasAcoes) {
        const textos = raiz.querySelector<HTMLElement>('.apresentacao-textos')?.scrollHeight ?? 0;
        arte = Math.max(Math.max(80, arte - 200), Math.min(arte, Math.floor(util - 64 - textos)));
      }
      setAlturaArte(arte);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [passo, duasAcoes]);

  return (
    <section ref={secao} className="painel painel--apresentacao" aria-labelledby="apresentacao-titulo" onKeyDown={teclas}>
      <header className="apresentacao-topo" data-voltar={voltarNoAlto || undefined}>
        {voltarNoAlto && (
          <Botao variante="texto" className="apresentacao-voltar-alto" onClick={() => irPara(passo - 1)}><Icone nome="setaVoltar" />{mensagens.apresentacao.voltar}</Botao>
        )}
        <div className="apresentacao-andamento" aria-hidden="true">
          <span className="apresentacao-pontos">
            {passos.map((item, indice) => (
              <span key={item.titulo} data-ativo={indice === passo || undefined} data-feito={indice < passo || undefined} />
            ))}
          </span>
          <span className="apresentacao-posicao">{posicao}</span>
        </div>
        {!ultimo && <Botao variante="texto" onClick={() => concluir()}>{mensagens.apresentacao.pular}</Botao>}
      </header>
      {passo < 4 ? (
        <div className="apresentacao-arte" key={passo} data-direcao={direcao} aria-hidden="true" style={alturaArte ? { height: alturaArte } : undefined}>
          {passo === 0 && <ArteMaterial />}
          {passo === 1 && <ArtePonte />}
          {passo === 2 && <ArteExplique />}
          {passo === 3 && <ArteProgresso />}
        </div>
      ) : (
        <div className="apresentacao-arte apresentacao-areas" key={passo} data-direcao={direcao} role="group"
          aria-label={mensagens.apresentacao.areas}>
          {areasDaApresentacao.map((item, indice) => (
            <button key={item.id} type="button" className="apresentacao-area" aria-pressed={area === item.id}
              style={{ '--i': indice } as CSSProperties} onClick={() => setArea((atual) => (atual === item.id ? undefined : item.id))}>
              <Desenho nome={iconesDosTemas[item.id]} />
              {item.nome}
            </button>
          ))}
        </div>
      )}
      <div className="apresentacao-textos" key={`textos-${passo}`} data-direcao={direcao}>
        <h1 id="apresentacao-titulo" tabIndex={-1} ref={titulo}>
          <span className="somente-leitor">{posicao}: </span>{passos[passo].titulo}
        </h1>
        <p className="introducao">{passos[passo].texto}</p>
      </div>
      <footer className="apresentacao-rodape">
        {finalDaEntrada ? (
          // Ação em cima, a alternativa embaixo (spec 11): o rótulo de experimentar não cabe na metade.
          <div className="apresentacao-rodape__conteudo apresentacao-rodape__conteudo--entrada" data-empilhado>
            {rotuloFinalUltimo ? (
              <>
                <Botao onClick={avancar}>{rotuloFinalUltimo}</Botao>
                <Botao variante="secundario" onClick={aoEntrar}>{mensagens.login.entrar}</Botao>
              </>
            ) : <Botao onClick={aoEntrar}>{mensagens.login.entrar}</Botao>}
          </div>
        ) : (
          <div className="apresentacao-rodape__conteudo" data-empilhado={(ultimo && rotuloFinal.length > 14) || undefined}>
            {passo > 0 && !voltarNoAlto && <Botao variante="secundario" onClick={() => irPara(passo - 1)}>{mensagens.apresentacao.voltar}</Botao>}
            <Botao onClick={avancar}>{rotuloFinal}{!ultimo && <Icone nome="seta" />}</Botao>
          </div>
        )}
      </footer>
    </section>
  );
}

function ArteMaterial() {
  const ex = mensagens.apresentacao.exemplos;
  return (
    <div className="apresentacao-quadro">
      <div className="aula-citacao">
        <div className="aula-citacao__topo">
          <span className="aula-citacao__selo">{mensagens.estudio.fonteMaterial}</span>
          <strong>{ex.fonteArquivo}</strong>
        </div>
        <blockquote>{ex.fonteTrecho}</blockquote>
      </div>
      {/* Sem o selo "Modo demonstração" (serve para conteúdo simulado, não para ilustração); o Stu estudando ao lado. */}
      <span className="apresentacao-stu-estudando"><Stu expressao="stu-estudando" tamanho={160} sombra /></span>
    </div>
  );
}

function ArtePonte() {
  const m = mensagens.estudio;
  return (
    <div className="apresentacao-quadro apresentacao-quadro--ponte">
      <div className="ponte-cena" data-concluida="true">
        <div className="ponte-margem ponte-margem--esquerda">
          <div className="ponte-stu-alvo" />
          <span>{m.ponteMargemErro}</span>
        </div>
        <div className="ponte-vao">
          <span className="ponte-tabua" data-ativa="true" data-erro="true">{m.ponteTabuaErro}</span>
          <span className="ponte-tabua" data-ativa="true">{m.pontePassoExplicacao}</span>
          <span className="ponte-tabua" data-ativa="true">{m.pontePassoExemplo}</span>
          <span className="ponte-tabua" data-ativa="true">{m.pontePassoDesafio}</span>
        </div>
        <div className="ponte-margem ponte-margem--direita">
          <div className="ponte-stu">
            <Stu expressao="stu-perfil" tamanho={44} />
          </div>
          <span>{m.ponteMargemVolta}</span>
        </div>
      </div>
      <ol className="ponte-legenda apresentacao-ponte-legenda" aria-hidden="true">
        <li data-ativa="true" data-erro="true" data-vencida="true"><span className="ponte-legenda__num">1</span><span>{m.ponteTabuaErro}</span></li>
        <li data-ativa="true" data-vencida="true"><span className="ponte-legenda__num">2</span><span>{m.pontePassoExplicacao}</span></li>
        <li data-ativa="true" data-vencida="true"><span className="ponte-legenda__num">3</span><span>{m.pontePassoExemplo}</span></li>
        <li data-ativa="true" data-vencida="true"><span className="ponte-legenda__num">4</span><span>{m.pontePassoDesafio}</span></li>
      </ol>
    </div>
  );
}

function ArteExplique() {
  const m = mensagens.estudio;
  const ex = mensagens.apresentacao.exemplos;
  return (
    <div className="apresentacao-quadro apresentacao-quadro--explique">
      <div className="ensino-caderno apresentacao-caderno">
        <div className="ensino-caderno__cartao" data-tipo="acertos">
          <h3>{m.acertos}</h3>
          <ul>
            <li><span className="ensino-caderno__visto">✓</span><span>{ex.ensinoAcertos}</span></li>
          </ul>
        </div>
        <div className="ensino-caderno__cartao" data-tipo="proximo">
          <h3>{m.proximo}</h3>
          <p>{ex.ensinoProximo}</p>
        </div>
        {/* Só dois cartões, com textos de 14 px no mínimo, e o Stu concentrado (banca da noite, item 2). */}
        <span className="apresentacao-stu-concentrado"><Stu expressao="stu-concentrado" tamanho={80} /></span>
      </div>
    </div>
  );
}

/** Trilha vencida: lições concluídas, o troféu dourado no topo da montanha, ponte construída e selo de sincronia. */
function ArteProgresso() {
  return (
    <div className="mini-trilha mini-trilha--feita apresentacao-mapa" style={coresDaRegiao(2)}>
      <MiniEstrada feita />
      <Desenho nome="picos" className="mini-trilha__enfeite" style={{ '--x': '14%', '--y': '24%', '--tam': '22%', '--atraso': '0ms' } as CSSProperties} />
      <Desenho nome="pinheiro" className="mini-trilha__enfeite" style={{ '--x': '86%', '--y': '64%', '--tam': '9%', '--atraso': '0ms' } as CSSProperties} />
      <span className="mini-trilha__no" data-estado="concluida" style={{ '--x': '30%', '--y': '78%' } as CSSProperties}><Icone nome="check" /></span>
      <span className="mini-trilha__no" data-estado="concluida" style={{ '--x': '68%', '--y': '50%' } as CSSProperties}><Icone nome="check" /></span>
      <span className="mini-trilha__no mini-trilha__no--trofeu" style={{ '--x': '38%', '--y': '20%' } as CSSProperties}><Icone nome="trofeu" /></span>
      {/* O Stu comemora ao lado do troféu (spec 13, §B4), em 40 px, de pé no chão da miniatura. */}
      <span className="mini-trilha__stu" style={{ '--x': '55%', '--y': '27%' } as CSSProperties}>
        <Stu expressao="stu-comemorando" tamanho={40} animado="uma-vez" sombra />
      </span>
      <span className="selo-sincronia apresentacao-sincronia" data-estado="salvo">
        <span className="selo-sincronia__ponto" />
        <span>{mensagens.sincronia.salvo}</span>
      </span>
      <span className="mini-trilha__selo"><Icone nome="check" />{mensagens.estudio.ponteMapaFeita}</span>
    </div>
  );
}

function MiniEstrada({ feita = false }: { feita?: boolean }) {
  const tracado = 'M96 156C96 120 218 132 218 100S122 64 122 40';
  return (
    <svg className="mini-trilha__estrada" viewBox="0 0 320 200" preserveAspectRatio="none" focusable="false">
      <path d={tracado} className="mini-trilha__chao" />
      <path d={tracado} className={feita ? 'mini-trilha__linha mini-trilha__linha--feita' : 'mini-trilha__linha'} />
    </svg>
  );
}
