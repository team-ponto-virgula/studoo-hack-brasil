import { falarTextoComFormulas } from '@studoo/contratos';
import { useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
  Platform,
} from 'react-native';
import { useAparecer, useVaiVem } from './animacoes';
import { Confete } from './festa';
import { Icone } from './icone';
import { AlturaDaFaixaFixa, Botao, DeslocamentoDaRolagem, EspacoDaBarra, Pontinhos, estilos, useBalanco, useMovimentoReduzido, caixaAlta, degrade, quebraSemViuva } from './interface';
import { mensagens } from './mensagens';
import { desenhosQueBalancam, enfeitesDaLinha, type NomeDesenho } from './mundo-desenhos';
import { ColinaElipse, Desenho, Fronteira, Onda, coresDaRegiao } from './mundo';
import { cores, fontes } from './tema';
import { explicar, iconeDoNo, nomeAcessivelDoNo, posicaoDoNo, posicaoX, selosDoNo, type EstadoNo, type NoCaminho } from './trilha';
import { focoVisivel } from './foco';
import { Stu } from './mascote';
import type { NomeStu } from '@studoo/contratos';
import { RITMO_DA_GERACAO, atrasosDaLicao } from './geracao-ritmo';
import { ouvirVoltar } from './voltar';

/*
 * Caminho da trilha no app: a mesma lógica e o mesmo mundo da web (src/ui/caminho.tsx), com componentes nativos.
 * Um só caminho contínuo sobre um mapa ilustrado: cada trecho é uma região (campos, floresta, montanhas…). Os nós são
 * moedas com relevo numa serpentina, a estrada liga o centro de um ao do próximo (dourada no que já foi feito) e cada
 * parte abre com uma faixa sobre a fronteira. Só o nó atual (e a prévia) mostra o título ao lado; nos outros, o título
 * abre numa folha que sobe do rodapé. O Stu acompanha o nó atual e o troféu fecha o caminho.
 */

type Medidas = { lente: number; linhas: number; etiqueta: number; marco: number; enfeite: number; miudo: number; guia: number };
type Ponto = { x: number; y: number };
type Caixa = { y: number; altura: number };
/** Topo e base de um trecho do caminho na rolagem da tela. */
export type Faixa = { topo: number; base: number };

const corEstrada = 'rgba(255, 255, 255, 0.72)';
/**
 * A estrada é feita de cápsulas que se sobrepõem; com cor translúcida, a sobreposição dobra a opacidade e aparecem
 * bolhas. Por isso cada região usa o mesmo branco a 72% já misturado ao seu chão, opaco.
 */
