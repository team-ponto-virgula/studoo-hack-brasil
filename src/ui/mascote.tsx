'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CATALOGO_STU, PASTA_STU, deveAnimarStu, faixaAnimadaDoStu, faixaDoStu, type NomeStu } from '@studoo/contratos';

/**
 * Modos da animação (spec 13, emenda E1): `laco` repete enquanto está visível (com as pausas da E4); `uma-vez` faz um
 * ciclo quando aparece; `acontecimento` fica parado até `acontecimento` mudar e faz `ciclos` ciclos; `periodico` faz um
 * ciclo a cada 8 s. Sem modo, só a imagem parada.
 */
export type ModoAnimacaoStu = 'laco' | 'uma-vez' | 'acontecimento' | 'periodico';

const INTERVALO_PERIODICO_MS = 8000;
const OCIOSO_MS = 20_000;
const ESPERA_CARGA_MS = 3000;

/* Um Stu se mexendo por vez (E1): o do acontecimento mais recente ganha; os outros voltam à imagem parada. */
let vez = 0;
let donoDaVez = 0;
const ouvintesDaVez = new Set<() => void>();
const pedirVez = (id: number) => { donoDaVez = id; ouvintesDaVez.forEach((ouvir) => ouvir()); };
const largarVez = (id: number) => { if (donoDaVez === id) { donoDaVez = 0; ouvintesDaVez.forEach((ouvir) => ouvir()); } };

