'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Mascote } from '../../../ui/mascote';
import { coresMundo } from '../../../ui/mundo-desenhos';
import { STU_DA_PAGINA } from '../stu.gerado';
import { textos } from '../textos';

const t = textos.ponte;
type Resposta = (typeof t.respostas)[number];
const perfil = STU_DA_PAGINA['stu-perfil'];

/** O estado do lago: sem tábuas, com a ponte montada (a pessoa errou e viu o outro jeito) ou atravessada (acertou depois dela). */
export type EstadoDaPonte = 'vazia' | 'montada' | 'atravessada';
export const estadoDaPonte = (ponte: boolean, acertou: boolean): EstadoDaPonte => (!ponte ? 'vazia' : acertou ? 'atravessada' : 'montada');

/**
 * Parada 2: uma questão de verdade para resolver, e o que o Studoo faz com o erro. A resposta errada não tira nada: o Stu dá a pista daquele erro e
 * monta a ponte, três tábuas com a mesma ideia por outro caminho, e a pessoa tenta de novo (o reforço do app, "Outro jeito de entender"). Quem acerta
 * de primeira pode ver a ponte mesmo assim. O lago ao lado é só o desenho do que o cartão diz (fora do leitor de tela): as tábuas caem no lugar e o
 * Stu atravessa; a fala dele, embaixo, acompanha. A resposta e as pistas ficam apenas nesta página.
 */
