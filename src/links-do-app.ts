import { CAMINHOS_DOS_EMAILS } from '@studoo/contratos/autenticacao';

/*
 * O site prova ao iPhone e ao Android que o app do Studoo pode abrir os links dele: links universais
 * (/.well-known/apple-app-site-association) e App Links (/.well-known/assetlinks.json). Com o app instalado, os
 * links dos e-mails abrem o app na tela certa; sem o app, abrem o site.
 *
 * Os valores precisam bater com apps/mobile/app.json (`ios.associatedDomains` e `android.intentFilters`) e com o
 * build do app; `tests/links-do-app.test.mjs` confere os dois lados.
 */
export const APP_NATIVO = {
  /** Team ID da Apple + bundle do app (apps/mobile/eas.json e app.json). */
  appleAppId: 'PYZ6U56AMV.com.studoo.mobile.dev',
  pacoteAndroid: 'com.studoo.mobile.dev',
  /**
   * SHA-256 do certificado que assina o APK do EAS (lido do APK publicado, em 28/11/2026). Se um dia o app for para a
   * Play Store com a assinatura do Google, a impressão digital de lá entra aqui também.
   */
  certificadosAndroid: ['08:41:99:0C:01:94:FF:2C:AB:6E:77:6F:C4:99:B9:EA:DA:6F:DA:58:C5:1F:67:70:89:BB:18:D2:E6:4B:E8:A9'],
} as const;

/** Só as telas dos e-mails abrem o app: entrar, criar conta e recuperar a senha. O resto do site continua no navegador. */
export const CAMINHOS_DO_APP = [CAMINHOS_DOS_EMAILS.entrar, CAMINHOS_DOS_EMAILS.cadastro, CAMINHOS_DOS_EMAILS.recuperar] as const;

/** O arquivo da Apple: os links universais desses caminhos e as senhas do site oferecidas no app (e as do app, no site). */
export function associacaoApple() {
  return {
    applinks: { details: [{ appIDs: [APP_NATIVO.appleAppId], components: CAMINHOS_DO_APP.map((caminho) => ({ '/': caminho })) }] },
    webcredentials: { apps: [APP_NATIVO.appleAppId] },
  };
}

/** O arquivo do Android: o app abre os links do domínio e compartilha as senhas salvas com o site. */
export function associacaoAndroid() {
  return [{
    relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
    target: { namespace: 'android_app', package_name: APP_NATIVO.pacoteAndroid, sha256_cert_fingerprints: [...APP_NATIVO.certificadosAndroid] },
  }];
}

/** Os dois arquivos vão como JSON, sem redirecionar (a Apple e o Google não seguem redirecionamento) e com cache curto. */
export function respostaDeAssociacao(corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  });
}
