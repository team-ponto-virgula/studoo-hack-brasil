import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePulinho } from './animacoes';
import { tracoGrosso } from './caminho';
import { CadernoDoStu, CenaPonte } from './estudio-cenas';
import { Icone } from './icone';
import { Botao, SeloSincronia, estilos, useMovimentoReduzido, degrauFora, quebraEquilibrada, caixaAlta } from './interface';
import { mensagens } from './mensagens';
import { Desenho, coresDaRegiao } from './mundo';
import { Stu, medidasDoStu } from './mascote';
import { iconesDosTemas, type IdTema } from './temas';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';
import { focoVisivel } from './foco';
import { ouvirVoltar, travarGesto } from './voltar';

/*
 * Apresentação do Studoo no app, com os mesmos cinco passos da web (src/app/apresentacao.tsx): desde a rodada 4.5, os quatro
 * momentos do pitch (o material vira lição, o erro abre outro caminho, explique com suas palavras e o progresso salvo no
 * mapa) e a área de interesse. No celular, os passos são páginas que a pessoa também pode deslizar para o lado.
 */

/** Áreas para escolher no último passo: as do pedido, menos Populares. */
const areasDaApresentacao = mensagens.pedido.temas.filter((tema) => tema.id !== 'populares');

/**
 * Passos da apresentação, em páginas, como os cinco da web; o último é a escolha da área que interessa, que já abre o
 * pedido com as ideias dela. Na primeira vez termina em "Criar minha primeira trilha"; reaberta pelo pedido, termina em
 * "Entendi". Pular encerra a qualquer momento. O título de cada passo recebe o foco e diz a posição; as páginas fora da
 * vista ficam fora do leitor de tela. As ilustrações são decorativas e paradas, montadas com as peças do próprio app.
 */
/**
 * A arte de cada passo ocupa 52% da altura útil (a das páginas, entre o alto e o rodapé), com 280 no mínimo e 420 no
 * máximo; o título e o texto ficam centrados no que sobra até o rodapé (spec 04, banca da noite §2).
 */
export function alturaDaArte(alturaUtil: number): number {
  return Math.round(Math.min(420, Math.max(280, alturaUtil * 0.52)));
}

