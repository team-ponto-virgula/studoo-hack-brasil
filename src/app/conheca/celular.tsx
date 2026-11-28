import type { ReactNode } from 'react';
import type { CapturaOtimizada, Plataforma } from './imagens';
import { textos } from './textos';

/**
 * A moldura própria do Studoo (spec 18, 1.4): retângulo de raio 44, borda de 10 px #0B1B5C e sombra suave. Segue a plataforma da captura: a
 * ilha no alto para o iPhone e um ponto de câmera de 10 px, centralizado, para o Android. Não desenha relógio (o que aparece é o da captura) e
 * não imita um aparelho de verdade nem de marca. O tamanho vem do CSS (`--celular`), e a tela mantém a proporção das capturas nativas.
 */
export function Celular({ children, className = '', rotulo, plataforma = 'iphone' }: { children: ReactNode; className?: string; rotulo?: string; plataforma?: Plataforma }) {
  return (
    <div className={`cn-celular ${className}`.trim()} data-plataforma={plataforma} role={rotulo ? 'group' : undefined} aria-label={rotulo}>
      <span className="cn-celular__ilha" aria-hidden="true" />
      <div className="cn-celular__tela">{children}</div>
    </div>
  );
}

/**
 * A largura, em px do CSS, em que a captura aparece em cada lugar (a TELA do celular, sem as bordas, por faixa de largura da janela): é o `sizes` que o navegador usa, junto com a
 * densidade da tela, para escolher entre as larguras do AVIF (320, 480 e 640). Em 390 px com tela de 2x, por exemplo, a tela de uma parada pede 480 e não 640.
 */
export const TAMANHOS = {
  momento: '(min-width: 1040px) 206px, 176px',
  celularDoComposto: '(min-width: 1040px) 170px, 132px',
  janela: '(min-width: 1040px) 400px, 300px',
} as const;

const srcSetDoAvif = (captura: CapturaOtimizada) => captura.avif.map((item) => `${item.src} ${item.largura}w`).join(', ');
const srcSetDoWebp = (captura: CapturaOtimizada) => `${captura.src1x} ${captura.largura}w, ${captura.src2x} ${captura.largura * 2}w`;
/** Um pixel transparente: o `src` das capturas que só são buscadas perto da tela (nada a baixar, e o navegador não mostra o texto alternativo no lugar). */
export const PIXEL_TRANSPARENTE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Uma captura nativa do app, com a proporção que ela tem: AVIF em três larguras (o que os navegadores de hoje baixam) e WebP de reserva, com largura e altura declaradas (nada pula). O `<img>`
 * leva tudo o que o navegador usa (prioridade, carregamento, descrição); o `<picture>` só escolhe o formato.
 */
export function CapturaDaTela({ captura, alt, prioridade = false, escondida = false, className = '', tamanhos = TAMANHOS.momento, sobDemanda = false }: {
  captura: CapturaOtimizada;
  alt: string;
  /** A primeira do herói: carrega já e com prioridade. As outras só quando chegam perto da tela, e com prioridade baixa (não disputam a banda com a primeira, o texto e as fontes). */
  prioridade?: boolean;
  escondida?: boolean;
  className?: string;
  /** Veja `TAMANHOS`. */
  tamanhos?: string;
  /**
   * Só é buscada quando a página já carregou e a captura chega perto da tela (a ilha `CarregarPerto` troca os `data-` pelos atributos de verdade): as capturas dos momentos do S2 ficam
   * abaixo da dobra, e o `loading="lazy"` do navegador as buscava logo (cerca de 1250 px de folga), junto com a primeira do herói, que é o LCP. Sem JavaScript, o <noscript> traz a de verdade.
   */
  sobDemanda?: boolean;
}) {
  const classe = `cn-captura ${className}`.trim();
  if (!sobDemanda) {
    return (
      <picture>
        <source type="image/avif" srcSet={srcSetDoAvif(captura)} sizes={tamanhos} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={classe} src={captura.src1x} srcSet={srcSetDoWebp(captura)} sizes={tamanhos} width={captura.largura} height={captura.altura}
          alt={alt} loading={prioridade ? 'eager' : 'lazy'} fetchPriority={prioridade ? 'high' : 'low'} decoding="async" draggable={false} hidden={escondida || undefined} />
      </picture>
    );
  }
  return (
    <>
      <picture data-carregar-perto="">
        <source type="image/avif" data-srcset={srcSetDoAvif(captura)} sizes={tamanhos} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={classe} src={PIXEL_TRANSPARENTE} data-src={captura.src1x} data-srcset={srcSetDoWebp(captura)} sizes={tamanhos} width={captura.largura} height={captura.altura}
          alt={alt} decoding="async" draggable={false} />
      </picture>
      <noscript>
        <picture>
          <source type="image/avif" srcSet={srcSetDoAvif(captura)} sizes={tamanhos} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={classe} src={captura.src1x} srcSet={srcSetDoWebp(captura)} sizes={tamanhos} width={captura.largura} height={captura.altura} alt={alt} draggable={false} />
        </picture>
      </noscript>
    </>
  );
}

/**
 * Uma janela de navegador desenhada pelo Studoo (barra com três pontos e a aba "Studoo", sem endereço inventado) com uma captura REAL do site dentro
 * (spec 18, seção 9, momento 4). A barra é só desenho (escondida do leitor de tela); quem descreve é o `alt` da captura.
 */
export function JanelaDoNavegador({ captura, alt, className = '' }: { captura: CapturaOtimizada; alt: string; className?: string }) {
  return (
    <div className={`cn-janela ${className}`.trim()}>
      <div className="cn-janela__barra" aria-hidden="true">
        <span className="cn-janela__pontos"><span /><span /><span /></span>
        <span className="cn-janela__aba">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/icone.svg" width={14} height={14} alt="" loading="lazy" decoding="async" />
          {textos.sincronia.janelaAba}
        </span>
      </div>
      <div className="cn-janela__tela">
        <CapturaDaTela captura={captura} alt={alt} tamanhos={TAMANHOS.janela} sobDemanda />
      </div>
    </div>
  );
}
