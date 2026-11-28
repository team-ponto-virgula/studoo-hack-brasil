'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ehIos, refinarAparelho, type Aparelho } from '../aparelho';
import { IconeBaixar, IconeCelular, IconeCompartilharIos, IconeConfirmarIos, IconeVisto } from '../icones';
import { textos } from '../textos';
import { AbrirAppNoSafari, Passos, PassosDoIphone } from './passos';
import { BotaoVisitante } from './visitante';

const FolhaIphone = dynamic(() => import('./folha-iphone'), { ssr: false });

/** O aparelho que o servidor viu, corrigido pelo navegador no que o servidor não enxerga (iPad no modo "site para computador"). */
function useAparelho(inicial: Aparelho): Aparelho {
  const [aparelho, setAparelho] = useState(inicial);
  useEffect(() => {
    const dicas = (window.navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
    setAparelho(refinarAparelho(inicial, { userAgent: window.navigator.userAgent, plataforma: dicas?.platform, pontosDeToque: window.navigator.maxTouchPoints }));
  }, [inicial]);
  return aparelho;
}

export interface DadosDeInstalar {
  /** O aparelho que o servidor viu pelo agente do usuário. */
  aparelho: Aparelho;
  apk: string;
  /** null = o TestFlight ainda não tem link público ("em breve"). */
  testflight: string | null;
  /** "114,9 MB", ou null quando o arquivo do link em uso não foi medido. */
  tamanho: string | null;
  visitanteAtivo: boolean;
  /** A pessoa já tem sessão: "Experimentar sem conta" vira "Abrir o Studoo" e não cria outra sessão. */
  comSessao: boolean;
  appParaInstalar: string;
}

/** "Baixar para Android": o arquivo baixa pelo link; o botão mostra o visto e "Baixando…" por 4 s, e a linha de como instalar fica. */
function BotaoAndroid({ apk, aoBaixar, baixando, aoClicarCom = '' }: { apk: string; aoBaixar: () => void; baixando: boolean; aoClicarCom?: string }) {
  return (
    <a className={`botao botao--primario cn-botao-principal ${aoClicarCom}`.trim()} href={apk} onClick={aoBaixar} data-baixando={baixando || undefined}
      aria-label={baixando ? undefined : textos.acoes.android.rotuloLeitor}>
      {baixando ? <><IconeVisto />{textos.acoes.android.baixando}</> : <><IconeBaixar />{textos.acoes.android.rotulo}</>}
    </a>
  );
}

function useBaixando() {
  const [baixando, setBaixando] = useState(false);
  const [comoInstalar, setComoInstalar] = useState(false);
  const relogio = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(relogio.current), []);
  const aoBaixar = useCallback(() => {
    setBaixando(true);
    setComoInstalar(true);
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => setBaixando(false), 4000);
  }, []);
  return { baixando, comoInstalar, aoBaixar };
}

/**
 * Android baixa o APK. O iPhone abre o TestFlight quando há convite. A folha com instruções da Tela de Início atende o iPad
 * e o iPhone quando o convite está desativado. Computador: "Experimentar sem conta" é o botão principal
 * e um link leva às instruções com o QR. O servidor já escolhe o aparelho certo no primeiro desenho; o navegador só corrige o iPad.
 */
