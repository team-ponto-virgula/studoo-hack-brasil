'use client';

import { createElement, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementType, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { falarTextoComFormulas, partirTextoComFormulas, textoSemFormulas, type DesenhoEmLinha, type SegmentoDeTexto } from '@studoo/contratos';
import { elementoDaPrimitiva } from './desenho-svg';
import { itensDaFrase, pesoDoTexto, type ItemDaFrase, type PesoDaFormula } from './formula-em-linha';
import { montar } from './montar-svg';

/*
 * Fórmula dentro da frase (spec 15, seção 1, "Em linha"; contrato 3b): o texto é partido em trechos de texto e de fórmula, e cada fórmula é
 * desenhada pelo MOTOR (`desenharFormulaEmLinha`), num SVG do tamanho da letra em volta, como um bloco em linha dentro do parágrafo: o mesmo
 * desenho do app e do PNG. O bloco em linha se apoia pela base dele na linha de base das palavras (o navegador alinha pela borda de baixo de um
 * `inline-block` sem texto); por isso ele mede só a parte acima da linha de base (`linhaDeBase`) e o resto do desenho sai por baixo, sem a
 * linha crescer. Como no app, a cor é a do texto em volta (`currentColor`) e o peso da fórmula é o do texto (400 ou 700).
 *
 * O tamanho e o peso da letra e a largura do parágrafo são MEDIDOS no navegador (`getComputedStyle` e o tamanho do elemento: a letra grande
 * do sistema e o zoom entram sozinhos), e a frase se redesenha quando eles mudam. Antes da primeira medida, e no servidor, a frase vai em
 * texto linear (`x_G = (x_A + x_B) / 2`), sem `$` nem barra. Para o leitor de tela, o trecho inteiro tem o texto falado
 * (`falarTextoComFormulas`) e o desenho fica escondido dele.
 */

/** Teto da fórmula inteira em linha (pixels), antes de medir o parágrafo; acima do limite, ela vai em peças (o mesmo 260 do app). */
const LARGURA_MAXIMA = 260;

/** O que se mede do elemento da frase para desenhar a fórmula do tamanho dele. */
export type MedidasDoTexto = { tamanho: number; peso: PesoDaFormula; largura: number };

const useEfeitoDeLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const FormulaEmLinha = memo(function FormulaEmLinha({ desenho }: { desenho: DesenhoEmLinha }) {
  const elementos = useMemo(() => montar(desenho.primitivas.map((primitiva) => elementoDaPrimitiva(primitiva, 'currentColor'))), [desenho]);
  return (
    // A caixa em linha tem só a altura ACIMA da linha de base (a base dela fica na base das palavras) e o desenho desce por fora dela:
    // o índice não empurra a linha (spec 15, seção 9: "sem a linha crescer").
    <span className="formula-em-linha" data-testid="formula-em-linha" aria-hidden="true" style={{ width: desenho.largura, height: desenho.linhaDeBase }}>
      <svg width={desenho.largura} height={desenho.altura} viewBox={`0 0 ${desenho.largura} ${desenho.altura}`} focusable="false">{elementos}</svg>
    </span>
  );
});

const FECHA = /^[.,;:!?)\]}…»”%]+/u;
const ABRE = /[(\[{«“]$/u;

/**
 * Os itens na ordem, com a pontuação colada na fórmula: a pontuação de fechar que vem depois da fórmula e a de abrir que vem antes vão num
 * trecho sem quebra com ela (o navegador quebra a linha depois de qualquer elemento em linha, e um `)` sozinho no começo da linha de baixo
 * é feio). No app, o "word joiner" faz o mesmo.
 */
export function montarItens(itens: readonly ItemDaFrase[]): ReactNode[] {
  const saida: ReactNode[] = [];
  const textos = itens.map((item) => (item.tipo === 'texto' ? item.texto : ''));
  for (let indice = 0; indice < itens.length; indice++) {
    const item = itens[indice];
    if (item.tipo === 'texto') {
      if (textos[indice]) saida.push(textos[indice]);
      continue;
    }
    let antes = '';
    const anterior = saida[saida.length - 1];
    if (typeof anterior === 'string') {
      const abre = ABRE.exec(anterior);
      if (abre) { saida[saida.length - 1] = anterior.slice(0, -abre[0].length); antes = abre[0]; }
    }
    let depois = '';
    if (itens[indice + 1]?.tipo === 'texto') {
      const fecha = FECHA.exec(textos[indice + 1]);
      if (fecha) { depois = fecha[0]; textos[indice + 1] = textos[indice + 1].slice(fecha[0].length); }
    }
    const formula = <FormulaEmLinha key={indice} desenho={item.desenho} />;
    saida.push(antes || depois ? <span key={`j${indice}`} className="sem-quebra">{antes}{formula}{depois}</span> : formula);
  }
  return saida;
}

/** Os trechos já partidos de um texto (para quem precisa saber se há fórmula). */
export function useTrechos(texto: string): SegmentoDeTexto[] {
  // Só o que está marcado (`$…$`) é fórmula: quem marca os tokens soltos (`x_A`, `b^2`) é o servidor, na lição de matemática (3c).
  return useMemo(() => partirTextoComFormulas(texto ?? ''), [texto]);
}

/** O tamanho, o peso e a largura do elemento (ou do bloco em volta, se ele é em linha), na hora e a cada vez que mudam. */
function useMedidas(alvo: { current: HTMLElement | null }, ativo: boolean, forcadas?: MedidasDoTexto): MedidasDoTexto | null {
  const [medidas, setMedidas] = useState<MedidasDoTexto | null>(forcadas ?? null);
  useEfeitoDeLayout(() => {
    const no = alvo.current;
    if (forcadas || !ativo || !no) return;
    const medir = () => {
      const estilo = window.getComputedStyle(no);
      const tamanho = Number.parseFloat(estilo.fontSize);
      if (!(tamanho > 0)) return;
      const caixa = estilo.display === 'inline' && no.parentElement ? no.parentElement : no;
      const largura = caixa.getBoundingClientRect().width;
      const peso = pesoDoTexto(estilo.fontWeight);
      setMedidas((atual) => (atual && Math.abs(atual.tamanho - tamanho) < 0.01 && atual.peso === peso && Math.abs(atual.largura - largura) < 1 ? atual : { tamanho, peso, largura }));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(no);
    if (no.parentElement && no.parentElement !== no) observador.observe(no.parentElement);
    return () => observador.disconnect();
  }, [alvo, ativo, forcadas]);
  return forcadas ?? medidas;
}

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  texto: string;
  /** A etiqueta do elemento (`p`, `h1`, `span`…); sem ela, `span`. */
  como?: ElementType;
  ref?: Ref<HTMLElement>;
  /** Para os testes e para quem já sabe as medidas: desenha com elas, sem medir o elemento. */
  medidas?: MedidasDoTexto;
};

/**
 * Um texto com as fórmulas desenhadas no meio. Sem fórmula, é o elemento de sempre (com o texto linear do que veio em LaTeX solto: nunca
 * um `$` ou uma barra crua na tela). O elemento leva as classes e atributos de quem o usa, no lugar do `<p>`, do `<h1>` ou do `<span>` de antes.
 */
export function TextoComFormulas({ texto, como: Etiqueta = 'span', ref, medidas: forcadas, ...resto }: Props) {
  const trechos = useTrechos(texto);
  const temFormula = trechos.some((trecho) => trecho.tipo === 'formula');
  const alvo = useRef<HTMLElement | null>(null);
  const definir = useCallback((no: HTMLElement | null) => {
    alvo.current = no;
    if (typeof ref === 'function') ref(no);
    else if (ref) (ref as { current: HTMLElement | null }).current = no;
  }, [ref]);
  const medidas = useMedidas(alvo, temFormula, forcadas);
  const limite = medidas && medidas.largura > 0 ? Math.min(medidas.largura, LARGURA_MAXIMA) : LARGURA_MAXIMA;
  const itens = useMemo(() => (medidas && temFormula ? itensDaFrase(trechos, medidas.tamanho, 1, limite, medidas.peso) : null), [medidas, temFormula, trechos, limite]);
  if (!temFormula) return createElement(Etiqueta, { ref: definir, ...resto }, trechos.map((trecho) => (trecho.tipo === 'texto' ? trecho.texto : '')).join(''));
  // Antes da medida (e no servidor): o texto linear, que já é o texto inteiro, só que sem o desenho.
  if (!itens) return createElement(Etiqueta, { ref: definir, ...resto }, textoSemFormulas(texto));
  return createElement(Etiqueta, { ref: definir, 'data-formulas': '', ...resto },
    <span className="somente-leitor">{falarTextoComFormulas(texto)}</span>,
    <span aria-hidden="true">{montarItens(itens)}</span>);
}
