// Gera apps/mobile/src/stu-arquivos.ts: o mapa estático de require() das imagens do Stu (spec 13), porque o Metro não
// aceita caminho montado em tempo de execução. Lê o catálogo do contrato (CATALOGO_STU), que sai de `npm run mascote:gerar`.
// Uso (na raiz): npx tsx apps/mobile/scripts/stu-arquivos.mjs            (escreve o arquivo)
//                npx tsx apps/mobile/scripts/stu-arquivos.mjs --conferir (só confere; sai com 1 se estiver desatualizado)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATALOGO_STU } from '../../../packages/contratos/src/catalogo-mascote.ts';

const destino = fileURLToPath(new URL('../src/stu-arquivos.ts', import.meta.url));

/** O texto do arquivo gerado: uma chave `<nome>-<faixa>` por imagem parada (1x; o RN acha @2x e @3x) e por animada. */
export function gerarStuArquivos() {
  const parados = [];
  const animados = [];
  for (const item of Object.values(CATALOGO_STU)) {
    for (const arquivo of item.app.filter((a) => a.densidade === 1)) {
      parados.push(`  '${item.nome}-${arquivo.faixa.toLowerCase()}': require('../assets/marca/stu/${arquivo.arquivo}'),`);
    }
    const faixasAnimadas = new Map();
    for (const arquivo of item.animacao?.app ?? []) {
      // Só @2x e @3x: o require usa o nome sem a densidade, e o RN escolhe a que existe para a tela.
      faixasAnimadas.set(arquivo.faixa, arquivo.arquivo.replace(/@\d+x(?=\.webp$)/, ''));
    }
    for (const [faixa, arquivo] of faixasAnimadas) {
      animados.push(`  '${item.nome}-${faixa.toLowerCase()}': require('../assets/marca/stu/${arquivo}'),`);
    }
  }
  return [
    '// Gerado por apps/mobile/scripts/stu-arquivos.mjs a partir de CATALOGO_STU (packages/contratos). Não edite à mão:',
    '// tests/mascote-mobile.test.mjs confere que este mapa e o catálogo têm os mesmos arquivos.',
    '',
    '/** A imagem parada de cada nome e faixa (`stu-feliz-m`): PNG @1x, com @2x e @3x ao lado, que o React Native escolhe. O',
    ' * require de uma imagem devolve o número do recurso registrado pelo Metro. */',
    'export const PARADO_STU: Readonly<Record<string, number>> = {',
    ...parados,
    '};',
    '',
    '/** A animada de cada nome e faixa: WebP animado só em @2x e @3x (spec 13, emenda), para o expo-image. */',
    'export const ANIMADO_STU: Readonly<Record<string, number>> = {',
    ...animados,
    '};',
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const texto = gerarStuArquivos();
  if (process.argv.includes('--conferir')) {
    const atual = readFileSync(destino, 'utf8');
    if (atual !== texto) {
      console.error('apps/mobile/src/stu-arquivos.ts está desatualizado: rode npx tsx apps/mobile/scripts/stu-arquivos.mjs');
      process.exit(1);
    }
    console.log('stu-arquivos.ts confere com o catálogo');
  } else {
    writeFileSync(destino, texto);
    console.log(`escrito ${destino}`);
  }
}
