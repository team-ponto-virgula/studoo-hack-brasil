import type { Metadata } from 'next';
import { compartilharAtivo, comunidadeAtiva } from '@/servidor/compartilhar/servico';
import { mensagens } from '../../../mensagens/pt-BR';
import { Stu } from '../../../ui';
import { PaginaPublica, usuarioDaPagina } from '../../publico';

const m = mensagens.compartilhar;

export const metadata: Metadata = { title: `${m.inativo} · Studoo`, robots: { index: false, follow: false } };

/**
 * Link encerrado ou inexistente: a mesma tela de antes, agora com HTTP 404. Sem a flag, a rota não existe e cai no 404
 * padrão do Next (nada da tela do compartilhar aparece).
 */
export default async function LinkInativo() {
  if (!compartilharAtivo()) {
    return <main className="pagina-publica__corpo"><h1>404</h1></main>;
  }
  const logado = Boolean(await usuarioDaPagina());
  return (
    <PaginaPublica>
      <section className="pagina-publica__vazio pagina-publica__vazio--centro">
        <Stu expressao="stu-surpreso" tamanho={120} animado="uma-vez" />
        <h1>{m.inativo}</h1>
        <p className="folha-texto">{m.inativoTexto}</p>
        <a className="botao botao--primario" href={logado ? '/' : '/login'}>{m.criarMinha}</a>
        {comunidadeAtiva() && <a className="botao botao--texto" href="/explorar">{m.verExplorar}</a>}
      </section>
    </PaginaPublica>
  );
}
