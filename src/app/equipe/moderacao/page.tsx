import { notFound } from 'next/navigation';
import { daEquipe } from '@/servidor/compartilhar/atendimento';
import { PaginaPublica, usuarioDaPagina } from '../../publico';
import { CaixaModeracao } from './caixa';
import '../../atendimento.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moderação · Studoo' };
export default async function Moderacao() {
  if (!(await daEquipe(await usuarioDaPagina()))) notFound();
  return <PaginaPublica><CaixaModeracao /></PaginaPublica>;
}
