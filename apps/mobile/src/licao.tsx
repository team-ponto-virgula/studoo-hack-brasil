import { ApoioDaLicao } from './estudio-adaptativo';
import type { ClienteEstudio } from '@studoo/contratos';
import {
  acertouParte,
  embaralharExercicio,
  etapasDaLicao,
  exerciciosDaLicao,
  faltaParaVerificar,
  motivoParaRever,
  origemLegivel,
  respostaParaTentarDeNovo,
  respostaCompleta,
  ultimoExercicio,
  type AutoAvaliacao,
  type Avaliacao,
  type EtapaAula,
  type ExercicioPublico,
  type LicaoDetalhe,
} from '@studoo/contratos';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject, type ReactNode } from 'react';
import { AccessibilityInfo, Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAparecer, usePulinho, useTremor } from './animacoes';
import {
  TranscritorContexto,
  Associar,
  CampoAberta,
  CorrecaoAberta,
  Escuta,
  EtapaPratica,
  Falas,
  Ordenar,
  Passos,
  RecursoDaLicao,
  TextoComFalas,
  Trecho,
  VerdadeiroFalso,
  pararVoz,
} from './aula-formatos';
import { Confete } from './festa';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { mensagens, textoDaFalta } from './mensagens';
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
const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo), como na web. */
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
 * Aula por etapas, como na web (spec 02), com o número de etapas de cada lição: conceito, exemplo (ou demonstração, com
 * recurso, passos e frases para ouvir), de um a três exercícios de formatos variados e, quando a lição pede, a prática no
 * mundo real com cronômetro. Depois da resposta, o rodapé vira o painel de retorno, verde no acerto (com confete) ou
 * âmbar no erro (o exercício treme); dá para tentar de novo ou continuar. Continuar segue para a próxima etapa; na última,
 * registra a conclusão (se a confirmação expirar, a aula volta ao último exercício). O título de cada etapa e o do retorno
 * recebem o foco do leitor de tela.
 */
