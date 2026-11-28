/*
 * Os dois endereços de instalação, lidos no servidor a CADA pedido (nunca no build): trocar a variável no Dokploy muda a página e o
 * /baixar sem publicar de novo.
 *  - STUDOO_APK_URL: o APK do Android. Padrão: o do build 4 (pacote com.studoo.mobile.dev, versão 0.1.0, Android 7 ou mais novo).
 *  - STUDOO_TESTFLIGHT_URL: substitui o convite público do TestFlight. Vazia ou inválida desativa o convite no iPhone.
 * Só endereço https, sem usuário nem senha: qualquer outra coisa (http, javascript:, texto solto) é ignorada.
 */
export const APK_PADRAO = 'https://expo.dev/artifacts/eas/nuOIVcSzxIwsigXnnj-UTesEK1NSxGAzoZjAfBoIrbw.apk';
export const TESTFLIGHT_PADRAO = 'https://testflight.apple.com/join/3zqhGSbD';

export interface LinksDoSite {
  apk: string;
  /** null = o TestFlight ainda não tem link público. */
  testflight: string | null;
}

function enderecoHttps(valor: string | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;
  try {
    const url = new URL(texto);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function linksDoSite(env: Record<string, string | undefined> = process.env): LinksDoSite {
  return {
    apk: enderecoHttps(env.STUDOO_APK_URL) ?? APK_PADRAO,
    testflight: enderecoHttps(env.STUDOO_TESTFLIGHT_URL ?? TESTFLIGHT_PADRAO),
  };
}

/*
 * O tamanho do APK do link padrão, medido uma vez (23/11/2026, cabeçalho `content-length` de HEAD no link padrão, que passa por
 * api.expo.dev e termina em wf-artifacts.eascdn.net; etag bc1e363f80a2e96ce6adc66ab7b76372): 114 957 083 bytes. Só vale para o link
 * padrão: se a variável trocar o link, o tamanho não é conhecido e a linha de apoio sai sem o número. Quando o build mudar, medir de
 * novo (`curl -sIL <link>`) e trocar este número.
 */
export const APK_PADRAO_BYTES = 114_957_083;

/** "114,9 MB": megabytes decimais (como o Android mostra), com uma casa, cortando em vez de arredondar para cima. */
export function tamanhoEmMb(bytes: number): string {
  const decimos = Math.floor(bytes / 100_000);
  return `${Math.floor(decimos / 10)},${decimos % 10} MB`;
}

/** O tamanho a mostrar para o link em uso: o medido, só para o link padrão; senão null. */
export function tamanhoDoApk(links: LinksDoSite): string | null {
  return links.apk === APK_PADRAO ? tamanhoEmMb(APK_PADRAO_BYTES) : null;
}
