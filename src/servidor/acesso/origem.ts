export const duracaoSessao = 8 * 60 * 60;

export function origemStudoo(): string | null {
  const configurada = process.env.STUDOO_ORIGEM;
  try {
    const url = new URL(configurada ?? "");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (configurada !== url.origin || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function nomeCookieSessao() {
  return origemStudoo()?.startsWith("https:") ? "__Host-studoo-sessao" : "studoo-sessao";
}

export function cookieSessao(token: string, idadeMaxima = duracaoSessao) {
  const seguro = origemStudoo()?.startsWith("https:") ? "; Secure" : "";
  return `${nomeCookieSessao()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${idadeMaxima}${seguro}`;
}

export function lerCookieSessao(request: Request): string | null {
  const chave = `${nomeCookieSessao()}=`;
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim())
    .find((item) => item.startsWith(chave));
  const token = cookie?.slice(chave.length);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
