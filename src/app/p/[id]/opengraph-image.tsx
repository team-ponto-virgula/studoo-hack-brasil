import { compartilharAtivo, perfilPublico } from '@/servidor/compartilhar/servico';
import { TAMANHO_OG, dentroDoLimite, imagemDoPerfil, imagemGenerica } from '@/servidor/og/cartao';

import { usuarioDaPagina } from "@/app/publico";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = TAMANHO_OG;
export const contentType = 'image/png';
export const alt = 'Perfil no Studoo';

/** A imagem de prévia do perfil público: a cor, a foto, o nome, o resumo e o alcance. Indisponível: a genérica. */
export default async function Imagem({ params }: { params: Promise<{ id: string }> }) {
  if (!compartilharAtivo() || !(await dentroDoLimite())) return imagemGenerica();
  const { id } = await params;
  try {
    const perfil = await perfilPublico(id, await usuarioDaPagina());
    return imagemDoPerfil({ nome: perfil.nome, cor: perfil.cor, foto: perfil.foto, resumo: perfil.resumo, trilhas: perfil.alcance.trilhas, pessoas: perfil.alcance.pessoas, demo: Boolean(perfil.demo) });
  } catch {
    return imagemGenerica();
  }
}
