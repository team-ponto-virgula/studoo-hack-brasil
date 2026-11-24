import { mensagens as comuns } from '@studoo/contratos/experiencia';
export { textoDaFalta, textoParaRever } from '@studoo/contratos/experiencia';
import { codigoDaFalha } from './api-nativa';

// As chaves chegam junto com a correção web. A ramificação mobile também compila na base anterior ao contrato.
const contratoDasRodadas = comuns as typeof comuns & {
  ficar?: string;
  perfil: { entrarOuCriar?: string; visitanteAvisoTroca?: string };
  comunidade: {
    seguindoVisitanteTitulo?: string;
    seguindoVisitanteTexto?: string;
    seguirVisitanteAviso?: string;
    voltarComunidade?: string;
    buscaRotulo?: string;
    buscaPlaceholder?: string;
    buscaLimpar?: string;
    buscaVazio?: (termo: string) => string;
  };
  licao: { historia: { sincroniaVisitanteApp?: string } };
};
const comunidade = contratoDasRodadas.comunidade;

export const mensagens = {
  ...comuns,
  entrada: { ...comuns.login, texto: comuns.login.instrucoes },
  planos: { ...comuns.planos, progresso: comuns.planos.contagem },
  sessaoVisitante: {
    progresso: contratoDasRodadas.licao.historia.sincroniaVisitanteApp ??
      'Sessão de visitante · seu progresso fica por até 24 h a partir da entrada neste aparelho',
    sairTitulo: 'Sair desta sessão de visitante?',
    sairTexto: 'Ao sair, você perde o acesso às trilhas e ao progresso desta sessão.',
    ficar: contratoDasRodadas.ficar ?? 'Ficar',
    entrar: contratoDasRodadas.perfil.entrarOuCriar ?? 'Entrar ou criar conta',
    entrarTitulo: 'Trocar para uma conta?',
    entrarTexto: `Para entrar ou criar conta, você sai desta sessão de visitante. ${contratoDasRodadas.perfil.visitanteAvisoTroca ??
      'As trilhas e o progresso desta sessão de visitante não passam para a conta.'}`,
    seguir: comunidade.seguirVisitanteAviso ?? 'Para seguir este perfil, entre ou crie uma conta.',
    seguindoTitulo: comunidade.seguindoVisitanteTitulo ?? 'Para seguir pessoas, entre com uma conta',
    seguindoTexto: comunidade.seguindoVisitanteTexto ?? 'Entre com uma conta para acompanhar as trilhas de quem você segue.',
    voltarComunidade: comunidade.voltarComunidade ?? 'Voltar à Comunidade',
  },
  buscaExplorar: {
    campo: comunidade.buscaRotulo ?? 'Buscar trilhas no Explorar',
    placeholder: comunidade.buscaPlaceholder ?? 'Buscar por assunto, título ou pessoa',
    buscar: 'Buscar',
    limpar: comunidade.buscaLimpar ?? 'Limpar busca',
    resultados: 'Resultados da busca',
    vazia: comunidade.buscaVazio ?? ((termo: string) => `Nenhuma trilha encontrada para “${termo}”.`),
  },
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