export function AcoesDeInstalar({ aparelho: inicial, apk, testflight, tamanho, visitanteAtivo, comSessao, appParaInstalar, lugar, reservarIpad = false }: DadosDeInstalar & { lugar: 'heroi' | 'final'; reservarIpad?: boolean }) {
  const aparelho = useAparelho(inicial);
  const { baixando, comoInstalar, aoBaixar } = useBaixando();
  const [folha, setFolha] = useState(false);
  const abrirFolha = useCallback(() => setFolha(true), []);
  const fecharFolha = useCallback(() => setFolha(false), []);

  const textoVisitante = (variante: 'texto' | 'primario') => (
    <BotaoVisitante ativo={visitanteAtivo} comSessao={comSessao} variante={variante} className={variante === 'primario' ? 'cn-botao-principal' : 'cn-visitante-texto'} />
  );

  if (aparelho === 'computador') {
    return (
      <div className="cn-acoes cn-acoes--computador" data-lugar={lugar}>
        {textoVisitante('primario')}
        <a className="botao botao--texto cn-instalar-celular" href="#baixar"><IconeCelular />{textos.acoes.computador.instalarNoCelular}</a>
        {reservarIpad && <p className="cn-apoio cn-reserva-ipad" aria-hidden="true">{textos.acoes.ipad.apoio}</p>}
      </div>
    );
  }

  if (aparelho === 'android') {
    return (
      <div className="cn-acoes cn-acoes--celular" data-lugar={lugar}>
        <BotaoAndroid apk={apk} aoBaixar={aoBaixar} baixando={baixando} />
        {textoVisitante('texto')}
        <p className="cn-apoio" id={`cn-apoio-${lugar}`}>{textos.acoes.android.apoio(tamanho)}</p>
        {comoInstalar && <p className="cn-apoio cn-apoio--instalar" role="status">{textos.acoes.android.comoInstalar}</p>}
      </div>
    );
  }

  // iPhone e iPad. O app nativo é só de iPhone (supportsTablet: false): no iPad, o caminho é sempre a Tela de Início pelo Safari, em tela cheia, também com o TestFlight.
  const ipad = aparelho === 'ipad';
  const testflightAqui = ipad ? null : testflight;
  const telaDeInicio = ipad ? textos.acoes.ipad : textos.acoes.iphoneEmBreve;
  return (
    <div className="cn-acoes cn-acoes--celular" data-lugar={lugar}>
      {testflightAqui ? (
        <a className="botao botao--primario cn-botao-principal" href={testflightAqui} aria-label={textos.acoes.iphoneTestflight.rotuloLeitor}>
          <IconeBaixar />{textos.acoes.iphoneTestflight.rotulo}
        </a>
      ) : (
        <button type="button" className="botao botao--primario cn-botao-principal" aria-haspopup="dialog" aria-label={telaDeInicio.rotuloLeitor} onClick={abrirFolha}>
          <IconeCelular />{telaDeInicio.rotulo}
        </button>
      )}
      {textoVisitante('texto')}
      <p className="cn-apoio">{testflightAqui ? textos.acoes.iphoneTestflight.apoio : telaDeInicio.apoio}</p>
      {folha && <FolhaIphone aoFechar={fecharFolha} appParaInstalar={appParaInstalar} ipad={ipad} />}
    </div>
  );
}

type Aba = 'android' | 'iphone';

/**
 * S4, "Instale em 3 passos": um seletor de duas abas (grupo de abas acessível, com setas, Home e End), que abre no aparelho de quem
 * está vendo (no computador, em Android). `#iphone` abre a aba do iPhone e `#android` a do Android. `#baixar` abre a do aparelho (é para onde o
 * `/baixar` manda). Android: os três passos e o botão (ou, no computador, o cartão do QR no lugar do botão). iPhone: com TestFlight, os
 * três passos dele e "Instalar no iPhone"; sem convite, as instruções para adicionar o app à Tela de Início.
 */
