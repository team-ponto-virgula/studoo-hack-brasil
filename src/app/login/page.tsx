import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { configuracaoGoogle } from '@/servidor/acesso/google';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { usuarioDaSessao } from '@/servidor/acesso/sessao';
import { visitanteAtivo } from '@/servidor/acesso/visitante';
import { recuperacaoDisponivel } from '@/servidor/email/recuperacao';
import { Entrada } from './entrada';

export const dynamic = 'force-dynamic';

export default async function Login() {
  const loja = await cookies();
  const token = loja.get(nomeCookieSessao())?.value;
  if (token && (await usuarioDaSessao(token, 'WEB'))) {
    redirect('/');
  }

  return (
    <Entrada
      sessaoVerificada
      configInicial={{
        google: !!configuracaoGoogle(),
        recuperacao: recuperacaoDisponivel(),
        visitante: visitanteAtivo(),
      }}
    />
  );
}
