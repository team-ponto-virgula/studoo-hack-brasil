import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAparecer, useVaiVem } from './animacoes';
import { Confete } from './festa';
import { Icone } from './icone';
import { Botao, Pontinhos, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import { desenhosQueBalancam, enfeitesDaLinha, type NomeDesenho } from './mundo-desenhos';
import { Desenho, Fronteira, Onda, coresDaRegiao } from './mundo';
import { cores, fontes } from './tema';
import { explicar, iconeDoNo, nomeDoNo, posicaoDoNo, posicaoX, type EstadoNo, type NoCaminho } from './trilha';

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
const corPontilhado = 'rgba(27, 42, 94, 0.24)';

/** Mesmas medidas da web: celular, tablet e telas a partir de 1024 px. */
function useMedidas(): Medidas {
  const { width } = useWindowDimensions();
  if (width >= 1024) return { lente: 82, linhas: 56, etiqueta: 38, marco: 72, enfeite: 62, miudo: 28, guia: 70 };
  if (width >= 768) return { lente: 78, linhas: 52, etiqueta: 38, marco: 72, enfeite: 56, miudo: 28, guia: 64 };
  return { lente: 72, linhas: 46, etiqueta: 38, marco: 72, enfeite: 46, miudo: 24, guia: 56 };
}

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

/** Um trecho está vencido quando todas as suas lições estão concluídas: o marco que o fecha fica dourado. */
function trechoVencido(nos: readonly NoCaminho[], trecho: number) {
  return nos.every((no) => no.trecho !== trecho || no.estado === 'concluida');
}

/**
 * Caminho único e contínuo de lições, na ordem de aprendizado, sobre o mundo ilustrado.
 * Não agrupa por assunto: entre um trecho e outro aparece só o marco, sem nome, sobre a fronteira das regiões.
 * O leitor de tela ouve o marco como "Marco 1", "Marco 2"…, logo depois do último nó do trecho; o cenário fica de fora.
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
  rolarPara = null, recemConcluida = null, aoRolar, aoMedirAtual, acompanhar, aoAbrir }: {
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
  aoRolar?: (topo: number, base: number, sempre?: boolean, piso?: number) => void;
  /** Posição da lente do nó atual na rolagem (topo e base), para a tela esconder o cartão fixo enquanto ele está à vista. */
  aoMedirAtual?: (topo: number, base: number) => void;
  acompanhar?: (ultimo: Faixa, alvo: Faixa) => void;
  aoAbrir?: (no: NoCaminho) => void;
}) {
  const medidas = useMedidas();
  const reduzir = useMovimentoReduzido();
  const { width } = useWindowDimensions();
  const largo = width >= 768;
  const [aberto, setAberto] = useState<string | null>(null);
  // Largura do caminho (a serpentina usa pixels): começa pela tela e se ajusta quando a lista mede.
  const [largura, setLargura] = useState(() => (largo ? Math.min(width, 620) : width));
  // A entrada em sequência só acontece numa trilha que já abre pronta, não quando a geração termina.
  const [entrada] = useState(() => !montando);
  const [festaNaChegada, setFestaNaChegada] = useState(false);
  const ventoPar = useVaiVem(1800);
  const ventoImpar = useVaiVem(2300);
  const alvos = useRef(new Map<string, ComponentRef<typeof View>>());
  const posicoes = useRef<{ inicio: number | null; caminho: number | null; lista: number | null; linhas: Map<string, Caixa>; vindo: Caixa | null; chegada: Caixa | null }>(
    { inicio: null, caminho: null, lista: null, linhas: new Map(), vindo: null, chegada: null });
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
  const stuNaChegada = !montando && tudoFeito;
  const comRecem = recemConcluida !== null && nos.some((no) => no.id === recemConcluida);
  const comEntrada = entrada && !comRecem;
  const resumoTrechos = resumoDosTrechos(nos);

  useEffect(() => {
    if (!tituloLiberada) return;
    const espera = setTimeout(() => AccessibilityInfo.announceForAccessibility(mensagens.trilha.liberada(tituloLiberada)), 900);
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
    const atual = nos.find((no) => no.estado === 'atual');
    const medidaAtual = atual && posicoes.current.linhas.get(atual.id);
    if (aoMedirAtual && medidaAtual && posicoes.current.caminho !== null && posicoes.current.lista !== null) {
      const topoAtual = posicoes.current.caminho + posicoes.current.lista + medidaAtual.y;
      aoMedirAtual(topoAtual, topoAtual + medidas.lente);
    }
    if (!rolarPara || !aoRolar || rolado.current === rolarPara) return;
    const { caminho, lista, linhas } = posicoes.current;
    const linha = linhas.get(rolarPara);
    const { inicio } = posicoes.current;
    if (caminho === null || lista === null || linha === undefined || inicio === null) return;
    rolado.current = rolarPara;
    const topo = caminho + lista + linha.y;
    // Piso: rolando, a tela passa da placa do céu e para com a faixa da Parte 1 no topo, sem cortar a placa ao meio.
    aoRolar(topo, topo + medidas.lente, false, caminho + inicio - 62);
  }

  /**
   * Acompanha o fim do caminho depois que as medidas chegam: o nó novo e o esqueleto (ou a chegada) só têm posição
   * depois do layout, que vem depois do efeito. Quem chegar por último completa o pedido.
   */
  function tentarAcompanhar() {
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
    const topoLinha = caminho + lista + linha.y;
    const topoAlvo = modo === 'novo' ? caminho + lista + alvo.y : caminho + alvo.y;
    acompanhar({ topo: topoLinha, base: topoLinha + linha.altura }, { topo: topoAlvo, base: topoAlvo + alvo.altura });
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
      const topo = caminho + lista + linha.y;
      aoRolar(topo, topo + medidas.lente, true);
    }
    setTimeout(() => {
      const alvo = alvos.current.get(atual.id);
      if (alvo) AccessibilityInfo.sendAccessibilityEvent(alvo, 'focus');
    }, 350);
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
    <View style={[caminhoEstilos.caminho, largo ? caminhoEstilos.caminhoLargo : caminhoEstilos.caminhoTela]} onLayout={(evento) => {
      posicoes.current.caminho = evento.nativeEvent.layout.y;
      tentarRolar();
    }}>
      <Inicio texto={stu} trecho={primeiroTrecho} lente={medidas.lente} pensando={montando} placa={guiaNoCaminho || stuNaChegada} dicas={dicas}
        comecoAtual={nos[0]?.estado === 'atual'}
        aoMedir={(altura) => {
          posicoes.current.inicio = altura;
          tentarRolar();
        }}
        parte={total > 0 ? <Parte numero={1} resumo={resumoTrechos.get(primeiroTrecho)} /> : null} />
      <View accessibilityRole="list" accessibilityLabel={mensagens.trilha.licoes}
        onLayout={(evento) => {
          posicoes.current.lista = evento.nativeEvent.layout.y;
          const medida = Math.round(evento.nativeEvent.layout.width);
          if (medida > 0) setLargura((anterior) => anterior === medida ? anterior : medida);
          tentarRolar();
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
          // Título discreto embaixo dos nós sem rótulo ao lado: um pouco mais de espaço até o próximo.
          const discreto = no.estado === 'previa' || !!no.ponte;
          // O balão do nó atual traz o nome: precisa de mais espaço acima dele.
          if (seguinte?.estado === 'atual') depois += 40;
          if (discreto) depois += 14;
          // O título discreto não pode encostar no balão "Começar" do próximo, nem o do nó atual na faixa seguinte.
          if (discreto && seguinte?.estado === 'atual') depois += 38;
          if (no.estado === 'atual' && fimDoTrecho) depois += 16;
          if (no.estado !== 'atual' && discreto && fimDoTrecho) depois += 24;
          const espaco = seguinte || vaiAteChegada || vaiAteVindo ? medidas.linhas + depois : 32;
          const surgir = montando && no.estado === 'previa';
          const marcoVencido = fimDoTrecho && trechoVencido(nos, no.trecho);
          const recem = no.id === recemConcluida;
          const guia = guiaNoCaminho && no.estado === 'atual';
          const atrasoEntrada = surgir ? 0 : 100 + indice * 70;

          // O espaço até o próximo nó fica dentro da linha (padding), para o chão da região não ter falhas e o marco anunciado caber nela.
          return (
            <Linha key={no.id} espaco={espaco} chao={coresDaRegiao(no.trecho).chao}
              aoMedir={(caixa) => {
                posicoes.current.linhas.set(no.id, caixa);
                tentarRolar();
                tentarAcompanhar();
              }}>
              {indice === 0 && <View pointerEvents="none" style={[caminhoEstilos.estradaInicial, { backgroundColor: estradaSobre(coresDaRegiao(no.trecho).chao), left: (largura * x) / 100 - 12,
                top: no.estado === 'atual' ? -70 : -22, height: (no.estado === 'atual' ? 70 : 22) + medidas.lente / 2 }]} />}
              <Terreno x={x} largura={largura} semEnfeites={comRotulo} trecho={no.trecho} indice={indice} medidas={medidas} brotar={surgir || comEntrada}
                atraso={surgir ? 160 : atrasoEntrada + 160} guia={guia} atrasoGuia={comRecem ? 1350 : 300}
                vento={indice % 2 ? ventoImpar : ventoPar} />
              {fimDoTrecho && <Fronteira trechoSeguinte={seguinte.trecho} topo={medidas.lente} />}
              {(seguinte || vaiAteChegada || vaiAteVindo) && (
                <Ligacao de={x / 100} ate={xSeguinte / 100} feita={no.estado === 'concluida'} topo={medidas.lente / 2} chao={coresDaRegiao(no.trecho).chao}
                  desenhar={recem && no.estado === 'concluida'} />
              )}
              <Entra ativo={surgir || comEntrada} atraso={atrasoEntrada} reduzir={reduzir}>
                <No no={no} posicao={posicaoDoNo(indice, total, montando)} x={x} largura={largura} comRotulo={comRotulo} medidas={medidas} reduzir={reduzir}
                  ocupado={ocupado} abrindo={abrindo === no.id} liberada={liberadas.includes(no.id)} recem={recem}
                  atrasoLiberacao={comRecem ? 860 : 0} guardar={(alvo) => guardarAlvo(no.id, alvo)} tocar={() => tocar(no)} />
              </Entra>
              {fimDoTrecho && (
                <Marco numero={trechos.indexOf(no.trecho) + 1} vencido={marcoVencido} topo={medidas.lente + 28}>
                  <Parte numero={trechos.indexOf(no.trecho) + 2} resumo={resumoTrechos.get(seguinte.trecho)} />
                </Marco>
              )}
            </Linha>
          );
        })}
        {montando && (
          <Vindo x={posicaoX(total)} largura={largura} medidas={medidas} chao={coresDaRegiao(ultimoTrecho).chao}
            aoMedir={(caixa) => {
              posicoes.current.vindo = caixa;
              tentarAcompanhar();
            }} />
        )}
      </View>
      {comChegada && (
        <Chegada trecho={ultimoTrecho} lente={medidas.lente} feita={tudoFeito} total={montando ? 0 : total} extra={largo ? 0 : 130}
          faltam={nos.filter((no) => no.estado !== 'concluida').length} stu={stuNaChegada} festa={festaNaChegada || (comRecem && tudoFeito)}
          aoMedir={(caixa) => {
          posicoes.current.chegada = caixa;
          tentarAcompanhar();
        }} />
      )}
      {indiceAberto >= 0 && (
        <Folha titulo={nos[indiceAberto].titulo} texto={explicar(nos, indiceAberto)} reduzir={reduzir} estado={nos[indiceAberto].estado}
          refazer={nos[indiceAberto].estado === 'concluida' && aoAbrir ? () => {
            const no = nos[indiceAberto];
            fechar(false);
            aoAbrir(no);
          } : undefined}
          irParaAtual={nos[indiceAberto].estado === 'bloqueada' && nos.some((no) => no.estado === 'atual') ? irParaAtual : undefined}
          fechar={() => fechar()} />
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
function Inicio({ texto, trecho, lente, pensando, placa, dicas, parte, comecoAtual, aoMedir }: {
  aoMedir?: (altura: number) => void;
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
  const subida = useBalanco(4, 1400, pensando);
  const stu = Math.round(lente * 1.28);

  return (
    <View style={[caminhoEstilos.inicio, comecoAtual && { paddingBottom: 150 }]} onLayout={(evento) => aoMedir?.(evento.nativeEvent.layout.height)}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
        <View style={caminhoEstilos.inicioCeuBaixo} />
        <Desenho nome="sol" largura={44} estilo={{ position: 'absolute', top: 14, left: 18 }} />
        <Desenho nome="nuvem" largura={64} estilo={{ position: 'absolute', top: 18, left: '30%' }} />
        <Desenho nome="nuvem" largura={46} estilo={{ position: 'absolute', top: 58, left: '4%' }} />
        <View style={caminhoEstilos.inicioColinas}>
          <Onda chao={chao} relevo={relevo} estilo={{ top: 6 }} />
          <View style={[caminhoEstilos.inicioChao, { backgroundColor: chao }]} />
        </View>
      </View>
      {texto && placa && <Placa texto={texto} />}
      {texto && !placa && (
        <View style={caminhoEstilos.inicioConteudo}>
          <View style={caminhoEstilos.fala}>
            <View style={caminhoEstilos.falaLinha}>
              <Text style={caminhoEstilos.falaTexto}>{texto}</Text>
              {pensando && <Pontinhos cor={cores.acao} />}
            </View>
            {pensando && dicas.length > 0 && <DicaQueTroca dicas={dicas} />}
            <View style={caminhoEstilos.falaSeta} />
          </View>
          <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            importantForAccessibility="no"
            style={{ width: stu, height: Math.round(stu * 1.1), transform: [{ translateY: subida }] }} />
        </View>
      )}
      {parte && <View pointerEvents="none" style={[caminhoEstilos.inicioParte, comecoAtual && { bottom: 70 }]}>{parte}</View>}
    </View>
  );
}

/** Placa de madeira com a frase do Stu: entra balançando, presa em dois postes fincados nas colinas. */
function Placa({ texto }: { texto: string }) {
  const entrada = useAparecer(150, 520, true);
  return (
    <Animated.View style={[caminhoEstilos.placaMadeira, {
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
function Linha({ espaco, chao, aoMedir, children }: {
  espaco: number;
  chao: string;
  aoMedir: (caixa: Caixa) => void;
  children: ReactNode;
}) {
  return (
    <View style={{ paddingBottom: espaco, backgroundColor: chao }}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      {children}
    </View>
  );
}

/**
 * Nó que cai no lugar com uma mola curta, como a web: na montagem, assim que chega; ao abrir a trilha, em sequência
 * (`atraso`). Com movimento reduzido, já aparece pronto.
 */
function Entra({ ativo, atraso, reduzir, children }: { ativo: boolean; atraso: number; reduzir: boolean | null; children: ReactNode }) {
  const [entrada] = useState(() => ativo ? new Animated.Value(0) : null);

  useEffect(() => {
    if (!entrada || reduzir === null) return;
    if (reduzir) {
      entrada.setValue(1);
      return;
    }
    const animacao = Animated.timing(entrada, { toValue: 1, duration: 520, delay: atraso, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [entrada, atraso, reduzir]);

  if (!entrada) return <>{children}</>;
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
function Terreno({ x, largura, semEnfeites, trecho, indice, medidas, brotar, atraso, guia, atrasoGuia, vento }: {
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
  const { grande, miudo } = enfeitesDaLinha(trecho, indice);
  const reduzir = useMovimentoReduzido();
  const [crescer] = useState(() => brotar ? new Animated.Value(0) : null);
  const direita = x >= 50;
  const centro = (largura * x) / 100;
  const { lente, enfeite, miudo: tamMiudo, guia: tamGuia } = medidas;

  useEffect(() => {
    if (!crescer || reduzir === null) return;
    if (reduzir) {
      crescer.setValue(1);
      return;
    }
    const animacao = Animated.timing(crescer, { toValue: 1, duration: 440, delay: atraso, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [crescer, atraso, reduzir]);

  const ladoLivre = (distancia: number): ViewStyle => direita ? { left: distancia } : { right: distancia };
  const animacao = crescer ? { opacity: crescer, transform: [{ scale: crescer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] } : null;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      {guia && (
        <GuiaStu tamanho={tamGuia} atraso={atrasoGuia} estilo={[{ position: 'absolute', top: lente / 2 - tamGuia * 0.9 },
          direita ? { left: centro + lente / 2 + 10 } : { right: largura - centro + lente / 2 + 10 }]} />
      )}
      {!semEnfeites && (
        <>
          <Animated.View style={[{ position: 'absolute', top: 6 }, ladoLivre(largura * 0.06), animacao]}>
            <Balanca nome={grande} vento={vento}><Desenho nome={grande} largura={enfeite} /></Balanca>
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', top: lente + 4 }, ladoLivre(largura * 0.2), animacao]}>
            <Balanca nome={miudo} vento={vento}><Desenho nome={miudo} largura={tamMiudo} /></Balanca>
          </Animated.View>
        </>
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

/** O Stu ao lado do nó atual: entra com um pulinho, sobe e desce devagar e acena de vez em quando, com a sombra embaixo. */
function GuiaStu({ tamanho, atraso, estilo }: { tamanho: number; atraso: number; estilo: ViewStyle[] }) {
  const entrada = useAparecer(atraso, 460, true);
  const flutuar = useBalanco(6, 1300);
  const aceno = useVaiVem(2600);
  return (
    <Animated.View style={[...estilo, { width: tamanho, opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
      <Animated.View style={[caminhoEstilos.guiaSombra, { transform: [{ scaleX: flutuar.interpolate({ inputRange: [-6, 0], outputRange: [0.8, 1] }) }] }]} />
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        style={{ width: tamanho, height: Math.round(tamanho * 1.1), transformOrigin: 'bottom', transform: [
          { translateY: flutuar },
          { rotate: aceno.interpolate({ inputRange: [0, 0.8, 0.88, 0.94, 1], outputRange: ['0deg', '0deg', '-6deg', '5deg', '0deg'] }) },
        ] }} />
    </Animated.View>
  );
}

/** Onde a próxima lição vai aparecer: lente tracejada e placa em esqueleto, fora do leitor de tela (a contagem diz o mesmo). */
function Vindo({ x, largura, medidas, chao, aoMedir }: { x: number; largura: number; medidas: Medidas; chao: string; aoMedir: (caixa: Caixa) => void }) {
  const reduzir = useMovimentoReduzido();
  const [giro] = useState(() => new Animated.Value(0));
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
      style={{ height: lente + 32, backgroundColor: chao }}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      <Animated.View style={[circulo(lente), caminhoEstilos.vindoLente, { position: 'absolute', top: 0, left: centro - lente / 2,
        transform: [{ rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
      <View style={[caminhoEstilos.rotulo, { height: lente },
        direita ? { right: largura - centro + lente / 2 + 16, alignItems: 'flex-end' } : { left: centro + lente / 2 + 16, alignItems: 'flex-start' }]}>
        <View style={[caminhoEstilos.placa, caminhoEstilos.vindoPlaca, direita && caminhoEstilos.vindoPlacaDireita]}>
          <View style={caminhoEstilos.vindoTitulo} />
          <View style={caminhoEstilos.vindoEstado} />
        </View>
      </View>
    </View>
  );
}

function No({ no, posicao, x, largura, comRotulo, medidas, reduzir, ocupado, abrindo, liberada, recem, atrasoLiberacao, guardar, tocar }: {
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
  const nome = nomeDoNo(no, posicao);
  let linha: string = no.estado === 'previa' ? posicao : mensagens.trilha.estados[no.estado];
  if (abrindo) linha = mensagens.trilha.abrindo;
  const { lente } = medidas;
  const centro = (largura * x) / 100;
  const direita = x >= 50;
  const atual = no.estado === 'atual';
  const rotuloA11y = no.ponte ? `${nome}. ${no.ponte.concluida ? mensagens.estudio.pontePronta : mensagens.estudio.ponteMapa}` : nome;
  const lugar = [caminhoEstilos.noLugar, { left: centro - lente / 2, width: lente, height: lente }];

  const rotulo = comRotulo && (
    <View pointerEvents="none" style={[caminhoEstilos.rotulo, { height: lente }, direita
      ? { right: largura - centro + lente / 2 + 16, alignItems: 'flex-end', maxWidth: Math.max(96, centro - lente / 2 - 28) }
      : { left: centro + lente / 2 + 16, alignItems: 'flex-start', maxWidth: Math.max(96, largura - centro - lente / 2 - 28) }]}>
      <View style={[caminhoEstilos.placa, atual && caminhoEstilos.placaAtual]}>
        {atual && <Text style={[caminhoEstilos.posicao, direita && caminhoEstilos.alinharFim]}>{posicao.toLocaleUpperCase('pt-BR')}</Text>}
        <Text style={[caminhoEstilos.titulo, atual && caminhoEstilos.tituloAtual, no.estado === 'previa' && caminhoEstilos.tituloPrevia,
          direita && caminhoEstilos.alinharFim, focado && caminhoEstilos.tituloFocado]}>{no.titulo}</Text>
        {!atual && <Text style={[caminhoEstilos.estado, { color: corDoEstado[no.estado] }, direita && caminhoEstilos.alinharFim]}>{linha}</Text>}
        {no.ponte && <><PonteNoMapa /><Text style={[caminhoEstilos.estado, { color: cores.acao }]}>{no.ponte.concluida ? mensagens.estudio.pontePronta : mensagens.estudio.ponteMapa}</Text></>}
      </View>
    </View>
  );
  // Como na web: o nome fica só no nó atual (e na prévia da geração); os outros mostram o nome ao toque.
  const discreto = !comRotulo && (no.estado === 'previa' || !!no.ponte) && (
    <View pointerEvents="none" style={[caminhoEstilos.discreto, { top: lente + (atual ? 20 : 12), left: Math.max(8, Math.min(largura - 192, centro - 92)) }]}>
      {/* O fundo fica na caixa, não no texto: assim o corte em duas linhas não deixa vazar a terceira. */}
      <View style={[caminhoEstilos.discretoCaixa, atual && caminhoEstilos.discretoCaixaAtual]}>
        <Text numberOfLines={2} style={[caminhoEstilos.discretoTexto, no.estado === 'concluida' && { color: cores.alerta },
          atual && caminhoEstilos.discretoAtual]}>{no.titulo}</Text>
      </View>
    </View>
  );
  const moeda = (pressionado: boolean) => (
    <View style={atual ? { transform: [{ scale: 1.14 }] } : null}>
      <Lente no={no} medidas={medidas} reduzir={reduzir} liberada={liberada} recem={recem} atrasoLiberacao={atrasoLiberacao}
        pressionado={pressionado} focado={focado} puxa={(50 - x) * 1.5} />
    </View>
  );

  if (no.estado === 'previa') {
    return (
      <View accessible accessibilityLabel={rotuloA11y} style={{ height: lente }}>
        <View style={lugar}>{moeda(false)}</View>
        {rotulo}
      </View>
    );
  }

  return (
    <View style={{ height: lente }}>
      <Pressable ref={guardar} accessibilityRole="button" accessibilityLabel={rotuloA11y}
        accessibilityState={{ disabled: ocupado, busy: abrindo }} disabled={ocupado} onPress={tocar} hitSlop={8}
        onFocus={() => setFocado(true)} onBlur={() => setFocado(false)} style={lugar}>
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
function Lente({ no, medidas, reduzir, liberada, recem, atrasoLiberacao, pressionado, focado, puxa = 0 }: {
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
  // Lições à frente: moeda branca com o lábio no tom da região, bem visível sobre o chão claro (como na web).
  const visual = no.estado === 'bloqueada'
    ? { face: misturar(coresDaRegiao(no.trecho).chao, '#1B2A5E', 0.09), labio: misturar(coresDaRegiao(no.trecho).relevo, '#1B2A5E', 0.26), icone: '#6F7898' }
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

  const tamanhoIcone = Math.round(lente * 0.44);
  const anel = atual ? 18 : 8;
  const afundar = pressionado ? 4 : 0;

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
      <View style={[caminhoEstilos.camada, circulo(lente), { top: 8, backgroundColor: visual.labio }]} />
      <Animated.View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(lente), {
        top: afundar, backgroundColor: visual.face, transform: [{ scale: escala }],
      }]}>
        <View><Icone nome={iconeDoNo(no)} tamanho={tamanhoIcone} cor={visual.icone} /></View>
        {liberada && (
          <Animated.View style={[caminhoEstilos.cadeado, { borderRadius: lente / 2, opacity: cadeado }]}>
            <Icone nome="cadeado" tamanho={tamanhoIcone} cor={cores.tintaNeutra} />
          </Animated.View>
        )}
        {recem && <Confete quantidade={12} />}
      </Animated.View>
      {no.estado === 'concluida' && <Text style={caminhoEstilos.brilho}>✦</Text>}
      {no.estado === 'bloqueada' && (
        <View style={caminhoEstilos.seloCadeado} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icone nome="cadeado" tamanho={14} cor={cores.fundo} />
        </View>
      )}
      {focado && <View style={[caminhoEstilos.anelFoco, circulo(lente + anel * 2), { left: -anel, top: -anel }]} />}
      {atual && (
        <Animated.View style={[caminhoEstilos.etiquetaCaixa, { bottom: lente + 22, left: -110 + puxa, right: -110 - puxa }, {
          opacity: etiqueta,
          transform: [{ translateY: etiqueta.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }, { translateY: flutuar }],
        }]}>
          {/* Um balão só no nó atual: a ação e o nome da lição juntos, como na web. */}
          <View style={caminhoEstilos.etiqueta}>
            <View style={[caminhoEstilos.etiquetaSeta, { marginLeft: -6 - puxa }]} />
            <View style={caminhoEstilos.etiquetaAcao}><Text style={caminhoEstilos.etiquetaTexto}>{mensagens.trilha.comecar.toLocaleUpperCase('pt-BR')}</Text></View>
            <Text numberOfLines={2} style={caminhoEstilos.etiquetaTitulo}>{no.titulo}</Text>
          </View>
        </Animated.View>
      )}
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
function Ligacao({ de, ate, feita, topo, chao, desenhar = false }: {
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
    if (!caixa) return { base: [], verde: [] };
    const estrada = tracoGrosso(tracado(caixa.largura, caixa.altura, de, ate, 12), 24, feita && !desenhar ? corEstradaFeita : estradaSobre(chao));
    const pontos = pontilhar(tracado(caixa.largura, caixa.altura, de, ate, 48), 13).map((ponto): ViewStyle => ({
      left: ponto.x - 2.5, top: ponto.y - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: corPontilhado,
    }));
    const verde = feita ? tracoGrosso(tracado(caixa.largura, caixa.altura, de, ate, 12), 6, ouroLabio) : [];
    // Enquanto a linha verde se desenha, o pontilhado aparece embaixo dela.
    return { base: feita && !desenhar ? estrada : [...estrada, ...pontos], verde };
  }, [caixa, feita, desenhar, de, ate, chao]);
  const pedacos = desenho.verde.length;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[caminhoEstilos.ligacao, { top: topo }]}
      onLayout={(evento) => {
        const { width, height } = evento.nativeEvent.layout;
        setCaixa((anterior) => anterior?.largura === width && anterior.altura === height ? anterior : { largura: width, altura: height });
      }}>
      {desenho.base.map((estilo, indice) => <View key={`b${indice}`} style={[caminhoEstilos.camada, estilo]} />)}
      {desenho.verde.map((estilo, indice) => (
        <Animated.View key={`v${indice}`} style={[caminhoEstilos.camada, estilo, desenhar && {
          opacity: traco.interpolate({ inputRange: [indice / pedacos, (indice + 1) / pedacos], outputRange: [0, 1], extrapolate: 'clamp' }),
        }]} />
      ))}
    </View>
  );
}

/**
 * Marco entre um trecho e outro: o sinal com relevo sobre a fronteira das regiões, sem nome de assunto; dourado quando
 * o trecho foi vencido. Vem depois do nó na árvore, então o leitor de tela lê "Marco 1", "Marco 2"… logo depois do
 * último nó do trecho.
 */
function Marco({ numero, vencido, topo, children }: { numero: number; vencido: boolean; topo: number; children: ReactNode }) {
  return (
    <View pointerEvents="box-none" style={[caminhoEstilos.ligacao, caminhoEstilos.marcoArea, { top: topo }]}>
      <View accessible accessibilityRole="text" accessibilityLabel={vencido ? mensagens.trilha.marcoVencido(numero) : mensagens.trilha.marco(numero)}>
        {children}
      </View>
    </View>
  );
}

/** Faixa que abre cada parte da trilha: número, andamento e barra; dourada quando vencida. Sem nome de assunto. */
function Parte({ numero, resumo }: { numero: number; resumo?: ResumoTrecho }) {
  if (!resumo) return null;
  const vencida = !resumo.previa && resumo.feitas === resumo.total;
  let texto = mensagens.trilha.parteProgresso(resumo.feitas, resumo.total);
  if (resumo.previa) texto = mensagens.trilha.parteLicoes(resumo.total);
  else if (vencida) texto = mensagens.trilha.parteVencida;
  return (
    <View style={caminhoEstilos.parte} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[caminhoEstilos.parteSelo, vencida && caminhoEstilos.parteSeloVencida]}>
        <Icone nome={vencida ? 'trofeu' : 'bandeira'} tamanho={16} cor={vencida ? cores.ouroTexto : cores.fundo} />
      </View>
      <View style={caminhoEstilos.parteCorpo}>
        <View style={caminhoEstilos.parteTopo}>
          <Text style={caminhoEstilos.parteNumero}>{mensagens.trilha.parte(numero)}</Text>
          <Text style={[caminhoEstilos.parteAndamento, vencida && { color: cores.alerta }]}>{texto}</Text>
        </View>
      </View>
    </View>
  );
}

/** Chegada: o topo do caminho, com o troféu numa colina e bandeiras; fica dourada quando todas as lições estão concluídas. */
function Chegada({ trecho, lente, feita, stu, festa, total, faltam, aoMedir, extra = 0 }: {
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
  const tamanho = lente + 16;
  const reduzir = useMovimentoReduzido();
  const [pop] = useState(() => new Animated.Value(festa ? 0.5 : 1));
  const pulo = useVaiVem(380, stu);
  const [bolha, setBolha] = useState<string | null>(null);
  const [toques, setToques] = useState(0);
  useEffect(() => {
    if (!bolha) return;
    const espera = setTimeout(() => setBolha(null), 3000);
    return () => clearTimeout(espera);
  }, [bolha]);

  useEffect(() => {
    if (!festa || reduzir === null) return;
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
    <View style={[caminhoEstilos.chegada, { backgroundColor: chao, minHeight: 280 + extra, paddingBottom: 30 + extra }]}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
        <View style={[caminhoEstilos.chegadaEstrada, { backgroundColor: estradaSobre(chao) }]} />
        {/* O mesmo pontilhado da estrada, sem emenda até o troféu. */}
        {!feita && Array.from({ length: 9 }, (_, indice) => <View key={indice} style={[caminhoEstilos.pontoEstrada, { top: 7 + indice * 14 }]} />)}
        <View style={[caminhoEstilos.chegadaColina, { backgroundColor: relevo, bottom: -48 + extra }]} />
        {extra > 0 && <View style={[caminhoEstilos.chegadaBase, { height: extra, backgroundColor: relevo }]} />}
        <Desenho nome="bandeira" largura={30} estilo={[caminhoEstilos.chegadaBandeira, { bottom: 96 + extra, left: '50%', marginLeft: -104 }]} />
        <Desenho nome="bandeira" largura={30} estilo={[caminhoEstilos.chegadaBandeira, { bottom: 96 + extra, right: '50%', marginRight: -104, transform: [{ scaleX: -1 }] }]} />
        {/* Estrelas também antes da conquista: o troféu já parece um prêmio desejável. */}
        {(
          <>
            <Desenho nome="estrela" largura={22} estilo={{ position: 'absolute', bottom: 150 + extra, left: '50%', marginLeft: -72 }} />
            <Desenho nome="estrela" largura={16} estilo={{ position: 'absolute', bottom: 172 + extra, right: '50%', marginRight: -66 }} />
            <Desenho nome="estrela" largura={14} estilo={{ position: 'absolute', bottom: 118 + extra, right: '50%', marginRight: -98 }} />
          </>
        )}
      </View>
      {stu && (
        <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
          importantForAccessibility="no" style={[caminhoEstilos.chegadaStu, { bottom: 74 + extra,
            transform: [
              { translateY: pulo.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
              { rotate: pulo.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] }) },
            ],
          }]} />
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
        {/* Halo dourado em volta do troféu. */}
        <View style={[caminhoEstilos.camada, circulo(tamanho + 28), { left: -14, top: -14, backgroundColor: 'rgba(255, 214, 102, 0.3)' }]} />
        <View style={[caminhoEstilos.camada, circulo(tamanho), { top: 8, backgroundColor: feita ? ouroLabio : '#EBCB72' }]} />
        <View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(tamanho), feita ? { backgroundColor: ouroFace }
          : { backgroundColor: cores.fundo, borderWidth: 5, borderColor: '#FFE9A8' }]}>
          <Icone nome="trofeu" tamanho={Math.round(tamanho * 0.46)} cor={feita ? cores.ouroTexto : '#C98A0E'} />
        </View>
        {festa && <Confete quantidade={18} />}
        {bolha && feita && <Confete key={bolha + toques} quantidade={14} />}
      </Animated.View>
      </Pressable>
      <View style={caminhoEstilos.chegadaPlaca}>
        <Text style={[caminhoEstilos.chegadaTexto, feita && { color: cores.alerta }]}>
          {feita ? mensagens.trilha.chegadaFeita : mensagens.trilha.chegada}
        </Text>
      </View>
      {!feita && total > 0 && <Text style={caminhoEstilos.chegadaMeta}>{mensagens.trilha.chegadaMeta(total)}</Text>}
    </View>
  );
}

/** Explicação do nó concluído ou bloqueado, numa folha que sobe do rodapé, com área segura. */
function Folha({ titulo, texto, reduzir, estado, refazer, irParaAtual, fechar }: {
  /** Nó bloqueado: leva até a lição atual. */
  irParaAtual?: () => void;
  titulo: string;
  texto: string;
  reduzir: boolean | null;
  estado: EstadoNo;
  refazer?: () => void;
  fechar: () => void;
}) {
  const margens = useSafeAreaInsets();
  const cabecalho = useRef<ComponentRef<typeof Text>>(null);
  const [focado, setFocado] = useState(false);
  const subida = useAparecer(0, 320, true);
  const concluida = estado === 'concluida';

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType={reduzir === false ? 'fade' : 'none'}
      onRequestClose={fechar} onShow={() => {
        if (cabecalho.current) AccessibilityInfo.sendAccessibilityEvent(cabecalho.current, 'focus');
      }}>
      <View style={caminhoEstilos.fundoFolha}>
        <Pressable accessible={false} importantForAccessibility="no" onPress={fechar} style={StyleSheet.absoluteFill} />
        <Animated.View accessibilityViewIsModal style={[caminhoEstilos.folha, concluida && caminhoEstilos.folhaConcluida, {
          paddingBottom: 20 + margens.bottom,
          transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
        }]}>
          <View style={caminhoEstilos.folhaPuxador} />
          <View style={caminhoEstilos.folhaTopo}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
              style={[caminhoEstilos.folhaIcone, concluida && caminhoEstilos.folhaIconeConcluida]}>
              <Icone nome={concluida ? 'check' : 'cadeado'} tamanho={20} cor={concluida ? cores.fundo : cores.tintaNeutra} />
            </View>
            <Text ref={cabecalho} accessible accessibilityRole="header"
              style={[estilos.tituloBloco, caminhoEstilos.folhaTitulo, concluida && { color: cores.sucesso }]}>{titulo}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={mensagens.trilha.fechar} onPress={fechar}
              onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
              style={({ pressed }) => [caminhoEstilos.fechar, pressed && caminhoEstilos.fecharPressionado, focado && estilos.foco]}>
              <Icone nome="fechar" tamanho={20} cor={cores.textoSecundario} />
            </Pressable>
          </View>
          <Text style={estilos.textoSecundario}>{texto}</Text>
          {refazer && <View style={caminhoEstilos.folhaAcao}><Botao rotulo={mensagens.trilha.refazer} variante="secundario" acao={refazer} /></View>}
          {irParaAtual && <View style={caminhoEstilos.folhaAcao}><Botao rotulo={mensagens.trilha.irParaAtual} icone="seta" variante="secundario" acao={irParaAtual} /></View>}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Carregando a trilha: esqueleto com a forma da faixa do topo e do mapa, nas cores dos campos. */
export function SkeletonTrilha() {
  const { lente, linhas } = useMedidas();
  const { width } = useWindowDimensions();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={mensagens.trilha.carregando} accessibilityLiveRegion="polite"
      style={caminhoEstilos.skeleton}>
      <View style={caminhoEstilos.skeletonCabecalho}>
        <View style={[caminhoEstilos.skeletonLinha, { width: '40%', height: 12 }]} />
        <View style={[caminhoEstilos.skeletonLinha, { width: '64%', height: 28 }]} />
      </View>
      <View style={[{ gap: linhas, paddingVertical: 56, backgroundColor: coresDaRegiao(0).chao },
        width >= 768 ? caminhoEstilos.caminhoLargo : caminhoEstilos.caminhoTela]}>
        {[0, 1, 2, 3].map((indice) => (
          <View key={indice} style={[circulo(lente), caminhoEstilos.skeletonNo,
            { marginLeft: `${posicaoX(indice)}%` as DimensionValue, transform: [{ translateX: -lente / 2 }] }]} />
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
  inicioCeuBaixo: { position: 'absolute', left: 0, right: 0, top: '55%', bottom: 0, backgroundColor: '#EAF1FF' },
  inicioColinas: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 76 },
  inicioChao: { position: 'absolute', left: 0, right: 0, top: 52, bottom: 0 },
  inicioConteudo: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, flexShrink: 1 },
  fala: { flexShrink: 1, maxWidth: 272, marginBottom: 30, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18,
    backgroundColor: cores.fundo, borderBottomWidth: 3, borderBottomColor: 'rgba(27, 42, 94, 0.08)' },
  falaTexto: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  falaLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 },
  dica: { marginTop: 6, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  placaMadeira: { maxWidth: 272, marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 3,
    borderBottomWidth: 7, borderColor: '#C79A62', borderBottomColor: '#B0844D', backgroundColor: '#F7E3C2' },
  poste: { position: 'absolute', bottom: -30, width: 8, height: 22, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#A87650' },
  placaTexto: { color: '#5B3A17', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  guiaSombra: { position: 'absolute', left: '18%', right: '18%', bottom: -2, height: 8, borderRadius: 999, backgroundColor: 'rgba(27, 42, 94, 0.14)' },
  falaSeta: { position: 'absolute', right: -6, bottom: 18, width: 16, height: 16, borderRadius: 3, backgroundColor: cores.fundo,
    transform: [{ rotate: '45deg' }] },
  // Nó e rótulo
  noLugar: { position: 'absolute', top: 0 },
  rotulo: { position: 'absolute', top: 0, justifyContent: 'center', zIndex: 2 },
  placa: { maxWidth: '100%', gap: 2, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.94)', borderBottomWidth: 3, borderBottomColor: 'rgba(27, 42, 94, 0.08)' },
  placaAtual: { borderWidth: 2, borderBottomWidth: 4, borderColor: 'rgba(68, 102, 228, 0.28)', borderBottomColor: 'rgba(68, 102, 228, 0.28)' },
  posicao: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 21 },
  tituloAtual: { fontSize: 17, lineHeight: 22 },
  tituloPrevia: { fontSize: 15, lineHeight: 20 },
  discreto: { position: 'absolute', width: 184, alignItems: 'center', zIndex: 2 },
  discretoAtual: { color: cores.acao, fontWeight: '800', fontSize: 14 },
  discretoCaixa: { maxWidth: 184, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: cores.fundo,
    shadowColor: '#1B2A5E', shadowOpacity: 0.06, shadowRadius: 0, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  discretoCaixaAtual: { borderWidth: 2, borderColor: 'rgba(68, 102, 228, 0.28)' },
  seloCadeado: { position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: cores.fundo,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#98A1BD' },
  discretoTexto: {
    color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 17, textAlign: 'center' },
  bolhaTrofeu: { position: 'absolute', bottom: '100%', left: -80, right: -80, marginBottom: 12, alignItems: 'center', zIndex: 3 },
  bolhaTrofeuTexto: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: '#FFE08A',
    overflow: 'hidden', backgroundColor: '#FFF8E1', color: cores.ouroTexto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  chegadaMeta: { marginTop: -6, paddingHorizontal: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  estradaInicial: { position: 'absolute', top: -22, width: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: corEstrada },
  brilho: { position: 'absolute', top: -6, right: -2, color: '#FFB703', fontSize: 18, lineHeight: 20 },
  tituloFocado: { textDecorationLine: 'underline' },
  estado: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  alinharFim: { textAlign: 'right' },
  camada: { position: 'absolute', left: 0, top: 0 },
  face: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.2)' },
  halo: { position: 'absolute', left: -12, top: -12, borderWidth: 6, borderColor: 'rgba(68, 102, 228, 0.22)' },
  cadeado: { position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.faceNeutra },
  anelFoco: { position: 'absolute', borderWidth: 3, borderColor: cores.acao },
  etiquetaCaixa: { position: 'absolute', left: -60, right: -60, alignItems: 'center' },
  etiqueta: { maxWidth: 210, alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 9, paddingBottom: 8, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4,
    borderColor: cores.gelo, backgroundColor: cores.fundo },
  etiquetaSeta: { position: 'absolute', bottom: -8, left: '50%', marginLeft: -6, width: 12, height: 12, borderRadius: 2,
    borderRightWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  etiquetaAcao: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, borderBottomWidth: 2, borderColor: cores.acaoEscura, backgroundColor: cores.acao },
  etiquetaTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.9 },
  etiquetaTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 19, textAlign: 'center' },
  // Ligação, marco e chegada
  ligacao: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  marcoArea: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, zIndex: 3 },
  // Divisor de parte: uma pílula pequena sobre a borda entre as regiões, como na web (antes era um card largo).
  parte: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 4, paddingRight: 14,
    borderRadius: 999, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.fundo, borderBottomColor: 'rgba(27, 42, 94, 0.1)',
    backgroundColor: cores.fundo },
  parteSelo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.acao },
  parteSeloVencida: { backgroundColor: ouroFace },
  parteCorpo: {},
  parteTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  parteNumero: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  parteAndamento: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16 },
  chegada: { minHeight: 280, alignItems: 'center', justifyContent: 'flex-end', gap: 14, paddingTop: 36, paddingBottom: 30, overflow: 'hidden' },
  pontoEstrada: { position: 'absolute', left: '50%', marginLeft: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(27, 42, 94, 0.22)' },
  chegadaEstrada: { position: 'absolute', top: 0, left: '50%', marginLeft: -12, width: 24, height: 132,
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: corEstrada },
  chegadaColina: { position: 'absolute', bottom: -48, left: '50%', marginLeft: -200, width: 400, height: 190,
    borderTopLeftRadius: 200, borderTopRightRadius: 200 },
  chegadaBandeira: { position: 'absolute', bottom: 96 },
  chegadaBase: { position: 'absolute', bottom: 0, left: '50%', marginLeft: -200, width: 400 },
  chegadaStu: { position: 'absolute', bottom: 74, left: '50%', marginLeft: 50, width: 62, height: 68 },
  chegadaPlaca: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  chegadaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  // Folha
  fundoFolha: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(27, 42, 94, 0.32)' },
  folha: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 12, paddingTop: 10, paddingLeft: 20, paddingRight: 12,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo },
  folhaConcluida: { borderTopWidth: 6, borderColor: '#FFE08A' },
  folhaPuxador: { alignSelf: 'center', width: 40, height: 5, marginLeft: 8, borderRadius: 3, backgroundColor: cores.gelo },
  folhaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  folhaIcone: { width: 36, height: 36, marginTop: 4, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.faceNeutra },
  folhaIconeConcluida: { backgroundColor: ouroFace },
  folhaTitulo: { flex: 1, paddingTop: 9 },
  folhaAcao: { paddingRight: 8, paddingTop: 4 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  fecharPressionado: { backgroundColor: cores.nevoa },
  // Esqueletos
  skeleton: { marginTop: 24, gap: 28 },
  skeletonCabecalho: { gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  skeletonLinha: { height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonNo: { backgroundColor: 'rgba(255, 255, 255, 0.75)' },
  vindoLente: { borderWidth: 3, borderStyle: 'dashed', borderColor: '#C3CDEE', backgroundColor: 'rgba(255, 255, 255, 0.7)' },
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
