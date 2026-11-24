import type { ReactNode } from 'react';
import { textos } from '../textos';

/** A escolha é nativa do navegador: toque, setas e leitura dos painéis funcionam antes da hidratação. */
export function Momentos({ children }: { children: ReactNode }) {
  return (
    <div className="cn-s2__momentos">
      <fieldset className="cn-escolhas">
        <legend className="somente-leitor">Escolha o que ver no app</legend>
        {textos.s2.momentos.map((momento, indice) => (
          <label className="cn-escolha" key={momento.escolha}>
            <input type="radio" name="cn-momento" value={indice + 1} defaultChecked={indice === 0} aria-controls={`cn-momento-${indice + 1}`} />
            <span>{momento.escolha}</span>
          </label>
        ))}
      </fieldset>
      <div className="cn-amostras">{children}</div>
    </div>
  );
}
