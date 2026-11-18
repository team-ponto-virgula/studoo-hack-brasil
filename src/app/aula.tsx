'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type Ref, type SyntheticEvent } from 'react';
import {
  AUTOAVALIACOES,
  acertouParte,
  codificarResposta,
  conferirFala,
  embaralharExercicio,
  etapasDaLicao,
  faltaParaVerificar,
  exerciciosDaLicao,
  linhasDePassos,
  motivoParaRever,
  origemLegivel,
  respostaParaTentarDeNovo,
  tamanhoDaResposta,
  partesDaLacuna,
  respostaCompleta,
  semAspas,
  ultimoExercicio,
  sintetizarAcorde,
  sintetizarBatida,
  type AutoAvaliacao,
  type Avaliacao,
  type ConferenciaDaFala,
  type EtapaAula,
  type ExercicioPublico,
  type Fala,
  type LicaoDetalhe,
  type Opcao,
  type Pratica,
  type Recurso,
  type TipoTrecho,
} from '@studoo/contratos';
import { mensagens, textoDaFalta } from '../mensagens/pt-BR';
import { Botao, Confete, Icone, Stu, type NomeIcone } from '../ui';
import { ApoioDaLicao } from './estudio';

const t = mensagens.licao;

/** Quantas vezes uma aula montou: separa a saída de verdade da remontagem do modo estrito do React. */
let montagensDaAula = 0;

/**
 * O que a pessoa fez na lição, para o resumo da conclusão: `acertos` de `exercicios` (quem segue com um erro termina com
 * menos acertos) e `rever` quando ficou exercício sem acerto ou a prática em "ainda não".
 */
export type ResumoLicao = {
  segundos: number;
  tentativas: number;
  dePrimeira: boolean;
  etapas: number;
  acertos: number;
  /** Exercícios acertados na primeira tentativa: o placar da conclusão. */
  acertosDePrimeira: number;
  exercicios: number;
  pratica?: AutoAvaliacao;
  rever: boolean;
  ponteConstruida?: boolean;
  ensinouStu?: boolean;
};

/** O andamento de uma lição, guardado no navegador para a pessoa continuar de onde parou. */
type Andamento = {
  passo: number;
  respostas: string[];
  avaliacoes: (Avaliacao | null)[];
  primeiras: (boolean | null)[];
  tentativas: number;
  comprovante: string | null;
  autoAvaliacao: AutoAvaliacao | null;
  revisao: number[] | null;
  /** Segundos já estudados nesta lição, para o tempo do resumo seguir de onde parou. */
  segundos?: number;
  /** O que faltava no cronômetro da prática, para ele seguir de onde parou. */
  praticaRestante?: number;
  /** Pontes concluídas por índice de exercício, preservadas entre recarregamentos. */
  pontes?: Record<number, boolean>;
  /** Se a pessoa já enviou o "Explique com suas palavras" nesta lição. */
  ensinou?: boolean;
};
const chaveDoAndamento = (id: string) => `studoo.aula.${id}`;

/** Se a lição foi começada e tem andamento guardado neste navegador (menos de um dia): o mapa diz Continuar. */
export function temAndamento(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const salvo = JSON.parse(window.localStorage.getItem(chaveDoAndamento(id)) ?? 'null') as { salvoEm?: number; passo?: number } | null;
    return Boolean(salvo && (salvo.passo ?? 0) > 0 && Date.now() - (salvo.salvoEm ?? 0) < 86_400_000);
  } catch {
    return false;
  }
}

/** Se alguma lição desta trilha foi começada neste navegador (menos de um dia): o cartão da trilha diz Continuar. */
export function temAndamentoNoPlano(planoId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const salvo = Number(window.localStorage.getItem(`studoo.plano.${planoId}`) ?? 0);
    return salvo > 0 && Date.now() - salvo < 86_400_000;
  } catch {
    return false;
  }
}

/** O andamento guardado desta lição, se ainda servir (mesmo número de etapas e exercícios, menos de um dia). */
function lerAndamento(licao: LicaoDetalhe, etapas: number, exercicios: number): Andamento | null {
  if (licao.concluida || typeof window === 'undefined') return null;
  try {
    const salvo = JSON.parse(window.localStorage.getItem(chaveDoAndamento(licao.id)) ?? 'null') as (Andamento & { salvoEm: number }) | null;
    if (!salvo || Date.now() - salvo.salvoEm > 86_400_000 || salvo.passo <= 0 || salvo.passo >= etapas) return null;
    if ([salvo.respostas, salvo.avaliacoes, salvo.primeiras].some((lista) => !Array.isArray(lista) || lista.length !== exercicios)) return null;
    return salvo;
  } catch {
    return null;
  }
}

function guardarAndamento(id: string, andamento: Andamento | null) {
  try {
    if (andamento) window.localStorage.setItem(chaveDoAndamento(id), JSON.stringify({ ...andamento, salvoEm: Date.now() }));
    else window.localStorage.removeItem(chaveDoAndamento(id));
  } catch {
    // Sem armazenamento (janela privada): a lição só não continua de onde parou.
  }
}

const iconesDaEtapa: Record<EtapaAula['tipo'], NomeIcone> = { conceito: 'livro', exemplo: 'lampada', exercicio: 'alvo', pratica: 'relogio' };

/** O título sem quebra no meio de uma palavra com hífen (“check-” numa linha e “in” na outra). */
function semQuebrarHifen(texto: string): ReactNode {
  const partes = texto.split(/(\S*\p{L}-\p{L}\S*)/u);
  return partes.length === 1 ? texto : partes.map((parte, indice) => (indice % 2 ? <span key={indice} className="sem-quebra">{parte}</span> : parte));
}

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo). */
function tituloDoAcerto(id: string) {
  let soma = 0;
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) >>> 0;
  return t.certas[soma % t.certas.length];
}

/** Minutos e segundos, como 1:05. */
export function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Aula por etapas (spec 02), com o número de etapas de cada lição: conceito, exemplo (ou demonstração, com recurso,
 * passos e frases para ouvir), de um a três exercícios de formatos variados e, quando a lição pede, a prática no mundo
 * real com cronômetro. A barra no topo mostra o andamento. Depois da resposta, o rodapé vira o painel de retorno, verde
 * no acerto (com confete) ou âmbar no erro (o exercício treme), e dá para tentar de novo. Continuar segue para a próxima
 * etapa; na última, registra a conclusão. O título de cada etapa e o do retorno recebem o foco.
 */
function respostaLegivel(exercicio: LicaoDetalhe['exercicio'], resposta: string): string {
  const limpa = resposta.trim();
  if (!limpa) return '';
  switch (exercicio.tipo) {
    case 'multipla_escolha':
      return exercicio.opcoes.find((o) => o.id === limpa)?.texto ?? '';
    case 'ordenar':
      return limpa
        .split(',')
        .map((id) => exercicio.itens.find((item) => item.id === id)?.texto)
        .filter(Boolean)
        .join(' · ');
    case 'associar':
      return limpa
        .split(',')
        .map((par) => {
          const [idE, idD] = par.split('=');
          const e = exercicio.esquerda.find((item) => item.id === idE)?.texto;
          const d = exercicio.direita.find((item) => item.id === idD)?.texto;
          return e && d ? `${e} → ${d}` : '';
        })
        .filter(Boolean)
        .join(' · ');
    case 'verdadeiro_falso': {
      const [valor = '', justId = ''] = limpa.split(':');
      const rotulo = valor === 'verdadeiro' ? t.verdadeiroFalso.verdadeiro : valor === 'falso' ? t.verdadeiroFalso.falso : '';
      const just = exercicio.justificativas.find((item) => item.id === justId)?.texto;
      return rotulo && just ? `${rotulo} · ${just}` : rotulo;
    }
    default:
      return limpa;
  }
}

