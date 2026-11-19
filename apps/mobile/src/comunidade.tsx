import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle,
} from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, G, LinearGradient, Rect, Stop, SvgXml, Text as SvgTexto } from 'react-native-svg';
import {
  LIMITES_COMUNIDADE, MOTIVOS_DENUNCIA, TEMAS, origemLegivel, svgCapaTrilha,
  type CartaoTrilha, type EstadoSeguir, type MotivoDenuncia, type Novidade, type PaginaExplorar, type PerfilPublico, type PessoaNovidade, type Tema,
  type TrilhaCompartilhada,
} from '@studoo/contratos';
import type { ClienteNativo } from './api-nativa';
import { Icone } from './icone';
import { AvisoDoApp, Botao, MenuDeAcoes, Tela, Titulo, degrauFora, estilos, useMovimentoReduzido } from './interface';
import { gestoJaExplicado, marcarGestoExplicado } from './preferencias';
import { mensagens } from './mensagens';
import {
  AcoesDeQuemRecebe, Avatar, BotaoParar, CabecalhoPerfil, Esqueleto, PreviaTrilha, Status, codigoDoErro, compartilharNoSistema, copiar,
  socialEstilos, temFolhaDoSistema, textoDoErro, urlDoLink, urlDoPerfil, focarSemRolar,
} from './social';
import { cores, fontes } from './tema';

/*
 * Comunidade no app (spec 10, etapas B, C1 e C2), espelhando src/app/comunidade.tsx, src/app/seguir.tsx e a página /p da web
 * em b320548: a capa gerada, o cartão de trilha (o mesmo no Explorar, no perfil e na prévia), o Explorar com as abas "Todos"
 * e "Seguindo", o Em alta, o Valeu, Denunciar, Seguir, as Novidades e o perfil de outra pessoa. Textos do contrato.
 */

const c = mensagens.comunidade;
const temas = mensagens.temas;

function anunciar(texto: string) {
  setTimeout(() => AccessibilityInfo.announceForAccessibility(texto), 0);
}

/** A capa: cor do tema e um padrão geométrico determinístico pelo código (o SVG do contrato, desenhado com SvgXml). */
export function CapaTrilha({ codigo, tema }: { codigo: string; tema: Tema | null }) {
  return (
    <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <SvgXml xml={svgCapaTrilha(codigo, tema)} width="100%" height="100%" />
    </View>
  );
}

/**
 * O lugar no Em alta: numeral grande no canto direito da capa, branco com o contorno na cor do texto, como
 * `.cartao-trilha__posicao` da web (o contorno vem por trás do preenchimento, como o `paint-order: stroke fill`).
 */
function Posicao({ numero }: { numero: number }) {
  const texto = String(numero);
  // A caixa da web tem 72 de altura (5rem × 0,9) e a linha de base a 66 do alto; a tela do SVG sobra em volta para a
  // sombra (text-shadow: 0 6px 14px), que a capa corta embaixo como na web.
  const sobra = { lado: 24, cima: 16, baixo: 30 };
  const largura = 56 * texto.length + sobra.lado * 2;
  const altura = 72 + sobra.cima + sobra.baixo;
  const x = largura - sobra.lado;
  const y = sobra.cima + 66;
  const sombra = `sombra-posicao-${numero}`;
  return (
    <View pointerEvents="none" style={[comunidadeEstilos.posicao, { width: largura, height: altura, right: 12 - sobra.lado, bottom: 4 - sobra.baixo }]}
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={largura} height={altura}>
        <Defs>
          <Filter id={sombra} filterUnits="userSpaceOnUse" x={0} y={0} width={largura} height={altura}>
            <FeDropShadow dx={0} dy={6} stdDeviation={7} floodColor="#0F172A" floodOpacity={0.25} />
          </Filter>
        </Defs>
        <G filter={`url(#${sombra})`}>
          <SvgTexto x={x} y={y} textAnchor="end" fontFamily={fontes.titulo} fontWeight="700" fontSize={80} letterSpacing={-4.8}
            fill="none" stroke={cores.texto} strokeWidth={3} strokeLinejoin="round">{texto}</SvgTexto>
          <SvgTexto x={x} y={y} textAnchor="end" fontFamily={fontes.titulo} fontWeight="700" fontSize={80} letterSpacing={-4.8}
            fill="#FFFFFF">{texto}</SvgTexto>
        </G>
      </Svg>
    </View>
  );
}

export type AcoesCartao = {
  queroEstudar: (cartao: CartaoTrilha) => void;
  abrir: (planoId: string) => void;
  valeu: (cartao: CartaoTrilha) => void;
  denunciar: (cartao: CartaoTrilha) => void;
  compartilhar: (cartao: CartaoTrilha) => void;
  /** Título: a prévia da trilha (a página /t da web) dentro do app. */
  abrirPrevia: (codigo: string) => void;
  /** Foto e nome de quem fez: o perfil dela dentro do app. */
  abrirPerfil: (perfilId: string) => void;
  /** O código do cartão em andamento ("Adicionando…", valeu indo). */
  ocupado: string | null;
};

/** Botão quadrado de ícone do cartão (compartilhar, "•••"), como `.cartao-trilha__icone`: 44 × 44 com borda de 2. */
function BotaoDoCartao({ rotulo, icone, acao, testID, desativado = false }: { rotulo: string; icone: 'compartilhar' | 'mais'; acao: () => void; testID?: string; desativado?: boolean }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={rotulo} accessibilityState={{ disabled: desativado }} disabled={desativado}
      onPress={acao} style={({ pressed }) => [comunidadeEstilos.icone, pressed && { backgroundColor: cores.nevoa }, desativado && { opacity: 0.6 }]}>
      <Icone nome={icone} tamanho={20} cor={cores.texto} />
    </Pressable>
  );
}

/**
 * O "•••" do cartão do Explorar e do perfil de outra pessoa: o menu de ações do Studoo (spec 11), igual no iPhone, no Android
 * e na web, com "Denunciar" em vermelho. Na fileira do cartão, o botão tem o contorno dos vizinhos (Curtir e Compartilhar).
 * "Denunciar" abre o diálogo da denúncia, outra janela: ela espera o balão sair (janelas.ts, dentro do menu).
 */
function MenuCartao({ titulo, aoDenunciar, testID }: { titulo: string; aoDenunciar: () => void; testID: string }) {
  return (
    <View style={comunidadeEstilos.menu}>
      <MenuDeAcoes rotulo={mensagens.planos.maisOpcoesRotulo(titulo)} testID={testID} estiloBotao={comunidadeEstilos.icone} corDosPontos={cores.texto}
        acoes={[{ rotulo: c.denunciar, icone: 'bandeirinha', aoEscolher: aoDenunciar, perigo: true, testID: `${testID}-denunciar` }]} />
    </View>
  );
}

/**
 * Cartão de trilha, como `CartaoDeTrilha` da web em 6122cc2 (rodada de banca e lote 4): capa com o tema inteiro no alto,
 * "Demonstração" embaixo à esquerda e o numeral do Em alta embaixo à direita; título (abre a prévia); quem fez (foto e
 * nome num link só, "por" em cinza e só o nome sublinhado); legenda; contagem e números logo acima dos botões; e as ações:
 * Quero estudar / Continuar (azul claro) / Abrir minha trilha, o Valeu (coração, palavra e contagem), Compartilhar e "•••"
 * com Denunciar. Na própria trilha, sem Valeu: "Compartilhar" com ícone e palavra, e a contagem de valeus fica nos números.
 */
