import { Fragment, type ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { ehHostDaApresentacao, ORIGEM_APRESENTACAO, ORIGEM_APP_STUDOO } from '@/enderecos-publicos';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { Desenho } from '../../ui/mundo';
import { SemMusica } from './ilhas/sem-musica';
import { detectarAparelho, type Aparelho } from './aparelho';
import { CartaoQr } from './cartao-qr';
import { Celular, CapturaDaTela, JanelaDoNavegador, TAMANHOS } from './celular';
import { Enfeite, Fala, LinkDaCaptura, Marco, NoApp, Onda, Regiao, StuGrande } from './cenario';
import { CAPTURAS } from './imagens.gerado';
import { telasDoHeroi } from './heroi';
import { IconeAbaixo, IconeBussola, IconeCaderno, IconeCamera, IconeCelular, IconeFala, IconeFolha, IconeLampada, IconePonte, IconeTrofeu } from './icones';
import { LogoDaPagina } from './ilhas/logo';
import { AcoesDeInstalar, SecaoInstalar } from './ilhas/instalar';
import { Fichas } from './ilhas/fichas';
import { MaterialVivo } from './ilhas/material';
import { PonteViva } from './ilhas/ponte';
import { EnsinarVivo } from './ilhas/ensinar';
import { Trilha } from './ilhas/trilha';
import { AssuntoProprio, BotaoVisitante } from './ilhas/visitante';
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

/** O ícone do marco de cada parada, na ordem de `textos.paradas`. */
const ICONES_DAS_PARADAS: readonly ReactNode[] = [<IconeCaderno key="caderno" />, <IconePonte key="ponte" />, <IconeFala key="fala" />, <IconeBussola key="bussola" />, <IconeCelular key="celular" />];
/** O ícone de cada entrada do Studoo nas fichas do alto (foto, documento e só o assunto), na ordem de `textos.heroi.entradas`. */
const ICONES_DAS_ENTRADAS: readonly ReactNode[] = [<IconeCamera key="foto" />, <IconeFolha key="documento" />, <IconeLampada key="assunto" />];

const [PARADA_MATERIAL, PARADA_PONTE, PARADA_ENSINAR, PARADA_ASSUNTOS, PARADA_BAIXAR] = textos.paradas;
const TOTAL_DE_PARADAS = textos.paradas.length;

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

/**
 * A página já com tudo decidido: pura, sem ler o pedido (por isso se testa com `renderToStaticMarkup`).
 *
 * A página é uma trilha pelo mundo do Studoo. O alto é o campo, e cada parada é uma região do mapa do app (floresta, lago, montanhas, vila e nuvens),
 * com as mesmas cores e os mesmos desenhos. As três primeiras paradas acompanham UMA lição de exemplo, a de frações: a anotação vira lição com a
 * fonte, o erro vira ponte e a pessoa ensina ao Stu. Depois vêm o assunto dela e o app no celular, e a trilha termina na chegada, com o troféu.
 */
export function PaginaVista({ aparelho, links, origem, dominioProprio = false, comSessao, visitante, naRaiz = false, podeSerIpad = false }: ContextoDaPagina) {
  const tamanho = tamanhoDoApk(links);
  const svg = origem && aparelho === 'computador' ? svgDoQr(`${origem}/baixar`) : null;
  const baseDoApp = dominioProprio ? ORIGEM_APP_STUDOO : '';
  const appParaInstalar = comSessao && !dominioProprio ? '/' : ORIGEM_APP_STUDOO + '/';
  const dados = { aparelho, apk: links.apk, testflight: links.testflight, tamanho, visitanteAtivo: visitante, comSessao, appParaInstalar };
  const entrar = comSessao ? { rotulo: textos.cabecalho.abrir, href: baseDoApp + '/' } : { rotulo: textos.cabecalho.entrar, href: baseDoApp + '/login' };
  const telaDaTrilha = telasDoHeroi(aparelho)[1];
  const qrDoS4 = svg ? <CartaoQr svg={svg} apk={links.apk} tamanho={tamanho} idBase="cn-qr-s4" /> : null;
  const qrDoS4Iphone = svg ? <CartaoQr svg={svg} apk={links.apk} tamanho={tamanho} idBase="cn-qr-s4-iphone" semArquivo testflight={links.testflight} /> : null;
  // No cabeçalho, quem já entrou só precisa de "Abrir o Studoo". Os outros veem "Entrar" e o convite do aparelho: experimentar no computador, instalar no celular.
  const experimentarNoCabecalho = aparelho === 'computador' && visitante;

  return (
    <div className="cn-pagina" data-na-raiz={naRaiz || undefined} data-sem-musica="">
      <SemMusica />
      <a className="pular" href="#conteudo">{textos.pular}</a>
      <header className="cn-cabecalho">
        <div className="cn-capsula">
          <LogoDaPagina />
          <Trilha />
          <div className="cn-cabecalho__acoes">
            <Link className={comSessao ? 'botao botao--primario cn-entrar cn-entrar--abrir' : 'botao botao--texto cn-entrar'} href={entrar.href}>{entrar.rotulo}</Link>
            {!comSessao && (experimentarNoCabecalho
              ? <BotaoVisitante ativo={visitante} comSessao={comSessao} variante="primario" className="cn-capsula__convite" />
              : <a className="botao botao--primario cn-capsula__convite" href="#baixar">{textos.cabecalho.instalar}</a>)}
          </div>
        </div>
      </header>

      <main>
        <section id="conteudo" className="cn-heroi" aria-labelledby="cn-titulo-heroi" tabIndex={-1}>
          <div className="cn-heroi__ceu" aria-hidden="true">
            <Desenho nome="sol" className="cn-heroi__sol" />
            <Desenho nome="nuvem" className="cn-nuvem cn-nuvem--1" />
            <Desenho nome="nuvem" className="cn-nuvem cn-nuvem--2" />
            <Desenho nome="nuvem" className="cn-nuvem cn-nuvem--3" />
            <Desenho nome="balao" className="cn-heroi__balao" />
          </div>
          <div className="cn-secao cn-heroi__miolo">
            <div className="cn-heroi__texto">
              <h1 id="cn-titulo-heroi" className="cn-heroi__titulo">
                {linhasDoTitulo.map((linha, indice) => <Fragment key={linha}>{indice > 0 && ' '}<span className="cn-heroi__frase">{linha}</span></Fragment>)}
              </h1>
              <p className="cn-heroi__subtitulo">{textos.heroi.subtitulo}</p>
              <AcoesDeInstalar {...dados} lugar="heroi" reservarIpad={podeSerIpad} />
            </div>
            <div className="cn-heroi__palco">
              <ul className="cn-entradas" aria-hidden="true">
                {textos.heroi.entradas.map((entrada, indice) => <li key={entrada} className="cn-entrada"><span className="cn-entrada__icone">{ICONES_DAS_ENTRADAS[indice]}</span>{entrada}</li>)}
              </ul>
              <div className="cn-heroi__figura">
                <Fala className="cn-heroi__ola">{textos.heroi.ola}</Fala>
                <span className="cn-heroi__stu" aria-hidden="true">
                  <StuGrande nome="stu-acolhida" tamanhos="(min-width: 1040px) 360px, (min-width: 740px) 290px, 210px" prioridade />
                </span>
              </div>
            </div>
          </div>
          <div className="cn-heroi__chao" aria-hidden="true">
            <svg className="cn-colinas" viewBox="0 0 1440 340" preserveAspectRatio="none" focusable="false">
              <path d="M0 150C210 60 420 56 640 124S1060 216 1440 96V340H0Z" fill="#b9e3ab" />
              <path d="M0 214C250 132 470 150 720 196S1180 250 1440 168V340H0Z" fill="#cdebc0" />
              <path d="M0 274C300 214 560 232 800 256S1220 286 1440 244V340H0Z" fill="#e3f4da" />
              <path className="cn-colinas__estrada" d="M1030 92C1004 168 880 176 800 222S722 300 720 340" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeDasharray="1 19" vectorEffect="non-scaling-stroke" />
            </svg>
            <Enfeite nome="arvore" onde={{ '--x': '3%', '--b': '34%', '--tam': 'clamp(46px, 6.4vw, 104px)' }} />
            <Enfeite nome="arbusto" onde={{ '--x': '12%', '--b': '26%', '--tam': 'clamp(38px, 4.6vw, 76px)' }} />
            <Enfeite nome="flores" onde={{ '--x': '21%', '--b': '15%', '--tam': 'clamp(24px, 3vw, 46px)' }} />
            <Enfeite nome="pinheiro" onde={{ '--xr': '2.5%', '--b': '40%', '--tam': 'clamp(34px, 4.6vw, 78px)' }} />
            <Enfeite nome="arvore" onde={{ '--xr': '9%', '--b': '30%', '--tam': 'clamp(40px, 5.4vw, 90px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="relva" onde={{ '--xr': '24%', '--b': '12%', '--tam': 'clamp(18px, 2vw, 30px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="cogumelo" onde={{ '--x': '34%', '--b': '9%', '--tam': 'clamp(18px, 2.1vw, 32px)' }} className="cn-enfeite--largo" />
          </div>
          <a className="cn-comecar" href={`#${PARADA_MATERIAL.id}`}>
            <span className="cn-comecar__selo">{textos.heroi.comecar.selo}</span>
            <span className="cn-comecar__rotulo">{textos.heroi.comecar.rotulo}</span>
            <IconeAbaixo />
          </a>
        </section>

        <VisualizadorDeCapturas>
          <Regiao parada={PARADA_MATERIAL} numero={1} total={TOTAL_DE_PARADAS} icone={ICONES_DAS_PARADAS[0]} enfeites={<>
            <Enfeite nome="pinheiro" onde={{ '--x': '2%', '--t': '9%', '--tam': 'clamp(34px, 4.4vw, 70px)' }} />
            <Enfeite nome="pinheiro" onde={{ '--x': '7.5%', '--t': '15%', '--tam': 'clamp(26px, 3.2vw, 50px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="cogumelo" onde={{ '--x': '5%', '--b': '7%', '--tam': 'clamp(20px, 2.3vw, 36px)' }} />
            <Enfeite nome="pinheiro" onde={{ '--xr': '3%', '--t': '12%', '--tam': 'clamp(30px, 4vw, 64px)' }} />
            <Enfeite nome="tronco" onde={{ '--xr': '6%', '--b': '9%', '--tam': 'clamp(30px, 3.6vw, 58px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="arbusto" onde={{ '--xr': '14%', '--b': '5%', '--tam': 'clamp(30px, 3.4vw, 54px)' }} className="cn-enfeite--largo" />
          </>}>
            <div className="cn-anfitriao" data-revelar>
              <StuGrande nome="stu-estudando" tamanhos="(min-width: 740px) 170px, 124px" className="cn-anfitriao__stu" />
              <Fala>{PARADA_MATERIAL.fala}</Fala>
            </div>
            <div className="cn-palco cn-palco--material">
              <div className="cn-palco__demo">
                <MaterialVivo />
                <p className="cn-formatos">
                  <span className="cn-formatos__rotulo">{textos.material.le}</span>
                  {textos.material.formatos.map((formato) => <span key={formato} className="cn-formato">{formato}</span>)}
                  <span className="cn-formatos__ou">{textos.material.ouAssunto}</span>
                </p>
              </div>
              <NoApp captura={CAPTURAS['momento-1']} alt={textos.material.noApp.alt} legenda={textos.material.noApp.legenda}>
                <a href="/landing/regra-dos-tercos.pdf" target="_blank" rel="noopener noreferrer" aria-label={textos.material.noApp.pdf.rotuloLeitor}>{textos.material.noApp.pdf.rotulo}</a>
              </NoApp>
            </div>
          </Regiao>

          <Regiao parada={PARADA_PONTE} numero={2} total={TOTAL_DE_PARADAS} icone={ICONES_DAS_PARADAS[1]} enfeites={<>
            <Enfeite nome="ondas" onde={{ '--x': '4%', '--t': '14%', '--tam': 'clamp(40px, 5vw, 80px)' }} />
            <Enfeite nome="barco" onde={{ '--x': '7%', '--b': '12%', '--tam': 'clamp(34px, 4.2vw, 68px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="ondas" onde={{ '--xr': '5%', '--t': '22%', '--tam': 'clamp(36px, 4.4vw, 70px)' }} />
            <Enfeite nome="ondas" onde={{ '--xr': '11%', '--b': '8%', '--tam': 'clamp(40px, 5vw, 80px)' }} className="cn-enfeite--largo" />
          </>}>
            <div className="cn-palco cn-palco--ponte">
              <div className="cn-palco__demo">
                <PonteViva fala={PARADA_PONTE.fala} stu={<StuGrande nome="stu-encorajador" tamanhos="(min-width: 740px) 132px, 104px" className="cn-anfitriao__stu" />} enfeites={<>
                  <Desenho nome="barco" className="cn-lago__enfeite cn-lago__barco" />
                  <Desenho nome="arvore" className="cn-lago__enfeite cn-lago__arvore" />
                  <Desenho nome="arbusto" className="cn-lago__enfeite cn-lago__arbusto" />
                  <Desenho nome="flores" className="cn-lago__enfeite cn-lago__flores" />
                  <Desenho nome="bandeira" className="cn-lago__enfeite cn-lago__bandeira" />
                </>} />
              </div>
              <NoApp captura={CAPTURAS['momento-2']} alt={textos.ponte.noApp.alt} legenda={textos.ponte.noApp.legenda} />
            </div>
          </Regiao>

          <Regiao parada={PARADA_ENSINAR} numero={3} total={TOTAL_DE_PARADAS} icone={ICONES_DAS_PARADAS[2]} enfeites={<>
            <Enfeite nome="picos" onde={{ '--x': '1.5%', '--t': '10%', '--tam': 'clamp(70px, 10vw, 170px)' }} />
            <Enfeite nome="pedra" onde={{ '--x': '6%', '--b': '8%', '--tam': 'clamp(30px, 3.8vw, 60px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="picos" onde={{ '--xr': '1.5%', '--t': '18%', '--tam': 'clamp(60px, 8.4vw, 140px)' }} />
            <Enfeite nome="pinheiro" onde={{ '--xr': '9%', '--b': '7%', '--tam': 'clamp(28px, 3.4vw, 54px)' }} className="cn-enfeite--largo" />
          </>}>
            <div className="cn-palco cn-palco--ensinar">
              <div className="cn-palco__demo">
                <EnsinarVivo fala={<Fala className="cn-ensinar__fala">{PARADA_ENSINAR.fala}</Fala>} />
              </div>
              <NoApp captura={CAPTURAS['momento-3']} alt={textos.ensinar.noApp.alt} legenda={textos.ensinar.noApp.legenda} />
            </div>
          </Regiao>

          <Regiao parada={PARADA_ASSUNTOS} numero={4} total={TOTAL_DE_PARADAS} icone={ICONES_DAS_PARADAS[3]} enfeites={<>
            <Enfeite nome="casa" onde={{ '--x': '2.5%', '--b': '6%', '--tam': 'clamp(40px, 5.6vw, 92px)' }} />
            <Enfeite nome="arvore" onde={{ '--x': '10%', '--b': '5%', '--tam': 'clamp(32px, 4vw, 66px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="flores" onde={{ '--x': '16%', '--b': '4%', '--tam': 'clamp(22px, 2.6vw, 40px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="casa" onde={{ '--xr': '3%', '--t': '11%', '--tam': 'clamp(36px, 4.8vw, 80px)' }} />
            <Enfeite nome="arbusto" onde={{ '--xr': '11%', '--t': '18%', '--tam': 'clamp(28px, 3.4vw, 54px)' }} className="cn-enfeite--largo" />
          </>}>
            <div className="cn-palco cn-palco--assuntos">
              <div className="cn-palco__demo">
                <div className="cn-anfitriao cn-anfitriao--lado" data-revelar>
                  <StuGrande nome="stu-tres-quartos" tamanhos="(min-width: 740px) 132px, 104px" className="cn-anfitriao__stu" />
                  <Fala>{PARADA_ASSUNTOS.fala}</Fala>
                </div>
                <div className="cn-pedido" data-revelar>
                  <AssuntoProprio ativo={visitante} comSessao={comSessao} />
                  <Fichas visitanteAtivo={visitante} comSessao={comSessao} />
                </div>
              </div>
              <NoApp captura={telaDaTrilha.captura} alt={textos.assuntos.noApp.alt} legenda={textos.assuntos.noApp.legenda} />
            </div>
          </Regiao>

          <Regiao parada={PARADA_BAIXAR} numero={5} total={TOTAL_DE_PARADAS} icone={ICONES_DAS_PARADAS[4]} enfeites={<>
            <Enfeite nome="nuvem" onde={{ '--x': '3%', '--t': '12%', '--tam': 'clamp(60px, 8vw, 130px)' }} />
            <Enfeite nome="balao" onde={{ '--x': '9%', '--b': '12%', '--tam': 'clamp(28px, 3.6vw, 58px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="nuvem" onde={{ '--xr': '2%', '--t': '26%', '--tam': 'clamp(50px, 6.6vw, 110px)' }} />
            <Enfeite nome="estrela" onde={{ '--xr': '12%', '--t': '13%', '--tam': 'clamp(16px, 1.8vw, 28px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="nuvem" onde={{ '--xr': '8%', '--b': '7%', '--tam': 'clamp(44px, 5.6vw, 92px)' }} className="cn-enfeite--largo" />
          </>}>
            <div className="cn-palco cn-palco--levar">
              <div className="cn-instalador" data-revelar><SecaoInstalar {...dados} qr={qrDoS4} qrIphone={qrDoS4Iphone} /></div>
              <div className="cn-sincronia" data-revelar>
                <div className="cn-anfitriao cn-anfitriao--lado">
                  <StuGrande nome="stu-animado" tamanhos="(min-width: 740px) 120px, 96px" className="cn-anfitriao__stu" />
                  <Fala>{PARADA_BAIXAR.fala}</Fala>
                </div>
                <div className="cn-composto">
                  <JanelaDoNavegador captura={CAPTURAS['janela-4']} alt={textos.sincronia.janelaAlt} />
                  <Celular plataforma={CAPTURAS['momento-4'].plataforma}>
                    <CapturaDaTela captura={CAPTURAS['momento-4']} alt={textos.sincronia.celularAlt} tamanhos={TAMANHOS.celularDoComposto} sobDemanda />
                  </Celular>
                  <p className="cn-selo-sincronia"><span className="cn-selo-sincronia__ponto" aria-hidden="true" />{textos.sincronia.selo}</p>
                </div>
                <p className="cn-noapp__links cn-sincronia__links">
                  <LinkDaCaptura captura={CAPTURAS['momento-4']} alt={textos.sincronia.celularAlt} />
                  <LinkDaCaptura captura={CAPTURAS['janela-4']} alt={textos.sincronia.janelaAlt} />
                </p>
              </div>
            </div>
          </Regiao>
        </VisualizadorDeCapturas>

        <section className="cn-chegada" data-parada={TOTAL_DE_PARADAS + 1} aria-labelledby="cn-titulo-chegada">
          <Onda />
          <div className="cn-chegada__ceu" aria-hidden="true">
            <Enfeite nome="estrela" onde={{ '--x': '8%', '--t': '20%', '--tam': 'clamp(16px, 2vw, 30px)' }} />
            <Enfeite nome="estrela" onde={{ '--x': '19%', '--t': '54%', '--tam': 'clamp(10px, 1.3vw, 18px)' }} />
            <Enfeite nome="estrela" onde={{ '--x': '31%', '--t': '15%', '--tam': 'clamp(9px, 1.1vw, 15px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="estrela" onde={{ '--xr': '9%', '--t': '26%', '--tam': 'clamp(13px, 1.7vw, 25px)' }} />
            <Enfeite nome="estrela" onde={{ '--xr': '22%', '--t': '62%', '--tam': 'clamp(10px, 1.2vw, 17px)' }} className="cn-enfeite--largo" />
            <Enfeite nome="estrela" onde={{ '--xr': '34%', '--t': '13%', '--tam': 'clamp(9px, 1.1vw, 15px)' }} />
          </div>
          <div className="cn-secao cn-chegada__miolo">
            <Marco numero={TOTAL_DE_PARADAS + 1} total={TOTAL_DE_PARADAS} lugar={textos.s5.lugar} icone={<IconeTrofeu />} soLugar />
            <div className="cn-chegada__palco">
              <span className="cn-chegada__stu" aria-hidden="true" data-revelar>
                <StuGrande nome="stu-celebrando" tamanhos="(min-width: 900px) 340px, 220px" />
              </span>
              <div className="cn-chegada__convite" data-revelar>
                <h2 id="cn-titulo-chegada" className="cn-titulo">{textos.s5.titulo}</h2>
                <AcoesDeInstalar {...dados} lugar="final" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="cn-rodape">
        <picture className="logo-quadro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
 * A página de apresentação do Studoo: servidor, rápida, com ilhas de cliente pequenas para a trilha, as três demonstrações, o aparelho, o QR e o visitante.
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
