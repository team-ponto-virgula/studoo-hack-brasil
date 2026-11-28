import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { ehHostDaApresentacao, ORIGEM_APP_STUDOO } from '@/enderecos-publicos';
import { redirect } from 'next/navigation';
import { entradaPelaApresentacao } from '@/servidor/acesso/entrada-apresentacao';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { PaginaDeApresentacao } from './conheca/pagina';
import { escolherInicio } from './conheca/inicio';
import { metadadosDaApresentacao } from './conheca/metadados';
import { Estudo } from './estudo';

export const dynamic = 'force-dynamic';

async function inicioDoSite() {
  const host = (await headers()).get('host')?.toLowerCase().replace(/:443$/, '') ?? null;
  if (ehHostDaApresentacao(host)) return 'apresentacao';
  const mostrarApresentacao = `https://${host}` !== ORIGEM_APP_STUDOO && entradaPelaApresentacao();
  return escolherInicio((await cookies()).get(nomeCookieSessao())?.value, mostrarApresentacao);
}

export async function generateMetadata(): Promise<Metadata> {
  if ((await inicioDoSite()) !== 'apresentacao') return {};
  return metadadosDaApresentacao({ imagem: true, dominioProprio: ehHostDaApresentacao((await headers()).get('host')) });
}

export default async function Home() {
  const inicio = await inicioDoSite();
  if (inicio === 'login') redirect('/login');
  return inicio === 'app' ? <Estudo /> : <PaginaDeApresentacao naRaiz />;
}
