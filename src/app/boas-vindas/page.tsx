import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { usuarioDaSessao } from '@/servidor/acesso/sessao';
import { cadastroAtivo } from '@/servidor/acesso/cadastro';
import { configuracaoGoogle } from '@/servidor/acesso/google';
import { BoasVindas } from './tela';

export const dynamic = 'force-dynamic';

/** A apresentação é pública; uma sessão existente continua direto nos estudos. */
export default async function PaginaBoasVindas() {
  const token = (await cookies()).get(nomeCookieSessao())?.value;
  if (token && await usuarioDaSessao(token, 'WEB')) redirect('/');
  return <BoasVindas cadastroDisponivel={cadastroAtivo() || Boolean(configuracaoGoogle())} />;
}
