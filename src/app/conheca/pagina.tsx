import { Fragment } from 'react';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { ehHostDaApresentacao, ORIGEM_APRESENTACAO, ORIGEM_APP_STUDOO } from '@/enderecos-publicos';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { Mascote } from '../../ui/mascote';
import { SemMusica } from './ilhas/sem-musica';
import { detectarAparelho, type Aparelho } from './aparelho';
import { CartaoQr } from './cartao-qr';
import { Celular, CapturaDaTela, JanelaDoNavegador, TAMANHOS } from './celular';
import { CAPTURAS } from './imagens.gerado';
import type { CapturaOtimizada } from './imagens';
import { telasDoHeroi } from './heroi';
import { LogoDaPagina } from './ilhas/logo';
import { AcoesDeInstalar, SecaoInstalar } from './ilhas/instalar';
import { CelularDoHeroi } from './ilhas/celular-heroi';
import { Momentos } from './ilhas/momentos';
import { Fichas } from './ilhas/fichas';
import { LicaoDeExemplo } from './ilhas/licao-de-exemplo';
import { AssuntoProprio } from './ilhas/visitante';
import { VisualizadorDeCapturas } from './ilhas/visualizador';
import { Revelar } from './ilhas/revelar';
import { CarregarPerto } from './ilhas/carregar-perto';
import { SaidaDoApp } from './ilhas/saida-do-app';
import { temCookieDeSessao } from './inicio';
import { linksDoSite, tamanhoDoApk, type LinksDoSite } from './links';
import { origemPublica } from './origem-publica';
import { svgDoQr } from './qr';
import { linhasDoTitulo, textos } from './textos';
import './conheca.css';

/** Os `alt` da spec 18 (seção 9). O do momento 1 e o da janela do momento 4 não vêm na lista da spec: são meus, no mesmo tom. */
const MOMENTOS_DO_S2 = [
  { captura: CAPTURAS['momento-1'], alt: 'Lição de fotografia no Android com a explicação do Stu e a referência [1] ao material usado' },
  { captura: CAPTURAS['momento-2'], alt: 'A ponte do Studoo: outro jeito de entender, em 3 passos' },
  { captura: CAPTURAS['momento-3'], alt: 'O retorno do Stu à sua explicação' },
  { captura: CAPTURAS['momento-4'], alt: 'O mapa da trilha no app' },
] as const;

function LinkDaCaptura({ captura, alt }: { captura: CapturaOtimizada; alt: string }) {
  const lugar = captura.plataforma === 'web' ? 'site' : 'app';
  return <a href={captura.src2x} aria-haspopup="dialog" data-ampliar={`Tela do ${lugar}`} data-descricao={alt}
    data-largura={2 * captura.largura} data-altura={2 * captura.altura}>Ampliar tela do {lugar}</a>;
}

export interface ContextoDaPagina {
  /** O aparelho que o servidor viu pelo agente do usuário. */
  aparelho: Aparelho;
  links: LinksDoSite;
  /** A origem pública (https, nunca local) para o QR; null = sem QR. */
  origem: string | null;
  /** No domínio de apresentação, o login e a sessão ficam no subdomínio do app. */
  dominioProprio?: boolean;
  /** A pessoa já tem sessão (o "Entrar" vira "Abrir o Studoo"). */
  comSessao: boolean;
  /** O servidor liga o modo visitante. */
  visitante: boolean;
  /** A página está sendo servida em "/" (a raiz de quem não entrou); o app instalado na tela de início segue dela direto para o login. */
  naRaiz?: boolean;
  /** O Safari do iPad também pode enviar a identificação de um Mac. */
  podeSerIpad?: boolean;
}

