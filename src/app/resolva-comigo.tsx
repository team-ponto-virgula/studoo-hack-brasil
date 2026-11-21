'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { falarFormula, falarTextoComFormulas, formulaLinear, lerFormula, type EscolhaNoSuaVez, type LicaoDetalhe, type OpcaoDoSuaVez, type PassoDaResolucao, type Resolucao } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';
import { Botao, Icone, Stu } from '../ui';
import { CONTEXTO_DO_ENUNCIADO, DesenhoDoVisual, OPCOES_DA_FORMULA } from './desenho';
import { desenhoDoVisual, temProcurado } from './desenho-svg';
import {
  acaoDoRodape, aplicarResposta, avancar, comecarResolva, contextoDoPasso, formulaDoMetodo, noSuaVez, resolucaoUtil, respostaValida,
  tentarDeNovo, visualDoPasso, voltar, type EstadoResolva,
} from './resolva-comigo-regras';
import { tocaSons } from './sons';
import { TextoComFormulas } from './texto-com-formulas';

/*
 * "Resolva comigo" (spec 15, seção 4), a forma da etapa Exemplo quando a lição traz `resolucao` (não é etapa nova). A mesma tela do app
 * (`apps/mobile/src/resolva-comigo.tsx`) e as mesmas regras (`resolva-comigo-regras.ts`, o mesmo arquivo dos dois lados): os passos vêm um a
 * um, os feitos ficam compactos em cima, o rodapé preso leva ao próximo, e o "Sua vez" pergunta ao servidor; antes da escolha, a web não tem a
 * resposta. Sem rede no "Sua vez" (ou com uma resposta que não serve), o exemplo segue em texto, sem travar a pessoa.
 * O que a web faz por ser página e não tela de celular: o foco vai para a frase do passo e o passo novo rola até ficar acima do rodapé,
 * o grupo de opções é um `fieldset` (teclado e leitor de tela nativos) e as teclas A a C escolhem e Enter verifica, como nos exercícios.
 */

const t = mensagens.resolvaComigo;
const LETRAS = ['A', 'B', 'C'] as const;

/** A fórmula em texto linear (opção do "Sua vez") e o texto falado dela; `null` quando não se lê. */
function formulaEmTexto(latex: string | undefined): { texto: string; falado: string } | null {
  if (!latex) return null;
  const lida = lerFormula(latex);
  return lida.ok ? { texto: formulaLinear(lida.arvore), falado: falarFormula(lida.arvore) } : null;
}

/** A opção do "Sua vez" como texto com fórmula em linha: a fórmula da opção vai marcada (`$…$`) e o motor a desenha. */
export function textoDaOpcao(opcao: OpcaoDoSuaVez): string {
  if (opcao.texto) return opcao.texto;
  return opcao.formula && formulaEmTexto(opcao.formula) ? `$${opcao.formula}$` : '';
}

function FormulaEmBloco({ latex, testID }: { latex: string | undefined; testID?: string }) {
  if (!latex) return null;
  return <DesenhoDoVisual visual={{ tipo: 'formula', latex }} contexto={CONTEXTO_DO_ENUNCIADO} opcoes={OPCOES_DA_FORMULA} testID={testID} entrada={false} />;
}

/** "Passo n de N" e N traços de 6: os feitos e o atual em azul, o atual mais largo (34). O anúncio do passo novo é de outra região (`role="status"`). */
export function Indicador({ atual, total }: { atual: number; total: number }) {
  return (
    <div className="resolva-indicador">
      <span className="resolva-indicador__texto" data-testid="resolva-indicador">{t.passo(atual + 1, total)}</span>
      <span className="resolva-tracos" aria-hidden="true">
        {Array.from({ length: total }, (_, posicao) => (
          <span key={posicao} className="resolva-traco" data-feito={posicao <= atual || undefined} data-atual={posicao === atual || undefined} />
        ))}
      </span>
    </div>
  );
}

