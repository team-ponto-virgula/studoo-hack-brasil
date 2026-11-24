import { Desenho } from '../../../ui/mundo';
import { textos } from '../textos';
import { BotaoVisitante } from './visitante';
import { IDEIAS_DO_S3, fichaDaIdeia } from '../ideias';

/**
 * As seis ideias da tela inicial (spec 18, S3 e seção 10): uma grade que quebra linha, com todas à vista. Tocar numa ficha começa a sessão de visitante já com aquela ideia no campo
 * (quem já tem sessão abre o app com a ideia, sem criar outra). Elas entram uma a uma, uma vez, quando a lista chega à tela (60 ms entre elas, 300 ms cada, subindo 8 px: o CSS faz,
 * só com movimento permitido); sem movimento, ou sem JavaScript, estão todas à vista desde o começo. Não há fileira em laço: nada se mexe sozinho, então a WCAG 2.2.2 não pede botão de pausa.
 */
export function Fichas({ visitanteAtivo, comSessao }: { visitanteAtivo: boolean; comSessao: boolean }) {
  return (
    <div className="cn-fichas">
      <ul className="cn-fichas__lista" aria-label={textos.s3.lista} data-revelar-itens>
        {IDEIAS_DO_S3.map((ideia) => (
          <li key={ideia} className="cn-ficha-item">
            <BotaoVisitante ativo={visitanteAtivo} comSessao={comSessao} variante="secundario" className="cn-ficha" ideia={ideia} rotulo={fichaDaIdeia(ideia).nome} icone={<span className="cn-ficha__icone"><Desenho nome={fichaDaIdeia(ideia).icone} /></span>} />
          </li>
        ))}
      </ul>
    </div>
  );
}
