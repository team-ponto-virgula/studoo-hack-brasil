import { responder, rotaPublica } from '@/servidor/acesso/http';
import { configuracaoGoogle } from '@/servidor/acesso/google';
import { recuperacaoDisponivel } from '@/servidor/email/recuperacao';
export async function GET(request: Request) {
  return rotaPublica(request, async () => responder({ google: !!configuracaoGoogle(), recuperacao: recuperacaoDisponivel() }));
}
