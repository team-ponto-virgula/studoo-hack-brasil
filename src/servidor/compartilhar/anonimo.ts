import { cookies } from "next/headers";

const nome = "studoo-relatos";
const formato = /^[0-9a-f-]{36}$/i;
export function protocolosAnonimos(valor?: string) {
  return (valor ?? "").split(".").filter(id => formato.test(id)).slice(-64);
}
export async function relatosDoNavegador() {
  try { return protocolosAnonimos((await cookies()).get(nome)?.value); }
  catch { return []; } // Serviços também podem ser chamados fora de uma requisição Next.
}
export function lembrarRelato(request: Request, resposta: Response, protocolo: string) {
  const valor = request.headers.get("cookie")?.split(/;\s*/).find(c => c.startsWith(nome+"="))?.slice(nome.length+1);
  const ids = [...protocolosAnonimos(valor), protocolo].slice(-64);
  resposta.headers.append("Set-Cookie", `${nome}=${ids.join(".")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.STUDOO_ORIGEM?.startsWith("https:") ? "; Secure" : ""}`);
}
