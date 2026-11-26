import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { usuarioDaSessao } from '@/servidor/acesso/sessao';
import { Estudo } from '../estudo';

export const dynamic = 'force-dynamic';

/** Intenção de preparar o primeiro estudo; a elegibilidade e o checkpoint vêm da conta autenticada. */
export default async function Onboarding() {
  const token = (await cookies()).get(nomeCookieSessao())?.value;
  if (!token || !await usuarioDaSessao(token, 'WEB')) redirect('/login');
  return <Estudo iniciarOnboarding />;
}
