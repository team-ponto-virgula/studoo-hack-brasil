import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { PaginaDeApresentacao } from './conheca/pagina';
import { escolherInicio } from './conheca/inicio';
import { metadadosDaApresentacao } from './conheca/metadados';
import { Estudo } from './estudo';

export const dynamic = 'force-dynamic';

/**
 * A raiz do site (spec 18): quem não tem sessão vê a página de apresentação; quem tem, o app (visitante incluído). Quem decide é esta página, no servidor, só pelo cookie:
 * o app não aparece nem pisca para quem chega sem entrar. (Não é um redirecionamento nem uma reescrita do proxy: uma reescrita dependia da URL que o Next monta atrás de um proxy
 * HTTPS e podia virar 500.) O cookie não é conferido no banco aqui: com um cookie velho o app abre e a entrada de sempre aparece.
 */
const inicioDoSite = async () => escolherInicio((await cookies()).get(nomeCookieSessao())?.value);

export async function generateMetadata(): Promise<Metadata> {
  return (await inicioDoSite()) === 'apresentacao' ? metadadosDaApresentacao({ imagem: true }) : {};
}

export default async function Home() {
  return (await inicioDoSite()) === 'app' ? <Estudo /> : <PaginaDeApresentacao naRaiz />;
}
