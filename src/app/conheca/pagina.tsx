import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { nomeCookieSessao } from '@/servidor/acesso/origem';
import { CABECALHO_NA_RAIZ } from '@/servidor/acesso/raiz';
import { visitanteAtivo } from '@/servidor/acesso/visitante';
import { Desenho } from '../../ui/mundo';
import { Mascote } from '../../ui/mascote';
import { BotaoSom } from '../som';
import { detectarAparelho, type Aparelho } from './aparelho';
import { CartaoQr } from './cartao-qr';
import { Celular, CapturaDaTela } from './celular';
import { CAPTURAS } from './imagens.gerado';
import { LogoDaPagina } from './ilhas/logo';
import { AcoesDeInstalar, SecaoInstalar } from './ilhas/instalar';
import { CelularDoHeroi } from './ilhas/celular-heroi';
import { Momentos } from './ilhas/momentos';
import { Fichas } from './ilhas/fichas';
import { Revelar } from './ilhas/revelar';
import { SaidaDoApp } from './ilhas/saida-do-app';
import { escolherInicio } from './inicio';
import { linksDoSite, tamanhoDoApk, type LinksDoSite } from './links';
import { origemPublica } from './origem-publica';
import { svgDoQr } from './qr';
import { textos } from './textos';
import './conheca.css';

/** Os `alt` da spec 18 (seção 9). O do momento 1 ainda não veio do Designer: este é provisório, como a captura. */
const MOMENTOS_DO_S2 = [
  { captura: CAPTURAS['momento-1'], alt: 'Lição do Studoo com o cartão do trecho do seu material' },
  { captura: CAPTURAS['momento-2'], alt: 'A ponte do Studoo: outro jeito de entender, em 3 passos' },
  { captura: CAPTURAS['momento-3'], alt: 'O retorno do Stu à sua explicação' },
  { captura: CAPTURAS['momento-4'], alt: 'O mapa da trilha no app' },
] as const;

const TELAS_DO_HEROI = [
  { captura: CAPTURAS['heroi-1'], alt: 'Tela do Studoo perguntando o que você quer aprender' },
  { captura: CAPTURAS['heroi-2'], alt: 'Tela do Studoo com a trilha pronta' },
  { captura: CAPTURAS['heroi-3'], alt: 'Lição do Studoo com a resposta certa e o Stu comemorando' },
] as const;

export interface ContextoDaPagina {
  /** O aparelho que o servidor viu pelo agente do usuário. */
  aparelho: Aparelho;
  links: LinksDoSite;
  /** A origem pública (https, nunca local) para o QR; null = sem QR. */
  origem: string | null;
  /** A pessoa já tem sessão (o "Entrar" vira "Abrir o Studoo"). */
  comSessao: boolean;
  /** O servidor liga o modo visitante. */
  visitante: boolean;
  /** A página está sendo servida em "/" (a raiz de quem não entrou); o app instalado na tela de início segue dela direto para o login. */
  naRaiz?: boolean;
}

