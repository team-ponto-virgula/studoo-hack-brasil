import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cadastroAtivo } from '@/servidor/acesso/cadastro';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { usuarioDaSessao } from '@/servidor/acesso/sessao';
import { Cadastro } from './cadastro';

export const dynamic = 'force-dynamic';

/** Criar conta por e-mail. Desligado no servidor, volta para o login (o botão nem aparece lá). */
export default async function PaginaCadastro() {
  const token = (await cookies()).get(nomeCookieSessao())?.value;
  if (token && (await usuarioDaSessao(token, 'WEB'))) redirect('/');
  if (!cadastroAtivo()) redirect('/login');
  return <Cadastro />;
}
