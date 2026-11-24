import { NextResponse, type NextRequest } from "next/server";
import { ehHostDaApresentacao, ORIGEM_APP_STUDOO } from "@/enderecos-publicos";
import { origemStudoo } from "@/servidor/acesso/origem";

export function proxy(request: NextRequest) {
  // Um link de login, recuperação ou trilha aberto no domínio da landing pertence ao app.
  const caminho = request.nextUrl.pathname;
  if (ehHostDaApresentacao(request.headers.get('host')) && /^\/(?:login|cadastro|recuperar|equipe|t|p|explorar)(?:\/|$)/.test(caminho)) {
    const destino = new URL(ORIGEM_APP_STUDOO);
    destino.pathname = caminho;
    destino.search = request.nextUrl.search;
    return NextResponse.redirect(destino);
  }
  // A raiz "/" não é mais redirecionada nem reescrita aqui: quem não tem sessão vê a página de apresentação e quem tem vê o app, e quem decide é a própria página (src/app/page.tsx),
  // pelo cookie, no servidor. Uma reescrita no proxy dependia da URL que o Next monta atrás de um proxy HTTPS (o Traefik do Dokploy manda X-Forwarded-Proto) e podia virar 500.

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const desenvolvimento = process.env.NODE_ENV === "development";
  const origem = origemStudoo();
  const websocket = desenvolvimento && origem ? ` ${origem.replace(/^http/, "ws")}` : "";
  const estilo = desenvolvimento ? "'unsafe-inline'" : `'nonce-${nonce}'`;
  const politica = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${estilo}`,
    // React usa atributos style para cores, posições e progresso. Em produção, tags style exigem nonce.
    "style-src-attr 'unsafe-inline'",
    `connect-src 'self'${websocket}`,
    "img-src 'self' data:",
    // O som do acorde é sintetizado no navegador e tocado de um Blob.
    "media-src 'self' blob:",
    "font-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", politica);
  const resposta = NextResponse.next({ request: { headers } });
  resposta.headers.set("Content-Security-Policy", politica);
  resposta.headers.set("Cache-Control", "no-store");
  resposta.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  resposta.headers.set("Referrer-Policy", "no-referrer");
  resposta.headers.set("X-Content-Type-Options", "nosniff");
  resposta.headers.set("X-Frame-Options", "DENY");
  // Páginas públicas do compartilhar (spec 09): links não listados, fora de buscadores.
  if (/^\/(?:t\/|p\/|explorar(?:\/|$))/.test(request.nextUrl.pathname)) resposta.headers.set("X-Robots-Tag", "noindex, nofollow");
  return resposta;
}

export const config = { matcher: ["/", "/login", "/cadastro", "/recuperar", "/privacidade", "/suporte", "/conheca", "/equipe/:path*", "/t/:codigo*", "/p/:id*", "/explorar"] };
