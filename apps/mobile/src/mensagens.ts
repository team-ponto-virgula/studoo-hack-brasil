import { mensagens as comuns } from '@studoo/contratos/experiencia';
import { codigoDaFalha } from './api-nativa';

export const mensagens = {
  ...comuns,
  entrada: { ...comuns.login, texto: comuns.login.instrucoes },
  planos: { ...comuns.planos, progresso: comuns.planos.contagem },
} as const;

export function mensagemDoCodigo(codigo: string) {
  return Object.hasOwn(mensagens.erros, codigo)
    ? mensagens.erros[codigo as keyof typeof mensagens.erros]
    : mensagens.erros.falha;
}
export function mensagemDeErro(erro: unknown) { return mensagemDoCodigo(codigoDaFalha(erro)); }