export function Licao({ cliente, licao, erro, pendente, voltar, saida, avaliar, concluir }: {
  cliente: ClienteEstudio;
  licao: LicaoDetalhe;
  erro: string | null;
  pendente: string | null;
  voltar: () => void;
  /** Onde a tela guarda o "sair" da lição, para o voltar do aparelho fazer o mesmo que o X. */
  saida?: MutableRefObject<(() => void) | null>;
  avaliar: (resposta: string, indice: number) => Promise<Avaliacao | null>;
  concluir: (comprovante: string, resumo: ResumoLicao, pratica?: AutoAvaliacao) => Promise<boolean>;
}) {
  const etapas = useMemo(() => etapasDaLicao(licao), [licao]);
  // Como na web: as opções mudam de ordem a cada visita.
  const [semente] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const exercicios = useMemo(
    () => exerciciosDaLicao(licao).map((exercicio, numero) => embaralharExercicio(exercicio, semente + numero)),
    [licao, semente],
  );
  // Quem saiu no meio continua de onde parou.
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
  const [errosSeguidos, setErrosSeguidos] = useState(0);
  const [pedidoPonte, setPedidoPonte] = useState(0);
  const [consultaAberta, setConsultaAberta] = useState(false);
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);
  /** O reforço deste exercício foi feito: o painel troca o "Quase lá!" pelo convite a tentar de novo. Como na web. */
  const [ponteFeita, setPonteFeita] = useState(false);
  // Onde fica o exercício: para levar a consulta aberta para cima do painel de retorno.
  const exercicioY = useRef(0);
  const [inicio] = useState(() => Date.now() - (retomada?.segundos ?? 0) * 1000);
  /** Cada "Praticar mais um pouco" recomeça o cronômetro da prática. Como na web. */
  const [voltasPratica, setVoltasPratica] = useState(0);
  const praticaRestante = useRef<number | undefined>(retomada?.praticaRestante);
  /** Quantos exercícios a revisão rápida trouxe, para o contador "Revisão 1 de 2". Como na web. */
  const [revisaoTotal, setRevisaoTotal] = useState(retomada?.revisao?.length ?? 0);
  const tituloEtapa = useRef<ComponentRef<typeof Text>>(null);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const apoioPosicao = useRef(0);
  /** Pediu o reforço: quando o cartão crescer (o reforço chegou), a tela rola de novo até ele. */
  const rolarParaApoio = useRef(0);
  // Para rolar até o fim do exercício depois da correção: onde ele termina, quanto já rolou e a altura visível.
  const fimDoExercicio = useRef(0);
  const posicaoRolagem = useRef(0);
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

  useEffect(() => {
    // Cada etapa começa do topo, como uma tela nova; a voz de uma etapa não continua na outra.
    rolagem.current?.scrollTo({ y: 0, animated: false });
    posicaoRolagem.current = 0;
    chegouAoFim.current = false;
    const medida = setTimeout(medirMais, 250);
    pararVoz();
    // O reforço é de cada exercício: um pedido antigo não vale para o próximo.
    setPedidoPonte(0);
    setPonteFeita(false);
    setExplicacaoAberta(false);
    if (passo === 0) return () => clearTimeout(medida);
    const espera = setTimeout(() => {
      if (tituloEtapa.current) AccessibilityInfo.sendAccessibilityEvent(tituloEtapa.current, 'focus');
    }, 120);
    return () => {
      clearTimeout(espera);
      clearTimeout(medida);
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
    if (chegouAoFim.current) return;
    const leitura = etapa.tipo === 'conceito' || etapa.tipo === 'exemplo';
    const falta = alturaConteudo.current - (posicaoRolagem.current + alturaVisivel.current);
    const novo = leitura && alturaVisivel.current > 0 && falta > 24;
    if (leitura && alturaVisivel.current > 0 && !novo) chegouAoFim.current = true;
    setTemMais((antes) => (antes === novo ? antes : novo));
  }

  /** "Continuar lendo": rola mais um pedaço do conteúdo. */
  function lerMais() {
    rolagem.current?.scrollTo({ y: posicaoRolagem.current + alturaVisivel.current * 0.75, animated: reduzir === false });
  }

  /** Leva até o "Como foi?" da prática (no fim do cronômetro ou ao concluir sem contar como foi). */
  function mostrarComoFoi() {
    rolagem.current?.scrollTo({ y: Math.max(0, 24 + praticaY.current + comoFoiY.current - 80), animated: reduzir === false });
  }

  useEffect(() => () => pararVoz(), []);

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
    });
  }, [licao.id, licao.concluida, passo, respostas, avaliacoes, primeiras, tentativas, comprovante, autoAvaliacao, revisao]);

  /** Sair da lição: o andamento fica guardado, então sai direto (e continua de onde parou na volta). */
  function sair() {
    voltar();
  }

  /** Recomeçar do zero (quem voltou no meio e prefere começar de novo). */
  function recomecar() {
    // Como na web: pergunta antes, porque as respostas desta vez se perdem.
    const confirmar = () => recomecarAgora();
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (texto: string) => boolean }).confirm?.(t.recomecarPergunta)) confirmar();
      return;
    }
    Alert.alert(t.recomecarPergunta, undefined, [
      { text: mensagens.ficar, style: 'cancel' },
      { text: t.recomecarLicao, style: 'destructive', onPress: confirmar },
    ]);
  }

  function recomecarAgora() {
    andamentos.delete(licao.id);
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
  }

  useEffect(() => {
    if (!saida) return;
    saida.current = sair;
    return () => { saida.current = null; };
  });

  function mudarResposta(valor: string) {
    setRespostas((atuais) => atuais.map((atual, posicao) => (posicao === indice ? valor : atual)));
  }

  async function enviar() {
    if (ocupado || !exercicio || avaliacao || !respostaCompleta(exercicio, resposta)) return;
    const resultado = await avaliar(resposta, indice);
    if (!resultado) return;
    setTentativas((soma) => soma + 1);
    setPrimeiras((atuais) => atuais.map((atual, posicao) => (posicao === indice ? atual ?? resultado.correta : atual)));
    if (!resultado.correta) setErrosSeguidos((soma) => soma + 1);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? resultado : atual)));
    setComprovante(resultado.comprovante);
  }

  function tentarDeNovo() {
    setPonteFeita(false);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === indice ? null : atual)));
    setErrosAnteriores((atuais) => atuais.map((atual, posicao) => (posicao === indice ? avaliacao : atual)));
    // Fica o que estava certo (na aberta, o texto todo); o resto recomeça. Como na web.
    if (exercicio && avaliacao) mudarResposta(respostaParaTentarDeNovo(exercicio, resposta, avaliacao));
  }

  /** A etapa de um exercício (pelo índice dele). */
  const etapaDoExercicio = (numero: number) => etapas.findIndex((item) => item.tipo === 'exercicio' && item.indice === numero);

  /** Volta aos exercícios sem acerto, limpando a resposta de cada um, para mais uma tentativa antes de concluir. */
  function revisar(pendentes: number[]) {
    setRevisao(pendentes);
    setRevisaoTotal(pendentes.length);
    setErrosAnteriores((atuais) => atuais.map((atual, posicao) => (pendentes.includes(posicao) ? avaliacoes[posicao] ?? atual : atual)));
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (pendentes.includes(posicao) ? null : atual)));
    setRespostas((atuais) => atuais.map((atual, posicao) => {
      const anterior = avaliacoes[posicao];
      if (!pendentes.includes(posicao)) return atual;
      return anterior ? respostaParaTentarDeNovo(exercicios[posicao], atual, anterior) : '';
    }));
    setPasso(etapaDoExercicio(pendentes[0]));
  }

  async function avancar() {
    if (ocupado) return;
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
    };
    if (await concluir(comprovante, resumo, autoAvaliacao ?? undefined)) {
      andamentos.delete(licao.id);
      return;
    }
    setRevisao(null);
    setAvaliacoes((atuais) => atuais.map((atual, posicao) => (posicao === exercicios.length - 1 ? null : atual)));
    setPasso(ultimoExercicio(etapas));
  }

  const topo = (
    <View style={licaoEstilos.topo}>
      <BotaoIcone icone="fechar" rotulo={t.voltar} testID="voltar-plano" desativado={ocupado} acao={sair} />
      <View style={licaoEstilos.andamento} accessible accessibilityRole="progressbar" accessibilityLabel={andamento}
        accessibilityValue={{ min: 0, max: total, now: revisao ? total : passo + 1 }}>
        <BarraDaAula fracao={revisao ? 1 : (passo + 1) / total} certa={avaliacao?.correta === true} />
        <Text style={licaoEstilos.posicao}>{andamento}</Text>
      </View>
    </View>
  );

  let rodape: ReactNode;
  if (avaliacao) {
    rodape = (
      <PainelRetorno avaliacao={avaliacao}
        titulo={avaliacao.correta
          ? avaliacao.criterios?.some(({ atendido }) => !atendido) ? t.quaseCompleta : tituloDoAcerto(`${licao.id}-${indice}`)
          : ponteFeita ? t.ponteFeita : acertouParte(avaliacao) ? t.errada : t.erradaLonge}
        iconeErro={ponteFeita ? 'lampada' : 'fechar'}
        extras={extrasDoRetorno(avaliacao, exercicio)} ocupado={ocupado} concluindo={pendente === 'concluir'} tentarDeNovo={tentarDeNovo}
        rotuloPular={revisao ? t.seguirSemAcertar : t.pular} compacto={pedidoPonte > 0} avisoPular={revisao ? undefined : t.pularAviso}
        verReforco={() => {
          rolagem.current?.scrollTo({ y: apoioPosicao.current, animated: reduzir === false });
          rolarParaApoio.current = Date.now();
          setPedidoPonte((atual) => atual + 1);
        }}
        continuar={() => void avancar()} />
    );
  } else if (exercicio) {
    const falta = faltaParaVerificar(exercicio, resposta);
    rodape = (
      <View style={{ gap: 8 }}>
        {falta && <Text testID="falta-para-verificar" accessibilityLiveRegion="polite" style={[estilos.legenda, { textAlign: 'center' }]}>{textoDaFalta(falta)}</Text>}
        <Botao testID="enviar-resposta" rotulo={pendente === 'avaliar' ? t.avaliando : t.avaliar}
          desativado={ocupado || !respostaCompleta(exercicio, resposta)} ocupado={pendente === 'avaliar'} carregando={pendente === 'avaliar'}
          acao={() => void enviar()} />
      </View>
    );
  } else if (etapa.tipo === 'pratica') {
    rodape = (
      <View style={{ gap: 8 }}>
        {!autoAvaliacao && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.pratica.escolha}</Text>}
        {autoAvaliacao === 'ainda_nao' && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.pratica.aindaNaoNota}</Text>}
        {autoAvaliacao === 'ainda_nao' && (
          <Botao testID="praticar-mais" rotulo={t.pratica.praticarMais} desativado={ocupado}
            acao={() => { setAutoAvaliacao(null); setVoltasPratica((atual) => atual + 1); mostrarComoFoi(); }} />
        )}
        {/* Sem contar como foi, o botão leva até a pergunta, em vez de ficar apagado sem explicação. Como na web. */}
        <Botao testID="concluir-pratica"
          rotulo={pendente === 'concluir' ? t.concluindo : autoAvaliacao === 'ainda_nao' ? t.pratica.concluirAssim : t.pratica.concluir}
          variante={autoAvaliacao === 'ainda_nao' ? 'texto' : 'sucesso'}
          desativado={ocupado} esmaecido={!autoAvaliacao} dica={autoAvaliacao ? undefined : t.pratica.escolha}
          ocupado={pendente === 'concluir'} carregando={pendente === 'concluir'}
          acao={() => (autoAvaliacao ? void avancar() : mostrarComoFoi())} />
      </View>
    );
  } else if (temMais) {
    rodape = <Botao testID="ler-mais" rotulo={t.continuarLendo} acao={lerMais} />;
  } else {
    rodape = <Botao testID="avancar-licao" rotulo={t.seguir} icone="seta" desativado={ocupado} acao={() => setPasso((atual) => atual + 1)} />;
  }

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
          <View accessibilityRole="radiogroup" accessibilityLabel={t.resposta} style={licaoEstilos.opcoes}>
            <Text style={estilos.rotulo}>{t.resposta}</Text>
            {atual.opcoes.map((opcao, posicao) => (
              <Opcao key={opcao.id} id={opcao.id} letra={letras[posicao] ?? String(posicao + 1)} texto={opcao.texto}
                selecionada={opcao.id === resposta} retorno={opcao.id === resposta ? retorno : null}
                desativada={ocupado || respondido} apagada={respondido && opcao.id !== resposta}
                acao={() => mudarResposta(opcao.id)} />
            ))}
          </View>
        );
      case 'ordenar':
        return <Ordenar itens={atual.itens} valor={resposta} mudar={mudarResposta} desativado={ocupado || respondido} certos={avaliacao?.certos}
          fixos={avaliacao ? undefined : errosAnteriores[indice]?.certos} />;
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
                    desativada={ocupado || respondido} apagada={respondido && opcao.id !== escolhida} acao={() => salvar(opcao.id)} />
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
    <Tela pagina={`licao-${licao.id}`} topo={topo} rodape={rodape} rolagem={rolagem}
      aoMedir={(altura) => { alturaVisivel.current = altura; medirMais(); }} aoRolar={(y) => { posicaoRolagem.current = y; medirMais(); }}
      aoMedirConteudo={(altura) => { alturaConteudo.current = altura; medirMais(); }}
      estiloRodape={retorno === 'certa' ? licaoEstilos.rodapeCerto : retorno === 'errada' ? licaoEstilos.rodapeErrado : undefined}>
      <EntradaDaEtapa key={passo}>
        {passo > 0 && !revisao && (
          <Pressable testID="etapa-anterior" accessibilityRole="button" disabled={ocupado} hitSlop={8}
            onPress={() => setPasso((atual) => Math.max(0, atual - 1))} style={licaoEstilos.voltarEtapa}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><Icone nome="seta" tamanho={16} cor={cores.acao} /></View>
            <Text style={licaoEstilos.voltarEtapaTexto}>{t.etapaAnterior}</Text>
          </Pressable>
        )}
        <View style={licaoEstilos.etapa}>
          <View style={[licaoEstilos.etapaIcone, { backgroundColor: coresDaEtapa[etapa.tipo].fundo }]}>
            <Icone nome={iconesDaEtapa[etapa.tipo]} tamanho={18} cor={coresDaEtapa[etapa.tipo].texto} />
          </View>
          <Text style={[licaoEstilos.etapaTexto, { color: coresDaEtapa[etapa.tipo].texto }]}>{nomeEtapa.toLocaleUpperCase('pt-BR')}</Text>
        </View>
        <Titulo testID="titulo-licao" foco={passo === 0}>{licao.titulo}</Titulo>
        {avisoRetomada && (
          <View testID="aviso-retomada" accessibilityLiveRegion="polite" style={licaoEstilos.aviso}>
            <Text style={licaoEstilos.avisoTexto}>{t.retomada}</Text>
            <Pressable accessibilityRole="button" onPress={recomecar} hitSlop={8}>
              <Text style={[licaoEstilos.avisoTexto, licaoEstilos.avisoAcao]}>{t.recomecarLicao}</Text>
            </Pressable>
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
              <Text style={estilos.legenda}>{t.origem} · {origemLegivel(licao.origem)}</Text>
            </ExplicacaoDoStu>
            {(licao.recurso?.tipo === 'imagem' || licao.recurso?.tipo === 'acorde') && (
              <View style={{ marginTop: 16 }}><RecursoDaLicao recurso={licao.recurso} /></View>
            )}
          </>
        )}
        {etapa.tipo === 'exemplo' && (
          <View style={[licaoEstilos.quadro, licaoEstilos.quadroExemplo]}>
            {/* O selo da etapa já diz "Exemplo" no alto: o título do quadro fica só para o leitor de tela (e recebe o foco). */}
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={licaoEstilos.soLeitor}>
              {licao.exemploTipo === 'demonstracao' ? t.demonstracao : t.exemplo}
            </Text>
            <Text style={estilos.texto}>{licao.exemplo}</Text>
            {licao.recurso && <RecursoDaLicao recurso={licao.recurso} />}
            {licao.passos && <Passos passos={licao.passos} titulo={t.recursos.passos} />}
            {licao.falas && <Falas falas={licao.falas} />}
          </View>
        )}
        {exercicio && (
          <Animated.View style={[licaoEstilos.quadro, { transform: [{ translateX: tremor }] }]}
            onLayout={(evento) => {
              exercicioY.current = evento.nativeEvent.layout.y;
              fimDoExercicio.current = evento.nativeEvent.layout.y + evento.nativeEvent.layout.height;
            }}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={licaoEstilos.soLeitor}>
              {exercicios.length > 1 ? t.exercicioDe(indice + 1, exercicios.length) : t.exercicio}
            </Text>
            <Text style={estilos.texto}>{exercicio.enunciado}</Text>
            {exercicio.contexto && <Text style={estilos.texto}>{exercicio.contexto}</Text>}
            {exercicio.trecho && (
              <Trecho texto={exercicio.trecho} tipo={exercicio.trechoTipo} fala={exercicio.fala}
                preenchimento={exercicio.tipo === 'lacuna' ? resposta.trim().replace(/[.,;:!?…]+$/u, '') : undefined} />
            )}
            {!exercicio.trecho && exercicio.fala && <Escuta fala={exercicio.fala} acertou={avaliacao?.correta === true} />}
            {campoDoExercicio(exercicio)}
            {!avaliacao && errosAnteriores[indice] && (
              <View testID="dica-anterior" accessible accessibilityRole="text" style={licaoEstilos.dica}>
                <View style={licaoEstilos.dicaTopo}>
                  <Icone nome="lampada" tamanho={16} cor="#7A4A00" />
                  <Text style={licaoEstilos.dicaTitulo}>{t.dicaAnterior.toLocaleUpperCase('pt-BR')}</Text>
                </View>
                <Text style={licaoEstilos.dicaTexto}>{errosAnteriores[indice]?.feedback}</Text>
                {errosAnteriores[indice]?.observacao && <Text style={licaoEstilos.dicaTexto}>{errosAnteriores[indice]?.observacao}</Text>}
              </View>
            )}
            {/* Para consultar, depois da resposta e recolhido para a pergunta ficar no alto: o acorde e a barra de fração (a
                linha do tempo entregaria a ordem). */}
            {exercicio && (
              <View style={[licaoEstilos.consulta, !explicacaoAberta && licaoEstilos.consultaFechada]}>
                <Pressable testID="rever-explicacao" accessibilityRole="button" accessibilityState={{ expanded: explicacaoAberta }}
                  onPress={() => setExplicacaoAberta((atual) => !atual)} style={licaoEstilos.consultaBotao} hitSlop={6}>
                  <View style={{ transform: [{ rotate: explicacaoAberta ? '90deg' : '0deg' }] }}>
                    <Icone nome="seta" tamanho={16} cor="#8A5A00" />
                  </View>
                  <Text style={licaoEstilos.consultaBotaoTexto}>{explicacaoAberta ? t.recursos.esconder : t.reverExplicacao}</Text>
                </Pressable>
                {explicacaoAberta && <Text style={estilos.texto}>{licao.conceito}</Text>}
                {explicacaoAberta && <Text style={estilos.texto}><Text style={{ fontWeight: '800' }}>{t.exemplo}: </Text>{licao.exemplo}</Text>}
              </View>
            )}
            {licao.recurso && licao.recurso.tipo !== 'linha_do_tempo' && (
              <View style={[licaoEstilos.consulta, !consultaAberta && licaoEstilos.consultaFechada]}
                onLayout={(evento) => {
                  // Aberta depois de um erro, a consulta fica atrás do painel: a tela leva o fim dela para cima.
                  if (!consultaAberta || !avaliacao) return;
                  const fim = exercicioY.current + evento.nativeEvent.layout.y + evento.nativeEvent.layout.height + 24 + 16;
                  const sobra = fim - (posicaoRolagem.current + alturaVisivel.current);
                  if (sobra > 0) rolagem.current?.scrollTo({ y: posicaoRolagem.current + sobra, animated: reduzir === false });
                }}>
                <Pressable testID="consultar-recurso" accessibilityRole="button" accessibilityState={{ expanded: consultaAberta }}
                  onPress={() => setConsultaAberta((atual) => !atual)} style={licaoEstilos.consultaBotao} hitSlop={6}>
                  <View style={{ transform: [{ rotate: consultaAberta ? '90deg' : '0deg' }] }}>
                    <Icone nome="seta" tamanho={16} cor="#8A5A00" />
                  </View>
                  <Text style={licaoEstilos.consultaBotaoTexto}>
                    {consultaAberta ? t.recursos.esconder
                      : licao.recurso.tipo === 'acorde'
                        ? licao.recurso.anterior
                          ? t.recursos.verTroca(licao.recurso.anterior.nome, licao.recurso.nome)
                          : licao.recurso.batida ? t.recursos.verBatida(licao.recurso.nome) : t.recursos.verAcorde(licao.recurso.nome)
                        : licao.recurso.tipo === 'imagem' ? t.recursos.verIlustracao : t.recursos.verFracao}
                  </Text>
                </Pressable>
                {consultaAberta && <RecursoDaLicao recurso={licao.recurso} />}
              </View>
            )}
            {exercicio.tipo === 'aberta' && avaliacao && (
              <CorrecaoAberta avaliacao={avaliacao} mostrarModelo={avaliacao.correta || Boolean(errosAnteriores[indice])} />
            )}
          </Animated.View>
        )}
        {etapa.tipo === 'pratica' && licao.pratica && (
          <View style={[licaoEstilos.quadro, licaoEstilos.quadroPratica]} onLayout={(evento) => { praticaY.current = evento.nativeEvent.layout.y; }}>
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
                  <Text style={licaoEstilos.consultaRotulo}>{t.recursos.consultar.toLocaleUpperCase('pt-BR')}</Text>
                  {licao.recurso && <RecursoDaLicao recurso={licao.recurso} longa semBatida={licao.recurso.tipo === 'acorde' && licao.recurso.batida} />}
                  {licao.passos && <Passos passos={licao.passos} />}
                  {licao.falas && <Falas falas={licao.falas} />}
                </View>
              )} />
          </View>
        )}
        {erro && <EstadoMensagem mensagem={erro} />}
      </EntradaDaEtapa>
      {exercicio && <View onLayout={(evento) => {
        apoioPosicao.current = evento.nativeEvent.layout.y;
        // O reforço chegou e o apoio cresceu: leva ao alto dele (antes, a rolagem parava no fim da página curta).
        if (Date.now() - rolarParaApoio.current < 4000) rolagem.current?.scrollTo({ y: apoioPosicao.current, animated: reduzir === false });
      }}><ApoioDaLicao key={indice} cliente={cliente} licao={licao} avaliacao={avaliacao} pedidoPonte={pedidoPonte}
        ultimo={indice === exercicios.length - 1} aoConcluirPonte={() => setPonteFeita(true)}
        aoMostrarEnsino={(y) => rolagem.current?.scrollTo({ y: Math.max(0, apoioPosicao.current + y - 16), animated: reduzir === false })} /></View>}
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

