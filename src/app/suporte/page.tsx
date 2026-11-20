import { FORMATO_CODIGO } from '@studoo/contratos';
import { PaginaPublica } from '../publico';
import { FormularioSuporte } from './formulario';
import '../atendimento.css';
export const metadata = { title: 'Suporte · Studoo' };
export default async function Suporte({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { alvoTipo, alvo } = await searchParams;
  const tipo = (alvoTipo === 'perfil' || alvoTipo === 'trilha') && typeof alvo === 'string' && FORMATO_CODIGO.test(alvo) ? alvoTipo : undefined;
  return <PaginaPublica><FormularioSuporte tipo={tipo} alvo={tipo ? String(alvo) : undefined} /></PaginaPublica>;
}
