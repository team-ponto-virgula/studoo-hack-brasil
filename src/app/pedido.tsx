'use client';

import { useRef, useState, type FormEvent } from 'react';
import { LIMITES_GERACAO } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { AcaoPrincipal, Botao, Desenho, EstadoErro, Icone, Stu, type NomeDesenho } from '../ui';
import './pedido.css';

type Tema = (typeof mensagens.pedido.temas)[number];
type IdTema = Tema['id'];

/** Ícone de cada área de interesse, desenhado com as formas do mundo (o app usa os mesmos desenhos). */
const iconesDosTemas: Record<IdTema, NomeDesenho> = {
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
export function Pedido({ objetivo, ocupado, aviso, falha, temPlanos, aoMudar, anunciar, gerar, verPlanos, comoFunciona }: {
  objetivo: string;
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
  const [curto, setCurto] = useState(false);
  const [idTema, setIdTema] = useState<IdTema>('populares');
  const campo = useRef<HTMLTextAreaElement>(null);
  const texto = objetivo.trim();
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

  function sugerir(exemplo: string) {
    aoMudar(exemplo);
    setCurto(false);
    anunciar(mensagens.pedido.sugestaoAplicada(exemplo));
  }

  function surpreender() {
    const opcoes = todosOsExemplos.filter((exemplo) => exemplo !== texto);
    sugerir(opcoes[Math.floor(Math.random() * opcoes.length)]);
  }

  return (
    <section className="painel painel--pedido">
      <div className="pedido-topo">
        <div className="pedido-topo__textos">
          <h1 tabIndex={-1}>{mensagens.pedido.titulo}</h1>
          <p className="introducao">{mensagens.pedido.instrucoes}</p>
          <button type="button" className="pedido-como" onClick={comoFunciona} disabled={ocupado}>
            <span className="pedido-como__sinal" aria-hidden="true">?</span>{mensagens.pedido.comoFunciona}
          </button>
        </div>
        <div className="pedido-stu" aria-hidden="true">
          <p className="pedido-stu__fala">{mensagens.pedido.stuFala}</p>
          <Stu />
        </div>
      </div>
      {aviso && <p className="pedido-aviso">{aviso}</p>}
      {falha && (
        <EstadoErro codigo={falha}>
          {repetivel && <Botao variante="secundario" disabled={ocupado} onClick={tentar}>{mensagens.tentarNovamente}</Botao>}
          {falha === 'limite_geracoes' && temPlanos && <Botao variante="secundario" disabled={ocupado} onClick={verPlanos}>{mensagens.pedido.verPlanos}</Botao>}
        </EstadoErro>
      )}
      <form className="formulario pedido-formulario" method="post" noValidate onSubmit={enviar}>
        <div className="campo pedido-campo">
          <label htmlFor="objetivo">{mensagens.pedido.objetivo}</label>
          <textarea ref={campo} id="objetivo" name="objetivo" rows={4} maxLength={LIMITES_GERACAO.objetivoMax} required
            value={objetivo} disabled={ocupado} aria-invalid={mostrarCurto || undefined} aria-describedby={descricao}
            placeholder={mensagens.pedido.exemploCampo} onChange={(evento) => aoMudar(evento.target.value)} />
          {mostrarCurto && (
            <p className="campo-erro" id="objetivo-erro">
              <span className="sinal" aria-hidden="true">!</span>{mensagens.pedido.curto(LIMITES_GERACAO.objetivoMin)}
            </p>
          )}
          <small className="pedido-dica" id="objetivo-dica">{mensagens.pedido.dica}</small>
          <small id="objetivo-privacidade">{mensagens.pedido.privacidade}</small>
          {mostrarContador && (
            <small className="pedido-contador" id="objetivo-contador">
              {mensagens.pedido.contador(objetivo.length, LIMITES_GERACAO.objetivoMax)}
            </small>
          )}
        </div>
        <div className="pedido-sugestoes" role="group" aria-labelledby="pedido-sugestoes">
          <div className="pedido-sugestoes__topo">
            <p className="pedido-sugestoes__titulo" id="pedido-sugestoes">{mensagens.pedido.sugestoes}</p>
            <button type="button" className="pedido-surpresa" disabled={ocupado} onClick={surpreender}>
              <Desenho nome="estrela" />{mensagens.pedido.surpresa}
            </button>
          </div>
          <div className="pedido-temas" role="group" aria-label={mensagens.pedido.areas}>
            {mensagens.pedido.temas.map((item) => (
              <button key={item.id} type="button" className="pedido-tema" aria-pressed={item.id === idTema} disabled={ocupado}
                onClick={() => setIdTema(item.id)}>
                <Desenho nome={iconesDosTemas[item.id]} />
                {item.nome}
              </button>
            ))}
          </div>
          <ul className="pedido-exemplos" aria-label={tema.nome}>
            {tema.exemplos.map((exemplo) => {
              const escolhida = texto === exemplo;
              return (
                <li key={exemplo}>
                  <button type="button" className="pedido-exemplo" data-escolhida={escolhida || undefined} aria-pressed={escolhida}
                    disabled={ocupado} onClick={() => sugerir(exemplo)}>
                    <span className="pedido-exemplo__icone"><Desenho nome={iconeDoExemplo(tema, exemplo)} /></span>
                    <span className="pedido-exemplo__texto">{exemplo}</span>
                    <span className="pedido-exemplo__acao"><Icone nome={escolhida ? 'check' : 'seta'} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <AcaoPrincipal><Botao type="submit" disabled={ocupado || !texto}>{mensagens.pedido.gerar}</Botao></AcaoPrincipal>
      </form>
    </section>
  );
}
