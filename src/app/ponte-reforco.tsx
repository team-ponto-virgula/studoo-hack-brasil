'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ApoioEstudo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Icone, Stu } from '../ui';
import { tocaSons } from './sons';

const m = mensagens.estudio;
const passos = [m.pontePassoExplicacao, m.pontePassoExemplo, m.pontePassoDesafio] as const;

type Resultado = { correta: boolean; feedback: string };
type Props = {
  ponte: ApoioEstudo['ponte'] | undefined;
  tentativa?: string;
  feedbackOriginal: string;
  ocupado: boolean;
  erro: string;
  tentarCarregar: () => void;
  verificar: (resposta: string) => Promise<Resultado | undefined>;
  voltar?: () => void;
  /** Spec 16, item 27: nas lições feitas de material, "De onde veio esta ideia" (a citação do material), recolhido, depois do cartão do passo e antes de "Voltar ao exercício". */
  origem?: ReactNode;
};

/** A apresentação e a lição mostram as mesmas três tábuas. As margens ficam nas posições 0 e 4. */
export function FaixaDaPonte({ posicao, comemorar = false }: { posicao: number; comemorar?: boolean }) {
  return (
    <div className="reforco__faixa" style={{ '--posicao': posicao } as CSSProperties}>
      <span aria-hidden="true">{m.ponteMargemErro}</span>
      <ol aria-label="Passos da ponte">{passos.map((nome, i) =>
        <li key={nome} aria-current={posicao === i + 1 ? 'step' : undefined} data-feita={posicao > i + 1 || undefined}>
          <span aria-hidden="true">{i + 1}</span><span className="somente-leitor">{nome}</span>
        </li>)}</ol>
      <span aria-hidden="true">{m.ponteMargemVolta}</span>
      <div aria-hidden="true" className="reforco__viajante"><div key={posicao}><Stu expressao={posicao === 4 ? 'stu-animado' : 'stu-perfil'} tamanho={44} animado={comemorar ? 'uma-vez' : undefined} /></div></div>
    </div>
  );
}

