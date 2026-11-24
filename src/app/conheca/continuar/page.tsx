import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ehHostDaApresentacao, ORIGEM_APP_STUDOO } from '@/enderecos-publicos';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { temCookieDeSessao } from '../inicio';
import { ContinuarNoApp } from './continuar-no-app';
import './continuar.css';

export const dynamic = 'force-dynamic';

export default async function Continuar() {
  if (ehHostDaApresentacao((await headers()).get('host'))) redirect(ORIGEM_APP_STUDOO + '/conheca/continuar');
  const { visitanteAtivo } = await import('@/servidor/acesso/visitante');
  const cookie = (await cookies()).get(nomeCookieSessao());
  return <ContinuarNoApp ativo={visitanteAtivo()} comSessao={temCookieDeSessao(cookie?.value)} />;
}
