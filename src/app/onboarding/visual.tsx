import type { CSSProperties, ReactNode } from 'react';
import { VISUAL_ONBOARDING } from '@studoo/contratos/onboarding-visual';
import './visual.css';

export const estiloVisualOnboarding = Object.fromEntries(
  Object.entries(VISUAL_ONBOARDING.cores).map(([nome, valor]) => [`--ob-${nome}`, valor]),
) as CSSProperties;

/** A arte aprovada do Stu ocupa a cena; as lentes retomam a marca sem criar outro mascote. */
export function CenaStuOnboarding({ nome, compacto = false, children }: {
  nome: 'stu-acolhida' | 'stu-feliz' | 'stu-celebrando'; compacto?: boolean; children?: ReactNode;
}) {
  const medidas = compacto ? VISUAL_ONBOARDING.vitoria : VISUAL_ONBOARDING.cena;
  return <div className="cena-onboarding" data-compacta={compacto || undefined} style={{
    ...estiloVisualOnboarding, '--cena-altura': `${medidas.altura}px`, '--cena-stu': `${medidas.stu}px`,
  } as CSSProperties}>
    <div className="cena-onboarding__heroi" aria-hidden="true">
      <div className="cena-onboarding__lentes"><span /><span /></div>
      <img src={`/marca/stu/${nome}-320.webp`} width={medidas.stu} height={medidas.stu} alt="" decoding="async" />
    </div>
    {children}
  </div>;
}
