import { createElement, type ReactNode } from 'react';
import type { ElementoSvg } from './desenho-svg';

/* As primitivas do motor como elementos de SVG. Num arquivo à parte para o texto com fórmulas e o desenho da figura se usarem sem um importar o outro em círculo. */

const ETIQUETAS = { Line: 'line', Rect: 'rect', Circle: 'circle', Path: 'path' } as const;

/** As primitivas do motor como elementos de SVG; o tipo que esta web não conhece (contrato mais novo) é ignorado. */
export function montar(elementos: readonly (ElementoSvg | null)[]): ReactNode[] {
  return elementos.map((item, indice) => (item ? createElement(ETIQUETAS[item.elemento], { key: indice, ...item.props }) : null));
}