export function CartaoDeTrilha({ cartao, acoes, posicao, testID, alturaCapa, duasLinhas = false }: {
  cartao: CartaoTrilha; acoes: AcoesCartao; posicao?: number; testID?: string;
  /** Capa mais baixa no celular (112 na grade, 104 no Em alta); sem ela, a capa tem a proporção 2:1. */
  alturaCapa?: number;
  /** Em fileira ou grade de várias colunas, o título reserva exatamente duas linhas (o resto bate com o vizinho). */
  duasLinhas?: boolean;
}) {
  const sua = cartao.situacao === 'sua';
  const ocupado = acoes.ocupado === cartao.codigo;
  const id = testID ?? `cartao-${cartao.codigo}`;
  const principal = sua
    ? <Botao rotulo={c.sua} variante="secundario" testID={`${id}-sua`} acao={() => cartao.planoId && acoes.abrir(cartao.planoId)} estilo={[comunidadeEstilos.principal, comunidadeEstilos.contorno]} />
    : cartao.situacao === 'adicionada'
      ? <Botao rotulo={c.continuar} variante="secundario" testID={`${id}-continuar`} acao={() => cartao.planoId && acoes.abrir(cartao.planoId)}
          estilo={[comunidadeEstilos.principal, comunidadeEstilos.contorno, comunidadeEstilos.continuar]} />
      : <Botao rotulo={ocupado ? c.adicionando : c.queroEstudar} testID={`${id}-quero`} ocupado={ocupado} acao={() => acoes.queroEstudar(cartao)} estilo={comunidadeEstilos.principal} />;
  // A curtida mora no botão e não mexe nesta linha; na trilha própria, que não tem o botão, a contagem vem aqui.
  const curtidasDaDona = sua && cartao.valeus > 0 ? c.valeus(cartao.valeus) : null;
  const por = c.por('');
  return (
    <View testID={id} style={[degrauFora(4, 20, cores.gelo), comunidadeEstilos.cartaoFora]}>
      <View style={comunidadeEstilos.cartao}>
        <View style={[comunidadeEstilos.capa, alturaCapa !== undefined && { aspectRatio: undefined, height: alturaCapa }]}>
          <CapaTrilha codigo={cartao.codigo} tema={cartao.tema} />
          {posicao !== undefined && <Posicao numero={posicao} />}
          {cartao.tema && (
            <View style={[comunidadeEstilos.selo, comunidadeEstilos.seloTema]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={comunidadeEstilos.seloTexto}>{temas[cartao.tema]}</Text>
            </View>
          )}
          {cartao.demonstracao && (
            <View style={[comunidadeEstilos.selo, comunidadeEstilos.seloDemo]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text numberOfLines={1} style={[comunidadeEstilos.seloTexto, { color: '#5B3A00' }]}>{c.demonstracao}</Text>
            </View>
          )}
        </View>
        <View style={comunidadeEstilos.corpo}>
          {posicao !== undefined && <Text style={comunidadeEstilos.somenteLeitor}>{c.posicao(posicao)}</Text>}
          <Pressable accessibilityRole="link" testID={`${id}-titulo`} onPress={() => acoes.abrirPrevia(cartao.codigo)}
            style={[comunidadeEstilos.tituloToque, duasLinhas && comunidadeEstilos.tituloDuasLinhas]}>
            <Text accessibilityRole="header" style={comunidadeEstilos.titulo}>{cartao.titulo}</Text>
          </Pressable>
          {/* Quem fez: a foto e o nome num link só, que leva ao perfil dela; "por" em cinza, só o nome sublinhado. */}
          {cartao.dono.perfilId ? (
            <Pressable accessibilityRole="link" accessibilityLabel={c.perfilDe(cartao.dono.nome)} testID={`${id}-dono`}
              onPress={() => acoes.abrirPerfil(cartao.dono.perfilId!)} style={[comunidadeEstilos.dono, comunidadeEstilos.donoLink]}>
              <Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} />
              <Text style={comunidadeEstilos.donoLinha}>
                <Text style={comunidadeEstilos.donoPor}>{por}</Text>
                <Text style={comunidadeEstilos.donoNome}>{cartao.dono.nome}</Text>
              </Text>
            </Pressable>
          ) : (
            <View style={comunidadeEstilos.dono}>
              <Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} />
              <Text style={comunidadeEstilos.donoTexto}>{c.por(cartao.dono.nome)}</Text>
            </View>
          )}
          {cartao.legenda && <Text style={comunidadeEstilos.legenda}>{cartao.legenda}</Text>}
          {/* Contagem e números ancorados logo acima dos botões: as últimas linhas batem na fileira. */}
          <View style={comunidadeEstilos.rodape}>
            <Text style={comunidadeEstilos.meta}>{c.contagem(cartao.totalLicoes, cartao.totalPartes)}</Text>
            {/* Altura fixa: "N estudando" ou "Nova" (ninguém estudando); curtir não muda a altura do cartão. */}
            <View testID={`${id}-numeros`} style={comunidadeEstilos.numerosLinha}>
              {cartao.estudando === 0
                ? <View accessible accessibilityLabel={c.novaRotulo} style={comunidadeEstilos.nova}><Text style={comunidadeEstilos.novaTexto}>{c.nova}</Text></View>
                : <Text style={comunidadeEstilos.meta}>{[c.estudando(cartao.estudando), curtidasDaDona].filter(Boolean).join(' · ')}</Text>}
              {cartao.estudando === 0 && curtidasDaDona && <Text style={comunidadeEstilos.meta}>{` · ${curtidasDaDona}`}</Text>}
            </View>
          </View>
          <View style={comunidadeEstilos.acoes}>
            {principal}
            {!sua && <BotaoValeu cartao={cartao} testID={`${id}-valeu`} aoTocar={() => acoes.valeu(cartao)} />}
            {sua ? (
              // Na própria trilha, o compartilhar ocupa a linha, com o ícone e a palavra.
              <Botao rotulo={c.compartilhar} iconeAntes="compartilhar" variante="secundario" nomeAcessivel={c.compartilharRotulo(cartao.titulo)}
                testID={`${id}-compartilhar`} acao={() => acoes.compartilhar(cartao)} estilo={[comunidadeEstilos.principal, comunidadeEstilos.contorno]} />
            ) : (
              <BotaoDoCartao rotulo={c.compartilharRotulo(cartao.titulo)} icone="compartilhar" testID={`${id}-compartilhar`} acao={() => acoes.compartilhar(cartao)} />
            )}
            {!sua && <MenuCartao titulo={cartao.titulo} testID={`${id}-mais`} aoDenunciar={() => acoes.denunciar(cartao)} />}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Curtir (spec 10, "Revisão do dono (19/11)"; esboço `curtir-390.png`): coração de 20, "Curtir" e a contagem (some no zero),
 * num botão de contorno #8792BD que fica branco também curtido: só o coração enche (#D6336C) e a palavra e o número ficam
 * #A3204A. Ao curtir, o coração cresce para 1,3× e volta em 280 ms e o número novo entra por baixo (180 ms); ao descurtir, o
 * coração esvazia em 120 ms, sem pulo, e o número desce. Com movimento reduzido, a troca é na hora. O nome acessível é fixo
 * ("Curtir “X”"); o estado vai no `selected` e a contagem no valor. O botão não desliga enquanto envia.
 */
function BotaoValeu({ cartao, testID, aoTocar }: { cartao: CartaoTrilha; testID: string; aoTocar: () => void }) {
  const marcado = Boolean(cartao.valeuMeu);
  const reduzir = useMovimentoReduzido();
  const animar = reduzir === false;
  const [pulo] = useState(() => new Animated.Value(1));
  const [cheio] = useState(() => new Animated.Value(marcado ? 1 : 0));
  const [numero] = useState(() => new Animated.Value(0));
  const antes = useRef({ marcado, valeus: cartao.valeus });
  useEffect(() => {
    const anterior = antes.current;
    antes.current = { marcado, valeus: cartao.valeus };
    if (!animar) { cheio.setValue(marcado ? 1 : 0); pulo.setValue(1); numero.setValue(0); return; }
    const movimentos: Animated.CompositeAnimation[] = [];
    if (marcado && !anterior.marcado) {
      // curva 0.2, 0.9, 0.3, 1.4 da revisão, nas duas metades do pulo (280 ms ao todo).
      const curva = Easing.bezier(0.2, 0.9, 0.3, 1.4);
      cheio.setValue(1);
      movimentos.push(Animated.sequence([
        Animated.timing(pulo, { toValue: 1.3, duration: 120, easing: curva, useNativeDriver: true }),
        Animated.timing(pulo, { toValue: 1, duration: 160, easing: curva, useNativeDriver: true }),
      ]));
    } else if (!marcado && anterior.marcado) {
      movimentos.push(Animated.timing(cheio, { toValue: 0, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    }
    if (cartao.valeus !== anterior.valeus) {
      // O número novo entra por baixo quando sobe e por cima quando desce.
      numero.setValue(cartao.valeus > anterior.valeus ? 10 : -10);
      movimentos.push(Animated.timing(numero, { toValue: 0, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    }
    if (movimentos.length === 0) return;
    const todos = Animated.parallel(movimentos);
    todos.start();
    return () => todos.stop();
  }, [marcado, cartao.valeus, animar, cheio, pulo, numero]);
  const cor = marcado ? '#A3204A' : cores.texto;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={c.valeuRotulo(cartao.titulo)}
      accessibilityState={{ selected: marcado }} accessibilityValue={cartao.valeus > 0 ? { text: c.valeus(cartao.valeus) } : undefined}
      aria-pressed={marcado} onPress={aoTocar}
      style={({ pressed }) => [comunidadeEstilos.valeu, pressed && { backgroundColor: cores.nevoa }]}>
      <Animated.View style={[comunidadeEstilos.valeuCoracao, { transform: [{ scale: pulo }] }]}>
        <Icone nome="valeu" tamanho={20} cor={cores.texto} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: cheio }]}>
          <Icone nome="valeu" tamanho={20} cor="#D6336C" cheio />
        </Animated.View>
      </Animated.View>
      <Text importantForAccessibility="no" style={[comunidadeEstilos.valeuTexto, { color: cor }]}>{c.valeu}</Text>
      {cartao.valeus > 0 && (
        <Animated.Text testID={`${testID}-n`} importantForAccessibility="no"
          style={[comunidadeEstilos.valeuTexto, comunidadeEstilos.valeuNumero, { color: marcado ? '#A3204A' : cores.textoSecundario, transform: [{ translateY: numero }] }]}>
          {cartao.valeus}
        </Animated.Text>
      )}
    </Pressable>
  );
}

/** Rádio de 20 com o miolo na cor de ação, como o `accent-color` da web. */
function Radio({ marcado }: { marcado: boolean }) {
  return (
    <View style={[comunidadeEstilos.radio, marcado && { borderColor: cores.acao }]}>
      {marcado && <View style={comunidadeEstilos.radioMiolo} />}
    </View>
  );
}

/**
 * Denunciar trilha ou perfil, como `DialogoDenuncia` da web em 6122cc2: o alvo nomeado («"Título", de Nome» ou o nome da
 * pessoa), os quatro motivos em rádio, nenhum marcado, e "Enviar denúncia" desligado até a pessoa escolher; e "Cancelar".
 */
export function DialogoDenuncia({ cliente, alvoTipo, alvo, alvoNome, aoFechar, aoEnviar }: {
  cliente: ClienteNativo; alvoTipo: 'trilha' | 'perfil'; alvo: string;
  /** O que está sendo denunciado, por extenso. */
  alvoNome: string;
  aoFechar: () => void; aoEnviar: (texto: string) => void;
}) {
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Como a web: ao abrir, o foco vai para o primeiro motivo; sem motivo escolhido, "Enviar" mostra o erro e volta para ele.
  const primeiro = useRef<ComponentRef<typeof Pressable>>(null);
  const { width } = useWindowDimensions();
  useEffect(() => {
    const espera = setTimeout(() => focarSemRolar(primeiro.current), 250);
    return () => clearTimeout(espera);
  }, []);

  async function enviar() {
    if (!motivo) { setErro(c.denuncia.escolha); anunciar(c.denuncia.escolha); focarSemRolar(primeiro.current); return; }
    setEnviando(true);
    setErro(null);
    try {
      await cliente.denunciar(alvoTipo, alvo, motivo);
      aoEnviar(c.denuncia.enviada);
    } catch (falha) {
      setErro(textoDoErro(codigoDoErro(falha)));
      setEnviando(false);
    }
  }

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (!enviando) aoFechar(); }}>
      <Pressable accessible={false} style={estilos.modalFundo} onPress={() => { if (!enviando) aoFechar(); }}>
        <Pressable testID="denuncia" accessible={false} accessibilityViewIsModal role="dialog" aria-modal onPress={() => {}} style={[estilos.dialogoCartao, { maxWidth: 416 }]}>
          <Text accessibilityRole="header" style={estilos.dialogoTitulo}>{alvoTipo === 'trilha' ? c.denuncia.tituloTrilha : c.denuncia.tituloPerfil}</Text>
          <Text testID="denuncia-alvo" style={comunidadeEstilos.denunciaAlvo}>{alvoNome}</Text>
          <Text style={estilos.dialogoTexto}>{alvoTipo === 'trilha' ? c.denuncia.texto : c.denuncia.textoPerfil}</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={c.denuncia.escolha} style={comunidadeEstilos.motivos}>
            {MOTIVOS_DENUNCIA.map((opcao, indice) => (
              <Pressable key={opcao} ref={indice === 0 ? primeiro : undefined} testID={`denuncia-${opcao}`} accessibilityRole="radio"
                accessibilityState={{ checked: motivo === opcao }} aria-checked={motivo === opcao}
                onPress={() => { setMotivo(opcao); setErro(null); }} style={[comunidadeEstilos.motivo, motivo === opcao && comunidadeEstilos.motivoMarcado]}>
                <Radio marcado={motivo === opcao} />
                <Text style={comunidadeEstilos.motivoTexto}>{c.denuncia.motivos[opcao]}</Text>
              </Pressable>
            ))}
          </View>
          {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erro}</Text>}
          {/* .recorte__acoes: até 600 de largura, uma embaixo da outra; a ação vem primeiro. */}
          <View style={[comunidadeEstilos.dialogoAcoes, width > 600 && comunidadeEstilos.dialogoAcoesLado]}>
            {/* Nenhum motivo vem marcado: "Enviar" só liga depois que a pessoa escolhe. */}
            <Botao rotulo={enviando ? c.denuncia.enviando : c.denuncia.enviar} variante="destrutivo" testID="denuncia-enviar" ocupado={enviando}
              desativado={!motivo} acao={() => void enviar()} />
            <Botao rotulo={c.denuncia.cancelar} variante="secundario" testID="denuncia-cancelar" desativado={enviando} acao={aoFechar} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * As ações dos cartões (Quero estudar, Valeu, Compartilhar, Denunciar) com o estado da lista, como `useAcoesDeCartao` da
 * web: um só lugar para o Explorar, o perfil da dona e o perfil de outra pessoa. O app sempre tem sessão.
 */
export function useAcoesDeCartao({ cliente, setCartoes, aoAdicionado, aoAbrir, abrirPrevia, abrirPerfil, aoAnunciar }: {
  cliente: ClienteNativo;
  setCartoes: (mudar: (cartao: CartaoTrilha) => CartaoTrilha) => void;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  abrirPrevia: (codigo: string) => void;
  abrirPerfil: (perfilId: string) => void;
  aoAnunciar?: (texto: string) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [denuncia, setDenuncia] = useState<CartaoTrilha | null>(null);
  // O aviso do próprio app (lote 4): o Valeu e a denúncia enviada avisam numa faixa no pé da tela, nunca no sistema.
  const { avisar } = useContext(AvisoDoApp);
  const falar = (texto: string) => { anunciar(texto); aoAnunciar?.(texto); };
  // Um envio de curtida por cartão: o estado que a pessoa quer agora e o de antes do primeiro toque (para voltar no erro).
  const envios = useRef(new Map<string, { desejado: boolean; antes: { valeuMeu: boolean; valeus: number } }>());
  async function enviarCurtida(codigo: string) {
    const envio = envios.current.get(codigo);
    if (!envio) return;
    const pedido = envio.desejado;
    try {
      const r = await cliente.valeu(codigo, pedido);
      if (envio.desejado !== r.valeuMeu) { await enviarCurtida(codigo); return; }
      envios.current.delete(codigo);
      setCartoes((atual) => (atual.codigo === codigo ? { ...atual, valeuMeu: r.valeuMeu, valeus: r.valeus } : atual));
    } catch (falha) {
      envios.current.delete(codigo);
      setCartoes((atual) => (atual.codigo === codigo ? { ...atual, valeuMeu: envio.antes.valeuMeu, valeus: envio.antes.valeus } : atual));
      const erro = codigoDoErro(falha);
      avisar(erro === 'limite_comunidade' ? c.valeuLimite : erro === 'compartilhar_visitante' ? c.valeuContaTemporaria : c.valeuErroRede, { icone: 'alerta' });
    }
  }
  /** O aviso que explica o gesto, só na primeira curtida neste aparelho: "Caio vai ver sua curtida…" (5 s, com o coração). */
  async function explicarNaPrimeiraVez(cartao: CartaoTrilha) {
    if (await gestoJaExplicado()) return;
    await marcarGestoExplicado();
    const primeiroNome = cartao.dono.nome.trim().split(/\s+/)[0] || cartao.dono.nome;
    avisar(c.valeuAviso(primeiroNome), { icone: 'valeu', duracaoMs: 5000 });
  }
  const acoes: AcoesCartao = {
    ocupado,
    abrir: aoAbrir,
    abrirPrevia,
    abrirPerfil,
    async queroEstudar(cartao) {
      setOcupado(cartao.codigo);
      try {
        const feito = await cliente.adicionarTrilha(cartao.codigo);
        setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, situacao: 'adicionada', planoId: feito.planoId, estudando: atual.estudando + (feito.jaTinha ? 0 : 1) } : atual));
        aoAdicionado(feito.planoId, feito.dono.nome, feito.jaTinha);
      } catch (falha) {
        falar(textoDoErro(codigoDoErro(falha)));
      } finally {
        setOcupado(null);
      }
    },
    /**
     * Curtir (spec 10, revisão de 19/11): muda na hora; o leitor de tela ouve "Você curtiu “X”." ou "Curtida retirada de
     * “X”."; o aviso que explica o gesto só aparece na primeira curtida da pessoa neste aparelho. Toques rápidos: vale o último
     * estado (com um envio em andamento, o app guarda o desejado e manda de novo só se ainda for diferente). Erro: volta ao
     * estado anterior e o aviso diz o que houve.
     */
    async valeu(cartao) {
      const ativo = !cartao.valeuMeu;
      setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: ativo, valeus: Math.max(0, atual.valeus + (ativo ? 1 : -1)) } : atual));
      anunciar(ativo ? c.valeuEnviado(cartao.titulo) : c.valeuRetirado(cartao.titulo));
      if (ativo) void explicarNaPrimeiraVez(cartao);
      const envio = envios.current.get(cartao.codigo);
      if (envio) { envio.desejado = ativo; return; }
      envios.current.set(cartao.codigo, { desejado: ativo, antes: { valeuMeu: Boolean(cartao.valeuMeu), valeus: cartao.valeus } });
      await enviarCurtida(cartao.codigo);
    },
    denunciar(cartao) {
      setDenuncia(cartao);
    },
    async compartilhar(cartao) {
      const url = urlDoLink(cartao.codigo);
      if (temFolhaDoSistema()) {
        await compartilharNoSistema(cartao.titulo, mensagens.compartilhar.textoCompartilhar(cartao.titulo), url);
        return;
      }
      falar((await copiar(url)) ? c.linkCopiado : mensagens.compartilhar.copiarFalhou);
    },
  };
  const dialogo = denuncia ? (
    <DialogoDenuncia cliente={cliente} alvoTipo="trilha" alvo={denuncia.codigo} alvoNome={c.denuncia.alvoTrilha(denuncia.titulo, denuncia.dono.nome)}
      aoFechar={() => setDenuncia(null)} aoEnviar={(texto) => { setDenuncia(null); avisar(texto); }} />
  ) : null;
  return { acoes, dialogo };
}

