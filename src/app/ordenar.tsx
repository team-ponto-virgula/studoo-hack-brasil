'use client';

/*
 * Ordenar em lista única na web (spec 08, revisão do dono de 19/11), igual ao app (apps/mobile/src/ordenar.tsx): todos os
 * itens numa lista, na ordem do servidor (que nunca é a resposta); a ordem da lista é a resposta. Tocar num cartão escolhe;
 * tocar noutro troca os dois; tocar de novo, ou fora da lista, desfaz. Arrastar: pela alça na hora; pelo cartão, com o mouse
 * depois de 4 px e no toque depois de segurar 180 ms (a rolagem da página continua livre). Enquanto o cartão anda, a lista
 * não muda de ordem no DOM (o ponteiro continua preso a ele): os outros abrem espaço por transform e, ao soltar, a ordem nova
 * entra de uma vez. Teclado: Enter ou Espaço escolhe; com um escolhido, as setas movem ele e Esc desfaz.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as TeclaReact, type PointerEvent as PonteiroReact } from 'react';
import type { Opcao } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Icone } from '../ui';
import { tocaSons } from './sons';
import { destinoDoArrasto, moverEntreLivres, trocarDeLugar } from './ordenar-regras';
import './ordenar.css';

const t = mensagens.licao.ordenar;
const VAO = 8;
const BORDA = 64;
const ESPERA_TOQUE_MS = 180;
const ARRASTO_MOUSE_PX = 4;

type Estado = 'normal' | 'escolhido' | 'certo' | 'errado';
type Arrasto = {
  id: string;
  inicio: string[];
  /** Topo (na página) e altura de cada cartão no começo do arrasto. */
  caixas: Record<string, { y: number; altura: number }>;
  pontoInicial: number;
  dy: number;
  rolado: number;
  destino: number;
  previa: string[];
};

