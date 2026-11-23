import type { ReactNode } from 'react';
import { IconeAdicionarIos, IconeCompartilharIos, IconeConfirmarIos } from '../icones';
import { textos } from '../textos';

/** Os passos numerados (spec 18, S4 e folha 1.5): número num círculo de 32 px (#E9E7FF, número #1D4ED8) e o texto em 17/26. */
export function Passos({ itens, icones }: { itens: readonly string[]; icones?: readonly ReactNode[] }) {
  return (
    <ol className="cn-passos">
      {itens.map((texto, indice) => (
        <li key={texto} className="cn-passo">
          <span className="cn-passo__numero" aria-hidden="true">{indice + 1}</span>
          <span className="cn-passo__texto">{texto}</span>
          {icones?.[indice] && <span className="cn-passo__icone" aria-hidden="true">{icones[indice]}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Os três passos de "Adicionar à Tela de Início", cada um com o desenho do ícone do iOS em traço próprio. */
export function PassosDoIphone() {
  return <Passos itens={textos.folhaIphone.passos} icones={[<IconeCompartilharIos key="c" />, <IconeAdicionarIos key="a" />, <IconeConfirmarIos key="o" />]} />;
}
