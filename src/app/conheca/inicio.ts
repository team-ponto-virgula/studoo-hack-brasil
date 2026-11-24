/**
 * Quem tem sessão e quem não tem, decidido no servidor só pelo cookie (o mesmo formato que `lerCookieSessao` aceita): é a escolha do
 * `/` (a página de apresentação para quem não entrou, se a entrada estiver ligada; o app para quem entrou, visitante incluído) e a do "Entrar"
 * da `/conheca` (que vira "Abrir o Studoo"). O cookie não é conferido no banco aqui: com um cookie velho, o app abre e a entrada de sempre aparece.
 */
export function temCookieDeSessao(valor: string | undefined | null): boolean {
  return typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

export type InicioDoSite = 'app' | 'apresentacao' | 'login';

/**
 * A raiz "/": com sessão, o app. Sem sessão, a página de apresentação só com a entrada ligada (`STUDOO_ENTRADA_APRESENTACAO=1`, veja `entradaPelaApresentacao`); com ela desligada,
 * o /login, como era antes da página.
 */
export function escolherInicio(valorDoCookie: string | undefined | null, entradaPelaApresentacao: boolean): InicioDoSite {
  if (temCookieDeSessao(valorDoCookie)) return 'app';
  return entradaPelaApresentacao ? 'apresentacao' : 'login';
}
