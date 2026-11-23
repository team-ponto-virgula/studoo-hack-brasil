'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * O Studoo instalado na tela de início (PWA em `display: standalone`) abre em "/" e, sem sessão, sempre foi levado à entrada: a página de
 * apresentação é para quem chega pelo navegador. Aqui o app instalado segue direto para o login (o CSS já escondeu a página, sem piscar).
 * Só entra na página servida em "/" (a de /conheca não tem esta ilha).
 */
export function SaidaDoApp() {
  const roteador = useRouter();
  useEffect(() => {
    const instalado = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (instalado) roteador.replace('/login');
  }, [roteador]);
  return null;
}
