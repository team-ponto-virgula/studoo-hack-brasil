'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LIMITES_GERACAO } from '@studoo/contratos';
import { METAS_LICOES_DIA, type EstadoOnboarding, type MetaLicoesDia, type ResumoRetencao } from '@studoo/contratos/onboarding';
import { METAS_VISUAIS_ONBOARDING } from '@studoo/contratos/onboarding-visual';
import { Icone } from '../../ui';
import { SemMusica } from '../conheca/ilhas/sem-musica';
import { estiloVisualOnboarding } from './visual';
import './jornada.css';

const metas = METAS_VISUAIS_ONBOARDING;
export const OBJETIVO_MATERIAL_ONBOARDING = 'Quero estudar a partir de um material';
export type PreparacaoPrimeiroEstudo = { objetivo: string; metaLicoesDia: MetaLicoesDia; material: boolean };

export function MetasDoEstudo({ valor, mudar, desativado = false, prefixo = 'onboarding' }: {
  valor: MetaLicoesDia; mudar: (meta: MetaLicoesDia) => void; desativado?: boolean; prefixo?: string;
}) {
  return <fieldset className="jornada-metas" disabled={desativado} style={estiloVisualOnboarding}>
    <legend className="somente-leitor">Sua meta diária</legend>
    {metas.map(meta => <label key={meta.valor} className="jornada-meta" data-selecionada={valor === meta.valor || undefined}>
      <span className="jornada-meta__numero" aria-hidden="true">{meta.valor}</span>
      <span className="jornada-meta__texto"><strong>{meta.titulo}</strong><span>{meta.descricao}</span></span>
      <input type="radio" name={`${prefixo}-meta`} value={meta.valor} checked={valor === meta.valor}
        data-testid={`${prefixo}-meta-${meta.valor}`} onChange={() => mudar(meta.valor)} />
    </label>)}
  </fieldset>;
}

export function PrepararPrimeiroEstudo({ estado, ocupado, erro, preparar, adiar }: {
  estado: EstadoOnboarding; ocupado: boolean; erro: string | null;
  preparar: (dados: PreparacaoPrimeiroEstudo) => void; adiar: () => void;
}) {
  const [passo, setPasso] = useState<'objetivo' | 'meta'>('objetivo');
  const [objetivo, setObjetivo] = useState(estado.objetivo ?? '');
  const [meta, setMeta] = useState<MetaLicoesDia>(estado.metaLicoesDia);
  const [material, setMaterial] = useState(false);
  const [invalido, setInvalido] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { titulo.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [passo]);

  function avancar(evento: FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    if (passo === 'objetivo') {
      if (objetivo.trim().length < LIMITES_GERACAO.objetivoMin) { setInvalido(true); campo.current?.focus(); return; }
      setMaterial(false); setInvalido(false); setPasso('meta');
    } else preparar({ objetivo: material ? objetivo.trim() || OBJETIVO_MATERIAL_ONBOARDING : objetivo.trim(), metaLicoesDia: meta, material });
  }

  return <main className="jornada-preparo" id="conteudo-principal" aria-busy={ocupado} data-sem-musica style={estiloVisualOnboarding}>
    <SemMusica />
    <header className="jornada-marca"><img src="/marca/logo-com-sorriso.png" alt="Studoo" width={144} height={47} /></header>
    <div className="jornada-progresso" aria-hidden="true"><span data-ativo /><span data-ativo={passo === 'meta' || undefined} /></div>
    <section className="jornada-preparo__conteudo" aria-labelledby="jornada-titulo">
      <p className="jornada-etapa">Seu primeiro estudo · {passo === 'objetivo' ? '1' : '2'} de 2</p>
      <h1 id="jornada-titulo" ref={titulo} tabIndex={-1}>{passo === 'objetivo' ? 'O que você quer aprender?' : 'Um passo por dia.'}</h1>
      <p className="jornada-introducao">{passo === 'objetivo'
        ? 'Conte seu objetivo. O Stu transforma esse começo em uma trilha.'
        : 'Escolha uma meta que caiba na sua rotina. Você pode mudar depois.'}</p>
      <form onSubmit={avancar} noValidate className="jornada-formulario">
        {passo === 'objetivo' ? <div className="jornada-campo">
          <label htmlFor="onboarding-objetivo">Seu objetivo</label>
          <textarea ref={campo} id="onboarding-objetivo" data-testid="onboarding-objetivo" rows={2}
            maxLength={LIMITES_GERACAO.objetivoMax} value={objetivo} disabled={ocupado}
            placeholder="Quero aprender SQL para…" aria-invalid={invalido || undefined}
            aria-describedby={invalido ? 'onboarding-objetivo-erro' : undefined}
            onChange={e => { setObjetivo(e.target.value); setInvalido(false); }} />
          {invalido && <p className="jornada-erro" role="alert" id="onboarding-objetivo-erro">Conte um pouco mais sobre o que quer aprender.</p>}
        </div> : <MetasDoEstudo valor={meta} mudar={setMeta} desativado={ocupado} />}
        {erro && <p role="alert" className="jornada-erro">{erro}</p>}
        <div className="jornada-acoes">
        <button className="jornada-primario" type="submit" disabled={ocupado}
          data-testid={passo === 'objetivo' ? 'onboarding-continuar' : 'onboarding-preparar'}>
          {ocupado ? 'Salvando seu começo…' : passo === 'objetivo' ? 'Continuar' : 'Preparar meu estudo'}<Icone nome="seta" />
        </button>
        {passo === 'objetivo' ? <button className="jornada-texto" type="button" disabled={ocupado}
          data-testid="onboarding-material" onClick={() => { setMaterial(true); setInvalido(false); setPasso('meta'); }}>Tenho um material</button>
          : <button className="jornada-texto" type="button" disabled={ocupado} data-testid="onboarding-voltar" onClick={() => setPasso('objetivo')}>Voltar</button>}
        <button className="jornada-texto jornada-texto--discreto" type="button" disabled={ocupado} data-testid="onboarding-adiar" onClick={adiar}>Mais tarde</button>
        </div>
      </form>
    </section>
  </main>;
}

