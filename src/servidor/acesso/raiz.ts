/**
 * Cabeçalho que SÓ o servidor (o proxy) escreve, para dizer à página de apresentação que ela está sendo servida em "/" (a raiz de quem não
 * entrou). O que vier de fora com este nome é descartado pelo proxy.
 */
export const CABECALHO_NA_RAIZ = "x-studoo-na-raiz";
