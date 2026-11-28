'use client';

/*
 * Configurações da trilha (lote 4): capa e nome (capa, nome, descrição e tema), quem pode ver (abre a folha de
 * compartilhar que já existe) e apagar. Cada campo salva sozinho ao sair dele, com a linha de estado "Salvo"; o erro
 * fica embaixo do campo. Sem diálogo de "sair sem salvar". Só a dona chega aqui (a API recusa as outras).
 */
import { EstadoModeracao, RegrasDaRecusa, rotuloDoDestino } from './seguranca-comunidade';
import { useEffect, useId, useRef, useState } from 'react';
import {
  CAPAS_GALERIA,
  LIMITES_COMUNIDADE,
  TEMAS,
  motivoLegendaInvalida,
  motivoTituloTrilhaInvalido,
  normalizarResumoPerfil,
  normalizarTituloTrilha,
  ehCapaFoto,
  marcacaoCapa,
  svgCapa,
  svgCapaGaleria,
  type ConfiguracoesTrilha,
  type MudancaConfiguracoes,
  type Tema,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import { codigoDoErro, useDialogo } from './compartilhar';
import { RecorteImagem } from './perfil';
import { tocaSons } from './sons';
import './configuracoes.css';

const k = mensagens.configuracoes;

/** A capa (galeria ou padrão) desenhada em SVG, decorativa. */
export function CapaDaTrilha({ semente, tema, capa, className = 'capa-trilha', grande = false }: { semente: string; tema: Tema | null; capa: string | null | undefined; className?: string; grande?: boolean }) {
  return <span className={className} aria-hidden="true" data-foto={ehCapaFoto(capa) || undefined} dangerouslySetInnerHTML={{ __html: marcacaoCapa({ codigo: semente, tema, capa, tamanho: grande ? 1024 : 480 }) }} />;
}

type Campo = 'titulo' | 'descricao' | 'tema' | 'capa';

export function TelaConfiguracoes({ planoId, recebidaDe, compartilhar, voltar, aoMudar, mudarCompartilhamento, apagar, versao }: {
  planoId: string;
  /**
   * Trilha adicionada de outra pessoa: o nome de quem compartilhou (a cópia é dela; não se compartilha de novo). `''` é a trilha recebida sem nome (a pessoa
   * excluiu a conta ou parou de compartilhar): continua recebida, só não diz de quem. `null` ou ausente: a trilha é da própria pessoa.
   */
  recebidaDe?: string | null;
  /** Com o compartilhar ligado: a seção "Quem pode ver". */
  compartilhar: boolean;
  voltar: () => void;
  /** Nome, capa ou tema mudaram: a lista e o mapa mostram o novo. */
  aoMudar: (configuracoes: ConfiguracoesTrilha) => void;
  mudarCompartilhamento: () => void;
  apagar: () => void;
  /** Muda quando a folha de compartilhar fecha: a linha de "Quem pode ver" relê o estado. */
  versao: number;
}) {
  /** Trilha recebida (com ou sem o nome de quem compartilhou): não se compartilha de novo. */
  const recebida = recebidaDe !== null && recebidaDe !== undefined;
  const [conf, setConf] = useState<ConfiguracoesTrilha | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [estado, setEstado] = useState<'livre' | 'salvando' | 'salvo'>('livre');
  const [galeria, setGaleria] = useState(false);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const tituloTela = useRef<HTMLHeadingElement>(null);
  const ids = { titulo: useId(), tituloDica: useId(), tituloErro: useId(), descricao: useId(), descricaoDica: useId(), descricaoErro: useId(), descricaoContador: useId(), tema: useId(), estado: useId() };

  useEffect(() => { tituloTela.current?.focus(); }, []);
  useEffect(() => {
    let ativo = true;
    cliente.obterConfiguracoes(planoId).then((dados) => {
      if (!ativo) return;
      setConf(dados);
      setTitulo((atual) => (conf ? atual : dados.titulo));
      setDescricao((atual) => (conf ? atual : dados.descricao ?? ''));
    }).catch((falha) => { if (ativo) setErroCarregar(codigoDoErro(falha)); });
    return () => { ativo = false; };
    // Relê ao voltar da folha de compartilhar (versao); os campos em edição ficam como estão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planoId, versao]);

  async function salvar(campo: Campo, mudanca: MudancaConfiguracoes) {
    setEstado('salvando');
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    try {
      const novo = await cliente.salvarConfiguracoes(planoId, mudanca);
      setConf(novo);
      setEstado('salvo');
      void tocaSons.tocarEfeito('salvo');
      aoMudar(novo);
    } catch (falha) {
      setErros((atual) => ({ ...atual, [campo]: textoErro(codigoDoErro(falha)) }));
      setEstado('livre');
    }
  }

  function sairDoTitulo() {
    if (!conf) return;
    const normal = normalizarTituloTrilha(titulo);
    if (normal === conf.titulo) { setTitulo(conf.titulo); return; }
    const motivo = motivoTituloTrilhaInvalido(normal);
    if (motivo) { setErros((atual) => ({ ...atual, titulo: k.nomeErros[motivo] })); return; }
    setTitulo(normal);
    void salvar('titulo', { titulo: normal });
  }

  function sairDaDescricao() {
    if (!conf) return;
    const normal = normalizarResumoPerfil(descricao);
    if (normal === (conf.descricao ?? '')) return;
    const motivo = motivoLegendaInvalida(normal);
    if (motivo) { setErros((atual) => ({ ...atual, descricao: mensagens.comunidade.legendaErros[motivo] })); return; }
    setDescricao(normal);
    void salvar('descricao', { descricao: normal || null });
  }

  if (erroCarregar) {
    return (
      <section className="painel painel--configuracoes">
        <Botao variante="texto" className="configuracoes__voltar" onClick={voltar}><Icone nome="setaVoltar" />{k.voltar}</Botao>
        <p className="campo-erro" role="alert">{textoErro(erroCarregar)}</p>
      </section>
    );
  }

  const usados = [...normalizarResumoPerfil(descricao)].length;
  const nomeCapa = !conf?.capa ? k.capaPadrao : ehCapaFoto(conf.capa) ? k.suaFoto : k.capas[conf.capa] ?? conf.capa;
  const comp = conf?.compartilhamento;
  const destino = comp && comp.moderacao !== 'recusado' ? comp : null;

  return (
    <section className="painel painel--configuracoes" aria-labelledby="configuracoes-titulo" aria-busy={!conf || undefined}>
      <div className="configuracoes__topo">
        <Botao variante="texto" className="configuracoes__voltar" onClick={voltar}><Icone nome="setaVoltar" />{k.voltar}</Botao>
        <h1 id="configuracoes-titulo" ref={tituloTela} tabIndex={-1} className="titulo-pagina">{k.titulo}</h1>
        <p id={ids.estado} className="configuracoes__estado" role="status" aria-live="polite" data-estado={estado}>
          {estado === 'salvando' ? k.salvando : estado === 'salvo' ? <><Icone nome="check" />{k.salvo}</> : ''}
        </p>
      </div>

      {!conf ? <div className="folha-esqueleto" aria-hidden="true"><span /><span /><span /></div> : (
        <>
          {recebida && <p className="configuracoes__recebida" role="note">{recebidaDe ? k.recebida(recebidaDe) : k.recebidaSemNome}</p>}

          <section className="configuracoes__secao" aria-labelledby="configuracoes-capa-nome">
            <h2 id="configuracoes-capa-nome" className="perfil-secao__titulo">{k.capaENome}</h2>
            <div className="configuracoes__capa">
              <CapaDaTrilha semente={conf.semente} tema={conf.tema} capa={conf.capa} className="configuracoes__previa" />
              <div className="configuracoes__capa-acoes">
                <p className="campo-dica">{conf.capaModeracao === 'pendente' ? mensagens.seguranca.capaEmRevisao : k.capaEscolhida(nomeCapa)}</p>
                <Botao variante="secundario" onClick={() => setGaleria(true)}><Icone nome="imagem" />{k.trocarCapa}</Botao>
                {erros.capa && <p className="campo-erro campo-erro--colado"><Icone nome="alerta" />{erros.capa}</p>}
              </div>
            </div>

            <div className="campo" data-erro={erros.titulo ? true : undefined}>
              <label htmlFor={ids.titulo}>{k.nomeRotulo}</label>
              <input id={ids.titulo} value={titulo} maxLength={120} autoComplete="off"
                aria-invalid={erros.titulo ? true : undefined} aria-describedby={erros.titulo ? ids.tituloErro : ids.tituloDica}
                onChange={(e) => { setTitulo(e.target.value); if (erros.titulo) setErros((atual) => ({ ...atual, titulo: undefined })); }}
                onBlur={sairDoTitulo} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
              {erros.titulo && <p className="campo-erro campo-erro--colado" id={ids.tituloErro}><Icone nome="alerta" />{erros.titulo}<RegrasDaRecusa erro={erros.titulo} /></p>}
              <p className="campo-dica" id={ids.tituloDica} hidden={Boolean(erros.titulo)}>{k.nomeDica}</p>
            </div>

            <div className="campo campo--resumo" data-erro={erros.descricao ? true : undefined}>
              <div className="campo__linha">
                <label htmlFor={ids.descricao}>{k.descricaoRotulo}</label>
                <span className="campo__contador" id={ids.descricaoContador} data-acima={usados > LIMITES_COMUNIDADE.legendaMax || undefined}>
                  <span aria-hidden="true">{mensagens.perfil.resumoContador(usados, LIMITES_COMUNIDADE.legendaMax)}</span>
                  <span className="somente-leitor">{mensagens.perfil.resumoContadorLeitor(LIMITES_COMUNIDADE.legendaMax - usados)}</span>
                </span>
              </div>
              <textarea id={ids.descricao} rows={2} maxLength={220} value={descricao}
                aria-invalid={erros.descricao ? true : undefined} aria-describedby={`${erros.descricao ? ids.descricaoErro : ids.descricaoDica} ${ids.descricaoContador}`}
                onChange={(e) => { setDescricao(e.target.value.replace(/[\r\n]+/g, ' ')); if (erros.descricao) setErros((atual) => ({ ...atual, descricao: undefined })); }}
                onBlur={sairDaDescricao} />
              {erros.descricao && <p className="campo-erro campo-erro--colado" id={ids.descricaoErro}><Icone nome="alerta" />{erros.descricao}<RegrasDaRecusa erro={erros.descricao} /></p>}
              <p className="campo-dica" id={ids.descricaoDica} hidden={Boolean(erros.descricao)}>{k.descricaoDica}</p>
            </div>

            <fieldset className="interesses" aria-describedby={ids.tema}>
              <legend>{k.temaRotulo}</legend>
              <p className="campo-dica" id={ids.tema}>{k.temaDica}</p>
              <div className="interesses__lista">
                {TEMAS.map((tema) => (
                  <label key={tema} className="interesse">
                    <input type="radio" name={`tema-${planoId}`} checked={(conf.tema ?? null) === tema}
                      onChange={() => void salvar('tema', { tema })} />
                    <span>{mensagens.temas[tema]}{!conf.tema && tema === conf.temaSugerido && <em className="publicacao__sugerido"> · {mensagens.comunidade.temaSugerido}</em>}</span>
                  </label>
                ))}
              </div>
              {erros.tema && <p className="campo-erro campo-erro--colado"><Icone nome="alerta" />{erros.tema}</p>}
            </fieldset>
          </section>

          {compartilhar && !recebida && (
            <section className="configuracoes__secao" aria-labelledby="configuracoes-quem">
              <h2 id="configuracoes-quem" className="perfil-secao__titulo">{k.quemPodeVer}</h2>
              <p className="configuracoes__linha">
                <Icone nome={!destino ? 'cadeado' : destino.visibilidade === 'explorar' ? 'bussola' : destino.visibilidade === 'perfil' ? 'pessoa' : 'elo'} />
                {destino ? k.estadoCompartilhamento(rotuloDoDestino(destino.visibilidade, destino.moderacao), destino.estudando, destino.valeus) : k.soVoce}
              </p>
              <EstadoModeracao estado={comp?.moderacao} />
              <Botao variante="secundario" className="configuracoes__botao" onClick={mudarCompartilhamento}><Icone nome="compartilhar" />{k.mudarCompartilhamento}</Botao>
            </section>
          )}

          <section className="configuracoes__secao configuracoes__secao--perigo" aria-labelledby="configuracoes-apagar">
            <h2 id="configuracoes-apagar" className="perfil-secao__titulo">{k.apagarTitulo}</h2>
            <p className="campo-dica">{k.apagarDica}</p>
            <Botao variante="secundario" className="modal-confirmar--destrutivo configuracoes__botao" onClick={apagar}><Icone nome="lixeira" />{k.apagar}</Botao>
          </section>
        </>
      )}

      {galeria && conf && (
        <GaleriaDeCapas atual={conf.capa} semente={conf.semente} tema={conf.tema} comFoto={compartilhar}
          aoFechar={() => setGaleria(false)}
          aoEscolher={(capa) => { setGaleria(false); if (capa !== conf.capa) void salvar('capa', { capa }); }}
          aoEscolherArquivo={(dados) => { setGaleria(false); setArquivo(dados); }}
          aoErroArquivo={(texto) => { setGaleria(false); setErros((atual) => ({ ...atual, capa: texto })); }} />
      )}
      {arquivo && (
        // A foto da capa: o mesmo recorte do perfil, na proporção da capa (2:1).
        <RecorteImagem origem={arquivo} proporcao={2} titulo={k.capaFotoTitulo} aviso={k.capaFotoAviso}
          aoCancelar={() => setArquivo(null)}
          enviar={async (base64) => {
            const novo = await cliente.enviarCapa(planoId, base64);
            setArquivo(null);
            setConf(novo);
            setEstado('salvo');
            void tocaSons.tocarEfeito('salvo');
            aoMudar(novo);
          }} />
      )}
    </section>
  );
}

/** A galeria de capas, numa folha do próprio app: a padrão e as 12 prontas. Escolher salva e fecha. */
function GaleriaDeCapas({ atual, semente, tema, comFoto, aoFechar, aoEscolher, aoEscolherArquivo, aoErroArquivo }: {
  atual: string | null;
  semente: string;
  tema: Tema | null;
  /** "Usar uma foto" (com o compartilhar ligado, a mesma flag da foto do perfil). */
  comFoto: boolean;
  aoFechar: () => void;
  aoEscolher: (capa: string | null) => void;
  aoEscolherArquivo: (dataUrl: string) => void;
  aoErroArquivo: (texto: string) => void;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  function lerArquivo(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (arquivoRef.current) arquivoRef.current.value = '';
    if (!escolhido) return;
    if (!escolhido.type.startsWith('image/') || escolhido.size > 30 * 1024 * 1024) { aoErroArquivo(mensagens.perfil.fotoIlegivel); return; }
    const leitor = new FileReader();
    leitor.onload = () => { if (typeof leitor.result === 'string') aoEscolherArquivo(leitor.result); };
    leitor.onerror = () => aoErroArquivo(mensagens.perfil.fotoIlegivel);
    leitor.readAsDataURL(escolhido);
  }
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  useDialogo(caixa, aoFechar);
  useEffect(() => { caixa.current?.querySelector<HTMLInputElement>('input:checked')?.focus(); }, []);
  const opcoes: { id: string | null; nome: string; svg: string }[] = [
    ...(ehCapaFoto(atual) ? [{ id: atual as string, nome: k.suaFoto, svg: marcacaoCapa({ codigo: semente, tema, capa: atual }) }] : []),
    { id: null, nome: k.capaPadrao, svg: svgCapa({ codigo: semente, tema, capa: null }) },
    ...CAPAS_GALERIA.map((capa) => ({ id: capa.id as string, nome: k.capas[capa.id] ?? capa.id, svg: svgCapaGaleria(capa.id) })),
  ];
  return (
    <div className="folha-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="folha folha--galeria" role="dialog" aria-modal="true" aria-labelledby={tituloId} ref={caixa}>
        <div className="folha-topo">
          <span />
          <button type="button" className="folha-fechar" aria-label={mensagens.compartilhar.fechar} onClick={aoFechar}><Icone nome="fechar" /></button>
        </div>
        <h2 id={tituloId} className="folha-titulo">{k.capaTitulo}</h2>
        {comFoto && (
          <div className="galeria-capas__foto">
            <Botao variante="secundario" onClick={() => arquivoRef.current?.click()}><Icone nome="camera" />{k.usarFoto}</Botao>
            <span className="campo-dica">{k.usarFotoDica}</span>
            <input ref={arquivoRef} type="file" accept="image/*" hidden onChange={(e) => lerArquivo(e.target.files)} />
          </div>
        )}
        <fieldset className="galeria-capas">
          <legend className="somente-leitor">{k.capaTitulo}</legend>
          {opcoes.map((opcao) => (
            <label key={opcao.id ?? 'padrao'} className="galeria-capas__opcao">
              <input type="radio" name="capa-da-trilha" checked={(atual ?? null) === opcao.id} onChange={() => aoEscolher(opcao.id)} />
              <span className="galeria-capas__desenho" aria-hidden="true" data-foto={ehCapaFoto(opcao.id) || undefined} dangerouslySetInnerHTML={{ __html: opcao.svg }} />
              <span className="galeria-capas__nome">{opcao.nome}{opcao.id === null && <small> · {k.capaPadraoDica}</small>}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
