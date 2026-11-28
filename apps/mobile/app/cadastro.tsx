import { useLocalSearchParams } from 'expo-router';
import { acessoDosParametros } from '../src/codigo-do-link';
import Inicio from './index';

/** O link do e-mail de cadastro (/cadastro#codigo=…): abre "Criar sua conta" no passo da senha, com o código. Com sessão no aparelho, o app abre normalmente. */
export default function CadastroPeloLink() {
  const acesso = acessoDosParametros('cadastro', useLocalSearchParams());
  return <Inicio key={acesso.codigo ?? 'cadastro'} acesso={acesso} />;
}
