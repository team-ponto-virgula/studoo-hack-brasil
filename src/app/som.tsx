'use client';

/*
 * Controle de som na web (spec 12): a folha "Som" (Mudo e os cinco climas, mais os efeitos), o botão de som no alto da
 * aula e a seção "Som" do Perfil. O estado vem do toca-sons (`tocaSons.obterEstado` / `assinarEstado`); a escolha fica
 * no aparelho e vale na hora, sem "Salvar".
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent as TeclaReact } from 'react';
import { OPCOES_FUNDO_UI, type EstadoSomSnapshot, type IdSomFundo } from '../../packages/contratos/src/catalogo-sons';
import { mensagens } from '../mensagens/pt-BR';
import { Icone, type NomeIcone } from '../ui';
import { useDialogo } from './compartilhar';
import { tocaSons } from './sons';
import './som.css';

const t = mensagens.som;
const CHAVE_VISTO = 'studoo.sons.visto';
const CHAVE_LICOES = 'studoo.sons.licoes';
const ICONES_FUNDO: Record<IdSomFundo, NomeIcone> = {
  mudo: 'somCortado', foco_calmo: 'ondas', chuva_suave: 'chuva', lofi_estudo: 'fones', biblioteca: 'livros', brisa_natural: 'folha',
};
const nomeDoFundo = (id: IdSomFundo) => OPCOES_FUNDO_UI.find((opcao) => opcao.id === id)?.rotulo ?? id;

/** O estado do toca-sons, atualizado a cada mudança (no servidor e antes de montar, o padrão da spec: Mudo e efeitos ligados). */
export function useEstadoSom(): EstadoSomSnapshot {
  const [estado, setEstado] = useState<EstadoSomSnapshot>({
    efeitosAtivos: true, fundo: 'mudo', estadoFundo: 'parado', motivoPausa: 'nenhum', desbloqueado: false, erroFundo: null,
  });
  useEffect(() => tocaSons.assinarEstado(setEstado), []);
  return estado;
}

/** O ponto de novidade some quando a pessoa abre a folha uma vez ou conclui 3 lições (no aparelho). */
function lerVisto() {
  try { return localStorage.getItem(CHAVE_VISTO) === '1' || Number(localStorage.getItem(CHAVE_LICOES) ?? 0) >= 3; } catch { return true; }
}
function marcarVisto() { try { localStorage.setItem(CHAVE_VISTO, '1'); } catch { /* sem armazenamento */ } }
/** Chamado a cada lição concluída: na terceira, a novidade some. */
export function contarLicaoParaNovidadeDoSom() {
  try { localStorage.setItem(CHAVE_LICOES, String(Number(localStorage.getItem(CHAVE_LICOES) ?? 0) + 1)); } catch { /* sem armazenamento */ }
}

/** A chave do Studoo (nunca a do sistema): 52 × 32, trilho cinza ou azul, botão branco que anda 20 px. */
export function ChaveStudoo({ ligada, aoMudar, rotuloId, descricaoId }: { ligada: boolean; aoMudar: (ligada: boolean) => void; rotuloId: string; descricaoId?: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} aria-labelledby={rotuloId} aria-describedby={descricaoId} className="chave-studoo"
      onClick={() => aoMudar(!ligada)}>
      <span className="chave-studoo__botao" aria-hidden="true" />
    </button>
  );
}

/** As três barras de "Tocando". */
function Barras() {
  return <span className="som-barras" aria-hidden="true"><span /><span /><span /></span>;
}

/**
 * A folha "Som" (componente de folha do Studoo: sobe do pé no celular, cartão no centro a partir de 768 px). O foco abre no
 * título; Esc, o véu e o X fecham, e o foco volta para quem abriu.
 */