/** Esmaecimento de 24 na borda da fileira que ainda tem conteúdo (a máscara `linear-gradient` da web): o fundo da página por cima. */
function Esmaecer({ lado }: { lado: 'esquerda' | 'direita' }) {
  const id = `esmaecer-${lado}`;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[comunidadeEstilos.esmaecer, lado === 'esquerda' ? { left: 0 } : { right: 0 }]}>
      <Svg width={24} height="100%">
        <Defs>
          <LinearGradient id={id} x1={lado === 'esquerda' ? '0' : '1'} y1="0" x2={lado === 'esquerda' ? '1' : '0'} y2="0">
            <Stop offset="0" stopColor={cores.fundo} stopOpacity={1} />
            <Stop offset="1" stopColor={cores.fundo} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="24" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Fileira rolável que vai até as bordas da tela no celular (as fichas de tema e o Em alta, como a web na rodada de banca):
 * o conteúdo começa no respiro da página e some sob a borda, com o esmaecimento de 24 na borda que ainda tem o que rolar.
 */
function Fileira({ children, estiloConteudo, testID, papel, rotulo, encaixe }: {
  children: ReactNode; estiloConteudo?: StyleProp<ViewStyle>; testID?: string; papel?: 'list' | 'radiogroup'; rotulo?: string;
  /** Passo do encaixe ao rolar (o Em alta encaixa um cartão por vez). */
  encaixe?: number;
}) {
  const [medidas, setMedidas] = useState({ largura: 0, conteudo: 0, x: 0 });
  const rola = medidas.conteudo > medidas.largura + 2;
  return (
    <View style={comunidadeEstilos.fileira}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} accessibilityRole={papel} accessibilityLabel={rotulo}
        snapToInterval={encaixe} snapToAlignment={encaixe ? 'start' : undefined} decelerationRate={encaixe ? 'fast' : undefined} disableIntervalMomentum={Boolean(encaixe)}
        scrollEventThrottle={32}
        onLayout={(evento) => { const largura = evento.nativeEvent.layout.width; setMedidas((atual) => (atual.largura === largura ? atual : { ...atual, largura })); }}
        onContentSizeChange={(conteudo) => setMedidas((atual) => (atual.conteudo === conteudo ? atual : { ...atual, conteudo }))}
        onScroll={(evento) => { const x = evento.nativeEvent.contentOffset.x; setMedidas((atual) => (Math.abs(atual.x - x) < 1 ? atual : { ...atual, x })); }}
        contentContainerStyle={[comunidadeEstilos.fileiraConteudo, estiloConteudo]}>
        {children}
      </ScrollView>
      {rola && medidas.x > 2 && <Esmaecer lado="esquerda" />}
      {rola && medidas.x + medidas.largura < medidas.conteudo - 2 && <Esmaecer lado="direita" />}
    </View>
  );
}

