import { ApoioDaLicao } from './estudio-adaptativo';
import type { ClienteEstudio, NomeStu } from '@studoo/contratos';
import type { ClienteElegibilidadeVoz } from './voz-ao-vivo-painel';
import {
  acertouParte,
  embaralharExercicio,
  etapasDaLicao,
  exerciciosDaLicao,
  faltaParaVerificar,
  motivoParaRever,
  ordemInicial,
  respostaParaTentarDeNovo,
  respostaCompleta,
  ultimoExercicio,
  type AutoAvaliacao,
  type Avaliacao,
  type EtapaAula,
  type ExercicioPublico,
  type LicaoDetalhe,
} from '@studoo/contratos';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAparecer, usePulinho, useTremor } from './animacoes';
import {
  TranscritorContexto,
  Associar,
  CampoAberta,
  CorrecaoAberta,
  Escuta,
  EtapaPratica,
  Falas,
  Passos,
  RecursoDaLicao,
  TextoComFalas,
  Trecho,
  VerdadeiroFalso,
  pararVoz,
} from './aula-formatos';
import { Confete } from './festa';
import { Ordenar } from './ordenar';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoErro, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido, caixaAlta, SeloDemonstracao, Chevron, degrauFora, quebraEquilibrada } from './interface';
import { mensagens, textoDaFalta } from './mensagens';
import { Opcao, letras } from './opcao';
import { BotaoSom } from './som';
import { Stu } from './mascote';
import { tocaSons } from './sons';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

/**
 * O que a pessoa fez na lição, para o resumo da conclusão: `acertos` de `exercicios` (quem segue com um erro termina com
 * menos acertos) e `rever` quando ficou exercício sem acerto ou a prática em "ainda não". Como na web.
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
  /** Alguma ponte de reforço foi vencida nesta visita: a conclusão mostra o cartão da ponte (só com conteúdo real). */
  ponteConstruida?: boolean;
  /** A pessoa explicou ao Stu nesta visita: a conclusão mostra o cartão do ensino. */
  ensinouStu?: boolean;
};

/** O andamento de uma lição, guardado em memória para a pessoa continuar de onde parou (como na web). */
type Andamento = {
  passo: number;
  respostas: string[];
  avaliacoes: (Avaliacao | null)[];
  primeiras: (boolean | null)[];
  tentativas: number;
  comprovante: string | null;
  autoAvaliacao: AutoAvaliacao | null;
  revisao: number[] | null;
  /** Segundos já estudados, para o tempo do resumo seguir de onde parou. Como na web. */
  segundos?: number;
  /** O que faltava no cronômetro da prática. Como na web. */
  praticaRestante?: number;
  /** Pontes vencidas e explicação ao Stu desta visita: quem sai e volta no meio ainda vê os cartões da conclusão. */
  pontes?: Record<number, boolean>;
  ensinou?: boolean;
  salvoEm: number;
};
const andamentos = new Map<string, Andamento>();
/** As trilhas com alguma lição começada (e quando): o cartão da trilha diz Continuar. Como na web. */
const planosComAndamento = new Map<string, number>();

export function temAndamentoNoPlano(planoId: string): boolean {
  const salvo = planosComAndamento.get(planoId);
  return Boolean(salvo && Date.now() - salvo < 86_400_000);
}

/** Se a lição foi começada e tem andamento guardado (o mapa diz Continuar). */
export function temAndamento(id: string): boolean {
  const salvo = andamentos.get(id);
  return Boolean(salvo && salvo.passo > 0 && Date.now() - salvo.salvoEm < 86_400_000);
}

function lerAndamento(licao: LicaoDetalhe, etapas: number, exercicios: number): Andamento | null {
  const salvo = andamentos.get(licao.id);
  if (licao.concluida || !salvo || Date.now() - salvo.salvoEm > 86_400_000 || salvo.passo <= 0 || salvo.passo >= etapas) return null;
  return [salvo.respostas, salvo.avaliacoes, salvo.primeiras].every((lista) => lista.length === exercicios) ? salvo : null;
}

const t = mensagens.licao;
const iconesDaEtapa: Record<EtapaAula['tipo'], NomeIcone> = { conceito: 'livro', exemplo: 'lampada', exercicio: 'alvo', pratica: 'relogio' };
const coresDaEtapa: Record<EtapaAula['tipo'], { texto: string; fundo: string }> = {
  conceito: { texto: cores.acao, fundo: '#E7ECFF' },
  exemplo: { texto: '#8A5A00', fundo: '#FFF1CC' },
  exercicio: { texto: cores.sucesso, fundo: '#E3F6EA' },
  pratica: { texto: '#6B3FA0', fundo: '#F1E8FB' },
};

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo), como na web. */
/** A resposta com que um exercício começa: no ordenar em lista única (spec 08, 19/11), a ordem do servidor; nos outros, vazia. */
function respostaDoComeco(exercicio: ExercicioPublico): string {
  return exercicio.tipo === 'ordenar' ? ordemInicial(exercicio) : '';
}

/**
 * A resposta guardada de quem saiu no meio. No ordenar, só serve uma ordem com todos os itens (o andamento de antes da
 * lista única guardava fichas, com vagas): senão, a ordem do servidor.
 */
function respostaRetomada(exercicio: ExercicioPublico, guardada: string | undefined): string {
  if (exercicio.tipo !== 'ordenar') return guardada ?? '';
  const ids = exercicio.itens.map((item) => item.id);
  const lidos = (guardada ?? '').split(',').filter((id) => ids.includes(id));
  return lidos.length === ids.length && new Set(lidos).size === ids.length ? lidos.join(',') : ordemInicial(exercicio);
}

function tituloDoAcerto(id: string) {
  let soma = 0;
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) >>> 0;
  return t.certas[soma % t.certas.length];
}

/** Linhas extras do retorno: o aviso da correção e, no ordenar e no associar, quantos já estão certos. */
function extrasDoRetorno(avaliacao: Avaliacao, exercicio: ExercicioPublico | null): string[] {
  const linhas = avaliacao.observacao ? [avaliacao.observacao] : [];
  if (!avaliacao.correta && avaliacao.certos && exercicio?.tipo === 'ordenar') linhas.push(t.ordenar.certos(avaliacao.certos.length, exercicio.itens.length));
  if (!avaliacao.correta && avaliacao.certos && exercicio?.tipo === 'associar') linhas.push(t.associar.certos(avaliacao.certos.length, exercicio.esquerda.length));
  return linhas;
}

/**
 * A resposta em texto legível, para a 1ª tábua da ponte ("Sua tentativa: 3"): o texto da opção, dos itens na ordem
 * escolhida, dos pares ou do verdadeiro/falso com o porquê, nunca o código interno. A mesma regra da web (aula.tsx).
 */
function respostaLegivel(exercicio: ExercicioPublico, resposta: string): string {
  const limpa = resposta.trim();
  if (!limpa) return '';
  switch (exercicio.tipo) {
    case 'multipla_escolha':
      return exercicio.opcoes.find((opcao) => opcao.id === limpa)?.texto ?? '';
    case 'ordenar':
      return limpa.split(',').map((id) => exercicio.itens.find((item) => item.id === id)?.texto).filter(Boolean).join(' · ');
    case 'associar':
      return limpa.split(',').map((par) => {
        const [esquerda, direita] = par.split('=');
        const e = exercicio.esquerda.find((item) => item.id === esquerda)?.texto;
        const d = exercicio.direita.find((item) => item.id === direita)?.texto;
        return e && d ? `${e} → ${d}` : '';
      }).filter(Boolean).join(' · ');
    case 'verdadeiro_falso': {
      const [valor = '', porque = ''] = limpa.split(':');
      const rotulo = valor === 'verdadeiro' ? t.verdadeiroFalso.verdadeiro : valor === 'falso' ? t.verdadeiroFalso.falso : '';
      const justificativa = exercicio.justificativas.find((item) => item.id === porque)?.texto;
      return rotulo && justificativa ? `${rotulo} · ${justificativa}` : rotulo;
    }
    default:
      return limpa;
  }
}

/**
 * Aula por etapas, como na web (spec 02), com o número de etapas de cada lição: conceito, exemplo (ou demonstração, com
 * recurso, passos e frases para ouvir), de um a três exercícios de formatos variados e, quando a lição pede, a prática no
 * mundo real com cronômetro. Depois da resposta, o rodapé vira o painel de retorno, verde no acerto (com confete) ou
 * âmbar no erro (o exercício treme); dá para tentar de novo ou continuar. Continuar segue para a próxima etapa; na última,
 * registra a conclusão (se a confirmação expirar, a aula volta ao último exercício). O título de cada etapa e o do retorno
 * recebem o foco do leitor de tela.
 */
