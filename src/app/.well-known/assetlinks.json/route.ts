import { associacaoAndroid, respostaDeAssociacao } from '@/links-do-app';

/** App Links do Android: com o app instalado, os links dos e-mails abrem o app (src/links-do-app.ts). */
export const dynamic = 'force-dynamic';

export function GET() {
  return respostaDeAssociacao(associacaoAndroid());
}
