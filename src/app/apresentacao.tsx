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
  concluir,
}: {
  primeiraVez: boolean;
  semSessao?: boolean;
  rotuloFinalUltimo?: string;
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

  return (
    <section className="painel painel--apresentacao" aria-labelledby="apresentacao-titulo" onKeyDown={teclas}>
      <header className="apresentacao-topo">
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
        <div className="apresentacao-arte" key={passo} data-direcao={direcao} aria-hidden="true">
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
        <div className="apresentacao-rodape__conteudo">
          {passo > 0 && <Botao variante="secundario" onClick={() => irPara(passo - 1)}>{mensagens.apresentacao.voltar}</Botao>}
          <Botao onClick={avancar}>{rotuloFinal}{!ultimo && <Icone nome="seta" />}</Botao>
        </div>
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
          <span className="aula-citacao__selo">[1] {mensagens.estudio.fonteMaterial}</span>
          <strong>{ex.fonteArquivo}</strong>
          <span className="estudio-selo">{mensagens.estudio.simulado}</span>
        </div>
        <blockquote>{ex.fonteTrecho}</blockquote>
      </div>
    </div>
  );
}

function ArtePonte() {
  const m = mensagens.estudio;
  return (
    <div className="apresentacao-quadro apresentacao-quadro--ponte">
      <div className="ponte-cena" data-concluida="true">
        <div className="ponte-margem ponte-margem--esquerda">
          <div className="ponte-stu">
            <Stu />
          </div>
          <span>{m.ponteMargemErro}</span>
        </div>
        <div className="ponte-vao">
          <span className="ponte-tabua" data-ativa="true" data-erro="true">{m.ponteTabuaErro}</span>
          <span className="ponte-tabua" data-ativa="true">{m.pontePassoExplicacao}</span>
          <span className="ponte-tabua" data-ativa="true">{m.pontePassoExemplo}</span>
          <span className="ponte-tabua" data-ativa="true">{m.pontePassoDesafio}</span>
        </div>
        <div className="ponte-margem ponte-margem--direita">
          <div className="ponte-stu-alvo" />
          <span>{m.ponteMargemVolta}</span>
        </div>
      </div>
      <p className="estudio-legenda">{m.simulado}</p>
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
        <div className="ensino-caderno__cartao" data-tipo="lacuna">
          <h3>{m.lacuna}</h3>
          <p>{ex.ensinoLacuna}</p>
        </div>
        <div className="ensino-caderno__cartao ensino-caderno__pergunta" data-tipo="pergunta">
          <div className="ensino-caderno__stu">
            <Stu />
            <span className="ensino-caderno__duvida">?</span>
          </div>
          <div>
            <h3>{m.pergunta}</h3>
            <p>{ex.ensinoPergunta}</p>
          </div>
        </div>
        <div className="ensino-caderno__cartao" data-tipo="proximo">
          <h3>{m.proximo}</h3>
          <p>{ex.ensinoProximo}</p>
        </div>
        <p className="estudio-legenda">{m.ensinoAutomatico}</p>
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
