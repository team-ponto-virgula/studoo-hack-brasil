import type { CodigoErro } from "@studoo/contratos";

export const mensagensApi: Record<CodigoErro, string> = {
  invalido: "Confira os dados e tente de novo.",
  nao_autenticado: "Entre para continuar.",
  nao_encontrado: "Este conteúdo não está disponível.",
  origem_invalida: "Esta solicitação não pôde ser confirmada.",
  falha: "Algo deu errado. Tente de novo.",
  objetivo_fora_do_piloto: "Neste piloto, descreva o que você quer estudar em SQL.",
  proposta_invalida: "Gere outra proposta para continuar.",
  avaliacao_invalida: "Envie a resposta novamente para continuar.",
  credenciais_invalidas: "E-mail ou senha inválidos.",
  limite_login: "E-mail ou senha inválidos.",
  ia_indisponivel: "A geração está indisponível. Tente de novo.",
  limite_geracoes: "Você gerou trilhas demais por agora. Tente de novo mais tarde.",
};
