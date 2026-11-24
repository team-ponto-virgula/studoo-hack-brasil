'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CapturaDaTela, Celular, TAMANHOS } from '../celular';
import type { CapturaOtimizada, Plataforma } from '../imagens';

const MS_POR_TELA = 3500;
/** Depois do evento `load`, quanto esperar para buscar a segunda e a terceira telas. */
const ESPERA_PARA_LIBERAR_MS = 1000;

export interface TelaDoHeroi { captura: CapturaOtimizada; alt: string }

/**
 * O celular do herói (spec 18, 1.4): três capturas nativas em laço, 3,5 s cada; a troca leva 400 ms, com a nova subindo 12 px (o CSS faz), SEM quadro vazio: a nova entra POR CIMA
 * da que sai, e a que sai fica inteira (`data-saindo`) por baixo até a nova terminar de entrar (`animationend`); a soma das opacidades das telas nunca cai abaixo de 1 (antes, a que saía
 * sumia na hora e a nova subia de zero: a tela do celular ficava desbotada na troca). A animação de entrada é só da tela que ENTRA numa troca (`data-entrando`): a primeira tela nunca anima, nem
 * quando a página hidrata (antes a animação reiniciava nela e a tela piscava a 0 por uns 230 ms na carga). A troca só acontece quando a próxima captura já chegou (rede lenta: espera, não mostra vazio). O laço só
 * roda com o herói na tela, a aba à vista e sem movimento reduzido; com movimento reduzido fica só a proposta pronta, parada (o CSS). A primeira captura carrega já; a segunda e a terceira só
 * entram no código quando o laço começa. O conjunto tem um rótulo só, e a troca nunca é anunciada.
 */
export function CelularDoHeroi({ telas, rotulo, plataforma }: { telas: readonly TelaDoHeroi[]; rotulo: string; plataforma: Plataforma }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [troca, setTroca] = useState<{ ativa: number; anterior: number | null }>({ ativa: 0, anterior: null });
  const ativaAgora = useRef(0);
  const [rodando, setRodando] = useState(false);
  const [pausada, setPausada] = useState(false);
  const [liberadas, setLiberadas] = useState(false);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    let naTela = false;
    const atualizar = () => setRodando(naTela && !document.hidden && !reduzido.matches);
    const observador = new IntersectionObserver(([entrada]) => { naTela = entrada.isIntersecting; atualizar(); }, { threshold: 0.3 });
    observador.observe(el);
    document.addEventListener('visibilitychange', atualizar);
    reduzido.addEventListener('change', atualizar);
    return () => {
      observador.disconnect();
      document.removeEventListener('visibilitychange', atualizar);
      reduzido.removeEventListener('change', atualizar);
    };
  }, []);

  useEffect(() => {
    if (!rodando || pausada) return;
    // A segunda e a terceira telas só são buscadas DEPOIS de a página carregar (mais 1 s): não disputam a banda com a primeira, que é o LCP, nem com o texto e as fontes. A primeira troca é só
    // aos 3,5 s, então sobra tempo; se a captura ainda não chegou, a troca espera (`pronta`).
    let liberar = 0;
    const liberarDepois = () => { liberar = window.setTimeout(() => setLiberadas(true), ESPERA_PARA_LIBERAR_MS); };
    if (document.readyState === 'complete') liberarDepois();
    else window.addEventListener('load', liberarDepois, { once: true });
    let relogio = 0;
    /** A captura da tela `indice` já chegou (carregada e com tamanho): só então ela pode entrar. */
    const pronta = (indice: number) => {
      const imagem = raiz.current?.querySelectorAll<HTMLImageElement>('.cn-captura')[indice];
      return Boolean(imagem && imagem.complete && imagem.naturalWidth > 0);
    };
    function agendar(ms: number) { relogio = window.setTimeout(passo, ms); }
    function passo() {
      const proxima = (ativaAgora.current + 1) % telas.length;
      // Rede lenta: a próxima ainda não chegou, então a atual fica e a pergunta se repete em 250 ms (nunca entra uma tela vazia).
      if (!pronta(proxima)) { agendar(250); return; }
      setTroca({ ativa: proxima, anterior: ativaAgora.current });
      ativaAgora.current = proxima;
      agendar(MS_POR_TELA);
    }
    agendar(MS_POR_TELA);
    return () => {
      window.clearTimeout(relogio);
      window.clearTimeout(liberar);
      window.removeEventListener('load', liberarDepois);
    };
  }, [rodando, pausada, telas.length]);

  /** A tela que saiu só deixa de aparecer quando a nova terminou de entrar (e, por garantia, 1,6 s depois da troca se a aba estiver à vista). */
  const soltarAnterior = useCallback(() => setTroca((atual) => (atual.anterior === null ? atual : { ...atual, anterior: null })), []);
  useEffect(() => {
    if (troca.anterior === null) return;
    const relogio = window.setTimeout(() => { if (!document.hidden) soltarAnterior(); }, 1600);
    return () => window.clearTimeout(relogio);
  }, [troca, soltarAnterior]);

  return (
    <>
      <div ref={raiz} className="cn-heroi__celular" data-pronto={liberadas || undefined}>
        <Celular rotulo={rotulo} plataforma={plataforma}>
          {telas.map((tela, indice) => (
            <div key={tela.alt} className="cn-tela" data-ativa={indice === troca.ativa || undefined} data-saindo={indice === troca.anterior || undefined}
              data-entrando={(indice === troca.ativa && troca.anterior !== null) || undefined}
              onAnimationEnd={(evento) => { if (evento.target === evento.currentTarget && indice === troca.ativa) soltarAnterior(); }}>
              <CapturaDaTela captura={tela.captura} alt={tela.alt} prioridade={indice === 0} escondida={indice > 0 && !liberadas} tamanhos={TAMANHOS.heroi} />
            </div>
          ))}
        </Celular>
      </div>
      <button type="button" className="cn-previa-controle" aria-label={pausada ? 'Retomar prévia do app' : 'Pausar prévia do app'}
        data-parada={pausada || undefined} onClick={() => setPausada(!pausada)}>
        <span aria-hidden="true">{telas.map((tela, indice) => <i key={tela.alt} data-atual={indice === troca.ativa || undefined} />)}</span>
      </button>
    </>
  );
}
