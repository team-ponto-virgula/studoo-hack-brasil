import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { entradaPelaApresentacao } from '@/servidor/acesso/entrada-apresentacao';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { PaginaDeApresentacao } from './conheca/pagina';
import { escolherInicio } from './conheca/inicio';
import { metadadosDaApresentacao } from './conheca/metadados';
import { Estudo } from './estudo';

export const dynamic = 'force-dynamic';

/**
 * A raiz do site (spec 18): quem tem sessão vê o app (visitante incluído); quem não tem vê a página de apresentação, se a entrada estiver ligada (`STUDOO_ENTRADA_APRESENTACAO=1`), e senão vai
 * ao /login, como era antes da página (307 com Location relativo, sem montar URL). Quem decide é esta página, no servidor, só pelo cookie e pela variável, lidos a cada pedido: o app não
 * aparece nem pisca para quem chega sem entrar. (Não é uma reescrita nem um redirecionamento do proxy: a reescrita dependia da URL que o Next monta atrás de um proxy HTTPS e dava 500, e um
 * Location relativo vindo do proxy também dá 500 no Next.) O cookie não é conferido no banco aqui: com um cookie velho o app abre e a entrada de sempre aparece.
 */
const inicioDoSite = async () => escolherInicio((await cookies()).get(nomeCookieSessao())?.value, entradaPelaApresentacao());

export async function generateMetadata(): Promise<Metadata> {
  return (await inicioDoSite()) === 'apresentacao' ? metadadosDaApresentacao({ imagem: true }) : {};
}

export default async function Home() {
  const inicio = await inicioDoSite();
  if (inicio === 'login') redirect('/login');
  return inicio === 'app' ? <Estudo /> : <PaginaDeApresentacao naRaiz />;
}
