'use client';

import { useRef, useState, type FormEvent } from 'react';
import { LIMITES_GERACAO } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Desenho, EstadoErro, Icone, Stu, type NomeDesenho } from '../ui';
import './pedido.css';
import { MaterialParaTrilha } from './estudio';
import type { PropostaPlano } from '@studoo/contratos';

type Tema = (typeof mensagens.pedido.temas)[number];
export type IdTema = Tema['id'];

/** Ícone de cada área de interesse, desenhado com as formas do mundo (o app usa os mesmos desenhos). */
export const iconesDosTemas: Record<IdTema, NomeDesenho> = {
  populares: 'temaPopulares',
  idiomas: 'temaIdiomas',
  musica: 'temaMusica',
  matematica: 'temaMatematica',
  ciencias: 'temaCiencias',
  tecnologia: 'temaTecnologia',
  artes: 'temaArtes',
  carreira: 'temaCarreira',
  'dia-a-dia': 'temaDiaADia',
};

/** Área de um exemplo: em Populares, cada exemplo mostra o ícone da área de onde veio. */
function iconeDoExemplo(tema: Tema, exemplo: string): NomeDesenho {
  if (tema.id !== 'populares') return iconesDosTemas[tema.id];
  const origem = mensagens.pedido.temas.find((item) => item.id !== 'populares' && (item.exemplos as readonly string[]).includes(exemplo));
  return iconesDosTemas[origem?.id ?? 'populares'];
}

const todosOsExemplos = Array.from(new Set(mensagens.pedido.temas.flatMap((tema) => tema.exemplos as readonly string[])));

/**
 * Pedido da trilha: a pessoa escreve o que quer aprender, ou escolhe uma ideia, e gera a trilha ao vivo.
 * As ideias vêm por área de interesse (idiomas, música, matemática…), para mostrar que vale qualquer assunto;
 * "Surpreenda-me" sorteia uma. Tocar numa ideia preenche o campo, e a pessoa ainda pode ajustar o texto.
 */
