import Link from 'next/link';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { origemLegivel, type PerfilPublico } from '@studoo/contratos';
import { FalhaApi } from '@/servidor/acesso/http';
import { compartilharAtivo, comunidadeAtiva, limitarPublico, perfilPublico } from '@/servidor/compartilhar/servico';
import { perfilPublicoComCartoes } from '@/servidor/compartilhar/comunidade';
import { mensagens } from '../../../mensagens/pt-BR';
import { Stu } from '../../../ui';
import { CabecalhoPublico } from '../../perfil';
import { CartoesPublicos, DenunciarPerfil, VoltarDaPagina } from '../../comunidade';
import { PaginaPublica, baseDoSite, redeDaPagina, usuarioDaPagina } from '../../publico';

export const dynamic = 'force-dynamic';
const p = mensagens.perfil;

/** O perfil público, uma leitura por abertura (página e metadados usam o mesmo resultado). */
const carregar = cache(async (id: string): Promise<{ perfil: PerfilPublico; logado: boolean } | 'inativo' | 'limite' | null> => {
  if (!compartilharAtivo()) return null;
  const usuarioId = await usuarioDaPagina();
  try {
    await limitarPublico(await redeDaPagina());
  } catch {
    return 'limite';
  }
  try {
    // Com a comunidade, as trilhas vêm como cartões (e, com sessão, a situação de cada uma).
    return { perfil: comunidadeAtiva() ? await perfilPublicoComCartoes(id, usuarioId) : await perfilPublico(id), logado: Boolean(usuarioId) };
  } catch (erro) {
    if (erro instanceof FalhaApi && erro.codigo === 'nao_encontrado') return 'inativo';
    throw erro;
  }
});

type Props = { params: Promise<{ id: string }> };


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resultado = await carregar((await params).id);
  const perfil = resultado && typeof resultado !== 'string' ? resultado.perfil : resultado;
  const base: Metadata = { robots: { index: false, follow: false }, metadataBase: baseDoSite() };
  if (!perfil || typeof perfil === 'string') return { ...base, title: `${p.inativo} · Studoo` };
  const descricao = perfil.resumo ?? p.paginaDescricao(perfil.nome, perfil.trilhas.length);
  return {
    ...base,
    title: `${p.paginaTitulo(perfil.nome)} · Studoo`,
    description: descricao,
    openGraph: { type: 'profile', title: p.paginaTitulo(perfil.nome), description: descricao, siteName: 'Studoo', locale: 'pt_BR' },
  };
}

export default async function PaginaDoPerfil({ params }: Props) {
  const id = (await params).id;
  const resultado = await carregar(id);
  const perfil = resultado && typeof resultado !== 'string' ? resultado.perfil : resultado;
  const logado = Boolean(resultado && typeof resultado !== 'string' && resultado.logado);
  if (perfil === null) notFound();
  if (typeof perfil === 'string') {
    return (
      <PaginaPublica>
        <section className="pagina-publica__vazio">
          <Stu expressao={perfil === 'limite' ? 'stu-encorajador' : 'stu-surpreso'} tamanho={96} animado="uma-vez" />
          <h1>{perfil === 'limite' ? mensagens.erros.limite_compartilhar : p.inativo}</h1>
          {perfil === 'inativo' && <p className="folha-texto">{p.inativoTexto}</p>}
          <Link className="botao botao--primario" href="/">{mensagens.compartilhar.criarMinha}</Link>
        </section>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica>
      {logado && <VoltarDaPagina destino={comunidadeAtiva() ? '/explorar' : '/'} />}
      <CabecalhoPublico perfil={perfil} perfilId={id} logado={logado} />
      {perfil.cartoes ? (
        <>
          <CartoesPublicos inicial={perfil.cartoes} logado={logado} titulo={p.paginaTitulo(perfil.nome)} />
          <DenunciarPerfil perfilId={id} logado={logado} nome={perfil.nome} />
        </>
      ) : <>
      <h2 className="perfil-publico__titulo">{p.paginaTitulo(perfil.nome)}</h2>
      <ul className="perfil-publico__lista">
        {perfil.trilhas.map((trilha) => (
          <li key={trilha.codigo}>
            <Link className="perfil-publico__trilha" href={`/t/${trilha.codigo}`} aria-label={p.abrirTrilha(trilha.titulo)}>
              <strong>{trilha.titulo}</strong>
              <span>{mensagens.compartilhar.totalLicoes(trilha.totalLicoes)} · {origemLegivel(trilha.origem)}</span>
            </Link>
          </li>
        ))}
      </ul>
      </>}
    </PaginaPublica>
  );
}