export function Licao({ licao, pendente, avaliar, concluir, voltar }: {
  licao: LicaoDetalhe;
  pendente: string | null;
  avaliar: (resposta: string, indice: number) => Promise<Avaliacao | null>;
  concluir: (comprovante: string, resumo: ResumoLicao, pratica?: AutoAvaliacao) => Promise<boolean>;
  voltar: () => void;
}) {
  const etapas = useMemo(() => etapasDaLicao(licao), [licao]);
  // As opções mudam de ordem a cada visita: a certa não fica sempre no mesmo lugar e não dá para decorar a posição.
  const [semente] = useState(() => Math.floor(Math.random() * 2 ** 31));
  /** Cada revisão rápida embaralha de novo (antes, as opções voltavam na mesma ordem). */
  const [rodadaDeOpcoes, setRodadaDeOpcoes] = useState(0);
  const exercicios = useMemo(
    () => exerciciosDaLicao(licao).map((exercicio, numero) => embaralharExercicio(exercicio, semente + numero + rodadaDeOpcoes * 7919)),
    [licao, semente, rodadaDeOpcoes],
  );
  // Quem saiu no meio continua de onde parou (o andamento fica no navegador por um dia).
  const [retomada] = useState(() => lerAndamento(licao, etapas.length, exercicios.length));
  const [passo, setPasso] = useState(retomada?.passo ?? 0);
  const [respostas, setRespostas] = useState<string[]>(() => retomada?.respostas ?? exercicios.map(() => ''));
  const [avaliacoes, setAvaliacoes] = useState<(Avaliacao | null)[]>(() => retomada?.avaliacoes ?? exercicios.map(() => null));
  const [primeiras, setPrimeiras] = useState<(boolean | null)[]>(() => retomada?.primeiras ?? exercicios.map(() => null));
  const [tentativas, setTentativas] = useState(retomada?.tentativas ?? 0);
  const [comprovante, setComprovante] = useState<string | null>(retomada?.comprovante ?? null);
  const [autoAvaliacao, setAutoAvaliacao] = useState<AutoAvaliacao | null>(retomada?.autoAvaliacao ?? null);
  /** Revisão antes de concluir: os exercícios que ficaram sem acerto voltam uma vez, nesta ordem. */
  const [revisao, setRevisao] = useState<number[] | null>(retomada?.revisao ?? null);
  const [avisoRetomada, setAvisoRetomada] = useState(retomada !== null);
  /** A última correção errada de cada exercício: a dica fica à vista embaixo do campo na nova tentativa. */
  const [errosAnteriores, setErrosAnteriores] = useState<(Avaliacao | null)[]>(() => exercicios.map(() => null));
  const [pedidoPonte, setPedidoPonte] = useState(0);
  /** O reforço deste exercício foi feito: o painel troca o "Quase lá!" pelo convite a tentar de novo. */
  const [ponteFeita, setPonteFeita] = useState(false);
  /** Pontes concluídas por índice de exercício (a fala do Stu e a história na conclusão usam). */
  const [pontesPorExercicio, setPontesPorExercicio] = useState<Record<number, boolean>>(() => retomada?.pontes ?? {});
  /** Índice da citação aberta na etapa de conceito (0 por padrão quando há referências do material). */
  const [citacaoAberta, setCitacaoAberta] = useState<number | null>(() => (licao.referencias?.length ? 0 : null));
  /** Nas etapas de leitura: ainda tem conteúdo escondido atrás do rodapé (o botão diz "Continuar lendo"). */
  const [temMais, setTemMais] = useState(false);
  const [inicio] = useState(() => Date.now() - (retomada?.segundos ?? 0) * 1000);
  /** Cada "Praticar mais um pouco" recomeça o cronômetro da prática. */
  const [voltasPratica, setVoltasPratica] = useState(0);
  /** O que falta no cronômetro da prática (guardado no andamento ao sair). */
  const praticaRestante = useRef<number | undefined>(retomada?.praticaRestante);
  /** Quantos exercícios a revisão rápida trouxe de volta, para o contador "Revisão 1 de 2". */
  const [revisaoTotal, setRevisaoTotal] = useState(retomada?.revisao?.length ?? 0);
  /** O "Explique com suas palavras" já foi enviado: o convite no acerto do último exercício sai. */
  const [ensinou, setEnsinou] = useState(() => retomada?.ensinou ?? false);
  /** O "Explique com suas palavras" está aberto: o rodapé fica só com as ações. */
  const [expliqueAberto, setExpliqueAberto] = useState(false);
  const [confirmandoRecomeco, setConfirmandoRecomeco] = useState(false);
  const tituloEtapa = useRef<HTMLHeadingElement>(null);
  const tituloRetorno = useRef<HTMLHeadingElement>(null);
  const cartaoCitacaoRef = useRef<HTMLElement>(null);
  /** Onde a pessoa estava em cada etapa ao sair dela: a "Etapa anterior" volta para lá, sem rolar tudo de novo. */
  const posicoesDasEtapas = useRef<Record<number, number>>({});
  const voltandoEtapa = useRef(false);
  const formulario = useRef<HTMLFormElement>(null);
  const continuarAgora = useRef<() => void>(() => undefined);
  const sairAgora = useRef<(peloVoltar?: boolean) => boolean>(() => false);

  const etapa = etapas[passo];
  const indice = etapa.tipo === 'exercicio' ? etapa.indice : -1;
  const exercicio = indice >= 0 ? exercicios[indice] : null;
  const resposta = indice >= 0 ? respostas[indice] : '';
  const avaliacao = indice >= 0 ? avaliacoes[indice] : null;
  const ocupado = pendente !== null;
  const total = etapas.length;
  const ultima = passo === total - 1;
  // O último exercício é o único sem acerto: pular leva direto à revisão rápida, com ele mesmo.
  const soEsteFalta = ultima && exercicios.every((_, numero) => numero === indice || avaliacoes[numero]?.correta);
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : undefined;
  // Na revisão, o contador de etapas voltaria para trás: o topo diz "Revisão rápida" e a barra fica cheia.
  const andamento = revisao && exercicio ? t.revisaoAndamento : t.posicao(passo + 1, total);
  let nomeEtapa: string = t.conceito;
  if (etapa.tipo === 'exemplo') nomeEtapa = licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo;
  else if (etapa.tipo === 'pratica') nomeEtapa = t.pratica.etapa;
  else if (etapa.tipo === 'exercicio') {
    // Na revisão, o contador é o da revisão ("Revisão 1 de 1"), não o dos exercícios da lição.
    nomeEtapa = revisao
      ? t.revisaoDe(Math.max(1, revisaoTotal - revisao.length + 1), Math.max(revisaoTotal, revisao.length))
      : exercicios.length > 1 ? t.exercicioDe(indice + 1, exercicios.length) : t.exercicio;
  }

  useEffect(() => {
    // Cada etapa começa do topo (também ao recomeçar), menos na volta pela "Etapa anterior", que reabre onde a pessoa
    // estava. O foco vai para o título (escondido, para o leitor de tela) sem rolar até ele.
    const destino = voltandoEtapa.current ? posicoesDasEtapas.current[passo] ?? 0 : 0;
    voltandoEtapa.current = false;
    window.scrollTo(0, destino);
    if (passo > 0) tituloEtapa.current?.focus({ preventScroll: true });
    // O reforço é de cada exercício: um pedido antigo não vale para o próximo.
    setPedidoPonte(0);
    setPonteFeita(false);
  }, [passo, revisao]);

  // Conceito e exemplo: se o fim do conteúdo (a legenda da ilustração, o passo a passo) está escondido atrás do rodapé,
  // o botão principal leva até ele antes de avançar. A tela parecia acabar ali, e a pessoa avançava sem ler.
  useEffect(() => {
    if (etapa.tipo !== 'conceito' && etapa.tipo !== 'exemplo') {
      setTemMais(false);
      return;
    }
    let chegouAoFim = false;
    const medir = () => {
      const miolo = document.querySelector<HTMLElement>('.aula-miolo');
      const rodape = document.querySelector<HTMLElement>('.aula-rodape');
      if (!miolo || !rodape || chegouAoFim) return;
      const falta = miolo.getBoundingClientRect().bottom - rodape.getBoundingClientRect().top > 24;
      if (!falta) chegouAoFim = true;
      setTemMais(falta);
    };
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    // A imagem e o diagrama mudam a altura quando carregam.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    const miolo = document.querySelector('.aula-miolo');
    if (miolo) observador?.observe(miolo);
    return () => {
      window.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      observador?.disconnect();
    };
  }, [passo, etapa.tipo]);

  // No exercício, com conteúdo escondido atrás do painel (o reforço, a consulta, o "Explique"), e na prática (o
  // cronômetro e o "Como foi?" ficam abaixo da tarefa), um aviso discreto leva até ele: nada mostrava que havia mais.
  const [temAbaixo, setTemAbaixo] = useState(false);
  useEffect(() => {
    if (etapa.tipo !== 'exercicio' && etapa.tipo !== 'pratica') {
      setTemAbaixo(false);
      return;
    }
    const medir = () => setTemAbaixo(document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) > 48);
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(document.body);
    return () => {
      window.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      observador?.disconnect();
    };
  }, [passo, etapa.tipo]);

  /** "Continuar lendo": rola mais um pedaço do conteúdo (o rodapé fica). */
  function lerMais() {
    const rodape = document.querySelector<HTMLElement>('.aula-rodape')?.getBoundingClientRect().height ?? 0;
    const topo = document.querySelector<HTMLElement>('.aula-topo')?.getBoundingClientRect().height ?? 0;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: Math.max(160, (window.innerHeight - rodape - topo) * 0.75), behavior: reduzido ? 'auto' : 'smooth' });
  }

  // O aviso de "continuou de onde parou" vale para a etapa em que a pessoa voltou; na seguinte, sai.
  useEffect(() => {
    if (retomada && passo !== retomada.passo) setAvisoRetomada(false);
  }, [passo, retomada]);

  // Guarda o andamento a cada passo; o começo intocado não precisa.
  useEffect(() => {
    if (licao.concluida) return;
    if (passo === 0 && tentativas === 0) return;
    try {
      window.localStorage.setItem(`studoo.plano.${licao.planoId}`, String(Date.now()));
    } catch {
      // Sem armazenamento: o cartão da trilha só não diz Continuar.
    }
    guardarAndamento(licao.id, {
      passo, respostas, avaliacoes, primeiras, tentativas, comprovante, autoAvaliacao, revisao,
      segundos: Math.round((Date.now() - inicio) / 1000),
      pontes: pontesPorExercicio,
      ensinou,
      ...(praticaRestante.current !== undefined ? { praticaRestante: praticaRestante.current } : {}),
    });
  }, [licao.id, licao.concluida, passo, respostas, avaliacoes, primeiras, tentativas, comprovante, autoAvaliacao, revisao, pontesPorExercicio, ensinou]);

  useEffect(() => {
    if (!avaliacao) return;
    tituloRetorno.current?.focus();
    // O painel de retorno cobre o pé da tela: rola até o fim do exercício (itens certos e errados, correção) ficar à vista.
    const quadro = window.requestAnimationFrame(() => {
      const exercicioNaTela = document.querySelector<HTMLElement>('.aula-quadro[data-etapa="exercicio"]');
      const rodape = document.querySelector<HTMLElement>('.aula-rodape');
      if (!exercicioNaTela || !rodape) return;
      const limite = window.innerHeight - rodape.getBoundingClientRect().height - 16;
      const sobra = exercicioNaTela.getBoundingClientRect().bottom - limite;
      const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (sobra > 0) window.scrollBy({ top: sobra, behavior: reduzido ? 'auto' : 'smooth' });
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [avaliacao]);

  // A voz para quando a pessoa sai da aula.
  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  // O voltar do navegador (ou do celular) faz o mesmo que o X: a aula ganha um passo no histórico, e voltar pede a
  // confirmação no meio da lição em vez de sair do Studoo e perder o que foi feito.
  useEffect(() => {
    montagensDaAula += 1;
    const montagem = montagensDaAula;
    const marca = { studooLicao: licao.id };
    const naMarca = () => (window.history.state as { studooLicao?: string } | null)?.studooLicao === licao.id;
    if (!naMarca()) window.history.pushState(marca, '');
    let saiuPeloVoltar = false;
    function aoVoltar(evento: PopStateEvent) {
      if ((evento.state as { studooLicao?: string } | null)?.studooLicao === licao.id) return;
      if (!sairAgora.current(true)) {
        window.history.pushState(marca, '');
        return;
      }
      saiuPeloVoltar = true;
    }
    window.addEventListener('popstate', aoVoltar);
    return () => {
      window.removeEventListener('popstate', aoVoltar);
      if (saiuPeloVoltar) return;
      // Saiu pelo X ou pela conclusão: tira o passo extra do histórico. Espera um instante, porque o modo estrito do
      // React desmonta e monta de novo na mesma hora (no desenvolvimento), e aí a aula continua aberta.
      window.setTimeout(() => {
        if (montagensDaAula === montagem && naMarca()) window.history.back();
      }, 0);
    };
  }, [licao.id]);

  // Atalhos: no exercício de escolha, 1, 2, 3… marcam a opção; depois do retorno, Enter continua.
  useEffect(() => {
    function teclas(evento: KeyboardEvent) {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const alvo = evento.target instanceof HTMLElement ? evento.target : null;
      if (alvo?.closest('.estudio-apoio')) return;
      if (avaliacao) {
        if (evento.key === 'Enter' && !alvo?.closest('button, a, textarea')) {
          evento.preventDefault();
          continuarAgora.current();
        }
        return;
      }
      if (evento.key === 'Enter' && !alvo?.closest('button, a, textarea') && exercicio && respostaCompleta(exercicio, resposta) && !ocupado) {
        evento.preventDefault();
        formulario.current?.requestSubmit();
        return;
      }
      if (exercicio?.tipo !== 'multipla_escolha' || alvo?.matches('input[type="text"], textarea')) return;
      // As alternativas têm letras (A, B, C); os números também valem, como antes.
      const letra = evento.key.length === 1 ? evento.key.toLowerCase().charCodeAt(0) - 97 : -1;
      const numero = letra >= 0 && letra < 26 ? letra : Number.parseInt(evento.key, 10) - 1;
      if (numero >= 0 && numero < exercicio.opcoes.length) {
        evento.preventDefault();
        mudarResposta(exercicio.opcoes[numero].id);
      }
    }
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  function mudarResposta(valor: string) {
    setRespostas((atuais) => atuais.map((atual, posicao) => (posicao === indice ? valor : atual)));
  }

  async function responder(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || !exercicio || avaliacao || !respostaCompleta(exercicio, resposta)) return;
    const resultado = await avaliar(resposta, indice);
    if (!resultado) return;
    setTentativas((soma) => soma + 1);
    setPrimeiras((atuais) => atuais.map((atual, posicao) => (posicao === indice ? atual ?? resultado.correta : atual)));
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? resultado : atual)));
    setComprovante(resultado.comprovante);
  }

  function tentarDeNovo() {
    setPedidoPonte(0);
    setPonteFeita(false);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? null : atual)));
    setErrosAnteriores((atuais) => atuais.map((atual, posicao) => (posicao === indice ? avaliacao : atual)));
    // Fica o que estava certo (na aberta, o texto todo); o resto recomeça.
    if (exercicio && avaliacao) mudarResposta(respostaParaTentarDeNovo(exercicio, resposta, avaliacao));
    window.requestAnimationFrame(() => {
      const campo = formulario.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button');
      campo?.focus();
      if (campo instanceof HTMLInputElement && campo.type === 'text') campo.select();
    });
  }

  /** A etapa de um exercício (pelo índice dele). */
  const etapaDoExercicio = (numero: number) => etapas.findIndex((item) => item.tipo === 'exercicio' && item.indice === numero);

  /** Volta aos exercícios sem acerto, limpando a resposta de cada um, para mais uma tentativa antes de concluir. */
  function revisar(pendentes: number[]) {
    setRodadaDeOpcoes((atual) => atual + 1);
    setRevisao(pendentes);
    setRevisaoTotal(pendentes.length);
    setErrosAnteriores((atuais) => atuais.map((atual, posicao) => (pendentes.includes(posicao) ? avaliacoes[posicao] ?? atual : atual)));
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (pendentes.includes(posicao) ? null : atual)));
    setRespostas((atuais) => atuais.map((atual, posicao) => {
      const anterior = avaliacoes[posicao];
      if (!pendentes.includes(posicao)) return atual;
      // Na revisão, a lacuna volta vazia (a dica da tentativa anterior mostra o que foi escrito): com o texto errado de
      // volta, parecia que o "Pular" não tinha feito nada.
      if (exercicios[posicao].tipo === 'lacuna') return '';
      return anterior ? respostaParaTentarDeNovo(exercicios[posicao], atual, anterior) : '';
    }));
    setPasso(etapaDoExercicio(pendentes[0]));
  }

  async function avancar() {
    if (ocupado) return;
    posicoesDasEtapas.current[passo] = window.scrollY;
    // Na revisão, segue para o próximo exercício que ficou para trás; acabou a fila, conclui.
    if (revisao) {
      const resto = revisao.filter((numero) => numero !== indice);
      if (resto.length > 0) {
        setRevisao(resto);
        setPasso(etapaDoExercicio(resto[0]));
        return;
      }
    } else if (!ultima) {
      setPasso((atual) => atual + 1);
      return;
    } else {
      const pendentes = exercicios.map((_, numero) => numero).filter((numero) => !avaliacoes[numero]?.correta);
      if (pendentes.length > 0) {
        revisar(pendentes);
        return;
      }
    }
    if (!comprovante) return;
    const acertos = avaliacoes.filter((item) => item?.correta).length;
    const acertosDePrimeira = primeiras.filter((primeira) => primeira === true).length;
    const resumo: ResumoLicao = {
      segundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
      tentativas,
      dePrimeira: acertosDePrimeira === exercicios.length,
      etapas: total,
      acertos,
      acertosDePrimeira,
      exercicios: exercicios.length,
      ...(autoAvaliacao ? { pratica: autoAvaliacao } : {}),
      // Vale rever: ficou exercício sem acerto, a maior parte saiu errada antes do acerto ou a prática não saiu (como o mapa).
      rever: acertos < exercicios.length || motivoParaRever({ acertosDePrimeira, exercicios: exercicios.length, pratica: autoAvaliacao }) !== null,
      ponteConstruida: Object.values(pontesPorExercicio).some(Boolean),
      ensinouStu: ensinou,
    };
    if (await concluir(comprovante, resumo, autoAvaliacao ?? undefined)) {
      guardarAndamento(licao.id, null);
      return;
    }
    // A confirmação expirou: a aula volta ao último exercício para a pessoa responder de novo.
    setRevisao(null);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === exercicios.length - 1 ? null : atual)));
    setPasso(ultimoExercicio(etapas));
  }

  /** Recomeçar do zero (quem voltou no meio e prefere começar de novo), depois de confirmar: as respostas se perdem. */
  function recomecar() {
    setConfirmandoRecomeco(false);
    guardarAndamento(licao.id, null);
    setPasso(0);
    setRespostas(exercicios.map(() => ''));
    setAvaliacoes(exercicios.map(() => null));
    setPrimeiras(exercicios.map(() => null));
    setTentativas(0);
    setComprovante(null);
    setAutoAvaliacao(null);
    setRevisao(null);
    setAvisoRetomada(false);
    setErrosAnteriores(exercicios.map(() => null));
    setPontesPorExercicio({});
    setEnsinou(false);
  }

  /** Abre o "Explique com suas palavras" (no pé da página) e leva até ele. */
  function abrirExplique() {
    const caixas = document.querySelectorAll<HTMLDetailsElement>('.estudio-apoio details.estudio-card');
    const caixa = caixas[caixas.length - 1];
    if (!caixa) return;
    caixa.open = true;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    caixa.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' });
    caixa.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
  }

  /** Concluir sem contar como foi: a tela leva até a pergunta, em vez de um botão apagado sem explicação. */
  function mostrarComoFoi() {
    const pergunta = document.querySelector<HTMLElement>('.como-foi legend');
    if (!pergunta) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pergunta.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
    pergunta.focus({ preventScroll: true });
    const grupo = pergunta.closest<HTMLElement>('.como-foi');
    grupo?.removeAttribute('data-chamar');
    window.requestAnimationFrame(() => grupo?.setAttribute('data-chamar', ''));
    window.setTimeout(() => grupo?.removeAttribute('data-chamar'), 1600);
  }

  continuarAgora.current = () => {
    if (avaliacao) void avancar();
  };

  /** Sair da lição: o andamento fica guardado, então sai direto (e continua de onde parou na volta). Devolve se saiu. */
  sairAgora.current = (peloVoltar = false) => {
    if (ocupado && !peloVoltar) return false;
    voltar();
    return true;
  };

  let acao: ReactNode;
  if (etapa.tipo === 'exercicio' && avaliacao) {
    acao = (
      <Botao variante={avaliacao.correta ? 'sucesso' : 'texto'} disabled={ocupado} onClick={() => void avancar()}>
        {pendente === 'concluir' ? t.concluindo : avaliacao.correta ? t.continuar : revisao ? t.seguirSemAcertar : t.pular}
      </Botao>
    );
  } else if (exercicio) {
    acao = (
      <Botao type="submit" form="resposta-licao" disabled={ocupado || !respostaCompleta(exercicio, resposta)} aria-busy={pendente === 'avaliar' || undefined}>
        {pendente === 'avaliar' ? t.avaliando : t.avaliar}
      </Botao>
    );
  } else if (etapa.tipo === 'pratica') {
    acao = (
      <>
        {autoAvaliacao === 'ainda_nao' && (
          <Botao disabled={ocupado} onClick={() => { setAutoAvaliacao(null); setVoltasPratica((atual) => atual + 1); }}>
            {t.pratica.praticarMais}
          </Botao>
        )}
        <Botao variante={autoAvaliacao === 'ainda_nao' ? 'texto' : 'sucesso'} disabled={ocupado} aria-disabled={!autoAvaliacao || undefined}
          onClick={() => (autoAvaliacao ? void avancar() : mostrarComoFoi())}>
          {pendente === 'concluir' ? t.concluindo : autoAvaliacao === 'ainda_nao' ? t.pratica.concluirAssim : t.pratica.concluir}
        </Botao>
      </>
    );
  } else if (temMais) {
    acao = <Botao className="botao--ler-mais" onClick={lerMais}>{t.continuarLendo}<Icone nome="seta" /></Botao>;
  } else {
    acao = (
      <Botao disabled={ocupado} onClick={() => { posicoesDasEtapas.current[passo] = window.scrollY; setPasso((atual) => atual + 1); }}>
        {t.seguir}<Icone nome="seta" />
      </Botao>
    );
  }

  const ponteAberta = Boolean(avaliacao && !avaliacao.correta && pedidoPonte > 0);

  return (
    <article className="painel painel--aula" data-retorno={retorno} data-ponte-aberta={ponteAberta || undefined}>
      <header className="aula-topo">
        <button type="button" className="aula-fechar" aria-label={t.voltar} disabled={ocupado} onClick={() => sairAgora.current()}>
          <Icone nome="fechar" />
        </button>
        <div className="aula-andamento">
          <div className="aula-andamento__linha">
            <div className="aula-barra" role="progressbar" aria-label={andamento} aria-valuemin={0} aria-valuemax={total}
              aria-valuenow={revisao ? total : passo + 1}>
              <span className="aula-barra__preenchimento"
                style={{ '--progresso': revisao ? 1 : (avaliacao?.correta ? passo + 1 : passo + 0.5) / total } as CSSProperties} />
            </div>
            <span className="aula-posicao" aria-hidden="true">{andamento}</span>
          </div>
          <p className="aula-titulo-topo">{semQuebrarHifen(licao.titulo)}</p>
        </div>
      </header>
      {/* Na revisão rápida, o quadro entra de novo, mesmo quando o exercício é o mesmo (o último, pulado agora). */}
      <div className="aula-miolo" key={`${passo}-${rodadaDeOpcoes}`}>
        {passo > 0 && !revisao && (
          <button type="button" className="aula-voltar-etapa" disabled={ocupado}
            onClick={() => { voltandoEtapa.current = true; setPasso((atual) => Math.max(0, atual - 1)); }}>
            <Icone nome="seta" />{t.etapaAnterior}
          </button>
        )}
        <p className="aula-etapa" data-etapa={etapa.tipo}><Icone nome={iconesDaEtapa[etapa.tipo]} />{nomeEtapa}</p>
        {etapa.tipo === 'conceito' && <h1 tabIndex={-1}>{semQuebrarHifen(licao.titulo)}</h1>}
        {etapa.tipo === 'pratica' && <h1 tabIndex={-1}>{semQuebrarHifen(licao.titulo)}</h1>}
        {avisoRetomada && (
          <p className="aula-aviso" role="status">
            {confirmandoRecomeco ? (
              <>
                {t.recomecarPergunta}{' '}
                <button type="button" className="aula-aviso__acao" onClick={recomecar}>{t.recomecarLicao}</button>{' '}
                <button type="button" className="aula-aviso__acao" onClick={() => setConfirmandoRecomeco(false)}>{mensagens.geracao.cancelar}</button>
              </>
            ) : (
              <>
                {t.retomada}{' '}
                <button type="button" className="aula-aviso__acao" onClick={() => setConfirmandoRecomeco(true)}>{t.recomecarLicao}</button>
              </>
            )}
          </p>
        )}
        {revisao && exercicio && <p className="aula-aviso aula-aviso--revisao" role="status">{t.revisaoRapida}</p>}
        {etapa.tipo === 'conceito' && (
          <>
            {licao.concluida && <p className="aula-revisao"><Icone nome="check" />{mensagens.trilha.revisitando}</p>}
            <p className="introducao">{licao.objetivo}</p>
            <div className="aula-explicacao">
              <Stu />
              <section className="aula-balao" aria-labelledby="etapa-aula">
                <h2 id="etapa-aula">{t.explicacaoDoStu}</h2>
                <ExplicacaoComFalas texto={licao.conceito} idioma={licao.falas?.[0]?.idioma} />
                {!!licao.referencias?.length && (
                  <div className="aula-citacao-marcadores">
                    <span>{mensagens.estudio.baseadoMaterial}</span>
                    {licao.referencias.map((ref, idx) => (
                      <button key={idx} type="button" className="aula-citacao-marcador"
                        aria-label={`Ver fonte ${idx + 1} de ${licao.referencias!.length}`}
                        aria-expanded={citacaoAberta === idx}
                        onClick={() => {
                          setCitacaoAberta(idx);
                          window.requestAnimationFrame(() => {
                            const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                            cartaoCitacaoRef.current?.scrollIntoView({ block: 'nearest', behavior: reduzido ? 'auto' : 'smooth' });
                            cartaoCitacaoRef.current?.focus({ preventScroll: true });
                          });
                        }}>
                        [{idx + 1}]
                      </button>
                    ))}
                  </div>
                )}
                <p className="licao-origem">{t.origem} · {origemLegivel(licao.origem)}</p>
              </section>
            </div>
            {citacaoAberta !== null && licao.referencias?.[citacaoAberta] && (() => {
              const ref = licao.referencias[citacaoAberta];
              return (
                <aside ref={cartaoCitacaoRef} className="aula-citacao" aria-label={mensagens.estudio.fonteMaterial} tabIndex={-1}>
                  <div className="aula-citacao__topo">
                    <span className="aula-citacao__selo">[{citacaoAberta + 1}] {mensagens.estudio.fonteMaterial}</span>
                    <strong>{ref.nome} · {ref.localizacao ?? mensagens.estudio.pagina(ref.pagina)}</strong>
                    {ref.leitura === 'demonstracao' && <span className="estudio-selo">{mensagens.estudio.simulado}</span>}
                  </div>
                  <blockquote>{ref.trecho}</blockquote>
                </aside>
              );
            })()}
            {licao.recurso && <RecursoDaLicao recurso={licao.recurso} />}
          </>
        )}
        {etapa.tipo === 'exemplo' && <EtapaExemplo licao={licao} titulo={tituloEtapa} />}
        {exercicio && (() => {
          const ponteNeste = Boolean(pontesPorExercicio[indice]);
          let stuEstado: 'neutro' | 'pensando' | 'atento' | 'comemorando_primeira' | 'comemorando_ponte' | 'comemorando_acerto' = 'neutro';
          let stuFala: string = t.stuEstado.neutro;
          if (avaliacao?.correta) {
            if (ponteNeste) {
              stuEstado = 'comemorando_ponte';
              stuFala = t.stuEstado.ponte;
            } else if (primeiras[indice] === true) {
              stuEstado = 'comemorando_primeira';
              stuFala = t.stuEstado.primeira;
            } else {
              stuEstado = 'comemorando_acerto';
              stuFala = t.stuEstado.acerto;
            }
          } else if (avaliacao && !avaliacao.correta) {
            stuEstado = 'atento';
            stuFala = t.stuEstado.atento;
          } else if (errosAnteriores[indice]) {
            stuEstado = 'pensando';
            stuFala = t.stuEstado.pensando;
          }
          return (
            <>
              {stuEstado !== 'neutro' && (
                <div className="aula-stu-estado" data-estado={stuEstado}>
                  <div className="aula-stu-estado__avatar" aria-hidden="true">
                    <Stu />
                    <span className="aula-stu-estado__adereco" />
                  </div>
                  <p className="aula-stu-estado__balao">{stuFala}</p>
                </div>
              )}
              <EtapaExercicio exercicio={exercicio} indice={indice} total={exercicios.length} resposta={resposta} mudar={mudarResposta}
                consulta={licao.recurso && licao.recurso.tipo !== 'linha_do_tempo' ? licao.recurso : undefined}
                explicacao={licao.conceito} exemplo={licao.exemplo}
                errouAntes={Boolean(errosAnteriores[indice])}
                avaliacao={avaliacao} ocupado={ocupado} responder={responder} formulario={formulario} titulo={tituloEtapa}
                dica={avaliacao ? null : errosAnteriores[indice]} />
            </>
          );
        })()}
        {etapa.tipo === 'pratica' && licao.pratica && (
          <EtapaPratica pratica={licao.pratica} titulo={tituloEtapa} escolha={autoAvaliacao} escolher={setAutoAvaliacao} reinicio={voltasPratica}
            restanteInicial={praticaRestante.current} aoMudarRestante={(valor) => { praticaRestante.current = valor; }}
            recurso={licao.recurso} passos={licao.passos} falas={licao.falas} />
        )}
      </div>
      {exercicio && (
        <ApoioDaLicao key={indice} licao={licao} avaliacao={avaliacao} pedidoPonte={pedidoPonte} ultimo={indice === exercicios.length - 1}
          ultimaResposta={respostaLegivel(exercicio, resposta)}
          aoVoltarExercicio={tentarDeNovo}
          aoConcluirPonte={() => { setPonteFeita(true); setPontesPorExercicio((atual) => ({ ...atual, [indice]: true })); }}
          aoEnsinar={() => setEnsinou(true)} aoAbrirExplique={setExpliqueAberto} />
      )}
      <footer className="aula-rodape" data-retorno={retorno}
        data-compacto={(avaliacao && !avaliacao.correta && pedidoPonte > 0 && !ponteFeita) || (expliqueAberto && avaliacao) || undefined}>
        {temAbaixo && (
          <button type="button" className="aula-mais-abaixo" onClick={lerMais}><Icone nome="seta" />{t.maisAbaixo}</button>
        )}
        <div className="aula-rodape__conteudo">
          {avaliacao && (
            <section className="aula-retorno" aria-labelledby="aula-retorno-titulo">
              <span className="aula-retorno__icone" aria-hidden="true">
                <Icone nome={avaliacao.correta ? 'check' : ponteFeita ? 'lampada' : 'fechar'} />
                {avaliacao.correta && <Confete quantidade={14} />}
              </span>
              <div>
                <h2 id="aula-retorno-titulo" ref={tituloRetorno} tabIndex={-1}>
                  {avaliacao.correta
                    ? avaliacao.criterios?.some(({ atendido }) => !atendido) ? t.quaseCompleta : tituloDoAcerto(`${licao.id}-${indice}`)
                    : ponteFeita ? t.ponteFeita : acertouParte(avaliacao) ? t.errada : t.erradaLonge}
                  <span className="somente-leitor"> {avaliacao.correta ? t.correta : t.incorreta}.</span>
                </h2>
                {pedidoPonte === 0 && <p>{avaliacao.feedback}</p>}
                {pedidoPonte === 0 && avaliacao.observacao && <p className="aula-retorno__observacao">{avaliacao.observacao}</p>}
                {avaliacao.correta && indice === exercicios.length - 1 && !ensinou && (
                  <span className="aula-retorno__link">
                    <Botao variante="texto" onClick={abrirExplique}>{t.expliqueConvite}</Botao>
                  </span>
                )}
                {pedidoPonte === 0 && !avaliacao.correta && avaliacao.certos && exercicio && (exercicio.tipo === 'ordenar' || exercicio.tipo === 'associar') && (
                  <p className="aula-retorno__observacao">
                    {exercicio.tipo === 'ordenar'
                      ? t.ordenar.certos(avaliacao.certos.length, exercicio.itens.length)
                      : t.associar.certos(avaliacao.certos.length, exercicio.esquerda.length)}
                  </p>
                )}
                {!avaliacao.correta && !revisao && pedidoPonte === 0 && (
                  <p className="aula-rodape__nota">{soEsteFalta ? t.pularAvisoUltimo : t.pularAviso}</p>
                )}
              </div>
            </section>
          )}
          {etapa.tipo === 'pratica' && !autoAvaliacao && <p className="aula-rodape__nota">{t.pratica.escolha}</p>}
          {etapa.tipo === 'pratica' && autoAvaliacao === 'ainda_nao' && <p className="aula-rodape__nota">{t.pratica.aindaNaoNota}</p>}
          {exercicio && !avaliacao && (() => {
            const falta = faltaParaVerificar(exercicio, resposta);
            return falta && <p className="aula-rodape__nota" aria-live="polite">{textoDaFalta(falta)}</p>;
          })()}
          <div className="aula-rodape__acoes">
            {avaliacao && !avaliacao.correta && pedidoPonte === 0 && (
              <Botao variante="primario" disabled={ocupado} onClick={() => setPedidoPonte((atual) => atual + 1)}>
                {mensagens.estudio.verPonte}
              </Botao>
            )}
            {avaliacao && !avaliacao.correta && <Botao variante="secundario" disabled={ocupado} onClick={tentarDeNovo}>{t.tentarDeNovo}</Botao>}
            {avaliacao && !avaliacao.correta && acao}
            {!(avaliacao && !avaliacao.correta) && acao}
          </div>
        </div>
      </footer>
    </article>
  );
}

