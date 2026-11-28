/**
 * O pedido que a pessoa estava escrevendo quando a sessão terminou, para voltar no campo depois de entrar de novo (como o
 * `sessionStorage` da web na rodada 4). Fica só na memória do app: some ao fechar o app e ao ser lido uma vez.
 */
let rascunhoDoPedido = '';

export function guardarRascunho(texto: string) {
  rascunhoDoPedido = texto.trim() ? texto : '';
}

export function tomarRascunho(): string {
  const texto = rascunhoDoPedido;
  rascunhoDoPedido = '';
  return texto;
}
