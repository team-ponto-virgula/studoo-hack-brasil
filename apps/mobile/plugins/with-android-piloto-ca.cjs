const { X509Certificate } = require('node:crypto');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { AndroidConfig, withDangerousMod } = require('expo/config-plugins');

module.exports = function withAndroidPilotoCa(config) {
  const ca = process.env.STUDOO_ANDROID_PILOTO_CA;
  if (!ca) return config;

  return withDangerousMod(config, ['android', async (mod) => {
    const debug = join(mod.modRequest.platformProjectRoot, 'app', 'src', 'debug');
    const xml = join(debug, 'res', 'xml');
    const raw = join(debug, 'res', 'raw');
    const certificado = new X509Certificate(await readFile(resolve(ca)));
    if (!certificado.ca) throw new Error('Configure o certificado público da CA local do piloto.');
    await Promise.all([mkdir(xml, { recursive: true }), mkdir(raw, { recursive: true })]);
    await writeFile(join(raw, 'studoo_piloto_ca.crt'), certificado.toString());
    await writeFile(join(xml, 'studoo_piloto_rede.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain>localhost</domain>
    <domain>127.0.0.1</domain>
    <trust-anchors><certificates src="@raw/studoo_piloto_ca" /></trust-anchors>
  </domain-config>
</network-security-config>
`);

    const manifestPath = join(debug, 'AndroidManifest.xml');
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(manifestPath);
    const application = manifest.manifest.application?.[0];
    if (!application) throw new Error('Manifesto Android debug sem application.');
    application.$ ??= {};
    application.$['android:networkSecurityConfig'] = '@xml/studoo_piloto_rede';
    await AndroidConfig.Manifest.writeAndroidManifestAsync(manifestPath, manifest);
    return mod;
  }]);
};