/** Exemplo resolvido ou demonstração: o texto, o recurso (acorde, linha do tempo, foto), os passos e as frases para ouvir. */
function EtapaExemplo({ licao, titulo }: { licao: LicaoDetalhe; titulo: Ref<HTMLHeadingElement> }) {
  return (
    <section className="aula-quadro" data-etapa="exemplo" aria-labelledby="etapa-aula">
      <h1 id="etapa-aula" ref={titulo} tabIndex={-1}>{licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo}</h1>
      <p>{licao.exemplo}</p>
      {licao.recurso && <RecursoDaLicao recurso={licao.recurso} />}
      {licao.passos && (
        <section className="aula-passos" aria-labelledby="aula-passos-titulo">
          <h3 id="aula-passos-titulo">{t.recursos.passos}</h3>
          <ol>
            {licao.passos.map((passo, posicao) => (
              <li key={posicao}><span className="aula-passos__numero" aria-hidden="true">{posicao + 1}</span><span>{passo}</span></li>
            ))}
          </ol>
        </section>
      )}
      {licao.falas && <Falas falas={licao.falas} />}
    </section>
  );
}

/**
 * `longa`: na prática, a batida toca oito compassos (uns 30 s) para a pessoa tocar junto. `semBatida`: o diagrama sem o
 * botão da batida e o guia (na prática, eles já estão ao lado do cronômetro).
 */