export function SecaoInstalar({ aparelho: inicial, apk, testflight, tamanho, appParaInstalar, qr, qrIphone = qr }: DadosDeInstalar & { qr: ReactNode | null; /** O cartão do QR da aba do iPhone (o mesmo, sem o link do arquivo do Android). */ qrIphone?: ReactNode | null }) {
  const aparelho = useAparelho(inicial);
  const { baixando, comoInstalar, aoBaixar } = useBaixando();
  const [aba, setAba] = useState<Aba>(ehIos(inicial) ? 'iphone' : 'android');
  const abas: Aba[] = ['android', 'iphone'];
  const botoes = useRef<Record<Aba, HTMLButtonElement | null>>({ android: null, iphone: null });

  const rolarParaIphone = useRef(false);
  useEffect(() => {
    if (aba === 'iphone' && rolarParaIphone.current) {
      rolarParaIphone.current = false;
      document.getElementById('iphone')?.scrollIntoView({ block: 'start' });
    }
  }, [aba]);
  useEffect(() => {
    const ler = () => {
      const hash = window.location.hash;
      if (hash !== '#baixar' && hash !== '#iphone' && hash !== '#android') return false;
      const alvo = hash === '#iphone' || (hash === '#baixar' && ehIos(aparelho)) ? 'iphone' : 'android';
      if (hash === '#iphone') rolarParaIphone.current = true;
      setAba(alvo);
      return true;
    };
    const temHash = ler();
    if (!temHash && ehIos(aparelho)) setAba('iphone');
    window.addEventListener('hashchange', ler);
    return () => window.removeEventListener('hashchange', ler);
  }, [aparelho]);

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>) {
    const indice = abas.indexOf(aba);
    const proximo = evento.key === 'ArrowRight' ? abas[(indice + 1) % abas.length]
      : evento.key === 'ArrowLeft' ? abas[(indice + abas.length - 1) % abas.length]
        : evento.key === 'Home' ? abas[0] : evento.key === 'End' ? abas[abas.length - 1] : null;
    if (!proximo) return;
    evento.preventDefault();
    setAba(proximo);
    botoes.current[proximo]?.focus();
  }

  const s4 = textos.s4;
  // Quem está num iPad vê a aba "iPad" com os passos da Tela de Início, mesmo com o TestFlight (o app nativo é só de iPhone).
  const testflightNoPainel = aparelho === 'ipad' ? null : testflight;
  const comQr = aparelho === 'computador' && qr;
  const comQrNoIphone = aparelho === 'computador' && qrIphone;
  return (
    <>
      <div className="cn-abas" role="tablist" aria-label={s4.abas}>
        {abas.map((id) => (
          <button key={id} type="button" role="tab" id={`cn-aba-${id}`} aria-selected={aba === id} aria-controls={`cn-painel-${id}`} tabIndex={aba === id ? 0 : -1}
            ref={(el) => { botoes.current[id] = el; }} className="cn-aba" onClick={() => setAba(id)} onKeyDown={aoTeclar}>
            {id === 'android' ? s4.android.aba : aparelho === 'ipad' ? s4.ipad.aba : s4.iphone.aba}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="cn-painel-android" aria-labelledby="cn-aba-android" hidden={aba !== 'android'} className="cn-painel" tabIndex={0}>
        <Passos itens={comQr ? s4.android.passosNoComputador : s4.android.passos} />
        {comQr ? <div className="cn-painel__qr">{qr}</div> : (
          <div className="cn-painel__acao">
            <BotaoAndroid apk={apk} aoBaixar={aoBaixar} baixando={baixando} />
            <p className="cn-apoio">{textos.acoes.android.apoio(tamanho)}</p>
            {comoInstalar && <p className="cn-apoio cn-apoio--instalar" role="status">{textos.acoes.android.comoInstalar}</p>}
          </div>
        )}
      </div>

      <div role="tabpanel" id="cn-painel-iphone" aria-labelledby="cn-aba-iphone" hidden={aba !== 'iphone'} className={`cn-painel${comQrNoIphone && !testflightNoPainel ? ' cn-painel--iphone-com-qr' : ''}`} tabIndex={0}>
        <span id="iphone" className="cn-ancora" aria-hidden="true" />
        {testflightNoPainel ? (
          <>
            <Passos itens={comQrNoIphone ? s4.iphone.testflightPassosNoComputador : s4.iphone.testflightPassos} />
            {comQrNoIphone ? <div className="cn-painel__qr">{qrIphone}</div> : (
              <div className="cn-painel__acao">
                <a className="botao botao--primario cn-botao-principal" href={testflightNoPainel} aria-label={textos.acoes.iphoneTestflight.rotuloLeitor}>
                  <IconeBaixar />{textos.acoes.iphoneTestflight.rotulo}
                </a>
                <p className="cn-apoio">{textos.acoes.iphoneTestflight.apoio}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {comQrNoIphone
              ? <Passos itens={s4.iphone.passosNoComputador} icones={[null, <IconeCompartilharIos key="c" />, <IconeConfirmarIos key="o" />]} />
              : <PassosDoIphone />}
            {comQrNoIphone && <div className="cn-painel__qr">{qrIphone}</div>}
            <p className="cn-apoio cn-apoio--painel">{aparelho === 'ipad' ? textos.acoes.ipad.apoio : textos.acoes.iphoneEmBreve.disponibilidade}</p>
            <div className="cn-painel__acao">
              <AbrirAppNoSafari href={appParaInstalar} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