export function Apresentacao({ primeiraVez, semSessao = false, rotuloFinalUltimo, entrar, concluir }: {
  primeiraVez: boolean;
  /**
   * Aberta pelo "Ver como funciona" da entrada, sem sessão (rodada 4.4 da web): só os quatro primeiros passos, sem a escolha
   * da área. O voltar do aparelho e o Esc (na prévia web) fecham, como o "Pular".
   */
  semSessao?: boolean;
  /** Rótulo do último passo no lugar de "Entendi" (na entrada, "Experimentar sem conta" quando o visitante está ligado). */
  rotuloFinalUltimo?: string;
  /**
   * Aberta pela entrada (banca da noite §2): o último passo oferece "Entrar". Com o visitante ligado (`rotuloFinalUltimo`),
   * as ações ficam empilhadas, "Experimentar sem conta" (principal) em cima e "Entrar" (secundário) embaixo; sem ele, só
   * "Entrar", como principal.
   */
  entrar?: () => void;
  /** `concluiuFinal`: a pessoa tocou o botão do último passo (e não "Pular", voltar ou Esc). */
  concluir: (area?: IdTema, concluiuFinal?: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  const reduzir = useMovimentoReduzido();
  const [passo, setPasso] = useState(0);
  const [area, setArea] = useState<IdTema | undefined>();
  const paginas = useRef<ComponentRef<typeof ScrollView>>(null);
  const titulos = useRef<(ComponentRef<typeof Text> | null)[]>([]);
  const primeira = useRef(true);
  const passos = semSessao ? mensagens.apresentacao.passos.slice(0, 4) : mensagens.apresentacao.passos;
  const total = passos.length;
  const ultimo = passo === total - 1;
  const largura = Math.min(width, 620) - 40;
  // A altura útil é medida nas páginas; o rodapé do último passo (duas ações empilhadas) não encolhe a arte dos outros.
  const [alturaUtil, setAlturaUtil] = useState(0);
  const alturaArte = alturaDaArte(alturaUtil);
  const [alturaAtual, setAlturaAtual] = useState(0);
  const [alturaDosTextos, setAlturaDosTextos] = useState<Record<number, number>>({});

  useEffect(() => {
    const titulo = titulos.current[passo];
    if (!titulo) return;
    // Na abertura, o foco vai ao primeiro título como em qualquer tela; depois, a cada passo.
    // Na prévia web, o focus() do navegador rolava o passo até o título (4 px no último passo); a web foca sem rolar.
    const focar = () => {
      if (Platform.OS === 'web') {
        const no = titulo as unknown as HTMLElement;
        if (!no.hasAttribute('tabindex')) no.setAttribute('tabindex', '-1');
        no.focus({ preventScroll: true });
      } else AccessibilityInfo.sendAccessibilityEvent(titulo, 'focus');
    };
    const espera = setTimeout(focar, primeira.current ? 0 : 150);
    primeira.current = false;
    return () => clearTimeout(espera);
  }, [passo]);

  function irPara(indice: number) {
    setPasso(indice);
    paginas.current?.scrollTo({ x: indice * width, animated: reduzir === false });
  }

  // Sem sessão, o voltar do aparelho fecha a apresentação e volta à entrada (em vez de fechar o app).
  useEffect(() => {
    if (!semSessao) return;
    const assinatura = ouvirVoltar(() => { concluir(); return true; });
    return () => assinatura.remove();
  }, [semSessao, concluir]);
  // No iPhone, o arrasto na horizontal é do carrossel: o gesto de voltar da borda fica desligado nesta tela (voltar.ts).
  useEffect(() => travarGesto(), []);
  // Na prévia web, o teclado também anda e fecha, como a apresentação da web: setas e Esc.
  const passoAtual = useRef(passo);
  passoAtual.current = passo;
  useEffect(() => {
    if (!semSessao || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const teclas = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') { evento.preventDefault(); concluir(); return; }
      if (evento.key === 'ArrowRight' && passoAtual.current < total - 1) { evento.preventDefault(); irPara(passoAtual.current + 1); }
      if (evento.key === 'ArrowLeft' && passoAtual.current > 0) { evento.preventDefault(); irPara(passoAtual.current - 1); }
    };
    document.addEventListener('keydown', teclas);
    return () => document.removeEventListener('keydown', teclas);
    // irPara lê a largura do momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semSessao, concluir, total]);

  let rotuloFinal: string = mensagens.apresentacao.continuar;
  if (ultimo) rotuloFinal = rotuloFinalUltimo ?? (primeiraVez ? mensagens.apresentacao.comecar : mensagens.apresentacao.entendi);
  // Banca da noite §2: no último passo, "Voltar" sobe para o alto, à esquerda, como botão de texto (no lugar do "Pular"), e o
  // rodapé fica só com as ações finais. Aberta pela entrada, "Entrar" entra no fim: embaixo de "Experimentar sem conta"
  // (empilhadas, o rótulo não cabe na metade, spec 11) ou sozinho, como principal, sem o visitante.
  const comEntrar = ultimo && semSessao && entrar !== undefined;
  const empilhar = comEntrar && rotuloFinalUltimo !== undefined;
  const alturaMedida = useRef(false);
  // Com as duas ações empilhadas, as páginas encolhem 64: numa janela baixa (390×667), a arte do último passo cede o que
  // falta para o título e o texto caberem sem rolar, até 200 (os respiros da página somam 64: 20 em cima, 20 entre a arte e
  // o título e 24 embaixo).
  const arteDoPasso = (indice: number) => {
    const textos = alturaDosTextos[indice];
    if (!empilhar || indice !== total - 1 || !alturaAtual || !textos) return alturaArte;
    return Math.max(200, Math.min(alturaArte, Math.floor(alturaAtual - 64 - textos)));
  };

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={apresentacaoEstilos.topo}>
        {/* .apresentacao-topo no celular: 12 do respiro da página em cima e 48 de altura. */}
        <View style={[estilos.marcaConteudo, apresentacaoEstilos.topoConteudo]}>
          {/* O "Voltar" do último passo: botão de texto de 48 com a seta, rente à margem (a caixa tem 12 de respiro). */}
          {ultimo && passo > 0 && (
            <Botao rotulo={mensagens.apresentacao.voltar} testID="voltar-apresentacao" variante="texto" compacto fonte={16} iconeAntes="setaVoltar"
              estilo={apresentacaoEstilos.voltarNoAlto} acao={() => irPara(passo - 1)} />
          )}
          <View style={apresentacaoEstilos.andamento} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={apresentacaoEstilos.pontos}>
              {passos.map((item, indice) => (
                <View key={item.titulo} style={[apresentacaoEstilos.ponto, indice < passo && apresentacaoEstilos.pontoFeito,
                  indice === passo && apresentacaoEstilos.pontoAtivo]} />
              ))}
            </View>
            <Text style={apresentacaoEstilos.posicao}>{mensagens.apresentacao.posicao(passo + 1, total)}</Text>
          </View>
          {!ultimo && <Botao rotulo={mensagens.apresentacao.pular} testID="pular-apresentacao" variante="texto" compacto fonte={16} estilo={{ paddingHorizontal: 12 }} acao={() => concluir()} />}
        </View>
      </View>
      <ScrollView ref={paginas} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={estilos.tela}
        onLayout={(evento) => {
          const altura = evento.nativeEvent.layout.height;
          setAlturaAtual(altura);
          // Com as duas ações empilhadas no último passo, as páginas encolhem: a arte fica com a medida dos outros passos.
          if (!empilhar || !alturaMedida.current) { alturaMedida.current = true; setAlturaUtil(altura); }
        }}
        onMomentumScrollEnd={(evento) => {
          const indice = Math.round(evento.nativeEvent.contentOffset.x / width);
          if (indice !== passo && indice >= 0 && indice < total) setPasso(indice);
        }}>
        {passos.map((item, indice) => (
          <ScrollView key={item.titulo} style={{ width }} contentContainerStyle={[estilos.conteudo, apresentacaoEstilos.pagina]}
            importantForAccessibility={indice === passo ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={indice !== passo}>
            {indice < 4 ? (
              <View testID={`arte-apresentacao-${indice}`} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ height: arteDoPasso(indice) }}>
                {indice === 0 && <ArteMaterial altura={arteDoPasso(0)} ativo={passo === 0} />}
                {indice === 1 && <ArtePonte altura={arteDoPasso(1)} />}
                {indice === 2 && <ArteExplique altura={arteDoPasso(2)} ativo={passo === 2} />}
                {indice === 3 && <ArteProgresso largura={largura} altura={arteDoPasso(3)} ativo={passo === 3} />}
              </View>
            ) : (
              <View accessibilityLabel={mensagens.apresentacao.areas} style={apresentacaoEstilos.areas}>
                {areasDaApresentacao.map((item) => (
                  <AreaDaApresentacao key={item.id} nome={item.nome} id={item.id} escolhida={area === item.id}
                    escolher={() => setArea((atual) => (atual === item.id ? undefined : item.id))} />
                ))}
              </View>
            )}
            {/* O título e o texto centrados no que sobra até o rodapé. */}
            <View style={apresentacaoEstilos.textos}>
              <View onLayout={(evento) => {
                const altura = Math.ceil(evento.nativeEvent.layout.height);
                setAlturaDosTextos((antes) => (antes[indice] === altura ? antes : { ...antes, [indice]: altura }));
              }}>
                <Text ref={(titulo) => { titulos.current[indice] = titulo; }} testID={`titulo-apresentacao-${indice}`} accessible
                  accessibilityRole="header" accessibilityLabel={`${mensagens.apresentacao.posicao(indice + 1, total)}: ${item.titulo}`} textBreakStrategy="balanced"
                  style={[estilos.titulo, quebraEquilibrada]}>{item.titulo}</Text>
                <Text style={[estilos.introducao, apresentacaoEstilos.texto]}>{item.texto}</Text>
              </View>
            </View>
          </ScrollView>
        ))}
      </ScrollView>
      {/* Como .apresentacao-rodape da web: a linha de cima fica dentro das margens do conteúdo, não de ponta a ponta. */}
      <View style={apresentacaoEstilos.rodape}>
        <View style={[apresentacaoEstilos.rodapeConteudo, !empilhar && apresentacaoEstilos.acoes]}>
          {!ultimo && passo > 0 && (
            <View style={apresentacaoEstilos.metade}>
              <Botao rotulo={mensagens.apresentacao.voltar} testID="voltar-apresentacao" variante="secundario" acao={() => irPara(passo - 1)} />
            </View>
          )}
          {(!comEntrar || empilhar) && (
            <View style={!empilhar && apresentacaoEstilos.metade}>
              <Botao rotulo={rotuloFinal} testID="avancar-apresentacao" icone={ultimo ? undefined : 'seta'}
                acao={() => (ultimo ? concluir(area, true) : irPara(passo + 1))} />
            </View>
          )}
          {comEntrar && (
            <View style={!empilhar && apresentacaoEstilos.metade}>
              <Botao rotulo={mensagens.entrada.entrar} testID="entrar-apresentacao" variante={empilhar ? 'secundario' : 'primario'} acao={entrar} />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Área no último passo: cartão com o ícone; a escolhida fica marcada, o ícone pula e o leitor de tela ouve que está selecionada. */
function AreaDaApresentacao({ id, nome, escolhida, escolher }: { id: IdTema; nome: string; escolhida: boolean; escolher: () => void }) {
  const [focada, setFocada] = useState(false);
  const pulo = usePulinho(escolhida, 1.3);
  return (
    <Pressable testID={`area-apresentacao-${id}`} accessibilityRole="button" accessibilityState={{ selected: escolhida }}
      onPress={escolher} onFocus={() => setFocada(focoVisivel())} onBlur={() => setFocada(false)}
      style={({ pressed }) => [apresentacaoEstilos.area, escolhida && apresentacaoEstilos.areaEscolhida, pressed && apresentacaoEstilos.areaAfundada,
        focada && estilos.foco]}>
      <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={{ transform: [{ scale: pulo }, { rotate: pulo.interpolate({ inputRange: [1, 1.3], outputRange: ['0deg', '-12deg'] }) }] }}>
        <Desenho nome={iconesDosTemas[id]} largura={36} />
      </Animated.View>
      <Text style={[apresentacaoEstilos.areaTexto, escolhida && { color: cores.acaoEscura }]}>{nome}</Text>
    </Pressable>
  );
}

/**
 * Moldura das ilustrações dos momentos (como `.apresentacao-quadro` da web no celular), na altura da arte (banca da noite
 * §2). Sem o selo "Modo demonstração": ele é de conteúdo simulado, não de ilustração.
 */
function Quadro({ altura, centro = false, children }: { altura: number; centro?: boolean; children: ReactNode }) {
  return <View style={[apresentacaoEstilos.quadro, { height: altura }, centro && { justifyContent: 'center' }]}>{children}</View>;
}

/** Conta as entradas no passo: cada uma dá o pop e um ciclo da animação do Stu da arte (spec 13, §B7). */
function useEntradas(ativo: boolean) {
  const [entradas, setEntradas] = useState(0);
  useEffect(() => {
    if (ativo) setEntradas((anterior) => anterior + 1);
  }, [ativo]);
  return entradas;
}

/**
 * O Stu da arte, no canto de baixo à direita, no tamanho que cabe embaixo do conteúdo (com até 24 por cima dele), entre o
 * mínimo e o máximo: no celular, o teto do animado é 110 (spec 13).
 */
function tamanhoDoStuDaArte(altura: number, conteudo: number, minimo: number, maximo: number) {
  return Math.round(Math.max(minimo, Math.min(maximo, altura - 24 - conteudo + 24)));
}

/**
 * Momento 1: o cartão "Fonte do seu material" com o exemplo do contrato, sem o selo de demonstração e com os textos em 14
 * ou mais, e o `stu-estudando` ao lado da citação (banca da noite §2: 160 pedido, 110 no celular pelo teto da spec 13).
 */
function ArteMaterial({ altura, ativo }: { altura: number; ativo: boolean }) {
  const ex = mensagens.apresentacao.exemplos;
  const [cartao, setCartao] = useState(0);
  const entradas = useEntradas(ativo);
  const tamanho = tamanhoDoStuDaArte(altura, cartao, 72, 110);
  return (
    <Quadro altura={altura}>
      <View onLayout={(evento) => setCartao(evento.nativeEvent.layout.height)} style={[degrauFora(4, 20, cores.gelo), apresentacaoEstilos.fonteFora]}>
        <View style={apresentacaoEstilos.fonte}>
          <Text style={[apresentacaoEstilos.fonteRotulo, caixaAlta]}>{mensagens.estudio.fonteMaterial}</Text>
          <Text style={apresentacaoEstilos.fonteOnde}>{ex.fonteArquivo}</Text>
          <View style={apresentacaoEstilos.fonteTrecho}>
            <Text style={apresentacaoEstilos.fonteTrechoTexto}>{ex.fonteTrecho}</Text>
          </View>
        </View>
      </View>
      <View testID="stu-apresentacao-material" style={apresentacaoEstilos.stuDaArte}>
        <Stu nome="stu-estudando" tamanho={tamanho} animado="acontecimento" acontecimento={entradas || undefined} pop={entradas || undefined} />
      </View>
    </Quadro>
  );
}

/**
 * Momento 2: a cena da ponte já vencida (as quatro tábuas verdes), com o Stu do lado da chegada, no meio da arte. Os
 * rótulos das tábuas da web ("Sua tentativa", "Outro jeito"…) ficam na legenda numerada da cena, como na lição: no app,
 * as tábuas não cabem texto. Os textos da cena e da legenda em 14 (banca da noite §2).
 */
function ArtePonte({ altura }: { altura: number }) {
  return (
    <Quadro altura={altura} centro>
      <CenaPonte resposta="" primeiraTabua={mensagens.estudio.ponteTabuaErro} temPonte desafio concluida montada textosDaArte
        estilo={{ marginTop: -10, marginBottom: -12 }} />
    </Quadro>
  );
}

/**
 * Momento 3 (banca da noite §2): só os cartões "O que fez sentido" e "Próximo passo" do Explique, com os textos em 15, e o
 * Stu concentrado de 80 ao lado deles, embaixo (no canto, ele cobria o fim do "Próximo passo" em 390×667 e 360×800).
 */
function ArteExplique({ altura, ativo }: { altura: number; ativo: boolean }) {
  const ex = mensagens.apresentacao.exemplos;
  const entradas = useEntradas(ativo);
  return (
    <Quadro altura={altura} centro>
      <View style={apresentacaoEstilos.explique}>
        <View style={apresentacaoEstilos.metade}>
          <CadernoDoStu apresentacao
            ensino={{ acertos: [ex.ensinoAcertos], lacuna: ex.ensinoLacuna, pergunta: ex.ensinoPergunta, proximoPasso: ex.ensinoProximo, simulado: true }} />
        </View>
        <View testID="stu-apresentacao-explique">
          <Stu nome="stu-concentrado" tamanho={80} animado="acontecimento" acontecimento={entradas || undefined} pop={entradas || undefined} />
        </View>
      </View>
    </Quadro>
  );
}

/** Pontos da estrada da miniatura: as duas curvas da web (src/app/apresentacao.tsx), na grade de 320 × 200. */
function estradaDaMiniatura(largura: number, altura: number, passos = 14) {
  const curvas = [
    [[96, 156], [96, 120], [218, 132], [218, 100]],
    [[218, 100], [218, 68], [122, 64], [122, 40]],
  ];
  const pontos: { x: number; y: number }[] = [];
  curvas.forEach((curva, indiceCurva) => {
    for (let passo = indiceCurva === 0 ? 0 : 1; passo <= passos; passo += 1) {
      const t = passo / passos;
      const u = 1 - t;
      const [p0, p1, p2, p3] = curva;
      const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      pontos.push({ x: (x / 320) * largura, y: (y / 200) * altura });
    }
  });
  return pontos;
}

/** Nó da miniatura, com relevo. */
function NoMini({ x, y, tamanho, face, labio, icone, corIcone }: {
  x: DimensionValue;
  y: DimensionValue;
  tamanho: number;
  face: string;
  labio: string;
  icone: NomeIcone;
  corIcone: string;
}) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, marginLeft: -tamanho / 2, marginTop: -tamanho / 2, width: tamanho, height: tamanho }}>
      <View style={[apresentacaoEstilos.camada, { top: tamanho * 0.09, width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: labio }]} />
      <View style={[apresentacaoEstilos.camada, apresentacaoEstilos.noFace, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: face }]}>
        {/* Traço 3 como a web (3,08 px num ícone de 25; 3,66 no troféu de 29). */}
        <Icone nome={icone} tamanho={Math.round(tamanho * 0.44)} cor={corIcone} traco={3} />
      </View>
    </View>
  );
}

/**
 * Momento 4: trilha vencida no mapa, com as lições concluídas, o troféu no topo, "Ponte construída" e o selo de sincronia.
 * Spec 13 (B4, Designer 19/11): o único passo com Stu próprio — `stu-comemorando` de 40 à direita do troféu, com a base na
 * base do nó (o lábio incluído), que se mexe uma vez a cada entrada no passo, com o pop da §B7. Fica por cima da arte, sem
 * mudar a altura dela.
 */
function ArteProgresso({ largura, altura, ativo }: { largura: number; altura: number; ativo: boolean }) {
  const pontos = estradaDaMiniatura(largura, altura);
  // Os nós e o troféu seguem o lado menor da arte (na altura de 52%, ela fica mais alta que a miniatura de 16:11).
  const lado = Math.min(largura, altura * (16 / 11));
  const no = lado * 0.16;
  const trofeu = lado * 0.19;
  const entradas = useEntradas(ativo);
  const stu = medidasDoStu('stu-comemorando', 40);
  const baseDoTrofeu = altura * 0.2 + trofeu / 2 + trofeu * 0.09;
  return (
    <View style={[apresentacaoEstilos.arte, apresentacaoEstilos.mini, { height: altura, backgroundColor: coresDaRegiao(2).chao }]}>
      {tracoGrosso(pontos, largura * 0.07, 'rgba(255, 255, 255, 0.7)').map((estilo, indice) => (
        <View key={`e${indice}`} style={[apresentacaoEstilos.camada, estilo]} />
      ))}
      {tracoGrosso(pontos, largura * 0.018, cores.sucessoClaro).map((estilo, indice) => (
        <View key={`l${indice}`} style={[apresentacaoEstilos.camada, estilo]} />
      ))}
      <Desenho nome="picos" largura={largura * 0.22} estilo={{ position: 'absolute', left: '3%', top: '10%' }} />
      <Desenho nome="pinheiro" largura={largura * 0.09} estilo={{ position: 'absolute', right: '9%', top: '50%' }} />
      <NoMini x="30%" y="78%" tamanho={no} face={cores.sucessoClaro} labio={cores.sucesso} icone="check" corIcone={cores.fundo} />
      <NoMini x="68%" y="50%" tamanho={no} face={cores.sucessoClaro} labio={cores.sucesso} icone="check" corIcone={cores.fundo} />
      <NoMini x="38%" y="20%" tamanho={trofeu} face={cores.ouro} labio={cores.ouroEscuro} icone="trofeu" corIcone={cores.ouroTexto} />
      <View testID="stu-apresentacao-progresso" style={{ position: 'absolute', left: largura * 0.38 + trofeu / 2 + 4, top: baseDoTrofeu - stu.altura }}>
        <Stu nome="stu-comemorando" tamanho={40} animado="acontecimento" acontecimento={entradas || undefined} pop={entradas || undefined} />
      </View>
      {/* O selo de sincronia do mapa, no canto de cima (como `.apresentacao-sincronia` da web). */}
      <View style={apresentacaoEstilos.sincronia}>
        <SeloSincronia grande sincronia={{ estado: 'atualizado', em: null }} />
      </View>
      {/* Ficha "Ponte construída": 36 de altura com o degrau de 4 por fora (0 4px 0 rgba(11, 27, 92, 0.08) na web). */}
      <View style={[apresentacaoEstilos.seloFora, degrauFora(4, 999, 'rgba(11, 27, 92, 0.08)')]}>
        <View style={apresentacaoEstilos.selo}>
          <Icone nome="check" tamanho={18} cor={cores.sucesso} traco={3} />
          <Text style={apresentacaoEstilos.seloTexto}>{mensagens.estudio.ponteMapaFeita}</Text>
        </View>
      </View>
    </View>
  );
}

const apresentacaoEstilos = StyleSheet.create({
  andamento: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pontos: { flexDirection: 'row', gap: 6 },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.gelo },
  pontoFeito: { backgroundColor: '#9FB1F0' },
  pontoAtivo: { width: 28, backgroundColor: cores.acao },
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  topo: { backgroundColor: cores.fundo },
  // min-height de 48 da .apresentacao-topo mais os 12 de cima (no Yoga a altura mínima conta o padding): no último passo,
  // sem o "Pular", a linha não encolhe e o conteúdo fica na mesma altura dos outros passos.
  topoConteudo: { paddingTop: 12, paddingBottom: 0, minHeight: 60 },
  rodape: { paddingHorizontal: 20, backgroundColor: cores.fundo },
  // 22 da face do botão até a borda, como a web: o degrau de 4 desce por fora, no respiro de baixo (18 à vista).
  rodapeConteudo: { width: '100%', maxWidth: 580, alignSelf: 'center', gap: 12, paddingTop: 16, paddingBottom: 22, borderTopWidth: 2, borderColor: cores.nevoa },
  // .painel--apresentacao no celular: 20 entre a arte e os textos; .apresentacao-textos: 18/24 e 16 entre o título e o texto
  // (a introdução já tem 8 em cima).
  // Banca da noite §2: o título e o texto centrados no que sobra entre a arte e o rodapé (20 de folga embaixo da arte).
  pagina: { flexGrow: 1, paddingTop: 20 },
  textos: { flexGrow: 1, justifyContent: 'center', paddingTop: 20 },
  texto: { fontSize: 18, lineHeight: 24, marginTop: 16 },
  voltarNoAlto: { paddingHorizontal: 12, marginLeft: -12 },
  // O cartão da fonte na arte do passo 1: como .aula-citacao, sem o número e o selo, com os textos em 14 ou mais.
  fonteFora: { alignSelf: 'stretch' },
  fonte: { gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2, borderColor: cores.destaqueBorda, backgroundColor: cores.fundo },
  fonteRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 18, letterSpacing: 0.56 },
  fonteOnde: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  fonteTrecho: { borderLeftWidth: 4, borderColor: cores.acao, paddingLeft: 12, paddingVertical: 2 },
  fonteTrechoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontStyle: 'italic', fontSize: 15, lineHeight: 22 },
  stuDaArte: { position: 'absolute', right: 10, bottom: 6 },
  explique: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  acoes: { flexDirection: 'row' },
  metade: { flex: 1, minWidth: 0 },
  arte: { borderRadius: 28, overflow: 'hidden' },
  mini: { position: 'relative' },
  camada: { position: 'absolute', left: 0, top: 0 },
  pontinho: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(11, 27, 92, 0.24)' },
  noFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.2)' },
  // Moldura dos momentos: como `.apresentacao-quadro` da web no celular (12 de respiro, cantos de 22, borda gelo, fundo névoa).
  quadro: { gap: 10, padding: 12, overflow: 'hidden', borderRadius: 22, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.nevoa },
  sincronia: { position: 'absolute', top: '6%', right: '5%' },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, borderRadius: 28, backgroundColor: cores.ceu },
  area: { width: '47.5%', flexGrow: 1, minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
    borderRadius: 18, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  areaEscolhida: { borderColor: cores.acao, borderBottomColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  areaAfundada: { borderBottomWidth: 2, marginTop: 3 },
  areaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20 },
  seloFora: { position: 'absolute', right: '5%', bottom: '7%' },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: cores.fundo },
  seloTexto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 18 },
});
