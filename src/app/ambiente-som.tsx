'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mensagens } from '../mensagens/pt-BR';
import { tocaSons } from './sons';
import { BALAO_DO_NO, CABECALHOS_DO_ALTO, MARCA_DA_TELA, cabecalhoDoAlto, chaveDaTela, criarEspacoDoAviso, lugarDoAviso, quemDesce, reservaDoAviso, type Retangulo } from './aviso-musica-regras';
import '../ui/aviso.css';

const chaveAviso = 'studoo.sons.avisoMusica';

/** O elemento que desce para dar lugar ao aviso leva `data-aviso-musica-abaixo`, e a altura vai na variável `--aviso-musica-reserva` (o CSS faz a margem, com 220 ms de descida). */
function marcarEspaco(elemento: HTMLElement, px: number) {
  if (!elemento.hasAttribute('data-aviso-musica-abaixo')) {
    // O navegador anota o zero antes do valor, e a descida é animada.
    elemento.style.setProperty('--aviso-musica-reserva', '0px');
    elemento.setAttribute('data-aviso-musica-abaixo', '');
    void elemento.offsetHeight;
  }
  elemento.style.setProperty('--aviso-musica-reserva', `${px}px`);
}

/** Tirar a marca devolve o elemento ao lugar na hora (a margem sem a regra não tem transição): é o que se quer ao trocar de tela. */
function soltarEspaco(elemento: HTMLElement) {
  elemento.removeAttribute('data-aviso-musica-abaixo');
  elemento.style.removeProperty('--aviso-musica-reserva');
}

/** A tela de agora: o endereço e a marca `data-tela` do cabeçalho do app. */
const telaDeAgora = () => chaveDaTela(window.location.pathname, document.querySelector(MARCA_DA_TELA)?.getAttribute('data-tela') ?? null);

/** O layout conserva a fonte de áudio e o aviso durante a navegação, inclusive ao entrar como visitante. */
export function AmbienteSom() {
  const [visivel, mostrar] = useState(false);
  const [emFoco, manter] = useState(false);
  const caminho = usePathname();
  const aviso = useRef<HTMLDivElement>(null);
  const jaMostrou = useRef(false);
  /** O espaço que o aviso abriu: fica depois que o aviso sai, até a pessoa trocar de tela. */
  const espaco = useRef(criarEspacoDoAviso<HTMLElement>({ marcar: marcarEspaco, soltar: soltarEspaco, vivo: (elemento) => elemento.isConnected })).current;
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
    /** O cabeçalho preso (sticky) que ganha uma faixa do mesmo fundo atrás do aviso: o mapa e a aula rolam por baixo dele, e sem a faixa o aviso ficaria sobre o que passa (data-aviso-musica-faixa). */
    let faixa: HTMLElement | null = null;
    function marcarFaixa(novo: HTMLElement | null, altura: number) {
      if (faixa && faixa !== novo) { faixa.removeAttribute('data-aviso-musica-faixa'); faixa.style.removeProperty('--aviso-musica-reserva'); faixa = null; }
      if (!novo) return;
      novo.setAttribute('data-aviso-musica-faixa', '');
      novo.style.setProperty('--aviso-musica-reserva', `${reservaDoAviso(altura)}px`);
      faixa = novo;
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
      // A tela mudou com o aviso ainda à vista: o espaço da tela de antes sai na hora, e o desta tela é pedido de novo.
      const tela = telaDeAgora();
      espaco.conferir(tela);
      espaco.reservar(quemDesce(indice, proximos, document.getElementById('conteudo-principal'), scrollY), reservaDoAviso(altura), tela);
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
      // O aviso sai (7 s, "Desligar" ou o balão do nó): a faixa do cabeçalho preso sai com ele, mas o espaço que ele abriu fica até a pessoa trocar de tela (o `espaco` não é solto aqui).
      marcarFaixa(null, 0);
      mudanca.disconnect();
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
      document.removeEventListener('animationend', posicionar, true);
      document.removeEventListener('transitionend', posicionar, true);
    };
  }, [visivel, caminho, espaco]);
  // Com o aviso fora de cena, o espaço que ele abriu fica até a pessoa trocar de tela (a marca `data-tela` do cabeçalho do app ou o endereço mudam): aí sai na hora, e a tela seguinte já vem sem o vão.
  useEffect(() => {
    if (visivel || !espaco.elemento()) return;
    const conferir = () => {
      espaco.conferir(telaDeAgora());
      if (!espaco.elemento()) mudanca.disconnect();
    };
    const mudanca = new MutationObserver(conferir);
    conferir();
    if (!espaco.elemento()) return;
    mudanca.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tela'] });
    window.addEventListener('popstate', conferir);
    return () => {
      mudanca.disconnect();
      window.removeEventListener('popstate', conferir);
    };
  }, [visivel, caminho, espaco]);
  return <div ref={aviso} className="aviso-app aviso-musica" role="status" aria-live="polite">
    {visivel && <p>{mensagens.som.musicaAviso}<button type="button" onFocus={() => manter(true)} onBlur={() => manter(false)}
      onClick={() => void tocaSons.definirFundo('mudo')}>{mensagens.som.desligarMusica}</button></p>}
  </div>;
}
