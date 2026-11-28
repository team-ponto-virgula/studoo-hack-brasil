import { associacaoApple, respostaDeAssociacao } from '@/links-do-app';

/** Links universais do iPhone: com o app instalado, os links dos e-mails abrem o app (src/links-do-app.ts). */
export const dynamic = 'force-dynamic';

export function GET() {
  return respostaDeAssociacao(associacaoApple());
}
