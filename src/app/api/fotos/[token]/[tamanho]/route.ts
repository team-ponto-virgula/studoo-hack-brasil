import { rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { lerFoto, limitarLeituraFoto } from "@/servidor/compartilhar/foto";
import { exigirCompartilhar } from "@/servidor/compartilhar/servico";

/** Revalida a visibilidade antes de entregar os bytes, inclusive ao dono. */
export function GET(request: Request, context: { params: Promise<{ token: string; tamanho: string }> }) {
  return rotaPublicaComSessao(request, async quem => {
    exigirCompartilhar();
    limitarLeituraFoto(enderecoRede(request));
    const { token, tamanho } = await context.params;
    const bytes = await lerFoto(token, tamanho, quem);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        // Token imprevisível e foto pública: a prévia web do app, em outra origem, também carrega.
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
}
