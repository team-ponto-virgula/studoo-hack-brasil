import { responder, rotaPublica } from '@/servidor/acesso/http';
import { configuracaoGoogle } from '@/servidor/acesso/google';
import { visitanteAtivo } from '@/servidor/acesso/visitante';
import { recuperacaoDisponivel } from '@/servidor/email/recuperacao';
import { provedorIaAtivo } from '@/servidor/ia/gerador';
import { vozAoVivoAtiva, vozAoVivoVisitanteAtiva } from '@/servidor/ia/realtime';
import { transcricaoDisponivel } from '@/servidor/estudio/voz';
import { compartilharAtivo, comunidadeAtiva } from '@/servidor/compartilhar/servico';
export async function GET(request: Request) {
  return rotaPublica(request, async () => responder({
    google: !!configuracaoGoogle(),
    recuperacao: recuperacaoDisponivel(),
    ia: provedorIaAtivo(),
    visitante: visitanteAtivo(),
    vozAoVivo: vozAoVivoAtiva(),
    vozAoVivoVisitante: vozAoVivoVisitanteAtiva(),
    transcricao: transcricaoDisponivel(),
    compartilhar: compartilharAtivo(),
    comunidade: comunidadeAtiva(),
  }));
}
