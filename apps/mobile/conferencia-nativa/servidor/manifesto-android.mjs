// Põe no manifesto de debug do Android (gerado pelo `expo prebuild`) os padrões do menu de desenvolvedor do cliente de
// desenvolvimento, só para a conferência nativa: apresentação vista, sem abrir sozinho e sem o botão flutuante.
//
// Por que existe: na primeira abertura, o menu abre sozinho com uma apresentação por cima do app, e depois um botão
// flutuante fica sobre as telas. O expo-dev-menu do Android lê os padrões desses três itens dos `meta-data` do manifesto
// (EXDevMenuIsOnboardingFinished, EXDevMenuShowsAtLaunch e EXDevMenuShowFloatingActionButton, em DevMenuPreferences.kt do
// SDK 58), e o app recém-instalado ainda não guardou outra escolha. No iPhone, o mesmo vai nas preferências do Expo Go.
//
// Uso: node manifesto-android.mjs <apps/mobile/android/app/src/debug/AndroidManifest.xml>
import { readFileSync, writeFileSync } from 'node:fs';

const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: node manifesto-android.mjs <AndroidManifest.xml de debug>');
  process.exit(2);
}

const PADROES = [
  ['EXDevMenuIsOnboardingFinished', 'true'],
  ['EXDevMenuShowsAtLaunch', 'false'],
  ['EXDevMenuShowFloatingActionButton', 'false'],
];

let xml = readFileSync(caminho, 'utf8');
if (PADROES.every(([nome]) => xml.includes(`"${nome}"`))) {
  console.log('O manifesto de debug já tem os padrões do menu de desenvolvedor.');
  process.exit(0);
}
const linhas = PADROES.map(([nome, valor]) => `    <meta-data android:name="${nome}" android:value="${valor}"/>`).join('\n');

// O prebuild gera o <application .../> de debug fechado em si mesmo; um manifesto mexido à mão pode tê-lo aberto.
const fechado = /<application\b([^>]*?)\s*\/>/;
const aberto = /<application\b[^>]*>/;
if (fechado.test(xml)) {
  xml = xml.replace(fechado, (_, atributos) => `<application${atributos}>\n${linhas}\n  </application>`);
} else if (aberto.test(xml)) {
  xml = xml.replace(aberto, (inicio) => `${inicio}\n${linhas}`);
} else {
  console.error(`O manifesto de debug não tem <application>: ${caminho}`);
  process.exit(1);
}
writeFileSync(caminho, xml);
console.log(`Padrões do menu de desenvolvedor no manifesto de debug: ${PADROES.map(([nome, valor]) => `${nome}=${valor}`).join(', ')}.`);
