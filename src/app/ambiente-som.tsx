'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mensagens } from '../mensagens/pt-BR';
import { tocaSons } from './sons';
import { BALAO_DO_NO, CABECALHOS_DO_ALTO, cabecalhoDoAlto, lugarDoAviso, quemDesce, reservaDoAviso, type Retangulo } from './aviso-musica-regras';
import '../ui/aviso.css';

const chaveAviso = 'studoo.sons.avisoMusica';

/** O layout conserva a fonte de áudio e o aviso durante a navegação, inclusive ao entrar como visitante. */
export function AmbienteSom() {
  const [visivel, mostrar] = useState(false);
  const [emFoco, manter] = useState(false);
  const caminho = usePathname();
  const aviso = useRef<HTMLDivElement>(null);
  const jaMostrou = useRef(false);
  useEffect(() => {
    tocaSons.prepararFundo();
    return tocaSons.assinarEstado(estado => {
      if (estado.fundo === 'mudo') { mostrar(false); return; }
      if (estado.estadoFundo !== 'tocando' || jaMostrou.current) return;
      jaMostrou.current = true;
      try {
        if (localStorage.getItem(chaveAviso) === '1') return;
        localStorage.setItem(chaveAviso, '1');
      } catch { /* O aviso continua aparecendo só uma vez nesta sessão. */ }
      mostrar(true);
    });
  }, []);
  useEffect(() => {
    if (!visivel || emFoco) return;
    const relogio = window.setTimeout(() => mostrar(false), 7000);
    return () => window.clearTimeout(relogio);
  }, [visivel, emFoco]);
  useLayoutEffect(() => {
    if (!visivel) return;
    /** O elemento que desce para dar lugar ao aviso (marcado com data-aviso-musica-abaixo; a altura vai na variável --aviso-musica-reserva, e o CSS faz a margem). */
    let desce: HTMLElement | null = null;
    /** O cabeçalho preso (sticky) que ganha uma faixa do mesmo fundo atrás do aviso: o mapa e a aula rolam por baixo dele, e sem a faixa o aviso ficaria sobre o que passa (data-aviso-musica-faixa). */
    let faixa: HTMLElement | null = null;
    function marcarFaixa(novo: HTMLElement | null, altura: number) {
      if (faixa && faixa !== novo) { faixa.removeAttribute('data-aviso-musica-faixa'); faixa.style.removeProperty('--aviso-musica-reserva'); faixa = null; }
      if (!novo) return;
      novo.setAttribute('data-aviso-musica-faixa', '');
      novo.style.setProperty('--aviso-musica-reserva', `${reservaDoAviso(altura)}px`);
      faixa = novo;
    }
    function devolver(el: HTMLElement | null) {
      if (!el) return;
      // Volta devagar (a margem tem transição): zera a variável e, passado o tempo da transição, tira a marca, se ninguém tornou a pedir a reserva nesse meio-tempo.
      el.style.setProperty('--aviso-musica-reserva', '0px');
      window.setTimeout(() => {
        if (el.style.getPropertyValue('--aviso-musica-reserva') !== '0px') return;
        el.removeAttribute('data-aviso-musica-abaixo');
        el.style.removeProperty('--aviso-musica-reserva');
      }, 320);
    }
    function reservar(novo: HTMLElement | null, altura: number) {
      if (desce && desce !== novo) { devolver(desce); desce = null; }
      if (!novo) return;
      if (desce !== novo) {
        // O navegador anota o zero antes do valor, e a descida é animada.
        novo.style.setProperty('--aviso-musica-reserva', '0px');
        novo.setAttribute('data-aviso-musica-abaixo', '');
        void novo.offsetHeight;
        desce = novo;
      }
      novo.style.setProperty('--aviso-musica-reserva', `${reservaDoAviso(altura)}px`);
    }
    function posicionar(evento?: Event) {
      const el = aviso.current;
      if (!el) return;
      // Se a pessoa toca num nó e o balão abre com o aviso à vista, o aviso fecha na hora, sem animação (spec 16, item 14).
      if (document.querySelector(BALAO_DO_NO)) { mostrar(false); return; }
      const elementos = [...document.querySelectorAll<HTMLElement>(CABECALHOS_DO_ALTO)];
      const cabecalhos: Retangulo[] = elementos.map((cabecalho) => cabecalho.getBoundingClientRect());
      const ancora = cabecalhoDoAlto(cabecalhos, innerHeight);
      const lugar = lugarDoAviso(ancora, innerWidth);
      el.style.top = lugar.top;
      el.style.left = lugar.left;
      el.style.maxWidth = lugar.maxWidth;
      // Rolar a página não muda quem desce (senão o conteúdo pularia sob o dedo); o resto (a tela mudou, a janela mudou, a placa terminou de entrar) confere de novo.
      if (evento?.type === 'scroll') return;
      const indice = ancora ? cabecalhos.indexOf(ancora) : -1;
      const proximos = elementos.map((cabecalho) => cabecalho.nextElementSibling as HTMLElement | null);
      const altura = el.getBoundingClientRect().height;
      reservar(quemDesce(indice, proximos, document.getElementById('conteudo-principal'), scrollY), altura);
      marcarFaixa(indice >= 0 && getComputedStyle(elementos[indice]).position === 'sticky' ? elementos[indice] : null, altura);
    }
    posicionar();
    const mudanca = new MutationObserver(() => posicionar());
    mudanca.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    // Um cabeçalho que ainda se mexe (entrada animada da placa da geração) muda de lugar sem mudar o DOM: o aviso confere de novo quando a animação acaba.
    document.addEventListener('animationend', posicionar, true);
    document.addEventListener('transitionend', posicionar, true);
    return () => {
      devolver(desce);
      desce = null;
      marcarFaixa(null, 0);
      mudanca.disconnect();
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
      document.removeEventListener('animationend', posicionar, true);
      document.removeEventListener('transitionend', posicionar, true);
    };
  }, [visivel, caminho]);
  return <div ref={aviso} className="aviso-app aviso-musica" role="status" aria-live="polite">
    {visivel && <p>{mensagens.som.musicaAviso}<button type="button" onFocus={() => manter(true)} onBlur={() => manter(false)}
      onClick={() => void tocaSons.definirFundo('mudo')}>{mensagens.som.desligarMusica}</button></p>}
  </div>;
}
