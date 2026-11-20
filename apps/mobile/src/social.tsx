import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
  useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Circle, G, Path } from 'react-native-svg';
import {
  CORES_PERFIL, ErroStudoo, FUNDO_DA_COR, LIMITES_COMUNIDADE, TEMAS, VISIBILIDADES, codigoDoLink, enderecoFoto, inicialDoNome,
  motivoLegendaInvalida, motivoNomeInvalido, normalizarNomePerfil, normalizarResumoPerfil,
  type AlcancePerfil, type CorPerfil, type LinkCompartilhado, type MarcasCompartilhar, type Perfil, type PreviaCompartilhar, type Tema,
  type TrilhaCompartilhada, type Visibilidade,
} from '@studoo/contratos';
import { fonteDaMidiaDaDona, origemConfigurada, type ClienteNativo } from './api-nativa';
import { focarSemRolar } from './foco';
import { Icone } from './icone';
import { AvisoDoApp, Botao, BotaoIcone, Campo, RolagemDaTela, degrade, estilos as estilosDaInterface, useMovimentoReduzido } from './interface';
import { LinhaDasRegras, RecusaDoConteudo } from './seguranca';
import { mensagemDoCodigo, mensagens } from './mensagens';
import { cores, fontes } from './tema';
import { Stu } from './mascote';
import { tocaSons } from './sons';
import type { NomeIcone } from './trilha';

/*
 * Perfis e compartilhar trilha no app (spec 09 e 10, etapas A e B), espelhando src/app/compartilhar.tsx e src/app/perfil.tsx
 * da web em a4c70cf: avatar com foto, cabeçalho do perfil, selos nos cartões e no mapa, prévia da trilha compartilhada,
 * "Adicionar por link" e a folha "Compartilhar trilha" com "Quem pode ver". Todos os textos vêm do contrato.
 */

const m = mensagens.compartilhar;
const p = mensagens.perfil;
const cm = mensagens.comunidade;
/** Segurança da comunidade (spec 14): a revisão do que fica público. */
const seg = mensagens.seguranca;

/**
 * Abre o perfil público de uma pessoa dentro do app (o `/p/<id>` da web). Sem quem o forneça (o compartilhar desligado), os
 * nomes ficam só como texto.
 */
export const AbrirPerfil = createContext<((perfilId: string) => void) | null>(null);

/**
 * Uma frase com o nome da pessoa como link para o perfil, como o `<a href="/p/…">` da web: o nome no começo ("Ana
 * compartilhou…") ou no fim ("Compartilhada por Ana"). Sem perfil público ou sem quem abra, a frase inteira é texto.
 */
export function FraseComNome({ frase, nome, perfilId, estilo, estiloNome, rotulo }: {
  frase: string; nome: string; perfilId: string | null | undefined; estilo: StyleProp<TextStyle>; estiloNome?: StyleProp<TextStyle>; rotulo?: string;
}) {
  const abrir = useContext(AbrirPerfil);
  if (!perfilId || !abrir) return <Text style={estilo}>{frase}</Text>;
  const noComeco = frase.startsWith(nome);
  const resto = noComeco ? frase.slice(nome.length) : frase.slice(0, frase.length - nome.length);
  const link = (
    <Text accessibilityRole="link" accessibilityLabel={rotulo} suppressHighlighting onPress={() => abrir(perfilId)}
      style={[socialEstilos.nomeLink, estiloNome]}>{nome}</Text>
  );
  return <Text style={estilo}>{noComeco ? <>{link}{resto}</> : <>{resto}{link}</>}</Text>;
}

/** O código de erro de uma falha, como `codigoDoErro` da web ("rede" quando não veio do servidor). */
export const codigoDoErro = (erro: unknown) => (erro instanceof ErroStudoo ? erro.codigo : 'rede');
/** O texto do erro, como `textoErro` da web. */
export const textoDoErro = (codigo: string) => mensagemDoCodigo(codigo);

/** O endereço público de um link de trilha, no mesmo site que o app usa (na web, `window.location.origin`). */
export function urlDoLink(codigo: string) {
  return `${origemConfigurada().origin}/t/${codigo}`;
}
/** Endereço da página pública do perfil (/p/<id>). */
export function urlDoPerfil(perfilId: string) {
  return `${origemConfigurada().origin}/p/${perfilId}`;
}
function urlDaFoto(foto: string, tamanho: 128 | 512) {
  try {
    return `${origemConfigurada().origin}${enderecoFoto(foto, tamanho)}`;
  } catch {
    return null;
  }
}

/** Data longa da web (`dataCurta`): "18 de novembro de 2026". */
export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * A folha do sistema existe? No aparelho, sempre (Share do React Native); na prévia web, só onde o navegador tem a Web Share,
 * como a web (`typeof navigator.share === 'function'`).
 */
export function temFolhaDoSistema() {
  if (Platform.OS !== 'web') return true;
  return typeof navigator !== 'undefined' && typeof (navigator as { share?: unknown }).share === 'function';
}

/** Abre a folha do sistema com o título, o texto e o endereço. Fechar a folha não é erro. */
export async function compartilharNoSistema(titulo: string, texto: string, url: string) {
  try {
    // No Android, o Share só leva `message`: o endereço vai no fim do texto. No iPhone, `url` vira a prévia do link.
    if (Platform.OS === 'android') await Share.share({ title: titulo, message: `${texto} ${url}` });
    else await Share.share({ title: titulo, message: texto, url });
  } catch { /* A pessoa fechou a folha do sistema: nada a fazer. */ }
}

/** Copia o texto; devolve se deu certo. */
export async function copiar(texto: string) {
  try {
    await Clipboard.setStringAsync(texto);
    // Só links passam por aqui (trilha, perfil e convite): o som de link copiado (spec 12).
    void tocaSons.tocarEfeito('link_copiado');
    return true;
  } catch {
    return false;
  }
}

/** Abre uma página do site (o link original, o perfil público) no navegador do sistema, por cima do app. */
export function abrirNoNavegador(url: string) {
  void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

/** Uma cor misturada com branco, como o `color-mix(in srgb, cor X%, #ffffff)` da web. */
export function misturarComBranco(hex: string, proporcao: number) {
  const valor = hex.replace('#', '');
  const canal = (i: number) => Math.round(parseInt(valor.slice(i, i + 2), 16) * proporcao + 255 * (1 - proporcao));
  return `#${[0, 2, 4].map((i) => canal(i).toString(16).padStart(2, '0')).join('')}`;
}

/** Levar o foco sem rolar mora em foco.ts (o menu de ações da interface também usa); daqui segue exportado como antes. */
export { focarSemRolar };

/** Linha de status que fica sempre no fluxo, como `.folha-status` da web: vazia, não tem altura nem margem (mas conta o vão). */
export function Status({ texto }: { texto: string }) {
  return <Text accessibilityLiveRegion="polite" style={[socialEstilos.status, !texto && socialEstilos.statusVazio]}>{texto}</Text>;
}

/** Botão só de texto em vermelho, como `.folha-parar` da web ("Parar de compartilhar"): 48 de altura (o `.botao` da web), sem respiro nos lados. */
export function BotaoParar({ rotulo, nomeAcessivel, acao, desativado = false, testID, icone }: {
  rotulo: string; nomeAcessivel?: string; acao: () => void; desativado?: boolean; testID?: string;
  /** Ícone de 16 antes do texto, com vão de 6 ("Denunciar perfil", como `.denunciar-perfil .botao` da web). */
  icone?: NomeIcone;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={nomeAcessivel ?? rotulo} accessibilityState={{ disabled: desativado }}
      disabled={desativado} onPress={acao} style={({ pressed }) => [socialEstilos.parar, icone && socialEstilos.pararComIcone, pressed && { opacity: 0.7 }, desativado && { opacity: 0.6 }]}>
      {icone && <Icone nome={icone} tamanho={16} cor="#B3261E" />}
      <Text style={socialEstilos.pararTexto}>{rotulo}</Text>
    </Pressable>
  );
}

/** Repete o anúncio quando o texto é o mesmo (a web acrescenta um espaço para a região viva falar de novo). */
function trocarStatus(anterior: string, novo: string) {
  return anterior === novo ? `${novo} ` : novo;
}
function anunciar(texto: string) {
  setTimeout(() => AccessibilityInfo.announceForAccessibility(texto), 0);
}

const LADOS = { p: 32, m: 56, g: 96 } as const;
const FONTE_DO_LADO = { p: 15, m: 24, g: 40 } as const;

/**
 * A foto da pessoa (128 px; 512 no tamanho grande) ou a inicial na cor, como o `Avatar` da web. Decorativo: o nome sempre
 * está escrito ao lado. Tamanhos: p (32), m (56), g (96) ou um lado livre (24 nas marcas "Compartilhada por").
 */
export function Avatar({ nome, cor, foto = null, tamanho = 'p', estilo, vazio = false, daDona = false }: {
  /** A foto da própria pessoa: em revisão, só abre com a sessão (o token vai só para o host da API, spec 14). */
  daDona?: boolean;
  nome: string;
  cor: CorPerfil;
  foto?: string | null;
  tamanho?: keyof typeof LADOS | number;
  estilo?: StyleProp<ViewStyle>;
  /** Sem nome e sem foto (o perfil vazio, spec 10): o desenho de pessoa (44 em 96, branco) no lugar do "?". */
  vazio?: boolean;
}) {
  const lado = typeof tamanho === 'number' ? tamanho : LADOS[tamanho];
  const fonte = typeof tamanho === 'number' ? Math.round(lado * 0.47) : FONTE_DO_LADO[tamanho];
  const endereco = foto ? urlDaFoto(foto, tamanho === 'g' ? 512 : 128) : null;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[socialEstilos.avatar, { width: lado, height: lado, borderRadius: lado / 2, backgroundColor: FUNDO_DA_COR[cor] }, estilo]}>
      {endereco
        ? <Image source={daDona ? fonteDaMidiaDaDona(endereco) : { uri: endereco }} accessible={false} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: lado / 2 }} />
        : vazio ? <Icone nome="pessoa" tamanho={Math.round(lado * 0.46)} cor="#FFFFFF" />
          : <Text style={[socialEstilos.avatarInicial, { fontSize: fonte, lineHeight: fonte }]}>{inicialDoNome(nome)}</Text>}
    </View>
  );
}

