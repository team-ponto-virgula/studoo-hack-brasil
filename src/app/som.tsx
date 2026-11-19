'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PADRAO_PREFERENCIAS_SOM, type EstadoSomSnapshot } from '../../packages/contratos/src/catalogo-sons';
import { mensagens } from '../mensagens/pt-BR';
import { Icone, Mascote, type NomeIcone } from '../ui';
import { useDialogo } from './compartilhar';
import { tocaSons } from './sons';
import './som.css';

const t = mensagens.som;
export function useEstadoSom(): EstadoSomSnapshot {
  const [estado, setEstado] = useState<EstadoSomSnapshot>({
    ...PADRAO_PREFERENCIAS_SOM, estadoFundo: 'parado', motivoPausa: 'sem_gesto', desbloqueado: false, erroFundo: null,
  });
  useEffect(() => tocaSons.assinarEstado(setEstado), []);
  return estado;
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

/** As mesmas duas preferências no perfil e na folha da aula. A mudança vale imediatamente. */
function ControlesSom({ perfil = false }: { perfil?: boolean }) {
  const estado = useEstadoSom();
  const musica = useId(), faixa = useId(), efeitos = useId(), dica = useId();
  const ligada = estado.fundo !== 'mudo';
  const situacao = !ligada ? '' : estado.estadoFundo === 'erro' ? t.musicaErro
    : estado.motivoPausa === 'gravando' ? t.musicaPausada : estado.motivoPausa === 'sem_gesto' ? t.musicaComeca
    : estado.estadoFundo === 'carregando' ? t.carregando : estado.estadoFundo === 'tocando' ? t.tocando : '';
  return <div className={perfil ? 'som-perfil' : 'som-controles'}>
    <div className="som-perfil__linha">
      <div className="som-efeitos__texto"><span id={musica} className="som-perfil__titulo">{t.musicaTitulo}</span>
        <span id={faixa} className="som-efeitos__dica">{t.musicaEmLaco}</span>
        <span className="som-situacao" role="status" data-erro={situacao === t.musicaErro || undefined}>
          {situacao === t.tocando && <span aria-hidden="true" className="som-barras"><i /><i /><i /></span>}
          {situacao === t.carregando && <span aria-hidden="true" className="som-giro" />}
          {situacao}
        </span>
      </div>
      <ChaveStudoo ligada={ligada} rotuloId={musica} descricaoId={faixa} aoMudar={ativar => void tocaSons.definirFundo(ativar ? 'lofi_estudo' : 'mudo')} />
    </div>
    <div className="som-perfil__linha">
      <div className="som-efeitos__texto"><span id={efeitos} className="som-perfil__titulo">{t.efeitosTitulo}</span>
        <span id={dica} className="som-efeitos__dica">{perfil ? t.efeitosDicaPerfil : t.efeitosDica}</span>
      </div>
      <ChaveStudoo ligada={estado.efeitosAtivos} rotuloId={efeitos} descricaoId={dica} aoMudar={ativos => void tocaSons.definirEfeitosAtivos(ativos)} />
    </div>
  </div>;
}

export function FolhaSom({ aoFechar }: { aoFechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const idTitulo = useId();
  const iphone = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  useDialogo(caixa, aoFechar);
  useEffect(() => {
    titulo.current?.focus();
    tocaSons.definirFolhaAberta(true);
    return () => tocaSons.definirFolhaAberta(false);
  }, []);

  return (
    <div className="folha-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="folha folha--som" role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={caixa}>
        <span className="folha__alca" aria-hidden="true" />
        <div className="folha-som__topo">
          <Mascote expressao="acessorio-fone" tamanho={40} />
          <h2 id={idTitulo} ref={titulo} tabIndex={-1} className="folha-som__titulo">{t.titulo}</h2>
          <button type="button" className="folha-fechar" aria-label={t.fechar} onClick={aoFechar}><Icone nome="fechar" /></button>
        </div>
        <ControlesSom />
        <p className="folha-som__rodape"><Icone nome="info" /><span>{t.rodapeMusica}</span></p>
        {iphone && <p className="folha-som__rodape"><Icone nome="info" /><span>{t.rodapeIphone}</span></p>}
      </div>
    </div>
  );
}

export function BotaoSom() {
  const estado = useEstadoSom();
  const [aberta, setAberta] = useState(false);
  const ligada = estado.fundo !== 'mudo';
  const icone: NomeIcone = ligada ? 'som' : estado.efeitosAtivos ? 'somUmaOnda' : 'somCortado';
  return (
    <>
      <button type="button" className="aula-som" data-ativo={ligada ? true : undefined} aria-haspopup="dialog"
        aria-label={t.botaoMusicaRotulo(ligada, estado.efeitosAtivos, estado.motivoPausa)} onClick={() => setAberta(true)}>
        <Icone nome={icone} />
      </button>
      {aberta && <FolhaSom aoFechar={() => setAberta(false)} />}
    </>
  );
}

export function SecaoSomPerfil() {
  const titulo = useId();
  return <section className="perfil-secao" aria-labelledby={titulo}>
    <h2 id={titulo} className="perfil-secao__titulo">{t.titulo}</h2>
    <ControlesSom perfil />
  </section>;
}
