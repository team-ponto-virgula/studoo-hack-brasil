import { mensagens as comuns } from '@studoo/contratos/experiencia';
export { textoDaFalta, textoParaRever } from '@studoo/contratos/experiencia';
import { codigoDaFalha } from './api-nativa';

export const mensagens = {
  ...comuns,
  entrada: { ...comuns.login, texto: comuns.login.instrucoes },
  planos: { ...comuns.planos, progresso: comuns.planos.contagem },
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
