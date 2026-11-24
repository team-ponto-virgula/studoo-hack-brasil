import Link from 'next/link';
import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { nomeCookieSessao, origemStudoo } from '@/servidor/acesso/origem';
import { usuarioDaSessao } from '@/servidor/acesso/sessao';
import { ehEmailVisitante, enderecoRede } from '@/servidor/acesso/visitante';
import { banco } from '@/servidor/banco/cliente';
import { Logo } from '../ui';
import './compartilhar.css';
import './perfil.css';

/** Moldura das páginas públicas (/t e /p): a marca no alto, que leva ao início, e uma coluna central. */
export function PaginaPublica({ children }: { children: ReactNode }) {
  return (
    <div className="pagina-publica">
      <header className="pagina-publica__topo"><Link href="/" aria-label="Studoo"><Logo decorativo /></Link></header>
      <main id="conteudo-principal" className="pagina-publica__corpo">{children}</main>
    </div>
  );
}

/** A sessão da web, se houver (as páginas públicas funcionam sem ela). */
export async function usuarioDaPagina(): Promise<string | null> {
  const token = (await cookies()).get(nomeCookieSessao())?.value;
  return token ? usuarioDaSessao(token, 'WEB') : null;
}

/** Sessão da página com indicação de visitante (evita consultar duas vezes onde precisa diferenciar visitante). */
export async function sessaoDaPagina(): Promise<{ usuarioId: string; visitante: boolean } | null> {
  const usuarioId = await usuarioDaPagina();
  if (!usuarioId) return null;
  const usuario = await banco.usuario.findUnique({ where: { id: usuarioId }, select: { email: true } });
  return { usuarioId, visitante: Boolean(usuario && ehEmailVisitante(usuario.email)) };
}

/** O endereço de rede da página, do mesmo jeito que nas rotas da API (para o limite das rotas públicas). */
export async function redeDaPagina(): Promise<string> {
  return enderecoRede(new Request('http://studoo.local/', { headers: await headers() }));
}

/** Base absoluta para o Open Graph (a imagem estática precisa de endereço completo). */
export function baseDoSite(): URL | undefined {
  const origem = origemStudoo();
  return origem ? new URL(origem) : undefined;
}
