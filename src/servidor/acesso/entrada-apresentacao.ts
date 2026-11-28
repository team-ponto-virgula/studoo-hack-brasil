/**
 * A página de apresentação na raiz "/" (spec 18): desligada por padrão. Só com `STUDOO_ENTRADA_APRESENTACAO=1` (lida a cada pedido, sem rebuild, como `STUDOO_VISITANTE`) a raiz de quem
 * não tem sessão mostra a página; sem a variável, ou com qualquer outro valor, a raiz sem sessão leva ao /login, como era antes da página. Com sessão (visitante incluído) a raiz abre o app
 * nos dois casos; "/conheca" e "/baixar" ficam sempre no ar, para conferir a página antes de ligar a entrada.
 */
export function entradaPelaApresentacao(env: Record<string, string | undefined> = process.env): boolean {
  return env.STUDOO_ENTRADA_APRESENTACAO === "1";
}
