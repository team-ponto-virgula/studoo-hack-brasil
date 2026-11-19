'use client';

/*
 * Configurações da trilha (lote 4, com a revisão de design de 19/11 da spec 10): capa e nome (a capa na largura da
 * seção com "Trocar capa" por cima, nome, descrição e tema), quem pode ver (abre a folha de compartilhar que já existe)
 * e apagar. Cada campo salva sozinho ao sair dele, com "Salvando…" e "Salvo" no rótulo do próprio campo; o erro fica
 * embaixo do campo. Sem diálogo de "sair sem salvar". Só a dona chega aqui (a API recusa as outras). Igual ao app
 * (apps/mobile/src/configuracoes.tsx).
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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
type Estado = 'livre' | 'salvando' | 'salvo';
const SEM_ESTADO: Record<Campo, Estado> = { titulo: 'livre', descricao: 'livre', tema: 'livre', capa: 'livre' };
/** Quanto o "Salvo" fica no rótulo (a saída de 200 ms está no CSS) e quando a galeria fecha depois da escolha (itens 2 e 4). */
export const SALVO_VISIVEL_MS = 2500;
export const GALERIA_FECHA_MS = 300;

/**
 * O estado do salvamento no rótulo do campo, à direita: "Salvando…" com o giro de 14 px e, depois, "Salvo" com o visto,
 * que some sozinho. Só visual: o leitor de tela ouve a frase do campo na região viva da tela.
 */
function EstadoDoCampo({ estado, texto }: { estado: Estado; texto?: string }) {
  if (estado === 'livre') return null;
  return (
    <span className="configuracoes__estado" data-estado={estado} aria-hidden="true">
      {estado === 'salvando' ? <span className="configuracoes__giro" /> : <Icone nome="check" />}
      {estado === 'salvando' ? k.salvando : texto ?? k.salvo}
    </span>
  );
}

/** O rótulo de um campo com o que vai à direita: o estado do salvamento ou, parado, o que vier (o contador). */
function RotuloDoCampo({ children, estado, direita }: { children: ReactNode; estado: Estado; direita?: ReactNode }) {
  return (
    <div className="campo__linha configuracoes__rotulo">
      {children}
      {estado === 'livre' ? direita : <EstadoDoCampo estado={estado} />}
    </div>
  );
}

