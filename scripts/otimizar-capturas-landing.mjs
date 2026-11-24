// Otimiza as capturas nativas do app para a página de apresentação (spec 18, seção 9; Mobile & QA, build 4).
// Uso: node scripts/otimizar-capturas-landing.mjs <pasta com os PNGs nativos> [configuração.json] [pasta com as capturas da web]
// SEM RECORTE E SEM DISTORÇÃO (regra do Lead e do Designer): a captura nativa entra inteira, com a barra de status e tudo, e COM A PROPORÇÃO QUE TEM: o script só reduz (a largura manda, a
// altura acompanha) e nunca estica, achata nem corta. Escreve, em public/landing/, AVIF em três larguras (320, 480 e 640 para o celular; 440, 640 e 880 para a janela da web), que é o que os
// navegadores de hoje baixam (cerca de 40% menor que o WebP na mesma qualidade visual), e WebP em 1x e 2x para quem não lê AVIF; todos com um trecho do hash no nome (o arquivo nunca muda sob
// o mesmo nome, então pode ficar em cache para sempre). O `sizes` que escolhe a largura certa de cada lugar está em src/app/conheca/celular.tsx. A proporção da tela do celular da página é a da
// plataforma da captura (iPhone ou Android); uma captura de outra proporção (mais de 1% de diferença) é recusada (um item com `proporcaoAceita` aceita um desvio maior, documentado na origem:
// a página então a encaixa inteira, com object-fit: contain, e sobra uma faixa fina de cada lado).
// Os ids do herói: `heroi-1`, `heroi-2` e `heroi-3` são o conjunto provisório (mistura plataformas); a rodada limpa do Mobile & QA entra como `heroi-N-iphone` e
// `heroi-N-android` (a página escolhe pela plataforma do aparelho: src/app/conheca/heroi.ts), e então o provisório pode sair daqui. O `momento-N` é um por momento do S2.
// Depois escreve src/app/conheca/imagens.gerado.ts com os endereços, a largura e a altura (1x) de cada uma.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entrada = process.argv[2];
const entradaWeb = process.argv[4];
if (!entrada || !existsSync(entrada)) { console.error('Uso: node scripts/otimizar-capturas-landing.mjs <pasta com os PNGs nativos> [configuração.json] [pasta com as capturas da web]'); process.exit(2); }
const configuracao = JSON.parse(readFileSync(process.argv[3] ?? join(raiz, 'scripts/capturas-landing.json'), 'utf8'));
const saida = join(raiz, 'public/landing');
mkdirSync(saida, { recursive: true });
const LIMITE_2X = 120 * 1024; // spec 18, seção 5: até 120 KB cada, em 2x

