import Link from 'next/link';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { TrilhaCompartilhada } from '@studoo/contratos';
import { FalhaApi } from '@/servidor/acesso/http';
import { compartilharAtivo, comunidadeAtiva, limitarPublico, trilhaCompartilhada } from '@/servidor/compartilhar/servico';
import { mensagens } from '../../../mensagens/pt-BR';
import { Stu } from '../../../ui';
import { AcoesDaPaginaPublica, PreviaTrilha } from '../../compartilhar';
import { VoltarDaPagina } from '../../comunidade';
import { PaginaPublica, baseDoSite, redeDaPagina, usuarioDaPagina } from '../../publico';

import { MenuPublicacao } from '../../seguranca-comunidade';

export const dynamic = 'force-dynamic';
const m = mensagens.compartilhar;

type Resultado =
  | { estado: 'ok'; trilha: TrilhaCompartilhada; logado: boolean }
  | { estado: 'inativo' | 'limite'; logado: boolean };

/**
 * A prévia do link, lida direto do serviço (sem chamar a API) e uma vez por abertura: a página e os metadados usam o
 * mesmo resultado (`cache` do React vale para o pedido inteiro), então o limite das rotas públicas conta uma vez só.
 */
const carregar = cache(async (codigo: string): Promise<Resultado | null> => {
  if (!compartilharAtivo()) return null;
  const usuarioId = await usuarioDaPagina();
  try {
    await limitarPublico(await redeDaPagina());
  } catch {
    return { estado: 'limite', logado: Boolean(usuarioId) };
  }
  try {
    return { estado: 'ok', trilha: await trilhaCompartilhada(codigo, usuarioId), logado: Boolean(usuarioId) };
  } catch (erro) {
    if (erro instanceof FalhaApi && erro.codigo === 'link_inativo') return { estado: 'inativo', logado: Boolean(usuarioId) };
    throw erro;
  }
});

type Props = { params: Promise<{ codigo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resultado = await carregar((await params).codigo);
  const base: Metadata = { robots: { index: false, follow: false }, metadataBase: baseDoSite() };
  if (resultado?.estado !== 'ok') return { ...base, title: `${m.inativo} · Studoo` };
  const { trilha } = resultado;
  const descricao = m.publicoDescricao(trilha.totalLicoes, trilha.dono.nome);
  return {
    ...base,
    title: `${trilha.titulo} · Studoo`,
    description: descricao,
    openGraph: { type: 'website', title: trilha.titulo, description: descricao, siteName: 'Studoo', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title: trilha.titulo, description: descricao },
  };
}

export default async function PaginaDoLink({ params }: Props) {
  const resultado = await carregar((await params).codigo);
  // Sem a flag e link encerrado ou inexistente: 404 (a tela do link encerrado está em not-found.tsx).
  if (!resultado || resultado.estado === 'inativo') notFound();
  if (resultado.estado !== 'ok') {
    return (
      <PaginaPublica>
        <section className="pagina-publica__vazio">
          <Stu expressao="stu-encorajador" tamanho={96} animado="uma-vez" />
          <h1>{mensagens.erros.limite_compartilhar}</h1>
          <Link className="botao botao--primario" href={resultado.logado ? '/' : '/login'}>{m.criarMinha}</Link>
        </section>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica>
      {resultado.logado && <VoltarDaPagina destino={comunidadeAtiva() ? '/explorar' : '/'} />}
      {resultado.trilha.situacao !== 'sua' && <div className="seguranca-publica">{resultado.logado
        ? <MenuPublicacao tipo="trilha" alvo={resultado.trilha.codigo} nome={resultado.trilha.dono.nome} titulo={resultado.trilha.titulo} logado />
        : <Link href={mensagens.seguranca.rotaDenunciaSemSessao('trilha', resultado.trilha.codigo)}>{mensagens.comunidade.denunciar}</Link>}</div>}
      <PreviaTrilha trilha={resultado.trilha} calor logado={resultado.logado} comunidade={comunidadeAtiva()} acoes={<AcoesDaPaginaPublica trilha={resultado.trilha} logado={resultado.logado} />} />
    </PaginaPublica>
  );
}
