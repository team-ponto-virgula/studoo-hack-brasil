import { textos } from './textos';

/**
 * O cartão do QR (spec 18, 1.6): "Instale no celular", o código para `/baixar` (que manda cada aparelho ao lugar certo), a legenda e o
 * link pequeno do arquivo, para quem passa o arquivo por cabo. O código é SVG puro desenhado no servidor (qr.ts). É um grupo (não uma região com título): o cartão
 * aparece duas vezes (herói e S4), e duas regiões com o mesmo nome confundem a navegação por regiões do leitor de tela.
 */
export function CartaoQr({ svg, apk, tamanho, idBase, className = '' }: { svg: string; apk: string; tamanho: string | null; idBase: string; className?: string }) {
  return (
    <div className={`cn-qr ${className}`} role="group" aria-labelledby={`${idBase}-titulo`}>
      <p id={`${idBase}-titulo`} className="cn-qr__titulo">{textos.qr.titulo}</p>
      <span className="cn-qr__codigo" role="img" aria-label={textos.qr.alt} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="cn-qr__legenda">{textos.qr.legenda}</p>
      <a className="cn-qr__arquivo" href={apk}>{textos.qr.arquivo(tamanho)}</a>
    </div>
  );
}
