import { FORMATO_CODIGO } from '@studoo/contratos';
import { useLocalSearchParams } from 'expo-router';
import Inicio from '../index';

export default function PerfilDireto() {
  const { id } = useLocalSearchParams();
  if (typeof id !== 'string' || !FORMATO_CODIGO.test(id)) return <Inicio />;
  return <Inicio key={id} destino={{ tipo: 'perfilPublico', perfilId: id }} />;
}
