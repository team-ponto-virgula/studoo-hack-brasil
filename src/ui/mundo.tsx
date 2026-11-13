import type { CSSProperties, ReactNode } from 'react';
import { coresMundo, desenhosMundo, regiaoDoTrecho, type Forma, type NomeDesenho } from './mundo-desenhos';
import './mundo.css';

/*
 * Mundo da trilha na web: os desenhos de mundo-desenhos.ts em SVG. O app desenha os mesmos dados com View
 * (apps/mobile/src/mundo.tsx). Tudo aqui é decorativo e fica fora do leitor de tela.
 */

function FormaSvg({ forma }: { forma: Forma }) {
  const cor = coresMundo[forma.cor];
  switch (forma.forma) {
    case 'circulo':
      return <circle cx={forma.x} cy={forma.y} r={forma.r} fill={cor} />;
    case 'elipse':
      return <ellipse cx={forma.x} cy={forma.y} rx={forma.rx} ry={forma.ry} fill={cor} />;
    case 'retangulo': {
      const giro = forma.giro
        ? `rotate(${forma.giro} ${forma.x + forma.largura / 2} ${forma.y + forma.altura / 2})`
        : undefined;
      return <rect x={forma.x} y={forma.y} width={forma.largura} height={forma.altura} rx={forma.raio} fill={cor} transform={giro} />;
    }
    case 'triangulo': {
      const { x, y, largura, altura } = forma;
      const pontos = forma.invertido
        ? `${x},${y} ${x + largura},${y} ${x + largura / 2},${y + altura}`
        : `${x},${y + altura} ${x + largura / 2},${y} ${x + largura},${y + altura}`;
      return <polygon points={pontos} fill={cor} />;
    }
    case 'cupula': {
      const { x, y, largura, altura } = forma;
      const raio = largura / 2;
      return <path d={`M${x} ${y + altura}V${y + raio}A${raio} ${raio} 0 0 1 ${x + largura} ${y + raio}V${y + altura}Z`} fill={cor} />;
    }
  }
}

/** Um desenho do mundo. O tamanho vem do CSS (largura); a altura acompanha a proporção do desenho. */
export function Desenho({ nome, className = '', style }: { nome: NomeDesenho; className?: string; style?: CSSProperties }) {
  const desenho = desenhosMundo[nome];
  return (
    <svg className={`desenho ${className}`} viewBox={`0 0 ${desenho.largura} ${desenho.altura}`} width={desenho.largura}
      height={desenho.altura} aria-hidden="true" focusable="false" style={style}>
      {desenho.formas.map((forma, indice) => <FormaSvg key={indice} forma={forma} />)}
    </svg>
  );
}

/** Cores de uma região como variáveis CSS: o chão (`--chao`) e o relevo (`--relevo`). */
export function coresDaRegiao(trecho: number): CSSProperties {
  const regiao = regiaoDoTrecho(trecho);
  return { '--chao': coresMundo[regiao.chao], '--relevo': coresMundo[regiao.relevo] } as CSSProperties;
}

/**
 * Fronteira entre duas regiões, na metade do espaço entre o último nó de um trecho e o primeiro do seguinte: a borda
 * ondulada da região seguinte sobe sobre a anterior, com enfeites nas bordas. O centro fica livre para a estrada e o marco.
 */
export function Fronteira({ trechoSeguinte }: { trechoSeguinte: number }) {
  const regiao = regiaoDoTrecho(trechoSeguinte);
  const [primeiro, segundo, terceiro, quarto] = regiao.fronteira;
  const posicao = (x: number, tamanho: number) => ({ '--x': String(x), '--tam': `${tamanho}px` }) as CSSProperties;
  return (
    <span className="mundo-fronteira" style={coresDaRegiao(trechoSeguinte)} aria-hidden="true">
      <svg className="mundo-fronteira__onda" viewBox="0 0 400 48" preserveAspectRatio="none" focusable="false">
        <path d="M0 22C36 6 70 4 104 14S170 36 212 22 290 2 332 12 380 26 400 18V48H0Z" fill="var(--relevo)" />
        <path d="M0 32C40 16 76 14 110 24S176 44 218 30 296 10 338 20 384 34 400 28V48H0Z" fill="var(--chao)" />
      </svg>
      <span className="mundo-fronteira__resto" />
      <Desenho nome={primeiro} className="mundo-fronteira__enfeite" style={posicao(0.02, 46)} />
      <Desenho nome={segundo} className="mundo-fronteira__enfeite" style={posicao(0.15, 34)} />
      <Desenho nome={terceiro} className="mundo-fronteira__enfeite mundo-fronteira__enfeite--fim" style={posicao(0.15, 30)} />
      <Desenho nome={quarto} className="mundo-fronteira__enfeite mundo-fronteira__enfeite--fim" style={posicao(0.02, 44)} />
    </span>
  );
}

/**
 * Paisagem vista de lado, para as telas de entrada, boas-vindas e apresentação: céu, sol, nuvens, colinas e árvores.
 * `children` fica sobre a paisagem (o Stu, um caminho ou etiquetas de temas).
 */
export function Paisagem({ children, className = '', compacta = false }: { children?: ReactNode; className?: string; compacta?: boolean }) {
  return (
    <div className={`paisagem ${compacta ? 'paisagem--compacta' : ''} ${className}`}>
      <div className="paisagem__ceu" aria-hidden="true">
        <Desenho nome="sol" className="paisagem__sol" />
        <Desenho nome="nuvem" className="paisagem__nuvem paisagem__nuvem--1" />
        <Desenho nome="nuvem" className="paisagem__nuvem paisagem__nuvem--2" />
        <Desenho nome="nuvem" className="paisagem__nuvem paisagem__nuvem--3" />
        <Desenho nome="balao" className="paisagem__balao" />
      </div>
      <div className="paisagem__chao" aria-hidden="true">
        <span className="paisagem__colina paisagem__colina--fundo" />
        <span className="paisagem__colina paisagem__colina--meio" />
        <span className="paisagem__colina paisagem__colina--frente" />
        <Desenho nome="picos" className="paisagem__picos" />
        <Desenho nome="pinheiro" className="paisagem__enfeite paisagem__enfeite--pinheiro1" />
        <Desenho nome="pinheiro" className="paisagem__enfeite paisagem__enfeite--pinheiro2" />
        <Desenho nome="arvore" className="paisagem__enfeite paisagem__enfeite--arvore1" />
        <Desenho nome="arvore" className="paisagem__enfeite paisagem__enfeite--arvore2" />
        <Desenho nome="casa" className="paisagem__enfeite paisagem__enfeite--casa" />
        <Desenho nome="arbusto" className="paisagem__enfeite paisagem__enfeite--arbusto" />
        <Desenho nome="flores" className="paisagem__enfeite paisagem__enfeite--flores" />
      </div>
      {children && <div className="paisagem__conteudo">{children}</div>}
    </div>
  );
}
