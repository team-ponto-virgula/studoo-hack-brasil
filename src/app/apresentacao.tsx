'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Desenho, Icone, Paisagem, Stu, coresDaRegiao, type NomeDesenho } from '../ui';
import { iconesDosTemas, type IdTema } from './pedido';
import './apresentacao.css';

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

const temasDaArte: readonly { nome: string; icone: NomeDesenho }[] = [
  { nome: mensagens.apresentacao.temas[0], icone: 'temaMusica' },
  { nome: mensagens.apresentacao.temas[1], icone: 'temaIdiomas' },
  { nome: mensagens.apresentacao.temas[2], icone: 'temaMatematica' },
  { nome: mensagens.apresentacao.temas[3], icone: 'temaArtes' },
  { nome: mensagens.apresentacao.temas[4], icone: 'temaDiaADia' },
  { nome: mensagens.apresentacao.temas[5], icone: 'temaTecnologia' },
];

/** Áreas para escolher no último passo: as do pedido, menos Populares. */
const areasDaApresentacao = mensagens.pedido.temas.filter((tema) => tema.id !== 'populares');

/**
 * Apresentação do Studoo em cinco passos: o Stu, qualquer assunto, a trilha que nasce, o progresso salvo e, por fim,
 * a área que interessa, que já abre o pedido com as ideias dela. Na primeira vez termina em "Criar minha primeira
 * trilha"; reaberta pelo pedido, termina em "Entendi". Pular encerra a qualquer momento. Cada passo entra deslizando
 * na direção em que a pessoa anda. O título de cada passo recebe o foco e diz a posição ("Passo 2 de 5"); as setas do
 * teclado também avançam e voltam. As ilustrações são decorativas.
 */
export function Apresentacao({ primeiraVez, concluir }: { primeiraVez: boolean; concluir: (area?: IdTema) => void }) {
  const [passo, setPasso] = useState(0);
  const [direcao, setDirecao] = useState<'frente' | 'tras'>('frente');
  const [area, setArea] = useState<IdTema | undefined>();
  const titulo = useRef<HTMLHeadingElement>(null);
  const passos = mensagens.apresentacao.passos;
  const total = passos.length;
  const ultimo = passo === total - 1;
  const posicao = mensagens.apresentacao.posicao(passo + 1, total);
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    titulo.current?.focus();
  }, [passo]);

  function irPara(destino: number) {
    setDirecao(destino < passo ? 'tras' : 'frente');
    setPasso(destino);
  }

  function avancar() {
    if (ultimo) concluir(area);
    else irPara(passo + 1);
  }

  function teclas(evento: KeyboardEvent<HTMLElement>) {
    if (evento.key === 'ArrowRight' && !ultimo) {
      evento.preventDefault();
      irPara(passo + 1);
    } else if (evento.key === 'ArrowLeft' && passo > 0) {
      evento.preventDefault();
      irPara(passo - 1);
    }
  }

  let rotuloFinal: string = mensagens.apresentacao.continuar;
  if (ultimo) rotuloFinal = primeiraVez ? mensagens.apresentacao.comecar : mensagens.apresentacao.entendi;

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
          {passo === 0 && <ArteStu />}
          {passo === 1 && <ArteTemas />}
          {passo === 2 && <ArteTrilha />}
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

function ArteStu() {
  return (
    <Paisagem className="apresentacao-paisagem apresentacao-paisagem--stu">
      <span className="apresentacao-oi">{mensagens.apresentacao.oi}</span>
      <Stu />
    </Paisagem>
  );
}

function ArteTemas() {
  return (
    <Paisagem className="apresentacao-paisagem apresentacao-paisagem--temas">
      {temasDaArte.map((tema, indice) => (
        <span key={tema.nome} className="apresentacao-tema" style={{ '--i': indice } as CSSProperties}>
          <Desenho nome={tema.icone} />{tema.nome}
        </span>
      ))}
      <Stu />
    </Paisagem>
  );
}

/** Pedaço de trilha: estrada em curva e três nós que surgem em sequência, com o cenário brotando ao redor. */
function ArteTrilha() {
  return (
    <div className="mini-trilha" style={coresDaRegiao(0)}>
      <MiniEstrada />
      <Desenho nome="arvore" className="mini-trilha__enfeite" style={{ '--x': '10%', '--y': '22%', '--tam': '13%', '--atraso': '900ms' } as CSSProperties} />
      <Desenho nome="flores" className="mini-trilha__enfeite" style={{ '--x': '84%', '--y': '74%', '--tam': '9%', '--atraso': '500ms' } as CSSProperties} />
      <Desenho nome="arbusto" className="mini-trilha__enfeite" style={{ '--x': '82%', '--y': '22%', '--tam': '12%', '--atraso': '1300ms' } as CSSProperties} />
      <Desenho nome="lagoa" className="mini-trilha__enfeite" style={{ '--x': '12%', '--y': '72%', '--tam': '17%', '--atraso': '300ms' } as CSSProperties} />
      <span className="mini-trilha__no" data-estado="atual" style={{ '--x': '30%', '--y': '78%', '--atraso': '100ms' } as CSSProperties}>
        <Icone nome="livro" /><span className="mini-trilha__etiqueta">{mensagens.trilha.comecar}</span>
      </span>
      <span className="mini-trilha__no" data-estado="previa" style={{ '--x': '68%', '--y': '50%', '--atraso': '600ms' } as CSSProperties}>
        <Icone nome="livro" />
      </span>
      <span className="mini-trilha__no" data-estado="previa" style={{ '--x': '38%', '--y': '20%', '--atraso': '1100ms' } as CSSProperties}>
        <Icone nome="revisao" />
      </span>
    </div>
  );
}

/** Trilha vencida: lições concluídas, o troféu dourado no topo da montanha e o selo de progresso salvo. */
function ArteProgresso() {
  return (
    <div className="mini-trilha mini-trilha--feita" style={coresDaRegiao(2)}>
      <MiniEstrada feita />
      <Desenho nome="picos" className="mini-trilha__enfeite" style={{ '--x': '14%', '--y': '24%', '--tam': '22%', '--atraso': '0ms' } as CSSProperties} />
      <Desenho nome="pinheiro" className="mini-trilha__enfeite" style={{ '--x': '86%', '--y': '64%', '--tam': '9%', '--atraso': '0ms' } as CSSProperties} />
      <Desenho nome="estrela" className="mini-trilha__brilho" style={{ '--x': '30%', '--y': '9%', '--tam': '6%' } as CSSProperties} />
      <Desenho nome="estrela" className="mini-trilha__brilho" style={{ '--x': '50%', '--y': '6%', '--tam': '4%' } as CSSProperties} />
      <span className="mini-trilha__no" data-estado="concluida" style={{ '--x': '30%', '--y': '78%' } as CSSProperties}><Icone nome="check" /></span>
      <span className="mini-trilha__no" data-estado="concluida" style={{ '--x': '68%', '--y': '50%' } as CSSProperties}><Icone nome="check" /></span>
      <span className="mini-trilha__no mini-trilha__no--trofeu" style={{ '--x': '38%', '--y': '20%' } as CSSProperties}><Icone nome="trofeu" /></span>
      <span className="mini-trilha__selo"><Icone nome="check" />{mensagens.apresentacao.salvo}</span>
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
