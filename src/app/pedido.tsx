'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LIMITES_GERACAO } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Desenho, EstadoErro, Icone, Stu, type NomeDesenho } from '../ui';
import './pedido.css';
import { pedirAceiteIa } from './aceite-ia';
import { MaterialParaTrilha } from './estudio';
import { DiagnosticoDoPedido } from './diagnostico';
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
export function Pedido({ onProposta, objetivo, ocupado, aviso, falha, temPlanos, areaInicial, aoMudar, anunciar, gerar, repetirGeracao, verPlanos, comoFunciona,
  focarCampo = false, porLink, aoDesconectar }: {
  /** "Adicionar por link" (spec 09, com a flag de compartilhar): logo antes de "Ver como funciona". */
  porLink?: ReactNode;
  /** A ação da lista vazia leva diretamente ao campo de objetivo, inclusive no celular. */
  focarCampo?: boolean;
  aoDesconectar?: () => void;
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
  gerar: (texto: string, diagnosticoId?: string) => void;
  repetirGeracao: () => void;
  verPlanos: () => void;
  comoFunciona: () => void;
}) {
  const [pedidoDiagnostico, setPedidoDiagnostico] = useState<string | null>(null);
  const [diagnosticoAberto, setDiagnosticoAberto] = useState(false);
  const [modo, setModo] = useState<'ideia' | 'material'>('ideia');
  const [temaRecusado, setTemaRecusado] = useState<string | null>(null);
  const [curto, setCurto] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [brilho, setBrilho] = useState(0);
  const [lendoMaterial, setLendoMaterial] = useState(false);
  /** Lendo o material enviado: o Stu fica concentrado só quando a espera passa de 1 s (menos que isso, só o esqueleto). */
  const [lendoDemorado, setLendoDemorado] = useState(false);
  useEffect(() => {
    if (modo !== 'material' || !lendoMaterial) { setLendoDemorado(false); return; }
    const relogio = window.setTimeout(() => setLendoDemorado(true), 1000);
    return () => window.clearTimeout(relogio);
  }, [modo, lendoMaterial]);
  const campo = useRef<HTMLTextAreaElement>(null);
  const focarBotaoCriar = useRef(false);
  const focouComTexto = useRef(false);
  const texto = objetivo.trim();
  const recusado = falha === 'conteudo_nocivo' || temaRecusado === texto;

  useEffect(() => {
    if (falha === 'conteudo_nocivo') setDiagnosticoAberto(false);
  }, [falha]);

  useEffect(() => {
    if (focarBotaoCriar.current && texto && !ocupado) {
      focarBotaoCriar.current = false;
      campo.current?.closest('form')?.querySelector<HTMLButtonElement>('.pedido-criar')?.focus();
    }
  }, [texto, ocupado]);

  useEffect(() => {
    if (modo !== 'ideia' || (!focarCampo && window.innerWidth < 1024 && !objetivo.trim())) return;
    campo.current?.focus({ preventScroll: true });
    if (objetivo.trim()) focouComTexto.current = true;
  }, [modo, focarCampo]);

  useEffect(() => {
    if (modo !== 'ideia' || focouComTexto.current || !texto || focarBotaoCriar.current || escolhida !== null) return;
    focouComTexto.current = true;
    campo.current?.focus({ preventScroll: true });
  }, [modo, texto, escolhida]);

  // O Stu reage ao pedido: convida, incentiva enquanto a pessoa escreve e comemora a ideia escolhida.
  let fala: string = mensagens.pedido.falas.vazio;
  if (falha === 'limite_geracoes' || falha === 'limite_estudio') fala = mensagens.pedido.falas.limite;
  else if (falha) fala = mensagens.pedido.falas.erro;
  else if (escolhida !== null && escolhida === texto) fala = mensagens.pedido.falas.escolhida;
  else if (texto.length >= 20) fala = mensagens.pedido.falas.pronto;
  else if (texto.length > 0) fala = mensagens.pedido.falas.curto;
  // As ideias vêm da área escolhida na apresentação; sem ela, das mais populares.
  const tema = mensagens.pedido.temas.find((item) => item.id === (areaInicial ?? 'populares')) ?? mensagens.pedido.temas[0];
  const mostrarCurto = curto && texto.length < LIMITES_GERACAO.objetivoMin;
  const mostrarContador = objetivo.length >= LIMITES_GERACAO.objetivoMax - 100;
  const descricao = [mostrarCurto && 'objetivo-erro', 'objetivo-dica', 'objetivo-privacidade', mostrarContador && 'objetivo-contador']
    .filter(Boolean).join(' ');
  const codigoErro = recusado ? 'conteudo_nocivo' : falha;
  const repetivel = falha === 'ia_indisponivel' || falha === 'falha' || falha === 'rede';
  // "Agora não" no aceite de IA deixava um aviso sem saída (spec 17, defeito B4): o botão reabre o mesmo cartão e, com "Permitir e continuar", o pedido segue.
  const semAceite = falha === 'consentimento_ia';
  async function permitirDeNovo() {
    if (ocupado) return;
    try {
      if (await pedirAceiteIa(await cliente.privacidade())) tentar();
    } catch {
      // Sem conseguir abrir o cartão, o aviso e o botão continuam; a pessoa tenta de novo.
    }
  }

  function tentar() {
    if (ocupado || !texto) return;
    if (texto.length < LIMITES_GERACAO.objetivoMin) {
      setCurto(true);
      campo.current?.focus();
      return;
    }
    if (recusado) return;
    setPedidoDiagnostico(texto);
    setDiagnosticoAberto(true);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    tentar();
  }

  function mudarTema(novo: string) {
    setTemaRecusado(null);
    aoMudar(novo);
  }

  function sugerir(ideia: string) {
    focarBotaoCriar.current = true;
    mudarTema(ideia);
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
    <>
    {pedidoDiagnostico && <div hidden={!diagnosticoAberto}>
      <DiagnosticoDoPedido key={pedidoDiagnostico} objetivo={pedidoDiagnostico} ativo={diagnosticoAberto}
        continuar={id => gerar(pedidoDiagnostico, id)} cancelar={() => {
          setDiagnosticoAberto(false);
          window.requestAnimationFrame(() => campo.current?.focus());
        }} aoRecusar={() => {
          setDiagnosticoAberto(false);
          setTemaRecusado(pedidoDiagnostico);
          setPedidoDiagnostico(null);
        }} aoDesconectar={aoDesconectar} />
    </div>}
    <div hidden={diagnosticoAberto}><section className="painel painel--pedido pedido-novo" data-modo={modo}>
      <header className="pedido-heroi">
        <div className="pedido-heroi__stu" aria-hidden="true">
          <span className="pedido-heroi__halo" />
          {/* Convida: curioso, uma vez; escrevendo: encorajador, parado; ideia aplicada: animado, no acontecimento;
              lendo o material: concentrado, em laço (spec 13, §A2, §B4 e §E1). */}
          {lendoDemorado ? <Stu expressao="stu-concentrado" tamanho={96} animado="laco" />
            : falha ? <Stu expressao="stu-encorajador" tamanho={96} />
              : escolhida !== null && escolhida === texto ? <Stu expressao="stu-animado" tamanho={96} animado="acontecimento" acontecimento={brilho} />
                : texto.length > 0 ? <Stu expressao="stu-encorajador" tamanho={96} />
                  : <Stu expressao="stu-curioso" tamanho={96} animado="uma-vez" />}
          <span className="pedido-heroi__estrela">✦</span>
        </div>
        <h1 tabIndex={-1}>{modo === 'material' ? mensagens.inicio.materialTitulo : mensagens.pedido.titulo}</h1>
        {!recusado && <p className="pedido-heroi__fala" aria-live="polite">{modo === 'material' ? mensagens.inicio.materialTexto : fala}</p>}
      </header>
      {aviso && <p className="pedido-aviso">{aviso}</p>}
      {codigoErro && (
        <EstadoErro codigo={codigoErro}>
          {recusado ? (
            <Botao variante="secundario" onClick={() => campo.current?.focus()}>{mensagens.pedido.editarTema}</Botao>
          ) : falha === 'limite_geracoes' && temPlanos ? (
            <Botao variante="secundario" onClick={verPlanos}>{mensagens.pedido.verPlanos}</Botao>
          ) : semAceite ? (
            <Botao variante="secundario" disabled={ocupado} onClick={() => void permitirDeNovo()}>{mensagens.privacidade.permitirAgora}</Botao>
          ) : repetivel ? (
            <Botao variante="secundario" disabled={ocupado} onClick={repetirGeracao}>{mensagens.tentarNovamente}</Botao>
          ) : null}
        </EstadoErro>
      )}
      <div hidden={modo !== 'material'} className="pedido-material">
        <MaterialParaTrilha objetivo={objetivo} onProposta={onProposta} mostrarCabeca={false} aoDesconectar={aoDesconectar}
          aoMudarLeitura={setLendoMaterial} />
      </div>
      <form hidden={modo !== 'ideia'} className="formulario pedido-formulario" method="post" noValidate onSubmit={enviar}>
        <div className="campo pedido-campo">
          <label htmlFor="objetivo" className="somente-leitor">{mensagens.inicio.campo}</label>
          {/* O campo cresce com o texto e com o exemplo (o placeholder), também com a letra ampliada: a cópia invisível do texto (data-replica) dá a altura (banca P2-5). */}
          <div className="pedido-campo__caixa" data-replica={objetivo || mensagens.inicio.exemplo} data-vazio={!objetivo || undefined}>
            <textarea ref={campo} id="objetivo" name="objetivo" rows={2} maxLength={LIMITES_GERACAO.objetivoMax} required
              value={objetivo} disabled={ocupado} aria-invalid={mostrarCurto || undefined} aria-describedby={descricao}
              placeholder={mensagens.inicio.exemplo} data-brilho={brilho ? (brilho % 2 ? 'a' : 'b') : undefined}
              onChange={evento => mudarTema(evento.target.value)} />
          </div>
          {mostrarCurto && <p className="campo-erro" id="objetivo-erro">{mensagens.pedido.curto(LIMITES_GERACAO.objetivoMin)}</p>}
          <small id="objetivo-dica" className="somente-leitor">{mensagens.inicio.ajuda}</small>
          <small id="objetivo-privacidade" className="somente-leitor">{mensagens.pedido.privacidade}</small>
          {mostrarContador && <small id="objetivo-contador">{mensagens.pedido.contador(objetivo.length, LIMITES_GERACAO.objetivoMax)}</small>}
        </div>
        <Botao type="submit" className="pedido-criar" disabled={ocupado || !texto || recusado}>{mensagens.inicio.criar}<Icone nome="seta" /></Botao>
      </form>
      <button type="button" className="pedido-alternar" disabled={ocupado} onClick={() => setModo(modo === 'ideia' ? 'material' : 'ideia')}>
        <span className="pedido-alternar__icone" aria-hidden="true"><Icone nome={modo === 'ideia' ? 'livro' : 'lampada'} /></span>
        <span className="pedido-alternar__texto">
          <strong>
            {modo === 'ideia' ? mensagens.inicio.material : mensagens.inicio.voltarIdeia}
          </strong>
          <small>{modo === 'ideia' ? mensagens.inicio.materialDica : mensagens.inicio.ideiaDica}</small>
        </span>
        <Icone nome="seta" />
      </button>
      {modo === 'ideia' && (
        <div className="pedido-ideias" role="group" aria-label={mensagens.pedido.sugestoes}>
          {tema.exemplos.map(exemplo => (
            <button key={exemplo} type="button" className="pedido-ideia" aria-pressed={texto === exemplo} disabled={ocupado} onClick={() => sugerir(exemplo)}>
              <Desenho nome={iconeDoExemplo(tema, exemplo)} />{exemplo}
            </button>
          ))}
          <button type="button" className="pedido-ideia pedido-ideia--surpresa" disabled={ocupado} onClick={surpreender}>
            <Desenho nome="estrela" />{mensagens.pedido.surpresa}
          </button>
        </div>
      )}
      {porLink}
      <button type="button" className="pedido-como" onClick={comoFunciona}>{mensagens.inicio.saberMais}</button>
    </section></div>
    </>
  );
}
