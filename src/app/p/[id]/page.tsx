import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { origemLegivel, type PerfilPublico } from '@studoo/contratos';
import { FalhaApi } from '@/servidor/acesso/http';
import { compartilharAtivo, limitarPublico, perfilPublico } from '@/servidor/compartilhar/servico';
import { mensagens } from '../../../mensagens/pt-BR';
import { Stu } from '../../../ui';
import { Avatar } from '../../compartilhar';
import { PaginaPublica, baseDoSite, redeDaPagina } from '../../publico';

export const dynamic = 'force-dynamic';
const p = mensagens.perfil;

/** O perfil público, uma leitura por abertura (página e metadados usam o mesmo resultado). */
const carregar = cache(async (id: string): Promise<PerfilPublico | 'inativo' | 'limite' | null> => {
  if (!compartilharAtivo()) return null;
  try {
    await limitarPublico(await redeDaPagina());
  } catch {
    return 'limite';
  }
  try {
    return await perfilPublico(id);
  } catch (erro) {
    if (erro instanceof FalhaApi && erro.codigo === 'nao_encontrado') return 'inativo';
    throw erro;
  }
});

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const perfil = await carregar((await params).id);
  const base: Metadata = { robots: { index: false, follow: false }, metadataBase: baseDoSite() };
  if (!perfil || typeof perfil === 'string') return { ...base, title: `${p.inativo} · Studoo` };
  const descricao = p.paginaDescricao(perfil.nome, perfil.trilhas.length);
  return {
    ...base,
    title: `${p.paginaTitulo(perfil.nome)} · Studoo`,
    description: descricao,
    openGraph: { type: 'profile', title: p.paginaTitulo(perfil.nome), description: descricao, siteName: 'Studoo', locale: 'pt_BR', images: [{ url: '/marca/icone-512.png', width: 512, height: 512, alt: 'Studoo' }] },
  };
}

export default async function PaginaDoPerfil({ params }: Props) {
  const perfil = await carregar((await params).id);
  if (perfil === null) notFound();
  if (typeof perfil === 'string') {
    return (
      <PaginaPublica>
        <section className="pagina-publica__vazio">
          <Stu />
          <h1>{perfil === 'limite' ? mensagens.erros.limite_compartilhar : p.inativo}</h1>
          {perfil === 'inativo' && <p className="folha-texto">{p.inativoTexto}</p>}
          <a className="botao botao--primario" href="/">{mensagens.compartilhar.criarMinha}</a>
        </section>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica>
      <div className="perfil-publico__cabeca">
        <Avatar nome={perfil.nome} cor={perfil.cor} grande />
        <h1>{p.paginaTitulo(perfil.nome)}</h1>
      </div>
      <ul className="perfil-publico__lista">
        {perfil.trilhas.map((trilha) => (
          <li key={trilha.codigo}>
            <a className="perfil-publico__trilha" href={`/t/${trilha.codigo}`} aria-label={p.abrirTrilha(trilha.titulo)}>
              <strong>{trilha.titulo}</strong>
              <span>{mensagens.compartilhar.totalLicoes(trilha.totalLicoes)} · {origemLegivel(trilha.origem)}</span>
            </a>
          </li>
        ))}
      </ul>
    </PaginaPublica>
  );
}