export function Pedido({ onProposta, objetivo, ocupado, aviso, falha, temPlanos, areaInicial, aoMudar, anunciar, gerar, verPlanos, comoFunciona }: {
  onProposta: (p: PropostaPlano) => void;
  objetivo: string;
  /** Área que abre primeiro, como a escolhida no fim da apresentação; sem ela, Populares. */
  areaInicial?: IdTema;
  ocupado: boolean;
  aviso: string | null;
  falha: string | null;
  temPlanos: boolean;
  aoMudar: (texto: string) => void;
  anunciar: (texto: string) => void;
  gerar: (texto: string) => void;
  verPlanos: () => void;
  comoFunciona: () => void;
}) {
  const [modo, setModo] = useState<'ideia' | 'material'>('ideia');
  const [maisIdeias, setMaisIdeias] = useState(Boolean(areaInicial && areaInicial !== 'populares'));
  const [curto, setCurto] = useState(false);
  const [idTema, setIdTema] = useState<IdTema>(areaInicial ?? 'populares');
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [brilho, setBrilho] = useState(0);
  const campo = useRef<HTMLTextAreaElement>(null);
  const texto = objetivo.trim();

  // O Stu reage ao pedido: convida, incentiva enquanto a pessoa escreve e comemora a ideia escolhida.
  let fala: string = mensagens.pedido.falas.vazio;
  if (escolhida !== null && escolhida === texto) fala = mensagens.pedido.falas.escolhida;
  else if (texto.length >= 20) fala = mensagens.pedido.falas.pronto;
  else if (texto.length > 0) fala = mensagens.pedido.falas.curto;
  const tema = mensagens.pedido.temas.find((item) => item.id === idTema) ?? mensagens.pedido.temas[0];
  const mostrarCurto = curto && texto.length < LIMITES_GERACAO.objetivoMin;
  const mostrarContador = objetivo.length >= LIMITES_GERACAO.objetivoMax - 100;
  const descricao = [mostrarCurto && 'objetivo-erro', 'objetivo-dica', 'objetivo-privacidade', mostrarContador && 'objetivo-contador']
    .filter(Boolean).join(' ');
  const repetivel = falha === 'ia_indisponivel' || falha === 'falha' || falha === 'rede';

  function tentar() {
    if (ocupado || !texto) return;
    if (texto.length < LIMITES_GERACAO.objetivoMin) {
      setCurto(true);
      campo.current?.focus();
      return;
    }
    gerar(texto);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    tentar();
  }

  function sugerir(ideia: string) {
    aoMudar(ideia);
    setCurto(false);
    setEscolhida(ideia);
    setBrilho((anterior) => anterior + 1);
    anunciar(mensagens.pedido.sugestaoAplicada(ideia));
  }

  function surpreender() {
    const opcoes = todosOsExemplos.filter((ideia) => ideia !== texto);
    sugerir(opcoes[Math.floor(Math.random() * opcoes.length)]);
  }

  return (
    <section className="painel painel--pedido pedido-novo">
      <header className="descoberta-hero">
        <div className="descoberta-hero__texto">
          <p className="descoberta-selo">{mensagens.inicio.selo}</p>
          <h1 tabIndex={-1}>{mensagens.inicio.titulo}</h1>
          <p>{mensagens.inicio.texto}</p>
        </div>
        <div className="descoberta-stu" aria-hidden="true"><span className="descoberta-orbita"/><Stu /><span className="descoberta-estrela">✦</span><span className="descoberta-ponto"/></div>
      </header>
      <div className="descoberta-modos" role="group" aria-label={mensagens.inicio.escolha}>
        {(['ideia', 'material'] as const).map(item => <button key={item} type="button" aria-pressed={modo === item} disabled={ocupado}
          className="descoberta-modo" onClick={() => setModo(item)}>
          <span className="descoberta-modo__icone"><Icone nome={item === 'ideia' ? 'lampada' : 'livro'} /></span>
          <span><strong>{mensagens.inicio[item]}</strong><small>{item === 'ideia' ? mensagens.inicio.ideiaDica : mensagens.inicio.materialDica}</small></span>
          <span className="descoberta-modo__check" aria-hidden="true">{modo === item ? '✓' : ''}</span>
        </button>)}
      </div>
      {falha === 'limite_geracoes' && temPlanos && <Botao variante="secundario" onClick={verPlanos}>{mensagens.pedido.verPlanos}</Botao>}
      {aviso && <p className="pedido-aviso">{aviso}</p>}
      {falha && <EstadoErro codigo={falha}>{repetivel && <Botao variante="secundario" disabled={ocupado} onClick={tentar}>{mensagens.tentarNovamente}</Botao>}</EstadoErro>}
      <div hidden={modo !== 'material'} className="descoberta-painel">
        <MaterialParaTrilha objetivo={objetivo} onProposta={onProposta} />
      </div>
      <form hidden={modo !== 'ideia'} className="formulario pedido-formulario descoberta-painel" method="post" noValidate onSubmit={enviar}>
        <div className="descoberta-caderno">
          <div className="descoberta-caderno__topo"><span aria-hidden="true">✦</span><span>{texto ? fala : mensagens.inicio.convite}</span></div>
          <div className="campo pedido-campo">
            <label htmlFor="objetivo">{mensagens.inicio.campo}</label>
            <textarea ref={campo} id="objetivo" name="objetivo" rows={2} maxLength={LIMITES_GERACAO.objetivoMax} required
              value={objetivo} disabled={ocupado} aria-invalid={mostrarCurto || undefined} aria-describedby={descricao}
              placeholder={mensagens.inicio.exemplo} data-brilho={brilho ? (brilho % 2 ? 'a' : 'b') : undefined}
              onChange={evento => aoMudar(evento.target.value)} />
            {mostrarCurto && <p className="campo-erro" id="objetivo-erro">{mensagens.pedido.curto(LIMITES_GERACAO.objetivoMin)}</p>}
            <small id="objetivo-dica">{mensagens.inicio.ajuda}</small>
            <small id="objetivo-privacidade" className="somente-leitor">{mensagens.pedido.privacidade}</small>
            {mostrarContador && <small id="objetivo-contador">{mensagens.pedido.contador(objetivo.length, LIMITES_GERACAO.objetivoMax)}</small>}
          </div>
          <Botao type="submit" disabled={ocupado || !texto}>{mensagens.inicio.criar}<Icone nome="seta" /></Botao>
        </div>
        <div className="descoberta-inspiracao">
          <div className="pedido-sugestoes__topo"><p className="pedido-sugestoes__titulo">{mensagens.pedido.sugestoes}</p>
            <button type="button" className="pedido-surpresa" disabled={ocupado} onClick={surpreender}><Desenho nome="estrela" />{mensagens.pedido.surpresa}</button></div>
          <div className="descoberta-ideias" role="group" aria-label={mensagens.pedido.sugestoes}>
            {(maisIdeias ? tema.exemplos : mensagens.pedido.temas[0].exemplos.slice(0, 3)).map(exemplo => <button key={exemplo} type="button" aria-pressed={texto === exemplo} disabled={ocupado} onClick={() => sugerir(exemplo)}>
              <Desenho nome={iconeDoExemplo(maisIdeias ? tema : mensagens.pedido.temas[0], exemplo)} />{exemplo}
            </button>)}
          </div>
          <button type="button" className="descoberta-expandir" aria-expanded={maisIdeias} aria-controls="outras-ideias" onClick={() => setMaisIdeias(!maisIdeias)}>{maisIdeias ? mensagens.inicio.menos : mensagens.inicio.mais}<span aria-hidden="true">{maisIdeias ? '−' : '+'}</span></button>
          <div hidden={!maisIdeias} id="outras-ideias" className="pedido-temas" role="group" aria-label={mensagens.pedido.areas}>
            {mensagens.pedido.temas.map(item => <button key={item.id} type="button" className="pedido-tema" aria-pressed={item.id === idTema} disabled={ocupado} onClick={() => setIdTema(item.id)}><Desenho nome={iconesDosTemas[item.id]} />{item.nome}</button>)}
          </div>
        </div>
      </form>
      <footer className="descoberta-rodape"><div className="descoberta-passos" aria-label={mensagens.inicio.passos}>{mensagens.inicio.etapas.map((etapa,i) => <span key={etapa}><b aria-hidden="true">{i+1}</b>{etapa}</span>)}</div>
        <button type="button" className="pedido-como" onClick={comoFunciona}>{mensagens.inicio.saberMais}<span aria-hidden="true">↗</span></button>
      </footer>
    </section>
  );
}
