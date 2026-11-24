import { mensagens as comuns } from '@studoo/contratos/experiencia';
export { textoDaFalta, textoParaRever } from '@studoo/contratos/experiencia';
import { codigoDaFalha } from './api-nativa';

export const mensagens = {
  ...comuns,
  entrada: { ...comuns.login, texto: comuns.login.instrucoes },
  planos: { ...comuns.planos, progresso: comuns.planos.contagem },
  sessaoVisitante: {
    progresso: 'Seu progresso fica guardado por até 24 horas a partir da entrada, neste aparelho.',
    sairTitulo: 'Sair desta sessão de visitante?',
    sairTexto: 'Ao sair, você perde o acesso às trilhas e ao progresso desta sessão.',
    ficar: 'Ficar',
    entrar: 'Entrar ou criar conta',
    entrarTitulo: 'Trocar para uma conta?',
    entrarTexto: 'Para entrar ou criar conta, você sai desta sessão de visitante. As trilhas e o progresso dela não passam para a conta.',
    seguir: 'Entre com uma conta para seguir pessoas e ver as trilhas que publicam.',
    seguindoTitulo: 'Siga pessoas com uma conta',
    voltarComunidade: 'Voltar à Comunidade',
  },
  buscaExplorar: { campo: 'Buscar trilhas', placeholder: 'Título, autor ou tema', buscar: 'Buscar', limpar: 'Limpar busca', resultados: 'Resultados da busca', vazia: 'Nenhuma trilha encontrada' },
  /**
   * "Resolva comigo" (spec 15, seção 4): os textos da spec, aqui até o contrato trazer `resolvaComigo` em `experiencia`; quando
   * trouxer, estes saem e o app usa os do contrato, como a web.
   */
  resolvaComigo: {
    selo: 'Resolva comigo',
    passo: (n: number, total: number) => `Passo ${n} de ${total}`,
    proximo: 'Próximo passo',
    voltar: 'Voltar um passo',
    suaVez: 'Sua vez',
    isso: 'Isso!',
    tentarDeNovo: 'Tentar de novo',
    metodo: 'O método',
    agora: 'Agora é com você',
    verificar: comuns.licao.avaliar,
  },
} as const;

export function mensagemDoCodigo(codigo: string) {
  return Object.hasOwn(mensagens.erros, codigo)
    ? mensagens.erros[codigo as keyof typeof mensagens.erros]
    : mensagens.erros.falha;
}
export function mensagemDeErro(erro: unknown) { return mensagemDoCodigo(codigoDaFalha(erro)); }
