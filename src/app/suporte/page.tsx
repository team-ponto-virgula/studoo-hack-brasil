import { FORMATO_CODIGO } from '@studoo/contratos';
import { FalhaApi } from '@/servidor/acesso/http';
import { compartilharAtivo, limitarPublico, perfilPublico, trilhaCompartilhada } from '@/servidor/compartilhar/servico';
import { mensagens } from '../../mensagens/pt-BR';
import { PaginaPublica, redeDaPagina, usuarioDaPagina } from '../publico';
import { FormularioSuporte } from './formulario';
import '../atendimento.css';

export const metadata = { title: 'Suporte · Studoo', robots: { index: false, follow: false } };

async function nomeDaPublicacao(tipo: 'perfil' | 'trilha', alvo: string) {
  if (!compartilharAtivo()) return;
  try {
    await limitarPublico(await redeDaPagina());
    const pessoa = await usuarioDaPagina();
    if (tipo === 'perfil') return (await perfilPublico(alvo, pessoa)).nome;
    const trilha = await trilhaCompartilhada(alvo, pessoa);
    return mensagens.comunidade.denuncia.alvoTrilha(trilha.titulo, trilha.dono.nome);
  } catch (erro) {
    if (erro instanceof FalhaApi && ['link_inativo', 'nao_encontrado', 'limite_compartilhar'].includes(erro.codigo)) return;
    throw erro;
  }
}

export default async function Suporte({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { alvoTipo, alvo } = await searchParams;
  if ((alvoTipo === 'perfil' || alvoTipo === 'trilha') && typeof alvo === 'string' && FORMATO_CODIGO.test(alvo)) {
    const nome = await nomeDaPublicacao(alvoTipo, alvo);
    return <PaginaPublica><FormularioSuporte tipo={alvoTipo} alvo={alvo} nomeAlvo={nome} /></PaginaPublica>;
  }
  return <PaginaPublica><FormularioSuporte /></PaginaPublica>;
}