/**
 * Lista horizontal do "Em alta", como a web: cada cartão com 86 % da largura (até 21 rem), encaixe ao rolar e o numeral no
 * canto da capa. As setas da web só existem com ponteiro fino a partir de 768 px: no celular, não.
 */
function EmAlta({ cartoes, acoes, titulo }: { cartoes: CartaoTrilha[]; acoes: AcoesCartao; titulo: string }) {
  const [largura, setLargura] = useState(0);
  // 86 % da largura do conteúdo da página (a lista vai até as bordas, com o respiro da página dentro), até 21 rem.
  const item = largura ? Math.min(largura * 0.86, 336) : 0;
  return (
    <View style={comunidadeEstilos.emAlta}>
      <View>
        <Text accessibilityRole="header" style={comunidadeEstilos.secao}>{titulo}</Text>
        <Text style={[socialEstilos.dica, { marginTop: 2 }]}>{c.emAltaDica}</Text>
      </View>
      <View onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
        {item > 0 && (
          <Fileira testID="em-alta" papel="list" encaixe={item + 8} estiloConteudo={comunidadeEstilos.emAltaLista}>
            {cartoes.map((cartao, indice) => (
              <View key={cartao.codigo} style={{ width: item }}>
                <CartaoDeTrilha cartao={cartao} acoes={acoes} posicao={indice + 1} testID={`em-alta-${indice + 1}`} alturaCapa={ALTURA_CAPA_EM_ALTA} duasLinhas />
              </View>
            ))}
          </Fileira>
        )}
      </View>
    </View>
  );
}

/** Grade de cartões: uma coluna no celular, como `repeat(auto-fill, minmax(min(100%, 17rem), 1fr))` da web. */
function Grade({ cartoes, acoes, prefixo }: { cartoes: CartaoTrilha[]; acoes: AcoesCartao; prefixo: string }) {
  const [largura, setLargura] = useState(0);
  const larguraJanela = useWindowDimensions().width;
  const colunas = Math.max(1, Math.floor((largura + 16) / (272 + 16)));
  const lado = colunas > 1 ? (largura - 16 * (colunas - 1)) / colunas : undefined;
  return (
    <View accessibilityRole="list" onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)} style={comunidadeEstilos.grade}>
      {cartoes.map((cartao) => (
        <View key={cartao.codigo} style={lado ? { width: lado } : comunidadeEstilos.gradeItem}>
          <CartaoDeTrilha cartao={cartao} acoes={acoes} testID={`${prefixo}-${cartao.codigo}`} duasLinhas={colunas > 1}
            alturaCapa={larguraJanela <= 767 ? ALTURA_CAPA_GRADE : undefined} />
        </View>
      ))}
    </View>
  );
}

/** O Stu e o texto de um vazio, como `.explorar__vazio` da web. */
function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <View testID="explorar-vazio" style={comunidadeEstilos.vazio}>
      <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false} style={comunidadeEstilos.vazioStu} />
      <View style={comunidadeEstilos.vazioTexto}>
        <Text accessibilityRole="header" style={comunidadeEstilos.secao}>{titulo}</Text>
        {texto && <Text style={estilos.texto}>{texto}</Text>}
        {acao}
      </View>
    </View>
  );
}

