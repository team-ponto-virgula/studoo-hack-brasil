import { criarClienteStudoo } from "@studoo/contratos";

export const clienteStudooWeb = criarClienteStudoo((caminho, opcoes) =>
  fetch(caminho, { ...opcoes, credentials: "same-origin", cache: "no-store" }),
);
