import { ErroStudoo } from '@studoo/contratos';
import { FalhaMobile } from './api-nativa';

export const mensagens = {
  marca: 'Studoo',
  voltar: 'Voltar',
  sair: 'Sair',
  carregando: 'Carregando…',
  tentar: 'Tentar novamente',
  planos: {
    titulo: 'Meus planos',
    novo: 'Novo plano',
    abrir: 'Abrir plano',
    progresso: (concluidas: number, total: number) => `${concluidas} de ${total} ${total === 1 ? 'lição concluída' : 'lições concluídas'}`,
    semProgresso: '—',
  },
  objetivo: {
    titulo: 'O que você quer aprender?',
    instrucao: 'Conte o que quer estudar e o que já sabe sobre o assunto.',
    campo: 'Seu objetivo de estudo',
    placeholder: 'Quero praticar filtros e junções em SQL…',
    exemplo: 'Já sei usar SELECT e quero praticar filtros e junções para uma prova de SQL.',
    usarExemplo: 'Usar exemplo de SQL',
    aviso: 'Prévia com dados de exemplo. Evite inserir dados pessoais.',
    gerar: 'Gerar prévia',
    gerando: 'Preparando a prévia…',
  },
  proposta: {
    tipo: 'Prévia de IA simulada',
    origem: 'Origem',
    fluxos: 'Fluxos de estudo',
    editar: 'Editar objetivo',
  },
  erros: {
    invalido: 'Escreva um objetivo de estudo com até mil caracteres.',
    objetivo_fora_do_piloto: 'Experimente um objetivo sobre SQL, como praticar filtros para uma prova.',
    proposta_invalida: 'Esta prévia expirou. Edite o objetivo e gere outra proposta.',
    avaliacao_invalida: 'A confirmação expirou. Envie a resposta novamente.',
    credenciais_invalidas: 'E-mail ou senha inválidos.',
    limite_login: 'E-mail ou senha inválidos.',
    nao_autenticado: 'Sua sessão terminou. Entre para continuar.',
    nao_encontrado: 'Este conteúdo não está disponível. Volte aos seus planos.',
    ia_indisponivel: 'A geração está indisponível agora. Tente novamente.',
    falha: 'Não foi possível gerar a prévia. Tente novamente.',
    conexao: 'Confira a conexão e tente novamente.',
    configuracao: 'O app precisa do endereço HTTPS do servidor do piloto.',
    armazenamento: 'Não foi possível acessar a sessão segura no aparelho. Tente novamente.',
  },
} as const;

export function mensagemDeErro(erro: unknown) {
  if (erro instanceof ErroStudoo || erro instanceof FalhaMobile) {
    const codigo = erro.codigo;
    if (Object.hasOwn(mensagens.erros, codigo)) return mensagens.erros[codigo as keyof typeof mensagens.erros];
  }
  return mensagens.erros.falha;
}