/** Ficha de tema do Explorar (`.ficha-tema`): marcada, fundo na cor do texto. */
function FichaTema({ rotulo, marcada, aoTocar, testID }: { rotulo: string; marcada: boolean; aoTocar: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: marcada }} aria-pressed={marcada} onPress={aoTocar}
      style={({ pressed }) => [comunidadeEstilos.fichaTema, marcada && comunidadeEstilos.fichaTemaMarcada, pressed && !marcada && { backgroundColor: cores.nevoa }]}>
      <Text style={[comunidadeEstilos.fichaTemaTexto, marcada && { color: '#FFFFFF' }]}>{rotulo}</Text>
    </Pressable>
  );
}

/** "Ver trilhas da comunidade" no pedido, logo depois de "Adicionar por link" (`.por-link__abrir` da web: 26 entre os dois, o vão do pedido e os 8 da regra). */
export function IrAoExplorar({ ocupado, acao }: { ocupado: boolean; acao: () => void }) {
  return (
    <Pressable testID="ir-ao-explorar" accessibilityRole="button" accessibilityState={{ disabled: ocupado }} disabled={ocupado} onPress={acao}
      style={({ pressed }) => [socialEstilos.porLinkAbrir, comunidadeEstilos.irAoExplorar, pressed && { backgroundColor: cores.nevoa }]}>
      <Icone nome="bussola" tamanho={18} cor={cores.acao} />
      <Text style={socialEstilos.porLinkAbrirTexto}>{c.irAoExplorar}</Text>
    </Pressable>
  );
}

/** O que o Explorar guarda quando a pessoa abre um perfil ou uma trilha dele: ao voltar, a mesma aba, tema, lista e rolagem. */
export type MemoriaExplorar = { tema: Tema | null; aba: 'todos' | 'seguindo'; pagina: PaginaExplorar; y: number };

/**
 * Tela Explorar, como `Explorar` da web dentro do app: título, abas "Todos" e "Seguindo", fichas de tema, "Em alta esta
 * semana" (top 10), "Novas" (20 por página, "Ver mais trilhas") e os vazios com o Stu. Pela barra de baixo, abre do zero
 * (como a web); voltando de um perfil ou de uma trilha, volta como estava (`memoria`).
 */
export function TelaExplorar({ cliente, acoesTela, aoAdicionado, aoAbrir, abrirPrevia, abrirPerfil, irParaTrilhas, memoria, guardar }: {
  cliente: ClienteNativo;
  acoesTela?: ReactNode;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  abrirPrevia: (codigo: string) => void;
  abrirPerfil: (perfilId: string) => void;
  irParaTrilhas: () => void;
  memoria?: MemoriaExplorar | null;
  guardar?: (memoria: MemoriaExplorar) => void;
}) {
  const [tema, setTema] = useState<Tema | null>(memoria?.tema ?? null);
  const [aba, setAba] = useState<'todos' | 'seguindo'>(memoria?.aba ?? 'todos');
  const [pagina, setPagina] = useState<PaginaExplorar | null>(memoria?.pagina ?? null);
  const [carregando, setCarregando] = useState(!memoria);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeira = useRef(Boolean(memoria));
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const rolado = useRef(0);
  const restaurar = useRef(memoria?.y ?? 0);
  const atual = useRef<MemoriaExplorar | null>(null);
  atual.current = pagina ? { tema, aba, pagina, y: 0 } : null;
  useEffect(() => () => { if (atual.current) guardar?.({ ...atual.current, y: rolado.current }); }, [guardar]);

  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    cliente.explorar({ tema, seguindo: aba === 'seguindo' }).then((dados) => { if (ativo) setPagina(dados); })
      .catch((falha) => { if (ativo) setErro(textoDoErro(codigoDoErro(falha))); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [cliente, tema, aba]);

  async function verMais() {
    if (!pagina?.cursor) return;
    setMaisCarregando(true);
    try {
      const proxima = await cliente.explorar({ tema, cursor: pagina.cursor, seguindo: aba === 'seguindo' });
      setPagina((atual) => atual && { ...atual, novas: [...atual.novas, ...proxima.novas], cursor: proxima.cursor });
    } catch (falha) {
      anunciar(textoDoErro(codigoDoErro(falha)));
    } finally {
      setMaisCarregando(false);
    }
  }

  const setCartoes = (mudar: (cartao: CartaoTrilha) => CartaoTrilha) =>
    setPagina((atual) => atual && { ...atual, emAlta: atual.emAlta.map(mudar), novas: atual.novas.map(mudar) });
  const { acoes, dialogo } = useAcoesDeCartao({ cliente, setCartoes, aoAdicionado, aoAbrir, abrirPrevia, abrirPerfil });
  const vazio = pagina && pagina.emAlta.length === 0 && pagina.novas.length === 0;

  return (
    <Tela pagina="explorar" acoes={acoesTela} rolagem={rolagem} aoRolar={(y) => { rolado.current = y; }} estiloConteudo={FIM_COM_BARRA}
      aoMedirConteudo={(altura) => {
        // Voltando de um perfil ou de uma trilha: a rolagem de antes, assim que a lista guardada já tem altura para ela.
        if (restaurar.current > 0 && altura > restaurar.current) {
          rolagem.current?.scrollTo({ y: restaurar.current, animated: false });
          rolado.current = restaurar.current;
          restaurar.current = 0;
        }
      }}>
      <View style={comunidadeEstilos.painel} accessibilityState={{ busy: carregando }}>
        <View style={comunidadeEstilos.topo}>
          <Titulo testID="titulo-explorar" foco>{c.titulo}</Titulo>
          <Text style={comunidadeEstilos.subtitulo}>{c.subtitulo}</Text>
          {/* Enquanto houver conteúdo de exemplo na tela, uma linha explica o selo (como a web na rodada de banca). */}
          {pagina && [...pagina.emAlta, ...pagina.novas].some((cartao) => cartao.demonstracao) && (
            <Text testID="explorar-demo" style={comunidadeEstilos.explorarDemo}>
              <Text style={comunidadeEstilos.explorarDemoSelo}>{` ${c.demonstracao} `}</Text>
              {` ${c.demonstracaoExplica.replace(`“${c.demonstracao}” `, '')}`}
            </Text>
          )}
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel={c.abasRotulo} style={comunidadeEstilos.abas}>
          {(['todos', 'seguindo'] as const).map((opcao) => (
            <Pressable key={opcao} testID={`aba-${opcao}`} accessibilityRole="button" accessibilityState={{ selected: aba === opcao }} aria-pressed={aba === opcao}
              onPress={() => setAba(opcao)} style={[comunidadeEstilos.aba, aba === opcao && comunidadeEstilos.abaMarcada]}>
              {opcao === 'seguindo' && <Icone nome="pessoa" tamanho={18} cor={aba === opcao ? cores.texto : cores.textoSecundario} />}
              <Text style={[comunidadeEstilos.abaTexto, aba === opcao && { color: cores.texto }]}>{opcao === 'todos' ? c.abaTodos : c.abaSeguindo}</Text>
            </Pressable>
          ))}
        </View>

        {/* Uma linha só, rolável, até as bordas da tela; na aba Seguindo sem ninguém seguido, não há o que filtrar. */}
        {!(aba === 'seguindo' && pagina?.seguindoAlguem === false) && (
          <Fileira papel="radiogroup" rotulo={c.temas} estiloConteudo={comunidadeEstilos.temasConteudo}>
            <FichaTema rotulo={c.todos} marcada={tema === null} testID="tema-todos" aoTocar={() => setTema(null)} />
            {TEMAS.map((opcao) => <FichaTema key={opcao} rotulo={temas[opcao]} marcada={tema === opcao} testID={`tema-${opcao}`} aoTocar={() => setTema(opcao)} />)}
          </Fileira>
        )}

        {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erro}</Text>}
        {carregando && !pagina && (
          <View style={comunidadeEstilos.esqueleto} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={comunidadeEstilos.esqueletoBloco} /><View style={comunidadeEstilos.esqueletoBloco} /><View style={comunidadeEstilos.esqueletoBloco} />
          </View>
        )}

        {pagina && vazio && aba === 'seguindo' && (
          <Vazio titulo={pagina.seguindoAlguem ? c.seguidosSemTrilhas : c.vazioSeguindoTitulo} texto={pagina.seguindoAlguem ? undefined : c.vazioSeguindoTexto}
            acao={<Botao rotulo={c.vazioSeguindoAcao} variante="secundario" testID="vazio-ver-todas" acao={() => { setTema(null); setAba('todos'); }} estilo={{ alignSelf: 'flex-start' }} />} />
        )}
        {pagina && vazio && aba === 'todos' && (
          <Vazio titulo={tema ? c.vazioTema(temas[tema]) : c.vazioTitulo} texto={tema ? c.vazioTemaTexto : c.vazioTexto}
            acao={tema
              ? <Botao rotulo={c.vazioTemaAcao} variante="secundario" testID="vazio-ver-temas" acao={() => setTema(null)} estilo={{ alignSelf: 'flex-start' }} />
              : <Botao rotulo={c.vazioAcao} testID="vazio-minhas-trilhas" acao={irParaTrilhas} estilo={{ alignSelf: 'flex-start' }} />} />
        )}

        {pagina && pagina.emAlta.length > 0 && <EmAlta cartoes={pagina.emAlta} acoes={acoes} titulo={tema ? c.emAltaDoTema(temas[tema]) : c.emAlta} />}

        {pagina && pagina.novas.length > 0 && (
          <View style={comunidadeEstilos.novas}>
            <Text accessibilityRole="header" style={comunidadeEstilos.secao}>{aba === 'seguindo' ? c.seguindoTitulo : tema ? c.novasDoTema(temas[tema]) : c.novas}</Text>
            <Grade cartoes={pagina.novas} acoes={acoes} prefixo="nova" />
            {pagina.cursor
              ? <Botao rotulo={maisCarregando ? c.carregando : c.carregarMais} variante="secundario" testID="ver-mais" ocupado={maisCarregando} acao={() => void verMais()}
                  estilo={comunidadeEstilos.verMais} />
              : pagina.novas.length >= LIMITES_COMUNIDADE.porPagina && <Text style={socialEstilos.dica}>{c.fim}</Text>}
          </View>
        )}
      </View>
      {dialogo}
    </Tela>
  );
}