export function FolhaSom({ aoFechar }: { aoFechar: () => void }) {
  const estado = useEstadoSom();
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const ids = { titulo: useId(), fundo: useId(), efeitos: useId(), efeitosDica: useId() };
  const [anuncio, setAnuncio] = useState('');
  const escolhaFeita = useRef(false);
  const iphone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  useDialogo(caixa, aoFechar);

  useEffect(() => {
    titulo.current?.focus();
    marcarVisto();
    tocaSons.definirPreviewFolha({ aberta: true });
    // Reabrir a folha tenta de novo o clima que falhou.
    if (tocaSons.obterEstado().estadoFundo === 'erro') void tocaSons.tentarNovamenteFundo();
    return () => tocaSons.definirPreviewFolha({ aberta: false });
  }, []);

  // O leitor de tela ouve a escolha (a marca do rádio) e, quando o som chega, "Tocando".
  useEffect(() => {
    if (!escolhaFeita.current) return;
    if (estado.fundo === 'mudo') setAnuncio(t.anuncioMudo);
    else if (estado.estadoFundo === 'tocando') setAnuncio(t.anuncioEscolhido(nomeDoFundo(estado.fundo)));
    else if (estado.estadoFundo === 'erro') setAnuncio(t.linhaErro(nomeDoFundo(estado.fundo)));
  }, [estado.fundo, estado.estadoFundo]);

  function escolher(id: IdSomFundo, comAtraso = false) {
    escolhaFeita.current = true;
    if (id === estado.fundo && estado.estadoFundo === 'erro') { void tocaSons.tentarNovamenteFundo(); return; }
    // Setas: a prévia só começa quando a opção fica marcada por 600 ms (passar pelas opções não toca nada).
    if (comAtraso) tocaSons.definirFundoComAtraso(id, 600);
    else void tocaSons.definirFundo(id);
  }

  function teclaNaLista(evento: TeclaReact<HTMLDivElement>) {
    const ordem = OPCOES_FUNDO_UI.map((opcao) => opcao.id);
    const atual = ordem.indexOf(estado.fundo);
    let proximo = -1;
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowRight') proximo = (atual + 1) % ordem.length;
    else if (evento.key === 'ArrowUp' || evento.key === 'ArrowLeft') proximo = (atual - 1 + ordem.length) % ordem.length;
    else if (evento.key === 'Home') proximo = 0;
    else if (evento.key === 'End') proximo = ordem.length - 1;
    if (proximo < 0) return;
    evento.preventDefault();
    escolher(ordem[proximo], true);
    lista.current?.querySelectorAll<HTMLElement>('[role="radio"]')[proximo]?.focus();
  }

  return (
    <div className="folha-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="folha folha--som" role="dialog" aria-modal="true" aria-labelledby={ids.titulo} ref={caixa}>
        <span className="folha__alca" aria-hidden="true" />
        <div className="folha-som__topo">
          <h2 id={ids.titulo} ref={titulo} tabIndex={-1} className="folha-som__titulo">{t.titulo}</h2>
          <button type="button" className="folha-fechar" aria-label={t.fechar} onClick={aoFechar}><Icone nome="fechar" /></button>
        </div>
        <div className="folha-som__bloco">
          <h3 id={ids.fundo} className="folha-som__subtitulo">{t.fundoTitulo}</h3>
          <p className="folha-som__dica">{t.fundoDica}</p>
        </div>
        <div className="som-lista" role="radiogroup" aria-labelledby={ids.fundo} ref={lista} onKeyDown={teclaNaLista}>
          {OPCOES_FUNDO_UI.map((opcao) => {
            const marcada = estado.fundo === opcao.id;
            const tocando = marcada && opcao.id !== 'mudo' && estado.estadoFundo === 'tocando';
            const carregando = marcada && opcao.id !== 'mudo' && estado.estadoFundo === 'carregando';
            const erro = marcada && opcao.id !== 'mudo' && estado.estadoFundo === 'erro';
            const rotulo = erro ? t.linhaErro(opcao.rotulo) : tocando ? t.linhaTocando(opcao.rotulo) : t.linhaRotulo(opcao.rotulo, opcao.descricao);
            return (
              <div key={opcao.id} role="radio" aria-checked={marcada} aria-label={rotulo} tabIndex={marcada ? 0 : -1} className="som-opcao"
                data-marcada={marcada || undefined} data-estado={tocando ? 'tocando' : carregando ? 'carregando' : erro ? 'erro' : undefined}
                onClick={() => escolher(opcao.id)} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); escolher(opcao.id); } }}>
                <span className="som-opcao__icone" aria-hidden="true"><Icone nome={ICONES_FUNDO[opcao.id]} /></span>
                <span className="som-opcao__texto" aria-hidden="true">
                  <span className="som-opcao__nome">{opcao.rotulo}</span>
                  {erro ? <span className="som-opcao__erro">{t.erro}</span>
                    : tocando ? <span className="som-opcao__tocando"><Barras />{t.tocando}</span>
                      : carregando ? <span className="som-opcao__carregando"><span className="som-giro" />{t.carregando}</span>
                        : <span className="som-opcao__descricao">{opcao.descricao}</span>}
                </span>
                <span className="som-opcao__marca" aria-hidden="true" />
              </div>
            );
          })}
        </div>
        <hr className="folha-som__linha" />
        <div className="som-efeitos">
          <div className="som-efeitos__texto">
            <span id={ids.efeitos} className="som-efeitos__titulo">{t.efeitosTitulo}</span>
            <span id={ids.efeitosDica} className="som-efeitos__dica">{t.efeitosDica}</span>
          </div>
          {/* Ligar toca uma vez o efeito "salvo" (o toca-sons faz isso); desligar não toca nada. */}
          <ChaveStudoo ligada={estado.efeitosAtivos} rotuloId={ids.efeitos} descricaoId={ids.efeitosDica} aoMudar={(ligada) => void tocaSons.definirEfeitosAtivos(ligada)} />
        </div>
        <p className="folha-som__rodape"><Icone nome="info" /><span>{t.rodape}</span></p>
        {iphone && <p className="folha-som__rodape"><Icone nome="info" /><span>{t.rodapeIphone}</span></p>}
        <p className="somente-leitor" role="status" aria-live="polite">{anuncio}</p>
      </div>
    </div>
  );
}