/** A página já com tudo decidido: pura, sem ler o pedido (por isso se testa com `renderToStaticMarkup`). */
export function PaginaVista({ aparelho, links, origem, comSessao, visitante, naRaiz = false }: ContextoDaPagina) {
  const tamanho = tamanhoDoApk(links);
  const svg = origem && aparelho === 'computador' ? svgDoQr(`${origem}/baixar`) : null;
  const dados = { aparelho, apk: links.apk, testflight: links.testflight, tamanho, visitanteAtivo: visitante, comSessao };
  const entrar = comSessao ? { rotulo: textos.cabecalho.abrir, href: '/' } : { rotulo: textos.cabecalho.entrar, href: '/login' };
  const qrDoHeroi = svg ? <CartaoQr svg={svg} apk={links.apk} tamanho={tamanho} idBase="cn-qr-heroi" /> : null;
  const qrDoS4 = svg ? <CartaoQr svg={svg} apk={links.apk} tamanho={tamanho} idBase="cn-qr-s4" /> : null;

  return (
    <div className="cn-pagina" data-na-raiz={naRaiz || undefined}>
      <a className="pular" href="#conteudo">{textos.pular}</a>
      <header className="cn-cabecalho">
        <LogoDaPagina />
        <div className="cn-cabecalho__acoes">
          <BotaoSom />
          <Link className="botao botao--texto cn-entrar" href={entrar.href}>{entrar.rotulo}</Link>
        </div>
      </header>

      <main>
        <section id="conteudo" className="cn-heroi" aria-labelledby="cn-titulo-heroi" tabIndex={-1}>
          <div className="cn-heroi__ceu" aria-hidden="true">
            <Desenho nome="nuvem" className="cn-nuvem cn-nuvem--1" />
            <Desenho nome="nuvem" className="cn-nuvem cn-nuvem--2" />
            <span className="cn-colina" />
          </div>
          <div className="cn-heroi__texto">
            <h1 id="cn-titulo-heroi" className="cn-heroi__titulo">{textos.heroi.titulo}</h1>
            <p className="cn-heroi__subtitulo">{textos.heroi.subtitulo}</p>
            <AcoesDeInstalar {...dados} qr={qrDoHeroi} lugar="heroi" />
          </div>
          <div className="cn-heroi__palco">
            <CelularDoHeroi telas={TELAS_DO_HEROI} rotulo={textos.heroi.celularRotulo} plataforma={TELAS_DO_HEROI[0].captura.plataforma} />
            <div className="cn-heroi__stu" aria-hidden="true">
              <Mascote expressao="stu-acolhida" tamanho={160} decorativo animado="acontecimento" acontecimento={1} ciclos={3} />
            </div>
          </div>
        </section>

        <section className="cn-secao cn-s2" aria-labelledby="cn-titulo-s2">
          <h2 id="cn-titulo-s2" className="cn-secao__titulo" data-revelar>{textos.s2.titulo}</h2>
          <Momentos>
            {textos.s2.momentos.map((momento, indice) => (
              <article key={momento.titulo} className="cn-momento" data-momento={indice + 1} data-revelar>
                <div className="cn-momento__texto">
                  <h3 className="cn-momento__titulo">{momento.titulo}</h3>
                  <p className="cn-momento__linha">{momento.linha}</p>
                </div>
                <div className="cn-momento__visual">
                  <Celular plataforma={MOMENTOS_DO_S2[indice].captura.plataforma}>
                    <CapturaDaTela captura={MOMENTOS_DO_S2[indice].captura} alt={MOMENTOS_DO_S2[indice].alt} />
                  </Celular>
                  {indice === 3 && <p className="cn-selo-sincronia"><span className="cn-selo-sincronia__ponto" aria-hidden="true" />{textos.s2.selo}</p>}
                </div>
              </article>
            ))}
          </Momentos>
        </section>

        <section className="cn-secao cn-s3" aria-labelledby="cn-titulo-s3" data-revelar>
          <div className="cn-s3__stu" aria-hidden="true">
            <Mascote expressao="stu-curioso" tamanho={96} decorativo />
          </div>
          <h2 id="cn-titulo-s3" className="cn-secao__titulo">{textos.s3.titulo}</h2>
          <p className="cn-secao__linha">{textos.s3.linha}</p>
          <Fichas visitanteAtivo={visitante} comSessao={comSessao} />
        </section>

        <section id="baixar" className="cn-secao cn-s4" aria-labelledby="cn-titulo-s4" data-revelar>
          <h2 id="cn-titulo-s4" className="cn-secao__titulo">{textos.s4.titulo}</h2>
          <SecaoInstalar {...dados} qr={qrDoS4} />
        </section>

        <section className="cn-secao cn-s5" aria-labelledby="cn-titulo-s5" data-revelar>
          <div className="cn-s5__stu" aria-hidden="true">
            <Mascote expressao="stu-celebrando" tamanho={160} decorativo animado="uma-vez" />
          </div>
          <h2 id="cn-titulo-s5" className="cn-secao__titulo">{textos.s5.titulo}</h2>
          <AcoesDeInstalar {...dados} qr={null} lugar="final" />
        </section>
      </main>

      <footer className="cn-rodape" data-revelar>
        <picture className="logo-quadro">
          <img src="/marca/logo-com-sorriso.svg" width={140} height={46} alt="Studoo" />
        </picture>
        <p className="cn-rodape__linha">{textos.s6.linha}</p>
        <nav className="cn-rodape__links" aria-label="Links do rodapé">
          <Link href="/privacidade">{textos.s6.privacidade}</Link>
          <Link href="/suporte">{textos.s6.suporte}</Link>
          <Link href={entrar.href}>{entrar.rotulo}</Link>
        </nav>
      </footer>
      <Revelar />
      {naRaiz && <SaidaDoApp />}
    </div>
  );
}

/**
 * A página de apresentação do Studoo (spec 18): servidor, rápida, com ilhas de cliente pequenas para animação, aparelho, QR e visitante.
 * Serve `/conheca` (para compartilhar) e, para quem não tem sessão, a `/`. O aparelho, os links e a origem do QR são lidos a CADA pedido.
 */
export async function PaginaDeApresentacao() {
  const cabecalhos = await headers();
  const biscoitos = await cookies();
  return (
    <PaginaVista
      aparelho={detectarAparelho(cabecalhos.get('user-agent'))}
      links={linksDoSite()}
      origem={origemPublica({ protocolo: cabecalhos.get('x-forwarded-proto'), host: cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') })}
      comSessao={escolherInicio(biscoitos.get(nomeCookieSessao())?.value) === 'app'}
      visitante={visitanteAtivo()}
      naRaiz={cabecalhos.get(CABECALHO_NA_RAIZ) === '1'}
    />
  );
}
