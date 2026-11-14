export { mensagens } from '@studoo/contratos/experiencia';
import { mensagens } from '@studoo/contratos/experiencia';

export function textoErro(codigo: string) {
  return Object.hasOwn(mensagens.erros, codigo)
    ? mensagens.erros[codigo as keyof typeof mensagens.erros]
    : mensagens.erros.falha;
}
