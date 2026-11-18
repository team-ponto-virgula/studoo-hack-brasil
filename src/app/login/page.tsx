import { configuracaoGoogle } from '@/servidor/acesso/google';
import { visitanteAtivo } from '@/servidor/acesso/visitante';
import { recuperacaoDisponivel } from '@/servidor/email/recuperacao';
import { Entrada } from './entrada';

export const dynamic = 'force-dynamic';

export default function Login() {
  return (
    <Entrada
      configInicial={{
        google: !!configuracaoGoogle(),
        recuperacao: recuperacaoDisponivel(),
        visitante: visitanteAtivo(),
      }}
    />
  );
}