export function PonteReforco({ ponte, tentativa, feedbackOriginal, ocupado, erro, tentarCarregar, verificar, voltar, origem }: Props) {
  const [passo, setPasso] = useState(1);
  const [resposta, setResposta] = useState('');
  const [resultado, setResultado] = useState<Resultado>();
  const [repetir, setRepetir] = useState(false);
  const [rever, setRever] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const tituloCartao = useRef<HTMLHeadingElement>(null);
  const rodape = useRef<HTMLElement>(null);
  const opcaoInicial = useRef<HTMLInputElement>(null);
  const id = useId();
  const concluida = Boolean(ponte?.concluida);
  const reaberta = concluida && !resultado?.correta;
  const nomePasso = passos[passo - 1];
  const posicao = concluida ? 4 : ponte ? passo : 0;
  const indicador = concluida ? m.ponteConstruida : m.ponteIndicador(passo) + ' · ' + nomePasso;

  useEffect(() => {
    const alvo = concluida && !reaberta ? rodape.current?.querySelector('button')
      : passo === 1 ? titulo.current : tituloCartao.current;
    alvo?.focus({ preventScroll: true });
    if (passo === 1 || concluida) window.scrollTo({ top: 0, behavior: 'instant' });
    else tituloCartao.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [passo, concluida, reaberta]);

  async function agir() {
    if (concluida) return voltar?.();
    if (!ponte) return tentarCarregar();
    if (passo < 3) return setPasso(passo + 1);
    if (repetir) {
      setRepetir(false);
      setResultado(undefined);
      setResposta('');
      requestAnimationFrame(() => opcaoInicial.current?.focus());
      return;
    }
    const nova = await verificar(resposta);
    if (nova) {
      setResultado(nova);
      setRepetir(!nova.correta);
      void tocaSons.tocarEfeito(nova.correta ? 'acerto' : 'erro');
    }
  }
  const acao = concluida ? m.ponteVoltarExercicio : repetir || (!ponte && erro) ? m.ponteTentarDeNovo
    : passo === 1 ? m.ponteVerExemplo : passo === 2 ? m.ponteIrDesafio : m.verificar;
  const explicacao = ponte && <><p>{ponte.motivo}</p>{ponte.conceito !== feedbackOriginal && <p>{ponte.conceito}</p>}</>;
  const exemplo = ponte && <p className="estudio-exemplo">{ponte.exemplo}</p>;

  return <section className="reforco" aria-labelledby={id}>
    <p className="reforco__selo"><Icone nome="revisao" />{m.ponteMapa}</p>
    <h2 ref={titulo} id={id} tabIndex={-1}>{m.ponte}</h2>
    {/* Spec 19 (L8): a frase já foi lida no passo 1. Do passo 2 em diante ela some até 600 px (estudio.css) e as alternativas do desafio cabem acima do rodapé. */}
    <p className="reforco__motivo" data-lido={passo > 1 ? '' : undefined}>{reaberta ? m.ponteReabertaAviso : tentativa?.trim() ? m.ponteMotivoResposta(tentativa) : m.ponteMotivo}</p>
    <FaixaDaPonte posicao={posicao} comemorar={concluida && !reaberta} />
    <p className="reforco__indicador" role="status">{indicador}{concluida && !reaberta && <span className="somente-leitor"> {m.ponteVencida}</span>}</p>
    <div className="reforco__cartao estudio-desafio" key={concluida ? 'pronta' : passo}>
      {!ponte ? <p role="status">{erro || m.pensando}</p> : <>
        <h3 tabIndex={-1} ref={tituloCartao}>{concluida ? reaberta ? m.pontePassoExplicacao : m.ponteVencida : nomePasso}</h3>
        {(reaberta || (!concluida && passo === 1)) && explicacao}
        {(reaberta || (!concluida && passo === 2)) && exemplo}
        {!concluida && passo === 3 && <>
          <Botao variante="texto" aria-expanded={rever} aria-controls={id + '-rever'} onClick={() => setRever(!rever)}>{m.ponteRever}</Botao>
          {rever && <div id={id + '-rever'}>{explicacao}{exemplo}</div>}
          <fieldset className="opcoes" disabled={ocupado || repetir}><legend>{ponte.exercicio.enunciado}</legend>
            {ponte.exercicio.tipo === 'multipla_escolha' && ponte.exercicio.opcoes.map((o, i) =>
              <label key={o.id} className="opcao" data-retorno={resultado && resposta === o.id ? (resultado.correta ? 'certa' : 'errada') : undefined}>
                <input ref={i === 0 ? opcaoInicial : undefined} type="radio" name={id + '-resposta'} checked={resposta === o.id}
                  onChange={() => { setResposta(o.id); setResultado(undefined); }} />
                <span className="opcao-tecla" aria-hidden="true">{String.fromCharCode(65 + i)}</span>{o.texto}
              </label>)}
          </fieldset>
        </>}
      </>}
    </div>
    {origem}
    {!concluida && <Botao variante="texto" onClick={voltar}>{m.ponteVoltarExercicio}</Botao>}
    <footer ref={rodape} className="reforco__rodape">
      <div className="reforco__rodape-conteudo">
        {ponte && resultado && (
          <p role="status" aria-live="polite" className="estudio-retorno-ponte reforco__aviso" data-estado={resultado.correta ? 'certa' : 'errada'}>
            {resultado.feedback}
          </p>
        )}
        {ponte && erro && (
          <p role="alert" className="campo-erro reforco__aviso">{erro}</p>
        )}
        <Botao variante={concluida ? 'sucesso' : 'primario'}
          disabled={ocupado || (!ponte && !erro) || (!concluida && passo === 3 && !resposta)} onClick={() => void agir()}>{acao}</Botao>
      </div>
    </footer>
  </section>;
}