/** A página já com tudo decidido: pura, sem ler o pedido (por isso se testa com `renderToStaticMarkup`). */
export function PaginaVista({ aparelho, links, origem, dominioProprio = false, comSessao, visitante, naRaiz = false, podeSerIpad = false }: ContextoDaPagina) {
  const tamanho = tamanhoDoApk(links);
  const svg = origem && aparelho === 'computador' ? svgDoQr(`${origem}/baixar`) : null;
  const baseDoApp = dominioProprio ? ORIGEM_APP_STUDOO : '';
  const appParaInstalar = comSessao && !dominioProprio ? '/' : ORIGEM_APP_STUDOO + '/';
  const dados = { aparelho, apk: links.apk, testflight: links.testflight, tamanho, visitanteAtivo: visitante, comSessao, appParaInstalar };
  const entrar = comSessao ? { rotulo: textos.cabecalho.abrir, href: baseDoApp + '/' } : { rotulo: textos.cabecalho.entrar, href: baseDoApp + '/login' };
  const telasDoCelular = telasDoHeroi(aparelho);
  const qrDoS4 = svg ? <CartaoQr svg={svg} apk={links.apk} tamanho={tamanho} idBase="cn-qr-s4" /> : null;
  const qrDoS4Iphone = svg ? <CartaoQr svg={svg} apk={links.apk} tamanho={tamanho} idBase="cn-qr-s4-iphone" semArquivo testflight={links.testflight} /> : null;

  return (
    <div className="cn-pagina" data-na-raiz={naRaiz || undefined} data-sem-musica="">
      <SemMusica />
      <a className="pular" href="#conteudo">{textos.pular}</a>
      <header className="cn-cabecalho">
        <LogoDaPagina />
        <nav className="cn-menu" aria-label="Nesta página">
          <a href="#licao-de-exemplo">Lição de exemplo</a>
          <a href="#assuntos">Assuntos</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#baixar">Instalar</a>
        </nav>
        <div className="cn-cabecalho__acoes">
          <Link className="botao botao--texto cn-entrar" href={entrar.href}>{entrar.rotulo}</Link>
        </div>
      </header>

      <main>
        <section id="conteudo" className="cn-heroi" aria-labelledby="cn-titulo-heroi" tabIndex={-1}>
          <div className="cn-heroi__texto">
            <h1 id="cn-titulo-heroi" className="cn-heroi__titulo">
              {linhasDoTitulo.map((linha, indice) => <Fragment key={linha}>{indice > 0 && ' '}<span className="cn-heroi__frase">{linha}</span></Fragment>)}
            </h1>
            <p className="cn-heroi__subtitulo">{textos.heroi.subtitulo}</p>
            <AcoesDeInstalar {...dados} lugar="heroi" reservarIpad={podeSerIpad} />
          </div>
          <div className="cn-heroi__palco">
            <div className="cn-caderno" aria-hidden="true"><span /></div>
            <CelularDoHeroi telas={telasDoCelular} rotulo={textos.heroi.celularRotulo} plataforma={telasDoCelular[0].captura.plataforma} />
            <div className="cn-heroi__stu" aria-hidden="true">
              <img src="/marca/stu/stu-acolhida-320.webp"
                srcSet="/marca/stu/stu-acolhida-192.webp 192w, /marca/stu/stu-acolhida-320.webp 320w, /marca/stu/stu-acolhida-480.webp 480w"
                sizes="(min-width: 1200px) 300px, (min-width: 740px) 24vw, 175px"
                width={480} height={468} alt="" decoding="async" draggable={false} />
            </div>
            <a className="cn-heroi__exemplo" href="#licao-de-exemplo">Resolver um exemplo <span aria-hidden="true">↓</span></a>
          </div>
        </section>

        <LicaoDeExemplo />

        <section id="assuntos" className="cn-secao cn-s3" aria-labelledby="cn-titulo-s3">
          <h2 id="cn-titulo-s3" className="cn-secao__titulo">{textos.s3.titulo}</h2>
          <AssuntoProprio ativo={visitante} comSessao={comSessao} />
          <Fichas visitanteAtivo={visitante} comSessao={comSessao} />
        </section>

        <section id="como-funciona" className="cn-secao cn-s2" aria-labelledby="cn-titulo-s2">
          <h2 id="cn-titulo-s2" className="cn-secao__titulo" data-revelar>{textos.s2.titulo}</h2>
          <VisualizadorDeCapturas><Momentos>
            {textos.s2.momentos.map((momento, indice) => (
              <article key={momento.titulo} className="cn-momento" id={`cn-momento-${indice + 1}`} data-momento={indice + 1} aria-labelledby={`cn-momento-titulo-${indice + 1}`}>
                <div className="cn-momento__texto">
                  <h3 className="cn-momento__titulo" id={`cn-momento-titulo-${indice + 1}`}>{momento.titulo}</h3>
                  <p className="cn-momento__linha">{momento.linha}</p>
                  {indice === 0 && (
                    <figure className="cn-fonte">
                      <figcaption>Do PDF desta lição · página 1</figcaption>
                      <blockquote>“Imagine duas linhas horizontais e duas verticais que dividem a imagem em nove partes iguais, como um jogo da velha.”</blockquote>
                    </figure>
                  )}
                  <div className="cn-momento__ampliar">
                    <LinkDaCaptura captura={MOMENTOS_DO_S2[indice].captura} alt={MOMENTOS_DO_S2[indice].alt} />
                    {indice === 0 && <a href="/landing/regra-dos-tercos.pdf" target="_blank" rel="noopener noreferrer" aria-label="Abrir PDF de exemplo em nova aba">Abrir PDF de exemplo</a>}
                    {indice === 3 && <LinkDaCaptura captura={CAPTURAS['janela-4']} alt={textos.s2.janelaAlt} />}
                  </div>
                </div>
                <div className={`cn-momento__visual${indice === 3 ? ' cn-momento__visual--composto' : ''}`}>
                  {indice === 3 ? (
                    // O momento 4: o site (uma janela de navegador desenhada pelo Studoo, com a captura REAL da web) e o app, a mesma trilha.
                    <div className="cn-composto">
                      <JanelaDoNavegador captura={CAPTURAS['janela-4']} alt={textos.s2.janelaAlt} />
                      <Celular plataforma={MOMENTOS_DO_S2[indice].captura.plataforma}>
                        <CapturaDaTela captura={MOMENTOS_DO_S2[indice].captura} alt={MOMENTOS_DO_S2[indice].alt} tamanhos={TAMANHOS.celularDoComposto} sobDemanda />
                      </Celular>
                      <p className="cn-selo-sincronia"><span className="cn-selo-sincronia__ponto" aria-hidden="true" />{textos.s2.selo}</p>
                    </div>
                  ) : (
                    <Celular plataforma={MOMENTOS_DO_S2[indice].captura.plataforma}>
                      <CapturaDaTela captura={MOMENTOS_DO_S2[indice].captura} alt={MOMENTOS_DO_S2[indice].alt} sobDemanda />
                    </Celular>
                  )}
                </div>
              </article>
            ))}
          </Momentos></VisualizadorDeCapturas>
        </section>

        <section id="baixar" className="cn-secao cn-s4" aria-labelledby="cn-titulo-s4" data-revelar>
          <h2 id="cn-titulo-s4" className="cn-secao__titulo">{textos.s4.titulo}</h2>
          <div className="cn-instalador"><SecaoInstalar {...dados} qr={qrDoS4} qrIphone={qrDoS4Iphone} /></div>
        </section>

        <section className="cn-secao cn-s5" aria-labelledby="cn-titulo-s5" data-revelar>
          <div className="cn-s5__stu" aria-hidden="true">
            <Mascote expressao="stu-celebrando" tamanho={160} decorativo animado="uma-vez" />
          </div>
          <div className="cn-s5__convite">
            <h2 id="cn-titulo-s5" className="cn-secao__titulo">{textos.s5.titulo}</h2>
            <AcoesDeInstalar {...dados} lugar="final" />
          </div>
        </section>
      </main>

      <footer className="cn-rodape" data-revelar>
        <picture className="logo-quadro">
          <img src="/marca/logo-com-sorriso.svg" width={140} height={46} alt="Studoo" loading="lazy" decoding="async" />
        </picture>
        <p className="cn-rodape__linha">{textos.s6.linha}</p>
        <nav className="cn-rodape__links" aria-label="Links do rodapé">
          <Link href="/privacidade">{textos.s6.privacidade}</Link>
          <Link href="/suporte">{textos.s6.suporte}</Link>
          <Link href={entrar.href}>{entrar.rotulo}</Link>
        </nav>
      </footer>
      <Revelar />
      <CarregarPerto />
      {naRaiz && <SaidaDoApp />}
    </div>
  );
}

