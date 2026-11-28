'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { textos } from '../textos';

/** A parada em que a pessoa está: a última cuja região já passou do meio da janela (0 = ainda no alto da página). */
export function paradaAtual(topos: readonly { numero: number; topo: number }[], alturaDaJanela: number): number {
  let atual = 0;
  for (const { numero, topo } of topos) if (topo <= alturaDaJanela * 0.5) atual = Math.max(atual, numero);
  return atual;
}

/** O estado de um marco para quem está na parada `atual`: as que ficaram para trás viram ouro, como as lições concluídas do mapa. */
export const estadoDoMarco = (numero: number, atual: number) => (numero < atual ? 'feito' : numero === atual ? 'atual' : 'adiante');

/**
 * A trilha do cabeçalho: as paradas da página como os nós de uma trilha do Studoo. É a navegação da página (cada nó leva à sua parada) e também o
 * andamento: conforme a pessoa rola, os nós que ficaram para trás viram ouro, o da vez fica azul, e os marcos da própria página acompanham
 * (`data-estado`). Só lê a posição das regiões (um quadro por rolagem) e escreve atributos: nada muda de lugar. Sem JavaScript, é uma lista de links.
 */
export function Trilha() {
  const [atual, setAtual] = useState(0);
  const total = textos.paradas.length;

  useEffect(() => {
    const cabecalho = document.querySelector<HTMLElement>('.cn-cabecalho');
    const heroi = document.getElementById('conteudo');
    const regioes = Array.from(document.querySelectorAll<HTMLElement>('[data-parada]'));
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      setAtual(paradaAtual(regioes.map((regiao) => ({ numero: Number(regiao.dataset.parada), topo: regiao.getBoundingClientRect().top })), window.innerHeight));
      cabecalho?.toggleAttribute('data-rolou', window.scrollY > 8);
      // O botão do cabeçalho só entra quando os botões do alto da página já saíram da tela.
      cabecalho?.toggleAttribute('data-passou-do-alto', heroi !== null && heroi.getBoundingClientRect().bottom < 120);
    };
    const pedir = () => { if (!quadro) quadro = window.requestAnimationFrame(medir); };
    medir();
    window.addEventListener('scroll', pedir, { passive: true });
    window.addEventListener('resize', pedir);
    return () => {
      window.removeEventListener('scroll', pedir);
      window.removeEventListener('resize', pedir);
      window.cancelAnimationFrame(quadro);
    };
  }, []);

  useEffect(() => {
    for (const marco of document.querySelectorAll<HTMLElement>('[data-marco]')) marco.dataset.estado = estadoDoMarco(Number(marco.dataset.marco), atual);
  }, [atual]);

  return (
    <nav className="cn-trilha" aria-label={textos.trilha.rotulo}>
      <ol className="cn-trilha__lista">
        {textos.paradas.map((parada, indice) => {
          const estado = estadoDoMarco(indice + 1, atual);
          return (
            <li key={parada.id} className="cn-trilha__parada" data-estado={estado}>
              <a href={`#${parada.id}`} aria-current={estado === 'atual' ? 'step' : undefined}>
                <span className="cn-trilha__no" aria-hidden="true" />
                <span className="cn-trilha__nome">{parada.atalho}</span>
              </a>
            </li>
          );
        })}
      </ol>
      <span className="cn-trilha__barra" aria-hidden="true" style={{ '--feito': Math.min(1, atual / (total + 1)) } as CSSProperties} />
    </nav>
  );
}
