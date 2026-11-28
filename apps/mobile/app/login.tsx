import { useLocalSearchParams } from 'expo-router';
import { acessoDosParametros } from '../src/codigo-do-link';
import Inicio from './index';

/** O link "Entrar no Studoo" do e-mail de conta existente (/login): abre a entrada, com o e-mail que pediu o código, se o app lembrar dele. Com sessão no aparelho, o app abre normalmente. */
export default function EntrarPeloLink() {
  const acesso = acessoDosParametros('entrar', useLocalSearchParams());
  return <Inicio key={acesso.codigo ?? 'entrar'} acesso={acesso} />;
}
