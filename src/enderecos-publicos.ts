export const ORIGEM_APRESENTACAO = 'https://hellostudoo.com.br';
export const ORIGEM_APP_STUDOO = 'https://app.hellostudoo.com.br';

export function ehHostDaApresentacao(host: string | null): boolean {
  const nome = host?.toLowerCase().replace(/:443$/, '');
  return nome === 'hellostudoo.com.br' || nome === 'www.hellostudoo.com.br';
}
