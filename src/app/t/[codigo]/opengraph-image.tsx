import { banco } from '@/servidor/banco/cliente';
import { compartilharAtivo, trilhaCompartilhada } from '@/servidor/compartilhar/servico';
import { TAMANHO_OG, dentroDoLimite, imagemDaTrilha, imagemGenerica } from '@/servidor/og/cartao';
import { TEMAS, type Tema } from '@studoo/contratos';

import { usuarioDaPagina } from "@/app/publico";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = TAMANHO_OG;
export const contentType = 'image/png';
export const alt = 'Trilha no Studoo';

/** A imagem de prévia do link da trilha: capa do tema, título, quem fez e a marca. Encerrado ou limite: a genérica. */
export default async function Imagem({ params }: { params: Promise<{ codigo: string }> }) {
  if (!compartilharAtivo() || !(await dentroDoLimite())) return imagemGenerica();
  const { codigo } = await params;
  try {
    const trilha = await trilhaCompartilhada(codigo, await usuarioDaPagina());
    const link = await banco.linkTrilha.findUnique({ where: { codigo }, select: { tema: true, noExplorar: true } });
    const tema = link?.noExplorar && (TEMAS as readonly unknown[]).includes(link.tema) ? (link.tema as Tema) : null;
    return imagemDaTrilha({ codigo, titulo: trilha.titulo, tema, capa: trilha.capa ?? null, totalLicoes: trilha.totalLicoes, dono: trilha.dono });
  } catch {
    return imagemGenerica();
  }
}
