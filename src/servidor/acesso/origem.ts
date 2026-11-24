export const duracaoSessao = 8 * 60 * 60;
export const duracaoSessaoVisitante = 24 * 60 * 60;
export const ORIGEM_APP_STUDOO = "https://app.hellostudoo.com.br";

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

export function origensWebPermitidas(): readonly string[] {
  const configurada = origemStudoo();
  if (!configurada) return [];
  if (!configurada.startsWith("https:")) return [configurada];
  return configurada === ORIGEM_APP_STUDOO ? [configurada] : [configurada, ORIGEM_APP_STUDOO];
}

export function origemWebPermitida(origem: string | null): origem is string {
  return origem !== null && origensWebPermitidas().includes(origem);
}

function origemPorHost(proto: string, host: string | undefined): string | null {
  if (!host || /[\s/\\@#?]/.test(host) || (proto !== "https" && proto !== "http")) return null;
  try {
    const url = new URL(`${proto}://${host}`);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return origemWebPermitida(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

export function origemWebDaRequisicao(request: Request): string | null {
  const cabecalhoOrigem = request.headers.get("origin");
  if (origemWebPermitida(cabecalhoOrigem)) return cabecalhoOrigem;

  const url = new URL(request.url);
  if (process.env.STUDOO_PROXY_HTTPS === "1") {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
      || url.protocol.replace(/:$/, "").toLowerCase();
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
      || request.headers.get("host")?.trim()
      || url.host;
    return origemPorHost(proto, host);
  }

  const host = request.headers.get("host")?.trim() || url.host;
  return origemPorHost(url.protocol.replace(/:$/, "").toLowerCase(), host);
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
