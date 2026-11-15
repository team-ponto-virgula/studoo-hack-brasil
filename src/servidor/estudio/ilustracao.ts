import sharp from 'sharp';

/*
 * Ilustração da página 1 do material de demonstração (frações): uma barra dividida em 4 partes iguais, com 3 pintadas,
 * como no texto “Em 3/4…”. Só formas, sem texto (a legenda vem da lição), para não depender de fontes no servidor.
 * Gerada uma vez, em PNG, com o sharp; se falhar, o material segue sem imagem.
 */

const partes = Array.from({ length: 4 }, (_, indice) => {
  const x = 60 + indice * 130;
  const cheia = indice < 3;
  return `<rect x="${x}" y="110" width="120" height="140" rx="18" fill="${cheia ? '#8B5A2B' : '#FFFFFF'}" stroke="#5C3A1A" stroke-width="6"/>` +
    (cheia ? `<rect x="${x + 18}" y="128" width="84" height="22" rx="11" fill="#B07A45"/>` : '');
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" rx="28" fill="#FFF6E5"/>
  <rect x="44" y="94" width="552" height="172" rx="30" fill="#F2DFC3"/>
  ${partes}
  <circle cx="125" cy="300" r="10" fill="#8B5A2B"/><circle cx="255" cy="300" r="10" fill="#8B5A2B"/>
  <circle cx="385" cy="300" r="10" fill="#8B5A2B"/><circle cx="515" cy="300" r="10" fill="none" stroke="#5C3A1A" stroke-width="4"/>
  <path d="M60 64h520" stroke="#E0B97A" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 22"/>
</svg>`;

let pronta: Promise<string | null> | null = null;

/** Data URL PNG da ilustração, ou null se o sharp não conseguir desenhar. */
export function ilustracaoDaDemo(): Promise<string | null> {
  pronta ??= sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toBuffer()
    .then((png) => `data:image/png;base64,${png.toString('base64')}`)
    .catch(() => null);
  return pronta;
}