function misturar(base: string, outra: string, fracao: number) {
  if (!/^#[0-9a-f]{6}$/i.test(base) || !/^#[0-9a-f]{6}$/i.test(outra)) return base;
  const canal = (inicio: number) => Math.round(parseInt(base.slice(inicio, inicio + 2), 16) * (1 - fracao)
    + parseInt(outra.slice(inicio, inicio + 2), 16) * fracao);
  return `rgb(${canal(1)}, ${canal(3)}, ${canal(5)})`;
}

function estradaSobre(chao: string) {
  const canal = (inicio: number) => Math.round(255 * 0.72 + parseInt(chao.slice(inicio, inicio + 2), 16) * 0.28);
  return /^#[0-9a-f]{6}$/i.test(chao) ? `rgb(${canal(1)}, ${canal(3)}, ${canal(5)})` : corEstrada;
}
const corEstradaFeita = '#FFE8A6';
const ouroFace = '#FFCF4D';
const ouroLabio = '#E0A12A';
const corPontilhado = 'rgba(11, 27, 92, 0.34)';
/** O rascunho da prévia (spec 04, "Criar a trilha"): o contorno dos nós e o tracejado do caminho. */
const corRascunho = '#9CB4F5';

/** Mesmas medidas da web: celular, tablet e telas a partir de 1024 px. */
function useMedidas(): Medidas {
  const { width } = useWindowDimensions();
  if (width >= 1024) return { lente: 82, linhas: 56, etiqueta: 38, marco: 72, enfeite: 62, miudo: 28, guia: 70 };
  if (width >= 768) return { lente: 78, linhas: 52, etiqueta: 38, marco: 72, enfeite: 56, miudo: 28, guia: 64 };
  return { lente: 72, linhas: 36, etiqueta: 38, marco: 60, enfeite: 46, miudo: 24, guia: 56 };
}


/** O brilho da lente da web: radial-gradient(circle at 50% 28%, branco a 55% até 18%, transparente em 46%). */
const BRILHO_DA_LENTE = 'radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.55) 18%, rgba(255, 255, 255, 0) 46%)';

/** Cores da lente por estado: a face, o lábio embaixo (o relevo) e o ícone. */
const coresDaLente: Record<EstadoNo, { face: string; labio: string; icone: string }> = {
  concluida: { face: ouroFace, labio: ouroLabio, icone: cores.ouroTexto },
  atual: { face: '#4466E4', labio: cores.acaoEscura, icone: cores.fundo },
  bloqueada: { face: cores.faceNeutra, labio: cores.labioNeutro, icone: cores.tintaNeutra },
  previa: { face: cores.fundo, labio: '#CDD6F2', icone: cores.acao },
};

const corDoEstado: Record<EstadoNo, string> = {
  concluida: cores.alerta,
  atual: cores.acao,
  bloqueada: cores.textoSecundario,
  previa: cores.textoSecundario,
};

type ResumoTrecho = { total: number; feitas: number; previa: boolean };

/** Lições de cada trecho e quantas já foram concluídas, para as faixas de "Parte" (como na web). */
function resumoDosTrechos(nos: readonly NoCaminho[]) {
  const resumo = new Map<number, ResumoTrecho>();
  for (const no of nos) {
    const atual = resumo.get(no.trecho) ?? { total: 0, feitas: 0, previa: false };
    atual.total += 1;
    if (no.estado === 'concluida') atual.feitas += 1;
    if (no.estado === 'previa') atual.previa = true;
    resumo.set(no.trecho, atual);
  }
  return resumo;
}

/**
 * Caminho único e contínuo de lições, na ordem de aprendizado, sobre o mundo ilustrado.
 * Não agrupa por assunto: entre um trecho e outro aparece só o marco, sem nome, sobre a fronteira das regiões.
 * O leitor de tela ouve "Parte 1" antes das primeiras lições e cada nova parte depois do último nó do trecho anterior.
 * O nó atual abre a lição; concluído ou bloqueado abre a folha que explica o estado.
 * Com `rolarPara`, avisa por `aoRolar` o topo e a base da lente desse nó na rolagem da tela (o caminho deve ser filho direto dela).
 * Com `montando`, a trilha ainda está sendo gerada: cada nó novo entra com um movimento curto e o cenário brota junto,
 * a posição não tem total e um nó em esqueleto marca onde a próxima lição vai aparecer. A cada nó, e quando a chegada
 * entra no fim, `acompanhar` recebe o último nó e o ponto que deve ficar à vista, para a tela rolar só se a pessoa estava
 * olhando o fim do caminho, como na web.
 * Como na web, o Stu fica ao lado do nó atual (e, com tudo concluído, ao lado do troféu) e a frase `stu` vai numa placa no
 * alto do mapa; sem nó atual, o Stu abre o mapa com a frase num balão e, na geração, as `dicas` se revezam.
 * Ao abrir, os nós caem no lugar em sequência. Com `recemConcluida`, o nó da lição que a pessoa acabou de concluir
 * comemora, a linha até o próximo se desenha e só então o próximo nó se abre. Árvores e flores balançam com o vento.
 */
export function Caminho({ nos, stu, dicas = [], chegada = true, montando = false, ocupado = false, abrindo = null, liberadas = [],
  rolarPara = null, recemConcluida = null, aoRolar, aoMedirAtual, acompanhar, aoAbrir, estilo, extraChegada = 0, semFala = false, respiroNoAlto = 0,
  aoMedirNo, stuNoNo1 = false, festaPermitida = true, trofeuDoZero = false, rascunho = false, criacao = null, guardarNo1 }: {
  /**
   * A prévia é rascunho (spec 04, "Criar a trilha"): nós de face branca com contorno tracejado de 2 px `#9CB4F5`, sem o lábio,
   * e o caminho tracejado 8/8 na mesma cor. Quando a trilha passa a existir (`criacao` = 'criada'), viram os de sempre.
   */
  rascunho?: boolean;
  /**
   * O toque em "Começar a lição 1": 'criando' (o anel do nó 1 respira e o Stu estuda ao lado dele), 'erro' (o Stu fica ao
   * lado do nó 1, parado, encorajador) e 'criada' (o nó 1 pulsa e fica azul cheio, o caminho firma e o Stu comemora).
   */
  criacao?: 'criando' | 'erro' | 'criada' | null;
  /** A lente do nó 1, para a tela medir de onde o círculo da passagem cresce. */
  guardarNo1?: (alvo: ComponentRef<typeof View> | null) => void;
  /**
   * Geração que se acompanha (spec 04, revisão de 19/11): a frase do Stu vai na placa presa no alto da tela, fora do mapa;
   * o começo do mapa fica sem balão e sem Stu, com `respiroNoAlto` em cima para a placa não cobrir a primeira lição.
   */
  semFala?: boolean;
  respiroNoAlto?: number;
  /** Onde cada nó está na rolagem da tela (o topo e a base da lente), para a tela levar a lição nova a 60% do mapa. */
  aoMedirNo?: (id: string, topo: number, base: number) => void;
  /** Fim da geração (proposta pronta): o Stu feliz fica ao lado do nó 1, não do troféu (spec 16, item 1). */
  stuNoNo1?: boolean;
  /** O confete do fim só cai quando o troféu entra na tela (a tela não estava acompanhando). */
  festaPermitida?: boolean;
  /** O troféu entra crescendo de 0 a 1,1 e volta a 1 (420 ms). */
  trofeuDoZero?: boolean;
  /** Margens de fora do mapa (a tela da trilha tem o vão de 20 da web até a faixa do nome). */
  estilo?: StyleProp<ViewStyle>;
  /**
   * Quanto o morro do troféu cresce embaixo no celular (`--extra` de `.painel--trilha .caminho-chegada` na web, 120). Na
   * trilha, o mapa passa por baixo do cartão flutuante, como na web: 120. Na geração e na proposta, a web também usa 120,
   * mas os 76 de baixo ficam atrás da barra fixa dos botões; no app a barra fica fora da rolagem, então o mapa cresce só o
   * que aparece (120 − 76 = 44).
   */
  extraChegada?: number;
  nos: readonly NoCaminho[];
  stu?: string;
  dicas?: readonly string[];
  recemConcluida?: string | null;
  chegada?: boolean;
  montando?: boolean;
  ocupado?: boolean;
  abrindo?: string | null;
  liberadas?: readonly string[];
  rolarPara?: string | null;
  /** `sempre`: rola mesmo que o nó já esteja na tela (pedido explícito da pessoa). */
  /**
   * `ceu`, na abertura: o topo do céu e o da faixa da Parte 1 na rolagem e a altura da faixa presa no alto, para a tela seguir
   * a regra da web (com o céu cortado, sobe até a Parte 1 ficar logo abaixo do cabeçalho preso).
   */
  aoRolar?: (topo: number, base: number, sempre?: boolean, ceu?: { topo: number; parte: number; coberto: number }, cobertoNoAlto?: number) => void;
  /** Posição da lente do nó atual na rolagem (topo e base), para a tela esconder o cartão fixo enquanto ele está à vista. */
  aoMedirAtual?: (topo: number, base: number) => void;
  acompanhar?: (ultimo: Faixa, alvo: Faixa) => void;
  aoAbrir?: (no: NoCaminho) => void;
}) {
  const medidas = useMedidas();
  const reduzir = useMovimentoReduzido();
  const { width, height: alturaTela } = useWindowDimensions();
  const largo = width >= 768;
  // A cápsula da barra de baixo flutua sobre o fim do mapa (no mapa da trilha, com `fimSobABarra` na tela): o morro do
  // troféu continua por baixo dela, com a altura que ela cobre a mais, sem faixa branca no fim. Sem a barra, 0.
  const espacoDaBarra = useContext(EspacoDaBarra);
  const [aberto, setAberto] = useState<string | null>(null);
  // Largura do caminho (a serpentina usa pixels): começa pela tela e se ajusta quando a lista mede.
  const [largura, setLargura] = useState(() => (largo ? Math.min(width, 620) : width));
  // A entrada em sequência só acontece numa trilha que já abre pronta, não quando a geração termina.
  const [entrada] = useState(() => !montando);
  const [festaNaChegada, setFestaNaChegada] = useState(false);
  const ventoPar = useVaiVem(1800);
  const ventoImpar = useVaiVem(2300);
  const alvos = useRef(new Map<string, ComponentRef<typeof View>>());
  // A barra da marca (e, no mapa, o cabeçalho da trilha) rola junto, como na web: as posições medidas aqui começam abaixo
  // delas. Enquanto a altura dessas faixas não chega (null), a posição do nó atual e a rolagem esperam.
  const deslocamentoMedido = useContext(DeslocamentoDaRolagem);
  const deslocamento = deslocamentoMedido ?? 0;
  const posicoes = useRef<{ inicio: number | null; parte: number | null; caminho: number | null; lista: number | null; linhas: Map<string, Caixa>; vindo: Caixa | null; chegada: Caixa | null }>(
    { inicio: null, parte: null, caminho: null, lista: null, linhas: new Map(), vindo: null, chegada: null });
  const coberto = useContext(AlturaDaFaixaFixa);
  const rolado = useRef<string | null>(null);
  const acompanhando = useRef<'novo' | 'fim' | null>(null);
  const estavaMontando = useRef(montando);
  const total = nos.length;
  const comChegada = chegada && total > 0;
  const trechos = Array.from(new Set(nos.map((no) => no.trecho)));
  const tudoFeito = total > 0 && nos.every((no) => no.estado === 'concluida');
  const indiceAberto = aberto ? nos.findIndex((no) => no.id === aberto) : -1;
  const tituloLiberada = nos.find((no) => no.id === liberadas[0])?.titulo ?? null;
  const primeiroTrecho = nos[0]?.trecho ?? 0;
  const ultimoTrecho = nos[total - 1]?.trecho ?? 0;
  const guiaNoCaminho = !montando && nos.some((no) => no.estado === 'atual');
  // Na criação, o Stu sai do troféu e vai para o lado do nó 1.
  const stuNaChegada = !montando && tudoFeito && criacao === null;
  // A trilha passou a existir (o aceite voltou): todos os nós perdem o tracejado da proposta junto com o caminho.
  const firmar = criacao === 'criada';
  // Na geração, o Stu fica do lado de fora da lição mais nova (ou da vaga, antes da primeira) e anda até a próxima.
  const [alvoStu, setAlvoStu] = useState<{ x: number; topo: number } | null>(null);
  const comRecem = recemConcluida !== null && nos.some((no) => no.id === recemConcluida);
  const comEntrada = entrada && !comRecem;
  const resumoTrechos = resumoDosTrechos(nos);

  useEffect(() => {
    if (!tituloLiberada) return;
    const espera = setTimeout(() => AccessibilityInfo.announceForAccessibility(mensagens.trilha.liberada(falarTextoComFormulas(tituloLiberada))), 900);
    return () => clearTimeout(espera);
  }, [tituloLiberada]);

  useEffect(() => {
    if (ocupado) setAberto(null);
  }, [ocupado]);

  // Enquanto a trilha é montada, o nó em esqueleto fica à vista se a pessoa estava vendo o último nó que chegou.
  useEffect(() => {
    if (!montando || total === 0) return;
    acompanhando.current = 'novo';
    tentarAcompanhar();
  }, [montando, total]);

  // Quando a montagem termina, a chegada entra no lugar do esqueleto e fica à vista pela mesma regra.
  useEffect(() => {
    const acabouDeMontar = estavaMontando.current && !montando;
    estavaMontando.current = montando;
    if (!acabouDeMontar) return;
    setFestaNaChegada(true);
    acompanhando.current = 'fim';
    tentarAcompanhar();
  }, [montando]);

  function tentarRolar() {
    if (deslocamentoMedido === null) return;
    const atual = nos.find((no) => no.estado === 'atual');
    const medidaAtual = atual && posicoes.current.linhas.get(atual.id);
    if (aoMedirAtual && medidaAtual && posicoes.current.caminho !== null && posicoes.current.lista !== null) {
      const topoAtual = deslocamento + posicoes.current.caminho + posicoes.current.lista + medidaAtual.y;
      aoMedirAtual(topoAtual, topoAtual + medidas.lente);
    }
    if (!rolarPara || !aoRolar || rolado.current === rolarPara) return;
    const { caminho, lista, linhas } = posicoes.current;
    const linha = linhas.get(rolarPara);
    const { inicio, parte } = posicoes.current;
    if (caminho === null || lista === null || linha === undefined || inicio === null) return;
    // A faixa da Parte 1 (quando há partes) precisa estar medida: é até ela que a tela sobe com o céu cortado.
    if (total > 0 && parte === null) return;
    rolado.current = rolarPara;
    const topo = deslocamento + caminho + lista + linha.y;
    // Como a web (src/ui/caminho.tsx): mostra o nó e, se o céu ficou cortado no alto, sobe até a Parte 1 ficar 12 abaixo da
    // faixa presa (a altura dela muda com o "Compartilhar" e com "Esta trilha é de", por isso é medida, não fixa).
    aoRolar(topo, topo + medidas.lente, false, parte === null ? undefined : { topo: deslocamento + caminho, parte: deslocamento + caminho + parte, coberto });
  }
  // Quando a altura das faixas do alto chega (ou muda), a posição do nó atual é informada de novo e a rolagem pendente segue.
  useEffect(() => {
    tentarRolar();
    tentarAcompanhar();
    informarNos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deslocamentoMedido]);

  /**
   * Acompanha o fim do caminho depois que as medidas chegam: o nó novo e o esqueleto (ou a chegada) só têm posição
   * depois do layout, que vem depois do efeito. Quem chegar por último completa o pedido.
   */
  function tentarAcompanhar() {
    if (deslocamentoMedido === null) return;
    const modo = acompanhando.current;
    const ultimo = nos[total - 1];
    if (!modo || !acompanhar || !ultimo) return;
    const { caminho, lista, linhas, vindo, chegada: fim } = posicoes.current;
    const linha = linhas.get(ultimo.id);
    const alvo = modo === 'novo' ? vindo : fim;
    if (caminho === null || lista === null || !linha || !alvo) return;
    // O esqueleto ainda na posição antiga (antes do nó novo) não serve: espera a medida nova.
    if (modo === 'novo' && alvo.y < linha.y + linha.altura - 1) return;
    acompanhando.current = null;
    const topoLinha = deslocamento + caminho + lista + linha.y;
    const topoAlvo = deslocamento + (modo === 'novo' ? caminho + lista + alvo.y : caminho + alvo.y);
    acompanhar({ topo: topoLinha, base: topoLinha + linha.altura }, { topo: topoAlvo, base: topoAlvo + alvo.altura });
  }

  /** A posição de cada nó medido na rolagem da tela (o topo da lente e o fim do nome), para a tela acompanhar a geração. */
  function informarNos() {
    const { caminho, lista, linhas } = posicoes.current;
    if (!aoMedirNo || deslocamentoMedido === null || caminho === null || lista === null) return;
    for (const [id, caixa] of linhas) {
      const topo = deslocamento + caminho + lista + caixa.y;
      // O nome embaixo do nó (até duas linhas) termina perto de 56 abaixo da lente.
      aoMedirNo(id, topo, topo + medidas.lente + 56);
    }
  }

  function tocar(no: NoCaminho) {
    if (no.estado === 'atual') {
      setAberto(null);
      aoAbrir?.(no);
      return;
    }
    setAberto(no.id);
  }

  /** Da folha de um nó bloqueado até a lição atual: fecha a folha, rola até o nó atual e põe o foco nele. */
  function irParaAtual() {
    const atual = nos.find((no) => no.estado === 'atual');
    setAberto(null);
    if (!atual) return;
    const { caminho, lista, linhas } = posicoes.current;
    const linha = linhas.get(atual.id);
    if (aoRolar && caminho !== null && lista !== null && linha) {
      // Spec 01 (e198866): na mesma conta da abertura (com as faixas do alto, `deslocamento`) e com a altura medida do
      // cabeçalho preso da trilha, para o nó nunca parar embaixo dele.
      const topo = deslocamento + caminho + lista + linha.y;
      // O conjunto é o nó e o balão dele, que fica acima da lente: o topo que precisa caber é o do balão.
      aoRolar(topo - BALAO_DO_ATUAL, topo + medidas.lente, true, undefined, coberto);
    }
    setTimeout(() => {
      const alvo = alvos.current.get(atual.id);
      if (alvo) AccessibilityInfo.sendAccessibilityEvent(alvo, 'focus');
    }, 350);
  }

  /** O balão do nó aberto mediu a altura: a tela rola até o balão e o nó caberem na área livre (spec 01, e198866). */
  const balaoEnquadrado = useRef<string | null>(null);
  useEffect(() => { balaoEnquadrado.current = null; }, [aberto]);
  function enquadrarBalao(id: string, altura: number) {
    if (balaoEnquadrado.current === id || !aoRolar) return;
    const { caminho, lista, linhas } = posicoes.current;
    const linha = linhas.get(id);
    if (caminho === null || lista === null || !linha) return;
    balaoEnquadrado.current = id;
    const topo = deslocamento + caminho + lista + linha.y;
    // O conjunto vai do topo do nó ao fim do balão (embaixo dele), com a folga: a tela rola o mínimo até caber.
    aoRolar(topo, topo + medidas.lente + BALAO_ABAIXO + altura + BALAO_FOLGA_FIM, true, undefined, coberto);
  }

  function fechar(devolverFoco = true) {
    const id = aberto;
    setAberto(null);
    if (!devolverFoco || !id) return;
    setTimeout(() => {
      const alvo = alvos.current.get(id);
      if (alvo) AccessibilityInfo.sendAccessibilityEvent(alvo, 'focus');
    }, 150);
  }

  function guardarAlvo(id: string, alvo: ComponentRef<typeof View> | null) {
    if (alvo) alvos.current.set(id, alvo);
    else alvos.current.delete(id);
  }

  return (
    <View style={[caminhoEstilos.caminho, largo ? caminhoEstilos.caminhoLargo : caminhoEstilos.caminhoTela, estilo]} onLayout={(evento) => {
      posicoes.current.caminho = evento.nativeEvent.layout.y;
      tentarRolar();
      informarNos();
    }}>
      <Inicio texto={semFala ? undefined : stu} trecho={primeiroTrecho} lente={medidas.lente} pensando={montando} placa={guiaNoCaminho || stuNaChegada} dicas={dicas}
        respiroNoAlto={semFala ? respiroNoAlto : 0}
        comecoAtual={nos[0]?.estado === 'atual'}
        aoMedir={(altura) => {
          posicoes.current.inicio = altura;
          tentarRolar();
        }}
        aoMedirParte={(y) => {
          posicoes.current.parte = y;
          tentarRolar();
        }}
        parte={total > 0 ? <Parte numero={1} trecho={primeiroTrecho} resumo={resumoTrechos.get(primeiroTrecho)} /> : null} />
      {/* Acima da chegada (zIndex 1): o título embaixo do último nó passa por cima do morro do troféu, inteiro e com a sombra,
          como na web (no app ele era cortado pela chegada, desenhada depois). */}
      <View accessibilityRole="list" accessibilityLabel={mensagens.trilha.licoes} style={{ zIndex: 1 }}
        onLayout={(evento) => {
          posicoes.current.lista = evento.nativeEvent.layout.y;
          const medida = Math.round(evento.nativeEvent.layout.width);
          if (medida > 0) setLargura((anterior) => anterior === medida ? anterior : medida);
          tentarRolar();
          informarNos();
        }}>
        {nos.map((no, indice) => {
          const seguinte = nos[indice + 1];
          const fimDoTrecho = seguinte !== undefined && seguinte.trecho !== no.trecho;
          const vaiAteChegada = seguinte === undefined && comChegada;
          const vaiAteVindo = seguinte === undefined && montando;
          const x = posicaoX(indice);
          const xSeguinte = seguinte !== undefined || vaiAteVindo ? posicaoX(indice + 1) : 50;
          // Como na web: só a prévia mostra o título ao lado; as outras mostram um título curto embaixo.
          // Como na web: prévia e trilha mostram o título do mesmo jeito, curto, embaixo do nó.
          const comRotulo = false;
          let depois = 0;
          if (seguinte?.estado === 'atual') depois += medidas.etiqueta;
          if (fimDoTrecho) depois += medidas.marco;
          // Título discreto embaixo de cada nó (o atual já mostra o nome no balão "Começar"): um pouco mais de espaço até o próximo.
          const discreto = no.estado !== 'atual' || !!no.ponte;
          // O balão do nó atual traz o nome: precisa de mais espaço acima dele.
          if (seguinte?.estado === 'atual') depois += 80;
          // Divisão de parte logo antes da lição atual: a pílula e o balão "Começar" (com o nome) precisam caber entre os nós.
          // Com o nome embaixo do nó, a pílula desce: o vão cresce na mesma medida.
          if (fimDoTrecho && seguinte?.estado === 'atual') depois += 56 + 56;
          if (discreto) depois += 14;
          // .caminho-no[data-discreto][data-ligado] (regra de baixo do caminho.css): passo + 30 entre dois nós discretos no mesmo
          // trecho (os casos antes da lição atual e no fim do trecho têm regras próprias, abaixo).
          if (discreto && !fimDoTrecho && seguinte && seguinte.estado !== 'atual') depois += 16;
          // M4 (paridade): como .caminho-no[data-estado='atual'][data-ligado] da web (passo + 28), o nó atual ligado ao próximo
          // ganha 28 embaixo; com a ponte ele já é discreto (+14), então completa até 28. Só acrescenta espaço.
          if (no.estado === 'atual' && !fimDoTrecho) depois += discreto ? 14 : 28;
          // Na prévia, o resumo da lição (até duas linhas) vem embaixo do nome.
          if (no.estado === 'previa' && no.resumo) depois += 36;
          // O título discreto não pode encostar no balão "Começar" do próximo, nem o do nó atual na faixa seguinte.
          // O nome embaixo do nó (até duas linhas) e o balão "Começar" do próximo não podem se encostar.
          if (discreto && seguinte?.estado === 'atual') depois += 80;
          // A1 (paridade, medido contra a web em 390): no fim do trecho, o vão até o próximo nó é o da web — 36 a mais depois do
          // nó atual e 18 depois de um nó discreto (18 e 8 deles antes da faixa da parte, o resto depois dela).
          if (no.estado === 'atual' && fimDoTrecho) depois += 52;
          if (no.estado !== 'atual' && discreto && fimDoTrecho) depois += 42;
          // Cada selo embaixo do título ("Reforço feito", "Vale rever") ocupa uma linha; a ponte desenhada, mais uma.
          // Antes do nó atual, o balão "Começar" já reserva a folga: cada selo soma 12 (a web, 344 px de lente a lente com dois selos).
          if (discreto) depois += (seguinte?.estado === 'atual' ? 12 : 22) * selosDoNo(no).length;
          const espaco = seguinte || vaiAteChegada || vaiAteVindo ? medidas.linhas + depois : 32;
          const surgir = montando && no.estado === 'previa';
          const recem = no.id === recemConcluida;
          const guia = guiaNoCaminho && no.estado === 'atual';
          const atrasoEntrada = surgir ? 0 : 100 + indice * 70;
          // Geração (spec 04): a lição mais nova nasce em passos (linha aos 120, nó aos 320, nome aos 420, cenário aos 560 e a
          // espera aos 700); na primeira de um trecho novo, o marco vem antes e tudo chega 200 ms depois.
          const novo = montando && indice === total - 1;
          const atrasos = atrasosDaLicao(indice > 0 && nos[indice - 1].trecho !== no.trecho);
          const linhaParaONovo = montando && seguinte !== undefined && indice === total - 2
            ? { atraso: atrasosDaLicao(seguinte.trecho !== no.trecho).linha, duracao: RITMO_DA_GERACAO.linhaMs } : null;
          const linhaParaAVaga = novo && vaiAteVindo ? { atraso: atrasos.espera, duracao: RITMO_DA_GERACAO.linhaMs } : null;

          // O espaço até o próximo nó fica dentro da linha (padding), para o chão da região não ter falhas e o marco anunciado caber nela.
          return (
            <Linha key={no.id} espaco={espaco} chao={coresDaRegiao(no.trecho).chao} elevada={aberto === no.id}
              aoMedir={(caixa) => {
                posicoes.current.linhas.set(no.id, caixa);
                if (montando && indice === total - 1) setAlvoStu((anterior) => anterior?.x === x && anterior.topo === caixa.y ? anterior : { x, topo: caixa.y });
                tentarRolar();
                tentarAcompanhar();
                informarNos();
              }}>
              {indice === 0 && <View pointerEvents="none" style={[caminhoEstilos.estradaInicial, { backgroundColor: estradaSobre(coresDaRegiao(no.trecho).chao), left: (largura * x) / 100 - 12,
                top: no.estado === 'atual' ? -70 : -22, height: (no.estado === 'atual' ? 70 : 22) + medidas.lente / 2 }]} />}
              <Terreno x={x} largura={largura} semEnfeites={comRotulo} trecho={no.trecho} indice={indice} medidas={medidas} brotar={surgir || comEntrada}
                atraso={surgir ? (novo ? atrasos.cenario : 0) : atrasoEntrada + 160} guia={guia} atrasoGuia={comRecem ? 1350 : 300}
                duracao={montando ? RITMO_DA_GERACAO.cenarioMs : 440} deZero={montando}
                vento={indice % 2 ? ventoImpar : ventoPar} />
              {fimDoTrecho && <Fronteira trechoSeguinte={seguinte.trecho} topo={medidas.lente} />}
              {(seguinte || vaiAteChegada || vaiAteVindo) && (
                <Ligacao de={x / 100} ate={xSeguinte / 100} feita={no.estado === 'concluida'} topo={medidas.lente / 2} chao={coresDaRegiao(no.trecho).chao}
                  desenhar={recem && no.estado === 'concluida'} alem={vaiAteChegada ? medidas.lente / 2 : 0} surgir={linhaParaONovo ?? linhaParaAVaga}
                  rascunho={rascunho && no.estado === 'previa'} firmar={firmar} />
              )}
              <Entra ativo={surgir || comEntrada} atraso={novo ? atrasos.no : atrasoEntrada} reduzir={reduzir} queda={montando}>
                <No no={no} posicao={posicaoDoNo(indice, total, montando)} x={x} largura={largura} comRotulo={comRotulo} medidas={medidas} reduzir={reduzir}
                  ocupado={ocupado} abrindo={abrindo === no.id} liberada={liberadas.includes(no.id)} recem={recem}
                  atrasoLiberacao={comRecem ? 860 : 0} guardar={(alvo) => { guardarAlvo(no.id, alvo); if (indice === 0) guardarNo1?.(alvo); }} tocar={() => tocar(no)}
                  atrasoNome={novo ? atrasos.nome : undefined} rascunho={rascunho && no.estado === 'previa' && !firmar}
                  respira={indice === 0 && criacao === 'criando'} virouAtual={indice === 0 && firmar} />
              </Entra>
              {aberto === no.id && (
                <BalaoDoNo titulo={no.titulo} texto={explicar(nos, indice)} estado={no.estado} x={x} largura={largura} reduzir={reduzir}
                  refazer={no.estado === 'concluida' && aoAbrir ? () => { fechar(false); aoAbrir(no); } : undefined}
                  irParaAtual={no.estado === 'bloqueada' && nos.some((outro) => outro.estado === 'atual') ? irParaAtual : undefined}
                  fechar={() => fechar()} aoMedir={(altura) => enquadrarBalao(no.id, altura)} lente={medidas.lente} />
              )}
              {montando && <Nascimento x={x} largura={largura} lente={medidas.lente} atraso={atrasos.no} animar={novo} reduzir={reduzir} />}
              {indice === 0 && (criacao !== null || stuNoNo1) && <StuDoNo1 x={x} largura={largura} lente={medidas.lente} tamanho={medidas.guia} criacao={criacao ?? 'pronta'} reduzir={reduzir} />}
              {fimDoTrecho && (
                <Marco topo={medidas.lente + (no.estado === 'atual' ? 37 : 36)} noAlto={seguinte?.estado === 'atual'}
                  queda={montando}>
                  <Parte numero={trechos.indexOf(no.trecho) + 2} trecho={seguinte.trecho} resumo={resumoTrechos.get(seguinte.trecho)} />
                </Marco>
              )}
            </Linha>
          );
        })}
        {montando && (
          <Vindo key={total} x={posicaoX(total)} largura={largura} medidas={medidas} chao={coresDaRegiao(ultimoTrecho).chao} folgaAbaixo={Math.round(alturaTela * 0.12)}
            aparecerEm={total === 0 ? 0 : atrasosDaLicao(total > 1 && nos[total - 2].trecho !== nos[total - 1].trecho).espera}
            aoMedir={(caixa) => {
              posicoes.current.vindo = caixa;
              if (total === 0) setAlvoStu((anterior) => anterior?.topo === caixa.y ? anterior : { x: posicaoX(0), topo: caixa.y });
              tentarAcompanhar();
            }} />
        )}
        {montando && semFala && alvoStu && (
          <StuQueAnda x={alvoStu.x} topo={alvoStu.topo} largura={largura} lente={medidas.lente} tamanho={medidas.guia} reduzir={reduzir}
            atraso={total === 0 ? 0 : atrasosDaLicao(total > 1 && nos[total - 2].trecho !== nos[total - 1].trecho).espera} />
        )}
      </View>
      {comChegada && (
        <Chegada trecho={ultimoTrecho} lente={medidas.lente} feita={tudoFeito} total={montando ? 0 : total} extra={largo ? 0 : extraChegada + espacoDaBarra}
          rascunho={rascunho} firmar={firmar}
          faltam={nos.filter((no) => no.estado !== 'concluida').length} stu={stuNaChegada} festa={(festaNaChegada && festaPermitida) || (comRecem && tudoFeito)}
          doZero={trofeuDoZero}
          aoMedir={(caixa) => {
          posicoes.current.chegada = caixa;
          tentarAcompanhar();
        }} />
      )}
    </View>
  );
}

function circulo(tamanho: number) {
  return { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
}

/**
 * Começo do mapa: céu e colinas da primeira região. Quando o Stu está no caminho, a frase vai numa placa de madeira;
 * senão, o Stu abre o mapa com a frase num balão. Enquanto a IA monta a trilha, o Stu "pensa" (sobe e desce devagar),
 * pontinhos digitam no balão e as dicas se revezam embaixo da frase.
 */
function Inicio({ texto, trecho, lente, pensando, placa, dicas, parte, comecoAtual, aoMedir, aoMedirParte, respiroNoAlto = 0 }: {
  /** Na geração, a placa presa no alto cobre o começo do céu: o céu ganha esta altura em cima. */
  respiroNoAlto?: number;
  aoMedir?: (altura: number) => void;
  /** Topo da faixa da Parte 1 dentro do céu. */
  aoMedirParte?: (y: number) => void;
  /** O primeiro nó é o atual: a faixa sobe para o balão "Começar" não cobri-la. */
  comecoAtual: boolean;
  texto?: string;
  trecho: number;
  lente: number;
  pensando: boolean;
  placa: boolean;
  dicas: readonly string[];
  /** Faixa da Parte 1, no pé do céu. */
  parte: ReactNode;
}) {
  const { chao, relevo } = coresDaRegiao(trecho);
  // Spec 13 (A2): o Stu do começo do mapa tem 92; montando, `stu-curioso` em laço (é espera); pronto, `stu-feliz` uma vez.
  const stu = 92;

  return (
    // Com o primeiro nó atual, o balão "Começar" (nome em até duas linhas) sobe até ~140 acima do nó: a faixa da Parte 1 fica
    // entre os postes da placa e o balão, sem que um cubra o outro (defeito e da rodada 4, em 360 e 412).
    // .caminho-inicio: céu em degradê contínuo (#d6e4ff até #ecf2ff aos 72%); sol em 14/18; nuvens em 22 à direita (8%) e em
    // 70 à esquerda (4%).
    <View style={[caminhoEstilos.inicio, degrade('linear-gradient(180deg, #d6e4ff 0%, #ecf2ff 72%)'), comecoAtual && { paddingBottom: INICIO_COM_BALAO },
      respiroNoAlto > 0 && { minHeight: Math.max(210, respiroNoAlto + 96) }]} onLayout={(evento) => aoMedir?.(evento.nativeEvent.layout.height)}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
        <Desenho nome="sol" largura={44} estilo={{ position: 'absolute', top: 14, left: 18 }} />
        <Desenho nome="nuvem" largura={64} estilo={{ position: 'absolute', top: 22, right: '8%' }} />
        <Desenho nome="nuvem" largura={46} estilo={{ position: 'absolute', top: 70, left: '4%' }} />
        <View style={caminhoEstilos.inicioColinas}>
          <Onda chao={chao} relevo={relevo} forma="inicio" />
        </View>
      </View>
      {texto && placa && <Placa texto={texto} />}
      {texto && !placa && (
        <View style={caminhoEstilos.inicioConteudo}>
          <View style={caminhoEstilos.fala}>
            <Text style={caminhoEstilos.falaTexto}>
              {texto}
              {pensando && <View style={caminhoEstilos.falaPontinhos}><Pontinhos cor={cores.acao} tamanho={6} vao={3} /></View>}
            </Text>
            {pensando && dicas.length > 0 && <DicaQueTroca dicas={dicas} />}
            <View style={caminhoEstilos.falaSeta} />
          </View>
          <Stu nome={pensando ? 'stu-curioso' : 'stu-feliz'} tamanho={stu} animado={pensando ? 'laco' : 'uma-vez'} sombra estilo={{ marginBottom: 8 }} />
        </View>
      )}
      {parte && <View testID="faixa-parte-inicio" pointerEvents="none" style={[caminhoEstilos.inicioParte, comecoAtual && { bottom: PARTE_COM_BALAO }]}
        onLayout={(evento) => aoMedirParte?.(evento.nativeEvent.layout.y)}>{parte}</View>}
    </View>
  );
}

/**
 * Com o primeiro nó atual: o fundo do começo (a placa termina 234 acima do pé do céu e os postes descem mais 30) e a faixa
 * da Parte 1, de 43 de altura, 152 acima do pé do céu. O balão "Começar" com o nome em duas linhas mede 104 e flutua 4:
 * sobra um respiro de 8 a 10 entre os postes, a faixa e o balão (medido na prévia em 360 e 412).
 */
// .caminho[data-comeco-atual] .caminho-inicio { padding-bottom: 242px } e a faixa da parte a 152 do pé.
const INICIO_COM_BALAO = 242;
const PARTE_COM_BALAO = 152;
/** O balão do nó atual ("Começar" e o título em até duas linhas) começa até 22 + 96 acima da lente: o topo do conjunto. */
const BALAO_DO_ATUAL = 22 + 96;
/** O balão do nó concluído ou bloqueado abre sempre embaixo, 20 abaixo da lente, com a seta para cima (como a web, 9709288). */
const BALAO_ABAIXO = 20;
/** A folga embaixo do balão, para ele ficar acima do card e da cápsula (a --folga-balao da web). */
const BALAO_FOLGA_FIM = 24;

/** Placa de madeira com a frase do Stu: entra balançando, presa em dois postes fincados nas colinas. */
function Placa({ texto }: { texto: string }) {
  const entrada = useAparecer(150, 520, true);
  return (
    <Animated.View testID="placa-stu" style={[caminhoEstilos.placaMadeira, {
      opacity: entrada,
      transform: [
        { rotate: entrada.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
        { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
      ],
    }]}>
      <View style={[caminhoEstilos.poste, { left: '22%' }]} />
      <View style={[caminhoEstilos.poste, { right: '22%' }]} />
      <Text style={caminhoEstilos.placaTexto}>{texto}</Text>
    </Animated.View>
  );
}

/** Uma dica nova a cada poucos segundos, enquanto a IA monta a trilha. */
function DicaQueTroca({ dicas }: { dicas: readonly string[] }) {
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (dicas.length < 2) return;
    const intervalo = setInterval(() => setIndice((atual) => (atual + 1) % dicas.length), 3600);
    return () => clearInterval(intervalo);
  }, [dicas.length]);
  return <Dica key={indice} texto={dicas[indice]} />;
}

function Dica({ texto }: { texto: string }) {
  const entrada = useAparecer(0, 420);
  return (
    <Animated.Text style={[caminhoEstilos.dica, {
      opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
    }]}>{texto}</Animated.Text>
  );
}

/** Linha do caminho: a faixa da região, da altura do nó até o próximo, com o nó, a ligação, a fronteira e o marco. */
function Linha({ espaco, chao, aoMedir, children, elevada = false }: {
  espaco: number;
  chao: string;
  /** A linha do nó com o balão aberto fica por cima das vizinhas (o balão sobe sobre a linha de cima). */
  elevada?: boolean;
  aoMedir: (caixa: Caixa) => void;
  children: ReactNode;
}) {
  // Item da lista "Lições da trilha": sem o papel, o leitor de tela via botões soltos dentro da lista (axe: aria-required-children).
  return (
    <View role="listitem" style={{ paddingBottom: espaco, backgroundColor: chao, ...(elevada ? { zIndex: 20 } : null) }}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      {children}
    </View>
  );
}

/**
 * Nó que cai no lugar com uma mola curta, como a web: na montagem, assim que chega; ao abrir a trilha, em sequência
 * (`atraso`). Com movimento reduzido, já aparece pronto.
 */
function Entra({ ativo, atraso, reduzir, queda = false, children }: {
  ativo: boolean;
  atraso: number;
  reduzir: boolean | null;
  /**
   * Geração (spec 04): o nó cai 26 px e pula, de 0,7 a 1,08 e de volta a 1, em 380 ms. Com movimento reduzido, só a
   * opacidade, em 150 ms, junto com o nome e o cenário.
   */
  queda?: boolean;
  children: ReactNode;
}) {
  const [entrada] = useState(() => ativo ? new Animated.Value(0) : null);
  // O atraso vale o do nascimento: quando outra lição chega, este nó não recomeça.
  const [atrasoInicial] = useState(atraso);

  useEffect(() => {
    if (!entrada || reduzir === null) return;
    if (reduzir) {
      if (!queda) {
        entrada.setValue(1);
        return;
      }
      const aparecer = Animated.timing(entrada, { toValue: 1, duration: RITMO_DA_GERACAO.reduzidoMs, useNativeDriver: true });
      aparecer.start();
      return () => aparecer.stop();
    }
    const animacao = queda
      ? Animated.timing(entrada, { toValue: 1, duration: RITMO_DA_GERACAO.noMs, delay: atrasoInicial, easing: Easing.linear, useNativeDriver: true })
      : Animated.timing(entrada, { toValue: 1, duration: 520, delay: atrasoInicial, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [entrada, atrasoInicial, reduzir, queda]);

  if (!entrada) return <>{children}</>;
  if (queda) {
    return (
      <Animated.View style={reduzir ? { opacity: entrada } : {
        opacity: entrada.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: entrada.interpolate({ inputRange: [0, 0.55, 1], outputRange: [-RITMO_DA_GERACAO.noQueda, 0, 0], easing: Easing.in(Easing.quad) }) },
          { scale: entrada.interpolate({ inputRange: [0, 0.55, 0.8, 1], outputRange: [0.7, 1.08, 0.98, 1] }) },
        ],
      }}>
        {children}
      </Animated.View>
    );
  }
  return (
    <Animated.View style={{
      opacity: entrada.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
      transform: [
        { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
        { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
      ],
    }}>
      {children}
    </Animated.View>
  );
}

/**
 * Cenário da linha: um enfeite grande e um miúdo no lado livre do nó; no nó atual, o Stu guia no lugar do enfeite grande.
 * Árvores e flores balançam com o `vento`. Na montagem e na entrada, o cenário brota depois do nó.
 */
function Terreno({ x, largura, semEnfeites, trecho, indice, medidas, brotar, atraso, guia, atrasoGuia, vento, duracao = 440, deZero = false }: {
  /** Geração: o cenário brota em 260 ms, da escala 0 (com movimento reduzido, 150 ms de opacidade). */
  duracao?: number;
  deZero?: boolean;
  /** Posição do nó, em % da largura: o cenário vai para o lado livre e o Stu, para o lado do nó. */
  x: number;
  largura: number;
  /** O nó tem rótulo no lado livre: sem enfeites ali. */
  semEnfeites: boolean;
  trecho: number;
  indice: number;
  medidas: Medidas;
  brotar: boolean;
  atraso: number;
  guia: boolean;
  atrasoGuia: number;
  vento: Animated.Value;
}) {
  const { grande } = enfeitesDaLinha(trecho, indice);
  const reduzir = useMovimentoReduzido();
  const [crescer] = useState(() => brotar ? new Animated.Value(0) : null);
  const [atrasoInicial] = useState(atraso);
  const direita = x >= 50;
  const centro = (largura * x) / 100;
  const { lente, enfeite, guia: tamGuia } = medidas;

  useEffect(() => {
    if (!crescer || reduzir === null) return;
    if (reduzir) {
      if (!deZero) {
        crescer.setValue(1);
        return;
      }
      const aparecer = Animated.timing(crescer, { toValue: 1, duration: RITMO_DA_GERACAO.reduzidoMs, useNativeDriver: true });
      aparecer.start();
      return () => aparecer.stop();
    }
    const animacao = Animated.timing(crescer, { toValue: 1, duration: duracao, delay: atrasoInicial, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [crescer, atrasoInicial, reduzir, duracao, deZero]);

  const ladoLivre = (distancia: number): ViewStyle => direita ? { left: distancia } : { right: distancia };
  const animacao = crescer ? { opacity: crescer, transform: [{ scale: reduzir ? 1 : crescer.interpolate({ inputRange: [0, 1], outputRange: [deZero ? 0 : 0.4, 1] }) }] } : null;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      {guia && (
        <GuiaStu tamanho={tamGuia} atraso={atrasoGuia} olhaParaEsquerda={posicaoX(indice + 1) < x} estilo={[{ position: 'absolute', top: lente / 2 - tamGuia * 0.9 },
          direita ? { left: centro + lente / 2 + 10 } : { right: largura - centro + lente / 2 + 10 }]} />
      )}
      {/* Como a web: no nó atual com o Stu guia, ele fica no lugar do enfeite grande; o enfeite miúdo não aparece nos nós com o
          título embaixo (.caminho-no[data-discreto] .caminho-enfeite--miudo { display: none }), que no celular são todos. */}
      {!semEnfeites && !guia && (
        <Animated.View style={[{ position: 'absolute', top: 6 }, ladoLivre(largura * 0.06), animacao]}>
          <Balanca nome={grande} vento={vento}><Desenho nome={grande} largura={enfeite} /></Balanca>
        </Animated.View>
      )}
    </View>
  );
}

/** Enfeite que balança com o vento, girando pela base; os que não balançam (pedras, casas, água) ficam parados. */
function Balanca({ nome, vento, children }: { nome: NomeDesenho; vento: Animated.Value; children: ReactNode }) {
  if (!desenhosQueBalancam.has(nome)) return <>{children}</>;
  return (
    <Animated.View style={{ transformOrigin: 'bottom', transform: [{ rotate: vento.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '2.5deg'] }) }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * O Stu ao lado do nó atual (spec 13): `stu-tres-quartos` olhando para o próximo nó (espelhado quando o caminho vira à
 * esquerda), na sombra de contato. Entra com um pulinho, flutua 4 px a cada 3,2 s (§B7) e se mexe de tempos em tempos
 * (emenda E1, um ciclo a cada 8 s). Com movimento reduzido, parado.
 */
function GuiaStu({ tamanho, atraso, estilo, olhaParaEsquerda }: { tamanho: number; atraso: number; estilo: ViewStyle[]; olhaParaEsquerda: boolean }) {
  const entrada = useAparecer(atraso, 460, true);
  const flutuar = useBalanco(4, 1600);
  return (
    <Animated.View style={[...estilo, { width: tamanho, opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      <Animated.View style={{ transform: [{ translateY: flutuar }] }}>
        <Stu nome="stu-tres-quartos" tamanho={tamanho} animado="periodico" espelhado={olhaParaEsquerda} sombra />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A lição que acabou de nascer (spec 04, passo 3): o anel do nó fica azul por 1,2 s, sem enfeite (revisão "Criar a
 * trilha"). Com movimento reduzido, o anel aparece e some sem animação. Decorativo.
 */
function Nascimento({ x, largura, lente, atraso, animar, reduzir }: {
  x: number; largura: number; lente: number; atraso: number;
  /** Só a lição que nasce agora; as que já estavam no mapa não comemoram de novo. */
  animar: boolean;
  reduzir: boolean | null;
}) {
  const [ligado] = useState(animar);
  const [atrasoInicial] = useState(atraso);
  const [anel] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!ligado || reduzir === null) return;
    if (reduzir) {
      anel.setValue(1);
      const apagar = setTimeout(() => anel.setValue(0), RITMO_DA_GERACAO.anelMs);
      return () => clearTimeout(apagar);
    }
    const animacao = Animated.sequence([
      Animated.delay(atrasoInicial),
      Animated.timing(anel, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(RITMO_DA_GERACAO.anelMs - 120),
      Animated.timing(anel, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]);
    animacao.start();
    return () => animacao.stop();
  }, [ligado, reduzir, atrasoInicial, anel]);
  if (!ligado) return null;
  const centro = (largura * x) / 100;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      <Animated.View style={[caminhoEstilos.anelNovo, circulo(lente + 8), { left: centro - lente / 2 - 4, top: -4, opacity: anel }]} />
    </View>
  );
}

/**
 * O Stu ao lado do nó 1: feliz (`stu-feliz`) quando a proposta fica pronta (spec 16, item 1) e, quando a pessoa toca em
 * "Começar a lição 1" (spec 04 e 13, "Criar a trilha"), no tamanho do guia
 * do mapa: chega andando (400 ms) e estuda em laço (`stu-estudando`) enquanto o aceite não volta; no erro, fica parado e
 * encorajador; quando a trilha passa a existir, faz um ciclo de `stu-comemorando`. Com movimento reduzido, já está no
 * lugar e não anda. Decorativo.
 */
function StuDoNo1({ x, largura, lente, tamanho, criacao, reduzir }: {
  x: number; largura: number; lente: number; tamanho: number; criacao: 'pronta' | 'criando' | 'erro' | 'criada'; reduzir: boolean | null;
}) {
  const centro = (largura * x) / 100;
  const direita = x < 50;
  const esquerda = direita ? centro + lente / 2 + 10 : centro - lente / 2 - 10 - tamanho;
  const [chegada] = useState(() => new Animated.Value(reduzir === false ? 0 : 1));
  useEffect(() => {
    if (reduzir !== false) {
      chegada.setValue(1);
      return;
    }
    const andar = Animated.timing(chegada, { toValue: 1, duration: RITMO_DA_GERACAO.stuMs, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    andar.start();
    return () => andar.stop();
    // Só ao chegar (a troca de pose não o faz andar de novo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pose: { nome: NomeStu; animado?: 'laco' | 'acontecimento'; acontecimento?: string } = criacao === 'criando'
    ? { nome: 'stu-estudando', animado: 'laco' }
    : criacao === 'criada' ? { nome: 'stu-comemorando', animado: 'acontecimento', acontecimento: 'criada' }
      : criacao === 'pronta' ? { nome: 'stu-feliz' } : { nome: 'stu-encorajador' };
  return (
    <Animated.View testID="stu-no1" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[caminhoEstilos.stuQueAnda, { width: tamanho, left: esquerda, top: lente / 2 - tamanho * 0.9, opacity: chegada,
        transform: [{ translateY: chegada.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]}>
      <View style={caminhoEstilos.guiaSombra} />
      <Stu key={pose.nome} nome={pose.nome} tamanho={tamanho} animado={pose.animado} acontecimento={pose.acontecimento} espelhado={direita} />
    </Animated.View>
  );
}

/**
 * O Stu na geração (spec 04): fica do lado de fora da lição mais nova (antes da primeira, ao lado da vaga), subindo e
 * descendo devagar, e anda até a próxima aos 700 ms (400 ms). Com movimento reduzido, o Stu fica parado e pula direto para
 * o lugar novo. Decorativo.
 */
function StuQueAnda({ x, topo, largura, lente, tamanho, atraso, reduzir }: {
  x: number; topo: number; largura: number; lente: number; tamanho: number; atraso: number; reduzir: boolean | null;
}) {
  const centro = (largura * x) / 100;
  const esquerda = x >= 50 ? centro + lente / 2 + 10 : centro - lente / 2 - 10 - tamanho;
  const alto = topo + lente / 2 - tamanho * 0.9;
  const [posicao] = useState(() => new Animated.ValueXY({ x: esquerda, y: alto }));
  const flutuar = useBalanco(5, 1400, reduzir === false);

  useEffect(() => {
    if (reduzir !== false) {
      posicao.setValue({ x: esquerda, y: alto });
      return;
    }
    const andar = Animated.timing(posicao, { toValue: { x: esquerda, y: alto }, duration: RITMO_DA_GERACAO.stuMs, delay: atraso, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    andar.start();
    return () => andar.stop();
    // O atraso é o da lição que acabou de nascer; só o lugar novo dispara a caminhada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esquerda, alto, reduzir]);

  return (
    <Animated.View testID="stu-geracao" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[caminhoEstilos.stuQueAnda, { width: tamanho, transform: [{ translateX: posicao.x }, { translateY: posicao.y }] }]}>
      <Animated.View style={[caminhoEstilos.guiaSombra, { transform: [{ scaleX: flutuar.interpolate({ inputRange: [-5, 0], outputRange: [0.8, 1] }) }] }]} />
      {/* Spec 13 (E1): mapa montando é espera, `stu-curioso` em laço; o sobe-e-desce da spec 04 vai por fora e a sombra fica
          no chão. */}
      <Animated.View style={{ transform: [{ translateY: flutuar }] }}>
        <Stu nome="stu-curioso" tamanho={tamanho} animado="laco" />
      </Animated.View>
    </Animated.View>
  );
}

/** Onde a próxima lição vai aparecer: lente tracejada e placa em esqueleto, fora do leitor de tela (a contagem diz o mesmo). */
function Vindo({ x, largura, medidas, chao, aoMedir, aparecerEm = 0, folgaAbaixo = 0 }: {
  x: number; largura: number; medidas: Medidas; chao: string; aoMedir: (caixa: Caixa) => void;
  /**
   * Geração: chão a mais embaixo da vaga, na cor da região, para a página ter altura para a lição mais nova ficar a 60% do
   * mapa (spec 04); sem ela, a rolagem batia no fim e a lição ficava a ~70%.
   */
  folgaAbaixo?: number;
  /** Geração: a próxima vaga aparece aos 700 ms da lição que acabou de nascer (com movimento reduzido, já aparece). */
  aparecerEm?: number;
}) {
  const reduzir = useMovimentoReduzido();
  const [giro] = useState(() => new Animated.Value(0));
  const [presenca] = useState(() => new Animated.Value(aparecerEm > 0 ? 0 : 1));
  useEffect(() => {
    if (aparecerEm <= 0 || reduzir === null) return;
    if (reduzir) {
      presenca.setValue(1);
      return;
    }
    const animacao = Animated.timing(presenca, { toValue: 1, duration: 200, delay: aparecerEm, useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
    // Só no nascimento da vaga (a chave muda a cada lição).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzir]);
  const centro = (largura * x) / 100;
  const direita = x >= 50;
  const { lente } = medidas;

  useEffect(() => {
    if (reduzir !== false) return;
    const ciclo = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 6000, easing: Easing.linear, isInteraction: false, useNativeDriver: true }));
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzir, giro]);
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ height: lente + 32 + folgaAbaixo, backgroundColor: chao }}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      <Animated.View style={[circulo(lente), caminhoEstilos.vindoLente, { position: 'absolute', top: 0, left: centro - lente / 2, opacity: presenca,
        transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
      <Animated.View style={[caminhoEstilos.rotulo, { height: lente, opacity: presenca },
        direita ? { right: largura - centro + lente / 2 + 16, alignItems: 'flex-end' } : { left: centro + lente / 2 + 16, alignItems: 'flex-start' }]}>
        <View style={[caminhoEstilos.placa, caminhoEstilos.vindoPlaca, direita && caminhoEstilos.vindoPlacaDireita]}>
          <View style={caminhoEstilos.vindoTitulo} />
          <View style={caminhoEstilos.vindoEstado} />
        </View>
      </Animated.View>
    </View>
  );
}

function No({ no, posicao, x, largura, comRotulo, medidas, reduzir, ocupado, abrindo, liberada, recem, atrasoLiberacao, guardar, tocar, atrasoNome,
  rascunho = false, respira = false, virouAtual = false }: {
  /** Geração: o nome entra do lado aos 420 ms (opacidade e 12 px, 220 ms); com movimento reduzido, 150 ms de opacidade. */
  atrasoNome?: number;
  /** Prévia em rascunho: face branca, contorno tracejado de 2 px e sem o lábio. */
  rascunho?: boolean;
  /** O nó 1 enquanto a trilha é criada: o anel respira. */
  respira?: boolean;
  /** O nó 1 quando a trilha passa a existir: pulsa e fica no estado atual, azul cheio. */
  virouAtual?: boolean;
  no: NoCaminho;
  /** "Lição 3 de 9", ou só "Lição 3" enquanto a trilha é montada. */
  posicao: string;
  /** Posição do nó, em % da largura do caminho. */
  x: number;
  largura: number;
  /** Mostra o título ao lado (nó atual e prévia); nos outros, o título abre na folha. */
  comRotulo: boolean;
  medidas: Medidas;
  reduzir: boolean | null;
  ocupado: boolean;
  abrindo: boolean;
  liberada: boolean;
  recem: boolean;
  atrasoLiberacao: number;
  guardar: (alvo: ComponentRef<typeof View> | null) => void;
  tocar: () => void;
}) {
  const [focado, setFocado] = useState(false);
  // Na prévia, a linha embaixo do título diz o que a lição ensina (quando o gerador diz); senão, a posição.
  let linha: string = no.estado === 'previa' ? no.resumo ?? posicao : mensagens.trilha.estados[no.estado];
  if (abrindo) linha = mensagens.trilha.abrindo;
  const { lente } = medidas;
  const centro = (largura * x) / 100;
  const direita = x >= 50;
  const atual = no.estado === 'atual';
  const selos = selosDoNo(no);
  // Mesmo formato da web (rodada 4.6): o atual começa pela ação, como o balão; nos outros, os selos vêm logo depois do
  // título. Na prévia, que não é botão, o resumo da lição entra no fim: no app ele aparece embaixo do nó, não num balão.
  const nome = nomeAcessivelDoNo(no, posicao);
  const rotuloA11y = no.estado === 'previa' && no.resumo ? `${nome} ${no.resumo}` : nome;
  const lugar = [caminhoEstilos.noLugar, { left: centro - lente / 2, width: lente, height: lente }];
  const [atrasoDoNome] = useState(atrasoNome);
  const [nomeEntrando] = useState(() => new Animated.Value(atrasoNome === undefined ? 1 : 0));
  useEffect(() => {
    if (atrasoDoNome === undefined || reduzir === null) return;
    const animacao = reduzir
      ? Animated.timing(nomeEntrando, { toValue: 1, duration: RITMO_DA_GERACAO.reduzidoMs, useNativeDriver: true })
      : Animated.timing(nomeEntrando, { toValue: 1, duration: RITMO_DA_GERACAO.nomeMs, delay: atrasoDoNome, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [atrasoDoNome, reduzir, nomeEntrando]);

  const rotulo = comRotulo && (
    <View pointerEvents="none" style={[caminhoEstilos.rotulo, { height: lente }, direita
      ? { right: largura - centro + lente / 2 + 16, alignItems: 'flex-end', maxWidth: Math.max(96, centro - lente / 2 - 28) }
      : { left: centro + lente / 2 + 16, alignItems: 'flex-start', maxWidth: Math.max(96, largura - centro - lente / 2 - 28) }]}>
      <View style={[caminhoEstilos.placa, atual && caminhoEstilos.placaAtual]}>
        {atual && <Text style={[caminhoEstilos.posicao, direita && caminhoEstilos.alinharFim, caixaAlta]}>{posicao}</Text>}
        <Text style={[caminhoEstilos.titulo, atual && caminhoEstilos.tituloAtual, no.estado === 'previa' && caminhoEstilos.tituloPrevia,
          direita && caminhoEstilos.alinharFim, focado && caminhoEstilos.tituloFocado]}>{no.titulo}</Text>
        {!atual && <Text numberOfLines={3} style={[caminhoEstilos.estado, { color: corDoEstado[no.estado] }, direita && caminhoEstilos.alinharFim]}>{linha}</Text>}
        {no.ponte && <><PonteNoMapa /><Text style={[caminhoEstilos.estado, { color: cores.acao }]}>{no.ponte.concluida ? mensagens.estudio.ponteMapaFeita : mensagens.estudio.ponteMapa}</Text></>}
        {/* O "vale rever" vem logo depois da ponte, sem sumir. */}
        {no.rever && no.estado === 'concluida' && (
          <Text style={[caminhoEstilos.estado, { color: cores.alerta }, direita && caminhoEstilos.alinharFim]}>{mensagens.trilha.valeRever}</Text>
        )}
      </View>
    </View>
  );
  // Como na web: o nome de cada lição fica à vista embaixo do nó (o atual já mostra o nome no balão "Começar"), para
  // achar uma lição e rever sem tocar uma por uma.
  // Como na web: o cartão do nome fica centrado no nó e estreita perto da borda (até 224, com 16 de folga de cada lado), em
  // vez de escorregar para dentro; assim o nome quebra nas mesmas linhas.
  const larguraRotulo = Math.max(120, Math.min(224, 2 * Math.min(centro, largura - centro) - 32));
  const discreto = !comRotulo && (!atual || !!no.ponte) && (
    <Animated.View pointerEvents="none" style={[caminhoEstilos.discreto, { top: lente + (atual ? 20 : 12), width: larguraRotulo, left: centro - larguraRotulo / 2 },
      atrasoDoNome !== undefined && { opacity: nomeEntrando, transform: [{ translateX: reduzir ? 0 : nomeEntrando.interpolate({ inputRange: [0, 1], outputRange: [RITMO_DA_GERACAO.nomeDeslize, 0] }) }] }]}>
      {/* O fundo fica na caixa, não no texto: assim o corte em duas linhas não deixa vazar a terceira. */}
      <View style={[caminhoEstilos.discretoCaixa, { maxWidth: larguraRotulo }, atual && caminhoEstilos.discretoCaixaAtual]}>
        {/* Até três linhas no celular (line-clamp 3) e sem palavra sozinha na última linha (text-wrap: pretty da web; no
            Android, a quebra equilibrada). */}
        <Text numberOfLines={3} textBreakStrategy="balanced" style={[caminhoEstilos.discretoTexto, quebraSemViuva,
          no.estado === 'concluida' && { color: cores.alerta }, atual && caminhoEstilos.discretoAtual]}>{no.titulo}</Text>
        {/* Como na web (no balão do toque): na prévia, o que a lição ensina. */}
        {no.estado === 'previa' && no.resumo && <Text numberOfLines={2} style={caminhoEstilos.discretoResumo}>{no.resumo}</Text>}
        {/* Como na web: os selos ficam no mesmo cartão do nome, em ordem (o reforço primeiro, o "vale rever" logo depois). */}
        {selos.map((selo) => (
          <View key={selo.texto} style={caminhoEstilos.seloNaCaixa}>
            {/* Como os selos da web: ícone de 14 com traço 3 (1,75 px). */}
            <Icone nome={selo.icone} tamanho={14} traco={3} cor={selo.rever ? cores.alerta : cores.acao} />
            <Text style={[caminhoEstilos.seloTexto, { color: selo.rever ? cores.alerta : cores.acao }]}>{selo.texto}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
  const moeda = (pressionado: boolean) => (
    <View style={atual ? { transform: [{ scale: 1.14 }] } : null}>
      <Lente no={no} medidas={medidas} reduzir={reduzir} liberada={liberada} recem={recem} atrasoLiberacao={atrasoLiberacao}
        pressionado={pressionado} focado={focado} puxa={(50 - x) * 1.5} rascunho={rascunho} respira={respira} virouAtual={virouAtual} />
    </View>
  );

  if (no.estado === 'previa') {
    return (
      <View accessible accessibilityLabel={rotuloA11y} style={{ height: lente }}>
        {/* A lente medida pela passagem da criação (o círculo cresce do centro dela). */}
        <View ref={guardar} collapsable={false} style={lugar}>{moeda(false)}</View>
        {rotulo}
        {discreto}
      </View>
    );
  }

  return (
    <View style={{ height: lente }}>
      <Pressable ref={guardar} accessibilityRole="button" accessibilityLabel={rotuloA11y}
        accessibilityState={{ disabled: ocupado, busy: abrindo }} disabled={ocupado} onPress={tocar} hitSlop={8}
        onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)} style={lugar}>
        {({ pressed }) => moeda(pressed)}
      </Pressable>
      {rotulo}
      {discreto}
    </View>
  );
}

/**
 * Lente do nó, com relevo: a face e o lábio embaixo; no toque, a face desce até o lábio. A atual ganha o anel, que entra
 * uma vez e depois respira devagar, e a etiqueta "Começar", que flutua. A recém-liberada mostra o cadeado se abrindo.
 * Com movimento reduzido, tudo já aparece no estado final, parado.
 */
function Lente({ no, medidas, reduzir, liberada, recem, atrasoLiberacao, pressionado, focado, puxa = 0, rascunho = false, respira = false, virouAtual = false }: {
  rascunho?: boolean;
  respira?: boolean;
  virouAtual?: boolean;
  /** Deslocamento do balão para o centro da tela (o nó fica de um lado): não encosta na borda; a seta segue no nó. */
  puxa?: number;
  no: NoCaminho;
  medidas: Medidas;
  reduzir: boolean | null;
  liberada: boolean;
  /** A lição que a pessoa acabou de concluir: a lente comemora com um pulo e confete. */
  recem: boolean;
  /** Espera extra do desbloqueio, para o próximo nó abrir depois que a linha chega. */
  atrasoLiberacao: number;
  pressionado: boolean;
  focado: boolean;
}) {
  const { lente } = medidas;
  const atual = no.estado === 'atual';
  // Lições à frente: cinza neutro e frio com lábio escuro, separado de qualquer terreno (como na web).
  // O nó 1 da prévia, quando a trilha passa a existir, vira o nó atual de sempre (azul cheio, com o lábio).
  const comoRascunho = rascunho && !virouAtual;
  const visual = virouAtual ? coresDaLente.atual : no.estado === 'bloqueada'
    ? { face: '#DFE3EE', labio: '#A9B1CA', icone: '#66708F' }
    : coresDaLente[no.estado];
  const halo = useRef(new Animated.Value(0)).current;
  const respiro = useRef(new Animated.Value(0)).current;
  const etiqueta = useRef(new Animated.Value(0)).current;
  const cadeado = useRef(new Animated.Value(1)).current;
  const escala = useRef(new Animated.Value(liberada ? 0.84 : recem ? 0.7 : 1)).current;
  const flutuar = useBalanco(4, 800, atual);

  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir) {
      halo.setValue(1);
      etiqueta.setValue(1);
      cadeado.setValue(0);
      escala.setValue(1);
      return;
    }
    const saida = Easing.out(Easing.ease);
    const animacoes: Animated.CompositeAnimation[] = [];
    const extra = liberada ? atrasoLiberacao : 0;
    if (atual) {
      animacoes.push(Animated.timing(halo, { toValue: 1, duration: 240, delay: liberada ? 560 + extra : 0, easing: saida, useNativeDriver: true }));
      animacoes.push(Animated.timing(etiqueta, { toValue: 1, duration: 200, delay: liberada ? 640 + extra : 120, easing: saida, useNativeDriver: true }));
    }
    if (recem) {
      animacoes.push(Animated.sequence([
        Animated.delay(200),
        Animated.timing(escala, { toValue: 1.2, duration: 260, easing: saida, useNativeDriver: true }),
        Animated.spring(escala, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      ]));
    }
    if (liberada) {
      animacoes.push(Animated.timing(cadeado, { toValue: 0, duration: 200, delay: 160 + extra, easing: saida, useNativeDriver: true }));
      animacoes.push(Animated.sequence([
        Animated.delay(340 + extra),
        Animated.timing(escala, { toValue: 1.08, duration: 144, easing: saida, useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: 96, easing: saida, useNativeDriver: true }),
      ]));
    }
    const grupo = Animated.parallel(animacoes);
    grupo.start();
    return () => grupo.stop();
  }, [reduzir, atual, liberada, recem, atrasoLiberacao, halo, etiqueta, cadeado, escala]);

  // A trilha passou a existir: o nó 1 pulsa (1 → 1,12 → 1 em 180 ms). Com movimento reduzido, sem pulso.
  useEffect(() => {
    if (!virouAtual || reduzir !== false) return;
    const pulso = Animated.sequence([
      Animated.timing(escala, { toValue: 1.12, duration: Math.round(RITMO_DA_GERACAO.pulsoMs * 0.55), easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(escala, { toValue: 1, duration: Math.round(RITMO_DA_GERACAO.pulsoMs * 0.45), easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    pulso.start();
    return () => pulso.stop();
  }, [virouAtual, reduzir, escala]);

  // O anel do nó atual respira devagar enquanto ele é o próximo passo.
  useEffect(() => {
    if (!atual || reduzir !== false) {
      respiro.setValue(0);
      return;
    }
    const balanco = { duration: 1100, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.delay(400),
      Animated.timing(respiro, { ...balanco, toValue: 1 }),
      Animated.timing(respiro, { ...balanco, toValue: 0 }),
    ]));
    ciclo.start();
    return () => {
      ciclo.stop();
      respiro.setValue(0);
    };
  }, [atual, reduzir, respiro]);

  // .caminho-no__lente > .icone: 42% da lente com traço 3.
  const tamanhoIcone = Math.round(lente * 0.42);
  // A revisão tem formato próprio: quadrado arredondado, não moeda (como na web).
  const forma = iconeDoNo(no) === 'revisao' ? { borderRadius: Math.round(lente * 0.32) } : null;
  const anel = atual ? 18 : 8;
  const afundar = pressionado ? 6 : 0;

  return (
    <View style={{ width: lente, height: lente }}>
      {atual && (
        <Animated.View style={[caminhoEstilos.halo, circulo(lente + 24), {
          opacity: Animated.multiply(halo, respiro.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] })),
          transform: [
            { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            { scale: respiro.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          ],
        }]} />
      )}
      {/* .caminho-no__lente da web: o brilho radial no alto, a faixa interna mais escura embaixo (inset 0 -5px 0), o lábio de 8
          por fora e a sombra suave (0 16px 22px); tocada, desce 6 e o lábio fica com 2. */}
      {respira && <AnelQueRespira lente={lente} reduzir={reduzir} />}
      {/* No rascunho (spec 04, "Criar a trilha"): face branca, contorno tracejado de 2 px `#9CB4F5`, sem o lábio nem a sombra. */}
      <Animated.View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(lente), forma, !comoRascunho && degrade(BRILHO_DA_LENTE), {
        top: afundar, backgroundColor: comoRascunho ? '#FFFFFF' : visual.face, transform: [{ scale: escala }],
        boxShadow: comoRascunho ? undefined : pressionado
          ? `inset 0 -5px 0 rgba(0, 0, 0, 0.06), 0 2px 0 ${visual.labio}, 0 6px 10px rgba(11, 27, 92, 0.12)`
          : `inset 0 -5px 0 rgba(0, 0, 0, 0.06), 0 8px 0 ${visual.labio}, 0 16px 22px rgba(11, 27, 92, 0.16)`,
      }, comoRascunho && caminhoEstilos.faceRascunho]}>
        <View><Icone nome={iconeDoNo(no)} tamanho={tamanhoIcone} cor={visual.icone} traco={3} /></View>
        {liberada && (
          <Animated.View style={[caminhoEstilos.cadeado, { borderRadius: lente / 2, opacity: cadeado }]}>
            <Icone nome="cadeado" tamanho={tamanhoIcone} cor={cores.tintaNeutra} traco={3} />
          </Animated.View>
        )}
        {recem && <Confete quantidade={12} />}
      </Animated.View>
      {no.estado === 'concluida' && <Text style={caminhoEstilos.brilho}>✦</Text>}
      {no.estado === 'bloqueada' && (
        <View style={caminhoEstilos.seloCadeado} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icone nome="cadeado" tamanho={14} cor={cores.fundo} traco={3} />
        </View>
      )}
      {focado && <View style={[caminhoEstilos.anelFoco, circulo(lente + anel * 2), { left: -anel, top: -anel }]} />}
      {atual && (
        <Animated.View style={[caminhoEstilos.etiquetaCaixa, { bottom: lente + 22, left: -110 + puxa, right: -110 - puxa }, {
          opacity: etiqueta,
          transform: [{ translateY: etiqueta.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }, { translateY: flutuar }],
        }]}>
          {/* Um balão só no nó atual: a ação e o nome da lição juntos, como na web. */}
          <View testID="balao-no-atual" style={caminhoEstilos.etiqueta}>
            <View style={[caminhoEstilos.etiquetaSeta, { marginLeft: -6 - puxa }]} />
            {/* O espaço de largura zero no fim separa a ação do título no texto visível do botão: sem ele, quem lê o texto
                da tela (o axe, o controle por voz na web) junta "COMEÇAR" e o título numa palavra só, e o nome do nó deixa de
                conter o texto visível (WCAG 2.5.3). Não ocupa largura: o balão fica igual. */}
            <View style={caminhoEstilos.etiquetaAcao}><Text style={[caminhoEstilos.etiquetaTexto, caixaAlta]}>{`${(no.andamento ? mensagens.trilha.continuarNo : mensagens.trilha.comecar)}​`}</Text></View>
            <Text numberOfLines={2} style={caminhoEstilos.etiquetaTitulo}>{no.titulo}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * O anel do nó 1 enquanto a trilha é criada (spec 04, "Criar a trilha"): um anel de 4 px `#8CAFFF` e, por fora, um halo
 * `#B4CDFF` que cresce até 9 px e volta (1,1 s por volta), como o box-shadow da web. Com movimento reduzido, só o anel.
 */
function AnelQueRespira({ lente, reduzir }: { lente: number; reduzir: boolean | null }) {
  const [respiro] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduzir !== false) return;
    const metade = { duration: RITMO_DA_GERACAO.respiroMs / 2, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(respiro, { ...metade, toValue: 1 }),
      Animated.timing(respiro, { ...metade, toValue: 0 }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzir, respiro]);
  const fora = lente + 18;
  return (
    <View testID="anel-no1" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      {reduzir === false && (
        <Animated.View style={[caminhoEstilos.camada, circulo(fora), { left: -9, top: -9, backgroundColor: '#B4CDFF',
          transform: [{ scale: respiro.interpolate({ inputRange: [0, 1], outputRange: [(lente + 8) / fora, 1] }) }] }]} />
      )}
      <View style={[caminhoEstilos.camada, circulo(lente + 8), { left: -4, top: -4, backgroundColor: '#8CAFFF' }]} />
    </View>
  );
}

/** Ponto de uma curva de Bézier cúbica numa coordenada. */
function bezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** A mesma curva da web: de um lado ao outro, ou do último nó até a chegada, no centro. */
function tracado(largura: number, altura: number, de: number, ate: number, passos: number): Ponto[] {
  const x0 = de * largura;
  const x3 = ate * largura;
  return Array.from({ length: passos + 1 }, (_, passo) => {
    const t = passo / passos;
    return { x: bezier(t, x0, x0, x3, x3), y: bezier(t, 0, altura / 2, altura / 2, altura) };
  });
}

/** Pontos a cada `intervalo` pixels ao longo do traçado, como o pontilhado da web. */
function pontilhar(amostras: Ponto[], intervalo: number) {
  const pontos: Ponto[] = [];
  let percorrido = 0;
  let proximo = intervalo / 2;
  for (let indice = 1; indice < amostras.length; indice += 1) {
    const de = amostras[indice - 1];
    const ate = amostras[indice];
    const trecho = Math.hypot(ate.x - de.x, ate.y - de.y);
    while (trecho > 0 && percorrido + trecho >= proximo) {
      const fracao = (proximo - percorrido) / trecho;
      pontos.push({ x: de.x + (ate.x - de.x) * fracao, y: de.y + (ate.y - de.y) * fracao });
      proximo += intervalo;
    }
    percorrido += trecho;
  }
  return pontos;
}

/** Traço grosso ao longo dos pontos: cada pedaço é uma cápsula girada, que cobre a emenda com a seguinte. */
export function tracoGrosso(pontos: readonly Ponto[], espessura: number, cor: string): ViewStyle[] {
  return pontos.slice(1).map((ate, indice) => {
    const de = pontos[indice];
    const comprimento = Math.hypot(ate.x - de.x, ate.y - de.y) + espessura;
    return {
      left: (de.x + ate.x) / 2 - comprimento / 2, top: (de.y + ate.y) / 2 - espessura / 2, width: comprimento, height: espessura,
      borderRadius: espessura / 2, backgroundColor: cor, transform: [{ rotate: `${Math.atan2(ate.y - de.y, ate.x - de.x)}rad` }],
    };
  });
}

/**
 * Ligação até o próximo nó: a estrada clara e, por cima, a linha pontilhada adiante e contínua depois de concluída.
 * Vai do pé da lente até o fim da linha.
 */
function Ligacao({ de, ate, feita, topo, chao, desenhar = false, alem = 0, surgir = null, rascunho = false, firmar = false }: {
  /** Prévia em rascunho (spec 04, "Criar a trilha"): só o tracejado 8/8 em `#9CB4F5`, sem a estrada. */
  rascunho?: boolean;
  /** A trilha passou a existir: o tracejado vira o caminho de sempre (180 ms de opacidade; com movimento reduzido, na hora). */
  firmar?: boolean;
  /**
   * Geração (spec 04): o caminho se desenha do nó anterior até a vaga, pedaço por pedaço (aos 120 ms, em 300 ms; até a vaga
   * seguinte, aos 700 ms). Com movimento reduzido, aparece de uma vez.
   */
  surgir?: { atraso: number; duracao: number } | null;
  /** Quanto a curva desce além da linha: até a chegada, a web vai metade da lente para dentro dela (.caminho-ligacao). */
  alem?: number;
  /** Chão da região, para a estrada opaca. */
  chao: string;
  /** Posições do nó e do próximo (ou da chegada), em fração da largura. */
  de: number;
  ate: number;
  feita: boolean;
  topo: number;
  /** A linha verde se desenha do nó até o próximo, pedaço por pedaço (a lição acabou de ser concluída). */
  desenhar?: boolean;
}) {
  const [caixa, setCaixa] = useState<{ largura: number; altura: number } | null>(null);
  const reduzir = useMovimentoReduzido();
  const [traco] = useState(() => new Animated.Value(desenhar ? 0 : 1));
  const [rastro] = useState(() => new Animated.Value(surgir ? 0 : 1));
  const [firme] = useState(() => new Animated.Value(rascunho ? 0 : 1));
  useEffect(() => {
    if (!rascunho) {
      firme.setValue(1);
      return;
    }
    if (!firmar) {
      firme.setValue(0);
      return;
    }
    if (reduzir !== false) {
      firme.setValue(1);
      return;
    }
    const animacao = Animated.timing(firme, { toValue: 1, duration: RITMO_DA_GERACAO.firmarMs, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [rascunho, firmar, reduzir, firme]);
  const atrasoDoRastro = surgir?.atraso;
  const duracaoDoRastro = surgir?.duracao;

  useEffect(() => {
    if (atrasoDoRastro === undefined || duracaoDoRastro === undefined) {
      rastro.setValue(1);
      return;
    }
    if (reduzir === null) return;
    if (reduzir) {
      rastro.setValue(1);
      return;
    }
    rastro.setValue(0);
    const animacao = Animated.timing(rastro, { toValue: 1, duration: duracaoDoRastro, delay: atrasoDoRastro, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [atrasoDoRastro, duracaoDoRastro, reduzir, rastro]);

  useEffect(() => {
    if (!desenhar || reduzir === null) return;
    if (reduzir) {
      traco.setValue(1);
      return;
    }
    const animacao = Animated.timing(traco, { toValue: 1, duration: 700, delay: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [desenhar, reduzir, traco]);
  const desenho = useMemo(() => {
    if (!caixa) return { base: [], verde: [], tracos: [] };
    const estrada = tracoGrosso(tracado(caixa.largura, caixa.altura, de, ate, 12), 24, feita && !desenhar ? corEstradaFeita : estradaSobre(chao));
    const pontos = pontilhar(tracado(caixa.largura, caixa.altura, de, ate, 48), 13).map((ponto): ViewStyle => ({
      left: ponto.x - 2.5, top: ponto.y - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: corPontilhado,
    }));
    const verde = feita ? tracoGrosso(tracado(caixa.largura, caixa.altura, de, ate, 12), 6, ouroLabio) : [];
    // O rascunho: traços de 8 com vãos de 8 ao longo da mesma curva (pontos a cada 8; um traço entre o par e o seguinte).
    const marcas = rascunho ? pontilhar(tracado(caixa.largura, caixa.altura, de, ate, 48), RITMO_DA_GERACAO.tracejadoPx) : [];
    const tracos = marcas.flatMap((ponto, indice) => indice % 2 === 0 && marcas[indice + 1]
      ? tracoGrosso([ponto, marcas[indice + 1]], RITMO_DA_GERACAO.tracejadoEspessura, corRascunho) : []);
    // Enquanto a linha verde se desenha, o pontilhado aparece embaixo dela.
    return { base: feita && !desenhar ? estrada : [...estrada, ...pontos], verde, tracos };
  }, [caixa, feita, desenhar, de, ate, chao, rascunho]);
  const pedacos = desenho.verde.length;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[caminhoEstilos.ligacao, { top: topo, bottom: -alem }]}
      onLayout={(evento) => {
        const { width, height } = evento.nativeEvent.layout;
        setCaixa((anterior) => anterior?.largura === width && anterior.altura === height ? anterior : { largura: width, altura: height });
      }}>
      {rascunho && desenho.tracos.map((estilo, indice) => (
        <Animated.View key={`r${indice}`} style={[caminhoEstilos.camada, estilo, {
          opacity: surgir
            ? Animated.multiply(rastro.interpolate({ inputRange: [indice / desenho.tracos.length, (indice + 1) / desenho.tracos.length], outputRange: [0, 1], extrapolate: 'clamp' }),
              firme.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }))
            : firme.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        }]} />
      ))}
      {/* O caminho de sempre: no rascunho, só aparece quando a trilha passa a existir. */}
      {desenho.base.map((estilo, indice) => surgir || rascunho ? (
        <Animated.View key={`b${indice}`} style={[caminhoEstilos.camada, estilo, {
          opacity: rascunho ? firme : rastro.interpolate({ inputRange: [indice / desenho.base.length, (indice + 1) / desenho.base.length], outputRange: [0, 1], extrapolate: 'clamp' }),
        }]} />
      ) : <View key={`b${indice}`} style={[caminhoEstilos.camada, estilo]} />)}
      {desenho.verde.map((estilo, indice) => (
        <Animated.View key={`v${indice}`} style={[caminhoEstilos.camada, estilo, desenhar && {
          opacity: traco.interpolate({ inputRange: [indice / pedacos, (indice + 1) / pedacos], outputRange: [0, 1], extrapolate: 'clamp' }),
        }]} />
      ))}
    </View>
  );
}

/**
 * Faixa da parte seguinte, inserida depois do último nó da parte anterior.
 */
function Marco({ topo, noAlto = false, queda = false, children }: {
  /** Geração: o marco de um trecho novo cai 12 px em 260 ms, antes da lição (com movimento reduzido, já aparece). */
  queda?: boolean;
  topo: number;
  /** Com o balão "Começar" logo abaixo, a pílula fica no alto do vão, sem dividir espaço com ele. */
  noAlto?: boolean;
  children: ReactNode;
}) {
  const reduzir = useMovimentoReduzido();
  const [chegada] = useState(() => new Animated.Value(queda ? 0 : 1));
  useEffect(() => {
    if (!queda || reduzir === null) return;
    if (reduzir) {
      chegada.setValue(1);
      return;
    }
    const animacao = Animated.timing(chegada, { toValue: 1, duration: RITMO_DA_GERACAO.marcoMs, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
    // Só quando o marco nasce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzir]);
  return (
    <View pointerEvents="box-none" style={[caminhoEstilos.ligacao, caminhoEstilos.marcoArea, { top: topo }, noAlto && caminhoEstilos.marcoNoAlto]}>
      <Animated.View style={{ opacity: chegada, transform: [{ translateY: chegada.interpolate({ inputRange: [0, 1], outputRange: [-RITMO_DA_GERACAO.marcoQueda, 0] }) }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

/** Faixa que abre cada parte da trilha: número, andamento e barra; dourada quando vencida. Sem nome de assunto. */
function Parte({ numero, resumo, trecho }: { numero: number; trecho: number; resumo?: ResumoTrecho }) {
  if (!resumo) return null;
  const vencida = !resumo.previa && resumo.feitas === resumo.total;
  // Na prévia (spec 04, "Criar a trilha"), só "Parte 2": sem contagem. No mapa salvo, o progresso de verdade.
  let texto: string | null = mensagens.trilha.parteProgresso(resumo.feitas, resumo.total);
  if (resumo.previa) texto = null;
  else if (vencida) texto = mensagens.trilha.parteVencida;
  const titulo = mensagens.trilha.parte(numero);
  return (
    <View testID={`faixa-parte-${numero}`} style={[caminhoEstilos.parte, { backgroundColor: coresDaRegiao(trecho).relevo, borderColor: coresDaRegiao(trecho).relevo }]}
      accessible accessibilityRole="header" accessibilityLabel={texto ? `${titulo}. ${texto}` : titulo}>
      <View style={[caminhoEstilos.parteSelo, vencida && caminhoEstilos.parteSeloVencida]}>
        <Icone nome={vencida ? 'trofeu' : 'bandeira'} tamanho={16} cor={vencida ? cores.ouroTexto : cores.fundo} />
      </View>
      <View style={caminhoEstilos.parteCorpo}>
        <View style={caminhoEstilos.parteTopo}>
          <Text style={caminhoEstilos.parteNumero}>{titulo}</Text>
          {texto !== null && <Text style={[caminhoEstilos.parteAndamento, vencida && { color: cores.alerta }]}>{texto}</Text>}
        </View>
      </View>
    </View>
  );
}

/** Chegada: o topo do caminho, com o troféu numa colina e bandeiras; fica dourada quando todas as lições estão concluídas. */
function Chegada({ trecho, lente, feita, stu, festa, total, faltam, aoMedir, extra = 0, doZero = false, rascunho = false, firmar = false }: {
  /** Prévia em rascunho: a reta até o troféu também é tracejada; vira a estrada de sempre quando a trilha passa a existir. */
  rascunho?: boolean;
  firmar?: boolean;
  /** Fim da geração: o troféu entra de 0 a 1,1 e volta a 1 em 420 ms (com movimento reduzido, já aparece). */
  doZero?: boolean;
  /** No celular, o morro continua por baixo do cartão flutuante (pontos a mais embaixo). */
  extra?: number;
  trecho: number;
  /** Lições que faltam: o troféu tocado diz quantas. */
  faltam: number;
  /** Lições da trilha, para a meta embaixo do troféu. */
  total: number;
  lente: number;
  feita: boolean;
  stu: boolean;
  festa: boolean;
  aoMedir: (caixa: Caixa) => void;
}) {
  const { chao, relevo } = coresDaRegiao(trecho);
  const { width: larguraTela } = useWindowDimensions();
  const larguraColina = Math.min(larguraTela * 0.94, 440);
  // .caminho-chegada__lente: lente-base + 20.
  const tamanho = lente + 20;
  const reduzir = useMovimentoReduzido();
  const [pop] = useState(() => new Animated.Value(doZero ? 0 : festa ? 0.5 : 1));
  const [bolha, setBolha] = useState<string | null>(null);
  const [toques, setToques] = useState(0);
  const [firme] = useState(() => new Animated.Value(rascunho ? 0 : 1));
  useEffect(() => {
    if (!rascunho || !firmar || reduzir !== false) {
      firme.setValue(!rascunho || firmar ? 1 : 0);
      return;
    }
    const animacao = Animated.timing(firme, { toValue: 1, duration: RITMO_DA_GERACAO.firmarMs, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [rascunho, firmar, reduzir, firme]);
  useEffect(() => {
    if (!bolha) return;
    const espera = setTimeout(() => setBolha(null), 3000);
    return () => clearTimeout(espera);
  }, [bolha]);

  useEffect(() => {
    if (!doZero || reduzir === null) return;
    if (reduzir) {
      pop.setValue(1);
      return;
    }
    const entrar = Animated.sequence([
      Animated.timing(pop, { toValue: 1.1, duration: Math.round(RITMO_DA_GERACAO.trofeuMs * 0.6), easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: Math.round(RITMO_DA_GERACAO.trofeuMs * 0.4), easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]);
    entrar.start();
    return () => entrar.stop();
    // Só quando a chegada nasce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzir]);

  useEffect(() => {
    if (!festa || reduzir === null || doZero) return;
    if (reduzir) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0.5);
    const animacao = Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [festa, reduzir, pop]);
  return (
    <View style={[caminhoEstilos.chegada, { backgroundColor: chao, minHeight: 265 + extra, paddingBottom: 30 + extra }]}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
        {/* A reta começa onde a curva da última lição termina (metade da lente para dentro da chegada) e vai até 140, como a
            web; o pontilhado segue o da estrada, a cada 14 a partir do começo da reta. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: firme }]}>
          <View style={[caminhoEstilos.chegadaEstrada, { top: lente / 2, height: 140 - lente / 2, backgroundColor: estradaSobre(chao) }]} />
          {!feita && Array.from({ length: Math.floor((140 - lente / 2) / 14) + 1 }, (_, indice) => (
            <View key={indice} style={[caminhoEstilos.pontoEstrada, { top: lente / 2 - 3 + indice * 14 }]} />
          ))}
        </Animated.View>
        {/* O rascunho: traços de 8 + as pontas redondas de 5 (como o stroke-linecap da web), a cada 16. */}
        {rascunho && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: firme.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            {Array.from({ length: Math.floor((140 - lente / 2) / (RITMO_DA_GERACAO.tracejadoPx * 2)) }, (_, indice) => (
              <View key={indice} style={[caminhoEstilos.tracoChegada, { top: lente / 2 + 4 + indice * RITMO_DA_GERACAO.tracejadoPx * 2,
                height: RITMO_DA_GERACAO.tracejadoPx + RITMO_DA_GERACAO.tracejadoEspessura }]} />
            ))}
          </Animated.View>
        )}
        {/* .caminho-chegada__colina: cúpula de 94% da largura (até 440), raio vertical de 190, que desce mais `extra` embaixo. */}
        {/* Meia elipse de raio horizontal igual à metade da largura e vertical de 190 (border-radius 50% / 190px da web). */}
        <ColinaElipse largura={larguraColina} baixo={-48} altura={190 + extra} raioVertical={190 / (190 + extra)} cor={relevo}
          estilo={{ left: '50%', marginLeft: -larguraColina / 2 }} />
        <Desenho nome="bandeira" largura={30} estilo={[caminhoEstilos.chegadaBandeira, { bottom: 96 + extra, left: '50%', marginLeft: -104 }]} />
        <Desenho nome="bandeira" largura={30} estilo={[caminhoEstilos.chegadaBandeira, { bottom: 96 + extra, right: '50%', marginRight: -104, transform: [{ scaleX: -1 }] }]} />
        {/* Brilho e estrelas só com a trilha concluída (spec 13 §B4, revisão de 917e40c): antes, a lente branca com a silhueta. */}
        {feita && (
          <>
            <Desenho nome="estrela" largura={22} estilo={{ position: 'absolute', bottom: 150 + extra, left: '50%', marginLeft: -72 }} />
            <Desenho nome="estrela" largura={16} estilo={{ position: 'absolute', bottom: 172 + extra, right: '50%', marginRight: -66 }} />
            <Desenho nome="estrela" largura={14} estilo={{ position: 'absolute', bottom: 118 + extra, right: '50%', marginRight: -98 }} />
          </>
        )}
      </View>
      {stu && (
        // Spec 13: `stu-comemorando` de 64 ao lado do troféu, na sombra de contato, parado (como a chegada da web). No fim da
        // proposta (spec 04, "Criar a trilha"), um ciclo de `stu-feliz`: a trilha ainda não existe, a festa fica para o aceite.
        <View style={[caminhoEstilos.chegadaStu, { bottom: 74 + extra }]}>
          {doZero ? <Stu nome="stu-feliz" tamanho={64} sombra animado="uma-vez" /> : <Stu nome="stu-comemorando" tamanho={64} sombra />}
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={mensagens.trilha.trofeu} disabled={total === 0 && !feita}
        onPress={() => {
          const texto = feita ? mensagens.trilha.trofeuConquistado : mensagens.trilha.trofeuProgresso(total - faltam, total);
          setBolha(texto);
          setToques((anterior) => anterior + 1);
          AccessibilityInfo.announceForAccessibility(texto);
          if (reduzir === false) {
            pop.setValue(0.6);
            Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
          }
        }}>
      {bolha && <View pointerEvents="none" style={caminhoEstilos.bolhaTrofeu}><Text style={caminhoEstilos.bolhaTrofeuTexto}>{bolha}</Text></View>}
      <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={{ width: tamanho, height: tamanho + 7, transform: [{ scale: pop }] }}>
        {/* Halo dourado em volta do troféu, só conquistado. */}
        {feita && <View style={[caminhoEstilos.camada, circulo(tamanho + 28), { left: -14, top: -14, backgroundColor: 'rgba(255, 207, 77, 0.42)' }]} />}
        {/* Spec 13 (B4, Designer 19/11): `acessorio-trofeu` (faixa M) no lugar do troféu desenhado, com 72% do lado da lente,
            numa lente de face branca, borda de 3 #E0A92E e lábio #C7922A nos dois estados. Antes da conquista, silhueta
            #8A93B0 a 40%; ao concluir, a cor cheia com o pop de hoje (o troféu não tem versão animada no kit). */}
        <View style={[caminhoEstilos.camada, circulo(tamanho), { top: 8, backgroundColor: '#C7922A' }]} />
        <View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(tamanho), { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#E0A92E' }]}>
          <Stu nome="acessorio-trofeu" tamanho={Math.round(tamanho * 0.72)} silhueta={feita ? undefined : '#8A93B0'} estilo={feita ? undefined : { opacity: 0.4 }} />
        </View>
        {festa && <Confete quantidade={18} />}
        {bolha && feita && <Confete key={bolha + toques} quantidade={14} />}
      </Animated.View>
      </Pressable>
      <View style={caminhoEstilos.chegadaPlaca}>
        <Text style={[caminhoEstilos.chegadaTexto, { color: '#9A5B00' }]}>
          {feita ? mensagens.trilha.chegadaFeita : mensagens.trilha.chegada}
        </Text>
      </View>
      {!feita && total > 0 && <Text style={caminhoEstilos.chegadaMeta}>{mensagens.trilha.chegadaMeta(total)}</Text>}
    </View>
  );
}

/** Explicação do nó concluído ou bloqueado, numa folha que sobe do rodapé, com área segura. */
/**
 * O balão de uma lição concluída ou bloqueada, no mapa (spec 01, c7059a8: um componente só, como a web): título e
 * "fechar" de 44, o texto do estado (explicar()), "Refazer" na concluída e "Mostrar a lição atual no mapa" na bloqueada.
 * Abre sempre embaixo, 20 abaixo da lente, com a seta para cima (como a web), e mede a altura para a tela enquadrar o conjunto (e198866). Fecha pelo X,
 * pelo voltar do Android e ao tocar em outro nó; o foco vai ao título ao abrir e volta ao nó ao fechar.
 */
function BalaoDoNo({ titulo, texto, estado, x, largura, reduzir, refazer, irParaAtual, fechar, aoMedir, lente }: {
  lente: number;
  titulo: string;
  texto: string;
  estado: EstadoNo;
  /** Posição do nó, em % da largura do caminho. */
  x: number;
  largura: number;
  reduzir: boolean | null;
  refazer?: () => void;
  /** Nó bloqueado: leva até a lição atual. */
  irParaAtual?: () => void;
  fechar: () => void;
  aoMedir: (altura: number) => void;
}) {
  const cabecalho = useRef<ComponentRef<typeof Text>>(null);
  const [focado, setFocado] = useState(false);
  const [altura, setAltura] = useState(0);
  const entrada = useAparecer(0, reduzir === false ? 200 : 0);
  const concluida = estado === 'concluida';
  const largo = Math.min(320, Math.max(0, largura - 32));
  const centro = (largura * x) / 100;
  const esquerda = Math.min(Math.max(16, centro - largo / 2), Math.max(16, largura - largo - 16));
  useEffect(() => {
    const espera = setTimeout(() => { if (cabecalho.current) AccessibilityInfo.sendAccessibilityEvent(cabecalho.current, 'focus'); }, 120);
    if (Platform.OS === 'web') return () => clearTimeout(espera);
    const evento = ouvirVoltar(() => { fechar(); return true; });
    return () => { clearTimeout(espera); evento.remove(); };
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View testID="balao-no" role="dialog" aria-label={titulo} accessibilityViewIsModal
      onLayout={(evento) => { const h = evento.nativeEvent.layout.height; if (Math.abs(h - altura) > 1) { setAltura(h); aoMedir(h); } }}
      style={[caminhoEstilos.balaoNo, concluida && caminhoEstilos.balaoNoConcluido, { left: esquerda, width: largo, top: lente + BALAO_ABAIXO,
        opacity: altura > 0 ? entrada : 0, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <View style={[caminhoEstilos.balaoNoSeta, concluida && caminhoEstilos.balaoNoConcluido, { left: Math.min(Math.max(16, centro - esquerda - 7), largo - 30) }]} />
      <View style={caminhoEstilos.folhaTopo}>
        {/* Só o título e o "fechar", sem o ícone de estado (9709288); a concluída tem o título no âmbar da web. */}
        <Text ref={cabecalho} accessible accessibilityRole="header"
          style={[estilos.tituloBloco, caminhoEstilos.folhaTitulo, concluida && { color: '#9A5B00' }]}>{titulo}</Text>
        <Pressable testID="balao-no-fechar" accessibilityRole="button" accessibilityLabel={mensagens.trilha.fechar} onPress={fechar}
          onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
          style={({ pressed }) => [caminhoEstilos.fechar, pressed && caminhoEstilos.fecharPressionado, focado && estilos.foco]}>
          <Icone nome="fechar" tamanho={20} cor={cores.textoSecundario} />
        </Pressable>
      </View>
      <Text style={estilos.textoSecundario}>{texto}</Text>
      {refazer && <View style={caminhoEstilos.folhaAcao}><Botao testID="balao-no-refazer" rotulo={mensagens.trilha.refazer} variante="secundario" acao={refazer} /></View>}
      {irParaAtual && <View style={caminhoEstilos.folhaAcao}><Botao testID="balao-no-ir-atual" rotulo={mensagens.trilha.irParaAtual} icone="seta" variante="secundario" acao={irParaAtual} /></View>}
    </Animated.View>
  );
}

/** Carregando a trilha: esqueleto com a forma da faixa do topo e do mapa, nas cores dos campos. */
export function SkeletonTrilha() {
  const { lente } = useMedidas();
  // Como .skeleton-trilha da web: três barras (60% × 28, a linha inteira e 40% × 12) e o chão da primeira região com quatro
  // nós claros nas posições 50%, 67%, 74% e 67%, 46 pontos entre eles e 56 de respiro em cima e embaixo.
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={mensagens.trilha.carregando} accessibilityLiveRegion="polite"
      style={caminhoEstilos.skeleton}>
      <View style={caminhoEstilos.skeletonCabecalho}>
        <View style={[caminhoEstilos.skeletonLinha, { width: '60%', height: 28 }]} />
        <View style={caminhoEstilos.skeletonLinha} />
        <View style={[caminhoEstilos.skeletonLinha, { width: '40%', height: 12 }]} />
      </View>
      <View style={[caminhoEstilos.skeletonCaminho, { backgroundColor: coresDaRegiao(0).chao }]}>
        {[50, 67, 74, 67].map((x, indice) => (
          // A sombra de 8 da web (0 8px 0, branco a 45%) vira um segundo círculo atrás; o passo entre os nós continua 72 + 46.
          <View key={indice} style={{ width: lente, height: lente + 8, marginLeft: `${x}%` as DimensionValue, transform: [{ translateX: -lente / 2 }] }}>
            <View style={[circulo(lente), caminhoEstilos.skeletonNoSombra]} />
            <View style={[circulo(lente), caminhoEstilos.skeletonNo]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const caminhoEstilos = StyleSheet.create({
  caminho: { marginTop: 8 },
  // No celular o mapa termina com cantos arredondados, como na web.
  caminhoTela: { marginHorizontal: -20 },
  caminhoLargo: { borderRadius: 28, overflow: 'hidden' },
  // Começo do mapa
  inicio: { minHeight: 210, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 16,
    paddingTop: 22, paddingBottom: 104, overflow: 'hidden', backgroundColor: '#D6E4FF' },
  inicioParte: { position: 'absolute', left: 16, right: 16, bottom: 22, alignItems: 'center', zIndex: 2 },
  inicioColinas: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 76 },
  inicioConteudo: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, flexShrink: 1 },
  // .caminho-inicio__fala: o degrau de 3 é sombra por fora (box-shadow 0 3px 0 rgb(27 42 94 / 0.08)), não borda.
  fala: { flexShrink: 1, maxWidth: 272, marginBottom: 30, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18,
    backgroundColor: cores.fundo, boxShadow: '0 3px 0 rgba(11, 27, 92, 0.08)' },
  falaTexto: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20 },
  falaPontinhos: { height: 14, justifyContent: 'center', paddingLeft: 6 },
  dica: { marginTop: 6, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  // .caminho-placa: borda de 3 em volta (#c79a62) e o degrau de 4 por fora (box-shadow 0 4px 0 #b0844d).
  placaMadeira: { maxWidth: 272, marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 3,
    borderColor: '#C79A62', backgroundColor: '#F7E3C2', boxShadow: '0 4px 0 #B0844D' },
  // .caminho-placa::before/::after: 22 de altura a partir da borda da placa, por trás do degrau de 4; aqui o poste é filho da
  // placa (fica por cima do degrau), então começa abaixo dele: os mesmos 18 à vista, com o pé no mesmo lugar.
  poste: { position: 'absolute', bottom: -25, width: 8, height: 18, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#A87650' },
  placaTexto: { color: '#5B3A17', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  // .caminho-guia::after: elipse (border-radius 50%), não barra arredondada.
  guiaSombra: { position: 'absolute', left: '18%', right: '18%', bottom: -2, height: 8, borderRadius: '50%', backgroundColor: 'rgba(11, 27, 92, 0.14)' },
  falaSeta: { position: 'absolute', right: -6, bottom: 18, width: 16, height: 16, borderRadius: 3, backgroundColor: cores.fundo,
    transform: [{ rotate: '45deg' }] },
  // Nó e rótulo
  noLugar: { position: 'absolute', top: 0 },
  rotulo: { position: 'absolute', top: 0, justifyContent: 'center', zIndex: 2 },
  placa: { maxWidth: '100%', gap: 2, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.94)', boxShadow: '0 3px 0 rgba(11, 27, 92, 0.08)' },
  // .caminho-no[data-estado='atual'] .caminho-no__texto: borda de 2 e degrau de 4 por fora em azul claro.
  placaAtual: { borderWidth: 2, borderColor: 'rgba(68, 102, 228, 0.28)', boxShadow: '0 4px 0 rgba(68, 102, 228, 0.16)' },
  posicao: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 21 },
  tituloAtual: { fontSize: 17, lineHeight: 22 },
  tituloPrevia: { fontSize: 15, lineHeight: 20 },
  // .caminho-no[data-discreto] .caminho-no__texto: até 14rem (224) de largura, centrado no nó.
  discreto: { position: 'absolute', width: 224, alignItems: 'center', zIndex: 2 },
  discretoAtual: { color: cores.acao, fontWeight: '800', fontSize: 14 },
  // .caminho-no[data-discreto] .caminho-no__texto: degrau chapado de 2 por fora (box-shadow 0 2px 0 rgb(27 42 94 / 0.06));
  // a elevation do Android desenhava uma sombra borrada.
  discretoCaixa: { maxWidth: 224, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: cores.fundo,
    boxShadow: '0 2px 0 rgba(11, 27, 92, 0.06)' },
  discretoCaixaAtual: { borderWidth: 2, borderColor: 'rgba(68, 102, 228, 0.28)' },
  seloCadeado: { position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: cores.fundo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#98A1BD' },
  discretoTexto: {
    color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 17.55, textAlign: 'center' },
  discretoResumo: { marginTop: 2, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 12, lineHeight: 16, textAlign: 'center' },
  // .caminho-ponte: 12 px na entrelinha de 1,5, com o passo de 26 medido na web (8 do nome ou do selo anterior).
  seloNaCaixa: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    backgroundColor: cores.fundo },
  seloTexto: { fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 18 },
  ponteDiscreta: { marginTop: 6 },
  bolhaTrofeu: { position: 'absolute', bottom: '100%', left: -80, right: -80, marginBottom: 12, alignItems: 'center', zIndex: 3 },
  bolhaTrofeuTexto: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: '#FFE08A',
    overflow: 'hidden', backgroundColor: '#FFF8E1', color: cores.ouroTexto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  // .caminho-chegada__meta: 0,8125rem em 700 com a entrelinha do corpo (1,5): 19,5.
  chegadaMeta: { marginTop: -6, paddingHorizontal: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 19.5, textAlign: 'center' },
  estradaInicial: { position: 'absolute', top: -22, width: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: corEstrada },
  brilho: { position: 'absolute', top: -6, right: -2, color: '#FFB703', fontSize: 18, lineHeight: 20 },
  tituloFocado: { textDecorationLine: 'underline' },
  estado: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  alinharFim: { textAlign: 'right' },
  camada: { position: 'absolute', left: 0, top: 0 },
  face: { alignItems: 'center', justifyContent: 'center' },
  faceRascunho: { borderWidth: 2, borderStyle: 'dashed', borderColor: corRascunho },
  tracoChegada: { position: 'absolute', left: '50%', marginLeft: -RITMO_DA_GERACAO.tracejadoEspessura / 2, width: RITMO_DA_GERACAO.tracejadoEspessura,
    borderRadius: RITMO_DA_GERACAO.tracejadoEspessura / 2, backgroundColor: corRascunho },
  halo: { position: 'absolute', left: -12, top: -12, borderWidth: 6, borderColor: 'rgba(68, 102, 228, 0.22)' },
  cadeado: { position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.faceNeutra },
  anelFoco: { position: 'absolute', borderWidth: 3, borderColor: cores.acao },
  etiquetaCaixa: { position: 'absolute', left: -60, right: -60, alignItems: 'center' },
  // .caminho-no__etiqueta: borda de 2 em volta e o degrau de 4 por fora (box-shadow 0 4px 0 gelo).
  etiqueta: { maxWidth: 210, alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 8, borderRadius: 14, borderWidth: 2,
    borderColor: cores.gelo, backgroundColor: cores.fundo, boxShadow: `0 4px 0 ${cores.gelo}` },
  etiquetaSeta: { position: 'absolute', bottom: -8, left: '50%', marginLeft: -6, width: 12, height: 12, borderRadius: 2,
    borderRightWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  // .caminho-no__etiqueta-acao: sem borda, com o degrau de 2 por fora (box-shadow 0 2px 0 #1d4ed8).
  etiquetaAcao: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, backgroundColor: cores.acao, boxShadow: `0 2px 0 ${cores.acaoEscura}` },
  etiquetaTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.9 },
  etiquetaTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 19, textAlign: 'center' },
  // Ligação, marco e chegada
  ligacao: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  marcoArea: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, zIndex: 3 },
  // No alto do vão, mas embaixo do nome da lição (até duas linhas), que agora aparece embaixo de cada nó.
  marcoNoAlto: { justifyContent: 'flex-start', paddingTop: 62 },
  // Divisor de parte: uma pílula pequena sobre a borda entre as regiões, como na web (antes era um card largo).
  // .caminho-parte: borda de 2 em volta e o degrau de 3 por fora (box-shadow 0 3px 0 rgb(27 42 94 / 0.1)).
  parte: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 4, paddingRight: 14,
    borderRadius: 999, borderWidth: 2, borderColor: cores.fundo, backgroundColor: cores.fundo, boxShadow: '0 3px 0 rgba(11, 27, 92, 0.1)' },
  parteSelo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.acao },
  parteSeloVencida: { backgroundColor: ouroFace },
  parteCorpo: {},
  parteTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  parteNumero: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  parteAndamento: { color: '#4A5568', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16 },
  // A1: o troféu fica 16 px mais longe do último nó, como na web (193 px de lente a lente em 390).
  chegada: { minHeight: 296, alignItems: 'center', justifyContent: 'flex-end', gap: 14, paddingTop: 8, paddingBottom: 30, overflow: 'hidden' },
  pontoEstrada: { position: 'absolute', left: '50%', marginLeft: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(11, 27, 92, 0.34)' },
  chegadaEstrada: { position: 'absolute', left: '50%', marginLeft: -12, width: 24,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: corEstrada },
  chegadaColina: { position: 'absolute', bottom: -48, left: '50%' },
  chegadaBandeira: { position: 'absolute', bottom: 96 },
  chegadaStu: { position: 'absolute', bottom: 74, left: '50%', marginLeft: 50 },
  // Na web, a placa fica a 14 da caixa do troféu, cujo lábio de 7 é sombra (fora da caixa); aqui o lábio está dentro: 7 a menos.
  chegadaPlaca: { marginTop: -7, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  chegadaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 20 },
  // Folha
  fundoFolha: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11, 27, 92, 0.32)' },
  folha: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 12, paddingTop: 10, paddingLeft: 20, paddingRight: 12,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo },
  folhaConcluida: { borderTopWidth: 6, borderColor: '#FFE08A' },
  folhaPuxador: { alignSelf: 'center', width: 40, height: 5, marginLeft: 8, borderRadius: 3, backgroundColor: cores.gelo },
  folhaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // O balão da lição concluída ou bloqueada (spec 01, c7059a8): o mesmo desenho do balão do nó atual, mais largo, com a seta.
  balaoNo: { position: 'absolute', zIndex: 30, gap: 10, paddingTop: 12, paddingBottom: 14, paddingLeft: 16, paddingRight: 8, borderRadius: 18,
    borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo, boxShadow: `0 4px 0 ${cores.gelo}` },
  balaoNoConcluido: { borderColor: '#FFE08A' },
  balaoNoSeta: { position: 'absolute', top: -8, width: 14, height: 14, borderRadius: 2, borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: cores.gelo, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  folhaIcone: { width: 36, height: 36, marginTop: 4, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.faceNeutra },
  folhaIconeConcluida: { backgroundColor: ouroFace },
  folhaTitulo: { flex: 1, paddingTop: 9 },
  folhaAcao: { paddingRight: 8, paddingTop: 4 },
  fechar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  fecharPressionado: { backgroundColor: cores.nevoa },
  // Esqueletos
  skeleton: { gap: 20 },
  skeletonCabecalho: { gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  skeletonLinha: { height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonCaminho: { gap: 38, paddingTop: 56, paddingBottom: 48 },
  skeletonNo: { backgroundColor: 'rgba(255, 255, 255, 0.75)' },
  skeletonNoSombra: { position: 'absolute', top: 8, backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  vindoLente: { borderWidth: 3, borderStyle: 'dashed', borderColor: '#C3CDEE', backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  // Geração (spec 04): o anel azul da lição que nasce (.no--novo) e o Stu que anda.
  anelNovo: { position: 'absolute', zIndex: 2, borderWidth: 4, borderColor: '#9FB1F0', boxShadow: '0 0 0 8px rgba(37, 99, 255, 0.12)' },
  stuQueAnda: { position: 'absolute', left: 0, top: 0, zIndex: 3 },
  vindoPlaca: { width: 144, gap: 8 },
  vindoPlacaDireita: { alignItems: 'flex-end' },
  vindoTitulo: { width: '80%', height: 14, borderRadius: 8, backgroundColor: cores.gelo },
  vindoEstado: { width: '45%', height: 10, borderRadius: 8, backgroundColor: cores.gelo },
});


function PonteNoMapa() {
  const entrada = useAparecer(0, 400);
  return <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'flex-end', height: 24, gap: 3, opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
    {[0, 5, 9, 5, 0].map((altura, i) => <View key={i} style={{ marginBottom: altura, width: 14, height: 8, borderRadius: 3, borderBottomWidth: 2, borderColor: cores.acaoEscura, backgroundColor: cores.acao }} />)}
  </Animated.View>;
}
