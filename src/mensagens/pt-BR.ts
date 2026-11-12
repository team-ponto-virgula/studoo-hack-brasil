export const mensagens = {
  nome: 'Studoo',
  descricao: 'Planos de estudo com lições curtas e exercícios.',
  estudos: 'Área de estudo',
  carregando: 'Carregando',
  erros: {
    credenciais_invalidas: 'E-mail ou senha inválidos.',
    limite_login: 'E-mail ou senha inválidos.',
    nao_autenticado: 'Sua sessão terminou. Entre para continuar.',
    invalido: 'Confira os dados e tente novamente.',
    nao_encontrado: 'Este conteúdo não está disponível. Volte aos seus planos.',
    origem_invalida: 'Abra o Studoo pelo endereço do piloto para continuar.',
    objetivo_fora_do_piloto: 'Escreva um objetivo sobre SQL para gerar um plano neste piloto.',
    proposta_invalida: 'Esta prévia expirou. Volte ao objetivo e gere outra proposta.',
    avaliacao_invalida: 'A confirmação expirou. Envie a resposta novamente.',
    ia_indisponivel: 'A geração está indisponível agora. Tente novamente.',
    falha: 'Não foi possível continuar. Tente novamente.',
    rede: 'Confira a conexão e tente novamente.',
  },
} as const;

export function textoErro(codigo: string) {
  return Object.hasOwn(mensagens.erros, codigo)
    ? mensagens.erros[codigo as keyof typeof mensagens.erros]
    : mensagens.erros.falha;
}