const geradas = {};
for (const item of configuracao.capturas) {
  // As capturas da web (a janela do navegador do momento 4) vêm de outra pasta: não são do aplicativo nativo.
  const pasta = item.plataforma === 'web' ? entradaWeb : entrada;
  if (!pasta || !existsSync(pasta)) { console.error(`${item.id}: falta a pasta das capturas ${item.plataforma === 'web' ? 'da web (4º argumento)' : 'nativas'}`); process.exit(2); }
  const origem = join(pasta, item.arquivo);
  if (!existsSync(origem)) { console.error(`falta: ${origem}`); process.exit(3); }
  const meta = await sharp(origem).metadata();
  const aspecto = configuracao.aspectos[item.plataforma];
  if (!aspecto) { console.error(`${item.id}: plataforma desconhecida (${item.plataforma})`); process.exit(6); }
  const razao = aspecto.largura / aspecto.altura;
  // Até 1% de diferença na proporção da tela da plataforma; um item com `proporcaoAceita` aceita um desvio maior (a captura mantém a proporção que tem e a página a encaixa inteira).
  if (Math.abs(meta.width / meta.height - razao) / razao > (item.proporcaoAceita ?? 0.01)) { console.error(`${item.id}: ${meta.width}x${meta.height} não tem a proporção da tela ${item.plataforma} (${aspecto.largura}x${aspecto.altura})`); process.exit(5); }
  const inteira = sharp(origem);
  // A proporção da própria captura (nada de esticar para a da plataforma): a largura manda e a altura acompanha.
  const proporcao = meta.height / meta.width;
  const alturaPara = (largura) => Math.round(largura * proporcao);
  const arquivos = {};
  const larguras = configuracao.larguras[item.plataforma === 'web' ? 'web' : 'celular'];
  for (const [densidade, largura] of Object.entries(larguras)) {
    const dados = await inteira.clone().resize({ width: largura, height: alturaPara(largura), fit: 'fill' }).webp({ quality: configuracao.qualidade, effort: 6 }).toBuffer();
    const hash = createHash('sha256').update(dados).digest('hex').slice(0, 8);
    const nome = `${item.id}-${densidade}.${hash}.webp`;
    writeFileSync(join(saida, nome), dados);
    arquivos[densidade] = { nome, bytes: dados.length };
  }
  if (arquivos['2x'].bytes > LIMITE_2X) { console.error(`${item.id}: 2x com ${Math.round(arquivos['2x'].bytes / 1024)} KB, acima de 120 KB`); process.exit(4); }
  const avif = [];
  for (const largura of configuracao.avif.larguras[item.plataforma === 'web' ? 'web' : 'celular']) {
    const dados = await inteira.clone().resize({ width: largura, height: alturaPara(largura), fit: 'fill' }).avif({ quality: configuracao.avif.qualidade, effort: 6 }).toBuffer();
    const hash = createHash('sha256').update(dados).digest('hex').slice(0, 8);
    const nome = `${item.id}-${largura}w.${hash}.avif`;
    writeFileSync(join(saida, nome), dados);
    avif.push({ src: `/landing/${nome}`, largura, bytes: dados.length });
  }
  const largura1x = larguras['1x'];
  geradas[item.id] = { plataforma: item.plataforma, provisoria: Boolean(item.provisoria), src1x: `/landing/${arquivos['1x'].nome}`, src2x: `/landing/${arquivos['2x'].nome}`, avif: avif.map(({ src, largura }) => ({ src, largura })), largura: largura1x, altura: alturaPara(largura1x), origem: item.origem };
  console.log(`${item.id.padEnd(16)} ${meta.width}x${meta.height} → WebP 1x ${arquivos['1x'].bytes} B, 2x ${arquivos['2x'].bytes} B | AVIF ${avif.map((a) => `${a.largura}w ${a.bytes} B`).join(', ')}`);
}

// Tira da pasta os WebP e AVIF de capturas antigas (os que a configuração não gera mais).
const vivos = new Set(Object.values(geradas).flatMap((g) => [g.src1x, g.src2x, ...g.avif.map((a) => a.src)].map((s) => s.split('/').pop())));
for (const arquivo of readdirSync(saida)) {
  if (/^(heroi|momento|janela)-[\w-]+\.[0-9a-f]{8}\.(webp|avif)$/.test(arquivo) && !vivos.has(arquivo) && !statSync(join(saida, arquivo)).isDirectory()) rmSync(join(saida, arquivo));
}

const linhas = Object.entries(geradas).map(([id, g]) => `  '${id}': { plataforma: '${g.plataforma}', provisoria: ${g.provisoria}, src1x: '${g.src1x}', src2x: '${g.src2x}', avif: ${JSON.stringify(g.avif).replace(/"(\w+)":/g, '$1:').replace(/"/g, "'")}, largura: ${g.largura}, altura: ${g.altura}, origem: ${JSON.stringify(g.origem)} },`);
writeFileSync(join(raiz, 'src/app/conheca/imagens.gerado.ts'), `// Escrito por scripts/otimizar-capturas-landing.mjs. Não editar à mão: rode o script de novo com as capturas nativas.
import type { CapturaOtimizada } from './imagens';

export const CAPTURAS = {
${linhas.join('\n')}
} as const satisfies Record<string, CapturaOtimizada>;

export type IdDaCaptura = keyof typeof CAPTURAS;
`);
console.log('escrito: src/app/conheca/imagens.gerado.ts');
