import type { CSSProperties } from 'react';
import { CATALOGO_MASCOTE, type IdMascote } from '@studoo/contratos';

/**
 * O mascote oficial pelo id do catálogo e pela largura em px de CSS. Reserva o lugar antes de carregar (largura, altura e
 * `aspect-ratio` do recorte), escolhe a menor largura gerada que cobre a pedida e deixa o navegador pegar 1x, 2x ou 3x:
 * WebP, com PNG para quem não lê WebP. `decorativo`: texto alternativo vazio (quando o texto ao lado já diz tudo).
 */
export function Mascote({ id, largura, decorativo = false, prioridade = false, className, style }: {
  id: IdMascote;
  largura: number;
  decorativo?: boolean;
  /** Acima da dobra: carrega já, sem esperar a rolagem. */
  prioridade?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const item = CATALOGO_MASCOTE[id];
  const [w, h] = item.proporcao;
  const altura = Math.round((largura * h) / w);
  const larguras = [...new Set(item.arquivos.map((arquivo) => arquivo.largura))].sort((a, b) => a - b);
  const base = larguras.find((valor) => valor >= largura) ?? larguras[larguras.length - 1];
  const daBase = item.arquivos.filter((arquivo) => arquivo.largura === base).sort((a, b) => a.densidade - b.densidade);
  const conjunto = (formato: 'webp' | 'png') => daBase.map((arquivo) => `/mascote/${arquivo[formato]} ${arquivo.densidade}x`).join(', ');
  return (
    <picture className={className ? `mascote ${className}` : 'mascote'} data-mascote={id}>
      <source type="image/webp" srcSet={conjunto('webp')} />
      <img src={`/mascote/${daBase[0].png}`} srcSet={conjunto('png')} width={largura} height={altura} alt={decorativo ? '' : item.alt}
        loading={prioridade ? 'eager' : 'lazy'} decoding="async" draggable={false}
        style={{ display: 'block', width: largura, height: 'auto', aspectRatio: `${w} / ${h}`, ...style }} />
    </picture>
  );
}
