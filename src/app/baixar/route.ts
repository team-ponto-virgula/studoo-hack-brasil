import { detectarAparelho, ehIos } from '../conheca/aparelho';
import { linksDoSite } from '../conheca/links';

/*
 * O endereço do QR da página de apresentação (spec 18, 1.6): cada aparelho cai onde precisa, sem cache.
 *  - Android: o APK (STUDOO_APK_URL);
 *  - iPhone e iPad: o TestFlight (STUDOO_TESTFLIGHT_URL), e, sem ele, a página na seção do iPhone;
 *  - o resto: a página na seção de baixar.
 * Os links são lidos a cada pedido; o Location do que é da página é relativo, então nunca depende do host que o proxy encaminha.
 */
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const aparelho = detectarAparelho(request.headers.get('user-agent'));
  const { apk, testflight } = linksDoSite();
  const destino = aparelho === 'android' ? apk : ehIos(aparelho) ? (testflight ?? '/conheca#iphone') : '/conheca#baixar';
  return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store', Vary: 'User-Agent' } });
}
