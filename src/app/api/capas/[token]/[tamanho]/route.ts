import { rotaPublica } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { lerCapa } from "@/servidor/aprendizado/capa";
import { limitarLeituraFoto } from "@/servidor/compartilhar/foto";
import { exigirCompartilhar } from "@/servidor/compartilhar/servico";

/** A capa com foto pelo token (muda a cada troca: cache longo e imutável). Os mesmos cabeçalhos da foto do perfil. */
export function GET(request: Request, context: { params: Promise<{ token: string; tamanho: string }> }) {
  return rotaPublica(request, async () => {
    exigirCompartilhar();
    limitarLeituraFoto(enderecoRede(request));
    const { token, tamanho } = await context.params;
    const bytes = await lerCapa(token, tamanho);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
}