/**
 * O botão de som do alto da aula (44 × 44): o ícone segue o estado (duas ondas com fundo escolhido, uma onda com fundo
 * mudo e efeitos ligados, cortado com tudo desligado) e nunca se move. Abre a folha por cima da lição; ao fechar, o foco
 * volta ao botão. Ponto de novidade até a primeira abertura ou a terceira lição concluída.
 */
export function BotaoSom() {
  const estado = useEstadoSom();
  const [aberta, setAberta] = useState(false);
  const [novidade, setNovidade] = useState(false);
  useEffect(() => { setNovidade(!lerVisto()); }, [aberta]);
  const clima = estado.fundo !== 'mudo' ? nomeDoFundo(estado.fundo) : null;
  const motivo = clima && (estado.motivoPausa === 'sem_gesto' || estado.motivoPausa === 'gravando') ? estado.motivoPausa : null;
  const icone: NomeIcone = clima ? 'som' : estado.efeitosAtivos ? 'somUmaOnda' : 'somCortado';
  return (
    <>
      <button type="button" className="aula-som" data-ativo={clima ? true : undefined} aria-haspopup="dialog"
        aria-label={t.botaoRotulo({ clima, efeitos: estado.efeitosAtivos, motivo, novidade })} onClick={() => setAberta(true)}>
        <Icone nome={icone} />
        {novidade && <span className="aula-som__novidade" aria-hidden="true" />}
      </button>
      {aberta && <FolhaSom aoFechar={() => setAberta(false)} />}
    </>
  );
}

/** A seção "Som" do Perfil (antes de "Conta"): "Som de fundo" abre a folha; "Efeitos sonoros" tem a chave. */
export function SecaoSomPerfil() {
  const estado = useEstadoSom();
  const [aberta, setAberta] = useState(false);
  const ids = { titulo: useId(), efeitos: useId(), efeitosDica: useId() };
  const valor = nomeDoFundo(estado.fundo);
  return (
    <section className="perfil-secao" aria-labelledby={ids.titulo}>
      <h2 id={ids.titulo} className="perfil-secao__titulo">{t.titulo}</h2>
      <div className="som-perfil">
        <button type="button" className="som-perfil__linha" aria-haspopup="dialog" aria-label={t.perfilFundoRotulo(valor)} onClick={() => setAberta(true)}>
          <span className="som-perfil__titulo">{t.fundoTitulo}</span>
          <span className="som-perfil__valor" aria-hidden="true">{valor}</span>
          <Icone nome="seta" />
        </button>
        <div className="som-perfil__linha som-perfil__linha--chave">
          <span className="som-efeitos__texto">
            <span id={ids.efeitos} className="som-perfil__titulo">{t.efeitosTitulo}</span>
            <span id={ids.efeitosDica} className="som-efeitos__dica">{t.efeitosDicaPerfil}</span>
          </span>
          <ChaveStudoo ligada={estado.efeitosAtivos} rotuloId={ids.efeitos} descricaoId={ids.efeitosDica} aoMudar={(ligada) => void tocaSons.definirEfeitosAtivos(ligada)} />
        </div>
      </div>
      {aberta && <FolhaSom aoFechar={() => setAberta(false)} />}
    </section>
  );
}

/** O fundo toca no app inteiro depois da entrada (decisão do dono, spec 12): fora daqui (entrada, /t, /p), para. */
export function useAreaDoSom(ativa: boolean) {
  useEffect(() => {
    tocaSons.definirAreaPermitida(ativa);
    return () => tocaSons.definirAreaPermitida(false);
  }, [ativa]);
}