/** Algum campo de texto da tela está com foco (a animação pausa, E4). */
const campoEmFoco = () => {
  const ativo = document.activeElement;
  return ativo instanceof HTMLElement && (ativo.isContentEditable || ativo.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"])'));
};
/** Economia de dados (E4): como movimento reduzido. */
const economia = () => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
  || window.matchMedia('(prefers-reduced-data: reduce)').matches;

/**
 * O mascote oficial (spec 13) pela imagem e pelo tamanho: `tamanho` é o maior lado na tela, em px de CSS. Escolhe a faixa
 * (P, M, G, XG) e deixa o navegador pegar o WebP 1x ou 2x; largura, altura e `aspect-ratio` reservam o lugar antes de
 * carregar (nada pula). O CSS pode encolher a imagem (por exemplo em `cqw`) sem mudar a faixa. `decorativo`: texto
 * alternativo vazio, quando o texto ao lado já diz tudo.
 *
 * `animado` (um modo da E1): a imagem parada aparece primeiro; quando a tela fica interativa, o WebP animado é pedido e
 * entra por cima, na mesma escala e posição, com 120 ms de opacidade (se não chegar em 3 s, fica a parada). Nunca com
 * movimento reduzido ou economia de dados (o arquivo nem é pedido); pausa fora da tela, com a aba escondida, com um
 * campo de texto em foco e, no laço, depois de 20 s sem toque, rolagem ou tecla.
 */
export function Mascote({ expressao, tamanho, decorativo = true, prioridade = false, sombra = false, animado, acontecimento, ciclos = 1, className, style }: {
  expressao: NomeStu;
  tamanho: number;
  decorativo?: boolean;
  /** Acima da dobra: carrega já, sem esperar a rolagem. */
  prioridade?: boolean;
  /**
   * Sombra de contato (spec 13, A2), onde ele pisa no cenário chapado: uma elipse marinho a 14%, com 70% da largura e
   * 10% da altura, borrada. Com ela (ou com `animado`), o `className` vai para um invólucro, que o CSS posiciona.
   */
  sombra?: boolean;
  /** O modo da animação; sem ele, só a imagem parada. */
  animado?: ModoAnimacaoStu;
  /** No modo `acontecimento`: cada valor novo (definido) dispara os ciclos. */
  acontecimento?: string | number;
  /** Quantos ciclos por acontecimento (dois nas conclusões). */
  ciclos?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const item = CATALOGO_STU[expressao];
  const [w, h] = item.proporcao;
  const largura = w >= h ? tamanho : Math.round((tamanho * w) / h);
  const altura = w >= h ? Math.round((tamanho * h) / w) : tamanho;
  const faixa = faixaDoStu(expressao, tamanho);
  const arquivos = item.web.filter((arquivo) => arquivo.faixa === faixa).sort((a, b) => a.densidade - b.densidade);
  const faixaAnimada = animado ? faixaAnimadaDoStu(expressao, tamanho) : null;
  const animados = faixaAnimada && item.animacao ? item.animacao.web.filter((arquivo) => arquivo.faixa === faixaAnimada).sort((a, b) => a.densidade - b.densidade) : [];
  const temAnimacao = animados.length > 0;
  const duracao = (item.animacao?.duracaoMs ?? 0) * Math.max(1, ciclos);
  const comInvolucro = sombra || temAnimacao;

  const caixa = useRef<HTMLSpanElement>(null);
  const [id] = useState(() => { vez += 1; return vez; });
  // O que permite mexer (E4) e o que o modo quer agora (E1).
  const [permitido, setPermitido] = useState(false);
  const [quer, setQuer] = useState(false);
  const [comVez, setComVez] = useState(true);
  const [rodada, setRodada] = useState(0);
  const [carregado, setCarregado] = useState(false);
  const [desistiu, setDesistiu] = useState(false);

  // Permissões: interativa (requestIdleCallback), sem movimento reduzido nem economia, na tela (10%), aba à vista, sem
  // campo de texto em foco e, no laço, sem 20 s ociosos.
  useEffect(() => {
    if (!temAnimacao || !caixa.current) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    let interativa = false;
    let visivel = false;
    let ocioso = false;
    let relogioOcioso = 0;
    const atualizar = () => setPermitido(interativa && !ocioso && !campoEmFoco()
      && deveAnimarStu({ pedido: true, temAnimacao: true, reduzido: reduzido.matches || economia(), visivel, oculta: document.hidden }));
    const acordar = () => {
      window.clearTimeout(relogioOcioso);
      if (ocioso) { ocioso = false; atualizar(); }
      if (animado === 'laco') relogioOcioso = window.setTimeout(() => { ocioso = true; atualizar(); }, OCIOSO_MS);
    };
    const pronto = () => { interativa = true; atualizar(); };
    // Safari não tem requestIdleCallback: espera um instante depois de montar.
    const temOcioso = typeof window.requestIdleCallback === 'function';
    const ocioso1 = temOcioso ? window.requestIdleCallback(pronto, { timeout: 1500 }) : globalThis.setTimeout(pronto, 200);
    const observador = new IntersectionObserver(([entrada]) => { visivel = entrada.intersectionRatio >= 0.1; atualizar(); }, { threshold: [0, 0.1] });
    observador.observe(caixa.current);
    const eventos = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    eventos.forEach((nome) => window.addEventListener(nome, acordar, { passive: true, capture: true }));
    reduzido.addEventListener('change', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    document.addEventListener('focusin', atualizar);
    document.addEventListener('focusout', atualizar);
    acordar();
    return () => {
      if (temOcioso) window.cancelIdleCallback(ocioso1 as number); else globalThis.clearTimeout(ocioso1 as ReturnType<typeof setTimeout>);
      window.clearTimeout(relogioOcioso);
      observador.disconnect();
      eventos.forEach((nome) => window.removeEventListener(nome, acordar, { capture: true }));
      reduzido.removeEventListener('change', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
      document.removeEventListener('focusin', atualizar);
      document.removeEventListener('focusout', atualizar);
    };
  }, [temAnimacao, animado]);

  // O que o modo quer: laço sempre; uma vez ao aparecer; no acontecimento a cada valor novo; de tempos em tempos.
  useEffect(() => {
    if (!temAnimacao || !animado) return;
    if (animado === 'laco') { setQuer(true); return; }
    if (animado === 'uma-vez') { setQuer(true); setRodada((n) => n + 1); return; }
    if (animado === 'periodico') {
      const relogio = window.setInterval(() => { setQuer(true); setRodada((n) => n + 1); }, INTERVALO_PERIODICO_MS);
      return () => window.clearInterval(relogio);
    }
  }, [temAnimacao, animado]);
  useEffect(() => {
    if (!temAnimacao || animado !== 'acontecimento' || acontecimento === undefined) return;
    setQuer(true);
    setRodada((n) => n + 1);
  }, [temAnimacao, animado, acontecimento]);

  // Um por vez: quem começa a mexer pede a vez; ao parar, devolve.
  const mover = temAnimacao && quer && permitido && !desistiu;
  useEffect(() => {
    if (!temAnimacao) return;
    const ouvir = () => setComVez(donoDaVez === 0 || donoDaVez === id);
    ouvintesDaVez.add(ouvir);
    return () => { ouvintesDaVez.delete(ouvir); largarVez(id); };
  }, [temAnimacao, id]);
  useEffect(() => {
    if (!mover) { largarVez(id); return; }
    pedirVez(id);
  }, [mover, id, rodada]);
  const mostrar = mover && comVez;

  // Um ciclo (ou `ciclos`) depois de carregar, nos modos que não são laço; e a desistência se não chegar em 3 s.
  useEffect(() => {
    if (!mostrar) { setCarregado(false); return; }
    if (carregado) {
      if (animado === 'laco') return;
      const fim = window.setTimeout(() => setQuer(false), duracao);
      return () => window.clearTimeout(fim);
    }
    const espera = window.setTimeout(() => setDesistiu(true), ESPERA_CARGA_MS);
    return () => window.clearTimeout(espera);
  }, [mostrar, carregado, animado, duracao, rodada]);

  const parado = (
    <img className={comInvolucro ? 'mascote' : className ? `mascote ${className}` : 'mascote'} data-mascote={expressao}
      src={`${PASTA_STU.web}/${arquivos[0].arquivo}`} srcSet={arquivos.map((arquivo) => `${PASTA_STU.web}/${arquivo.arquivo} ${arquivo.densidade}x`).join(', ')}
      width={largura} height={altura} alt={decorativo ? '' : item.alt} loading={prioridade ? 'eager' : 'lazy'} decoding="async" draggable={false}
      style={comInvolucro
        ? { width: '100%', height: 'auto', aspectRatio: `${w} / ${h}`, opacity: mostrar && carregado ? 0 : 1, transition: 'opacity 120ms ease-out' }
        : { height: 'auto', aspectRatio: `${w} / ${h}`, ...style }} />
  );
  if (!comInvolucro) return parado;
  const [esquerda, topo, larguraAnimada, alturaAnimada] = item.animacao?.caixa ?? [0, 0, 100, 100];
  return (
    <span ref={caixa} className={[sombra ? 'mascote-pe mascote-pe--sombra' : 'mascote-pe', className].filter(Boolean).join(' ')} style={style}
      data-mexendo={mostrar && carregado ? true : undefined}>
      {parado}
      {mostrar && (
        <img key={rodada} className="mascote__animado" data-mascote-animado={expressao} alt="" aria-hidden="true" decoding="async" draggable={false}
          src={`${PASTA_STU.web}/${animados[0].arquivo}`} srcSet={animados.map((arquivo) => `${PASTA_STU.web}/${arquivo.arquivo} ${arquivo.densidade}x`).join(', ')}
          onLoad={() => setCarregado(true)} onError={() => setDesistiu(true)}
          style={{ position: 'absolute', left: `${esquerda}%`, top: `${topo}%`, width: `${larguraAnimada}%`, height: `${alturaAnimada}%`, maxWidth: 'none',
            pointerEvents: 'none', opacity: carregado ? 1 : 0, transition: 'opacity 120ms ease-out' }} />
      )}
    </span>
  );
}
