import type { CodigoErro } from "@studoo/contratos";

export const mensagensApi: Record<CodigoErro, string> = {
  material_invalido: "Use imagem JPG/PNG/WebP, PDF, DOCX ou CSV de até 5 MB, respeitando os limites de páginas, texto e tabela.",
  material_ilegivel: "Não consegui ler este material. Use uma foto mais nítida ou um PDF com texto.",
  reforco_indisponivel: "Responda ao exercício para o Stu identificar onde ajudar.",
  limite_estudio: "Você fez muitos pedidos. Aguarde um pouco e tente novamente.",
  voz_indisponivel: "A transcrição está indisponível. Você pode escrever sua explicação.",
  google_indisponivel: "O login com Google está indisponível no momento.",
  google_invalido: "Não foi possível confirmar o login com Google. Tente novamente.",
  google_conta_existente: "Este e-mail já tem uma conta. Entre com sua senha ou recupere o acesso.",
  recuperacao_indisponivel: "A recuperação de senha está indisponível no momento.",
  codigo_invalido: "Código inválido ou expirado. Confira o código ou solicite outro.",
  limite_recuperacao: "Aguarde alguns minutos antes de tentar novamente.",

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
