import type { CSSProperties } from 'react';
import './festa.css';

/*
 * Confete das comemorações: um estouro curto em volta de um ponto (acerto, nó concluído) ou uma chuva que cai pela tela
 * (lição concluída). As peças têm posição fixa, calculada pelo índice, para o desenho ser o mesmo a cada vez.
 * É decorativo: fica fora do leitor de tela e some com movimento reduzido. O app tem o mesmo (apps/mobile/src/festa.tsx).
 */

export const coresFesta = ['#3858D6', '#FFD166', '#F38FB0', '#78C88B', '#86C1F4', '#EF8467'] as const;

function estiloDaPeca(indice: number, quantidade: number, chuva: boolean): CSSProperties {
  const cor = coresFesta[indice % coresFesta.length];
  const largura = 6 + (indice % 3) * 2;
  const altura = 9 + (indice % 4) * 2;
  if (chuva) {
    return {
      '--x': `${(indice * 53 + 7) % 100}%`,
      '--deriva': `${((indice * 29) % 80) - 40}px`,
      '--giro': `${200 + ((indice * 67) % 520)}deg`,
      '--atraso': `${(indice * 97) % 1100}ms`,
      '--duracao': `${2000 + ((indice * 131) % 1400)}ms`,
      '--cor': cor,
      '--l': `${largura}px`,
      '--a': `${altura}px`,
    } as CSSProperties;
  }
  const angulo = (indice / quantidade) * Math.PI * 2 + (indice % 3) * 0.35;
  const distancia = 46 + ((indice * 37) % 46);
  return {
    '--x': `${Math.round(Math.cos(angulo) * distancia)}px`,
    '--y': `${Math.round(Math.sin(angulo) * distancia)}px`,
    '--giro': `${(indice * 83) % 360}deg`,
    '--atraso': `${(indice % 4) * 30}ms`,
    '--cor': cor,
    '--l': `${largura}px`,
    '--a': `${altura}px`,
  } as CSSProperties;
}

export function Confete({ quantidade = 16, chuva = false, className = '' }: { quantidade?: number; chuva?: boolean; className?: string }) {
  return (
    <span className={`confete ${chuva ? 'confete--chuva' : ''} ${className}`} aria-hidden="true">
      {Array.from({ length: quantidade }, (_, indice) => <span key={indice} style={estiloDaPeca(indice, quantidade, chuva)} />)}
    </span>
  );
}