/** Um resumo verificável, sem contadores fictícios ou outra ação competindo com o próximo estudo. */
export function MetaDiariaDoEstudo({ resumo, salvar, compacto = false }: {
  resumo: ResumoRetencao; salvar?: (meta: MetaLicoesDia) => Promise<void>; compacto?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [meta, setMeta] = useState(resumo.metaLicoesDia);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);
  const disparador = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!editando) setMeta(resumo.metaLicoesDia); }, [resumo.metaLicoesDia, editando]);
  async function gravar(evento: FormEvent) {
    evento.preventDefault();
    if (!salvar || ocupado || !METAS_LICOES_DIA.includes(meta)) return;
    setOcupado(true); setErro(false);
    try { await salvar(meta); setEditando(false); window.requestAnimationFrame(() => disparador.current?.focus()); }
    catch { setErro(true); }
    finally { setOcupado(false); }
  }
  const unidade = resumo.metaLicoesDia === 1 ? 'lição' : 'lições';
  return <div className="meta-estudo" data-compacto={compacto || undefined} data-testid="meta-diaria">
    <div className="meta-estudo__linha">
      <span>{resumo.metaAtingida ? `Meta atingida · ${resumo.licoesHoje} ${resumo.licoesHoje === 1 ? 'lição' : 'lições'} hoje`
        : `Hoje: ${resumo.licoesHoje} de ${resumo.metaLicoesDia} ${unidade}`}</span>
      {salvar && !compacto && <button ref={disparador} className="meta-estudo__mudar" type="button" data-testid="mudar-meta"
        aria-expanded={editando} onClick={() => { setEditando(v => !v); setErro(false); }}>{editando ? 'Cancelar' : 'Mudar meta'}</button>}
    </div>
    <progress aria-label="Meta diária de estudo" value={Math.min(resumo.licoesHoje, resumo.metaLicoesDia)} max={resumo.metaLicoesDia} />
    {!compacto && resumo.metaAtingida && <p className="meta-estudo__ajuda">Meta de hoje concluída. Você pode descansar ou seguir.</p>}
    {editando && <form className="meta-estudo__editor" onSubmit={e => void gravar(e)} aria-busy={ocupado}>
      <MetasDoEstudo valor={meta} mudar={setMeta} desativado={ocupado} prefixo="retencao" />
      {erro && <p className="jornada-erro" role="alert">Não foi possível salvar sua meta. Tente novamente.</p>}
      <button className="jornada-primario" disabled={ocupado} type="submit" data-testid="salvar-meta">{ocupado ? 'Salvando…' : 'Salvar meta'}</button>
      <button className="jornada-texto" disabled={ocupado} type="button" onClick={() => { setEditando(false); disparador.current?.focus(); }}>Cancelar</button>
    </form>}
  </div>;
}