/** Um passo feito, numa linha: o visto, o nome e a fórmula reduzida. Tocar reabre o passo ali mesmo. */
function LinhaFeita({ passo, numero }: { passo: PassoDaResolucao; numero: number }) {
  const [aberto, setAberto] = useState(false);
  const idDoPasso = useId();
  const formula = formulaEmTexto(passo.formula);
  return (
    <div className="resolva-feito">
      <button type="button" className="resolva-feito__linha" data-testid={`resolva-feito-${numero}`} aria-expanded={aberto} aria-controls={aberto ? idDoPasso : undefined}
        aria-label={`${passo.nome}${formula ? `: ${formula.falado}` : ''}`} onClick={() => setAberto((atual) => !atual)}>
        <Icone nome="check" />
        <span className="resolva-feito__nome">{passo.nome}</span>
        {/* A fórmula do passo, reduzida e desenhada (em peças se for larga): nunca o linear com `_` na tela (caso real cb532bb). */}
        {formula && !aberto && <TextoComFormulas texto={`$${passo.formula}$`} className="resolva-feito__formula" />}
      </button>
      {aberto && (
        <div id={idDoPasso} className="resolva-feito__aberto">
          <TextoComFormulas como="p" texto={passo.texto} />
          <FormulaEmBloco latex={passo.formula} />
        </div>
      )}
    </div>
  );
}

/** O cartão do retorno em voz alta: o porquê da opção errada, "Isso!" no acerto, o porquê da certa e a fórmula revelada, lida pela árvore. */
export function retornoFalado(estado: EstadoResolva, formulaRevelada: string | undefined): string {
  const { resposta, revelado } = estado;
  if (!resposta) return '';
  const partes: string[] = [];
  if (!resposta.correta) partes.push(falarTextoComFormulas(resposta.porque));
  if (revelado) {
    if (resposta.correta) partes.push(t.isso);
    partes.push(falarTextoComFormulas((resposta.correta ? resposta.porque : resposta.porqueDaCerta) ?? ''));
    const lida = formulaRevelada ? lerFormula(formulaRevelada) : null;
    if (lida?.ok) partes.push(falarFormula(lida.arvore));
  }
  return partes.filter(Boolean).map((parte) => parte.replace(/[.!?…]+$/u, '')).join('. ') + '.';
}

