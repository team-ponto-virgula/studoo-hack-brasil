import { useLocalSearchParams } from 'expo-router';
import { acessoDosParametros } from '../src/codigo-do-link';
import Inicio from './index';

/** O link do e-mail de recuperação (/recuperar#codigo=…): abre "Recuperar acesso" no passo da nova senha, com o código. Com sessão no aparelho, o app abre normalmente. */
export default function RecuperarPeloLink() {
  const acesso = acessoDosParametros('recuperar', useLocalSearchParams());
  return <Inicio key={acesso.codigo ?? 'recuperar'} acesso={acesso} />;
}