/**
 * A página de apresentação do Studoo (spec 18): servidor, rápida, com ilhas de cliente pequenas para animação, aparelho, QR e visitante.
 * Serve `/conheca` (para compartilhar) e, para quem não tem sessão, a `/`. O aparelho, os links e a origem do QR são lidos a CADA pedido.
 */
export async function PaginaDeApresentacao({ naRaiz = false }: { naRaiz?: boolean } = {}) {
  const cabecalhos = await headers();
  const biscoitos = await cookies();
  const agente = cabecalhos.get('user-agent') ?? '';
  const dominioProprio = ehHostDaApresentacao(cabecalhos.get('host'));
  // O módulo do visitante abre o cliente do banco ao ser importado: aqui, só na hora do pedido, a página (e o teste dela) não depende do banco.
  const { visitanteAtivo } = await import('@/servidor/acesso/visitante');
  return (
    <PaginaVista
      aparelho={detectarAparelho(agente)}
      podeSerIpad={/Macintosh/.test(agente)}
      links={linksDoSite()}
      dominioProprio={dominioProprio}
      origem={dominioProprio ? ORIGEM_APRESENTACAO : origemPublica({ protocolo: cabecalhos.get('x-forwarded-proto'), host: cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') })}
      comSessao={!dominioProprio && temCookieDeSessao(biscoitos.get(nomeCookieSessao())?.value)}
      visitante={visitanteAtivo()}
      naRaiz={naRaiz}
    />
  );
}