/** O "Sua vez": a pergunta e as três opções; depois da correção, o porquê (e, no acerto ou na segunda errada, a revelação). */
export function SuaVez({ passo, estado, ocupado, escolher, grupo, retorno }: {
  passo: PassoDaResolucao; estado: EstadoResolva; ocupado: boolean; escolher: (opcao: number) => void; grupo?: Ref<HTMLFieldSetElement>;
  /** O cartão do retorno: o foco vai para ele depois de "Verificar", e o leitor de tela lê o cartão inteiro. */
  retorno?: Ref<HTMLDivElement>;
}) {
  const idDaPergunta = useId();
  const tentativa = passo.tentativa;
  if (!tentativa) return null;
  const { resposta, corrigida, revelado } = estado;
  const retornoDa = (opcao: number): 'certa' | 'errada' | undefined => {
    if (!resposta || corrigida === null) return undefined;
    if (opcao === corrigida) return resposta.correta ? 'certa' : 'errada';
    if (revelado && resposta.certa === opcao) return 'certa';
    return undefined;
  };
  const travado = ocupado || revelado || (resposta !== null && estado.escolha === corrigida);
  return (
    <div className="resolva-suavez">
      {/* Spec 15, seção 13: antes da escolha, nenhum bloco de fórmula no cartão; o contexto é a linha do passo feito logo acima. */}
      <span className="resolva-selo resolva-selo--sua-vez">{t.suaVez}</span>
      <TextoComFormulas como="p" id={idDaPergunta} texto={tentativa.pergunta} className="resolva-pergunta" data-testid="resolva-pergunta" />
      <fieldset ref={grupo} className="opcoes" role="radiogroup" aria-labelledby={idDaPergunta} disabled={travado} data-revelado={revelado || undefined}>
        {tentativa.opcoes.map((opcao, numero) => (
          <label key={numero} data-retorno={retornoDa(numero)}>
            <input type="radio" name="sua-vez" value={numero} checked={estado.escolha === numero} onChange={() => escolher(numero)} />
            <span className="opcao-tecla" aria-hidden="true">{LETRAS[numero]}</span>
            <TextoComFormulas texto={textoDaOpcao(opcao)} />
          </label>
        ))}
      </fieldset>
      {!travado && <p className="opcoes-atalho">{mensagens.licao.atalho(tentativa.opcoes.length)}</p>}
      {resposta && (
        // O cartão do retorno: o foco vem para cá depois de "Verificar" (`tabIndex`), e o nome dele é o cartão inteiro falado ("Isso!", o porquê e
        // a fórmula revelada), para o leitor de tela ler tudo de uma vez e o próximo elemento ser o botão do rodapé. Sem região educada: não fala duas vezes.
        <div ref={retorno} className="resolva-retorno" tabIndex={-1} role="group" aria-label={retornoFalado(estado, passo.formula)} data-testid="resolva-retorno">
          {!resposta.correta && (
            <div className="resolva-porque" data-testid="resolva-porque">
              <TextoComFormulas como="p" texto={resposta.porque} />
            </div>
          )}
          {revelado && (
            <div className="resolva-isso" data-testid="resolva-isso">
              {resposta.correta && <p className="resolva-isso__titulo">{t.isso}</p>}
              <TextoComFormulas como="p" className="resolva-isso__texto" texto={(resposta.correta ? resposta.porque : resposta.porqueDaCerta) ?? ''} />
              <FormulaEmBloco latex={passo.formula} testID="resolva-formula-revelada" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** O cartão do passo atual: o Stu, a frase e a fórmula (ou o "Sua vez"). Entra subindo 8 em 200 ms (na hora, sem movimento). */
function CartaoDoPasso({ passo, estado, ultimo, ocupado, escolher, frase, grupo, retorno }: {
  passo: PassoDaResolucao; estado: EstadoResolva; ultimo: boolean; ocupado: boolean; escolher: (opcao: number) => void;
  frase?: Ref<HTMLElement>; grupo?: Ref<HTMLFieldSetElement>; retorno?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="resolva-cartao" data-testid="resolva-passo">
      <div className="resolva-cartao__topo">
        <Stu expressao={ultimo ? 'stu-animado' : 'stu-concentrado'} tamanho={40} />
        <TextoComFormulas como="p" ref={frase} tabIndex={-1} texto={passo.texto} className="resolva-frase" data-testid="resolva-frase" />
      </div>
      {passo.tentativa ? <SuaVez passo={passo} estado={estado} ocupado={ocupado} escolher={escolher} grupo={grupo} retorno={retorno} />
        : <FormulaEmBloco latex={passo.formula} testID="resolva-formula" />}
    </div>
  );
}

/** "O método": os passos numa linha cada e a fórmula geral em bloco; no fim do exemplo e, depois dele, dentro do "Rever a explicação". */
export function CartaoMetodo({ passos, formula }: { passos: readonly PassoDaResolucao[]; formula: string | undefined }) {
  const idDoTitulo = useId();
  return (
    <section className="resolva-metodo" data-testid="resolva-metodo" aria-labelledby={idDoTitulo}>
      <h2 id={idDoTitulo} className="resolva-metodo__titulo">{t.metodo}</h2>
      {passos.map((passo, numero) => (
        <p key={numero} className="resolva-metodo__linha">{`${numero + 1}. ${passo.nome}`}</p>
      ))}
      <FormulaEmBloco latex={formula} testID="resolva-metodo-formula" />
    </section>
  );
}

/** O corpo do "Resolva comigo" para o estado dado: o problema, o desenho de cima, o indicador, os passos feitos e o cartão do passo atual. */
export function CorpoDoResolva({ resolucao, estado, formulaGeral, ocupado, escolher, voltarUmPasso, caixa, anuncio, titulo, frase, grupo, retorno }: {
  resolucao: Resolucao; estado: EstadoResolva;
  /** A fórmula geral da lição (primeira fórmula dos visuais), para o cartão "O método" do fim. */
  formulaGeral?: string;
  ocupado: boolean; escolher: (opcao: number) => void; voltarUmPasso: () => void;
  /** A altura da caixa do desenho de cima, em unidades do desenho (a figura do problema): o último passo se reenquadra nela. */
  caixa?: number;
  /** O texto que a região educada anuncia no passo novo ("Passo 2 de 4"). */
  anuncio?: string;
  titulo?: Ref<HTMLHeadingElement>; frase?: Ref<HTMLElement>; grupo?: Ref<HTMLFieldSetElement>; retorno?: Ref<HTMLDivElement>;
}) {
  const passo = estado.passos[estado.atual];
  const ultimo = estado.revelado && estado.atual === estado.total - 1;
  const visual = visualDoPasso(resolucao, estado);
  /** O último passo só revela (troca no lugar e ponto que cresce) quando o problema tem ponto procurado. */
  const revela = ultimo && temProcurado(resolucao.visual);
  return (
    <section className="resolva" data-testid="resolva-comigo" aria-labelledby="etapa-aula">
      <TextoComFormulas como="h1" id="etapa-aula" ref={titulo} tabIndex={-1} texto={resolucao.problema} className="resolva-problema" data-testid="resolva-problema" />
      {/* O desenho de cima troca no mesmo lugar quando o passo mexe nele; o procurado só vira resposta no último passo. */}
      {visual && (
        // No último passo, a figura revelada entra no lugar (200 ms) e o ponto resposta cresce depois; a chave nova remonta a figura.
        <DesenhoDoVisual key={revela ? 'revelado' : 'passos'} visual={visual} contexto={contextoDoPasso(estado)} testID="resolva-visual" entrada={revela} caixa={caixa} />
      )}
      <Indicador atual={estado.atual} total={estado.total} />
      {estado.passos.slice(0, estado.atual).map((feito, numero) => <LinhaFeita key={numero} passo={feito} numero={numero + 1} />)}
      {passo && <CartaoDoPasso key={estado.atual} passo={passo} estado={estado} ultimo={ultimo} ocupado={ocupado} escolher={escolher} frase={frase} grupo={grupo} retorno={retorno} />}
      {estado.atual > 0 && (
        <Botao variante="texto" className="resolva-voltar" data-testid="resolva-voltar" disabled={ocupado} onClick={voltarUmPasso}>{t.voltar}</Botao>
      )}
      {ultimo && <CartaoMetodo passos={estado.passos} formula={formulaGeral} />}
      {/* A região educada: "Passo n de N" (e, no último passo, a descrição do desenho revelado), dita no passo novo. */}
      <p className="somente-leitor" role="status" data-testid="resolva-anuncio">{anuncio}</p>
    </section>
  );
}

/** O botão do rodapé preso: "Próximo passo", "Verificar", "Tentar de novo" ou "Agora é com você". */
export function RodapeDoResolva({ estado, ocupado, verificar, proximo, tentar, terminar }: {
  estado: EstadoResolva; ocupado: boolean; verificar: () => void; proximo: () => void; tentar: () => void; terminar: () => void;
}) {
  const acao = acaoDoRodape(estado);
  if (acao === 'verificar') {
    return (
      // Conferindo, o botão fica afundado e "desligado" só para o leitor de tela (`aria-disabled`, sem `disabled`: com `disabled`, o foco que está nele
      // se perde), com o giro de 16 px na mesma linha e `aria-busy`. O nome acessível segue "Verificar": quem fala "Verificando…" é a região educada,
      // uma vez só (o rótulo que muda dentro de um botão com foco falaria duas).
      <Botao data-testid="resolva-verificar" disabled={estado.escolha === null} aria-disabled={ocupado || undefined} aria-busy={ocupado || undefined}
        aria-label={ocupado ? t.verificar : undefined} data-ocupado={ocupado || undefined} onClick={verificar}>
        {ocupado && <span className="botao__giro" aria-hidden="true" />}
        {ocupado ? mensagens.licao.avaliando : t.verificar}
      </Botao>
    );
  }
  if (acao === 'tentar') return <Botao data-testid="resolva-tentar" onClick={tentar}>{t.tentarDeNovo}</Botao>;
  if (acao === 'agora') return <Botao data-testid="resolva-agora" onClick={terminar}>{t.agora}<Icone nome="seta" /></Botao>;
  return <Botao data-testid="resolva-proximo" onClick={proximo}>{t.proximo}<Icone nome="seta" /></Botao>;
}

/**
 * O passo atual (o cartão) à vista, acima do rodapé preso e abaixo do topo: a página rola, e o passo novo nasce embaixo dos feitos. No último
 * passo, "O método" vem logo depois do cartão: a página sobe o quanto der para mostrar o cartão e o método juntos, sem tirar o começo do cartão
 * de baixo do topo (num celular, o método aparece inteiro ou quase; se não couber, o cartão manda).
 */
function mostrarOPasso() {
  const cartao = document.querySelector<HTMLElement>('.resolva-cartao');
  const rodape = document.querySelector<HTMLElement>('.aula-rodape');
  if (!cartao || !rodape) return;
  const topo = document.querySelector<HTMLElement>('.aula-topo')?.getBoundingClientRect().bottom ?? 0;
  const limite = window.innerHeight - rodape.getBoundingClientRect().height - 16;
  const caixa = cartao.getBoundingClientRect();
  const fim = (document.querySelector<HTMLElement>('.resolva-metodo') ?? cartao).getBoundingClientRect().bottom;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const comportamento = reduzido ? 'auto' : 'smooth';
  // Sobra por baixo: sobe o quanto falta, sem empurrar o começo do cartão para trás do topo (cartão maior que a janela: o começo fica à vista).
  if (fim > limite) window.scrollBy({ top: Math.max(0, Math.min(fim - limite, caixa.top - topo - 8)), behavior: comportamento });
  else if (caixa.top < topo) window.scrollBy({ top: caixa.top - topo - 8, behavior: comportamento });
}

/**
 * O "Resolva comigo" da etapa Exemplo: o corpo, o rodapé e "O método", para a lição montar no lugar do exemplo em texto. `ativo` é falso sem
 * resolução, sem como responder ou quando o "Sua vez" ficou sem rede (aí a lição mostra o exemplo em texto, como antes).
 */
export function useResolvaComigo({ licao, responder, aoTerminar, visivel, titulo }: {
  licao: LicaoDetalhe;
  responder?: (escolha: EscolhaNoSuaVez) => Promise<unknown>;
  aoTerminar: () => void;
  /** A etapa Exemplo está na tela (o anúncio e o foco do passo só valem nela). */
  visivel: boolean;
  /** O título da etapa (o problema), que recebe o foco quando a etapa abre. */
  titulo?: Ref<HTMLHeadingElement>;
}): { ativo: boolean; corpo: ReactNode; rodape: ReactNode; metodo: ReactNode } {
  const resolucao = resolucaoUtil(licao.resolucao) ? licao.resolucao : undefined;
  const [estado, setEstado] = useState<EstadoResolva | null>(() => (resolucao ? comecarResolva(resolucao) : null));
  const [ocupado, setOcupado] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const frase = useRef<HTMLElement | null>(null);
  const grupo = useRef<HTMLFieldSetElement | null>(null);
  const retorno = useRef<HTMLDivElement | null>(null);
  /** O passo que já foi anunciado: o anúncio e o foco só valem quando o passo muda (não na abertura, nem na remontagem do modo estrito). */
  const anunciado = useRef(estado?.atual ?? 0);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  /**
   * A caixa do desenho de cima: a altura da figura do problema (unidades do desenho). No último passo o gráfico se reenquadra com
   * o procurado (marco 2e) e fica nesta caixa: só a escala muda, e o resto não pula (spec 15, seção 12).
   */
  const caixa = useMemo(() => {
    if (!resolucao?.visual) return undefined;
    const desenho = desenhoDoVisual(resolucao.visual, { tipo: 'passo', ultimo: false });
    return desenho && !desenho.naoCabe ? desenho.altura : undefined;
  }, [resolucao?.visual]);

  // A cada passo novo, o foco vai para a frase do passo e a região educada anuncia "Passo n de N" (spec 15, leitor de tela).
  useEffect(() => {
    if (!estado || !visivel || anunciado.current === estado.atual) return;
    anunciado.current = estado.atual;
    // No último passo, a descrição do desenho revelado vai na mesma fala do anúncio (uma frase só).
    const noUltimo = estado.revelado && estado.atual === estado.total - 1;
    const revelado = noUltimo && resolucao && temProcurado(resolucao.visual) ? visualDoPasso(resolucao, estado) : undefined;
    const descricao = revelado ? desenhoDoVisual(revelado, contextoDoPasso(estado))?.descricao : undefined;
    setAnuncio(descricao ? `${t.passo(estado.atual + 1, estado.total)}. ${descricao}` : t.passo(estado.atual + 1, estado.total));
    const espera = window.setTimeout(() => frase.current?.focus({ preventScroll: true }), 250);
    return () => window.clearTimeout(espera);
  }, [estado?.atual, visivel]); // eslint-disable-line react-hooks/exhaustive-deps

  // O passo novo e o que a correção traz (o porquê, a revelação) ficam à vista, acima do rodapé preso. Na abertura, nada rola.
  const aMostrar = useRef(false);
  useEffect(() => {
    if (!estado || !visivel) return;
    if (!aMostrar.current) { aMostrar.current = true; return; }
    const espera = window.setTimeout(mostrarOPasso, 80);
    return () => window.clearTimeout(espera);
  }, [estado?.atual, estado?.resposta, estado?.revelado, visivel]); // eslint-disable-line react-hooks/exhaustive-deps

  const verificarAgora = useRef<() => void>(() => undefined);
  // Atalhos como nos exercícios de escolha: A a C (ou 1 a 3) marcam a opção, Enter verifica.
  useEffect(() => {
    if (!estado || !visivel || estado.emTexto || !noSuaVez(estado)) return;
    if (ocupado || estado.revelado || (estado.resposta !== null && estado.escolha === estado.corrigida)) return;
    const opcoes = estado.passos[estado.atual]?.tentativa?.opcoes.length ?? 0;
    const escolhida = estado.escolha;
    function teclas(evento: KeyboardEvent) {
      if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.repeat) return;
      const alvo = evento.target instanceof HTMLElement ? evento.target : null;
      if (alvo?.closest('button, a, textarea, input[type="text"]')) return;
      if (evento.key === 'Enter') {
        if (escolhida === null) return;
        evento.preventDefault();
        verificarAgora.current();
        return;
      }
      const letra = evento.key.length === 1 ? evento.key.toLowerCase().charCodeAt(0) - 97 : -1;
      const numero = letra >= 0 && letra < 26 ? letra : Number.parseInt(evento.key, 10) - 1;
      if (numero >= 0 && numero < opcoes) {
        evento.preventDefault();
        void tocaSons.tocarEfeito('toque_opcao');
        setEstado((atual) => (atual ? { ...atual, escolha: numero } : atual));
      }
    }
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [estado, ocupado, visivel]);

  if (!resolucao || !estado || estado.emTexto || !responder) return { ativo: false, corpo: null, rodape: null, metodo: null };

  function escolher(opcao: number) {
    void tocaSons.tocarEfeito('toque_opcao');
    setEstado((atual) => (atual ? { ...atual, escolha: opcao } : atual));
  }

  async function verificar() {
    if (!estado || estado.escolha === null || ocupado || !responder) return;
    setOcupado(true);
    // "Verificando…" uma vez, pela região educada (o botão só gira).
    setAnuncio(mensagens.licao.avaliando);
    const somDoEnvio = tocaSons.sinalDosEfeitos;
    try {
      const corpo = await responder({ opcao: estado.escolha, tentativa: estado.tentativa });
      if (!respostaValida(corpo)) throw new Error('resposta');
      void tocaSons.tocarEfeito(corpo.correta ? 'acerto' : 'erro', somDoEnvio);
      setAnuncio('');
      setEstado((atual) => (atual ? aplicarResposta(atual, corpo) : atual));
      // O foco vai para o cartão do retorno ("Isso!" ou o porquê), que o leitor de tela lê inteiro; o próximo elemento é o botão do rodapé (que agora diz
      // "Tentar de novo" ou "Próximo passo"). Focar o botão direto cortaria o anúncio no VoiceOver e no TalkBack.
      window.requestAnimationFrame(() => retorno.current?.focus({ preventScroll: true }));
    } catch {
      // Sem rede (ou uma resposta que não serve): o exemplo segue em texto, e a lição continua.
      setAnuncio('');
      setEstado((atual) => (atual ? { ...atual, emTexto: true } : atual));
    } finally {
      if (montado.current) setOcupado(false);
    }
  }
  verificarAgora.current = () => void verificar();

  /** "Tentar de novo": a marca sai, a próxima escolha é a segunda e o foco volta para as opções (o botão do rodapé virou "Verificar", ainda desligado). */
  function tentar() {
    setEstado((atual) => (atual ? tentarDeNovo(atual) : atual));
    window.requestAnimationFrame(() => grupo.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true }));
  }

  const corpo = (
    <CorpoDoResolva resolucao={resolucao} estado={estado} formulaGeral={formulaDoMetodo(licao.visuais)} ocupado={ocupado} escolher={escolher}
      voltarUmPasso={() => setEstado((atual) => (atual ? voltar(atual) : atual))} caixa={caixa} anuncio={anuncio} titulo={titulo} frase={frase} grupo={grupo} retorno={retorno} />
  );
  const rodape = (
    <RodapeDoResolva estado={estado} ocupado={ocupado} verificar={() => void verificar()} tentar={tentar} terminar={aoTerminar}
      proximo={() => setEstado((atual) => (atual ? avancar(atual) : atual))} />
  );
  // No exercício, "Rever a explicação" abre também "O método" (depois que a pessoa viu a resolução inteira).
  const metodo = estado.revelado && estado.passos.length === estado.total ? <CartaoMetodo passos={estado.passos} formula={formulaDoMetodo(licao.visuais)} /> : null;
  return { ativo: true, corpo, rodape, metodo };
}
