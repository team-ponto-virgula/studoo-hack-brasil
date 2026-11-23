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

/** Uma captura nativa do app: WebP em 1x e 2x, com largura e altura declaradas (nada pula). */
export function CapturaDaTela({ captura, alt, prioridade = false, escondida = false, className = '' }: {
  captura: CapturaOtimizada;
  alt: string;
  /** A primeira do herói: carrega já e com prioridade. As outras só quando chegam perto da tela, e com prioridade baixa (não disputam a banda com a primeira, o texto e as fontes). */
  prioridade?: boolean;
  escondida?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`cn-captura ${className}`.trim()} src={captura.src1x} srcSet={`${captura.src1x} 1x, ${captura.src2x} 2x`} width={captura.largura} height={captura.altura}
      alt={alt} loading={prioridade ? 'eager' : 'lazy'} fetchPriority={prioridade ? 'high' : 'low'} decoding="async" draggable={false} hidden={escondida || undefined} />
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
          <img src="/marca/icone.svg" width={14} height={14} alt="" />
          {textos.s2.janelaAba}
        </span>
      </div>
      <div className="cn-janela__tela">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cn-captura" src={captura.src1x} srcSet={`${captura.src1x} 1x, ${captura.src2x} 2x`} width={captura.largura} height={captura.altura}
          alt={alt} loading="lazy" fetchPriority="low" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