export function TelaConfiguracoes({ planoId, recebidaDe, compartilhar, voltar, aoMudar, mudarCompartilhamento, apagar, versao }: {
  planoId: string;
  /** Trilha adicionada de outra pessoa: o nome de quem compartilhou (a cópia é dela; não se compartilha de novo). */
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
  const [conf, setConf] = useState<ConfiguracoesTrilha | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [estados, setEstados] = useState(SEM_ESTADO);
  const [anuncio, setAnuncio] = useState('');
  const relogios = useRef<Partial<Record<Campo, ReturnType<typeof setTimeout>>>>({});
  const [galeria, setGaleria] = useState(false);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const tituloTela = useRef<HTMLHeadingElement>(null);
  const ids = { titulo: useId(), tituloDica: useId(), tituloErro: useId(), descricao: useId(), descricaoDica: useId(), descricaoErro: useId(), descricaoContador: useId(), tema: useId() };

  useEffect(() => { tituloTela.current?.focus(); }, []);
  useEffect(() => { const pendentes = relogios.current; return () => Object.values(pendentes).forEach((relogio) => clearTimeout(relogio)); }, []);

  function marcar(campo: Campo, estado: Estado) {
    clearTimeout(relogios.current[campo]);
    setEstados((antes) => ({ ...antes, [campo]: estado }));
    if (estado === 'salvo') relogios.current[campo] = setTimeout(() => setEstados((antes) => ({ ...antes, [campo]: 'livre' })), SALVO_VISIVEL_MS);
  }
  /** A frase do leitor de tela (repetir a mesma ainda é anunciado). */
  function anunciar(texto: string) { setAnuncio((antes) => (antes === texto ? `${texto}\u00a0` : texto)); }
  /** Salvou: o estado no rótulo, o som `salvo` e a frase do campo ("Nome da trilha salvo.", "Capa salva."). */
  function salvou(campo: Campo, novo: ConfiguracoesTrilha) {
    setConf(novo);
    marcar(campo, 'salvo');
    void tocaSons.tocarEfeito('salvo');
    anunciar(campo === 'capa' ? k.capaSalva : k.salvoLeitor[campo]);
    aoMudar(novo);
  }
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

  /** Salva um campo alterado; devolve se salvou (a galeria fica aberta quando falha). */
  async function salvar(campo: Campo, mudanca: MudancaConfiguracoes): Promise<boolean> {
    marcar(campo, 'salvando');
    setErros((atual) => ({ ...atual, [campo]: undefined }));
    try {
      salvou(campo, await cliente.salvarConfiguracoes(planoId, mudanca));
      return true;
    } catch (falha) {
      setErros((atual) => ({ ...atual, [campo]: textoErro(codigoDoErro(falha)) }));
      marcar(campo, 'livre');
      return false;
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
  const comp = conf?.compartilhamento ?? null;
  // Sem tema salvo, o sugerido pelo título já vem marcado; nada é gravado até a pessoa escolher (spec 10).
  const temaMarcado = conf ? conf.tema ?? conf.temaSugerido ?? null : null;

  return (
    <section className="painel painel--configuracoes" aria-labelledby="configuracoes-titulo" aria-busy={!conf || undefined}>
      <div className="configuracoes__topo">
        <Botao variante="texto" className="configuracoes__voltar" onClick={voltar}><Icone nome="setaVoltar" />{k.voltar}</Botao>
        <h1 id="configuracoes-titulo" ref={tituloTela} tabIndex={-1} className="titulo-pagina">{k.titulo}</h1>
      </div>
      {/* O "Salvo" fica no rótulo de cada campo; quem usa leitor de tela ouve a frase do campo aqui. */}
      <p className="somente-leitor" role="status" aria-live="polite">{anuncio}</p>

      {!conf ? <div className="folha-esqueleto" aria-hidden="true"><span /><span /><span /></div> : (
        <>
          {recebidaDe && <p className="configuracoes__recebida" role="note">{k.recebida(recebidaDe)}</p>}

          <section className="configuracoes__secao" aria-labelledby="configuracoes-capa-nome">
            <h2 id="configuracoes-capa-nome" className="perfil-secao__titulo">{k.capaENome}</h2>
            {/* A capa na largura da seção, em 2:1; tocar em qualquer ponto dela abre a galeria, e "Trocar capa" mostra isso. */}
            <div className="configuracoes__capa">
              <button type="button" className="configuracoes__capa-botao" aria-label={k.trocarCapaRotulo(nomeCapa)} onClick={() => setGaleria(true)}>
                <CapaDaTrilha semente={conf.semente} tema={conf.tema} capa={conf.capa} className="configuracoes__previa" grande />
                <span className="configuracoes__trocar" aria-hidden="true"><Icone nome="imagem" />{k.trocarCapa}</span>
              </button>
              <EstadoDoCampo estado={estados.capa} texto={k.capaSalva} />
              {erros.capa && <p className="campo-erro campo-erro--colado"><Icone nome="alerta" />{erros.capa}</p>}
            </div>

            <div className="campo" data-erro={erros.titulo ? true : undefined}>
              <RotuloDoCampo estado={estados.titulo}><label htmlFor={ids.titulo}>{k.nomeRotulo}</label></RotuloDoCampo>
              <input id={ids.titulo} value={titulo} maxLength={120} autoComplete="off"
                aria-invalid={erros.titulo ? true : undefined} aria-describedby={erros.titulo ? ids.tituloErro : ids.tituloDica}
                onChange={(e) => { setTitulo(e.target.value); if (erros.titulo) setErros((atual) => ({ ...atual, titulo: undefined })); }}
                onBlur={sairDoTitulo} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
              {erros.titulo && <p className="campo-erro campo-erro--colado" id={ids.tituloErro}><Icone nome="alerta" />{erros.titulo}</p>}
              <p className="campo-dica" id={ids.tituloDica} hidden={Boolean(erros.titulo)}>{k.nomeDica}</p>
            </div>

            <div className="campo campo--resumo" data-erro={erros.descricao ? true : undefined}>
              <RotuloDoCampo estado={estados.descricao} direita={(
                <span className="campo__contador" data-acima={usados > LIMITES_COMUNIDADE.legendaMax || undefined} aria-hidden="true">
                  {mensagens.perfil.resumoContador(usados, LIMITES_COMUNIDADE.legendaMax)}
                </span>
              )}>
                <label htmlFor={ids.descricao}>{k.descricaoRotulo}</label>
              </RotuloDoCampo>
              <span className="somente-leitor" id={ids.descricaoContador}>{mensagens.perfil.resumoContadorLeitor(LIMITES_COMUNIDADE.legendaMax - usados)}</span>
              <textarea id={ids.descricao} rows={2} maxLength={220} value={descricao}
                aria-invalid={erros.descricao ? true : undefined} aria-describedby={`${erros.descricao ? ids.descricaoErro : ids.descricaoDica} ${ids.descricaoContador}`}
                onChange={(e) => { setDescricao(e.target.value.replace(/[\r\n]+/g, ' ')); if (erros.descricao) setErros((atual) => ({ ...atual, descricao: undefined })); }}
                onBlur={sairDaDescricao} />
              {erros.descricao && <p className="campo-erro campo-erro--colado" id={ids.descricaoErro}><Icone nome="alerta" />{erros.descricao}</p>}
              <p className="campo-dica" id={ids.descricaoDica} hidden={Boolean(erros.descricao)}>{k.descricaoDica}</p>
            </div>

            <fieldset className="interesses" aria-describedby={ids.tema}>
              <legend className="configuracoes__legenda"><RotuloDoCampo estado={estados.tema}><span>{k.temaRotulo}</span></RotuloDoCampo></legend>
              <p className="campo-dica" id={ids.tema}>{k.temaDica}</p>
              <div className="interesses__lista">
                {TEMAS.map((tema) => (
                  <label key={tema} className="interesse">
                    {/* O clique (também no sugerido, que já vem marcado) é que escolhe e grava; as setas do grupo também clicam. */}
                    <input type="radio" name={`tema-${planoId}`} checked={temaMarcado === tema} onChange={() => undefined}
                      onClick={() => { if (conf.tema !== tema) void salvar('tema', { tema }); }} />
                    <span>{mensagens.temas[tema]}{!conf.tema && tema === conf.temaSugerido && <em className="publicacao__sugerido"> · {mensagens.comunidade.temaSugerido}</em>}</span>
                  </label>
                ))}
              </div>
              {erros.tema && <p className="campo-erro campo-erro--colado"><Icone nome="alerta" />{erros.tema}</p>}
            </fieldset>
          </section>

          {compartilhar && !recebidaDe && (
            <section className="configuracoes__secao" aria-labelledby="configuracoes-quem">
              <h2 id="configuracoes-quem" className="perfil-secao__titulo">{k.quemPodeVer}</h2>
              <p className="configuracoes__linha">
                <Icone nome={!comp ? 'cadeado' : comp.visibilidade === 'explorar' ? 'bussola' : comp.visibilidade === 'perfil' ? 'pessoa' : 'elo'} />
                {comp ? k.estadoCompartilhamento(mensagens.comunidade.niveis[comp.visibilidade].titulo, comp.estudando, comp.valeus) : k.soVoce}
              </p>
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
          aoEscolher={(capa) => salvar('capa', { capa })}
          aoEscolherArquivo={(dados) => { setGaleria(false); setArquivo(dados); }}
          aoErroArquivo={(texto) => { setGaleria(false); setErros((atual) => ({ ...atual, capa: texto })); }} />
      )}
      {arquivo && (
        // A foto da capa: o mesmo recorte do perfil, na proporção da capa (2:1).
        <RecorteImagem origem={arquivo} proporcao={2} titulo={k.capaFotoTitulo} dica={k.capaFotoDica} aviso={k.capaFotoAviso} comSelos
          aoCancelar={() => setArquivo(null)}
          enviar={async (base64) => {
            const novo = await cliente.enviarCapa(planoId, base64);
            setArquivo(null);
            salvou('capa', novo);
          }} />
      )}
    </section>
  );
}

/**
 * A galeria de capas, numa folha do próprio app: "Sua foto" (quando a capa é uma foto), a padrão e as 12 prontas. É um
 * grupo de escolha única: a escolhida tem a borda azul e o visto no canto; escolher salva, mostra o visto na capa nova e
 * fecha a folha em 300 ms. Se não salvar, a folha continua aberta, com a escolha de antes.
 */
function GaleriaDeCapas({ atual, semente, tema, comFoto, aoFechar, aoEscolher, aoEscolherArquivo, aoErroArquivo }: {
  atual: string | null;
  semente: string;
  tema: Tema | null;
  /** "Usar uma foto" (com o compartilhar ligado, a mesma flag da foto do perfil). */
  comFoto: boolean;
  aoFechar: () => void;
  aoEscolher: (capa: string | null) => Promise<boolean>;
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
  const [marcada, setMarcada] = useState<string | null>(atual ?? null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const aberta = useRef(true);
  useEffect(() => () => { aberta.current = false; }, []);
  useDialogo(caixa, () => { if (!enviando) aoFechar(); });
  async function escolher(id: string | null) {
    if (enviando) return;
    if (id === (atual ?? null)) { aoFechar(); return; }
    const inicio = Date.now();
    setErro(false);
    setMarcada(id);
    setEnviando(true);
    const salvou = await aoEscolher(id);
    if (!aberta.current) return;
    if (!salvou) { setMarcada(atual ?? null); setEnviando(false); setErro(true); return; }
    // O visto fica na capa nova pelo menos 300 ms antes de a folha fechar.
    setTimeout(() => { if (aberta.current) aoFechar(); }, Math.max(0, GALERIA_FECHA_MS - (Date.now() - inicio)));
  }
  useEffect(() => { caixa.current?.querySelector<HTMLInputElement>('input:checked')?.focus(); }, []);
  const opcoes: { id: string | null; nome: string; dica?: string; svg: string }[] = [
    ...(ehCapaFoto(atual) ? [{ id: atual as string, nome: k.suaFoto, svg: marcacaoCapa({ codigo: semente, tema, capa: atual }) }] : []),
    { id: null, nome: k.capaPadrao, dica: k.capaPadraoDoTema, svg: svgCapa({ codigo: semente, tema, capa: null }) },
    ...CAPAS_GALERIA.map((capa) => ({ id: capa.id as string, nome: k.capas[capa.id] ?? capa.id, svg: svgCapaGaleria(capa.id) })),
  ];
  return (
    <div className="folha-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="folha folha--galeria" role="dialog" aria-modal="true" aria-labelledby={tituloId} ref={caixa}>
        <div className="folha-topo">
          <span />
          <button type="button" className="folha-fechar" aria-label={mensagens.compartilhar.fechar} disabled={enviando} onClick={aoFechar}><Icone nome="fechar" /></button>
        </div>
        <h2 id={tituloId} className="folha-titulo">{k.capaTitulo}</h2>
        {erro && <p className="campo-erro" role="alert">{mensagens.erros.falha}</p>}
        {comFoto && (
          // O botão ocupa a largura da folha, e a ajuda vai embaixo, numa linha só (revisão de 19/11, item 3).
          <div className="galeria-capas__foto">
            <Botao variante="secundario" disabled={enviando} onClick={() => arquivoRef.current?.click()}><Icone nome="camera" />{k.usarFoto}</Botao>
            <span className="campo-dica">{k.usarFotoAjuda}</span>
            <input ref={arquivoRef} type="file" accept="image/*" hidden onChange={(e) => lerArquivo(e.target.files)} />
          </div>
        )}
        <fieldset className="galeria-capas" role="radiogroup" aria-labelledby={tituloId} aria-busy={enviando || undefined}>
          <legend className="somente-leitor">{k.capaTitulo}</legend>
          {opcoes.map((opcao) => {
            const escolhida = marcada === opcao.id;
            return (
              <label key={opcao.id ?? 'padrao'} className="galeria-capas__opcao" data-escolhida={escolhida || undefined}>
                {/* O nome da capa é o nome acessível; o clique é que escolhe (também na já escolhida, que só fecha). */}
                <input type="radio" name="capa-da-trilha" checked={escolhida} disabled={enviando} aria-checked={escolhida}
                  aria-label={opcao.dica ? `${opcao.nome}, ${opcao.dica}` : opcao.nome}
                  onChange={() => undefined} onClick={() => void escolher(opcao.id)} />
                <span className="galeria-capas__desenho" aria-hidden="true" data-foto={ehCapaFoto(opcao.id) || undefined}>
                  <span className="galeria-capas__svg" dangerouslySetInnerHTML={{ __html: opcao.svg }} />
                  {escolhida && <span className="galeria-capas__visto"><Icone nome="check" /></span>}
                </span>
                <span className="galeria-capas__nome" aria-hidden="true">{opcao.nome}</span>
                {opcao.dica && <span className="galeria-capas__dica" aria-hidden="true">{opcao.dica}</span>}
              </label>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
