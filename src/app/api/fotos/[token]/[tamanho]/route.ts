import { rotaPublica } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { lerFoto, limitarLeituraFoto } from "@/servidor/compartilhar/foto";
import { exigirCompartilhar } from "@/servidor/compartilhar/servico";

/**
 * A foto pública pelo token (muda a cada troca, então o cache pode ser longo e imutável). Fora de buscadores, sem
 * farejar tipo, e só como imagem (a política bloqueia qualquer outra leitura).
 */
export function GET(request: Request, context: { params: Promise<{ token: string; tamanho: string }> }) {
  return rotaPublica(request, async () => {
    exigirCompartilhar();
    await limitarLeituraFoto(enderecoRede(request));
    const { token, tamanho } = await context.params;
    const bytes = await lerFoto(token, tamanho);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-site",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  });
}