export function Licao({ cliente, licao, erro, pendente, voltar, saida, avaliar, concluir }: {
  /** O cliente do app (com `configuracaoAcesso` e `sessao`, a conversa ao vivo do Explique pode aparecer na prévia web). */
  cliente: ClienteEstudio & Pick<ClienteElegibilidadeVoz, 'configuracaoAcesso' | 'sessao'>;
  licao: LicaoDetalhe;
  erro: string | null;
  pendente: string | null;
  voltar: () => void;
  /** Onde a tela guarda o "sair" da lição, para o voltar do aparelho fazer o mesmo que o X. */
  saida?: MutableRefObject<(() => void) | null>;
  avaliar: (resposta: string, indice: number) => Promise<Avaliacao | null>;
  concluir: (comprovante: string, resumo: ResumoLicao, pratica?: AutoAvaliacao) => Promise<boolean>;
}) {
  // .aula-quadro da web: respiro clamp(16px, 5vw, 28px) (19,5 px em 390, 18 em 360).
  const { width: larguraJanela } = useWindowDimensions();
  const respiroQuadro = { padding: Math.min(28, Math.max(16, larguraJanela * 0.05)) };
  const etapas = useMemo(() => etapasDaLicao(licao), [licao]);
  // Como na web: as opções mudam de ordem a cada visita.
  const [semente] = useState(() => Math.floor(Math.random() * 2 ** 31));
  /** Cada revisão rápida embaralha de novo. Como na web. */
  const [rodadaDeOpcoes, setRodadaDeOpcoes] = useState(0);
  const exercicios = useMemo(
    () => exerciciosDaLicao(licao).map((exercicio, numero) => embaralharExercicio(exercicio, semente + numero + rodadaDeOpcoes * 7919)),
    [licao, semente, rodadaDeOpcoes],
  );
  // Quem saiu no meio continua de onde parou.
  const [retomada] = useState(() => lerAndamento(licao, etapas.length, exercicios.length));
  const [passo, setPasso] = useState(retomada?.passo ?? 0);
  const [respostas, setRespostas] = useState<string[]>(() => exercicios.map((exercicio, numero) => respostaRetomada(exercicio, retomada?.respostas?.[numero])));
  /** Ordenar em lista única (spec 08, 19/11): a ordem com que cada tentativa começou (o "Voltar à ordem inicial" e a falta). */
  const [iniciais, setIniciais] = useState<string[]>(() => exercicios.map(respostaDoComeco));
  const [avaliacoes, setAvaliacoes] = useState<(Avaliacao | null)[]>(() => retomada?.avaliacoes ?? exercicios.map(() => null));
  const [primeiras, setPrimeiras] = useState<(boolean | null)[]>(() => retomada?.primeiras ?? exercicios.map(() => null));
  const [tentativas, setTentativas] = useState(retomada?.tentativas ?? 0);
  const [comprovante, setComprovante] = useState<string | null>(retomada?.comprovante ?? null);
  const [autoAvaliacao, setAutoAvaliacao] = useState<AutoAvaliacao | null>(retomada?.autoAvaliacao ?? null);
  /** Revisão antes de concluir: os exercícios que ficaram sem acerto voltam uma vez, nesta ordem. */
  const [revisao, setRevisao] = useState<number[] | null>(retomada?.revisao ?? null);
  const [avisoRetomada, setAvisoRetomada] = useState(retomada !== null);
  /** A última correção errada de cada exercício: a dica fica embaixo do campo na nova tentativa. Como na web. */
  const [errosAnteriores, setErrosAnteriores] = useState<(Avaliacao | null)[]>(() => exercicios.map(() => null));
  // Onde fica a prática e, dentro dela, o "Como foi?": para rolar até a pergunta.
  const praticaY = useRef(0);
  const comoFoiY = useRef(0);
  /** Nas etapas de leitura: ainda tem conteúdo abaixo da parte visível (o botão diz "Continuar lendo"). Como na web. */
  const [temMais, setTemMais] = useState(false);
  const alturaConteudo = useRef(0);
  /** Chegou ao fim desta etapa: o "Continuar lendo" não volta (um som tocando muda a altura do conteúdo). */
  const chegouAoFim = useRef(false);
  /**
   * A medida inicial da etapa já passou (250 ms depois da troca): só então o "fim" fica preso. Antes, as medidas podem
   * chegar fora de ordem (a altura visível antes da do conteúdo, o rodapé de vidro medido por último) e o fim seria
   * decidido cedo demais, com conteúdo embaixo do rodapé (iPhone, 20/11).
   */
  const medidaPronta = useRef(false);
  /** A conferência do "Continuar lendo": se a tela não andou, não há mais o que rolar (o rodapé vira "Avançar"). */
  const conferirLeitura = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [errosSeguidos, setErrosSeguidos] = useState(0);
  const [pedidoPonte, setPedidoPonte] = useState(0);
  /** O rodapé que a ponte clara entrega (a ação do passo atual), ou null. */
  const [rodapePonte, setRodapePonte] = useState<ReactNode | null>(null);
  const [consultaAberta, setConsultaAberta] = useState(false);
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);
  /** O reforço deste exercício foi feito: o painel troca o "Quase lá!" pelo convite a tentar de novo. Como na web. */
  const [ponteFeita, setPonteFeita] = useState(false);
  /** Citação aberta no conceito (a primeira, quando a lição veio do material), como na web. */
  const [citacaoAberta, setCitacaoAberta] = useState<number | null>(() => (licao.referencias?.length ? 0 : null));
  /** Pontes vencidas nesta visita, por exercício: o Stu comemora a travessia e a conclusão conta a ponte. Como na web. */
  const [pontesPorExercicio, setPontesPorExercicio] = useState<Record<number, boolean>>(() => retomada?.pontes ?? {});
  /** O "Explique com suas palavras" está aberto: o painel de retorno fica só com o título e as ações. Como na web. */
  const [expliqueAberto, setExpliqueAberto] = useState(false);
  /** A pessoa já explicou ao Stu nesta visita: o convite do acerto sai. Como na web. */
  const [ensinou, setEnsinou] = useState(retomada?.ensinou ?? false);
  /** Cada toque no convite "Quer fixar? Explique com suas palavras" abre o "Explique" e leva até ele. */
  const [pedidoEnsino, setPedidoEnsino] = useState(0);
  /** No exercício e na prática, há conteúdo abaixo da parte visível (reforço, consulta, "Explique", "Como foi?"). */
  const [temAbaixo, setTemAbaixo] = useState(false);
  // A pílula "Ver mais abaixo" divide o rodapé com o painel de retorno: o painel desconta a altura dela (cabe em metade da janela).
  const [alturaDaPilula, setAlturaDaPilula] = useState(0);
  // Onde fica o exercício: para levar a consulta aberta para cima do painel de retorno.
  const exercicioY = useRef(0);
  const [inicio] = useState(() => Date.now() - (retomada?.segundos ?? 0) * 1000);
  /** Cada "Praticar mais um pouco" recomeça o cronômetro da prática. Como na web. */
  const [voltasPratica, setVoltasPratica] = useState(0);
  const praticaRestante = useRef<number | undefined>(retomada?.praticaRestante);
  /** Quantos exercícios a revisão rápida trouxe, para o contador "Revisão 1 de 2". Como na web. */
  const [revisaoTotal, setRevisaoTotal] = useState(retomada?.revisao?.length ?? 0);
  const tituloEtapa = useRef<ComponentRef<typeof Text>>(null);
  /** O cartão da fonte e onde ele está: o marcador [n] leva até ele e dá o foco (citação focal, rodada 4I da web). */
  const cartaoCitacao = useRef<ComponentRef<typeof View>>(null);
  const citacaoY = useRef(0);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const apoioPosicao = useRef(0);
  const [apoioVazio, setApoioVazio] = useState(true);
  // Para rolar até o fim do exercício depois da correção: onde ele termina, quanto já rolou e a altura visível.
  const fimDoExercicio = useRef(0);
  const posicaoRolagem = useRef(0);
  /** Como na web: onde a pessoa estava em cada etapa ao sair dela, para a "Etapa anterior" voltar para lá. */
  const posicoesDasEtapas = useRef<Record<number, number>>({});
  const voltandoEtapa = useRef(false);
  const alturaVisivel = useRef(0);
  const reduzir = useMovimentoReduzido();
  const tremor = useTremor(errosSeguidos);

  const etapa = etapas[passo];
  const indice = etapa.tipo === 'exercicio' ? etapa.indice : -1;
  const exercicio = indice >= 0 ? exercicios[indice] : null;
  const resposta = indice >= 0 ? respostas[indice] : '';
  const avaliacao = indice >= 0 ? avaliacoes[indice] : null;
  const ocupado = pendente !== null;
  const total = etapas.length;
  const ultima = passo === total - 1;
  // Na revisão, o contador voltaria para trás: o topo diz "Revisão rápida" e a barra fica cheia. Como na web.
  const andamento = revisao && exercicio ? t.revisaoAndamento : t.posicao(passo + 1, total);
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : null;
  let nomeEtapa: string = t.conceito;
  if (etapa.tipo === 'exemplo') nomeEtapa = licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo;
  else if (etapa.tipo === 'pratica') nomeEtapa = t.pratica.etapa;
  else if (etapa.tipo === 'exercicio') {
    nomeEtapa = revisao
      ? t.revisaoDe(Math.max(1, revisaoTotal - revisao.length + 1), Math.max(revisaoTotal, revisao.length))
      : exercicios.length > 1 ? t.exercicioDe(indice + 1, exercicios.length) : t.exercicio;
  }
  // A reação do Stu mora no painel de retorno (spec 13, emenda de 19/11): só depois da resposta.
  const reacaoDoStu: ReacaoDoStu | undefined = !avaliacao ? undefined : !avaliacao.correta ? 'erro'
    : pontesPorExercicio[indice] ? 'ponte' : primeiras[indice] === true ? 'primeira' : 'acerto';

  useEffect(() => {
    // Cada etapa começa do topo, como uma tela nova (menos na volta pela "Etapa anterior", que reabre onde a pessoa
    // estava); a voz de uma etapa não continua na outra.
    const destino = voltandoEtapa.current ? posicoesDasEtapas.current[passo] ?? 0 : 0;
    voltandoEtapa.current = false;
    rolagem.current?.scrollTo({ y: 0, animated: false });
    posicaoRolagem.current = 0;
    // O conteúdo da etapa ainda está sendo medido: a volta à posição espera um instante.
    const volta = destino > 0 ? setTimeout(() => { rolagem.current?.scrollTo({ y: destino, animated: false }); posicaoRolagem.current = destino; }, 80) : undefined;
    chegouAoFim.current = false;
    medidaPronta.current = false;
    // Uma conferência do "Continuar lendo" da etapa anterior não vale para esta.
    clearTimeout(conferirLeitura.current);
    const medida = setTimeout(() => { medidaPronta.current = true; medirMais(); }, 250);
    pararVoz();
    // O reforço é de cada exercício: um pedido antigo não vale para o próximo.
    setPedidoPonte(0);
    setPonteFeita(false);
    setExplicacaoAberta(false);
    if (passo === 0) return () => { clearTimeout(medida); clearTimeout(volta); };
    const espera = setTimeout(() => {
      if (tituloEtapa.current) AccessibilityInfo.sendAccessibilityEvent(tituloEtapa.current, 'focus');
    }, 120);
    return () => {
      clearTimeout(espera);
      clearTimeout(medida);
      clearTimeout(volta);
    };
    // medirMais lê as medidas do momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, revisao]);

  // O aviso de "continuou de onde parou" vale para a etapa em que a pessoa voltou; na seguinte, sai.
  useEffect(() => {
    if (retomada && passo !== retomada.passo) setAvisoRetomada(false);
  }, [passo, retomada]);

  /** Confere se o fim do conteúdo (a legenda, o passo a passo) ainda está abaixo da parte visível. */
  function medirMais() {
    // Sem as duas medidas (a parte visível e a altura real do conteúdo), nada se decide: com uma delas em zero, o fim
    // parecia já à vista (iPhone, 20/11).
    if (!alturaVisivel.current || !alturaConteudo.current) return;
    const falta = alturaConteudo.current - (posicaoRolagem.current + alturaVisivel.current);
    // Como na web: no exercício e na prática, um aviso discreto no rodapé leva ao que ficou abaixo (antes, nada mostrava).
    const abaixo = (etapa.tipo === 'exercicio' || etapa.tipo === 'pratica') && falta > 48;
    setTemAbaixo((antes) => (antes === abaixo ? antes : abaixo));
    if (chegouAoFim.current) return;
    const leitura = etapa.tipo === 'conceito' || etapa.tipo === 'exemplo';
    const novo = leitura && falta > 24;
    if (leitura && !novo && medidaPronta.current) chegouAoFim.current = true;
    setTemMais((antes) => (antes === novo ? antes : novo));
  }

  /** "Continuar lendo": rola mais um pedaço do conteúdo. */
  function lerMais() {
    const antes = posicaoRolagem.current;
    rolagem.current?.scrollTo({ y: antes + alturaVisivel.current * 0.75, animated: reduzir === false });
    // Rede de segurança (iPhone, 20/11): um toque em "Continuar lendo" nunca fica sem efeito. Se a tela não andou, o fim já
    // está à vista: o rodapé vira "Avançar" (e a pílula "Ver mais abaixo" sai). Nada fica para trás, porque nada rolou.
    clearTimeout(conferirLeitura.current);
    conferirLeitura.current = setTimeout(() => {
      if (Math.abs(posicaoRolagem.current - antes) >= 1) return;
      chegouAoFim.current = true;
      setTemMais(false);
      setTemAbaixo(false);
    }, reduzir === false ? 600 : 200);
  }

  /** Leva até o "Como foi?" da prática (no fim do cronômetro ou ao concluir sem contar como foi). */
  function mostrarComoFoi() {
    rolagem.current?.scrollTo({ y: Math.max(0, 24 + praticaY.current + comoFoiY.current - 80), animated: reduzir === false });
  }

  useEffect(() => () => { pararVoz(); clearTimeout(conferirLeitura.current); }, []);

  // Um erro novo (rede no Verificar, conclusão que não foi registrada) aparece no alto: a tela sobe até ele.
  useEffect(() => {
    if (erro) rolagem.current?.scrollTo({ y: 0, animated: reduzir === false });
  }, [erro, reduzir]);

  useEffect(() => {
    if (!avaliacao) return;
    // O painel de retorno ocupa mais rodapé: espera a nova medida da rolagem e leva o fim do exercício (itens certos e
    // errados, correção) para dentro da tela.
    const espera = setTimeout(() => {
      // O exercício é medido dentro da etapa; a etapa começa depois do respiro do topo da rolagem (24) e sobra uma folga (16).
      const sobra = fimDoExercicio.current + 24 + 16 - (posicaoRolagem.current + alturaVisivel.current);
      if (sobra > 0 && alturaVisivel.current > 0) rolagem.current?.scrollTo({ y: posicaoRolagem.current + sobra, animated: reduzir === false });
    }, 180);
    return () => clearTimeout(espera);
  }, [avaliacao, reduzir]);

  // Guarda o andamento a cada passo; o começo intocado não precisa.
  useEffect(() => {
    if (licao.concluida || (passo === 0 && tentativas === 0)) return;
    planosComAndamento.set(licao.planoId, Date.now());
    andamentos.set(licao.id, {
      passo, respostas, avaliacoes, primeiras, tentativas, comprovante, autoAvaliacao, revisao,
      segundos: Math.round((Date.now() - inicio) / 1000), salvoEm: Date.now(),
      ...(praticaRestante.current !== undefined ? { praticaRestante: praticaRestante.current } : {}),
      // Defeito d da rodada 4: sem isso, quem saía e voltava no meio perdia o cartão "Ponte construída" na conclusão.
      pontes: pontesPorExercicio, ensinou,
    });
  }, [licao.id, licao.concluida, passo, respostas, avaliacoes, primeiras, tentativas, comprovante, autoAvaliacao, revisao, pontesPorExercicio, ensinou]);

  /** Sair da lição: o andamento fica guardado, então sai direto (e continua de onde parou na volta). */
  function sair() {
    voltar();
  }

  /**
   * Recomeçar do zero (quem voltou no meio e prefere começar de novo). Como na web, pergunta na própria linha do aviso
   * ("…? Recomeçar do zero · Cancelar"), porque as respostas desta vez se perdem.
   */
  const [confirmandoRecomeco, setConfirmandoRecomeco] = useState(false);

  function recomecarAgora() {
    andamentos.delete(licao.id);
    setPasso(0);
    setRespostas(exercicios.map(respostaDoComeco));
    setIniciais(exercicios.map(respostaDoComeco));
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

  useEffect(() => {
    if (!saida) return;
    saida.current = sair;
    return () => { saida.current = null; };
  });

  /** O marcador [n] abre aquela fonte (não fecha) e leva a tela e o leitor de tela até o cartão, como a web. */
  function mostrarCitacao(numero: number) {
    setCitacaoAberta(numero);
    setTimeout(() => {
      rolagem.current?.scrollTo({ y: Math.max(0, citacaoY.current - 16), animated: reduzir === false });
      if (cartaoCitacao.current) AccessibilityInfo.sendAccessibilityEvent(cartaoCitacao.current, 'focus');
    }, 80);
  }

  function mudarResposta(valor: string) {
    setRespostas((atuais) => atuais.map((atual, posicao) => (posicao === indice ? valor : atual)));
  }

  /** "Tentar de novo" devolve o foco do leitor de tela ao exercício (o painel com o botão some), como a web faz com o campo. */
  const [voltaAoExercicio, setVoltaAoExercicio] = useState(0);
  useEffect(() => {
    if (voltaAoExercicio === 0) return;
    const espera = setTimeout(() => {
      if (tituloEtapa.current) AccessibilityInfo.sendAccessibilityEvent(tituloEtapa.current, 'focus');
    }, 120);
    return () => clearTimeout(espera);
  }, [voltaAoExercicio]);

  async function enviar() {
    if (ocupado || !exercicio || avaliacao || !respostaCompleta(exercicio, resposta, iniciais[indice])) return;
    const resultado = await avaliar(resposta, indice);
    if (!resultado) return;
    // O som do resultado (spec 12); a reação do Stu no painel não tem som próprio.
    void tocaSons.tocarEfeito(resultado.correta ? 'acerto' : 'erro');
    setTentativas((soma) => soma + 1);
    setPrimeiras((atuais) => atuais.map((atual, posicao) => (posicao === indice ? atual ?? resultado.correta : atual)));
    if (!resultado.correta) setErrosSeguidos((soma) => soma + 1);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? resultado : atual)));
    setComprovante(resultado.comprovante);
  }

  function tentarDeNovo() {
    // Da ponte em foco ("Voltar ao exercício"), o exercício reaparece do alto, com a pergunta à vista.
    if (pedidoPonte > 0) rolagem.current?.scrollTo({ y: 0, animated: false });
    // A ponte fecha: um novo erro mostra de novo o "Ver outro jeito de entender" (defeito a da rodada 4: o pedido antigo
    // reabria a ponte vencida, com o "Entendi!", logo depois do erro).
    setPedidoPonte(0);
    setPonteFeita(false);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? null : atual)));
    setErrosAnteriores((atuais) => atuais.map((atual, posicao) => (posicao === indice ? avaliacao : atual)));
    // Fica o que estava certo (na aberta, o texto todo); o resto recomeça. Como na web. No ordenar, a ordem fica inteira (os
    // certos travam) e ela passa a ser a ordem com que a nova tentativa começou.
    if (exercicio && avaliacao) {
      const nova = respostaParaTentarDeNovo(exercicio, resposta, avaliacao);
      mudarResposta(nova);
      if (exercicio.tipo === 'ordenar') setIniciais((atuais) => atuais.map((atual, posicao) => (posicao === indice ? nova : atual)));
    }
    setVoltaAoExercicio((atual) => atual + 1);
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
    const novas = respostas.map((atual, posicao) => {
      const anterior = avaliacoes[posicao];
      if (!pendentes.includes(posicao)) return atual;
      // Na revisão, a lacuna volta vazia (a dica da tentativa anterior mostra o que foi escrito): com o texto errado de
      // volta, parecia que o "Pular" não tinha feito nada.
      if (exercicios[posicao].tipo === 'lacuna') return '';
      return anterior ? respostaParaTentarDeNovo(exercicios[posicao], atual, anterior) : respostaDoComeco(exercicios[posicao]);
    });
    setRespostas(novas);
    setIniciais((atuais) => atuais.map((atual, posicao) => (pendentes.includes(posicao) && exercicios[posicao].tipo === 'ordenar' ? novas[posicao] : atual)));
    setPasso(etapaDoExercicio(pendentes[0]));
  }

  async function avancar() {
    if (ocupado) return;
    posicoesDasEtapas.current[passo] = posicaoRolagem.current;
    // Na revisão, segue para o próximo exercício que ficou para trás; acabou a fila, conclui. Como na web.
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
      andamentos.delete(licao.id);
      return;
    }
    setRevisao(null);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === exercicios.length - 1 ? null : atual)));
    setPasso(ultimoExercicio(etapas));
  }

  /** Rodada 4D da web: com a ponte aberta, o exercício recolhe e o rodapé sai; a ponte fica sozinha na tela. */
  const ponteAberta = Boolean(avaliacao && !avaliacao.correta && pedidoPonte > 0);

  const topo = (
    <View style={licaoEstilos.topo}>
      {/* .aula-fechar .icone: 26 px com traço 3. */}
      <BotaoIcone icone="fechar" tamanho={26} traco={3} rotulo={t.voltar} testID="voltar-plano" desativado={ocupado} acao={sair} />
      <View style={licaoEstilos.topoColuna}>
        <View style={licaoEstilos.andamento} accessible accessibilityRole="progressbar" accessibilityLabel={andamento}
          accessibilityValue={{ min: 0, max: total, now: revisao ? total : passo + 1 }}>
          {/* Como a web (aula.tsx): meia etapa enquanto a etapa atual não foi vencida; a etapa inteira depois do acerto. */}
          <BarraDaAula fracao={revisao ? 1 : (avaliacao?.correta ? passo + 1 : passo + 0.5) / total} certa={avaliacao?.correta === true} />
          <Text style={licaoEstilos.posicao}>{andamento}</Text>
        </View>
        {/* Como na web (rodada 4B): o nome da lição fica pequeno no topo; no exercício, o título é a pergunta. */}
        <Text testID="titulo-topo" numberOfLines={1} style={licaoEstilos.tituloTopo}>{licao.titulo}</Text>
      </View>
      {/* Spec 12: o som no alto, à direita do andamento (a folha e o botão moram em som.tsx). */}
      <BotaoSom />
    </View>
  );

  let rodape: ReactNode;
  if (avaliacao) {
    rodape = (
      <PainelRetorno avaliacao={avaliacao} reacao={reacaoDoStu}
        // A pílula fica acima, com as margens de -6 e -2 e o vão de 10 do rodapé.
        reservaAcima={temAbaixo && etapa.tipo === 'exercicio' && alturaDaPilula > 0 ? alturaDaPilula - 6 - 2 + 10 : 0}
        titulo={avaliacao.correta
          ? avaliacao.criterios?.some(({ atendido }) => !atendido) ? t.quaseCompleta : tituloDoAcerto(`${licao.id}-${indice}`)
          : ponteFeita ? t.ponteFeita : acertouParte(avaliacao) ? t.errada : t.erradaLonge}
        iconeErro={ponteFeita ? 'lampada' : 'fechar'}
        extras={extrasDoRetorno(avaliacao, exercicio)} ocupado={ocupado} concluindo={pendente === 'concluir'} tentarDeNovo={tentarDeNovo}
        rotuloPular={revisao ? t.seguirSemAcertar : t.pular} compacto={expliqueAberto}
        convite={avaliacao.correta && indice === exercicios.length - 1 && !ensinou && !expliqueAberto
          ? () => setPedidoEnsino((atual) => atual + 1) : undefined}
        avisoPular={revisao ? undefined : passo === etapas.length - 1 && exercicios.every((_, numero) => numero === indice || avaliacoes[numero]?.correta) ? t.pularAvisoUltimo : t.pularAviso}
        verReforco={() => {
          // A ponte abre sozinha na tela (o exercício recolhe): começa do alto.
          rolagem.current?.scrollTo({ y: 0, animated: false });
          setPedidoPonte((atual) => atual + 1);
          void tocaSons.tocarEfeito('ponte_abrir');
        }}
        continuar={() => void avancar()} />
    );
  } else if (exercicio) {
    const falta = faltaParaVerificar(exercicio, resposta, iniciais[indice]);
    rodape = (
      <View style={{ gap: 8 }}>
        {falta && <Text testID="falta-para-verificar" accessibilityLiveRegion="polite" style={[estilos.legenda, licaoEstilos.notaRodape]}>{textoDaFalta(falta)}</Text>}
        <Botao testID="enviar-resposta" peso="900" rotulo={pendente === 'avaliar' ? t.avaliando : t.avaliar}
          desativado={ocupado || !respostaCompleta(exercicio, resposta, iniciais[indice])} ocupado={pendente === 'avaliar'} carregando={pendente === 'avaliar'}
          acao={() => void enviar()} />
      </View>
    );
  } else if (etapa.tipo === 'pratica') {
    rodape = (
      <View style={{ gap: 8 }}>
        {!autoAvaliacao && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.pratica.escolha}</Text>}
        {autoAvaliacao === 'ainda_nao' && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.pratica.aindaNaoNota}</Text>}
        {autoAvaliacao === 'ainda_nao' && (
          <Botao testID="praticar-mais" peso="900" rotulo={t.pratica.praticarMais} desativado={ocupado}
            acao={() => { setAutoAvaliacao(null); setVoltasPratica((atual) => atual + 1); mostrarComoFoi(); }} />
        )}
        {/* Sem contar como foi, o botão leva até a pergunta, em vez de ficar apagado sem explicação. Como na web. */}
        <Botao testID="concluir-pratica" peso="900"
          rotulo={pendente === 'concluir' ? t.concluindo : autoAvaliacao === 'ainda_nao' ? t.pratica.concluirAssim : t.pratica.concluir}
          variante={autoAvaliacao === 'ainda_nao' ? 'texto' : 'sucesso'}
          desativado={ocupado} esmaecido={!autoAvaliacao} dica={autoAvaliacao ? undefined : t.pratica.escolha}
          ocupado={pendente === 'concluir'} carregando={pendente === 'concluir'}
          acao={() => (autoAvaliacao ? void avancar() : mostrarComoFoi())} />
      </View>
    );
  } else if (temMais) {
    // Como .botao--ler-mais da web: a seta depois do texto, girada para baixo.
    rodape = <Botao testID="ler-mais" peso="900" rotulo={t.continuarLendo} icone="seta" giroIcone="90deg" acao={lerMais} />;
  } else {
    rodape = <Botao testID="avancar-licao" peso="900" rotulo={t.seguir} icone="seta" desativado={ocupado}
      acao={() => { posicoesDasEtapas.current[passo] = posicaoRolagem.current; setPasso((atual) => atual + 1); }} />;
  }
  if (temAbaixo && (etapa.tipo === 'exercicio' || etapa.tipo === 'pratica')) {
    rodape = (
      <>
        {/* Como .aula-mais-abaixo: a pílula branca com borda; o alvo de 48 dp cresce por fora (hitSlop), sem mudar o desenho (P8). */}
        <Pressable testID="mais-abaixo" accessibilityRole="button" accessibilityLabel={t.maisAbaixo} onPress={lerMais} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onLayout={(evento) => setAlturaDaPilula(evento.nativeEvent.layout.height)}
          style={({ pressed }) => [licaoEstilos.maisAbaixoAlvo, licaoEstilos.maisAbaixo, pressed && { opacity: 0.7 }]}>
          {/* .aula-mais-abaixo .icone: 16 px, girada para baixo. */}
          <View style={{ transform: [{ rotate: '90deg' }] }}><Icone nome="seta" tamanho={16} cor={cores.acao} /></View>
          <Text style={licaoEstilos.maisAbaixoTexto}>{t.maisAbaixo}</Text>
        </Pressable>
        {rodape}
      </>
    );
  }
  // Com a ponte aberta, o rodapé é o dela: a ação do passo ("Ver exemplo", "Ir para o desafio", "Verificar"…), spec 05.
  if (ponteAberta) rodape = rodapePonte ?? undefined;

  function campoDoExercicio(atual: ExercicioPublico): ReactNode {
    const respondido = avaliacao !== null;
    // Verdadeiro ou falso: cada parte (valor e porquê) com a sua cor depois da correção.
    const corDaParte = (parte: 'valor' | 'justificativa') => (retorno ? (avaliacao?.certos?.includes(parte) ? 'certa' : 'errada') : null);
    switch (atual.tipo) {
      case 'lacuna':
        return (
          <Campo testID="resposta-licao" rotulo={t.resposta} value={resposta} onChangeText={mudarResposta}
            editable={!ocupado && !respondido} autoCorrect={false} autoCapitalize="none" returnKeyType="send"
            onSubmitEditing={() => void enviar()}
            style={[licaoEstilos.respostaCampo, retorno === 'certa' && licaoEstilos.respostaCerta, retorno === 'errada' && licaoEstilos.respostaErrada]} />
        );
      case 'multipla_escolha':
        return (
          <View accessibilityRole="radiogroup" accessibilityLabel={t.resposta} style={licaoEstilos.opcoesGrupo}>
            <Text style={estilos.rotulo}>{t.resposta}</Text>
            <View style={licaoEstilos.opcoes}>
            {atual.opcoes.map((opcao, posicao) => (
              <Opcao key={opcao.id} id={opcao.id} letra={letras[posicao] ?? String(posicao + 1)} texto={opcao.texto}
                selecionada={opcao.id === resposta} retorno={opcao.id === resposta ? retorno : null}
                desativada={ocupado || respondido} apagada={respondido && opcao.id !== resposta}
                acao={() => { mudarResposta(opcao.id); void tocaSons.tocarEfeito('toque_opcao'); }} />
            ))}
            </View>
          </View>
        );
      case 'ordenar':
        return <Ordenar itens={atual.itens} valor={resposta} inicial={iniciais[indice]} mudar={mudarResposta} desativado={ocupado || respondido}
          certos={avaliacao?.certos} fixos={avaliacao ? undefined : errosAnteriores[indice]?.certos} />;
      case 'associar':
        return <Associar esquerda={atual.esquerda} direita={atual.direita} valor={resposta} mudar={mudarResposta}
          desativado={ocupado || respondido} certos={avaliacao?.certos} fixos={avaliacao ? undefined : errosAnteriores[indice]?.certos} />;
      case 'verdadeiro_falso':
        return (
          <VerdadeiroFalso afirmacao={atual.afirmacao} valor={resposta} mudar={mudarResposta} desativado={ocupado || respondido}
            retorno={corDaParte('valor')}
            justificativas={(escolhida, salvar) => (
              <View accessibilityRole="radiogroup" accessibilityLabel={t.verdadeiroFalso.porque} style={licaoEstilos.opcoes}>
                {atual.justificativas.map((opcao, posicao) => (
                  <Opcao key={opcao.id} id={`justificativa-${opcao.id}`} letra={letras[posicao] ?? String(posicao + 1)} texto={opcao.texto}
                    selecionada={opcao.id === escolhida} retorno={opcao.id === escolhida ? corDaParte('justificativa') : null}
                    desativada={ocupado || respondido} apagada={respondido && opcao.id !== escolhida}
                    acao={() => { salvar(opcao.id); void tocaSons.tocarEfeito('toque_opcao'); }} />
                ))}
              </View>
            )} />
        );
      case 'aberta':
        return <CampoAberta valor={resposta} mudar={mudarResposta} minimo={atual.minimo} desativado={ocupado || respondido} retorno={retorno} />;
    }
  }

  return (
    // A conferência da fala grava e manda para a rota de voz do servidor (no aparelho).
    <TranscritorContexto.Provider value={cliente.transcrever}>
    <Tela pagina={`licao-${licao.id}`} topo={topo} semLinha rodape={rodape} rolagem={rolagem}
      aoMedir={(altura) => { alturaVisivel.current = altura; medirMais(); }} aoRolar={(y) => { posicaoRolagem.current = y; medirMais(); }}
      // A altura real do conteúdo (iPhone, 20/11): a da caixa da rolagem, menos o espaço do fim, ficava velha numa etapa curta
      // com o rodapé de vidro do iOS 26. A caixa fica presa na altura da janela (flexGrow), o rodapé é medido depois e o
      // espaço do fim entra sem a caixa mudar de tamanho: sem evento novo, sobrava a altura do rodapé como "falta" e o
      // "Continuar lendo" ficava num conteúdo que não rola.
      aoMedirNatural={(altura) => { alturaConteudo.current = altura; medirMais(); }}
      estiloConteudo={licaoEstilos.conteudo} estiloRodapeConteudo={licaoEstilos.rodapeConteudo}
      estiloRodape={ponteAberta ? undefined : retorno === 'certa' ? licaoEstilos.rodapeCerto : retorno === 'errada' ? licaoEstilos.rodapeErrado : undefined}>
      {/* Com a ponte aberta, a etapa fica recolhida (sem desmontar: a resposta e as medidas continuam), como na web 4D. */}
      <View style={ponteAberta ? licaoEstilos.recolhido : undefined}>
      {/* Como na web: na revisão rápida, a etapa entra de novo, mesmo com o mesmo exercício (o último, pulado agora). */}
      <EntradaDaEtapa key={`${passo}-${rodadaDeOpcoes}`}>
        {passo > 0 && !revisao && (
          <Pressable testID="etapa-anterior" accessibilityRole="button" disabled={ocupado} hitSlop={{ top: 10, bottom: 10, left: 0, right: 0 }}
            onPress={() => { voltandoEtapa.current = true; setPasso((atual) => Math.max(0, atual - 1)); }} style={licaoEstilos.voltarEtapa}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><Icone nome="seta" tamanho={16} cor={cores.acao} /></View>
            <Text style={licaoEstilos.voltarEtapaTexto}>{t.etapaAnterior}</Text>
          </Pressable>
        )}
        <View style={[licaoEstilos.etapa, !(passo > 0 && !revisao) && licaoEstilos.etapaNoTopo]}>
          <View style={[licaoEstilos.etapaIcone, { backgroundColor: coresDaEtapa[etapa.tipo].fundo }]}>
            {/* .aula-etapa .icone: caixa de 28 com 4 de respiro, desenho de 20. */}
            <Icone nome={iconesDaEtapa[etapa.tipo]} tamanho={20} cor={coresDaEtapa[etapa.tipo].texto} />
          </View>
          <Text style={[licaoEstilos.etapaTexto, { color: coresDaEtapa[etapa.tipo].texto }, caixaAlta]}>{nomeEtapa}</Text>
        </View>
        {/* Rodada 4B da web: o nome da lição é o título no conceito e na prática; no exemplo, o título é "Exemplo" e, no
            exercício, a própria pergunta. O nome continua pequeno no topo. */}
        {(etapa.tipo === 'conceito' || etapa.tipo === 'pratica') && <Titulo testID="titulo-licao" foco={passo === 0} equilibrado estilo={licaoEstilos.tituloLicao}>{licao.titulo}</Titulo>}
        {/* Como na web: o erro (rede no Verificar, conclusão) fica no alto, em foco, e a tela sobe até ele. */}
        {/* O cartão de erro da web (3A), sem ação: na lição, a nova tentativa é o próprio botão do rodapé (Verificar, Concluir). */}
        {erro && <EstadoErro mensagem={erro} testID="erro-licao" foco />}
        {avisoRetomada && (
          <View testID="aviso-retomada" accessibilityLiveRegion="polite" style={licaoEstilos.aviso}>
            <Text style={licaoEstilos.avisoTexto}>{confirmandoRecomeco ? t.recomecarPergunta : t.retomada}</Text>
            <Pressable testID={confirmandoRecomeco ? 'confirmar-recomeco' : 'recomecar-licao'} accessibilityRole="button" hitSlop={8} style={licaoEstilos.avisoLink}
              onPress={() => { if (confirmandoRecomeco) { setConfirmandoRecomeco(false); recomecarAgora(); } else setConfirmandoRecomeco(true); }}>
              <Text style={[licaoEstilos.avisoTexto, licaoEstilos.avisoAcao]}>{t.recomecarLicao}</Text>
            </Pressable>
            {confirmandoRecomeco && (
              <Pressable testID="cancelar-recomeco" accessibilityRole="button" hitSlop={8} style={licaoEstilos.avisoLink} onPress={() => setConfirmandoRecomeco(false)}>
                <Text style={[licaoEstilos.avisoTexto, licaoEstilos.avisoAcao]}>{mensagens.geracao.cancelar}</Text>
              </Pressable>
            )}
          </View>
        )}
        {revisao && exercicio && (
          <View testID="aviso-revisao" accessibilityLiveRegion="polite" style={[licaoEstilos.aviso, licaoEstilos.avisoRevisao]}>
            <Text style={[licaoEstilos.avisoTexto, { color: '#7A4A00' }]}>{t.revisaoRapida}</Text>
          </View>
        )}
        {etapa.tipo === 'conceito' && (
          <>
            {licao.concluida && (
              <View style={licaoEstilos.revisao}>
                <Icone nome="check" tamanho={18} cor={cores.sucesso} />
                <Text style={licaoEstilos.revisaoTexto}>{mensagens.trilha.revisitando}</Text>
              </View>
            )}
            <Text style={estilos.introducao}>{licao.objetivo}</Text>
            <ExplicacaoDoStu>
              <Text accessibilityRole="header" style={licaoEstilos.balaoTitulo}>{t.explicacaoDoStu}</Text>
              <TextoComFalas texto={licao.conceito} idioma={licao.falas?.[0]?.idioma} estilo={estilos.texto} />
              {/* O marcador fica no bloco, não numa frase: a referência é da lição inteira (não garante o apoio de uma frase). */}
              {!!licao.referencias?.length && (
                <View style={licaoEstilos.marcadores}>
                  {/* Trilha recebida feita de material (spec 09): "Baseado no material de Ana", nunca "seu material", como na web. */}
                  <Text style={licaoEstilos.marcadoresTexto}>{licao.materialDe ? mensagens.compartilhar.baseadoMaterialDe(licao.materialDe) : mensagens.estudio.baseadoMaterial}</Text>
                  {licao.referencias.map((_, numero) => (
                    <Pressable key={numero} testID={`citacao-${numero + 1}`} accessibilityRole="button"
                      accessibilityLabel={`${licao.materialDe ? mensagens.compartilhar.fonteMaterialDe(licao.materialDe) : mensagens.estudio.fonteMaterial} ${numero + 1}`} accessibilityState={{ expanded: citacaoAberta === numero }} aria-expanded={citacaoAberta === numero}
                      onPress={() => mostrarCitacao(numero)}
                      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                      style={({ pressed }) => [licaoEstilos.marcador, citacaoAberta === numero && licaoEstilos.marcadorAberto, pressed && { opacity: 0.8 }]}>
                      <Text style={[licaoEstilos.marcadorTexto, citacaoAberta === numero && { color: cores.fundo }]}>[{numero + 1}]</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {/* Spec 08 (c20ed0f): o provedor de IA nunca aparece como fonte; os marcadores [n] do material continuam. */}
            </ExplicacaoDoStu>
            {citacaoAberta !== null && licao.referencias?.[citacaoAberta] && (
              <View onLayout={(evento) => { citacaoY.current = evento.nativeEvent.layout.y; }}>
                <CartaoFonte ref={cartaoCitacao} referencia={licao.referencias[citacaoAberta]} numero={citacaoAberta + 1} materialDe={licao.materialDe} />
              </View>
            )}
            {/* Como na web (rodada 4E): o recurso visual da lição também no conceito, de qualquer tipo. */}
            {licao.recurso && (
              <View style={{ marginTop: 16 }}><RecursoDaLicao recurso={licao.recurso} /></View>
            )}
          </>
        )}
        {etapa.tipo === 'exemplo' && (
          <View style={[licaoEstilos.quadro, respiroQuadro, licaoEstilos.quadroExemplo]}>
            {/* Como na web 4B: o título do quadro aparece ("Exemplo" ou "Demonstração") e recebe o foco. */}
            <Text ref={tituloEtapa} testID="titulo-etapa" accessible accessibilityRole="header" textBreakStrategy="balanced" style={[licaoEstilos.tituloQuadro, quebraEquilibrada]}>
              {licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo}
            </Text>
            <Text style={estilos.texto}>{licao.exemplo}</Text>
            {licao.recurso && <RecursoDaLicao recurso={licao.recurso} />}
            {licao.passos && <Passos passos={licao.passos} titulo={t.recursos.passos} />}
            {licao.falas && <Falas falas={licao.falas} />}
          </View>
        )}
        {exercicio && (
          <Animated.View style={[licaoEstilos.quadro, respiroQuadro, { transform: [{ translateX: tremor }] }]}
            onLayout={(evento) => {
              exercicioY.current = evento.nativeEvent.layout.y;
              fimDoExercicio.current = evento.nativeEvent.layout.y + evento.nativeEvent.layout.height;
            }}>
            {/* Como na web 4B: a pergunta é o título do exercício (e recebe o foco); o selo no alto diz qual exercício é. */}
            <Text ref={tituloEtapa} testID="pergunta-exercicio" accessible accessibilityRole="header" textBreakStrategy="balanced" style={[licaoEstilos.pergunta, quebraEquilibrada]}>
              {exercicio.enunciado}
            </Text>
            {exercicio.contexto && <Text style={estilos.texto}>{exercicio.contexto}</Text>}
            {exercicio.trecho && (
              <Trecho texto={exercicio.trecho} tipo={exercicio.trechoTipo} fala={exercicio.fala}
                preenchimento={exercicio.tipo === 'lacuna' ? resposta.trim().replace(/[.,;:!?…]+$/u, '') : undefined} />
            )}
            {!exercicio.trecho && exercicio.fala && <Escuta fala={exercicio.fala} acertou={avaliacao?.correta === true} />}
            <View style={licaoEstilos.formulario}>{campoDoExercicio(exercicio)}</View>
            {!avaliacao && errosAnteriores[indice] && (
              <View testID="dica-anterior" accessible accessibilityRole="text" style={licaoEstilos.dica}>
                <View style={licaoEstilos.dicaTopo}>
                  <Icone nome="lampada" tamanho={16} cor="#7A4A00" />
                  <Text style={[licaoEstilos.dicaTitulo, caixaAlta]}>{t.dicaAnterior}</Text>
                </View>
                <Text style={licaoEstilos.dicaTexto}>{errosAnteriores[indice]?.feedback}</Text>
                {errosAnteriores[indice]?.observacao && <Text style={licaoEstilos.dicaTexto}>{errosAnteriores[indice]?.observacao}</Text>}
              </View>
            )}
            {/* Para consultar, depois da resposta e recolhido para a pergunta ficar no alto: o acorde e a barra de fração (a
                linha do tempo entregaria a ordem). */}
            {exercicio && (
              <View style={licaoEstilos.consultaRecolhivel}>
                <Pressable testID="rever-explicacao" accessibilityRole="button" accessibilityState={{ expanded: explicacaoAberta }} aria-expanded={explicacaoAberta}
                  onPress={() => setExplicacaoAberta((atual) => !atual)} style={licaoEstilos.consultaBotao} hitSlop={6}>
                  <Chevron aberto={explicacaoAberta} cor="#8A5A00" />
                  <Text style={licaoEstilos.consultaBotaoTexto}>{explicacaoAberta ? t.recursos.esconder : t.reverExplicacao}</Text>
                </Pressable>
                {explicacaoAberta && (
                  <View style={licaoEstilos.consultaConteudo}>
                    <Text style={estilos.texto}>{licao.conceito}</Text>
                    <Text style={estilos.texto}><Text style={{ fontWeight: '800' }}>{t.exemplo}: </Text>{licao.exemplo}</Text>
                  </View>
                )}
              </View>
            )}
            {licao.recurso && licao.recurso.tipo !== 'linha_do_tempo' && (
              <View style={licaoEstilos.consultaRecolhivel}
                onLayout={(evento) => {
                  // Aberta depois de um erro, a consulta fica atrás do painel: a tela leva o fim dela para cima.
                  if (!consultaAberta || !avaliacao) return;
                  const fim = exercicioY.current + evento.nativeEvent.layout.y + evento.nativeEvent.layout.height + 24 + 16;
                  const sobra = fim - (posicaoRolagem.current + alturaVisivel.current);
                  if (sobra > 0) rolagem.current?.scrollTo({ y: posicaoRolagem.current + sobra, animated: reduzir === false });
                }}>
                <Pressable testID="consultar-recurso" accessibilityRole="button" accessibilityState={{ expanded: consultaAberta }} aria-expanded={consultaAberta}
                  onPress={() => setConsultaAberta((atual) => !atual)} style={licaoEstilos.consultaBotao} hitSlop={6}>
                  <Chevron aberto={consultaAberta} cor="#8A5A00" />
                  <Text style={licaoEstilos.consultaBotaoTexto}>
                    {consultaAberta ? t.recursos.esconder
                      : licao.recurso.tipo === 'acorde'
                        ? licao.recurso.anterior
                          ? t.recursos.verTroca(licao.recurso.anterior.nome, licao.recurso.nome)
                          : licao.recurso.batida ? t.recursos.verBatida(licao.recurso.nome) : t.recursos.verAcorde(licao.recurso.nome)
                        : licao.recurso.tipo === 'imagem' ? t.recursos.verIlustracao : t.recursos.verFracao}
                  </Text>
                </Pressable>
                {consultaAberta && <View style={licaoEstilos.consultaConteudo}><RecursoDaLicao recurso={licao.recurso} /></View>}
              </View>
            )}
            {exercicio.tipo === 'aberta' && avaliacao && (
              <CorrecaoAberta avaliacao={avaliacao} mostrarModelo={avaliacao.correta || Boolean(errosAnteriores[indice])} />
            )}
          </Animated.View>
        )}
        {etapa.tipo === 'pratica' && licao.pratica && (
          <View style={[licaoEstilos.quadro, respiroQuadro, licaoEstilos.quadroPratica]} onLayout={(evento) => { praticaY.current = evento.nativeEvent.layout.y; }}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>{t.pratica.titulo}</Text>
            <EtapaPratica pratica={licao.pratica} escolha={autoAvaliacao} recurso={licao.recurso}
              aoMedirComoFoi={(y) => { comoFoiY.current = y; }} aoAcabar={() => setTimeout(mostrarComoFoi, 120)} reinicio={voltasPratica}
              restanteInicial={praticaRestante.current} aoMudarRestante={(valor) => { praticaRestante.current = valor; }}
              escolher={(valor) => {
                setAutoAvaliacao(valor);
                // A resposta do Stu aparece embaixo das opções: rola até ela (a pergunta no alto da tela), para não ficar atrás
                // do rodapé. A consulta vem depois, então não vale rolar até o fim.
                setTimeout(() => rolagem.current?.scrollTo({ y: Math.max(0, 24 + praticaY.current + comoFoiY.current - 24), animated: reduzir === false }), 160);
              }}
              consulta={(licao.recurso || licao.passos || licao.falas) && (
                <View style={licaoEstilos.consulta}>
                  <Text style={[licaoEstilos.consultaRotulo, caixaAlta]}>{t.recursos.consultar}</Text>
                  {licao.recurso && <RecursoDaLicao recurso={licao.recurso} longa semBatida={licao.recurso.tipo === 'acorde' && licao.recurso.batida} />}
                  {licao.passos && <Passos passos={licao.passos} />}
                  {licao.falas && <Falas falas={licao.falas} />}
                </View>
              )} />
          </View>
        )}
      </EntradaDaEtapa>
      </View>
      {/* Como a web desde bf8cf37: o bloco de apoio vazio (sem reforço, origem nem Explique) não conta (40 entre o último
          conteúdo e o rodapé); com cartões, a margem do último cartão soma, como na web (64). */}
      {exercicio && <View style={[licaoEstilos.apoio, ponteAberta && licaoEstilos.apoioComPonte, apoioVazio && licaoEstilos.apoioVazio]}
        onLayout={(evento) => { apoioPosicao.current = evento.nativeEvent.layout.y; setApoioVazio(evento.nativeEvent.layout.height < 1); }}>
        <ApoioDaLicao key={indice} cliente={cliente} licao={licao} avaliacao={avaliacao} pedidoPonte={pedidoPonte}
        ultimo={indice === exercicios.length - 1}
        aoVoltarExercicio={tentarDeNovo}
        aoConcluirPonte={() => { setPonteFeita(true); setPontesPorExercicio((atuais) => ({ ...atuais, [indice]: true })); }}
        pedidoEnsino={pedidoEnsino} aoAbrirExplique={setExpliqueAberto} aoEnsinar={() => setEnsinou(true)}
        ultimaResposta={respostaLegivel(exercicio, resposta)}
        // Na vitória, o alto do cartão (título, cena, "Isso!" e "Voltar ao exercício") vem para a vista antes da travessia.
        aoMostrarCena={(y) => rolagem.current?.scrollTo({ y: Math.max(0, apoioPosicao.current + y - 8), animated: reduzir === false })}
        // Ponte clara (spec 05, 62b964b): a ação de cada passo vem para o rodapé preso da aula.
        definirRodapePonte={setRodapePonte}
        aoPedirEnsino={(y) => setTimeout(() => rolagem.current?.scrollTo({ y: Math.max(0, apoioPosicao.current + y - 16), animated: reduzir === false }), 60)}
        aoMostrarRetornoPonte={(y) => rolagem.current?.scrollTo({ y: Math.max(0, apoioPosicao.current + y - 220), animated: reduzir === false })}
        aoMostrarEnsino={(y) => rolagem.current?.scrollTo({ y: Math.max(0, apoioPosicao.current + y - 16), animated: reduzir === false })}
        // Voz ao vivo: o aviso e o painel vêm para o centro da tela (scrollIntoView center da web); com o aviso dos 30 s, os
        // controles ficam à vista, rolando só o que falta (nearest).
        aoMostrarVoz={(topo, base, modo) => {
          const inicio = apoioPosicao.current + topo;
          const fim = apoioPosicao.current + base;
          if (modo === 'centro') {
            rolagem.current?.scrollTo({ y: Math.max(0, (inicio + fim) / 2 - alturaVisivel.current / 2), animated: reduzir === false });
          } else if (fim > posicaoRolagem.current + alturaVisivel.current) {
            rolagem.current?.scrollTo({ y: Math.max(0, fim - alturaVisivel.current), animated: reduzir === false });
          } else if (inicio < posicaoRolagem.current) {
            rolagem.current?.scrollTo({ y: Math.max(0, inicio), animated: reduzir === false });
          }
        }} /></View>}
    </Tela>
    </TranscritorContexto.Provider>
  );
}

/** Cada etapa entra deslizando da direita, como na web; com movimento reduzido, já aparece pronta. */
function EntradaDaEtapa({ children }: { children: ReactNode }) {
  const entrada = useAparecer(0, 380);
  return (
    <Animated.View style={{
      opacity: entrada, transform: [{ translateX: entrada.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

/** Barra de andamento grossa, com brilho na faixa cheia, que avança com uma mola curta; verde depois do acerto. */
function BarraDaAula({ fracao, certa }: { fracao: number; certa: boolean }) {
  const reduzir = useMovimentoReduzido();
  const [largura] = useState(() => new Animated.Value(fracao));

  useEffect(() => {
    if (reduzir !== false) {
      largura.setValue(fracao);
      return;
    }
    const animacao = Animated.spring(largura, { toValue: fracao, friction: 7, tension: 70, useNativeDriver: false });
    animacao.start();
    return () => animacao.stop();
  }, [fracao, reduzir, largura]);

  return (
    <View style={licaoEstilos.trilha}>
      <Animated.View style={[licaoEstilos.preenchimento, certa && licaoEstilos.preenchimentoCerto, {
        width: largura.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]}>
        <View style={licaoEstilos.brilho} />
      </Animated.View>
    </View>
  );
}

/** O Stu explica o conceito num balão (spec 13): `stu-feliz` de 58 no halo lavanda, que se mexe uma vez quando a etapa entra. */
function ExplicacaoDoStu({ children }: { children: ReactNode }) {
  const balao = useAparecer(120, 420, true);
  return (
    <View style={licaoEstilos.explicacao}>
      <Stu nome="stu-feliz" tamanho={58} halo animado="uma-vez" estilo={licaoEstilos.stu} />
      <Animated.View style={[licaoEstilos.balao, {
        opacity: balao, transform: [{ scale: balao.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }]}>
        <View style={licaoEstilos.balaoSeta} />
        {children}
      </Animated.View>
    </View>
  );
}

/** A reação do Stu no painel de retorno (spec 13, emenda de 19/11). */
type ReacaoDoStu = 'acerto' | 'primeira' | 'ponte' | 'erro';
/** Acerto feliz; de primeira comemorando (com o pulo); depois da ponte animado; erro encorajador (sem tremer). */
const expressaoDaReacao: Record<ReacaoDoStu, NomeStu> = {
  acerto: 'stu-feliz',
  primeira: 'stu-comemorando',
  ponte: 'stu-animado',
  erro: 'stu-encorajador',
};
/** Borda de cima (2), respiro de cima (8) e de baixo (14) do rodapé da aula: o painel inteiro cabe em metade da janela. */
const MOLDURA_DO_RODAPE = 24;

let ultimoEsmaecer = 0;
/** O fim do texto que rola no painel: 24 px que esmaecem na cor do painel, enquanto ainda há texto embaixo. */
function EsmaecerTexto({ cor }: { cor: string }) {
  const [id] = useState(() => { ultimoEsmaecer += 1; return `esmaecer-retorno-${ultimoEsmaecer}`; });
  return (
    <View testID="retorno-esmaecer" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={licaoEstilos.retornoEsmaecer}>
      <Svg width="100%" height={24}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={cor} stopOpacity={0} />
            <Stop offset="1" stopColor={cor} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={24} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * A fonte da lição em destaque (o trecho exato do material, com página, parágrafo ou linha), como o cartão da web:
 * o número do marcador, o material, o selo de demonstração quando o material é simulado e a leitura por OCR.
 */
export function CartaoFonte({ referencia, numero, ref, titulo, parado = false, materialDe }: {
  referencia: NonNullable<LicaoDetalhe['referencias']>[number];
  /** Cópia de uma trilha feita de material (spec 09): "Fonte do material de Ana" no lugar de "Fonte do seu material". */
  materialDe?: string | null;
  numero: number;
  ref?: Ref<ComponentRef<typeof View>>;
  /** Título pronto no lugar de "material · página" (a apresentação usa o exemplo do contrato, "Frações.pdf · pág. 2"). */
  titulo?: string;
  /** Sem a entrada animada e sem a margem de cima: a ilustração parada da apresentação. */
  parado?: boolean;
}) {
  const entrada = useAparecer(0, 320, true);
  const m = mensagens.estudio;
  const fonte = materialDe ? mensagens.compartilhar.fonteMaterialDe(materialDe) : m.fonteMaterial;
  const onde = titulo ?? `${referencia.nome} · ${referencia.localizacao ?? m.pagina(referencia.pagina)}`;
  return (
    <Animated.View ref={ref} testID="cartao-fonte" accessible accessibilityRole="summary"
      accessibilityLabel={`${fonte} ${numero}. ${onde}. ${referencia.trecho}`}
      // .aula-citacao: borda de 2 (#c3cdf2) que fecha em volta e o degrau de 4 (gelo) por fora, como a sombra da web.
      style={[degrauFora(4, 20, cores.gelo), licaoEstilos.fonteFora, parado ? { marginTop: 0 }
        : { opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <View style={licaoEstilos.fonte}>
      {/* Como .aula-citacao da web: um selo só com o número e "Fonte do seu material", o material em 14 px/700, o selo de
          demonstração e o trecho em itálico, sem aspas, com a borda azul à esquerda sobre o branco. */}
      {/* .aula-citacao__topo: linha que quebra, com 8 entre as linhas (o cartão tem 10 entre os blocos). */}
      <View style={licaoEstilos.fonteTopo}>
        <View style={licaoEstilos.fonteSeloNumero}>
          <Text style={[licaoEstilos.fonteRotulo, caixaAlta]}>{`[${numero}] ${fonte}`}</Text>
        </View>
        <Text style={licaoEstilos.fonteOnde}>{onde}</Text>
        {referencia.leitura === 'demonstracao' && <SeloDemonstracao emLinha />}
      </View>
      <View style={licaoEstilos.fonteTrecho}>
        <Text selectable style={[estilos.texto, licaoEstilos.fonteTrechoTexto]}>{referencia.trecho}</Text>
      </View>
      {referencia.leitura === 'ocr' && <Text style={estilos.legenda}>{m.ocr}</Text>}
      </View>
    </Animated.View>
  );
}

/**
 * Painel de retorno no rodapé: sobe com a cor do resultado; o ícone entra com um giro e, no acerto, solta confete.
 * No erro (rodada 4C da web), "Ver outro jeito de entender" é a ação principal, na largura toda; embaixo, "Tentar de novo"
 * (secundário) e "Pular por agora" (discreto), numa linha só, sem quebrar o rótulo em 360 px.
 * A reação do Stu mora aqui (spec 13, emenda de 19/11): 42 px na ponta direita da linha do título, subindo 8 px no respiro de
 * cima do rodapé (o painel não cresce), com o pop aos 160 ms e um ciclo; sem Stu no compacto (o Explique já tem o dele). O
 * painel inteiro cabe em metade da janela: passando disso, só o texto rola, com o esmaecer de 24 no fim.
 */
function PainelRetorno({ avaliacao, titulo, extras, ocupado, concluindo, tentarDeNovo, continuar, verReforco, rotuloPular, compacto = false, avisoPular,
  iconeErro = 'fechar', convite, reacao, reservaAcima = 0 }: {
  /** A expressão do Stu na linha do título (acerto, de primeira, depois da ponte ou erro). */
  reacao?: ReacaoDoStu;
  /** O que mais divide o rodapé com o painel, acima dele (a pílula "Ver mais abaixo"), para o rodapé inteiro caber em metade da janela. */
  reservaAcima?: number;
  /** No acerto do último exercício, antes de explicar: "Quer fixar? Explique com suas palavras" abre o "Explique". Como na web. */
  convite?: () => void;
  avaliacao: Avaliacao;
  titulo: string;
  /** No erro: o X; depois do reforço feito, a lâmpada (o painel convida a tentar de novo). */
  iconeErro?: 'fechar' | 'lampada';
  /** No erro (fora da revisão): o que acontece ao pular, o exercício volta no fim da lição. */
  avisoPular?: string;
  /** Com o reforço aberto, o painel fica só com o título e as ações, para não cobrir a miniquestão. */
  compacto?: boolean;
  /** O botão de seguir no erro: "Pular por agora" ou, na revisão antes de concluir, "Seguir sem acertar". */
  rotuloPular: string;
  /** Linhas a mais: o aviso da correção e quantos itens já estão certos. */
  extras: string[];
  ocupado: boolean;
  concluindo: boolean;
  tentarDeNovo: () => void;
  verReforco: () => void;
  continuar: () => void;
}) {
  const certa = avaliacao.correta;
  const subida = useAparecer(0, 320, true);
  const icone = useAparecer(80, 460, true);
  const area = useRef<ComponentRef<typeof View>>(null);
  const comStu = reacao !== undefined && !compacto;
  const janela = useWindowDimensions();
  const margens = useSafeAreaInsets();
  const alturaMaxima = Math.max(200, Math.floor(janela.height * 0.5) - MOLDURA_DO_RODAPE - margens.bottom - reservaAcima);
  // O texto que rola: só quando passa do que cabe; o esmaecer some no fim.
  const [alturaDoTexto, setAlturaDoTexto] = useState(0);
  const [janelaDoTexto, setJanelaDoTexto] = useState(0);
  const [noFim, setNoFim] = useState(false);
  const transborda = janelaDoTexto > 0 && alturaDoTexto > janelaDoTexto + 1;

  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, []);

  return (
    <Animated.View testID="painel-retorno" style={{ gap: 6, maxHeight: alturaMaxima, opacity: subida,
      transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View ref={area} testID="feedback-licao" accessible accessibilityRole="alert"
        accessibilityLabel={`${titulo} ${certa ? mensagens.licao.correta : mensagens.licao.incorreta}. ${avaliacao.feedback} ${extras.join(' ')}`}
        style={[licaoEstilos.retorno, licaoEstilos.encolhe]}>
        {/* Como na web: o ícone pequeno ao lado do título e o texto na largura toda, embaixo (o painel ocupava ~40% da tela). */}
        <View style={licaoEstilos.retornoCabecalho}>
          {/* .aula-retorno__icone no celular: círculo de 34 com o degrau de 3 por fora (sombra da web) e o ícone de 20 com traço 3,2. */}
          <Animated.View style={[degrauFora(3, 17, certa ? cores.sucesso : '#B4650D'), compacto && { borderRadius: 16 }, {
            transform: [
              { scale: icone.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { rotate: icone.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
            ],
          }]}>
            <View style={[licaoEstilos.retornoIcone, !certa && licaoEstilos.retornoIconeErrado, compacto && licaoEstilos.retornoIconeCompacto]}>
              <Icone nome={certa ? 'check' : iconeErro} tamanho={compacto ? 18 : 20} cor={cores.fundo} traco={3.2} />
              {certa && <Confete quantidade={14} />}
            </View>
          </Animated.View>
          <Text style={[licaoEstilos.retornoTitulo, compacto && licaoEstilos.retornoTituloCompacto, !certa && licaoEstilos.retornoTituloErrado, { flex: 1 },
            comStu && licaoEstilos.retornoTituloComStu]}>{titulo}</Text>
          {comStu && (
            // Enfeite: o toque passa e o leitor de tela não lê (o anúncio é o do painel).
            <View testID="stu-do-retorno" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
              style={licaoEstilos.retornoStu}>
              <Stu nome={expressaoDaReacao[reacao]} tamanho={42} animado="acontecimento" acontecimento={reacao} popAoMontar={160} />
            </View>
          )}
        </View>
        {!compacto && (
          <View style={licaoEstilos.encolhe}>
            <ScrollView testID="retorno-texto" style={licaoEstilos.retornoRolagem} contentContainerStyle={licaoEstilos.retorno}
              scrollEnabled={transborda} bounces={false} showsVerticalScrollIndicator={transborda} scrollEventThrottle={32}
              onLayout={(evento) => setJanelaDoTexto(evento.nativeEvent.layout.height)}
              onContentSizeChange={(_largura, altura) => setAlturaDoTexto(altura)}
              onScroll={({ nativeEvent: { contentOffset, layoutMeasurement, contentSize } }) =>
                setNoFim(contentOffset.y + layoutMeasurement.height >= contentSize.height - 1)}>
              {/* .aula-retorno p no celular: 15 px com entrelinha 1,4. */}
              <Text style={[estilos.texto, licaoEstilos.retornoTexto]}>{avaliacao.feedback}</Text>
              {extras.map((linha) => <Text key={linha} style={licaoEstilos.retornoExtra}>{linha}</Text>)}
              {!certa && avisoPular && <Text style={licaoEstilos.avisoPular}>{avisoPular}</Text>}
            </ScrollView>
            {transborda && !noFim && <EsmaecerTexto cor={certa ? CORES_DO_PAINEL.certa : CORES_DO_PAINEL.errada} />}
          </View>
        )}
      </View>
      {certa && convite && <Botao testID="convite-explique" variante="texto" rotulo={t.expliqueConvite} desativado={ocupado} acao={convite}
        estilo={licaoEstilos.convite} />}
      {!certa && !compacto && <Botao testID="ver-outro-jeito" peso="900" rotulo={mensagens.estudio.verPonte} desativado={ocupado} acao={verReforco} />}
      {/* Compacto (Explique aberto): 16 entre o título e o "Continuar" (o visto ficava a 4 px do botão); a web segue o mesmo. */}
      <View style={[licaoEstilos.retornoAcoes, compacto && licaoEstilos.retornoAcoesCompacto]}>
        {!certa && (
          <View style={licaoEstilos.acaoTentar}>
            <Botao testID="tentar-de-novo" variante="secundario" peso="900" rotulo={mensagens.licao.tentarDeNovo} desativado={ocupado} acao={tentarDeNovo} />
          </View>
        )}
        <View style={certa ? licaoEstilos.metade : undefined}>
          <Botao testID="continuar-licao" rotulo={concluindo ? mensagens.licao.concluindo : certa ? mensagens.licao.continuar : rotuloPular}
            variante={certa ? 'sucesso' : 'texto'} peso="900" estilo={certa ? undefined : licaoEstilos.pular}
            desativado={ocupado} ocupado={concluindo} carregando={concluindo} acao={continuar} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Opção do exercício: cartão com relevo e a letra; depois da resposta, a escolhida fica verde (pula) ou âmbar. */

/** O fundo do painel de retorno (o rodapé da aula depois da resposta) e o esmaecer do texto que rola. */
const CORES_DO_PAINEL = { certa: '#E3F6EA', errada: '#FFF1E0' };

const licaoEstilos = StyleSheet.create({
  // A aula da web tem 16 de respiro nos lados no celular (clamp(16px, 4vw, 48px) em aula.css), no alto, no meio e no
  // rodapé; as outras telas têm 20. A barra do alto vem da faixa comum (20), então ela avança 4 para cada lado.
  // .aula-topo no celular: 8 em cima e embaixo, começando 2 abaixo do topo (a margem de -12 sobre os 14 da página): o X fica
  // em 10 e a faixa mede 62.
  topo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: -4, marginTop: 2 },
  topoColuna: { flex: 1, minWidth: 0, gap: 2 },
  andamento: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tituloTopo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 15 },
  /** A aula começa mais perto do topo (rodada 4B da web). */
  // 40 entre o último conteúdo e o rodapé fixo no fim da rolagem (bf8cf37: o vão de 22 do painel mais os 18 do rodapé).
  // 18 da faixa do alto até o primeiro bloco: com a faixa de 62, "Etapa anterior", a etiqueta do exercício e o título da ponte
  // ficam na altura da web (medido em 390). 40 até o rodapé no fim da rolagem.
  conteudo: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 40 },
  // .aula-rodape no celular: 10 em cima, contando a linha de 2 que a web desenha por dentro (::before); aqui a linha é a borda
  // de cima do rodapé, então o respiro é 8.
  rodapeConteudo: { paddingHorizontal: 16, paddingTop: 8 },
  /** Exercício recolhido enquanto a ponte está aberta (rodada 4D da web). */
  recolhido: { display: 'none' },
  // .aula-miolo h1 { margin-top: -6px } vale também para o título dentro do quadro (vence o .aula-pergunta).
  tituloQuadro: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, letterSpacing: -0.5, lineHeight: 28, marginTop: -6 },
  /** A pergunta como título do exercício, como `.aula-pergunta` da web: entrelinha de 27,6 e 6 embaixo. */
  pergunta: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, letterSpacing: -1, lineHeight: 27.6, marginTop: -6, marginBottom: 6 },
  /** O formulário da resposta: 4 em cima (.aula-quadro .formulario). */
  formulario: { marginTop: 4 },
  trilha: { flex: 1, height: 18, borderRadius: 9, backgroundColor: cores.gelo, overflow: 'hidden' },
  preenchimento: { height: '100%', minWidth: 18, borderRadius: 9, backgroundColor: cores.acao, overflow: 'hidden' },
  preenchimentoCerto: { backgroundColor: cores.sucessoClaro },
  brilho: { position: 'absolute', top: 4, left: 10, right: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.34)' },
  // .aula-posicao: 14 px em 900.
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 20 },
  // .aula-rodape__nota no celular: 13 px em 700, centrada.
  notaRodape: { textAlign: 'center', fontSize: 13, lineHeight: 19.5, fontWeight: '700' },
  // O aviso de pular no painel do erro, como na web: 15 px em 700, na cor do texto.
  avisoPular: { textAlign: 'center', color: cores.texto, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  retornoTexto: { fontSize: 15, lineHeight: 21 },
  // "Pular por agora" no painel do erro: botão de texto de 16 px, 44 de altura e 8 de respiro, sem quebrar.
  pular: { minHeight: 48, paddingHorizontal: 8 },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  etapaIcone: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  etapaTexto: { fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18, letterSpacing: 0.6 },
  // Como .aula-miolo h1 da web no celular: clamp(1,5rem, 4,6vw, 2rem) = 24 px, entrelinha 1,15.
  // .aula-miolo h1 no celular: 24 px na entrelinha de 1,15; com o vão de 14 da etapa e o -6 de cima, fica a 8 da etapa e a 14 do
  // objetivo (a introdução já tem 8 em cima).
  tituloLicao: { fontSize: 24, lineHeight: 27.6, marginTop: 4, marginBottom: 6 },
  revisao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  // 48 dp de toque sem empurrar a etapa: as margens negativas devolvem o espaço que o visual de antes ocupava.
  // .aula-voltar-etapa: 4 de respiro em cima e embaixo (29 de altura), na largura da coluna, 6 embaixo mais o vão de 14 da grade;
  // o alvo de 48 cresce por fora (hitSlop), sem mudar o desenho (P8).
  voltarEtapa: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'stretch', paddingVertical: 4, marginTop: 4, marginBottom: 20 },
  // .aula-miolo começa 4 abaixo do topo do conteúdo (a margem de cima do "Etapa anterior"): sem o link (primeira etapa e
  // revisão), o selo da etapa fica nesse mesmo ponto.
  etapaNoTopo: { marginTop: 4 },
  voltarEtapaTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  marcadores: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  marcadoresTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  marcadorAlvo: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginVertical: -8 },
  // O selo [1] da web: 38 × 28, pílula; o alvo de 48 cresce por fora (hitSlop, P8).
  marcador: { minWidth: 38, minHeight: 28, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
    borderWidth: 2, borderColor: cores.destaqueBorda, backgroundColor: cores.fundo },
  marcadorAberto: { borderColor: cores.acao, backgroundColor: cores.acao },
  marcadorTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18 },
  fonteFora: { marginTop: 14 },
  fonte: { paddingVertical: 16, paddingHorizontal: 20, gap: 10, borderRadius: 20, borderWidth: 2, borderColor: cores.destaqueBorda, backgroundColor: '#F6F8FF' },
  fonteTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 8, columnGap: 12 },
  fonteSeloNumero: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E5EBFF' },
  fonteRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 18, letterSpacing: 0.48 },
  fonteOnde: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21 },
  fonteTrecho: { borderLeftWidth: 4, borderColor: cores.acao, backgroundColor: cores.fundo, borderTopRightRadius: 12, borderBottomRightRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14 },
  fonteTrechoTexto: { fontStyle: 'italic' },
  // .aula-stu-estado: raio de 20; o cartão da pergunta vem 14 abaixo (o vão de .aula-miolo; o cartão já tem 10 em cima).
  // .aula-mais-abaixo: margem -6 em cima e 8 embaixo; pílula com borda de 2, sombra de 2 (aqui, a borda de baixo) e texto de 14 px.
  maisAbaixoAlvo: { alignSelf: 'center', marginTop: -6, marginBottom: -2 },
  // .aula-mais-abaixo: borda de 2 em volta e o degrau de 2 por fora (box-shadow 0 2px 0 gelo).
  maisAbaixo: { alignSelf: 'center', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 999, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo, boxShadow: `0 2px 0 ${cores.gelo}` },
  maisAbaixoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  dica: { gap: 4, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 4, borderLeftColor: '#E0A92E', borderRadius: 12,
    backgroundColor: '#FFF8E6' },
  dicaTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dicaTitulo: { color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  dicaTexto: { color: '#5C3B00', fontFamily: fontes.corpo, fontWeight: '600', fontSize: 15, lineHeight: 21 },
  revisaoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  // .aula-explicacao: o vão de 14 da etapa (sem margem própria).
  explicacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 14 },
  stu: { marginTop: 6 },
  // .aula-balao: borda de 2 em volta e o degrau de 4 por fora (box-shadow 0 4px 0 gelo).
  balao: { flex: 1, gap: 10, padding: 16, borderRadius: 22, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo,
    boxShadow: `0 4px 0 ${cores.gelo}` },
  balaoSeta: { position: 'absolute', top: 24, left: -10, width: 16, height: 16, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo,
    borderBottomLeftRadius: 3, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  balaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  // O primeiro cartão de apoio fica 113 px abaixo do último texto do exercício, como na web. Embaixo, a margem de 24 do último
  // cartão sai do bloco de apoio na web e soma com o vão do painel e a do rodapé (24 + 22 + 18 = 64 no fim da rolagem): aqui,
  // os 12 do cartão, mais 12 do bloco e os 40 do conteúdo. Sem cartões, o bloco não conta e sobram os 40.
  apoio: { marginTop: 27, marginBottom: 12 },
  apoioVazio: { marginTop: 0, marginBottom: 0 },
  // Com a ponte aberta, a etapa some (como na web) e o cartão da ponte é o primeiro bloco: sem o vão que vinha depois dela.
  // Com a ponte aberta, o rodapé some e a web deixa 40 do cartão até a borda (16 do painel + os 24 do cartão): aqui o bloco
  // devolve os 12 a mais.
  apoioComPonte: { marginTop: 16, marginBottom: -12 },
  // .aula-quadro: borda de 2 que fecha em volta e o degrau de 4 por fora (box-shadow 0 4px 0, na cor da borda); 14 da
  // etiqueta (o vão de .aula-miolo).
  quadro: { marginTop: 10, gap: 12, padding: 18, borderRadius: 24, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo,
    boxShadow: `0 4px 0 ${cores.gelo}` },
  quadroExemplo: { borderColor: '#FFE3A3', backgroundColor: '#FFFAF0', boxShadow: '0 4px 0 #FFE3A3' },
  quadroPratica: { borderColor: '#E2D1F5', backgroundColor: '#FBF8FF', boxShadow: '0 4px 0 #E2D1F5' },
  // .aula-consulta: 12 de respiro e vão de 10 (a consulta da prática).
  consulta: { gap: 10, padding: 12, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  // .aula-consulta--recolhivel: sem respiro próprio; o resumo tem 48 com 10 × 14 (52 com a borda) e o conteúdo aberto fica a 12
  // das bordas.
  consultaRecolhivel: { borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  consultaConteudo: { gap: 10, marginHorizontal: 12, marginBottom: 12 },
  // .aula-aviso: 4 em cima e 14 embaixo, mais o vão de 14 da grade antes dele.
  aviso: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, marginTop: 14, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#EEF2FF' },
  avisoRevisao: { backgroundColor: '#FFF6D9' },
  // O link do aviso ("Recomeçar do zero"): botão de 44 de altura com 4 de respiro nos lados, como na web.
  avisoLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  avisoTexto: { color: cores.acaoEscura, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  // O link tem os 44 do botão (.aula-aviso: 88 de altura com o texto); o alvo cresce por fora (hitSlop de 8).
  avisoAcao: { textDecorationLine: 'underline', fontWeight: '900' },
  consultaBotao: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingVertical: 10, paddingHorizontal: 14 },
  consultaBotaoTexto: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 16 },
  consultaRotulo: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  respostaCampo: { minHeight: 58, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  respostaCerta: { borderColor: cores.sucessoClaro, color: cores.sucesso, backgroundColor: '#EEFAF3' },
  respostaErrada: { borderColor: '#E3A24A', backgroundColor: '#FFF6EA' },
  // Entre a pergunta e "Sua resposta", 22 na web: 6 da pergunta, o vão de 12 do cartão e 4 do formulário. As opções têm vão de
  // 12 (.opcoes) e a legenda fica a 8 da primeira.
  opcoes: { gap: 12 },
  opcoesGrupo: { gap: 8 },
  rodapeCerto: { borderTopColor: 'transparent', backgroundColor: CORES_DO_PAINEL.certa },
  rodapeErrado: { borderTopColor: 'transparent', backgroundColor: CORES_DO_PAINEL.errada },
  retorno: { gap: 2 },
  retornoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  retornoIcone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.sucessoClaro },
  retornoIconeErrado: { backgroundColor: '#E58A1F' },
  // Rodapé compacto (Explique ou reforço aberto): círculo de 32 e ícone de 18.
  retornoIconeCompacto: { width: 32, height: 32, borderRadius: 16 },
  // .aula-retorno h2 no celular: 1,1875rem com entrelinha de 34 px (a altura do ícone) e -0,015em.
  retornoTitulo: { color: cores.sucesso, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 34, letterSpacing: -0.285 },
  // Compacto: a web troca só o tamanho (1,0625rem); a entrelinha de 34 px continua, e o título fica a 16 do "Continuar".
  retornoTituloCompacto: { fontSize: 17, lineHeight: 34 },
  convite: { alignSelf: 'flex-start', paddingHorizontal: 2, minHeight: 48 },
  retornoTituloErrado: { color: '#8A4B00' },
  // Com o Stu: 52 de respiro à direita (o quadro de 42 mais 10), para o título nunca passar por baixo dele.
  retornoTituloComStu: { marginRight: 52 },
  // O quadro de 42 na ponta direita, alinhado pela base com a linha do título (34): sobe 8 no respiro de cima do rodapé.
  retornoStu: { position: 'absolute', right: 0, top: -8, width: 42, height: 42 },
  encolhe: { flexShrink: 1, minHeight: 0 },
  retornoRolagem: { flexGrow: 0, flexShrink: 1 },
  retornoEsmaecer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 24 },
  retornoExtra: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  retornoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -2 },
  retornoAcoesCompacto: { marginTop: 10 },
  metade: { flex: 1, minWidth: 0 },
  /** "Tentar de novo" ocupa o que sobra da linha; "Pular por agora" fica do tamanho do rótulo, discreto. */
  acaoTentar: { flex: 1, minWidth: 0 },
});
