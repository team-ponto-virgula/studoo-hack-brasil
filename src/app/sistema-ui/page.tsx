import { notFound } from 'next/navigation';
import { BancadaJornada } from './bancada';

export const metadata = { title: 'Studoo · Jornada Azul · componentes reais' };

/** Bancada de revisão local. Não é uma etapa do onboarding nem uma rota pública de produção. */
export default function PaginaSistemaUi() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <BancadaJornada />;
}
