import { FORMATO_CODIGO } from '@studoo/contratos';
import { useLocalSearchParams } from 'expo-router';
import Inicio from '../index';

export default function TrilhaDireta() {
  const { codigo } = useLocalSearchParams();
  if (typeof codigo !== 'string' || !FORMATO_CODIGO.test(codigo)) return <Inicio />;
  return <Inicio key={codigo} destino={{ tipo: 'previaTrilha', codigo }} />;
}
