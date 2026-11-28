import type { CSSProperties, ReactNode } from 'react';
import { Desenho } from '../../ui/mundo';
import { coresMundo, regioesMundo, type NomeDesenho } from '../../ui/mundo-desenhos';
import { Celular, CapturaDaTela, TAMANHOS } from './celular';
import type { CapturaOtimizada } from './imagens';
import { STU_DA_PAGINA, type NomeDoStuDaPagina } from './stu.gerado';
import { textos } from './textos';

/*
 * O cenário da página: ela é uma trilha pelo mundo do Studoo, com as mesmas regiões, cores e desenhos do mapa do app
 * (src/ui/mundo-desenhos.ts). Tudo aqui é desenho de servidor, sem estado; o que se mexe com a rolagem fica nas ilhas.
 */

export type IdDaRegiao = (typeof regioesMundo)[number]['id'];

/** O chão e o relevo de uma região, como variáveis de CSS: os mesmos valores do mapa do app. */
export function coresDaRegiaoDaPagina(id: IdDaRegiao): CSSProperties {
  const regiao = regioesMundo.find((r) => r.id === id) ?? regioesMundo[0];
  return { '--chao': coresMundo[regiao.chao], '--relevo': coresMundo[regiao.relevo] } as CSSProperties;
}

/**
 * O Stu nos tamanhos da página (scripts/otimizar-stu-landing.mjs), maiores que os do kit. Sempre decorativo: o texto ao lado diz tudo.
 * Não é o `Stu` de src/ui/componentes.tsx (o do app, que pede expressão e tamanho do kit): por isso o outro nome.
 */
export function StuGrande({ nome, tamanhos, prioridade = false, className = '' }: {
  nome: NomeDoStuDaPagina;
  /** O `sizes` do lugar: a largura na tela, por faixa de janela. */
  tamanhos: string;
  /** O Stu do alto da página: carrega já e com prioridade (é a maior imagem da primeira dobra). */
  prioridade?: boolean;
  className?: string;
}) {
  const stu = STU_DA_PAGINA[nome];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`cn-stu ${className}`.trim()} src={stu.fontes[0].src} srcSet={stu.fontes.map((fonte) => `${fonte.src} ${fonte.largura}w`).join(', ')} sizes={tamanhos}
      width={stu.largura} height={stu.altura} alt="" decoding="async" draggable={false}
      loading={prioridade ? 'eager' : 'lazy'} fetchPriority={prioridade ? 'high' : undefined} />
  );
}

/** Um enfeite do mundo (árvore, pedra, nuvem…), posto no lugar por variáveis de CSS. */
export function Enfeite({ nome, onde, className = '' }: { nome: NomeDesenho; onde: Record<`--${string}`, string>; className?: string }) {
  return <Desenho nome={nome} className={`cn-enfeite ${className}`.trim()} style={onde as CSSProperties} />;
}

/** A borda ondulada da região, a mesma da fronteira do mapa do app: o relevo por trás e o chão na frente. */
export function Onda() {
  return (
    <svg className="cn-onda" viewBox="0 0 400 48" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 22C36 6 70 4 104 14S170 36 212 22 290 2 332 12 380 26 400 18V48H0Z" fill="var(--relevo)" />
      <path d="M0 32C40 16 76 14 110 24S176 44 218 30 296 10 338 20 384 34 400 28V48H0Z" fill="var(--chao)" />
    </svg>
  );
}

/** O que o Stu diz numa parada: um balão. O leitor de tela ouve antes quem está falando. */
export function Fala({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`cn-fala ${className}`.trim()}><span className="somente-leitor">{textos.falaDoStu}</span>{children}</p>;
}

/**
 * O marco de uma parada, como o nó do mapa do app: o trecho de estrada que chega, o nó com o ícone e a etiqueta com o número e o nome do lugar.
 * A ilha da trilha marca o estado (`data-estado`: feito, atual ou adiante) conforme a pessoa rola; sem ela, todos ficam como estão.
 */
export function Marco({ numero, total, lugar, icone, soLugar = false }: { numero: number; total: number; lugar: string; icone: ReactNode; /** A chegada não é uma parada numerada. */ soLugar?: boolean }) {
  return (
    <div className="cn-marco" data-marco={numero}>
      <span className="cn-marco__estrada" aria-hidden="true" />
      <span className="cn-marco__no" aria-hidden="true">
        <span className="cn-marco__icone">{icone}</span>
        <svg className="cn-marco__visto" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <p className="cn-marco__rotulo">{!soLugar && <><span className="cn-marco__numero">{textos.trilha.parada(numero, total)}</span>{' '}</>}<span className="cn-marco__lugar">{lugar}</span></p>
    </div>
  );
}

export interface DadosDaParada { id: string; /** A região do mapa do app que dá o chão e o relevo da parada. */ regiao: IdDaRegiao; lugar: string; titulo: string; linha: string }

/** Uma parada da página: a região (cores e onda), o marco, o título e a linha, e o conteúdo dela. */
export function Regiao({ parada, numero, total, icone, enfeites, children, className = '' }: {
  parada: DadosDaParada;
  numero: number;
  total: number;
  icone: ReactNode;
  enfeites?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={parada.id} className={`cn-regiao cn-regiao--${parada.regiao} ${className}`.trim()} data-parada={numero} aria-labelledby={`cn-titulo-${parada.id}`}
      style={coresDaRegiaoDaPagina(parada.regiao)}>
      <Onda />
      {enfeites && <div className="cn-regiao__enfeites" aria-hidden="true">{enfeites}</div>}
      <div className="cn-secao cn-regiao__miolo">
        <header className="cn-intro">
          <Marco numero={numero} total={total} lugar={parada.lugar} icone={icone} />
          <h2 id={`cn-titulo-${parada.id}`} className="cn-titulo">{parada.titulo}</h2>
          <p className="cn-linha">{parada.linha}</p>
        </header>
        {children}
      </div>
    </section>
  );
}

/** O link que abre a captura ampliada (a ilha `VisualizadorDeCapturas` cuida do clique; sem JavaScript, o link abre o arquivo). */
export function LinkDaCaptura({ captura, alt }: { captura: CapturaOtimizada; alt: string }) {
  const doSite = captura.plataforma === 'web';
  return (
    <a href={captura.src2x} aria-haspopup="dialog" data-ampliar={doSite ? textos.ampliar.tituloSite : textos.ampliar.tituloApp} data-descricao={alt}
      data-largura={2 * captura.largura} data-altura={2 * captura.altura}>{doSite ? textos.ampliar.site : textos.ampliar.app}</a>
  );
}

/** Uma tela de verdade do app ao lado da demonstração da parada, com a legenda e o link para ampliar. */
export function NoApp({ captura, alt, legenda, children, className = '' }: { captura: CapturaOtimizada; alt: string; legenda: string; children?: ReactNode; className?: string }) {
  if (captura.plataforma === 'web') throw new Error('NoApp só mostra capturas do aplicativo.');
  return (
    <figure className={`cn-noapp ${className}`.trim()} data-revelar>
      <Celular plataforma={captura.plataforma}>
        <CapturaDaTela captura={captura} alt={alt} tamanhos={TAMANHOS.momento} sobDemanda />
      </Celular>
      <figcaption className="cn-noapp__legenda">
        <span className="cn-noapp__titulo">{legenda}</span>
        <span className="cn-noapp__links"><LinkDaCaptura captura={captura} alt={alt} />{children}</span>
      </figcaption>
    </figure>
  );
}