/** O Stu explica o conceito num balão; ele sobe e desce devagar. */
function ExplicacaoDoStu({ children }: { children: ReactNode }) {
  const balanco = useBalanco(5, 1600);
  const balao = useAparecer(120, 420, true);
  return (
    <View style={licaoEstilos.explicacao}>
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        importantForAccessibility="no" style={[licaoEstilos.stu, { transform: [{ translateY: balanco }] }]} />
      <Animated.View style={[licaoEstilos.balao, {
        opacity: balao, transform: [{ scale: balao.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }]}>
        <View style={licaoEstilos.balaoSeta} />
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Painel de retorno no rodapé: sobe com a cor do resultado; o ícone entra com um giro e, no acerto, solta confete.
 * No erro, "Tentar de novo" volta ao exercício e Continuar segue, como na web.
 */
function PainelRetorno({ avaliacao, titulo, extras, ocupado, concluindo, tentarDeNovo, continuar, verReforco, rotuloPular, compacto = false, avisoPular,
  iconeErro = 'fechar' }: {
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

  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, []);

  return (
    <Animated.View style={{ gap: 14, opacity: subida, transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View ref={area} testID="feedback-licao" accessible accessibilityRole="alert"
        accessibilityLabel={`${titulo} ${certa ? mensagens.licao.correta : mensagens.licao.incorreta}. ${avaliacao.feedback} ${extras.join(' ')}`}
        style={licaoEstilos.retorno}>
        <Animated.View style={[licaoEstilos.retornoIcone, !certa && licaoEstilos.retornoIconeErrado, {
          transform: [
            { scale: icone.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: icone.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
          ],
        }]}>
          <Icone nome={certa ? 'check' : iconeErro} tamanho={28} cor={cores.fundo} />
          {certa && <Confete quantidade={14} />}
        </Animated.View>
        <View style={licaoEstilos.retornoTextos}>
          <Text style={[licaoEstilos.retornoTitulo, !certa && licaoEstilos.retornoTituloErrado]}>{titulo}</Text>
          {!compacto && <Text style={estilos.texto}>{avaliacao.feedback}</Text>}
          {!compacto && extras.map((linha) => <Text key={linha} style={licaoEstilos.retornoExtra}>{linha}</Text>)}
        </View>
      </View>
      {!certa && !compacto && <Botao variante="texto" rotulo={mensagens.estudio.verPonte} desativado={ocupado} acao={verReforco} />}
      {!certa && !compacto && avisoPular && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{avisoPular}</Text>}
      <View style={licaoEstilos.retornoAcoes}>
        {!certa && (
          <View style={licaoEstilos.metade}>
            <Botao testID="tentar-de-novo" rotulo={mensagens.licao.tentarDeNovo} desativado={ocupado} acao={tentarDeNovo} />
          </View>
        )}
        <View style={licaoEstilos.metade}>
          <Botao testID="continuar-licao" rotulo={concluindo ? mensagens.licao.concluindo : certa ? mensagens.licao.continuar : rotuloPular}
            variante={certa ? 'sucesso' : 'texto'} desativado={ocupado} ocupado={concluindo} carregando={concluindo} acao={continuar} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Opção do exercício: cartão com relevo e a letra; depois da resposta, a escolhida fica verde (pula) ou âmbar. */
function Opcao({ id, letra, texto, selecionada, retorno, desativada, apagada, acao }: {
  id: string;
  letra: string;
  texto: string;
  selecionada: boolean;
  retorno: 'certa' | 'errada' | null;
  desativada: boolean;
  apagada: boolean;
  acao: () => void;
}) {
  const [focada, setFocada] = useState(false);
  const pulo = usePulinho(retorno === 'certa', 1.04);
  let estado = null;
  if (retorno === 'certa') estado = licaoEstilos.opcaoCerta;
  else if (retorno === 'errada') estado = licaoEstilos.opcaoErrada;
  else if (selecionada) estado = licaoEstilos.opcaoSelecionada;

  return (
    <Animated.View style={{ transform: [{ scale: pulo }], opacity: apagada ? 0.55 : 1 }}>
      <Pressable testID={`opcao-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: desativada }}
        accessibilityLabel={texto} disabled={desativada} onPress={acao} onFocus={() => setFocada(true)} onBlur={() => setFocada(false)}
        style={({ pressed }) => [licaoEstilos.opcao, estado, pressed && licaoEstilos.opcaoAfundada, focada && estilos.foco]}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[licaoEstilos.letra, selecionada && licaoEstilos.letraSelecionada, retorno === 'certa' && licaoEstilos.letraCerta,
            retorno === 'errada' && licaoEstilos.letraErrada]}>
          <Text style={[licaoEstilos.letraTexto, (selecionada || retorno) && { color: cores.fundo }]}>{letra}</Text>
        </View>
        <Text style={[estilos.texto, licaoEstilos.opcaoTexto]}>{texto}</Text>
      </Pressable>
    </Animated.View>
  );
}

const licaoEstilos = StyleSheet.create({
  topo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  andamento: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trilha: { flex: 1, height: 18, borderRadius: 9, backgroundColor: cores.gelo, overflow: 'hidden' },
  preenchimento: { height: '100%', minWidth: 18, borderRadius: 9, backgroundColor: cores.acao, overflow: 'hidden' },
  preenchimentoCerto: { backgroundColor: cores.sucessoClaro },
  brilho: { position: 'absolute', top: 4, left: 10, right: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.34)' },
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  etapaIcone: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  etapaTexto: { fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18, letterSpacing: 0.6 },
  revisao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  voltarEtapa: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 6, minHeight: 32 },
  voltarEtapaTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  dica: { gap: 4, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 4, borderLeftColor: '#E0A92E', borderRadius: 12,
    backgroundColor: '#FFF8E6' },
  dicaTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dicaTitulo: { color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  dicaTexto: { color: '#5C3B00', fontFamily: fontes.corpo, fontWeight: '600', fontSize: 15, lineHeight: 21 },
  revisaoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  explicacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  stu: { width: 58, height: 64, marginTop: 6 },
  balao: { flex: 1, gap: 10, padding: 16, borderRadius: 22, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoSeta: { position: 'absolute', top: 24, left: -10, width: 16, height: 16, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo,
    borderBottomLeftRadius: 3, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  balaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 24 },
  quadro: { marginTop: 20, gap: 12, padding: 18, borderRadius: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  quadroExemplo: { borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  quadroPratica: { borderColor: '#E2D1F5', backgroundColor: '#FBF8FF' },
  consulta: { gap: 10, padding: 12, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  consultaFechada: { paddingVertical: 4 },
  aviso: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, marginTop: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: '#EEF2FF' },
  avisoRevisao: { backgroundColor: '#FFF6D9' },
  avisoTexto: { color: cores.acaoEscura, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 21 },
  avisoAcao: { minHeight: 44, textDecorationLine: 'underline', paddingVertical: 11 },
  /** Só para o leitor de tela: some da vista sem sair da ordem de leitura. */
  soLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  consultaBotao: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  consultaBotaoTexto: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 15 },
  consultaRotulo: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  respostaCampo: { minHeight: 58, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  respostaCerta: { borderColor: cores.sucessoClaro, color: cores.sucesso, backgroundColor: '#EEFAF3' },
  respostaErrada: { borderColor: '#E3A24A', backgroundColor: '#FFF6EA' },
  opcoes: { gap: 10 },
  opcao: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 2, borderBottomWidth: 5,
    borderColor: cores.gelo, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: cores.fundo },
  opcaoAfundada: { borderBottomWidth: 2, marginTop: 3 },
  opcaoSelecionada: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  opcaoCerta: { borderColor: cores.sucessoClaro, borderBottomColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  opcaoErrada: { borderColor: '#E3A24A', borderBottomColor: '#F2CF96', backgroundColor: '#FFF6EA' },
  opcaoTexto: { flex: 1, fontWeight: '700' },
  letra: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: cores.gelo, alignItems: 'center', justifyContent: 'center' },
  letraSelecionada: { borderColor: cores.acao, backgroundColor: cores.acao },
  letraCerta: { borderColor: cores.sucessoClaro, backgroundColor: cores.sucessoClaro },
  letraErrada: { borderColor: '#E3A24A', backgroundColor: '#E3A24A' },
  letraTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  rodapeCerto: { borderTopColor: 'transparent', backgroundColor: '#E3F6EA' },
  rodapeErrado: { borderTopColor: 'transparent', backgroundColor: '#FFF1E0' },
  retorno: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  retornoIcone: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4,
    borderColor: cores.sucesso, backgroundColor: cores.sucessoClaro },
  retornoIconeErrado: { borderColor: '#B4650D', backgroundColor: '#E58A1F' },
  retornoTextos: { flex: 1, minWidth: 0, gap: 2 },
  retornoTitulo: { color: cores.sucesso, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  retornoTituloErrado: { color: '#8A4B00' },
  retornoExtra: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  retornoAcoes: { flexDirection: 'row', gap: 10 },
  metade: { flex: 1, minWidth: 0 },
});