/** Grade de cartões do perfil (a página da dona e o perfil de outra pessoa), com as mesmas ações do Explorar. */
export function CartoesDoPerfil({ cliente, inicial, titulo, aoAdicionado, aoAbrir, abrirPrevia, abrirPerfil }: {
  cliente: ClienteNativo;
  inicial: CartaoTrilha[];
  titulo: string;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  abrirPrevia: (codigo: string) => void;
  abrirPerfil: (perfilId: string) => void;
}) {
  const [cartoes, setLista] = useState(inicial);
  useEffect(() => { setLista(inicial); }, [inicial]);
  const { acoes, dialogo } = useAcoesDeCartao({
    cliente, aoAdicionado, aoAbrir, abrirPrevia, abrirPerfil, setCartoes: (mudar) => setLista((atual) => atual.map(mudar)),
  });
  return (
    <View testID="perfil-cartoes" style={comunidadeEstilos.perfilCartoes}>
      <Text accessibilityRole="header" style={comunidadeEstilos.perfilCartoesTitulo}>{titulo}</Text>
      <Grade cartoes={cartoes} acoes={acoes} prefixo="perfil" />
      {dialogo}
    </View>
  );
}

/**
 * Botão Seguir, como `BotaoSeguir` da web: "Seguir" (cheio) ou "Seguindo" (claro, com o visto); para a própria pessoa e conta
 * de visitante não aparece. O resultado é anunciado; a contagem de quem chamou muda na hora.
 */
export function BotaoSeguir({ cliente, perfilId, nome, estado, aoMudar }: {
  cliente: ClienteNativo; perfilId: string; nome: string; estado?: EstadoSeguir; aoMudar?: (seguidores: number) => void;
}) {
  const [seguindo, setSeguindo] = useState(Boolean(estado?.seguindo));
  const [ocupado, setOcupado] = useState(false);
  if (estado && !estado.podeSeguir) return null;

  async function alternar() {
    const ativo = !seguindo;
    setOcupado(true);
    setSeguindo(ativo);
    try {
      const r = await cliente.seguir(perfilId, ativo);
      setSeguindo(r.seguindo);
      aoMudar?.(r.seguidores);
      anunciar(ativo ? c.passouASeguir(nome) : c.deixouDeSeguir(nome));
    } catch (falha) {
      setSeguindo(!ativo);
      anunciar(textoDoErro(codigoDoErro(falha)));
    } finally {
      setOcupado(false);
    }
  }

  // Como a web: "Seguir" cheio com a pessoa; "Seguindo" claro com o visto; enquanto o pedido vai, desativado (disabled).
  return (
    <Botao rotulo={seguindo ? c.seguindo : c.seguir} iconeAntes={seguindo ? 'check' : 'pessoa'} variante={seguindo ? 'secundario' : 'primario'}
      testID="botao-seguir" desativado={ocupado} nomeAcessivel={seguindo ? c.seguindoRotulo(nome) : c.seguirRotulo(nome)} acao={() => void alternar()} />
  );
}

/** Rostos de quem agiu numa novidade (até 3, sobrepostos), como `.novidade__rostos`. */
function Rostos({ pessoas }: { pessoas: PessoaNovidade[] }) {
  if (pessoas.length === 0) return null;
  return (
    <View style={comunidadeEstilos.rostos} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {pessoas.slice(0, 3).map((pessoa, indice) => (
        <Avatar key={pessoa.perfilId} nome={pessoa.nome} cor={pessoa.cor} foto={pessoa.foto} estilo={[comunidadeEstilos.rosto, indice > 0 && { marginLeft: -8 }]} />
      ))}
    </View>
  );
}

function textoDaNovidade(n: Novidade): string {
  if (n.tipo === 'adicoes') return c.novidadeAdicoes(n.quantidade, n.titulo);
  const total = n.pessoas.length + n.outros;
  const quem = c.listaPessoas(n.pessoas.map((p) => p.nome), n.outros);
  if (n.tipo === 'valeus') return c.novidadeValeus(quem, total, n.titulo);
  return c.novidadeSeguidores(n.pessoas.length > 0 ? quem : null, total);
}