const reduzido = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Ordenar({ itens, valor, inicial, mudar, desativado, certos, fixos }: {
  itens: Opcao[];
  valor: string;
  /** A ordem com que a tentativa começou: "Voltar à ordem inicial" volta a ela. */
  inicial: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  /** Depois de verificar: os ids na posição certa (verde); os outros ficam em âmbar. */
  certos?: string[];
  /** Na nova tentativa: os que já estavam certos ficam travados no lugar. */
  fixos?: string[];
}) {
  const ids = itens.map((item) => item.id);
  const lida = valor.split(',').filter((id) => ids.includes(id));
  const ordem = lida.length === ids.length && new Set(lida).size === ids.length ? lida : (inicial || ids.join(',')).split(',');
  const travados = new Set(certos ? [] : fixos ?? []);
  const total = ordem.length;
  const inativo = desativado || Boolean(certos);
  const textoDe = (id: string) => itens.find((item) => item.id === id)?.texto ?? '';
  const mudou = ordem.join(',') !== (inicial || ids.join(','));

  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [soltando, setSoltando] = useState<string | null>(null);
  const [brilhos, setBrilhos] = useState<Record<string, number>>({});
  const lista = useRef<HTMLOListElement>(null);
  const cartoes = useRef(new Map<string, HTMLLIElement>());
  const arrastoRef = useRef<Arrasto | null>(null);
  const gesto = useRef<{ id: string; x: number; y: number; tipo: string; armado: boolean; relogio: number; elemento: HTMLElement; ponteiro: number } | null>(null);
  const soltouEm = useRef(0);
  const flip = useRef<Map<string, number> | null>(null);
  const relogioDaBorda = useRef(0);
  const ultimoY = useRef(0);

  useEffect(() => { if (inativo) setEscolhido(null); }, [inativo]);
  const anunciar = (texto: string) => setAviso((atual) => (atual === texto ? `${texto} ` : texto));
  const brilhar = (...quais: string[]) => setBrilhos((atuais) => {
    const novos = { ...atuais };
    for (const id of quais) novos[id] = (novos[id] ?? 0) + 1;
    return novos;
  });

  /** A troca e o soltar deslizam (FLIP): guarda onde cada cartão estava antes da ordem nova entrar. */
  function guardarLugares() {
    if (reduzido()) return;
    flip.current = new Map([...cartoes.current].map(([id, elemento]) => [id, elemento.getBoundingClientRect().top]));
  }
  useLayoutEffect(() => {
    const antes = flip.current;
    if (!antes) return;
    flip.current = null;
    for (const [id, elemento] of cartoes.current) {
      const delta = (antes.get(id) ?? 0) - elemento.getBoundingClientRect().top;
      if (!delta) continue;
      elemento.style.transition = 'none';
      elemento.style.transform = `translateY(${delta}px)`;
      void elemento.offsetHeight;
      elemento.style.transition = 'transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.2)';
      elemento.style.transform = '';
      window.setTimeout(() => { elemento.style.transition = ''; }, 260);
    }
  });

  const aplicar = (nova: string[], animar = true) => { if (animar) guardarLugares(); mudar(nova.join(',')); };

  function tocar(id: string) {
    if (inativo || travados.has(id) || Date.now() - soltouEm.current < 300) return;
    if (escolhido === null) { setEscolhido(id); void tocaSons.tocarEfeito('toque_opcao'); anunciar(t.avisoEscolhido(textoDe(id))); return; }
    if (escolhido === id) { setEscolhido(null); return; }
    aplicar(trocarDeLugar(ordem, escolhido, id));
    void tocaSons.tocarEfeito('ordenar_soltar');
    brilhar(escolhido, id);
    anunciar(t.avisoTrocaram(textoDe(escolhido), textoDe(id)));
    setEscolhido(null);
  }

  /** Uma posição para cima ou para baixo entre os que se movem (setas com um escolhido). */
  function moverUmaPosicao(id: string, sentido: -1 | 1) {
    const livres = ordem.filter((outro) => !travados.has(outro));
    const indice = livres.indexOf(id);
    if (indice < 0 || indice + sentido < 0 || indice + sentido >= livres.length) return;
    const nova = moverEntreLivres(ordem, travados, id, indice + sentido);
    aplicar(nova);
    void tocaSons.tocarEfeito('ordenar_soltar');
    brilhar(id);
    anunciar(t.avisoPosicao(textoDe(id), nova.indexOf(id) + 1, total));
    window.requestAnimationFrame(() => cartoes.current.get(id)?.querySelector<HTMLButtonElement>('button')?.focus());
  }

  function teclaNoCartao(evento: TeclaReact<HTMLButtonElement>, id: string) {
    if (evento.key === 'Escape' && escolhido) { evento.preventDefault(); evento.stopPropagation(); setEscolhido(null); return; }
    if (escolhido === id && (evento.key === 'ArrowUp' || evento.key === 'ArrowDown')) {
      evento.preventDefault();
      moverUmaPosicao(id, evento.key === 'ArrowUp' ? -1 : 1);
    }
  }

  // Tocar fora da lista desfaz a escolha.
  useEffect(() => {
    if (!escolhido) return;
    const fora = (evento: PointerEvent) => { if (!lista.current?.contains(evento.target as Node)) setEscolhido(null); };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [escolhido]);

  // ——— Arrasto ———
  function comecarArrasto(id: string, y: number) {
    const caixas: Arrasto['caixas'] = {};
    for (const outro of ordem) {
      const r = cartoes.current.get(outro)?.getBoundingClientRect();
      if (r) caixas[outro] = { y: r.top + window.scrollY, altura: r.height };
    }
    const novo: Arrasto = { id, inicio: [...ordem], caixas, pontoInicial: y, dy: 0, rolado: 0,
      destino: ordem.filter((outro) => !travados.has(outro)).indexOf(id), previa: [...ordem] };
    arrastoRef.current = novo;
    setEscolhido(null);
    setArrasto(novo);
  }

  function seguir(y: number) {
    const atual = arrastoRef.current;
    if (!atual) return;
    ultimoY.current = y;
    atual.dy = y - atual.pontoInicial;
    const caixa = atual.caixas[atual.id];
    const centro = caixa.y + atual.dy + atual.rolado + caixa.altura / 2;
    const destino = destinoDoArrasto(atual.inicio, travados, atual.id, atual.caixas, centro);
    if (destino !== atual.destino) { atual.destino = destino; atual.previa = moverEntreLivres(atual.inicio, travados, atual.id, destino); }
    setArrasto({ ...atual });
    vigiarBorda();
  }

  /** Perto da borda de cima ou de baixo da tela (64 px), a página rola sozinha enquanto o ponteiro fica ali. */
  function vigiarBorda() {
    // As bordas contam a partir do alto da aula (que fica preso) e do rodapé com o Verificar, como as margens no app.
    const topo = document.querySelector('.aula-topo')?.getBoundingClientRect().bottom ?? 0;
    const pe = document.querySelector('.aula-rodape')?.getBoundingClientRect().top ?? window.innerHeight;
    const sentido = () => (ultimoY.current < Math.max(0, topo) + BORDA ? -1 : ultimoY.current > Math.min(window.innerHeight, pe) - BORDA ? 1 : 0);
    if (sentido() === 0) { window.clearInterval(relogioDaBorda.current); relogioDaBorda.current = 0; return; }
    if (relogioDaBorda.current) return;
    relogioDaBorda.current = window.setInterval(() => {
      const atual = arrastoRef.current;
      const para = sentido();
      if (!atual || para === 0) { window.clearInterval(relogioDaBorda.current); relogioDaBorda.current = 0; return; }
      const antes = window.scrollY;
      window.scrollBy(0, para * 8);
      atual.rolado += window.scrollY - antes;
      seguir(ultimoY.current);
    }, 16);
  }

  function soltar() {
    window.clearInterval(relogioDaBorda.current);
    relogioDaBorda.current = 0;
    const atual = arrastoRef.current;
    arrastoRef.current = null;
    if (!atual) return;
    soltouEm.current = Date.now();
    const final = moverEntreLivres(atual.inicio, travados, atual.id, atual.destino);
    const terminar = () => {
      setSoltando(null);
      setArrasto(null);
      if (final.join(',') === atual.inicio.join(',')) return;
      aplicar(final, false);
      void tocaSons.tocarEfeito('ordenar_soltar');
      if (reduzido()) brilhar(atual.id);
      anunciar(t.avisoPosicao(textoDe(atual.id), final.indexOf(atual.id) + 1, total));
    };
    if (reduzido()) { terminar(); return; }
    // O arrastado desliza até o lugar novo (200 ms, mola curta) e só então a ordem entra.
    setSoltando(atual.id);
    setArrasto({ ...atual, previa: final, dy: lugarNaPrevia(atual, final, atual.id) - atual.caixas[atual.id].y - atual.rolado });
    window.setTimeout(terminar, 200);
  }

  /** O topo de um cartão (na página) numa ordem de prévia, pelas alturas do começo do arrasto. */
  function lugarNaPrevia(atual: Arrasto, previa: string[], id: string) {
    let y = Math.min(...atual.inicio.map((outro) => atual.caixas[outro]?.y ?? 0));
    for (const outro of previa) {
      if (outro === id) break;
      y += (atual.caixas[outro]?.altura ?? 0) + VAO;
    }
    return y;
  }

  // O toque não rola a página depois que o arrasto começou (o ouvinte precisa ser não passivo).
  useEffect(() => {
    if (!arrasto) return;
    const travar = (evento: TouchEvent) => { if (arrastoRef.current) evento.preventDefault(); };
    document.addEventListener('touchmove', travar, { passive: false });
    return () => document.removeEventListener('touchmove', travar);
  }, [arrasto !== null]);

  function aoApertar(evento: PonteiroReact<HTMLElement>, id: string, pelaAlca: boolean) {
    if (inativo || travados.has(id) || total < 2 || evento.button > 0) return;
    const elemento = evento.currentTarget;
    const novo = { id, x: evento.clientX, y: evento.clientY, tipo: evento.pointerType, armado: pelaAlca, relogio: 0, elemento, ponteiro: evento.pointerId };
    gesto.current = novo;
    if (pelaAlca) {
      evento.preventDefault();
      elemento.setPointerCapture(evento.pointerId);
      comecarArrasto(id, evento.clientY);
    } else if (evento.pointerType === 'touch') {
      novo.relogio = window.setTimeout(() => {
        if (gesto.current !== novo) return;
        novo.armado = true;
        try { elemento.setPointerCapture(novo.ponteiro); } catch { /* o ponteiro já saiu */ }
        comecarArrasto(id, novo.y);
      }, ESPERA_TOQUE_MS);
    }
  }
  function aoMover(evento: PonteiroReact<HTMLElement>) {
    const atual = gesto.current;
    if (!atual) return;
    if (arrastoRef.current) { seguir(evento.clientY); return; }
    const andou = Math.hypot(evento.clientX - atual.x, evento.clientY - atual.y);
    if (atual.tipo === 'touch') {
      // Mexeu antes dos 180 ms: é rolagem, não arrasto.
      if (andou > 8) { window.clearTimeout(atual.relogio); gesto.current = null; }
      return;
    }
    if (andou >= ARRASTO_MOUSE_PX) {
      atual.elemento.setPointerCapture(atual.ponteiro);
      comecarArrasto(atual.id, atual.y);
      seguir(evento.clientY);
    }
  }
  function aoLargar() {
    const atual = gesto.current;
    gesto.current = null;
    if (atual) window.clearTimeout(atual.relogio);
    if (arrastoRef.current) soltar();
  }

  const estadoDe = (id: string): Estado => {
    if (certos) return certos.includes(id) ? 'certo' : 'errado';
    if (travados.has(id)) return 'certo';
    return escolhido === id ? 'escolhido' : 'normal';
  };

  /** Durante o arrasto: quanto cada cartão anda para abrir espaço (e o arrastado segue o ponteiro). */
  function deslocamento(id: string): number {
    if (!arrasto) return 0;
    if (id === arrasto.id) return arrasto.dy + arrasto.rolado;
    return lugarNaPrevia(arrasto, arrasto.previa, id) - (arrasto.caixas[id]?.y ?? 0);
  }
  const posicaoVisivel = (id: string) => (arrasto ? arrasto.previa.indexOf(id) : ordem.indexOf(id)) + 1;

  return (
    <div className="ordenar-lista-unica" data-arrastando={arrasto ? true : undefined}>
      <p className="como-responder" aria-live="polite">
        <span className="como-responder__icone" aria-hidden="true"><Pontos /></span>
        <span>{escolhido ? t.comoResponderEscolhido : t.comoResponder}</span>
      </p>
      <ol className="ordenar-cartoes" ref={lista}>
        {ordem.map((id) => {
          const estado = estadoDe(id);
          const travado = travados.has(id);
          const posicao = posicaoVisivel(id);
          const ehArrastado = arrasto?.id === id;
          const podeArrastar = !inativo && !travado && total > 1;
          return (
            <li key={id} ref={(elemento) => { if (elemento) cartoes.current.set(id, elemento); else cartoes.current.delete(id); }}
              className="ordenar-cartao" data-estado={estado} data-arrastado={ehArrastado || undefined} data-soltando={soltando === id || undefined}
              data-brilho={brilhos[id] ? brilhos[id] % 2 : undefined}
              style={arrasto ? { transform: `translateY(${deslocamento(id)}px)${ehArrastado && soltando !== id && !reduzido() ? ' scale(1.03)' : ''}` } : undefined}>
              <button type="button" className="ordenar-cartao__corpo" aria-pressed={estado === 'escolhido'}
                aria-label={travado ? t.travadoRotulo(textoDe(id), posicao) : t.cartaoRotulo(posicao, total, textoDe(id))}
                aria-disabled={inativo || travado || undefined}
                onClick={() => tocar(id)} onKeyDown={(evento) => teclaNoCartao(evento, id)}
                onPointerDown={(evento) => aoApertar(evento, id, false)} onPointerMove={aoMover} onPointerUp={aoLargar} onPointerCancel={aoLargar}
                data-arrastavel={podeArrastar || undefined}>
                <span className="ordenar-cartao__numero" aria-hidden="true">{posicao}</span>
                <span className="ordenar-cartao__texto">{textoDe(id)}</span>
                {estado === 'certo' ? <span className="ordenar-cartao__alca" aria-hidden="true"><Icone nome="check" /></span>
                  : estado === 'errado' ? <span className="ordenar-cartao__alca" aria-hidden="true"><Icone nome="fechar" /></span>
                    : (
                      <span className="ordenar-cartao__alca" aria-hidden="true" data-pega={podeArrastar || undefined}
                        onPointerDown={(evento) => { evento.stopPropagation(); aoApertar(evento, id, true); }}
                        onPointerMove={aoMover} onPointerUp={aoLargar} onPointerCancel={aoLargar}>
                        <Pontos />
                      </span>
                    )}
              </button>
            </li>
          );
        })}
      </ol>
      {mudou && !inativo && (
        <button type="button" className="ordenar-voltar" onClick={() => { setEscolhido(null); void tocaSons.tocarEfeito('toque_opcao'); aplicar((inicial || ids.join(',')).split(',')); }}>
          {t.voltarOrdemInicial}
        </button>
      )}
      <p className="somente-leitor" role="status" aria-live="polite">{aviso}</p>
    </div>
  );
}

/** Seis pontos (a alça de arrastar), em 20 px. */
function Pontos() {
  return <span className="ordenar-pontos">{[0, 1, 2, 3, 4, 5].map((ponto) => <span key={ponto} />)}</span>;
}
