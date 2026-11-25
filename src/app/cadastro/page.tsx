import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { configuracaoGoogle } from '@/servidor/acesso/google';
import { cadastroAtivo } from '@/servidor/acesso/cadastro';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { usuarioDaSessao } from '@/servidor/acesso/sessao';
import { Cadastro } from './cadastro';

export const dynamic = 'force-dynamic';

/** E-mail respeita a flag; Google continua podendo criar uma identidade nova pelo seu fluxo próprio. */
export default async function PaginaCadastro() {
  const token = (await cookies()).get(nomeCookieSessao())?.value;
  if (token && (await usuarioDaSessao(token, 'WEB'))) redirect('/');
  const emailDisponivel = cadastroAtivo();
  const googleDisponivel = Boolean(configuracaoGoogle());
  if (!emailDisponivel && !googleDisponivel) redirect('/login');
  return <Cadastro googleDisponivel={googleDisponivel} emailDisponivel={emailDisponivel} />;
}