function RecursoDaLicao({ recurso, longa = false, semBatida = false }: { recurso: Recurso; longa?: boolean; semBatida?: boolean }) {
  if (recurso.tipo === 'acorde') return <DiagramaAcorde recurso={semBatida ? { ...recurso, batida: false } : recurso} longa={longa} />;
  if (recurso.tipo === 'fracao') {
    const descricao = t.recursos.fracaoDescricao(recurso.numerador, recurso.denominador);
    return (
      <figure className="fracao">
        <div className="fracao__barra" role="img" aria-label={`${recurso.numerador}/${recurso.denominador}: ${descricao}`}
          style={{ '--partes': recurso.denominador } as CSSProperties}>
          {Array.from({ length: recurso.denominador }, (_, posicao) => (
            <span key={posicao} data-cheia={posicao < recurso.numerador || undefined} />
          ))}
        </div>
        <figcaption>
          <strong>{recurso.rotulo ?? `${recurso.numerador}/${recurso.denominador}`}</strong>
          <span>{descricao}</span>
        </figcaption>
      </figure>
    );
  }
  if (recurso.tipo === 'linha_do_tempo') {
    return (
      <section className="linha-tempo" aria-labelledby="linha-tempo-titulo">
        <h3 id="linha-tempo-titulo">{t.recursos.linhaDoTempo}</h3>
        <ol>
          {recurso.eventos.map((evento, posicao) => (
            <li key={posicao}>
              <span className="linha-tempo__quando">{evento.quando}</span>
              <span className="linha-tempo__texto">{evento.texto}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <figure className="recurso-imagem">
      {/* A foto vem do próprio material da pessoa, como data URL: não passa pelo otimizador de imagens. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={recurso.src} alt={`${recurso.fonte ?? t.recursos.doMaterial}: ${recurso.descricao}`} />
      <figcaption><strong>{recurso.fonte ?? t.recursos.doMaterial}</strong> · {recurso.descricao}</figcaption>
    </figure>
  );
}

/**
 * Diagrama do acorde desenhado em SVG (cordas, trastes, dedos, X e O) e o som do acorde, sintetizado na hora (Karplus-
 * Strong, o mesmo código do app). O leitor de tela ouve a posição de cada corda.
 */
/** O braço de um acorde em SVG: cordas, trastes, X e O e os dedos numerados. */
function BracoDoAcorde({ nome, casas, dedos }: { nome: string; casas: number[]; dedos?: number[] }) {
  const tocadas = casas.filter((casa) => casa > 0);
  const base = Math.max(0, ...tocadas) > 4 ? Math.min(...tocadas) : 1;
  const x = (corda: number) => 30 + corda * 26;
  const y = (casa: number) => 48 + (casa - base + 0.5) * 34;
  const descricao = casas
    .map((casa, corda) => t.recursos.corda(6 - corda, casa, t.recursos.dedos[dedos?.[corda] ?? 0] ?? ''))
    .join('; ');
  return (
    <svg viewBox="0 0 196 232" role="img" aria-label={`${t.recursos.acorde(nome)}: ${descricao}.`}>
      {/* Corda e casa com o ordinal (6ª, 1ª): o número simples fica só para o dedo, na bolinha, e não se confunde. */}
      {[6, 5, 4, 3, 2, 1].map((numero, corda) => (
        <text key={`c${numero}`} x={x(corda)} y={206} textAnchor="middle" className="acorde__rotulo">{numero}ª</text>
      ))}
      <text x={95} y={226} textAnchor="middle" className="acorde__legenda-eixo">{t.recursos.eixoCorda}</text>
      <text x={182} y={16} textAnchor="middle" className="acorde__legenda-eixo">{t.recursos.eixoCasa}</text>
      {[0, 1, 2, 3].map((linha) => (
        <text key={`t${linha}`} x={181} y={48 + (linha + 0.5) * 34 + 6} textAnchor="middle" className="acorde__rotulo">{base + linha}ª</text>
      ))}
      {base === 1
        ? <rect x={27} y={43} width={136} height={7} rx={3.5} className="acorde__pestana" />
        : <text x={4} y={y(base) + 5} className="acorde__base">{base}ª</text>}
      {[0, 1, 2, 3, 4].map((traste) => <line key={traste} x1={30} x2={160} y1={48 + traste * 34} y2={48 + traste * 34} className="acorde__traste" />)}
      {[0, 1, 2, 3, 4, 5].map((corda) => (
        // Da 6ª (a mais grossa, à esquerda) à 1ª: a mesma diferença de espessura da ilustração da lição 1.
        <line key={corda} x1={x(corda)} x2={x(corda)} y1={48} y2={184} className="acorde__corda" style={{ strokeWidth: 4.4 - corda * 0.6 }} />
      ))}
      {casas.map((casa, corda) => (casa <= 0 ? (
        <text key={corda} x={x(corda)} y={33} textAnchor="middle" className={casa < 0 ? 'acorde__abafada' : 'acorde__solta'}>{casa < 0 ? 'X' : 'O'}</text>
      ) : (
        <g key={corda}>
          <circle cx={x(corda)} cy={y(casa)} r={11.5} className="acorde__dedo" />
          {Boolean(dedos?.[corda]) && <text x={x(corda)} y={y(casa) + 5} textAnchor="middle" className="acorde__numero">{dedos?.[corda]}</text>}
        </g>
      )))}
    </svg>
  );
}

/**
 * Diagrama do acorde com o som sintetizado na hora. Com `anterior`, os dois acordes da troca ficam lado a lado (Am → C),
 * cada um com o seu botão de ouvir.
 */
/** `soBatida`: só o botão de tocar junto e o guia dos tempos (na prática, ao lado do cronômetro), sem o diagrama. */
function DiagramaAcorde({ recurso, longa = false, soBatida = false }: { recurso: Extract<Recurso, { tipo: 'acorde' }>; longa?: boolean; soBatida?: boolean }) {
  type Som = 'acorde' | 'batida' | 'anterior';
  const compassos = longa ? 8 : 2;
  const [tocando, setTocando] = useState<Som | null>(null);
  const [semSom, setSemSom] = useState(false);
  /** Na batida, qual dos oito tempos do compasso (1, e, 2, e…) está soando agora. */
  const [tempoAtual, setTempoAtual] = useState<number | null>(null);
  const enderecos = useRef<Partial<Record<Som, string>>>({});
  const audioAtual = useRef<HTMLAudioElement | null>(null);
  const quadro = useRef(0);
  const { anterior } = recurso;

  useEffect(() => () => {
    Object.values(enderecos.current).forEach((endereco) => URL.revokeObjectURL(endereco));
    audioAtual.current?.pause();
    window.cancelAnimationFrame(quadro.current);
  }, []);

  /** Acompanha a batida (72 por minuto, uma colcheia a cada 30/72 s) e destaca o tempo que soa. */
  function acompanhar(audio: HTMLAudioElement) {
    const colcheia = 30 / 72;
    const passo = () => {
      if (audio.paused || audio.ended) {
        setTempoAtual(null);
        return;
      }
      const indice = Math.floor(audio.currentTime / colcheia);
      setTempoAtual(indice < compassos * 8 ? indice % 8 : null);
      quadro.current = window.requestAnimationFrame(passo);
    };
    quadro.current = window.requestAnimationFrame(passo);
  }

  function parar() {
    audioAtual.current?.pause();
    window.cancelAnimationFrame(quadro.current);
    setTocando(null);
    setTempoAtual(null);
  }

  function tocar(som: Som) {
    const bytes = () => {
      if (som === 'batida') return sintetizarBatida(recurso.casas, { compassos });
      return sintetizarAcorde(som === 'anterior' && anterior ? anterior.casas : recurso.casas);
    };
    enderecos.current[som] ??= URL.createObjectURL(new Blob([bytes() as BlobPart], { type: 'audio/wav' }));
    const audio = new Audio(enderecos.current[som]);
    audioAtual.current = audio;
    setTocando(som);
    setSemSom(false);
    audio.onended = () => {
      setTocando(null);
      setTempoAtual(null);
    };
    audio.play().then(() => {
      if (som === 'batida') acompanhar(audio);
    }).catch(() => {
      setTocando(null);
      setSemSom(true);
    });
  }

  const guia = (
    <>
      <span className="batida" aria-hidden="true">
        {['1', 'e', '2', 'e', '3', 'e', '4', 'e'].map((rotulo, indice) => (
          <span key={indice} className="batida__tempo" data-ativo={tempoAtual === indice || undefined} data-sobe={indice % 2 === 1 || undefined}>
            <span className="batida__seta">{indice % 2 ? '↑' : '↓'}</span>{rotulo}
          </span>
        ))}
      </span>
      <span className="acorde__guia">{t.audio.batidaGuia}</span>
    </>
  );
  if (soBatida) {
    return (
      <div className="acorde acorde--so-batida">
        <span className="acorde__botoes">
          <Botao variante="secundario" disabled={tocando !== null} onClick={() => tocar('batida')}>
            <Icone nome="som" />{tocando === 'batida' ? t.recursos.tocando : t.recursos.tocarJunto}
          </Botao>
          {tocando && <Botao variante="texto" onClick={parar}>{t.audio.pararSom}</Botao>}
        </span>
        {guia}
        {semSom && <span role="status" className="acorde__aviso">{t.recursos.semSom}</span>}
      </div>
    );
  }

  return (
    <figure className="acorde" data-comparacao={anterior ? true : undefined}>
      {anterior ? (
        <div className="acorde__comparacao">
          <div className="acorde__lado"><BracoDoAcorde {...anterior} /><span className="acorde__nome">{anterior.nome}</span></div>
          <span className="acorde__seta" aria-hidden="true"><Icone nome="seta" /></span>
          <div className="acorde__lado">
            <BracoDoAcorde nome={recurso.nome} casas={recurso.casas} dedos={recurso.dedos} /><span className="acorde__nome">{recurso.nome}</span>
          </div>
        </div>
      ) : <BracoDoAcorde nome={recurso.nome} casas={recurso.casas} dedos={recurso.dedos} />}
      <figcaption>
        <strong>{anterior ? t.recursos.troca(anterior.nome, recurso.nome) : t.recursos.acorde(recurso.nome)}</strong>
        <span>{t.recursos.legendaAcorde}</span>
        <span className="acorde__botoes">
          {anterior && (
            <Botao variante="secundario" disabled={tocando !== null} onClick={() => tocar('anterior')}>
              <Icone nome="som" />{tocando === 'anterior' ? t.recursos.tocando : t.recursos.ouvirNome(anterior.nome)}
            </Botao>
          )}
          <Botao variante="secundario" disabled={tocando !== null} onClick={() => tocar('acorde')}>
            <Icone nome="som" />{tocando === 'acorde' ? t.recursos.tocando : anterior ? t.recursos.ouvirNome(recurso.nome) : t.recursos.ouvirAcorde}
          </Botao>
          {recurso.batida && (
            <Botao variante="secundario" disabled={tocando !== null} onClick={() => tocar('batida')}>
              <Icone nome="som" />{tocando === 'batida' ? t.recursos.tocando : longa ? t.recursos.tocarJunto : t.recursos.ouvirBatida}
            </Botao>
          )}
          {tocando && <Botao variante="texto" onClick={parar}>{t.audio.pararSom}</Botao>}
        </span>
        {recurso.batida && guia}
        {semSom && <span role="status" className="acorde__aviso">{t.recursos.semSom}</span>}
      </figcaption>
    </figure>
  );
}

/** Um som de referência para a prática (como o Mi da 6ª corda, para afinar), sintetizado como o acorde. */
function TocarSom({ rotulo, casas }: { rotulo: string; casas: number[] }) {
  const [tocando, setTocando] = useState(false);
  const [semSom, setSemSom] = useState(false);
  const endereco = useRef<string | null>(null);
  useEffect(() => () => {
    if (endereco.current) URL.revokeObjectURL(endereco.current);
  }, []);
  function tocar() {
    endereco.current ??= URL.createObjectURL(new Blob([sintetizarAcorde(casas) as BlobPart], { type: 'audio/wav' }));
    const audio = new Audio(endereco.current);
    setTocando(true);
    setSemSom(false);
    audio.onended = () => setTocando(false);
    audio.play().catch(() => {
      setTocando(false);
      setSemSom(true);
    });
  }
  return (
    <div className="aula-pratica__som">
      <Botao variante="secundario" disabled={tocando} onClick={tocar}><Icone nome="som" />{tocando ? t.recursos.tocando : rotulo}</Botao>
      {semSom && <span role="status" className="acorde__aviso">{t.recursos.semSom}</span>}
    </div>
  );
}

function vozDisponivel() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** A voz do navegador só existe no cliente: o botão aparece depois de montar, sem divergir da página do servidor. */
function useVozDisponivel() {
  const [disponivel, setDisponivel] = useState(false);
  useEffect(() => setDisponivel(vozDisponivel()), []);
  return disponivel;
}

/**
 * Lê a fala em voz alta, no idioma dela, com a voz do próprio navegador (sem rede). `aoTerminar` avisa quando a voz
 * acaba (ou é interrompida), com uma reserva pelo tamanho da frase para navegadores que não avisam.
 */
function falar(fala: Fala, devagar: boolean, aoTerminar?: () => void, aoFalhar?: () => void) {
  if (!vozDisponivel()) return;
  const sintese = window.speechSynthesis;
  sintese.cancel();
  const frase = new SpeechSynthesisUtterance(fala.texto);
  if (aoTerminar) {
    const comeco = Date.now();
    const reserva = window.setTimeout(aoTerminar, Math.max(1500, (fala.texto.length * 90) / (devagar ? 0.6 : 0.95)));
    frase.onend = () => {
      window.clearTimeout(reserva);
      aoTerminar();
      // Acabou na hora: o aparelho não tem voz para a frase (nada foi falado).
      if (Date.now() - comeco < 250 && fala.texto.length > 3) aoFalhar?.();
    };
    frase.onerror = (evento) => {
      window.clearTimeout(reserva);
      aoTerminar();
      if (evento.error !== 'interrupted' && evento.error !== 'canceled') aoFalhar?.();
    };
  }
  frase.lang = fala.idioma;
  frase.rate = devagar ? 0.6 : 0.95;
  const idioma = fala.idioma.toLowerCase();
  const vozes = sintese.getVoices();
  const voz = vozes.find((item) => item.lang.toLowerCase().replace('_', '-') === idioma)
    ?? vozes.find((item) => item.lang.toLowerCase().startsWith(idioma.slice(0, 2)));
  if (voz) frase.voice = voz;
  sintese.speak(frase);
}

/** O que está tocando agora (normal ou devagar), para o botão mostrar "Tocando…", e se o aparelho ficou sem voz. */
function useTocando(fala: Fala) {
  const [tocando, setTocando] = useState<'normal' | 'devagar' | null>(null);
  const [semVoz, setSemVoz] = useState(false);
  const tocar = (devagar: boolean) => {
    setTocando(devagar ? 'devagar' : 'normal');
    setSemVoz(false);
    falar(fala, devagar, () => setTocando(null), () => setSemVoz(true));
  };
  return [tocando, tocar, semVoz] as const;
}

/** Reconhecimento de voz do navegador (Chrome, Edge, Safari): ouve a pessoa sem precisar da IA nem de rede própria. */
type Reconhecimento = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
function classeDoReconhecimento(): (new () => Reconhecimento) | null {
  if (typeof window === 'undefined') return null;
  const janela = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}
function useReconhecimentoDisponivel() {
  const [disponivel, setDisponivel] = useState(false);
  useEffect(() => setDisponivel(classeDoReconhecimento() !== null), []);
  return disponivel;
}

/** O resultado da conferência da fala, em texto: o que foi dito, quantas palavras e o que conferir. */
function textoDaConferencia(conferencia: ConferenciaDaFala): string {
  const palavras = conferencia.faltaram.map((palavra) => `“${palavra}”`).join(', ');
  if (conferencia.nota === 'otima') return t.audio.falaOtima;
  return conferencia.nota === 'quase' ? t.audio.falaQuase(palavras) : t.audio.falaTente(palavras);
}

/**
 * Falar e conferir: a pessoa fala a frase, o reconhecimento de voz do navegador transcreve e a frase é conferida palavra
 * por palavra (números por extenso, contrações, uma letra trocada). Das alternativas do reconhecimento, fica a mais perto.
 */
function BotaoFalar({ fala, aoFalar }: { fala: Fala; /** A pessoa tocou em Falar: o aviso de voz do "Ouvir" sai. */ aoFalar?: () => void }) {
  const [ouvindo, setOuvindo] = useState(false);
  const [resultado, setResultado] = useState<{ dito: string; conferencia: ConferenciaDaFala } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const prazo = useRef<number | undefined>(undefined);
  const recebeu = useRef(false);
  useEffect(() => () => {
    reconhecimento.current?.abort();
    window.clearTimeout(prazo.current);
  }, []);

  /** Termina a escuta; sem nada ouvido, avisa (o reconhecimento às vezes não devolve nada, nem erro). */
  function encerrar() {
    window.clearTimeout(prazo.current);
    setOuvindo(false);
    if (!recebeu.current) setErro((atual) => atual ?? t.audio.naoOuviu);
  }

  async function ouvir() {
    const Classe = classeDoReconhecimento();
    if (!Classe) return;
    aoFalar?.();
    const dispositivos = await navigator.mediaDevices?.enumerateDevices?.().catch(() => null);
    if (dispositivos && !dispositivos.some(({ kind }) => kind === 'audioinput')) {
      setResultado(null);
      setErro(t.audio.semMicrofone);
      return;
    }
    recebeu.current = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const novo = new Classe();
    novo.lang = fala.idioma;
    novo.interimResults = false;
    novo.maxAlternatives = 3;
    novo.continuous = false;
    novo.onresult = (evento) => {
      recebeu.current = true;
      const alternativas = Array.from(evento.results[0] ?? [], ({ transcript }) => transcript.trim()).filter(Boolean);
      const melhor = alternativas
        .map((dito) => ({ dito, conferencia: conferirFala(fala.texto, dito, fala.idioma) }))
        .sort((a, b) => b.conferencia.acertos - a.conferencia.acertos)[0];
      if (melhor) setResultado(melhor);
      else setErro(t.audio.naoOuviu);
    };
    novo.onerror = (evento) => {
      setErro(evento.error === 'not-allowed' || evento.error === 'service-not-allowed' ? t.audio.microfoneBloqueado : t.audio.naoOuviu);
    };
    novo.onend = encerrar;
    reconhecimento.current = novo;
    setErro(null);
    setResultado(null);
    setOuvindo(true);
    // Sem resposta em 8 s, para e avisa.
    prazo.current = window.setTimeout(() => {
      novo.abort();
      encerrar();
    }, 8000);
    try {
      novo.start();
    } catch {
      encerrar();
    }
  }

  /** Parar pelo botão: pede o fim e, se o reconhecimento não responder, encerra mesmo assim. */
  function parar() {
    reconhecimento.current?.stop();
    window.clearTimeout(prazo.current);
    prazo.current = window.setTimeout(encerrar, 1500);
  }

  return (
    <>
      <button type="button" className="ouvir__botao ouvir__botao--falar" aria-label={t.audio.falarFrase(fala.texto)}
        data-tocando={ouvindo || undefined} onClick={() => (ouvindo ? parar() : ouvir())}>
        <span aria-hidden="true">{ouvindo ? t.audio.ouvindo : t.audio.falar}</span>
      </button>
      {(resultado || erro) && (
        <span className="falar__resultado" role="status" data-nota={resultado?.conferencia.nota ?? 'erro'}>
          {resultado
            ? <>{t.audio.voceDisse(resultado.dito)} · <strong>{t.audio.acertosFala(resultado.conferencia.acertos, resultado.conferencia.total)}</strong>. {textoDaConferencia(resultado.conferencia)}</>
            : erro}
        </span>
      )}
    </>
  );
}

function BotoesOuvir({ fala, falar = false }: { fala: Fala; falar?: boolean }) {
  const disponivel = useVozDisponivel();
  const reconhece = useReconhecimentoDisponivel();
  const [tocando, tocarFrase, semVoz] = useTocando(fala);
  // Um aviso por vez, o da última ação: "Ouvir" limpa o retorno do "Falar" (que recomeça), e "Falar" esconde o aviso de voz.
  const [falou, setFalou] = useState(false);
  const [rodadaFalar, setRodadaFalar] = useState(0);
  const tocar = (devagar: boolean) => {
    setFalou(false);
    setRodadaFalar((atual) => atual + 1);
    tocarFrase(devagar);
  };
  if (!disponivel && !(falar && reconhece)) return null;
  return (
    <span className="ouvir">
      <button type="button" className="ouvir__botao" aria-label={t.audio.ouvirFrase(fala.texto)} data-tocando={tocando === 'normal' || undefined}
        onClick={() => tocar(false)}>
        <Icone nome="som" /><span aria-hidden="true">{tocando === 'normal' ? t.audio.tocando : t.audio.ouvir}</span>
      </button>
      <button type="button" className="ouvir__botao ouvir__botao--devagar" aria-label={t.audio.ouvirDevagar(fala.texto)}
        data-tocando={tocando === 'devagar' || undefined} onClick={() => tocar(true)}>
        <span aria-hidden="true">{tocando === 'devagar' ? t.audio.tocando : t.audio.devagar}</span>
      </button>
      {semVoz && !falou && <span className="ouvir__aviso" role="status">{t.audio.semVozFrase}</span>}
      {falar && reconhece && <BotaoFalar key={rodadaFalar} fala={fala} aoFalar={() => setFalou(true)} />}
    </span>
  );
}

/** Frases para ouvir e repetir, com a tradução. */
function Falas({ falas }: { falas: Fala[] }) {
  return (
    <section className="falas" aria-labelledby="falas-titulo">
      <h3 id="falas-titulo">{t.audio.falasTitulo}</h3>
      {falas.some(({ pronuncia }) => pronuncia) && <p className="falas__legenda">{t.audio.comoLerPronuncia}</p>}
      <ul>
        {falas.map((fala, posicao) => (
          <li key={posicao}>
            <div className="falas__textos">
              <p className="falas__texto" lang={fala.idioma}>{fala.texto}</p>
              {fala.pronuncia && <p className="falas__pronuncia"><span className="somente-leitor">{t.audio.pronuncia}: </span>{fala.pronuncia}</p>}
              {fala.traducao && <p className="falas__traducao">{fala.traducao}</p>}
            </div>
            <BotoesOuvir fala={fala} falar />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ao abrir uma consulta recolhida (o diagrama, a explicação), a tela rola até ela ficar acima do painel de retorno,
 * que cobre o pé da tela depois da resposta.
 */
function mostrarAberto(evento: SyntheticEvent<HTMLDetailsElement>) {
  const caixa = evento.currentTarget;
  if (!caixa.open) return;
  window.requestAnimationFrame(() => {
    const rodape = document.querySelector<HTMLElement>('.aula-rodape')?.getBoundingClientRect().height ?? 0;
    const area = caixa.getBoundingClientRect();
    const sobra = area.bottom - (window.innerHeight - rodape - 12);
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sobra > 0) window.scrollBy({ top: Math.min(sobra, area.top - 72), behavior: reduzido ? 'auto' : 'smooth' });
  });
}

/** Se o texto tem frases entre aspas no idioma da lição (fora do português), que viram botões de ouvir. */
function temFalasNoTexto(texto: string, idioma?: string) {
  return Boolean(idioma && !idioma.toLowerCase().startsWith('pt') && /“[^”ãõçáéíóúâêôà]+”/i.test(texto));
}

/**
 * Texto com as frases entre aspas no idioma da lição (“Hello”, “I'd like…”) tocáveis: um toque e a voz fala a frase.
 * Sem voz, ou numa lição em português, o texto fica como está.
 */
function ExplicacaoComFalas({ texto, idioma }: { texto: string; idioma?: string }) {
  const disponivel = useVozDisponivel();
  const [tocando, setTocando] = useState<number | null>(null);
  const [semVoz, setSemVoz] = useState(false);
  if (!idioma || idioma.toLowerCase().startsWith('pt') || !disponivel || !temFalasNoTexto(texto, idioma)) return <p>{texto}</p>;
  const partes = texto.split(/“([^”]+)”/);
  function ouvir(indice: number, frase: string) {
    setTocando(indice);
    setSemVoz(false);
    falar({ texto: frase, idioma: idioma ?? 'en-US' }, false, () => setTocando(null), () => setSemVoz(true));
  }
  return (
    <>
      <p>
        {partes.map((parte, indice) => {
          // Fora das aspas, ou uma citação em português (com acento), fica como texto.
          if (indice % 2 === 0) return parte;
          if (/[ãõçáéíóúâêôà]/i.test(parte)) return `“${parte}”`;
          // Um span no fluxo do texto (o botão quebraria a linha antes de um parêntese ou de um ponto). A última palavra
          // vai presa ao ícone de som, que assim nunca fica sozinho numa linha.
          const corte = parte.lastIndexOf(' ');
          return (
            <span key={indice} role="button" tabIndex={0} className="fala-inline" lang={idioma} aria-label={t.audio.ouvirFrase(parte)}
              data-tocando={tocando === indice || undefined} onClick={() => ouvir(indice, parte)}
              onKeyDown={(evento) => {
                if (evento.key !== 'Enter' && evento.key !== ' ') return;
                evento.preventDefault();
                ouvir(indice, parte);
              }}>
              “{parte.slice(0, corte + 1)}<span className="sem-quebra">{parte.slice(corte + 1)}”<Icone nome="som" /></span>
            </span>
          );
        })}
      </p>
      <p className={semVoz ? 'aula-aviso-voz' : 'licao-origem'} role="status">{semVoz ? t.audio.semVozTexto : t.audio.toqueParaOuvir}</p>
    </>
  );
}

/** Na conclusão: as frases da lição, com a tradução, para ouvir mais uma vez (o "Falar" fica na aula). */
export function FrasesDaLicao({ falas }: { falas: Fala[] }) {
  return (
    <section className="falas falas--conclusao" aria-labelledby="frases-da-licao">
      <h2 id="frases-da-licao">{t.frasesDaLicao}</h2>
      {falas.some(({ pronuncia }) => pronuncia) && <p className="falas__legenda">{t.audio.comoLerPronuncia}</p>}
      <ul>
        {falas.map((fala, posicao) => (
          <li key={posicao}>
            <div className="falas__textos">
              <p className="falas__texto" lang={fala.idioma}>{fala.texto}</p>
              {fala.pronuncia && <p className="falas__pronuncia"><span className="somente-leitor">{t.audio.pronuncia}: </span>{fala.pronuncia}</p>}
              {fala.traducao && <p className="falas__traducao">{fala.traducao}</p>}
            </div>
            <BotoesOuvir fala={fala} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Exercício de escuta: o áudio primeiro; o texto aparece só quando a pessoa pede (ou quando não há voz). Depois do
 * acerto, o texto e a tradução ficam à vista, para fixar o que foi ouvido.
 */
function Escuta({ fala, acertou = false }: { fala: Fala; acertou?: boolean }) {
  const disponivel = useVozDisponivel();
  const [mostrar, setMostrar] = useState(false);
  const [tocando, tocar, semVoz] = useTocando(fala);
  // Sem voz para a frase, o texto aparece: sem áudio, ler é o único jeito de responder.
  useEffect(() => {
    if (semVoz) setMostrar(true);
  }, [semVoz]);
  return (
    <div className="escuta">
      <p className="escuta__rotulo"><Icone nome="som" />{t.audio.escuta}</p>
      {disponivel
        ? (
          <span className="ouvir ouvir--grande">
            <button type="button" className="ouvir__botao" data-tocando={tocando === 'normal' || undefined} onClick={() => tocar(false)}>
              <Icone nome="som" />{tocando === 'normal' ? t.audio.tocando : t.audio.ouvirExercicio}
            </button>
            <button type="button" className="ouvir__botao ouvir__botao--devagar" data-tocando={tocando === 'devagar' || undefined}
              onClick={() => tocar(true)}>{tocando === 'devagar' ? t.audio.tocando : t.audio.devagar}</button>
          </span>
        )
        : <p className="escuta__aviso">{t.audio.semVoz}</p>}
      {disponivel && semVoz && <p className="escuta__aviso" role="status">{t.audio.semVozFrase}</p>}
      {/* Depois do acerto, o texto já está à vista: o botão de mostrar sai. */}
      {!acertou && (
        <button type="button" className="escuta__texto" aria-expanded={mostrar} onClick={() => setMostrar((atual) => !atual)}>
          {mostrar ? t.audio.esconderTexto : t.audio.mostrarTexto}
        </button>
      )}
      {(mostrar || acertou) && <p className="trecho trecho--frase" lang={fala.idioma}>{fala.texto}</p>}
      {(mostrar || acertou) && fala.pronuncia && <p className="falas__pronuncia">{fala.pronuncia}</p>}
      {acertou && fala.traducao && <p className="escuta__traducao">{fala.traducao}</p>}
    </div>
  );
}

/** Texto com as lacunas destacadas. */
function ComLacunas({ texto, preenchimento }: { texto: string; preenchimento?: string }) {
  const partes = partesDaLacuna(texto);
  return (
    <>
      {partes.map((parte, posicao) => (
        <span key={posicao}>
          {parte}
          {posicao < partes.length - 1 && (
            <span className="trecho-lacuna" data-preenchida={preenchimento ? true : undefined} aria-label={preenchimento ? undefined : 'lacuna'}>
              {preenchimento || '  '}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

/** Trecho no visual do conteúdo: código em fonte monoespaçada; frase, citação, fórmula e passos com o visual de cada um. */
/** `preenchimento`: o que a pessoa escreve na lacuna, mostrado no lugar do espaço enquanto ela digita. */
function Trecho({ texto, tipo = 'frase', fala, preenchimento }: { texto: string; tipo?: TipoTrecho; fala?: Fala; preenchimento?: string }) {
  switch (tipo) {
    case 'codigo':
      return <pre className="licao-codigo"><code><ComLacunas texto={texto} preenchimento={preenchimento} /></code></pre>;
    case 'citacao':
      return <blockquote className="trecho trecho--citacao"><p><ComLacunas texto={semAspas(texto)} preenchimento={preenchimento} /></p></blockquote>;
    case 'formula':
      return <p className="trecho trecho--formula"><ComLacunas texto={texto} preenchimento={preenchimento} /></p>;
    case 'passos':
      return <ol className="trecho trecho--passos">{linhasDePassos(texto).map((linha, posicao) => <li key={posicao}><ComLacunas texto={linha} preenchimento={preenchimento} /></li>)}</ol>;
    default:
      return (
        <div className="trecho trecho--frase">
          <p lang={fala?.idioma}><ComLacunas texto={texto} preenchimento={preenchimento} /></p>
          {fala && <BotoesOuvir fala={fala} />}
        </div>
      );
  }
}

function EtapaExercicio({ exercicio, indice, total, resposta, mudar, avaliacao, ocupado, responder, formulario, titulo, consulta, dica,
  explicacao, exemplo, errouAntes = false }: {
  /** Recurso para consultar durante o exercício (diagrama, barra de fração, ilustração). A linha do tempo não: entregaria a ordem. */
  consulta?: Recurso;
  /** A explicação do Stu e o exemplo, para rever durante o exercício (recolhidos). */
  explicacao?: string;
  exemplo?: string;
  /** Já errou este exercício antes: a resposta modelo da aberta só aparece na segunda vez. */
  errouAntes?: boolean;
  /** A correção da tentativa anterior (errada): a dica fica embaixo do campo enquanto a pessoa tenta de novo. */
  dica?: Avaliacao | null;
  exercicio: ExercicioPublico;
  indice: number;
  total: number;
  resposta: string;
  mudar: (valor: string) => void;
  avaliacao: Avaliacao | null;
  ocupado: boolean;
  responder: (evento: FormEvent<HTMLFormElement>) => void;
  formulario: Ref<HTMLFormElement>;
  titulo: Ref<HTMLHeadingElement>;
}) {
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : undefined;
  const respondido = avaliacao !== null;
  let campo: ReactNode;
  switch (exercicio.tipo) {
    case 'lacuna':
      campo = (
        <div className="campo campo--resposta">
          <label htmlFor="resposta">{t.resposta}</label>
          <input id="resposta" name="resposta" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
            value={resposta} onChange={(evento) => mudar(evento.target.value)} required disabled={ocupado}
            readOnly={respondido} data-retorno={retorno} />
        </div>
      );
      break;
    case 'multipla_escolha':
      campo = (
        <fieldset className="opcoes" disabled={ocupado || respondido}>
          <legend>{t.resposta}</legend>
          {exercicio.opcoes.map((opcao, posicao) => (
            <label key={opcao.id} data-retorno={resposta === opcao.id ? retorno : undefined}>
              <input type="radio" name="resposta" value={opcao.id} required checked={resposta === opcao.id} onChange={() => mudar(opcao.id)} />
              <span className="opcao-tecla" aria-hidden="true">{String.fromCharCode(65 + posicao)}</span>
              <span>{opcao.texto}</span>
            </label>
          ))}
          <p className="opcoes-atalho">{t.atalho(exercicio.opcoes.length)}</p>
        </fieldset>
      );
      break;
    case 'ordenar':
      campo = <Ordenar itens={exercicio.itens} valor={resposta} mudar={mudar} desativado={ocupado || respondido} certos={avaliacao?.certos}
        fixos={avaliacao ? undefined : dica?.certos} />;
      break;
    case 'associar':
      campo = (
        <Associar esquerda={exercicio.esquerda} direita={exercicio.direita} valor={resposta} mudar={mudar}
          desativado={ocupado || respondido} certos={avaliacao?.certos} fixos={avaliacao ? undefined : dica?.certos} />
      );
      break;
    case 'verdadeiro_falso':
      campo = (
        <VerdadeiroFalso afirmacao={exercicio.afirmacao} justificativas={exercicio.justificativas} valor={resposta} mudar={mudar}
          desativado={ocupado || respondido} retorno={retorno} certos={avaliacao?.certos} />
      );
      break;
    case 'aberta':
      campo = (
        <div className="campo campo--aberta">
          <label htmlFor="resposta">{t.aberta.rotulo}</label>
          <textarea id="resposta" name="resposta" rows={5} maxLength={1000} value={resposta} required disabled={ocupado}
            readOnly={respondido} data-retorno={retorno} aria-describedby="aberta-dica aberta-contador"
            onChange={(evento) => mudar(evento.target.value)} />
          <p id="aberta-dica" className="campo__dica">{t.aberta.dica}</p>
          <p id="aberta-contador" className="campo__contador" data-pronto={tamanhoDaResposta(resposta) >= exercicio.minimo || undefined}>
            {t.aberta.contador(tamanhoDaResposta(resposta), exercicio.minimo)}
          </p>
        </div>
      );
      break;
  }

  return (
    <section className="aula-quadro" data-etapa="exercicio" data-tipo={exercicio.tipo} aria-labelledby="etapa-aula">
      <h1 id="etapa-aula" ref={titulo} tabIndex={-1} className="aula-pergunta">{exercicio.enunciado}</h1>
      {exercicio.contexto && <p>{exercicio.contexto}</p>}
      {exercicio.trecho && (
        <Trecho texto={exercicio.trecho} tipo={exercicio.trechoTipo} fala={exercicio.fala}
          preenchimento={exercicio.tipo === 'lacuna' ? resposta.trim().replace(/[.,;:!?…]+$/u, '') : undefined} />
      )}
      {!exercicio.trecho && exercicio.fala && <Escuta fala={exercicio.fala} acertou={avaliacao?.correta === true} />}
      <form id="resposta-licao" ref={formulario} className="formulario" method="post" onSubmit={responder}>
        {campo}
      </form>
      {dica && (
        <div className="aula-dica" role="note" aria-label={t.dicaAnterior}>
          <p className="aula-dica__titulo"><Icone nome="lampada" />{t.dicaAnterior}</p>
          <p>{dica.feedback}</p>
          {dica.observacao && <p>{dica.observacao}</p>}
        </div>
      )}
      {/* Para consultar, depois da resposta e recolhido: a pergunta e as opções ficam no alto. */}
      {explicacao && (
        <details className="aula-consulta aula-consulta--recolhivel" onToggle={mostrarAberto}>
          <summary>{t.reverExplicacao}</summary>
          <p>{explicacao}</p>
          {exemplo && <p><strong>{t.exemplo}:</strong> {exemplo}</p>}
        </details>
      )}
      {consulta && (
        <details className="aula-consulta aula-consulta--recolhivel" onToggle={mostrarAberto}>
          <summary>
            {consulta.tipo === 'acorde'
              ? consulta.anterior
                ? t.recursos.verTroca(consulta.anterior.nome, consulta.nome)
                : consulta.batida ? t.recursos.verBatida(consulta.nome) : t.recursos.verAcorde(consulta.nome)
              : consulta.tipo === 'imagem' ? t.recursos.verIlustracao : t.recursos.verFracao}
          </summary>
          <RecursoDaLicao recurso={consulta} />
        </details>
      )}
      {exercicio.tipo === 'aberta' && avaliacao && <CorrecaoAberta avaliacao={avaliacao} mostrarModelo={avaliacao.correta || errouAntes} />}
    </section>
  );
}

/** Ordenar tocando: cada toque coloca o item na próxima posição; tocar num item já colocado tira ele da ordem. */
function Ordenar({ itens, valor, mudar, desativado, certos, fixos }: {
  itens: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
  /** Na nova tentativa: os itens que já estavam na posição certa ficam travados nela, em verde; o resto vira vaga. */
  fixos?: string[];
}) {
  // As posições da resposta: um id ou uma vaga ("") deixada por um item que saiu; os travados não se mexem.
  const posicoes = valor ? valor.split(',').map((id) => (itens.some((item) => item.id === id) ? id : '')) : [];
  const travado = (id: string) => Boolean(fixos?.includes(id));
  const comTravados = posicoes.some(travado);
  const ordem = posicoes.filter(Boolean);
  const restantes = itens.filter((item) => !ordem.includes(item.id));
  const texto = (id: string) => itens.find((item) => item.id === id)?.texto ?? '';
  /** Um item entra na primeira vaga (ou no fim). */
  function colocar(id: string) {
    const vaga = posicoes.indexOf('');
    mudar((vaga >= 0 ? posicoes.map((atual, posicao) => (posicao === vaga ? id : atual)) : [...posicoes, id]).join(','));
  }
  /** Tirar um item: com itens travados, a posição vira vaga (os outros não andam); sem eles, a ordem se fecha. */
  function tirar(posicao: number) {
    const novas = comTravados ? posicoes.map((atual, indice) => (indice === posicao ? '' : atual)) : posicoes.filter((_, indice) => indice !== posicao);
    mudar(novas.some(Boolean) ? novas.join(',') : '');
  }
  return (
    <div className="ordenar">
      <p className="ordenar__instrucao">{t.ordenar.instrucao}</p>
      <p className="ordenar__rotulo" id="ordenar-escolhidos">{t.ordenar.suaOrdem}</p>
      <ol className="ordenar__escolhidos" aria-labelledby="ordenar-escolhidos">
        {posicoes.length === 0 && <li className="ordenar__vazio">{t.ordenar.vazio}</li>}
        {posicoes.map((id, posicao) => (id ? (
          <li key={id}>
            <button type="button" disabled={desativado || travado(id)}
              aria-label={travado(id) ? t.ordenar.travado(texto(id), posicao + 1) : t.ordenar.tirar(texto(id), posicao + 1)}
              data-estado={certos ? (certos.includes(id) ? 'certo' : 'errado') : travado(id) ? 'certo' : undefined}
              onClick={() => tirar(posicao)}>
              <span className="ordenar__numero" aria-hidden="true">{t.ordenar.posicao(posicao + 1)}</span>
              <span>{texto(id)}</span>
            </button>
          </li>
        ) : (
          <li key={`vaga-${posicao}`} className="ordenar__vaga">
            <span className="ordenar__numero" aria-hidden="true">{t.ordenar.posicao(posicao + 1)}</span>
            <span>{t.ordenar.vaga}</span>
          </li>
        )))}
      </ol>
      {restantes.length > 0 && (
        <div className="ordenar__disponiveis" role="group" aria-label={t.ordenar.disponiveis}>
          {restantes.map((item) => (
            <button key={item.id} type="button" disabled={desativado} aria-label={t.ordenar.colocar(item.texto)}
              onClick={() => colocar(item.id)}>
              {item.texto}
            </button>
          ))}
        </div>
      )}
      {ordem.some((id) => !travado(id)) && !desativado && (
        <button type="button" className="exercicio-recomecar"
          onClick={() => mudar(comTravados ? posicoes.map((id) => (travado(id) ? id : '')).join(',') : '')}>
          {t.ordenar.recomecar}
        </button>
      )}
    </div>
  );
}

/** Associar tocando: escolha um item da esquerda e depois o par na direita. Cada par ganha um número e uma cor. */
function Associar({ esquerda, direita, valor, mudar, desativado, certos, fixos }: {
  esquerda: Opcao[];
  direita: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
  /** Na nova tentativa: os itens da esquerda cujo par já estava certo (o par fica travado, em verde). */
  fixos?: string[];
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  /** Quem começa pela direita: o item fica escolhido e o próximo toque, na esquerda, fecha o par. */
  const [escolhidaDireita, setEscolhidaDireita] = useState<string | null>(null);
  const pares = valor.split(',').filter(Boolean).map((par) => par.split('=') as [string, string]);
  const travado = (idEsquerda?: string) => Boolean(idEsquerda && fixos?.includes(idEsquerda) && pares.some(([item]) => item === idEsquerda));
  const parDaEsquerda = (id: string) => pares.find(([item]) => item === id);
  const parDaDireita = (id: string) => pares.find(([, item]) => item === id);
  const numero = (id: string) => {
    const esquerdaDoPar = pares.find(([item, outro]) => item === id || outro === id)?.[0];
    return esquerda.findIndex((item) => item.id === esquerdaDoPar) + 1;
  };
  const texto = (lista: Opcao[], id: string) => lista.find((item) => item.id === id)?.texto ?? '';
  const salvar = (novos: [string, string][]) => mudar(codificarResposta.pares(novos));

  function tocarEsquerda(id: string) {
    if (escolhidaDireita) {
      salvar([...pares.filter(([item, outro]) => item !== id && outro !== escolhidaDireita), [id, escolhidaDireita]]);
      setEscolhidaDireita(null);
      return;
    }
    if (parDaEsquerda(id)) {
      salvar(pares.filter(([item]) => item !== id));
      setEscolhida(null);
      return;
    }
    setEscolhida((atual) => (atual === id ? null : id));
  }

  function tocarDireita(id: string) {
    if (!escolhida) {
      if (parDaDireita(id)) salvar(pares.filter(([, item]) => item !== id));
      else setEscolhidaDireita((atual) => (atual === id ? null : id));
      return;
    }
    salvar([...pares.filter(([item, outro]) => item !== escolhida && outro !== id), [escolhida, id]]);
    setEscolhida(null);
  }

  return (
    <div className="associar">
      <p className="associar__instrucao" aria-live="polite">
        {escolhida ? t.associar.escolhido(texto(esquerda, escolhida))
          : escolhidaDireita ? t.associar.escolhidoDireita(texto(direita, escolhidaDireita)) : t.associar.instrucao}
      </p>
      <div className="associar__colunas">
        <div role="group" aria-label={t.associar.esquerda}>
          {esquerda.map((item) => {
            const par = parDaEsquerda(item.id);
            const fixo = travado(item.id);
            return (
              <button key={item.id} type="button" disabled={desativado || fixo} aria-pressed={escolhida === item.id}
                aria-label={escolhidaDireita && !fixo ? t.associar.ligar(item.texto, texto(direita, escolhidaDireita))
                  : par ? (fixo ? t.associar.travado(item.texto, texto(direita, par[1])) : t.associar.desfazer(item.texto, texto(direita, par[1]))) : item.texto}
                data-par={par ? numero(item.id) : undefined} data-escolhida={escolhida === item.id || undefined}
                data-estado={certos ? (certos.includes(item.id) ? 'certo' : 'errado') : fixo ? 'certo' : undefined}
                onClick={() => tocarEsquerda(item.id)}>
                {par && <span className="associar__numero" aria-hidden="true">{numero(item.id)}</span>}
                <span>{item.texto}</span>
              </button>
            );
          })}
        </div>
        <div role="group" aria-label={t.associar.direita}>
          {direita.map((item) => {
            const par = parDaDireita(item.id);
            const fixo = travado(par?.[0]);
            const rotulo = fixo && par ? t.associar.travado(texto(esquerda, par[0]), item.texto)
              : escolhida ? t.associar.ligar(texto(esquerda, escolhida), item.texto)
                : par ? t.associar.desfazer(texto(esquerda, par[0]), item.texto) : item.texto;
            return (
              <button key={item.id} type="button" disabled={desativado || fixo} aria-label={rotulo} data-par={par ? numero(item.id) : undefined}
                aria-pressed={escolhidaDireita === item.id} data-escolhida={escolhidaDireita === item.id || undefined}
                data-estado={certos && par ? (certos.includes(par[0]) ? 'certo' : 'errado') : fixo ? 'certo' : undefined}
                onClick={() => tocarDireita(item.id)}>
                {par && <span className="associar__numero" aria-hidden="true">{numero(item.id)}</span>}
                <span>{item.texto}</span>
              </button>
            );
          })}
        </div>
      </div>
      {pares.some(([item]) => !travado(item)) && !desativado && (
        <button type="button" className="exercicio-recomecar"
          onClick={() => { salvar(pares.filter(([item]) => travado(item))); setEscolhida(null); }}>{t.associar.recomecar}</button>
      )}
    </div>
  );
}

/** Verdadeiro ou falso com justificativa: o valor e o porquê. */
function VerdadeiroFalso({ afirmacao, justificativas, valor, mudar, desativado, retorno, certos }: {
  /** Depois da correção: quais partes estão certas (`valor`, `justificativa`). */
  certos?: string[];
  afirmacao: string;
  justificativas: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  retorno?: 'certa' | 'errada';
}) {
  const [escolha = '', justificativa = ''] = valor.split(':');
  const salvar = (novaEscolha: string, novaJustificativa: string) => mudar(`${novaEscolha}:${novaJustificativa}`);
  const corDaParte = (parte: 'valor' | 'justificativa') => (retorno ? (certos?.includes(parte) ? 'certa' : 'errada') : undefined);
  return (
    <div className="vf">
      <blockquote className="vf__afirmacao"><p>{afirmacao}</p></blockquote>
      <fieldset className="vf__valores" disabled={desativado}>
        <legend>{t.verdadeiroFalso.valor}</legend>
        {(['verdadeiro', 'falso'] as const).map((opcao) => (
          <label key={opcao} data-valor={opcao} data-retorno={escolha === opcao ? corDaParte('valor') : undefined}>
            <input type="radio" name="vf-valor" value={opcao} checked={escolha === opcao} onChange={() => salvar(opcao, justificativa)} />
            <span>{opcao === 'verdadeiro' ? t.verdadeiroFalso.verdadeiro : t.verdadeiroFalso.falso}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="opcoes" disabled={desativado}>
        <legend>{t.verdadeiroFalso.porque}</legend>
        {justificativas.map((opcao, posicao) => (
          <label key={opcao.id} data-retorno={justificativa === opcao.id ? corDaParte('justificativa') : undefined}>
            <input type="radio" name="vf-justificativa" value={opcao.id} checked={justificativa === opcao.id}
              onChange={() => salvar(escolha, opcao.id)} />
            <span className="opcao-tecla" aria-hidden="true">{String.fromCharCode(65 + posicao)}</span>
            <span>{opcao.texto}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** Depois da resposta aberta: o que a correção procurou, se a resposta trouxe, e uma boa resposta de exemplo. */
function CorrecaoAberta({ avaliacao, mostrarModelo = true }: { avaliacao: Avaliacao; mostrarModelo?: boolean }) {
  return (
    <section className="correcao-aberta" aria-labelledby="correcao-titulo">
      {avaliacao.criterios && (
        <>
          <h3 id="correcao-titulo">{t.aberta.criterios}</h3>
          <ul>
            {avaliacao.criterios.map((criterio, posicao) => (
              <li key={posicao} data-atendido={criterio.atendido || undefined}>
                <Icone nome={criterio.atendido ? 'check' : 'fechar'} />
                <span><span className="somente-leitor">{criterio.atendido ? t.aberta.atendido : t.aberta.faltou}: </span>{criterio.texto}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {avaliacao.modelo && !mostrarModelo && <p className="correcao-aberta__nota">{t.aberta.modeloDepois}</p>}
      {avaliacao.modelo && mostrarModelo && (
        <div className="correcao-aberta__modelo">
          <h3>{t.aberta.modelo}</h3>
          <p>{avaliacao.modelo}</p>
        </div>
      )}
      {avaliacao.simulado && <p className="correcao-aberta__nota">{t.aberta.simulada}</p>}
    </section>
  );
}

/**
 * Prática no mundo real: a tarefa, os passos para conferir, a dica e um cronômetro; na volta, a pessoa conta como foi e
 * o Stu responde. A lição só conclui depois dessa resposta.
 */
function EtapaPratica({ pratica, titulo, escolha, escolher, recurso, passos, falas, reinicio = 0, restanteInicial, aoMudarRestante }: {
  /** O que faltava no cronômetro na última visita (a pessoa saiu no meio da prática). */
  restanteInicial?: number;
  /** A cada segundo, o que falta: a lição guarda no andamento. */
  aoMudarRestante?: (restante: number) => void;
  /** Muda a cada "Praticar mais um pouco": o cronômetro recomeça e a tela volta até ele. */
  reinicio?: number;
  /** O que a lição mostrou no exemplo, para consultar enquanto pratica. */
  recurso?: Recurso;
  passos?: string[];
  falas?: Fala[];
  pratica: Pratica;
  titulo: Ref<HTMLHeadingElement>;
  escolha: AutoAvaliacao | null;
  escolher: (valor: AutoAvaliacao) => void;
}) {
  const total = pratica.minutos * 60;
  const [restante, setRestante] = useState(() =>
    restanteInicial !== undefined && restanteInicial >= 0 && restanteInicial <= total ? restanteInicial : total);
  useEffect(() => {
    aoMudarRestante?.(restante);
    // Só o tempo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante]);
  const [rodando, setRodando] = useState(false);
  const cronometro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reinicio === 0) return;
    // "Praticar mais um pouco": o cronômetro continua de onde parou (ou recomeça, se tinha acabado) e já começa a contar,
    // em vez de voltar parado e apagar o que já foi praticado.
    setRestante((atual) => (atual > 0 ? atual : total));
    setRodando(true);
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cronometro.current?.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
  }, [reinicio, total]);
  const comoFoi = useRef<HTMLLegendElement>(null);
  const acabou = restante === 0;
  const comecou = restante < total;
  // Encerrar uma prática de minutos depois de 5 segundos não vale: o "Como foi?" espera um mínimo de prática.
  const minimo = Math.min(30, total);
  const [semCronometro, setSemCronometro] = useState(false);
  // O que já foi praticado não se perde no "Recomeçar" nem no "Praticar mais um pouco": conta todo o tempo corrido.
  const [praticadoTotal, setPraticadoTotal] = useState(total - restante);
  const praticado = Math.max(praticadoTotal, total - restante);
  const praticou = semCronometro || praticado >= minimo;

  useEffect(() => {
    if (!rodando) return;
    const intervalo = window.setInterval(() => {
      setPraticadoTotal((atual) => atual + 1);
      setRestante((atual) => {
        if (atual > 1) return atual - 1;
        setRodando(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(intervalo);
  }, [rodando]);

  useEffect(() => {
    if (!acabou) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    comoFoi.current?.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
  }, [acabou]);

  // A resposta do Stu aparece embaixo das opções: a tela rola para ela não ficar escondida atrás do rodapé.
  const respostaDoStu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!escolha) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    respostaDoStu.current?.scrollIntoView({ block: 'center', behavior: reduzido ? 'auto' : 'smooth' });
  }, [escolha]);

  let rotuloPrincipal: string = t.pratica.comecar;
  if (rodando) rotuloPrincipal = t.pratica.pausar;
  else if (restante < total) rotuloPrincipal = t.pratica.retomar;

  return (
    <section className="aula-quadro aula-pratica" data-etapa="pratica" aria-labelledby="etapa-aula">
      <h2 id="etapa-aula" ref={titulo} tabIndex={-1}>{t.pratica.titulo}</h2>
      <p className="aula-pratica__subtitulo">{t.pratica.subtitulo}</p>
      <p className="aula-pratica__tarefa">{pratica.tarefa}</p>
      {pratica.passos && (
        <ul className="aula-pratica__passos" aria-label={t.pratica.passos}>
          {pratica.passos.map((passo, posicao) => (
            <li key={posicao}><label><input type="checkbox" /><span>{passo}</span></label></li>
          ))}
        </ul>
      )}
      {pratica.dica && <p className="aula-pratica__dica"><Icone nome="lampada" /><span><strong>{t.pratica.dica}:</strong> {pratica.dica}</span></p>}
      <div className="cronometro" ref={cronometro} data-estado={acabou ? 'fim' : rodando ? 'rodando' : 'parado'}
        style={{ '--andamento': 1 - restante / total } as CSSProperties}>
        <div className="cronometro__mostrador" role="timer" aria-label={`${t.pratica.cronometro}: ${t.pratica.restante(formatarTempo(restante))}`}>
          <span aria-hidden="true">{formatarTempo(restante)}</span>
        </div>
        <div className="cronometro__acoes">
          {!acabou && <Botao variante={rodando ? 'secundario' : 'primario'} onClick={() => setRodando((atual) => !atual)}>{rotuloPrincipal}</Botao>}
          {restante < total && <Botao variante="texto" onClick={() => { setRodando(false); setRestante(total); }}>{t.pratica.recomecar}</Botao>}
        </div>
        {/* Depois de recomeçar, o mostrador volta ao início: o total praticado fica à vista. */}
        {praticado > total - restante && <p className="cronometro__total">{t.pratica.jaPraticou(formatarTempo(praticado))}</p>}
      </div>
      {pratica.som && <TocarSom rotulo={pratica.som.rotulo} casas={pratica.som.casas} />}
      {recurso?.tipo === 'acorde' && recurso.batida && <DiagramaAcorde recurso={recurso} longa soBatida />}
      {/* As opções ficam travadas até o mínimo de prática, mas o grupo não: um fieldset desativado desativaria também o
          "Já pratiquei sem o cronômetro", que existe justamente para esse momento. */}
      <fieldset className="como-foi" data-travado={!praticou && !escolha ? '' : undefined}>
        <legend ref={comoFoi} tabIndex={-1}>
          {acabou ? t.pratica.acabou
            : praticou || escolha ? t.pratica.comoFoi
              : comecou
                ? rodando ? t.pratica.continuePraticando(minimo - praticado) : t.pratica.retomeParaContar(minimo - praticado)
                : t.pratica.comeceAntes}
        </legend>
        {!praticou && !escolha && (
          <button type="button" className="como-foi__sem-cronometro" onClick={() => setSemCronometro(true)}>{t.audio.jaPratiquei}</button>
        )}
        <div className="como-foi__opcoes">
          {AUTOAVALIACOES.map((valor) => (
            <label key={valor} data-valor={valor}>
              <input type="radio" name="como-foi" value={valor} checked={escolha === valor} disabled={!praticou && !escolha}
                onChange={() => escolher(valor)} />
              <span>{t.pratica.opcoes[valor]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {/* Para o leitor de tela, um aviso só quando o "Como foi?" libera (a contagem visível mudaria a cada segundo). */}
      <p className="somente-leitor" role="status">{praticou && !escolha ? t.pratica.comoFoi : ''}</p>
      {escolha && (
        <div className="aula-explicacao aula-pratica__resposta" role="status" ref={respostaDoStu}>
          <Stu />
          <p className="aula-balao">{t.pratica.respostas[escolha]}</p>
        </div>
      )}
      {/* O material da lição fica no fim, para consultar: o cronômetro e o "Como foi?" vêm logo depois da tarefa. */}
      {(recurso || passos || falas) && (
        <div className="aula-consulta">
          <p className="aula-consulta__rotulo">{t.recursos.consultar}</p>
          {recurso && <RecursoDaLicao recurso={recurso} longa semBatida={recurso.tipo === 'acorde' && recurso.batida} />}
          {passos && (
            <ol className="trecho trecho--passos">{passos.map((passo, posicao) => <li key={posicao}>{passo}</li>)}</ol>
          )}
          {falas && <Falas falas={falas} />}
        </div>
      )}
    </section>
  );
}