/** Novidades da dona (últimos 7 dias), agrupadas, como `NovidadesDoPerfil` da web; sem novidade, uma linha discreta. */
export function NovidadesDoPerfil({ cliente, abrirPlano }: { cliente: ClienteNativo; abrirPlano: (id: string) => void }) {
  const [itens, setItens] = useState<Novidade[] | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    cliente.novidades().then((r) => { if (ativo) setItens(r.itens); }).catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [cliente]);
  if (erro) return null;
  if (itens === null) {
    return (
      <View style={comunidadeEstilos.novidadesCarregando} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={comunidadeEstilos.novidadeEsqueleto} /><View style={comunidadeEstilos.novidadeEsqueleto} />
      </View>
    );
  }
  if (itens.length === 0) return <Text testID="novidades-vazio" style={comunidadeEstilos.novidadesVazio}>{c.novidadesVazio}</Text>;
  return (
    <View testID="novidades" style={comunidadeEstilos.novidades}>
      <View style={comunidadeEstilos.novidadesTopo}>
        <Text accessibilityRole="header" style={comunidadeEstilos.secaoPerfil}>{c.novidadesTitulo}</Text>
        <Text style={comunidadeEstilos.novidadesSemana}>{c.novidadesSemana}</Text>
      </View>
      <View style={comunidadeEstilos.novidadesLista}>
        {itens.map((n, i) => {
          const fundo = n.tipo === 'valeus' ? '#FDE8EE' : n.tipo === 'seguidores' ? '#E3F6EA' : cores.ceu;
          const cor = n.tipo === 'valeus' ? '#A3204A' : n.tipo === 'seguidores' ? '#14513B' : cores.acaoEscura;
          return (
            <View key={`${n.tipo}-${'planoId' in n ? n.planoId : 'seguidores'}-${i}`} style={comunidadeEstilos.novidade}>
              <View style={[comunidadeEstilos.novidadeIcone, { backgroundColor: fundo }]}>
                <Icone nome={n.tipo === 'adicoes' ? 'livro' : n.tipo === 'valeus' ? 'valeu' : 'pessoa'} tamanho={20} cor={cor} />
              </View>
              <View style={comunidadeEstilos.novidadeCorpo}>
                {'planoId' in n
                  ? <Pressable accessibilityRole="button" onPress={() => abrirPlano(n.planoId)} style={comunidadeEstilos.novidadeLink}>
                      <Text style={comunidadeEstilos.novidadeTexto}>{textoDaNovidade(n)}</Text>
                    </Pressable>
                  : <Text style={comunidadeEstilos.novidadeTexto}>{textoDaNovidade(n)}</Text>}
                <Text style={comunidadeEstilos.novidadeQuando}>{c.quando(n.em)}</Text>
              </View>
              {n.tipo !== 'adicoes' && <Rostos pessoas={n.pessoas} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** "Compartilhar perfil" pela folha do sistema (o código com a foto no centro, da web, entra com a App-3). */
function CompartilharPerfil({ perfilId, nome }: { perfilId: string; nome: string }) {
  async function compartilhar() {
    const url = urlDoPerfil(perfilId);
    if (temFolhaDoSistema()) { await compartilharNoSistema(mensagens.perfil.paginaTitulo(nome), mensagens.perfil.textoCompartilharPerfil(nome), url); return; }
    anunciar((await copiar(url)) ? mensagens.perfil.linkPerfilCopiado : mensagens.compartilhar.copiarFalhou);
  }
  return <Botao rotulo={mensagens.perfil.compartilharPerfil} iconeAntes="compartilhar" variante="secundario" testID="perfil-publico-compartilhar" acao={() => void compartilhar()} />;
}

/** O Stu com uma frase e "Criar minha trilha": perfil indisponível e link inativo (como as páginas públicas da web). */
function Indisponivel({ titulo, texto, criar }: { titulo: string; texto?: string; criar: () => void }) {
  return (
    <View testID="indisponivel" style={comunidadeEstilos.indisponivel}>
      <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false} style={comunidadeEstilos.vazioStu} />
      <Titulo foco>{titulo}</Titulo>
      {texto && <Text style={estilos.texto}>{texto}</Text>}
      <Botao rotulo={mensagens.compartilhar.criarMinha} acao={criar} estilo={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

/**
 * O perfil de outra pessoa dentro do app (a página /p da web): o cabeçalho com Seguir (e a contagem que muda na hora) e
 * "Compartilhar perfil", os cartões dela ("Trilhas de Ana") e "Denunciar perfil" no fim. Sem a comunidade, a lista simples.
 */
export function TelaPerfilPublico({ cliente, perfilId, acoesTela, aoAdicionado, aoAbrir, abrirPrevia, abrirPerfil, criarTrilha }: {
  cliente: ClienteNativo;
  perfilId: string;
  acoesTela?: ReactNode;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  abrirPrevia: (codigo: string) => void;
  abrirPerfil: (perfilId: string) => void;
  criarTrilha: () => void;
}) {
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [seguidores, setSeguidores] = useState<number | undefined>(undefined);
  const [denunciando, setDenunciando] = useState(false);
  // A denúncia enviada usa o aviso do próprio app (lote 4).
  const { avisar } = useContext(AvisoDoApp);
  useEffect(() => {
    let ativo = true;
    setPerfil(null);
    setFalha(null);
    cliente.perfilPublico(perfilId).then((dados) => { if (ativo) { setPerfil(dados); setSeguidores(dados.alcance.seguidores); } })
      .catch((erro) => { if (ativo) setFalha(codigoDoErro(erro)); });
    return () => { ativo = false; };
  }, [cliente, perfilId]);
  const comunidade = perfil?.alcance.seguidores !== undefined;

  return (
    <Tela pagina={`perfil-${perfilId}`} acoes={acoesTela} estiloConteudo={FIM_COM_BARRA}>
      <View style={comunidadeEstilos.perfilPublico}>
        {!perfil && !falha && (
          <View style={socialEstilos.cabeca} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={[socialEstilos.cabecaFaixa, { backgroundColor: cores.gelo }]} />
            <Esqueleto estilo={{ padding: 18 }} />
          </View>
        )}
        {falha && (falha === 'nao_encontrado' || falha === 'link_inativo'
          ? <Indisponivel titulo={mensagens.perfil.inativo} texto={mensagens.perfil.inativoTexto} criar={criarTrilha} />
          : <Text accessibilityRole="alert" style={socialEstilos.erro}>{textoDoErro(falha)}</Text>)}
        {perfil && (
          <>
            <CabecalhoPerfil demo={Boolean(perfil.demo)} nome={perfil.nome} cor={perfil.cor} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
              alcance={{ ...perfil.alcance, ...(seguidores !== undefined ? { seguidores } : {}) }}
              acoes={<>
                {comunidade && <BotaoSeguir cliente={cliente} perfilId={perfilId} nome={perfil.nome} estado={perfil.seguir} aoMudar={setSeguidores} />}
                <CompartilharPerfil perfilId={perfilId} nome={perfil.nome} />
              </>} />
            {perfil.cartoes ? (
              <>
                <CartoesDoPerfil cliente={cliente} inicial={perfil.cartoes} titulo={mensagens.perfil.paginaTitulo(perfil.nome)}
                  aoAdicionado={aoAdicionado} aoAbrir={aoAbrir} abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfil} />
                <View style={comunidadeEstilos.denunciarPerfil}>
                  <BotaoParar rotulo={c.denuncia.tituloPerfil} icone="bandeirinha" testID="denunciar-perfil" acao={() => setDenunciando(true)} />
                </View>
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={comunidadeEstilos.perfilCartoesTitulo}>{mensagens.perfil.paginaTitulo(perfil.nome)}</Text>
                <View style={comunidadeEstilos.listaSimples}>
                  {perfil.trilhas.map((trilha) => (
                    <Pressable key={trilha.codigo} accessibilityRole="link" accessibilityLabel={mensagens.perfil.abrirTrilha(trilha.titulo)}
                      onPress={() => abrirPrevia(trilha.codigo)} style={[degrauFora(4, 18, cores.gelo), comunidadeEstilos.listaSimplesFora]}>
                      <View style={comunidadeEstilos.listaSimplesItem}>
                        <Text style={comunidadeEstilos.listaSimplesTitulo}>{trilha.titulo}</Text>
                        <Text style={comunidadeEstilos.listaSimplesMeta}>{mensagens.compartilhar.totalLicoes(trilha.totalLicoes)} · {origemLegivel(trilha.origem)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </View>
      {denunciando && (
        <DialogoDenuncia cliente={cliente} alvoTipo="perfil" alvo={perfilId} alvoNome={perfil?.nome ?? ''} aoFechar={() => setDenunciando(false)}
          aoEnviar={(texto) => { setDenunciando(false); avisar(texto); }} />
      )}
    </Tela>
  );
}

/**
 * A prévia de uma trilha compartilhada dentro do app (a página /t da web): o Stu, de quem é, título, contagem e origem, as
 * ações ("Adicionar às minhas trilhas", "Abrir nas minhas trilhas" ou "Abrir trilha"), "Quem compartilhou" com Seguir e as
 * lições por parte. Link encerrado: "Este link não está mais ativo".
 */
export function TelaPreviaTrilha({ cliente, codigo, acoesTela, aoAdicionado, aoAbrir, criarTrilha }: {
  cliente: ClienteNativo;
  codigo: string;
  acoesTela?: ReactNode;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  criarTrilha: () => void;
}) {
  const [trilha, setTrilha] = useState<TrilhaCompartilhada | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    cliente.trilhaCompartilhada(codigo).then((dados) => { if (ativo) setTrilha(dados); })
      .catch((e) => { if (ativo) setFalha(codigoDoErro(e)); });
    return () => { ativo = false; };
  }, [cliente, codigo]);

  async function adicionar() {
    if (!trilha) return;
    setAdicionando(true);
    setErro(null);
    try {
      const feito = await cliente.adicionarTrilha(trilha.codigo);
      aoAdicionado(feito.planoId, feito.dono.nome, feito.jaTinha);
    } catch (e) {
      const cod = codigoDoErro(e);
      if (cod === 'link_inativo') setFalha(cod);
      else setErro(textoDoErro(cod));
      setAdicionando(false);
    }
  }

  return (
    <Tela pagina={`previa-${codigo}`} acoes={acoesTela} estiloConteudo={FIM_COM_BARRA}>
      {!trilha && !falha && <Esqueleto />}
      {falha && (falha === 'link_inativo' || falha === 'nao_encontrado'
        ? <Indisponivel titulo={mensagens.compartilhar.inativo} texto={mensagens.compartilhar.inativoTexto} criar={criarTrilha} />
        : <Text accessibilityRole="alert" style={socialEstilos.erro}>{textoDoErro(falha)}</Text>)}
      {trilha && !falha && (
        <PreviaTrilha trilha={trilha}
          calor={{ seguir: trilha.dono.perfilId && trilha.seguirDono
            ? <View style={comunidadeEstilos.seguirNaPrevia}><BotaoSeguir cliente={cliente} perfilId={trilha.dono.perfilId} nome={trilha.dono.nome} estado={trilha.seguirDono} /></View>
            : null }}
          acoes={<>
            <AcoesDeQuemRecebe trilha={trilha} ocupado={adicionando} adicionar={() => void adicionar()} abrir={aoAbrir} />
            {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erro}</Text>}
          </>} />
      )}
    </Tela>
  );
}

/** Fim da rolagem com a barra de baixo: 120 entre o último bloco e a barra, como `.estudo[data-navegacao] .estudo-principal` (o Perfil também usa). */
export const FIM_COM_BARRA = { paddingBottom: 120 } as const;

/** Capas mais baixas no celular (até 767 de largura), como a web: 112 na grade e 104 no Em alta. */
const ALTURA_CAPA_GRADE = 112;
const ALTURA_CAPA_EM_ALTA = 104;

const comunidadeEstilos = StyleSheet.create({
  irAoExplorar: { marginTop: 26 },
  // .quem-compartilhou__seguir: 6 acima e a largura do próprio botão.
  seguirNaPrevia: { marginTop: 6, alignSelf: 'flex-start' },
  // .cartao-trilha: borda de 2 em volta, cantos de 20 e o degrau de 4 por fora.
  cartaoFora: { flex: 1 },
  cartao: { flex: 1, overflow: 'hidden', borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  capa: { aspectRatio: 2, overflow: 'hidden' },
  posicao: { position: 'absolute', right: 12, bottom: 4, height: 72, zIndex: 1 },
  // .cartao-trilha__tema / __demo: pílulas brancas de 20 de linha com 3 × 10 de respiro; o tema inteiro no alto, à esquerda
  // (até a largura da capa menos 20, quebrando se precisar), e "Demonstração" embaixo, à esquerda.
  selo: { position: 'absolute', left: 10, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  seloTema: { top: 10, maxWidth: '94%' },
  seloDemo: { bottom: 10, backgroundColor: '#FFF6EA' },
  seloTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 20, fontWeight: '900' },
  corpo: { flex: 1, gap: 6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, minWidth: 0 },
  somenteLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  tituloToque: { minHeight: 44, paddingTop: 2, alignSelf: 'flex-start' },
  // Em fileira ou grade de várias colunas: duas linhas reservadas (2,6 em + 2).
  tituloDuasLinhas: { minHeight: 48.8 },
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  dono: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  donoLink: { minHeight: 44 },
  // "por" em cinza, sem negrito (600); só o nome sublinhado, na cor do link.
  donoLinha: { flexShrink: 1, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  donoPor: { color: cores.textoSecundario, fontWeight: '600' },
  donoNome: { color: cores.acao, textDecorationLine: 'underline' },
  donoTexto: { flexShrink: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  legenda: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 23.2 },
  meta: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  // .linha-numeros: 26 de altura fixa; "Nova" é a pílula verde-clara (#E6F4EE, texto #14513B).
  numerosLinha: { flexDirection: 'row', alignItems: 'center', height: 26 },
  nova: { height: 26, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#E6F4EE' },
  novaTexto: { color: '#14513B', fontFamily: fontes.corpo, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  // .cartao-trilha__rodape: contagem e números ancorados acima dos botões (margin-top: auto); as ações a 12 deles.
  rodape: { gap: 4, marginTop: 'auto' },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 12 },
  principal: { flexBasis: '100%', flexGrow: 1 },
  // Contornos dos controles com 3:1 sobre o branco (#8792BD); "Continuar" em azul claro da marca.
  contorno: { borderColor: '#8792BD' },
  continuar: { backgroundColor: cores.ceu },
  // .curtir: contorno de 2 #8792BD, raio 14, fundo branco (curtido também), 14 de folga e 6 entre o coração e a palavra.
  valeu: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minWidth: 44, minHeight: 44, paddingHorizontal: 14,
    borderWidth: 2, borderColor: '#8792BD', borderRadius: 14, backgroundColor: cores.fundo },
  valeuCoracao: { width: 20, height: 20 },
  valeuTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  // .cartao-trilha__valeu-n: a contagem em algarismos de largura fixa, no mínimo 1,25 em.
  valeuNumero: { marginLeft: 2, fontVariant: ['tabular-nums'] },
  icone: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 2, borderColor: '#8792BD',
    borderRadius: 14, backgroundColor: cores.fundo },
  // .denuncia__alvo: o que está sendo denunciado, logo abaixo do título (6 mais perto dele), em 800.
  denunciaAlvo: { marginTop: -6, color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  menu: { position: 'relative' },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#767676', alignItems: 'center', justifyContent: 'center' },
  radioMiolo: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.acao },
  motivos: { gap: 6 },
  motivo: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderWidth: 2, borderColor: cores.gelo, borderRadius: 14 },
  motivoMarcado: { borderColor: cores.acao, backgroundColor: '#F3F6FF' },
  motivoTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  dialogoAcoes: { gap: 10, marginTop: 4 },
  dialogoAcoesLado: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },

  // .painel--explorar: grade com vão de 20.
  painel: { gap: 20 },
  topo: { gap: 4 },
  subtitulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 25.5 },
  secao: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  secaoPerfil: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  abas: { flexDirection: 'row', alignSelf: 'flex-start', gap: 4, padding: 4, borderRadius: 16, backgroundColor: cores.nevoa },
  aba: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 18, borderRadius: 12 },
  abaMarcada: { backgroundColor: cores.fundo, shadowColor: cores.texto, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  abaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '900' },
  // Fileiras até as bordas da tela no celular: a margem negativa do respiro da página (20) e o mesmo respiro dentro.
  fileira: { marginHorizontal: -20 },
  fileiraConteudo: { paddingHorizontal: 20 },
  esmaecer: { position: 'absolute', top: 0, bottom: 0, width: 24 },
  temasConteudo: { gap: 8, paddingTop: 2, paddingBottom: 6 },
  // .explorar__demo: 15/25,5 em cinza, com o selo "Demonstração" tracejado no começo.
  explorarDemo: { marginTop: 4, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 25.5 },
  explorarDemoSelo: { color: '#5B3A00', backgroundColor: '#FFF6EA', fontSize: 13, fontWeight: '900' },
  fichaTema: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 2, borderColor: cores.bordaCampo, borderRadius: 999, backgroundColor: cores.fundo },
  fichaTemaMarcada: { borderColor: cores.texto, backgroundColor: cores.texto },
  fichaTemaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  esqueleto: { gap: 16 },
  esqueletoBloco: { height: 280, borderRadius: 20, backgroundColor: cores.nevoa },
  vazio: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.gelo,
    borderRadius: 20, backgroundColor: cores.ceu },
  vazioStu: { width: 96, height: 106 },
  vazioTexto: { flexGrow: 1, flexShrink: 1, flexBasis: 256, gap: 8, alignItems: 'flex-start' },
  emAlta: { gap: 10 },
  emAltaLista: { gap: 8, paddingTop: 6, paddingBottom: 14 },
  novas: { gap: 12 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gradeItem: { width: '100%' },
  verMais: { alignSelf: 'center', minWidth: 224 },

  perfilCartoes: { gap: 4 },
  perfilCartoesTitulo: { marginTop: 28, marginBottom: 12, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  perfilPublico: { gap: 0 },
  denunciarPerfil: { marginTop: 24, alignItems: 'flex-start' },
  listaSimples: { gap: 12 },
  listaSimplesFora: {},
  listaSimplesItem: { gap: 4, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 2, borderColor: cores.gelo, borderRadius: 18, backgroundColor: cores.fundo },
  listaSimplesTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 25.5, fontWeight: '900' },
  listaSimplesMeta: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  indisponivel: { gap: 12, alignItems: 'flex-start' },

  novidades: { gap: 10 },
  novidadesTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  novidadesSemana: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  novidadesLista: { gap: 8 },
  novidade: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: cores.gelo, borderRadius: 16,
    backgroundColor: cores.fundo },
  novidadeIcone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  novidadeCorpo: { flex: 1, gap: 2, minWidth: 0 },
  novidadeLink: { minHeight: 44, justifyContent: 'center' },
  novidadeTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 21.6, fontWeight: '800' },
  novidadeQuando: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '700' },
  rostos: { flexDirection: 'row' },
  rosto: { borderWidth: 2, borderColor: '#FFFFFF' },
  novidadesVazio: { paddingHorizontal: 14, paddingVertical: 10, borderLeftWidth: 4, borderLeftColor: cores.gelo, color: cores.textoSecundario,
    fontFamily: fontes.corpo, fontSize: 15, lineHeight: 21.75 },
  novidadesCarregando: { gap: 8 },
  novidadeEsqueleto: { height: 56, borderRadius: 16, backgroundColor: cores.nevoa },
});

