import { responder, rotaPublica } from '@/servidor/acesso/http';
import { configuracaoGoogle } from '@/servidor/acesso/google';
import { visitanteAtivo } from '@/servidor/acesso/visitante';
import { recuperacaoDisponivel } from '@/servidor/email/recuperacao';
import { provedorIaAtivo } from '@/servidor/ia/gerador';
export async function GET(request: Request) {
  return rotaPublica(request, async () => responder({
    google: !!configuracaoGoogle(),
    recuperacao: recuperacaoDisponivel(),
    ia: provedorIaAtivo(),
    visitante: visitanteAtivo(),
  }));
}