export function PonteViva({ stu, fala, enfeites }: {
  /** O Stu da parada, embaixo do lago. */
  stu: ReactNode;
  /** O que ele diz antes de a pessoa responder; depois, a fala acompanha a ponte. */
  fala: string;
  /**
   * Os desenhos do mundo em volta do lago (barco, árvore…). Vêm prontos do servidor: importar `ui/mundo` aqui levava a folha de estilos dele para o
   * pedaço desta ilha, e o build com webpack a pedia como script (erro no console e os desenhos sem tamanho).
   */
  enfeites: ReactNode;
}) {
  const [escolhida, setEscolhida] = useState<Resposta | null>(null);
  const [ponte, setPonte] = useState(false);
  const primeira = useRef<HTMLButtonElement>(null);
  const acertou = escolhida?.fracao === t.certa;
  const resultado = escolhida ? (acertou ? 'acerto' : 'pista') : undefined;
  const estado = estadoDaPonte(ponte, acertou);

  function escolher(opcao: Resposta) {
    if (acertou) return;
    setEscolhida(opcao);
    if (opcao.fracao !== t.certa) setPonte(true);
  }

  return (
    <div className="cn-ponte" data-ponte={estado}>
      <div className="cn-questao" data-revelar>
        <p className="cn-selo">{t.selo}</p>
        <h3 id="cn-pergunta">{t.pergunta}</h3>
        <div className="cn-fracao" role="img" aria-label={t.figura}>
          {Array.from({ length: 8 }, (_, i) => <span key={i} data-pintada={i < 3 || undefined} />)}
        </div>
        <div className="cn-respostas" role="group" aria-labelledby="cn-pergunta">
          {t.respostas.map((opcao, i) => (
            <button key={opcao.fracao} ref={i === 0 ? primeira : undefined} type="button"
              aria-label={`${opcao.fracao}, ${opcao.nome}`} aria-pressed={escolhida === opcao} aria-disabled={acertou || undefined}
              data-resultado={escolhida === opcao ? resultado : undefined}
              onClick={() => escolher(opcao)}>{opcao.fracao}</button>
          ))}
        </div>
        <div className="cn-retorno" role="status" aria-atomic="true" data-resultado={resultado}>
          {escolhida && <Mascote key={resultado} expressao={acertou ? 'stu-comemorando' : 'stu-encorajador'} tamanho={48} className="cn-retorno__stu" />}
          <p>
            {escolhida
              ? <><strong>{acertou ? t.acerto : t.pista}</strong>{escolhida.pista}{!acertou && <span className="somente-leitor"> {t.vejaAPonte}</span>}{acertou && !ponte && <> {t.dePrimeira}</>}</>
              : t.escolha}
          </p>
        </div>
        {ponte && (
          <div className="cn-tabuas" role="group" aria-labelledby="cn-tabuas-titulo">
            <p className="cn-tabuas__titulo" id="cn-tabuas-titulo">{t.outroJeito}</p>
            <ol className="cn-tabuas__lista">
              {t.passos.map((passo, i) => (
                <li key={passo} style={{ '--i': i } as CSSProperties}><span className="cn-tabuas__numero" aria-hidden="true">{i + 1}</span>{passo}</li>
              ))}
            </ol>
            <p className="cn-tabuas__volta">{acertou ? t.atravessou : t.tenteDeNovo}</p>
          </div>
        )}
        {acertou && (
          <div className="cn-questao__fim">
            {!ponte && <button type="button" className="cn-questao__ponte" onClick={() => setPonte(true)}>{t.verPonte}</button>}
            <a href="#assuntos">{t.seguir} <span aria-hidden="true">↓</span></a>
            <button type="button" onClick={() => { setEscolhida(null); setPonte(false); primeira.current?.focus(); }}>{t.refazer}</button>
          </div>
        )}
        <noscript><details><summary>{t.semScript.resumo}</summary>{t.semScript.texto}</details></noscript>
      </div>

      <div className="cn-ponte__lado">
      <div className="cn-lago" aria-hidden="true">
        <svg className="cn-lago__chao" viewBox="0 0 480 300" preserveAspectRatio="xMidYMid slice" focusable="false">
          <rect width="480" height="300" fill={coresMundo.campo} />
          <ellipse cx="60" cy="64" rx="92" ry="44" fill={coresMundo.campoRelevo} />
          <ellipse cx="430" cy="270" rx="110" ry="46" fill={coresMundo.campoRelevo} />
          <path d="M168 0C148 62 190 108 172 160S150 248 178 300H306C330 242 294 192 312 140S334 60 302 0Z" fill={coresMundo.agua} />
          <path d="M196 44h30M246 82h36M204 262h34M258 136h26M214 118h20" stroke={coresMundo.aguaClara} strokeWidth="7" strokeLinecap="round" />
          <path d="M22 214H160M320 214H458" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeDasharray="1 19" />
          {[0, 1, 2].map((i) => (
            <g key={i} className="cn-lago__vao" style={{ '--i': i } as CSSProperties}>
              <rect className="cn-lago__encaixe" x={174 + i * 46} y="190" width="40" height="48" rx="9" />
              <g className="cn-lago__tabua">
                <rect x={174 + i * 46} y="194" width="40" height="48" rx="9" fill="#6b4424" />
                <rect x={174 + i * 46} y="190" width="40" height="46" rx="9" fill="#8a5d3c" />
                <rect x={180 + i * 46} y="197" width="28" height="5" rx="2.5" fill={coresMundo.troncoClaro} opacity="0.55" />
                <text x={194 + i * 46} y="225" textAnchor="middle">{i + 1}</text>
              </g>
            </g>
          ))}
        </svg>
        {enfeites}
        <span className="cn-lago__placa cn-lago__placa--travou">{t.ondeTravou}</span>
        <span className="cn-lago__placa cn-lago__placa--exercicio">{t.exercicio}</span>
        <span className="cn-lago__stu">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={perfil.fontes[0].src} srcSet={perfil.fontes.map((fonte) => `${fonte.src} ${fonte.largura}w`).join(', ')} sizes="(min-width: 900px) 76px, 56px"
            width={perfil.largura} height={perfil.altura} alt="" loading="lazy" decoding="async" draggable={false} />
        </span>
      </div>
      <div className="cn-anfitriao cn-anfitriao--lado" data-revelar>
        {stu}
        <p className="cn-fala"><span className="somente-leitor">{textos.falaDoStu}</span>{estado === 'vazia' ? fala : t.falas[estado]}</p>
      </div>
      </div>
    </div>
  );
}