/** O desenho da faixa do perfil: uma trilha pontilhada com marcos, em branco translúcido sobre a cor (o mesmo SVG da web). */
function DesenhoFaixa() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 720 140" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
      <Path d="M-20 108 C 90 40, 170 128, 280 74 S 470 20, 560 70 S 700 120, 760 46" fill="none" stroke="#fff" strokeOpacity={0.32}
        strokeWidth={6} strokeLinecap="round" strokeDasharray="1 18" />
      <G fill="#fff" fillOpacity={0.22}>
        <Circle cx="280" cy="74" r="11" /><Circle cx="560" cy="70" r="11" /><Circle cx="96" cy="70" r="7" />
        <Path d="M640 24l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" />
        <Path d="M410 104l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
      </G>
      <G fill="#fff" fillOpacity={0.14}><Circle cx="180" cy="26" r="22" /><Circle cx="690" cy="122" r="30" /></G>
    </Svg>
  );
}

/**
 * O cabeçalho do perfil, o mesmo na tela Perfil e na prévia da edição: faixa na cor do perfil, foto grande sobreposta, nome,
 * resumo, interesses e a linha de alcance. No celular, as ações vão para o fim do cartão, uma embaixo da outra.
 */
export function CabecalhoPerfil({ nome, cor, foto, resumo, interesses, alcance, acoes, semResumo, comoTitulo = true, estilo, demo = false, daDona = false }: {
  /** O cabeçalho da própria pessoa (aba Perfil): a foto vai com a sessão. */
  daDona?: boolean;
  /** Perfil de demonstração: o selo embaixo do nome (spec 10, C1). */
  demo?: boolean;
  nome: string;
  cor: CorPerfil;
  foto: string | null;
  resumo: string | null;
  interesses: Tema[];
  alcance: AlcancePerfil;
  acoes?: ReactNode;
  semResumo?: ReactNode;
  /** Na tela Perfil o nome é um título (h2 da web); na prévia da edição, só texto (nivel "p"). */
  comoTitulo?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const fundo = FUNDO_DA_COR[cor];
  return (
    <View style={[socialEstilos.cabeca, estilo]}>
      <View style={[socialEstilos.cabecaFaixa, degrade(`linear-gradient(120deg, ${fundo} 0%, ${misturarComBranco(fundo, 0.72)} 100%)`)]}
        importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <DesenhoFaixa />
      </View>
      <View style={socialEstilos.cabecaCorpo}>
        <Avatar nome={nome} cor={cor} foto={foto} tamanho="g" estilo={socialEstilos.cabecaAvatar} daDona={daDona} />
        <Text accessibilityRole={comoTitulo ? 'header' : undefined} style={socialEstilos.cabecaNome}>{nome}</Text>
        {demo && <SeloDemo />}
        {resumo ? <Text style={socialEstilos.cabecaResumo}>{resumo}</Text> : semResumo}
        {interesses.length > 0 && (
          <View accessibilityLabel={p.interessesRotulo} style={socialEstilos.cabecaInteresses}>
            {interesses.map((tema) => (
              <View key={tema} style={[socialEstilos.cabecaInteresse, { borderColor: misturarComBranco(fundo, 0.36), backgroundColor: misturarComBranco(fundo, 0.09) }]}>
                <Text style={socialEstilos.cabecaInteresseTexto}>{mensagens.temas[tema]}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Números (spec 10, revisão de 19/11): até três colunas, só com os itens acima de zero; tudo zero, a fileira não aparece.
            O leitor de tela ouve uma frase só. */}
        {(() => {
          const seguidores = alcance.seguidores ?? 0;
          const itens = [
            alcance.trilhas > 0 ? { n: alcance.trilhas, rotulo: p.numeroTrilhas(alcance.trilhas) } : null,
            alcance.pessoas > 0 ? { n: alcance.pessoas, rotulo: p.numeroEstudando } : null,
            seguidores > 0 ? { n: seguidores, rotulo: p.numeroSeguidores(seguidores) } : null,
          ].filter((item): item is { n: number; rotulo: string } => item !== null);
          if (itens.length === 0) return null;
          return (
            <View testID="perfil-numeros" accessible accessibilityLabel={p.numerosLeitor(alcance.trilhas, alcance.pessoas, seguidores)} style={socialEstilos.numeros}>
              {itens.map((item) => (
                <View key={item.rotulo} style={socialEstilos.numero}>
                  <Text style={socialEstilos.numeroValor}>{item.n}</Text>
                  <Text style={socialEstilos.numeroRotulo}>{item.rotulo}</Text>
                </View>
              ))}
            </View>
          );
        })()}
        {acoes && <View style={socialEstilos.cabecaAcoes}>{acoes}</View>}
      </View>
    </View>
  );
}

/** "Compartilhada" (selo da dona) ou "Compartilhada por Ana", com a foto de agora (trilha recebida), como `MarcaCompartilhar`. */
export function MarcaCompartilhar({ marcas }: { marcas: MarcasCompartilhar }) {
  if (marcas.recebida) {
    const { nome, foto, perfilId } = marcas.recebida;
    return (
      <View style={socialEstilos.marcaRecebida}>
        {foto && <Avatar nome={nome} cor="azul" foto={foto} tamanho={24} />}
        <FraseComNome frase={m.compartilhadaPor(nome)} nome={nome} perfilId={perfilId} estilo={socialEstilos.marcaRecebidaTexto} />
      </View>
    );
  }
  if (marcas.link) {
    return (
      <View testID="selo-compartilhada" style={socialEstilos.seloCompartilhada}>
        <Icone nome="compartilhar" tamanho={14} cor={cores.acaoEscura} />
        <Text style={socialEstilos.seloCompartilhadaTexto}>{m.selo}</Text>
      </View>
    );
  }
  return null;
}

/**
 * No mapa de uma trilha recebida, "Esta trilha é de Ana" (com a foto de agora) e "Ver o link original", se o link ainda
 * existe; o link abre a página pública dele (na web, a mesma página na aba).
 */
export function TrilhaRecebida({ recebida }: { recebida: NonNullable<MarcasCompartilhar['recebida']> }) {
  return (
    <View style={socialEstilos.trilhaRecebida}>
      {recebida.foto && <Avatar nome={recebida.nome} cor="azul" foto={recebida.foto} tamanho={24} />}
      <FraseComNome frase={m.recebidaDe(recebida.nome)} nome={recebida.nome} perfilId={recebida.perfilId} estilo={socialEstilos.trilhaRecebidaTexto} />
      {recebida.codigoAtivo && (
        <Text accessibilityRole="link" style={socialEstilos.link} suppressHighlighting
          onPress={() => abrirNoNavegador(urlDoLink(recebida.codigoAtivo!))}>{m.verOriginal}</Text>
      )}
    </View>
  );
}

/** Selo "Perfil de demonstração", como `.selo-demo` da web: borda tracejada dourada. */
export function SeloDemo() {
  return <View style={socialEstilos.seloDemo}><Text style={socialEstilos.seloDemoTexto}>{cm.perfilDemo}</Text></View>;
}

/** O aviso verde do mapa depois de adicionar ("Trilha adicionada. Compartilhada por Ana."), como `.trilha-aviso`. */
export function AvisoDaTrilha({ texto }: { texto: string }) {
  return <Text accessibilityRole="alert" style={socialEstilos.trilhaAviso}>{texto}</Text>;
}

/** O nível de visibilidade de um link (e o tema, quando está no Explorar), como `.selo-visibilidade` na tela Perfil. */
export function SeloVisibilidade({ nivel, tema, emRevisao = false }: {
  nivel: Visibilidade; tema?: Tema | null;
  /** Publicação em revisão: o destino e o tema em tom neutro, com "depois da aprovação" (nunca o verde de publicada). */
  emRevisao?: boolean;
}) {
  const icone: NomeIcone = nivel === 'explorar' ? 'bussola' : nivel === 'perfil' ? 'pessoa' : 'copiar';
  const explorar = nivel === 'explorar' && !emRevisao;
  return (
    <View style={[socialEstilos.seloNivel, explorar && socialEstilos.seloNivelExplorar]}>
      <Icone nome={icone} tamanho={14} cor={explorar ? '#14513B' : cores.texto} />
      <Text style={[socialEstilos.seloNivelTexto, explorar && { color: '#14513B' }]}>
        {emRevisao ? seg.destinoDepoisDaAprovacao(cm.niveis[nivel].titulo) : cm.niveis[nivel].titulo}{nivel === 'explorar' && tema ? ` · ${mensagens.temas[tema]}` : ''}
      </Text>
    </View>
  );
}

/** Chave (interruptor) acessível, como `.chave` da web: trilho de 46 × 28 com a bolinha. */
export function Chave({ rotulo, nomeAcessivel, ligada, desativada = false, aoMudar, dica }: {
  rotulo: string;
  nomeAcessivel?: string;
  ligada: boolean;
  desativada?: boolean;
  aoMudar: (ligada: boolean) => void;
  dica?: string;
}) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={nomeAcessivel ?? rotulo} accessibilityHint={dica}
      accessibilityState={{ checked: ligada, disabled: desativada }} aria-checked={ligada} disabled={desativada}
      onPress={() => aoMudar(!ligada)} style={socialEstilos.chave}>
      <View style={[socialEstilos.chaveTrilho, ligada && { backgroundColor: cores.acao }, desativada && { opacity: 0.6 }]}>
        <View style={[socialEstilos.chaveBolinha, ligada && { transform: [{ translateX: 18 }] }]} />
      </View>
      <Text style={socialEstilos.chaveTexto}>{rotulo}</Text>
    </Pressable>
  );
}

/** Rádio de uma escolha (os três níveis): o círculo de 20 com o miolo na cor de ação, como o `accent-color` da web. */
function Radio({ marcado }: { marcado: boolean }) {
  return (
    <View style={[socialEstilos.radio, marcado && { borderColor: cores.acao }]}>
      {marcado && <View style={socialEstilos.radioMiolo} />}
    </View>
  );
}

/** Ficha de tema (interesses e tema da publicação), como `.interesse`: marcada fica azul com o "✓". */
export function Ficha({ rotulo, marcada, aoTocar, papel = 'checkbox', complemento, compacta = false }: {
  rotulo: string;
  marcada: boolean;
  aoTocar: () => void;
  papel?: 'checkbox' | 'radio';
  /** " · sugerido pelo título", em letra menor. */
  complemento?: string;
  /** Dentro da publicação: 12 nos lados e texto de 15, como `.publicacao .interesse span`. */
  compacta?: boolean;
}) {
  return (
    <Pressable accessibilityRole={papel} accessibilityState={{ checked: marcada }} aria-checked={marcada}
      accessibilityLabel={complemento ? `${rotulo} · ${complemento}` : rotulo} onPress={aoTocar}
      style={[socialEstilos.ficha, compacta && socialEstilos.fichaCompacta, marcada && socialEstilos.fichaMarcada]}>
      {marcada && <Text style={[socialEstilos.fichaTexto, compacta && { fontSize: 15 }, { color: cores.fundo, fontWeight: '900' }]}>✓</Text>}
      <Text style={[socialEstilos.fichaTexto, compacta && { fontSize: 15 }, marcada && { color: cores.fundo }]}>
        {rotulo}
        {complemento && <Text style={[socialEstilos.fichaComplemento, marcada && { color: 'rgba(255, 255, 255, 0.9)' }]}> · {complemento}</Text>}
      </Text>
    </Pressable>
  );
}

/** As seis cores do avatar em rádio, como `.cores-perfil`: amostra de 34 com aro branco e o anel escuro na escolhida. */
export function CoresDoPerfil({ cor, aoEscolher, dica }: { cor: CorPerfil; aoEscolher: (cor: CorPerfil) => void; dica?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={m.corRotulo} accessibilityHint={dica}>
      <Text style={socialEstilos.legenda}>{m.corRotulo}</Text>
      {dica && <Text style={socialEstilos.corDica}>{dica}</Text>}
      <View style={socialEstilos.cores}>
        {CORES_PERFIL.map((opcao) => (
          <Pressable key={opcao} accessibilityRole="radio" accessibilityLabel={m.cores[opcao]} accessibilityState={{ checked: cor === opcao }}
            aria-checked={cor === opcao} onPress={() => aoEscolher(opcao)} style={socialEstilos.cor}>
            <View style={[socialEstilos.corAmostra, { backgroundColor: FUNDO_DA_COR[opcao] }, cor === opcao && socialEstilos.corAmostraEscolhida]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Nome e cor do avatar, com a prévia "Compartilhada por Ana" (passo "Como você quer aparecer?" da folha), como `FormPerfil`. */
function FormPerfil({ cliente, inicial, enviarRotulo, aoSalvar }: {
  cliente: ClienteNativo;
  inicial?: { nome: string | null; cor: CorPerfil | null; foto?: string | null };
  enviarRotulo: string;
  aoSalvar: (perfil: Perfil) => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [cor, setCor] = useState<CorPerfil>(inicial?.cor ?? 'azul');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const normalizado = normalizarNomePerfil(nome);

  async function salvar() {
    const motivo = motivoNomeInvalido(normalizado);
    if (motivo) {
      setErro(p.nomeErros[motivo]);
      campo.current?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      aoSalvar(await cliente.salvarPerfil(normalizado, cor));
    } catch (falha) {
      setErro(textoDoErro(codigoDoErro(falha)));
      setEnviando(false);
    }
  }

  return (
    <View style={socialEstilos.formPerfil}>
      <View style={socialEstilos.campoComDica}>
        <Campo rotulo={m.nomeRotulo} campoRef={campo} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words"
          testID="perfil-nome-folha" erro={erro ?? undefined} accessibilityHint={m.comoAparecerDica}
          onChangeText={(texto) => { setNome(texto); if (erro) setErro(null); }} returnKeyType="done" onSubmitEditing={() => void salvar()} />
        <Text style={socialEstilos.dica}>{m.comoAparecerDica}</Text>
      </View>
      <CoresDoPerfil cor={cor} aoEscolher={setCor} />
      <View style={socialEstilos.formPerfilPrevia}>
        <Avatar nome={normalizado || '?'} cor={cor} foto={inicial?.foto} />
        <Text style={socialEstilos.formPerfilPreviaTexto}>{m.compartilhadaPor(normalizado || '…')}</Text>
      </View>
      <AcoesDaFolha>
        <Botao rotulo={enviando ? p.salvando : enviarRotulo} testID="perfil-continuar" ocupado={enviando} acao={() => void salvar()} />
      </AcoesDaFolha>
    </View>
  );
}

/** `.folha-acoes`: à direita, e uma embaixo da outra na largura toda até 420 de largura (como na web). */
function AcoesDaFolha({ children, empilhadas = false }: { children: ReactNode; empilhadas?: boolean }) {
  const { width } = useWindowDimensions();
  const estreito = width <= 420;
  return (
    <View style={[socialEstilos.folhaAcoes, (estreito || empilhadas) && socialEstilos.folhaAcoesColuna]}>{children}</View>
  );
}

/**
 * "Quem pode ver" (com a comunidade): Só com o link, No meu perfil, No Explorar. Os dois primeiros salvam na hora; o Explorar
 * abre a publicação (tema sugerido pelo título, que a pessoa confirma, e legenda opcional de até 140). Trilha feita de material
 * não vai para o Explorar. Como `VisibilidadeDaTrilha` da web.
 */
function VisibilidadeDaTrilha({ cliente, link, temaSugerido, deMaterial, demonstracao, aoMudar }: {
  cliente: ClienteNativo;
  link: LinkCompartilhado;
  temaSugerido: Tema;
  deMaterial: boolean;
  demonstracao: boolean;
  aoMudar: (link: LinkCompartilhado) => void;
}) {
  const atual: Visibilidade = link.visibilidade ?? (link.noPerfil ? 'perfil' : 'link');
  const [escolhido, setEscolhido] = useState<Visibilidade>(atual);
  const [tema, setTema] = useState<Tema>(link.tema ?? temaSugerido);
  const [legenda, setLegenda] = useState(link.legenda ?? '');
  const [erroLegenda, setErroLegenda] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recusado, setRecusado] = useState(false);
  const { avisar } = useContext(AvisoDoApp);
  // Como a web (C1): no começo só o tema sugerido (ou o salvo); "Trocar tema" abre os 12, e a legenda e o botão ficam à vista.
  const [todosTemas, setTodosTemas] = useState(false);
  const campoLegenda = useRef<ComponentRef<typeof TextInput>>(null);
  const legendaNormal = normalizarResumoPerfil(legenda);
  const usados = [...legendaNormal].length;
  const publicada = atual === 'explorar';
  const mudouPublicacao = publicada && (tema !== (link.tema ?? temaSugerido) || legendaNormal !== (link.legenda ?? ''));

  async function salvar(nivel: Visibilidade) {
    setOcupado(true);
    setErro(null);
    try {
      let novo: LinkCompartilhado;
      setRecusado(false);
      if (nivel === 'explorar') {
        const motivo = motivoLegendaInvalida(legendaNormal);
        if (motivo) {
          setErroLegenda(cm.legendaErros[motivo]);
          campoLegenda.current?.focus();
          return;
        }
        novo = await cliente.definirVisibilidade(link.codigo, 'explorar', { tema, legenda: legendaNormal });
        // Spec 14: pendente nunca diz que já foi publicada; o aviso do app explica a revisão.
        const frase = novo.moderacao === 'pendente' ? seg.enviadaParaRevisao : publicada ? cm.publicacaoSalva : cm.publicada;
        setStatus(frase);
        anunciar(frase);
        if (novo.moderacao === 'pendente') avisar(seg.enviadaParaRevisao);
      } else {
        novo = await cliente.definirVisibilidade(link.codigo, nivel);
        const frase = novo.moderacao === 'pendente' ? seg.enviadaParaRevisao : cm.nivelSalvo(cm.niveis[nivel].titulo);
        setStatus(frase);
        anunciar(frase);
        if (novo.moderacao === 'pendente') avisar(seg.enviadaParaRevisao);
      }
      aoMudar(novo);
      setLegenda(novo.legenda ?? '');
    } catch (falha) {
      const codigo = codigoDoErro(falha);
      // A recusa na hora (lista local de termos): o texto da spec 14, com o link das regras.
      if (codigo === 'conteudo_recusado') setRecusado(true); else setErro(textoDoErro(codigo));
      setEscolhido(atual);
    } finally {
      setOcupado(false);
    }
  }

  function escolher(nivel: Visibilidade) {
    setEscolhido(nivel);
    setStatus('');
    if (nivel !== 'explorar') void salvar(nivel);
  }

  return (
    <View style={socialEstilos.visibilidade}>
      <View accessibilityRole="radiogroup" accessibilityLabel={cm.visibilidadeTitulo} style={socialEstilos.niveis}>
        <Text style={socialEstilos.niveisLegenda}>{cm.visibilidadeTitulo}</Text>
        {VISIBILIDADES.map((nivel) => {
          const bloqueado = nivel === 'explorar' && deMaterial;
          const marcado = escolhido === nivel;
          const texto = bloqueado ? cm.materialFora : cm.niveis[nivel].texto;
          return (
            <Pressable key={nivel} testID={`nivel-${nivel}`} accessibilityRole="radio" accessibilityState={{ checked: marcado, disabled: ocupado || bloqueado }}
              aria-checked={marcado} accessibilityLabel={`${cm.niveis[nivel].titulo}. ${texto}`} disabled={ocupado || bloqueado}
              onPress={() => escolher(nivel)}
              style={[socialEstilos.nivel, marcado && socialEstilos.nivelMarcado, (ocupado || bloqueado) && { opacity: 0.6 }]}>
              <Radio marcado={marcado} />
              <View style={socialEstilos.nivelTextos}>
                {/* "Agora" dentro do cartão do nível que vale de fato (antes de publicar, o Explorar ainda não vale). */}
                <View style={socialEstilos.nivelTituloLinha}>
                  <Text style={socialEstilos.nivelTitulo}>{cm.niveis[nivel].titulo}</Text>
                  {nivel === atual && <View testID={`nivel-${nivel}-agora`} style={socialEstilos.nivelAgora}><Text style={socialEstilos.nivelAgoraTexto}>{cm.agora}</Text></View>}
                </View>
                <Text style={socialEstilos.nivelTexto}>{texto}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {/* Spec 14: acima da ação que publica no perfil ou no Explorar; "Só com o link" não mostra a linha. */}
      {escolhido !== 'link' && <LinhaDasRegras />}
      {escolhido === 'explorar' && !deMaterial && (
        <View style={socialEstilos.publicacao}>
          <View accessibilityRole="radiogroup" accessibilityLabel={cm.temaRotulo} style={socialEstilos.interesses}>
            <Text style={[socialEstilos.legenda, socialEstilos.legendaDoGrupo]}>{cm.temaRotulo}</Text>
            <Text style={socialEstilos.dica}>{cm.temaDica}</Text>
            <View style={[socialEstilos.fichas, { gap: 6 }]}>
              {(todosTemas ? TEMAS : [tema]).map((opcao) => (
                <Ficha key={opcao} papel="radio" compacta rotulo={mensagens.temas[opcao]} marcada={tema === opcao} aoTocar={() => setTema(opcao)}
                  complemento={opcao === temaSugerido ? cm.temaSugerido : undefined} />
              ))}
              {!todosTemas && (
                <Pressable testID="publicacao-trocar-tema" accessibilityRole="button" accessibilityLabel={cm.trocarTemaRotulo(mensagens.temas[tema])}
                  accessibilityState={{ expanded: false }} onPress={() => setTodosTemas(true)}
                  style={({ pressed }) => [socialEstilos.trocarTema, pressed && { backgroundColor: cores.fundo }]}>
                  <Text style={socialEstilos.trocarTemaTexto}>{cm.trocarTema}</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={socialEstilos.campoComDica}>
            <Contador rotulo={cm.legendaRotulo} usados={usados} maximo={LIMITES_COMUNIDADE.legendaMax} />
            <Campo rotulo={cm.legendaRotulo} rotuloOculto campoRef={campoLegenda} value={legenda} multiline numberOfLines={2} maxLength={220}
              testID="publicacao-legenda" erro={erroLegenda ?? undefined} accessibilityHint={`${cm.legendaDica} ${p.resumoContadorLeitor(LIMITES_COMUNIDADE.legendaMax - usados)}`}
              style={{ minHeight: 72 }} onChangeText={(texto) => { setLegenda(texto.replace(/[\r\n]+/g, ' ')); setErroLegenda(null); }} />
            <Text style={socialEstilos.dica}>{cm.legendaDica}</Text>
          </View>
          {demonstracao && <View style={socialEstilos.aviso}><Text style={socialEstilos.avisoTexto}>{cm.demonstracaoAviso}</Text></View>}
          {!publicada && <Text testID="publicacao-ainda" style={socialEstilos.publicacaoAinda}>{cm.aindaNaoNoExplorar(cm.niveis[atual].titulo)}</Text>}
          <View style={socialEstilos.acoesRecorte}>
            {publicada
              ? <Botao rotulo={ocupado ? p.salvando : cm.salvarPublicacao} testID="publicacao-salvar" desativado={!mudouPublicacao} ocupado={ocupado}
                  acao={() => void salvar('explorar')} />
              : <Botao rotulo={ocupado ? cm.publicando : cm.publicar} testID="publicacao-publicar" ocupado={ocupado} acao={() => void salvar('explorar')} />}
            {!publicada && <Botao rotulo={p.cancelar} variante="secundario" desativado={ocupado} acao={() => setEscolhido(atual)} />}
          </View>
        </View>
      )}
      {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erro}</Text>}
      {recusado && <RecusaDoConteudo />}
      {/* Como a web: o estado ("Nível salvo…") só para o leitor de tela (ele já é anunciado). */}
      <Text style={socialEstilos.somenteLeitor} accessibilityLiveRegion="polite">{status}</Text>
    </View>
  );
}

/** Rótulo de um campo com o contador "N de M" à direita (vermelho além do limite), como `.campo__linha` da web. */
export function Contador({ rotulo, usados, maximo }: { rotulo: string; usados: number; maximo: number }) {
  return (
    <View style={socialEstilos.campoLinha}>
      <Text style={socialEstilos.rotulo}>{rotulo}</Text>
      <Text importantForAccessibility="no" accessibilityElementsHidden
        style={[socialEstilos.contador, usados > maximo && { color: cores.erro }]}>{p.resumoContador(usados, maximo)}</Text>
    </View>
  );
}

type Etapa = 'carregando' | 'perfil' | 'resumo' | 'pronto' | 'parar' | 'visitante' | 'erro';

/**
 * A folha "Compartilhar trilha", como a da web: (a) sem nome, "Como você quer aparecer?"; (b) o que vai e "Criar link"; (c)
 * link pronto, com Compartilhar (a folha do sistema), Copiar link, "Quem pode ver" (ou "Mostrar no meu perfil" sem a
 * comunidade) e "Parar de compartilhar", com a confirmação dentro da folha. Sobe de baixo; o voltar do aparelho fecha (ou,
 * na confirmação, volta ao passo do link), como o Esc da web.
 */
export function FolhaCompartilhar({ cliente, planoId, visitante, comunidade, aoFechar, aoMudarLink, aoMudarPerfil }: {
  cliente: ClienteNativo;
  planoId: string;
  visitante: boolean;
  comunidade: boolean;
  aoFechar: () => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  aoMudarPerfil: (perfil: Perfil) => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(visitante ? 'visitante' : 'carregando');
  const [previa, setPrevia] = useState<PreviaCompartilhar | null>(null);
  const [link, setLink] = useState<LinkCompartilhado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const titulo = useRef<ComponentRef<typeof Text>>(null);
  const insets = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const sistema = temFolhaDoSistema();

  useEffect(() => {
    if (visitante) return;
    let ativo = true;
    cliente.previaCompartilhar(planoId).then((dados) => {
      if (!ativo) return;
      setPrevia(dados);
      setLink(dados.link);
      setEtapa(dados.link ? 'pronto' : dados.perfil ? 'resumo' : 'perfil');
    }).catch((falha) => {
      if (!ativo) return;
      setErro(codigoDoErro(falha));
      setEtapa('erro');
    });
    return () => { ativo = false; };
  }, [cliente, planoId, visitante]);

  // A cada passo, o foco do leitor de tela vai ao título do passo, como na web.
  useEffect(() => {
    if (etapa === 'carregando' || !titulo.current) return;
    const alvo = titulo.current;
    const espera = setTimeout(() => focarSemRolar(alvo), 250);
    return () => clearTimeout(espera);
  }, [etapa]);

  function voltarOuFechar() {
    if (etapa === 'parar') setEtapa('pronto');
    else if (!ocupado) aoFechar();
  }

  async function criarLink() {
    setOcupado(true);
    setErro(null);
    try {
      const novo = await cliente.criarLink(planoId);
      setLink(novo);
      aoMudarLink(planoId, novo);
      setEtapa('pronto');
      anunciar(novo.moderacao === 'pendente' ? seg.enviadaParaRevisao : m.linkPronto);
    } catch (falha) {
      setErro(codigoDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  async function copiarLink() {
    if (!link) return;
    const ok = await copiar(urlDoLink(link.codigo));
    setStatus((anterior) => (ok ? trocarStatus(anterior, m.copiado) : m.copiarFalhou));
    anunciar(ok ? m.copiado : m.copiarFalhou);
  }

  async function alterarPerfil(noPerfil: boolean) {
    if (!link) return;
    setOcupado(true);
    setErro(null);
    try {
      const alterado = await cliente.alterarLink(link.codigo, noPerfil);
      setLink(alterado);
      aoMudarLink(planoId, alterado);
    } catch (falha) {
      setErro(codigoDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  async function parar() {
    if (!link) return;
    setOcupado(true);
    setErro(null);
    try {
      await cliente.encerrarLink(link.codigo);
      setLink(null);
      aoMudarLink(planoId, null);
      anunciar(m.parado);
      aoFechar();
    } catch (falha) {
      setErro(codigoDoErro(falha));
      setEtapa('pronto');
      setOcupado(false);
    }
  }

  // Spec 14 (Designer, b874e95): em revisão ou não publicada, sem "Link pronto", sem o link, sem Compartilhar e sem Copiar link.
  const linkForaDoAr = link?.moderacao === 'pendente' || link?.moderacao === 'recusado';
  // Como a web (0e44f07, compartilhar.tsx): no lugar de "Link pronto", o estado da trilha, "Em revisão" ou "Não publicada".
  const estadoForaDoAr = link?.moderacao === 'pendente' ? seg.seloEmRevisao : seg.seloNaoPublicada;
  const tituloDaEtapa = etapa === 'perfil' ? m.comoAparecer : etapa === 'pronto' ? (linkForaDoAr ? estadoForaDoAr : m.linkPronto) : etapa === 'parar' ? m.pararTitulo : m.folhaTitulo;

  return (
    // Como a web (.folha só sobe com prefers-reduced-motion: no-preference): com movimento reduzido, a folha aparece parada.
    <Modal transparent visible animationType={reduzir === false ? 'slide' : 'none'} statusBarTranslucent onRequestClose={voltarOuFechar}>
      <KeyboardAvoidingView style={socialEstilos.folhaFundo} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Pressable testID="folha-fundo" accessible={false} style={StyleSheet.absoluteFill}
          onPress={() => { if (!ocupado && etapa !== 'parar') aoFechar(); }} />
        <View testID="folha-compartilhar" accessibilityViewIsModal role="dialog" aria-modal
          style={[socialEstilos.folha, { paddingBottom: 20 + insets.bottom }]}>
          {/* Cabeçalho preso no topo ao rolar: "Compartilhar trilha", o nome da trilha e o fechar (como a web na rodada de banca). */}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={socialEstilos.folhaConteudo} bounces={false} stickyHeaderIndices={[0]}>
            <View style={[socialEstilos.folhaTopo, socialEstilos.folhaTopoPreso]}>
              <View style={socialEstilos.folhaTopoTexto}>
                <Text style={socialEstilos.folhaContexto} importantForAccessibility={tituloDaEtapa === m.folhaTitulo ? 'no' : 'auto'}>
                  {tituloDaEtapa === m.folhaTitulo ? '' : m.folhaTitulo}
                </Text>
                {previa && etapa === 'pronto' && (
                  <Text numberOfLines={1} importantForAccessibility="no" style={socialEstilos.folhaTopoTrilha}>{previa.titulo}</Text>
                )}
              </View>
              {etapa !== 'parar' && <BotaoIcone icone="fechar" rotulo={m.fechar} testID="folha-fechar" desativado={ocupado} acao={aoFechar} />}
            </View>
            <Text ref={titulo} accessibilityRole="header" style={socialEstilos.folhaTitulo}>{tituloDaEtapa}</Text>

            {etapa === 'carregando' && <Esqueleto />}
            {etapa === 'visitante' && (
              <>
                <Text style={socialEstilos.folhaTexto}>{m.visitante}</Text>
                <AcoesDaFolha><Botao rotulo={m.fechar} acao={aoFechar} /></AcoesDaFolha>
              </>
            )}
            {etapa === 'erro' && (
              <>
                <Text accessibilityRole="alert" style={socialEstilos.folhaTexto}>{textoDoErro(erro ?? 'falha')}</Text>
                <AcoesDaFolha><Botao rotulo={m.fechar} acao={aoFechar} /></AcoesDaFolha>
              </>
            )}
            {etapa === 'perfil' && (
              <FormPerfil cliente={cliente} enviarRotulo={m.continuar} aoSalvar={(perfil) => {
                aoMudarPerfil(perfil);
                setPrevia((anterior) => anterior && { ...anterior, perfil: perfil.nome && perfil.cor ? { nome: perfil.nome, cor: perfil.cor, foto: perfil.foto } : anterior.perfil });
                setEtapa('resumo');
              }} />
            )}
            {etapa === 'resumo' && previa && (
              <>
                <View style={socialEstilos.folhaTrilha}>
                  <Text style={socialEstilos.folhaTrilhaRotulo}>{m.oQueVai}</Text>
                  <Text style={socialEstilos.folhaTrilhaTitulo}>{previa.titulo}</Text>
                  <Text style={socialEstilos.folhaTrilhaContagem}>{m.contagem(previa.totalLicoes, previa.totalPartes)}</Text>
                  {previa.perfil && (
                    <View style={socialEstilos.folhaTrilhaPor}>
                      <Avatar nome={previa.perfil.nome} cor={previa.perfil.cor} foto={previa.perfil.foto} />
                      <Text style={socialEstilos.folhaTrilhaPorTexto}>{m.compartilhadaPor(previa.perfil.nome)}</Text>
                    </View>
                  )}
                </View>
                <Text style={socialEstilos.folhaTexto}>{m.doZero}</Text>
                {previa.deMaterial && (
                  <View style={socialEstilos.aviso} accessibilityRole="text">
                    <Text style={socialEstilos.avisoTexto}>{previa.tituloTemNomeDoArquivo ? m.avisoMaterialComTitulo : m.avisoMaterial}</Text>
                    {previa.tituloTemNomeDoArquivo && <Text style={[socialEstilos.avisoTexto, { fontWeight: '900' }]}>{m.tituloComArquivo}</Text>}
                  </View>
                )}
                {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{textoDoErro(erro)}</Text>}
                <AcoesDaFolha>
                  <Botao rotulo={ocupado ? m.criando : m.criarLink} testID="criar-link" ocupado={ocupado} acao={() => void criarLink()} />
                </AcoesDaFolha>
              </>
            )}
            {etapa === 'pronto' && link && previa && (
              <>
                <Text style={socialEstilos.folhaTrilhaTitulo}>{previa.titulo}</Text>
                {linkForaDoAr ? (
                  <Text testID="folha-em-revisao" accessibilityLiveRegion="polite" style={socialEstilos.dica}>
                    {link.moderacao === 'pendente' ? seg.enviadaParaRevisao : seg.naoPublicada}
                  </Text>
                ) : <>
                <TextInput testID="folha-link" value={urlDoLink(link.codigo)} editable={false} selectTextOnFocus accessibilityLabel={m.linkRotulo}
                  style={socialEstilos.folhaLink} />
                <View style={[socialEstilos.folhaAcoesPar, !sistema && socialEstilos.folhaAcoesUma]}>
                  {sistema && (
                    <Botao rotulo={m.compartilhar} iconeAntes="compartilhar" testID="folha-sistema" estilo={socialEstilos.botaoMetade}
                      acao={() => void compartilharNoSistema(previa.titulo, m.textoCompartilhar(previa.titulo), urlDoLink(link.codigo))} />
                  )}
                  <Botao rotulo={m.copiar} iconeAntes="copiar" testID="folha-copiar" variante={sistema ? 'secundario' : 'primario'}
                    estilo={sistema ? socialEstilos.botaoMetade : undefined} acao={() => void copiarLink()} />
                </View>
                </>}
                <Status texto={status} />
                {comunidade && previa.temaSugerido ? (
                  <VisibilidadeDaTrilha cliente={cliente} link={link} temaSugerido={previa.temaSugerido} deMaterial={previa.deMaterial}
                    demonstracao={Boolean(previa.demonstracao)} aoMudar={(novo) => { setLink(novo); aoMudarLink(planoId, novo); }} />
                ) : (
                  <>
                    <Chave rotulo={m.noPerfil} ligada={link.noPerfil} desativada={ocupado} dica={m.noPerfilDica} aoMudar={(valor) => void alterarPerfil(valor)} />
                    <Text style={socialEstilos.dica}>{m.noPerfilDica}</Text>
                  </>
                )}
                <Text style={[socialEstilos.folhaTexto, socialEstilos.folhaTextoMiudo]}>{m.doZero}</Text>
                {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{textoDoErro(erro)}</Text>}
                <BotaoParar rotulo={m.parar} testID="folha-parar" desativado={ocupado} acao={() => setEtapa('parar')} />
              </>
            )}
            {etapa === 'parar' && (
              <>
                <Text style={socialEstilos.folhaTexto}>{m.pararTexto}</Text>
                <AcoesDaFolha>
                  <Botao rotulo={m.pararCancelar} variante="secundario" testID="parar-cancelar" desativado={ocupado} acao={() => setEtapa('pronto')} />
                  <Botao rotulo={m.pararConfirmar} variante="destrutivo" testID="parar-confirmar" desativado={ocupado} acao={() => void parar()} />
                </AcoesDaFolha>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Três barras de esqueleto (70 %, 100 %, 45 %), como `.folha-esqueleto`. */
export function Esqueleto({ estilo }: { estilo?: StyleProp<ViewStyle> }) {
  return (
    <View style={[socialEstilos.esqueleto, estilo]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[socialEstilos.esqueletoBarra, { width: '70%' }]} />
      <View style={socialEstilos.esqueletoBarra} />
      <View style={[socialEstilos.esqueletoBarra, { width: '45%' }]} />
    </View>
  );
}

/**
 * A prévia de uma trilha compartilhada, a mesma da página /t da web, no "Adicionar por link": de quem é, título, contagem e
 * origem, as ações logo abaixo e as lições por parte. A dona vendo o próprio link: "Compartilhada por Ana", sem "com você".
 */
export function PreviaTrilha({ trilha, acoes, calor }: {
  trilha: TrilhaCompartilhada;
  acoes: ReactNode;
  /** A página /t: o Stu dá as boas-vindas e o cartão "Quem compartilhou" (com Seguir) vem antes das lições. */
  calor?: { seguir: ReactNode };
}) {
  const titulo = useRef<ComponentRef<typeof Text>>(null);
  const abrirPerfil = useContext(AbrirPerfil);
  const nome = trilha.dono.nome;
  const sua = trilha.situacao === 'sua';
  const jaTem = trilha.situacao === 'adicionada';
  const comCalor = Boolean(calor) && !sua;
  useEffect(() => {
    const alvo = titulo.current;
    if (!alvo) return;
    const espera = setTimeout(() => focarSemRolar(alvo), 150);
    return () => clearTimeout(espera);
  }, [trilha.codigo]);
  return (
    <View style={socialEstilos.previa}>
      {comCalor && (
        <View style={socialEstilos.previaStu}>
          <Stu nome="stu-feliz" tamanho={64} animado="uma-vez" />
          <View style={socialEstilos.previaBalao}><Text style={socialEstilos.previaBalaoTexto}>{jaTem ? m.stuDeNovo : m.stuConvite}</Text></View>
        </View>
      )}
      <View style={socialEstilos.previaDe}>
        <Avatar nome={nome} cor={trilha.dono.cor} foto={trilha.dono.foto} />
        <FraseComNome frase={sua ? m.compartilhadaPor(nome) : m.publicoTitulo(nome)} nome={nome} perfilId={trilha.dono.perfilId}
          estilo={socialEstilos.previaDeTexto} />
      </View>
      {/* Na página /t o título é o h1 (32/40, como os títulos de tela); no "Adicionar por link", o h2 de 20. */}
      <Text ref={titulo} accessibilityRole="header" style={calor ? estilosDaInterface.titulo : socialEstilos.previaTitulo}>{trilha.titulo}</Text>
      <Text style={socialEstilos.previaMeta}>{m.totalLicoes(trilha.totalLicoes)}</Text>
      <View style={socialEstilos.previaAcoes}>{acoes}</View>
      {!sua && <Text style={socialEstilos.previaZero}>{jaTem ? m.jaAdicionadaTexto : m.comecaDoZero}</Text>}
      <View style={socialEstilos.previaPartes}>
        {trilha.partes.map((parte, indice) => (
          <View key={indice}>
            <Text accessibilityRole="header" style={socialEstilos.previaParte}>{m.parte(indice + 1)} · {parte.titulo}</Text>
            <View style={socialEstilos.previaLicoes}>
              {parte.licoes.map((licao, i) => (
                <View key={i} style={socialEstilos.previaLicao}>
                  <Icone nome="livro" tamanho={18} cor={cores.acao} />
                  <Text style={socialEstilos.previaLicaoTexto}>{licao}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      {/* Quem compartilhou vem depois das lições: no alto fica só a linha com a foto e o nome (como a web). */}
      {comCalor && (
        <View accessibilityLabel={m.quemCompartilhou} style={socialEstilos.quem}>
          <Avatar nome={nome} cor={trilha.dono.cor} foto={trilha.dono.foto} tamanho="m" estilo={socialEstilos.quemAvatar} />
          <View style={socialEstilos.quemTexto}>
            <Text style={socialEstilos.quemRotulo}>{m.quemCompartilhou}</Text>
            <Text style={socialEstilos.quemNome}>{nome}</Text>
            {trilha.dono.demo && <SeloDemo />}
            {trilha.dono.resumo && <Text style={socialEstilos.quemResumo}>{trilha.dono.resumo}</Text>}
            {trilha.dono.perfilId && abrirPerfil && (
              <Pressable accessibilityRole="link" onPress={() => abrirPerfil(trilha.dono.perfilId!)} style={socialEstilos.quemLink}>
                <Text style={socialEstilos.link}>{m.verPerfil(nome)}</Text>
              </Pressable>
            )}
            {calor?.seguir}
          </View>
        </View>
      )}
    </View>
  );
}

/** As ações de quem recebe, conforme a situação: adicionar, abrir a já adicionada, ou é sua (o app já tem sessão). */
export function AcoesDeQuemRecebe({ trilha, adicionar, abrir, ocupado }: {
  trilha: TrilhaCompartilhada;
  adicionar: () => void;
  abrir: (planoId: string) => void;
  ocupado: boolean;
}) {
  if (trilha.situacao === 'sua' && trilha.planoId) {
    const id = trilha.planoId;
    return <>
      <Text accessibilityRole="text" style={socialEstilos.situacao}>{m.sua}</Text>
      <Botao rotulo={m.abrirSua} variante="secundario" testID="previa-abrir-sua" acao={() => abrir(id)} estilo={socialEstilos.botaoAlto} />
    </>;
  }
  if (trilha.situacao === 'adicionada' && trilha.planoId) {
    const id = trilha.planoId;
    return <>
      <Text accessibilityRole="text" style={socialEstilos.situacao}>{m.jaAdicionada}</Text>
      <Botao rotulo={m.abrirMinhas} testID="previa-abrir" acao={() => abrir(id)} estilo={socialEstilos.botaoAlto} />
    </>;
  }
  return <Botao rotulo={ocupado ? m.adicionando : m.adicionar} testID="previa-adicionar" ocupado={ocupado} acao={adicionar} estilo={socialEstilos.botaoAlto} />;
}

/**
 * "Adicionar por link", na tela de nova trilha, como na web: aceita o endereço inteiro ou só o código e mostra a mesma prévia
 * da página pública, com as mesmas ações. Link encerrado ou inexistente: "Este link não está mais ativo".
 */
export function AdicionarPorLink({ cliente, ocupado: ocupadoFora, aoAdicionar, abrirPlano }: {
  cliente: ClienteNativo;
  ocupado: boolean;
  aoAdicionar: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  abrirPlano: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [trilha, setTrilha] = useState<TrilhaCompartilhada | null>(null);
  const [inativo, setInativo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const secao = useRef<ComponentRef<typeof View>>(null);
  const rolagem = useContext(RolagemDaTela);
  const { width } = useWindowDimensions();

  // Como a web: ao abrir, a seção sobe (16 do alto, acima do teclado e da barra de baixo) e o campo recebe o foco.
  useEffect(() => {
    if (!aberto) return;
    const espera = setTimeout(() => {
      rolagem?.rolarAte(secao.current, 16);
      campo.current?.focus();
    }, 50);
    return () => clearTimeout(espera);
    // A rolagem da tela não muda enquanto a seção está aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);


  async function ver() {
    const codigo = codigoDoLink(texto);
    setTrilha(null);
    setInativo(false);
    if (!codigo) {
      setErroCampo(m.porLinkInvalido);
      campo.current?.focus();
      return;
    }
    setErroCampo(null);
    setCarregando(true);
    try {
      setTrilha(await cliente.trilhaCompartilhada(codigo));
    } catch (falha) {
      const cod = codigoDoErro(falha);
      if (cod === 'link_inativo') setInativo(true);
      else setErroCampo(textoDoErro(cod));
    } finally {
      setCarregando(false);
    }
  }

  async function adicionar() {
    if (!trilha) return;
    setAdicionando(true);
    try {
      const feito = await cliente.adicionarTrilha(trilha.codigo);
      aoAdicionar(feito.planoId, feito.dono.nome, feito.jaTinha);
    } catch (falha) {
      const cod = codigoDoErro(falha);
      if (cod === 'link_inativo') { setTrilha(null); setInativo(true); } else setErroCampo(textoDoErro(cod));
      setAdicionando(false);
    }
  }

  if (!aberto) {
    return (
      <Pressable testID="por-link-abrir" accessibilityRole="button" accessibilityState={{ disabled: ocupadoFora }} disabled={ocupadoFora}
        onPress={() => setAberto(true)} style={({ pressed }) => [socialEstilos.porLinkAbrir, socialEstilos.porLinkNoPedido, pressed && { backgroundColor: cores.nevoa }]}>
        <Icone nome="compartilhar" tamanho={18} cor={cores.acao} />
        <Text style={socialEstilos.porLinkAbrirTexto}>{m.porLink}</Text>
      </Pressable>
    );
  }
  const empilhar = width <= 420;
  return (
    <View ref={secao} testID="por-link" style={[socialEstilos.porLink, socialEstilos.porLinkNoPedido]}>
      <Text accessibilityRole="header" style={socialEstilos.porLinkTitulo}>{m.porLink}</Text>
      <View style={socialEstilos.porLinkForm}>
        <Text style={socialEstilos.rotulo} onPress={() => campo.current?.focus()} suppressHighlighting>{m.porLinkRotulo}</Text>
        <Text style={socialEstilos.dica}>{m.porLinkDica}</Text>
        <View style={[socialEstilos.porLinkLinha, empilhar && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={empilhar ? undefined : { flex: 1 }}>
            <Campo rotulo={m.porLinkRotulo} rotuloOculto campoRef={campo} value={texto} testID="por-link-campo" inputMode="url" keyboardType="url"
              autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} erro={erroCampo ?? undefined}
              accessibilityHint={m.porLinkDica} returnKeyType="go" onSubmitEditing={() => { if (texto.trim()) void ver(); }}
              onChangeText={(valor) => { setTexto(valor); if (erroCampo) setErroCampo(null); }} />
          </View>
          <Botao rotulo={m.porLinkVer} variante="secundario" testID="por-link-ver" desativado={!texto.trim()} ocupado={carregando} acao={() => void ver()} />
        </View>
      </View>
      {inativo && (
        <View accessibilityLiveRegion="polite" style={socialEstilos.porLinkInativo}>
          <Text style={socialEstilos.situacao}>{m.inativo}</Text>
          <Text style={socialEstilos.folhaTexto}>{m.inativoTexto}</Text>
        </View>
      )}
      {trilha && (
        <PreviaTrilha trilha={trilha} acoes={<AcoesDeQuemRecebe trilha={trilha} ocupado={adicionando} adicionar={() => void adicionar()} abrir={abrirPlano} />} />
      )}
    </View>
  );
}

export const socialEstilos = StyleSheet.create({
  // .numeros (spec 10): colunas com 24 entre elas; o número em Quicksand 700 de 22/26 e o rótulo em Nunito 700 de 13/18.
  numeros: { flexDirection: 'row', gap: 24 },
  numero: { alignItems: 'flex-start' },
  numeroValor: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 26 },
  numeroRotulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  corDica: { marginTop: -4, marginBottom: 8, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInicial: { color: '#FFFFFF', fontFamily: fontes.titulo, fontWeight: '900', textAlign: 'center' },

  // .cabeca-perfil: borda de 2 em volta, cantos de 20, a faixa de 104 e o corpo com 18 nos lados.
  cabeca: { overflow: 'hidden', borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  cabecaFaixa: { height: 104, overflow: 'hidden' },
  cabecaCorpo: { gap: 8, paddingHorizontal: 18, paddingBottom: 18 },
  cabecaAvatar: { marginTop: -48, borderWidth: 4, borderColor: '#FFFFFF', shadowColor: cores.texto, shadowOpacity: 0.18, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  cabecaNome: { marginTop: 4, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 26, lineHeight: 31.2, letterSpacing: -0.91 },
  cabecaResumo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 25.5 },
  cabecaInteresses: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  cabecaInteresse: { paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1.5, borderRadius: 999 },
  cabecaInteresseTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  cabecaAlcance: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cabecaAlcancePonto: { width: 10, height: 10, borderRadius: 5 },
  cabecaAlcanceTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22.5, fontWeight: '800' },
  // No celular, as ações no fim do cartão, na largura toda (.cabeca-perfil__acoes até 559 px).
  cabecaAcoes: { gap: 8, marginTop: 8 },
  cabecaConvite: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderWidth: 2,
    borderStyle: 'dashed', borderColor: cores.bordaCampo, borderRadius: 14 },
  cabecaConviteTexto: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },

  marcaRecebida: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 8 },
  marcaRecebidaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  seloCompartilhada: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 6, paddingHorizontal: 10,
    paddingVertical: 3, borderRadius: 999, backgroundColor: cores.ceu },
  seloCompartilhadaTexto: { color: cores.acaoEscura, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '900' },
  trilhaRecebida: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginTop: 8 },
  trilhaRecebidaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  link: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800', textDecorationLine: 'underline' },
  trilhaAviso: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#E3F6EA', color: '#14513B',
    fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800', overflow: 'hidden' },
  seloNivel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999, backgroundColor: cores.nevoa },
  seloNivelExplorar: { backgroundColor: '#E3F6EA' },
  seloNivelTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '900' },

  chave: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  chaveTrilho: { width: 46, height: 28, borderRadius: 999, backgroundColor: '#C5CDE6' },
  chaveBolinha: { position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  chaveTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  radio: { width: 20, height: 20, marginTop: 3, borderRadius: 10, borderWidth: 2, borderColor: '#767676', alignItems: 'center', justifyContent: 'center' },
  radioMiolo: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.acao },

  legenda: { marginBottom: 8, color: cores.texto, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  // A legenda de um fieldset em grade (`.interesses legend`) não entra no vão de 8 da grade: fica a 4 do primeiro item.
  legendaDoGrupo: { marginBottom: -4 },
  rotulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  dica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20.3 },
  erro: { color: cores.erro, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22.5, fontWeight: '800' },
  status: { color: cores.sucesso, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 22.4, fontWeight: '800', marginTop: -4 },
  statusVazio: { marginTop: 0, lineHeight: 0, height: 0 },
  parar: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
  pararComIcone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pararTexto: { color: '#B3261E', fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  campoComDica: { gap: 8 },
  campoLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  contador: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cores: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cor: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  corAmostra: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#FFFFFF', outlineWidth: 2, outlineColor: cores.gelo, outlineStyle: 'solid' },
  corAmostraEscolhida: { outlineWidth: 3, outlineColor: cores.texto },
  interesses: { gap: 8 },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ficha: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderWidth: 2, borderColor: cores.bordaCampo,
    borderRadius: 999, backgroundColor: cores.fundo },
  fichaCompacta: { paddingHorizontal: 12 },
  fichaMarcada: { borderColor: cores.acao, backgroundColor: cores.acao },
  fichaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  fichaComplemento: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 13, fontWeight: '700', fontStyle: 'italic' },

  formPerfil: { gap: 16 },
  formPerfilPrevia: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: cores.nevoa },
  formPerfilPreviaTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },

  // .folha: sobe de baixo; 480 no máximo, 20 de respiro, borda de 2 sem a de baixo, cantos de 24 em cima.
  folhaFundo: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  folha: { width: '100%', maxWidth: 480, maxHeight: '92%', paddingTop: 20, borderWidth: 2, borderBottomWidth: 0, borderColor: cores.gelo,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo, shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 }, elevation: 16 },
  folhaConteudo: { gap: 14, paddingHorizontal: 20 },
  folhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44, marginTop: -6, marginRight: -6, marginBottom: -10 },
  folhaContexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '900', letterSpacing: 0.52, textTransform: 'uppercase' },
  // .folha-topo--preso: preso no alto ao rolar, na largura toda da folha, com a linha de 2 em névoa embaixo.
  folhaTopoPreso: { marginTop: -20, marginRight: -20, marginLeft: -20, marginBottom: -4, paddingTop: 16, paddingRight: 14, paddingBottom: 10, paddingLeft: 20,
    borderBottomWidth: 2, borderBottomColor: cores.nevoa, backgroundColor: cores.fundo, zIndex: 3 },
  folhaTopoTexto: { flex: 1, gap: 2, minWidth: 0 },
  folhaTopoTrilha: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  folhaTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 27.5, letterSpacing: -0.33 },
  folhaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  folhaTextoMiudo: { color: cores.textoSecundario, fontSize: 14, lineHeight: 21 },
  folhaAcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  folhaAcoesColuna: { flexDirection: 'column', alignItems: 'stretch' },
  folhaAcoesPar: { flexDirection: 'row', gap: 10, marginTop: 4 },
  folhaAcoesUma: { flexDirection: 'column', alignItems: 'stretch' },
  botaoMetade: { flex: 1 },
  folhaTrilha: { gap: 4, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: cores.nevoa },
  folhaTrilhaRotulo: { marginBottom: 2, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '900' },
  folhaTrilhaTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  folhaTrilhaContagem: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  folhaTrilhaPor: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  folhaTrilhaPorTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  aviso: { gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderLeftWidth: 4, borderLeftColor: cores.alerta, borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6, borderTopRightRadius: 14, borderBottomRightRadius: 14, backgroundColor: '#FFF6EA' },
  avisoTexto: { color: '#5B3A00', fontFamily: fontes.corpo, fontSize: 16, lineHeight: 23.2 },
  folhaLink: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2, borderColor: cores.bordaCampo, borderRadius: 14,
    color: cores.texto, backgroundColor: cores.nevoa, fontFamily: fontes.corpo, fontSize: 15 },
  esqueleto: { gap: 10 },
  esqueletoBarra: { height: 18, borderRadius: 8, backgroundColor: cores.gelo },

  visibilidade: {},
  niveis: { gap: 8 },
  niveisLegenda: { marginBottom: 6, color: cores.texto, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '900' },
  nivel: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: cores.gelo, borderRadius: 16 },
  nivelMarcado: { borderColor: cores.acao, backgroundColor: '#F3F6FF' },
  nivelTextos: { flex: 1, gap: 2 },
  nivelTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '900' },
  nivelTituloLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  // .nivel__agora: pílula verde-clara de 12/900.
  nivelAgora: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, backgroundColor: '#E3F6EA' },
  nivelAgoraTexto: { color: '#14513B', fontFamily: fontes.corpo, fontSize: 12, lineHeight: 18, fontWeight: '900' },
  // .publicacao__ainda: a nota em branco sobre a névoa da publicação.
  publicacaoAinda: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FFFFFF', color: cores.texto, fontFamily: fontes.corpo,
    fontSize: 16, lineHeight: 24, fontWeight: '800', overflow: 'hidden' },
  somenteLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  nivelTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 19.6 },
  publicacao: { gap: 14, padding: 14, borderRadius: 16, backgroundColor: cores.nevoa },
  acoesRecorte: { gap: 10, marginTop: 4 },

  previa: { gap: 10 },
  previaDe: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previaDeTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  previaTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  previaMeta: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  previaAcoes: { gap: 8, marginTop: 6, marginBottom: 2 },
  previaZero: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22.5 },
  previaPartes: { gap: 14, marginTop: 6 },
  previaParte: { marginBottom: 6, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 16, lineHeight: 20.8 },
  previaLicoes: { gap: 6 },
  previaLicao: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2,
    borderColor: cores.gelo, borderRadius: 14 },
  previaLicaoTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  situacao: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '900' },
  botaoAlto: { minHeight: 52 },

  porLinkAbrir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, minHeight: 44,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  // No pedido, 26 do último exemplo até "Adicionar por link" (o bloco das ideias já deixa 5), fechado ou aberto.
  porLinkNoPedido: { marginTop: 21 },
  porLinkAbrirTexto: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  porLink: { gap: 14, padding: 18, borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  porLinkTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  porLinkForm: { gap: 6 },
  porLinkLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  porLinkInativo: { gap: 4 },

  nomeLink: { color: cores.acao, textDecorationLine: 'underline' },
  cabecaSeguidores: { fontWeight: '900', color: cores.texto },
  seloDemo: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C9A227',
    borderRadius: 999, backgroundColor: '#FFFAEA' },
  seloDemoTexto: { color: '#6B4A00', fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '900' },
  // .publicacao__trocar: ficha tracejada, só o texto na cor de ação.
  trocarTema: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.bordaCampo,
    borderRadius: 999 },
  trocarTemaTexto: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  // Página /t: o Stu com o balão e o cartão "Quem compartilhou".
  previaStu: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 4 },
  previaBalao: { flex: 1, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2, borderColor: cores.gelo, borderRadius: 18,
    borderBottomLeftRadius: 6, backgroundColor: cores.ceu },
  previaBalaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 22.4, fontWeight: '800' },
  quem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: 4, padding: 16, borderWidth: 2, borderColor: cores.gelo, borderRadius: 18,
    backgroundColor: cores.nevoa },
  quemAvatar: { borderWidth: 3, borderColor: '#FFFFFF' },
  quemTexto: { flex: 1, gap: 2, minWidth: 0 },
  quemRotulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontWeight: '900', letterSpacing: 0.52, textTransform: 'uppercase' },
  quemNome: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 18, lineHeight: 27, fontWeight: '900' },
  quemResumo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 23.2 },
  quemLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
});
