'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ehIos, refinarAparelho, type Aparelho } from '../aparelho';
import { IconeBaixar, IconeCelular, IconeCompartilharIos, IconeConfirmarIos, IconeVisto } from '../icones';
import { textos } from '../textos';
import { Passos, PassosDoIphone } from './passos';
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
  /** O cartão do QR, já desenhado no servidor; null quando o servidor não tem origem pública confiável. */
  qr: ReactNode | null;
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
 * O que cada aparelho faz na primeira dobra e na chamada final (spec 18, 1.3 e S5). Android: baixa o APK. iPhone e iPad: o TestFlight,
 * quando há link público, e senão a folha "Use o Studoo no iPhone hoje". Computador: "Experimentar sem conta" é o botão principal
 * (nenhum botão principal baixa o arquivo, que não instala ali) e, ao lado, o cartão do QR; sem largura para o QR (menos de 1024 px),
 * um botão de texto leva ao S4. O servidor já escolhe o aparelho certo no primeiro desenho; o navegador só corrige o iPad.
 */
export function AcoesDeInstalar({ aparelho: inicial, apk, testflight, tamanho, visitanteAtivo, comSessao, qr, lugar }: DadosDeInstalar & { lugar: 'heroi' | 'final' }) {
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
        <div className="cn-acoes__linha">
          <div className="cn-acoes__botoes">
            {textoVisitante('primario')}
            <a className={`botao botao--texto cn-instalar-celular${lugar === 'heroi' && qr ? ' cn-instalar-celular--sem-qr' : ''}`} href="#baixar">{textos.acoes.computador.instalarNoCelular}</a>
            {lugar === 'heroi' && qr && <p className="cn-apoio cn-apoio--qr">{textos.acoes.computador.apoio}</p>}
          </div>
          {lugar === 'heroi' && qr}
        </div>
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

  // iPhone e iPad.
  return (
    <div className="cn-acoes cn-acoes--celular" data-lugar={lugar}>
      {testflight ? (
        <a className="botao botao--primario cn-botao-principal" href={testflight} aria-label={textos.acoes.iphoneTestflight.rotuloLeitor}>
          <IconeBaixar />{textos.acoes.iphoneTestflight.rotulo}
        </a>
      ) : (
        <button type="button" className="botao botao--primario cn-botao-principal" aria-haspopup="dialog" aria-label={textos.acoes.iphoneEmBreve.rotuloLeitor} onClick={abrirFolha}>
          <IconeCelular />{textos.acoes.iphoneEmBreve.rotulo}
        </button>
      )}
      {textoVisitante('texto')}
      <p className="cn-apoio">{testflight ? textos.acoes.iphoneTestflight.apoio : textos.acoes.iphoneEmBreve.apoio}</p>
      {folha && <FolhaIphone aoFechar={fecharFolha} visitanteAtivo={visitanteAtivo} comSessao={comSessao} />}
    </div>
  );
}

type Aba = 'android' | 'iphone';

/**
 * S4, "Instale em 3 passos": um seletor de duas abas (grupo de abas acessível, com setas, Home e End), que abre no aparelho de quem
 * está vendo (no computador, em Android). `#iphone` abre a aba do iPhone e `#baixar` ou `#android`, a do Android (é para onde o
 * `/baixar` manda). Android: os três passos e o botão (ou, no computador, o cartão do QR no lugar do botão). iPhone: com TestFlight, os
 * três passos dele e "Instalar no iPhone"; sem, os três da Tela de Início, "O app para iPhone chega em breve pelo TestFlight." e
 * "Experimentar sem conta".
 */
export function SecaoInstalar({ aparelho: inicial, apk, testflight, tamanho, visitanteAtivo, comSessao, qr, qrIphone = qr }: DadosDeInstalar & { /** O cartão do QR da aba do iPhone (o mesmo, sem o link do arquivo do Android). */ qrIphone?: ReactNode | null }) {
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
      const alvo = window.location.hash === '#iphone' ? 'iphone' : window.location.hash === '#baixar' || window.location.hash === '#android' ? 'android' : null;
      if (!alvo) return false;
      if (alvo === 'iphone') rolarParaIphone.current = true;
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
  const comQr = aparelho === 'computador' && qr;
  const comQrNoIphone = aparelho === 'computador' && qrIphone;
  return (
    <>
      <div className="cn-abas" role="tablist" aria-label={s4.abas}>
        {abas.map((id) => (
          <button key={id} type="button" role="tab" id={`cn-aba-${id}`} aria-selected={aba === id} aria-controls={`cn-painel-${id}`} tabIndex={aba === id ? 0 : -1}
            ref={(el) => { botoes.current[id] = el; }} className="cn-aba" onClick={() => setAba(id)} onKeyDown={aoTeclar}>
            {id === 'android' ? s4.android.aba : s4.iphone.aba}
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

      <div role="tabpanel" id="cn-painel-iphone" aria-labelledby="cn-aba-iphone" hidden={aba !== 'iphone'} className="cn-painel" tabIndex={0}>
        <span id="iphone" className="cn-ancora" aria-hidden="true" />
        {testflight ? (
          <>
            <Passos itens={comQrNoIphone ? s4.iphone.testflightPassosNoComputador : s4.iphone.testflightPassos} />
            {comQrNoIphone ? <div className="cn-painel__qr">{qrIphone}</div> : (
              <div className="cn-painel__acao">
                <a className="botao botao--primario cn-botao-principal" href={testflight} aria-label={textos.acoes.iphoneTestflight.rotuloLeitor}>
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
            <p className="cn-apoio cn-apoio--painel">{textos.acoes.iphoneEmBreve.apoio}</p>
            <div className="cn-painel__acao">
              <BotaoVisitante ativo={visitanteAtivo} comSessao={comSessao} variante="primario" className="cn-botao-principal" />
            </div>
          </>
        )}
      </div>
    </>
  );
}
