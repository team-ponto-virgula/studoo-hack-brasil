import { origemStudoo } from '@/servidor/acesso/origem';

/**
 * A origem que vai dentro do QR (`<origem>/baixar`): sempre https e nunca da máquina local. Atrás do proxy do Dokploy, o endereço
 * vem de STUDOO_ORIGEM (a configurada, que o login também usa); só sem ela, e só se o proxy disser que veio por https, vale o
 * cabeçalho de encaminhamento. Sem origem confiável, devolve null e a página não desenha o QR (os botões continuam).
 */
export function origemPublica({
  origem = origemStudoo(),
  protocolo,
  host,
}: {
  origem?: string | null;
  protocolo?: string | null;
  host?: string | null;
}): string | null {
  if (origem?.startsWith('https:')) return origem;
  const proto = protocolo?.split(',')[0]?.trim().toLowerCase();
  const destino = host?.split(',')[0]?.trim().toLowerCase();
  if (proto !== 'https' || !destino || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/.test(destino)) return null;
  const nome = destino.replace(/:\d+$/, '');
  if (nome === 'localhost' || nome.endsWith('.localhost') || nome.endsWith('.local') || nome.endsWith('.internal') || /^127\./.test(nome) || nome === '0.0.0.0') return null;
  return `https://${destino}`;
}
