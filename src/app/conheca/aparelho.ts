/*
 * Quem está vendo a página de apresentação (spec 18, 1.3). O servidor decide o primeiro desenho pelo agente do usuário (sem pedir
 * nada à pessoa e sem piscar), e o navegador só corrige o que o servidor não enxerga (iPad no modo "site para computador").
 * Na dúvida, vale o computador.
 */
export type Aparelho = 'android' | 'iphone' | 'ipad' | 'computador';

export function detectarAparelho(userAgent: string | null | undefined): Aparelho {
  const ua = userAgent ?? '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/iPhone|iPod/i.test(ua)) return 'iphone';
  return 'computador';
}

/** iPhone e iPad começam na aba da Apple; a instalação no iPad usa a Tela de Início. */
export const ehIos = (aparelho: Aparelho) => aparelho === 'iphone' || aparelho === 'ipad';

/**
 * O que só o navegador sabe: o iPadOS no modo "site para computador" se apresenta como Mac, mas tem tela de toque; as dicas de
 * cliente (`navigator.userAgentData`) confirmam o Android mesmo com o agente reduzido.
 */
export function refinarAparelho(
  inicial: Aparelho,
  { userAgent, plataforma, pontosDeToque }: { userAgent?: string | null; plataforma?: string | null; pontosDeToque?: number | null },
): Aparelho {
  if (inicial !== 'computador') return inicial;
  if (/^android$/i.test(plataforma ?? '')) return 'android';
  if (/Macintosh/.test(userAgent ?? '') && (pontosDeToque ?? 0) > 1) return 'ipad';
  return inicial;
}
