import { NextResponse, type NextRequest } from "next/server";
import { lerCookieSessao, origemStudoo } from "@/servidor/acesso/origem";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/" && !lerCookieSessao(request)) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const desenvolvimento = process.env.NODE_ENV === "development";
  const origem = origemStudoo();
  const websocket = desenvolvimento && origem ? ` ${origem.replace(/^http/, "ws")}` : "";
  const estilo = desenvolvimento ? "'unsafe-inline'" : `'nonce-${nonce}'`;
  const politica = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${estilo}`,
    // React usa atributos style para cores, posições e progresso. O nonce continua exigido nas tags style.
    "style-src-attr 'unsafe-inline'",
    `connect-src 'self'${websocket}`,
    "img-src 'self' data:",
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
  resposta.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  resposta.headers.set("Referrer-Policy", "no-referrer");
  resposta.headers.set("X-Content-Type-Options", "nosniff");
  resposta.headers.set("X-Frame-Options", "DENY");
  return resposta;
}

export const config = { matcher: ["/", "/login", "/recuperar"] };
