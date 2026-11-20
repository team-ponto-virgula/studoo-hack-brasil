import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import {
  CAPAS_GALERIA, LIMITES_CAPA, LIMITES_COMUNIDADE, TEMAS, coresDaCapa, ehCapaFoto, enderecoCapa, motivoLegendaInvalida,
  motivoTituloTrilhaInvalido, normalizarResumoPerfil, normalizarTituloTrilha, svgCapa,
  type ConfiguracoesTrilha, type MudancaConfiguracoes, type Tema,
} from '@studoo/contratos';
import { fonteDaMidiaDaDona, origemConfigurada, type ClienteNativo } from './api-nativa';
import { AvisoMidiaEmRevisao, EstadoDaPublicacao } from './seguranca';
import { FIM_COM_BARRA } from './comunidade';
import { Icone } from './icone';
import { AvisoDoApp, Botao, BotaoIcone, Campo, FolhaDeAcoes, Tela, Titulo, degrade, degrauFora, useMovimentoReduzido } from './interface';
import { useDepoisDeSair } from './janelas';
import { mensagens } from './mensagens';
import { RecorteImagem, escolherImagem, type ImagemParaRecortar } from './recorte';
import { Esqueleto, Ficha, codigoDoErro, socialEstilos, textoDoErro } from './social';
import { tocaSons } from './sons';
import { cores, fontes, raios } from './tema';
import type { NomeIcone } from './trilha';

/*
 * Configurações da trilha no app, como `TelaConfiguracoes` da web (src/app/configuracoes.tsx), com as medidas da revisão
 * de design de 19/11 (spec 10, "Revisão de design: configurações da trilha, capas e selos sobre foto"): a capa na largura
 * da seção com "Trocar capa" por cima, o estado do salvamento no rótulo de cada campo e a galeria com o visto na capa
 * escolhida. Cada campo salva sozinho ao sair dele; o erro fica embaixo do campo; não há diálogo de sair sem salvar.
 * Só a dona chega aqui (a API recusa as outras).
 */

const k = mensagens.configuracoes;

type CampoDaTela = 'titulo' | 'descricao' | 'tema' | 'capa';
type Estado = 'livre' | 'salvando' | 'salvo';
const SEM_ESTADO: Record<CampoDaTela, Estado> = { titulo: 'livre', descricao: 'livre', tema: 'livre', capa: 'livre' };

/** Quanto o "Salvo" fica no rótulo e quanto leva para sair (spec 10, revisão de 19/11, item 2). */
const SALVO_VISIVEL_MS = 2500;
const SALVO_SAIDA_MS = 200;
/** A galeria fecha 300 ms depois da escolha, para o visto aparecer na capa nova (item 4). */
const GALERIA_FECHA_MS = 300;

function urlDaCapa(capa: string, grande: boolean) {
  try {
    return `${origemConfigurada().origin}${enderecoCapa(capa, grande ? LIMITES_CAPA.largura : LIMITES_CAPA.larguraPequena)}`;
  } catch {
    return null;
  }
}

/** O nome da capa para a tela e para o leitor: "Padrão", o nome da galeria ou "Sua foto". */
function nomeDaCapa(capa: string | null | undefined) {
  if (!capa) return k.capaPadrao;
  return ehCapaFoto(capa) ? k.suaFoto : k.capas[capa] ?? capa;
}

/**
 * A capa de uma trilha, decorativa: a foto (com o véu escuro só nos 45% de cima, onde ficam os selos), a capa da galeria
 * ou a padrão do tema, desenhadas com o SVG do contrato. O fundo já vem na cor da capa (`coresDaCapa`), para não piscar
 * branco enquanto o desenho chega.
 */
export function CapaDaTrilha({ semente, tema, capa, grande = false, estilo, daDona = false }: {
  /** A capa da própria pessoa: em revisão, ela só abre com a sessão (o token vai só para o host da API). */
  daDona?: boolean;
  semente: string;
  tema: Tema | null;
  capa: string | null | undefined;
  /** A imagem de 1024 (mapa e configurações); sem ele, a de 480 (cartões e galeria). */
  grande?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const foto = ehCapaFoto(capa) ? urlDaCapa(capa, grande) : null;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[confEstilos.capa, { backgroundColor: coresDaCapa(tema, capa).de }, estilo]}>
      {foto ? (
        <>
          <Image source={daDona ? fonteDaMidiaDaDona(foto) : { uri: foto }} accessible={false} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <View style={[confEstilos.capaVeu, degrade('linear-gradient(to bottom, rgba(15, 23, 42, 0.38), rgba(15, 23, 42, 0))')]} />
        </>
      ) : (
        <SvgXml xml={svgCapa({ codigo: semente, tema, capa: ehCapaFoto(capa) ? null : capa })} width="100%" height="100%" />
      )}
    </View>
  );
}

/** A engrenagem do alto do mapa, como `.trilha-configurar` da web: botão secundário de 48 × 48 com o ícone de 24 (traço 2). */
export function BotaoConfigurar({ titulo, acao, desativado = false }: { titulo: string; acao: () => void; desativado?: boolean }) {
  return (
    <Pressable testID="plano-configurar" accessibilityRole="button" accessibilityLabel={k.entradaRotulo(titulo)}
      accessibilityState={{ disabled: desativado }} disabled={desativado} onPress={acao}
      style={({ pressed }) => degrauFora(4, 16, cores.gelo, pressed)}>
      <View style={[confEstilos.engrenagem, desativado && confEstilos.engrenagemApagada]}>
        <Icone nome="engrenagem" tamanho={24} cor={desativado ? cores.textoSecundario : cores.acao} traco={2} />
      </View>
    </Pressable>
  );
}

/** O anel que gira enquanto um campo salva (14 px); parado com movimento reduzido. */
function Giro() {
  const reduzir = useMovimentoReduzido();
  const [volta] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduzir !== false) return;
    const ciclo = Animated.loop(Animated.timing(volta, { toValue: 1, duration: 800, easing: Easing.linear, isInteraction: false, useNativeDriver: true }));
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzir, volta]);
  return <Animated.View style={[confEstilos.giro, { transform: [{ rotate: volta.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />;
}

/**
 * O estado do salvamento no rótulo do campo, à direita: "Salvando…" com o giro e, depois, "Salvo" com o visto, que some
 * sozinho. Só visual: o leitor de tela ouve a frase do campo ("Nome da trilha salvo."), anunciada por quem salva.
 */
function EstadoDoCampo({ estado }: { estado: Estado }) {
  const reduzir = useMovimentoReduzido();
  const [opacidade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    opacidade.stopAnimation();
    opacidade.setValue(1);
    if (estado !== 'salvo' || reduzir !== false) return;
    const saida = Animated.timing(opacidade, { toValue: 0, duration: SALVO_SAIDA_MS, delay: SALVO_VISIVEL_MS - SALVO_SAIDA_MS, useNativeDriver: true });
    saida.start();
    return () => saida.stop();
  }, [estado, reduzir, opacidade]);
  if (estado === 'livre') return null;
  return (
    <Animated.View style={[confEstilos.estado, { opacity: opacidade }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {estado === 'salvando' ? <Giro /> : <Icone nome="check" tamanho={16} cor={cores.sucesso} />}
      <Text style={[confEstilos.estadoTexto, estado === 'salvando' && { color: cores.textoSecundario }]}>{estado === 'salvando' ? k.salvando : k.salvo}</Text>
    </Animated.View>
  );
}

/** O rótulo de um campo com o que vai à direita dele: o estado do salvamento ou, na descrição parada, o contador. */
function RotuloDoCampo({ rotulo, estado, direita }: { rotulo: string; estado: Estado; direita?: ReactNode }) {
  return (
    <View style={confEstilos.rotuloLinha}>
      <Text style={confEstilos.rotulo}>{rotulo}</Text>
      {estado === 'livre' ? direita : <EstadoDoCampo estado={estado} />}
    </View>
  );
}

function ErroDoCampo({ texto }: { texto: string }) {
  return (
    <View style={confEstilos.erroLinha}>
      <View style={confEstilos.erroIcone}><Icone nome="alerta" tamanho={16} cor={cores.erro} /></View>
      <Text accessibilityRole="alert" style={confEstilos.erroTexto}>{texto}</Text>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={confEstilos.secao}>
      <Text accessibilityRole="header" style={confEstilos.secaoTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

export function TelaConfiguracoes({ cliente, planoId, recebidaDe, compartilhar, acoes, desativado = false, voltar, aoMudar, mudarCompartilhamento, apagar, versao }: {
  cliente: ClienteNativo;
  planoId: string;
  /** Trilha adicionada de outra pessoa: o nome de quem compartilhou (a cópia é dela; não se compartilha de novo). */
  recebidaDe?: string | null;
  /** Com o compartilhar ligado: a seção "Quem pode ver". */
  compartilhar: boolean;
  /** As ações da barra da marca (o "Sair" ou o atalho do perfil), as mesmas das outras telas. */
  acoes?: ReactNode;
  /** Enquanto outra ação da tela de estudo corre (apagar a trilha, abrir outra). */
  desativado?: boolean;
  voltar: () => void;
  /** Nome, capa ou tema mudaram: a lista e o mapa mostram o novo. */
  aoMudar: (configuracoes: ConfiguracoesTrilha) => void;
  mudarCompartilhamento: () => void;
  apagar: () => void;
  /** Muda quando a folha de compartilhar fecha: a linha de "Quem pode ver" relê o estado. */
  versao: number;
}) {
  const [conf, setConf] = useState<ConfiguracoesTrilha | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [erros, setErros] = useState<Partial<Record<CampoDaTela, string>>>({});
  const [estados, setEstados] = useState(SEM_ESTADO);
  const [galeria, setGaleria] = useState(false);
  /** "Usar uma foto": a folha com galeria e câmera (em tela de toque) e, escolhida a imagem, o recorte 2:1 do Studoo. */
  const [origemDaFoto, setOrigemDaFoto] = useState(false);
  const [paraRecortar, setParaRecortar] = useState<ImagemParaRecortar | null>(null);
  const { avisar } = useContext(AvisoDoApp);
  // Como no perfil: "Tirar foto" só em tela de toque (no aparelho, sempre); no computador, o seletor abre direto.
  const toque = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);

  // O que está na tela agora, para salvar o que ficou pendente quando a pessoa sai sem tirar o foco do campo (no app,
  // tocar em "Voltar" ou na barra de baixo não tira o foco sozinho, como o clique faz na web).
  const montada = useRef(true);
  const atual = useRef({ conf, titulo, descricao });
  atual.current = { conf, titulo, descricao };
  const emEnvio = useRef<Partial<Record<CampoDaTela, boolean>>>({});
  const relogios = useRef<Partial<Record<CampoDaTela, ReturnType<typeof setTimeout>>>>({});

  useEffect(() => {
    let ativo = true;
    cliente.obterConfiguracoes(planoId).then((dados) => {
      if (!ativo) return;
      // Relê ao voltar da folha de compartilhar (versao); os campos em edição ficam como estão.
      if (!atual.current.conf) { setTitulo(dados.titulo); setDescricao(dados.descricao ?? ''); }
      setConf(dados);
    }).catch((falha) => { if (ativo) setErroCarregar(codigoDoErro(falha)); });
    return () => { ativo = false; };
  }, [cliente, planoId, versao]);

  function marcar(campo: CampoDaTela, estado: Estado) {
    clearTimeout(relogios.current[campo]);
    if (!montada.current) return;
    setEstados((antes) => ({ ...antes, [campo]: estado }));
    if (estado === 'salvo') relogios.current[campo] = setTimeout(() => marcar(campo, 'livre'), SALVO_VISIVEL_MS);
  }

  async function salvar(campo: CampoDaTela, mudanca: MudancaConfiguracoes): Promise<boolean> {
    if (emEnvio.current[campo]) return false;
    emEnvio.current[campo] = true;
    marcar(campo, 'salvando');
    if (montada.current) setErros((antes) => ({ ...antes, [campo]: undefined }));
    try {
      const novo = await cliente.salvarConfiguracoes(planoId, mudanca);
      aoMudar(novo);
      if (montada.current) setConf(novo);
      marcar(campo, 'salvo');
      // O aviso do app já lê "Capa salva."; nos outros campos, o leitor de tela ouve a frase do campo.
      if (campo !== 'capa' && montada.current) AccessibilityInfo.announceForAccessibility(k.salvoLeitor[campo]);
      // Spec 12: salvar um campo alterado toca "salvo" (só se chega aqui com mudança). A capa toca pelo aviso "Capa salva.".
      if (campo !== 'capa') void tocaSons.tocarEfeito('salvo');
      return true;
    } catch (falha) {
      if (montada.current) setErros((antes) => ({ ...antes, [campo]: textoDoErro(codigoDoErro(falha)) }));
      marcar(campo, 'livre');
      return false;
    } finally {
      emEnvio.current[campo] = false;
    }
  }

  function sairDoTitulo() {
    const { conf: salvo, titulo: escrito } = atual.current;
    if (!salvo) return;
    const normal = normalizarTituloTrilha(escrito);
    if (normal === salvo.titulo) { if (montada.current) setTitulo(salvo.titulo); return; }
    const motivo = motivoTituloTrilhaInvalido(normal);
    if (motivo) { if (montada.current) setErros((antes) => ({ ...antes, titulo: k.nomeErros[motivo] })); return; }
    if (montada.current) setTitulo(normal);
    void salvar('titulo', { titulo: normal });
  }

  function sairDaDescricao() {
    const { conf: salvo, descricao: escrita } = atual.current;
    if (!salvo) return;
    const normal = normalizarResumoPerfil(escrita);
    if (normal === (salvo.descricao ?? '')) return;
    const motivo = motivoLegendaInvalida(normal);
    if (motivo) { if (montada.current) setErros((antes) => ({ ...antes, descricao: mensagens.comunidade.legendaErros[motivo] })); return; }
    if (montada.current) setDescricao(normal);
    void salvar('descricao', { descricao: normal || null });
  }

  /** A galeria ou a câmera do sistema (P18); o recorte é o do Studoo. */
  async function buscarFoto(camera: boolean) {
    setErros((antes) => ({ ...antes, capa: undefined }));
    try {
      const imagem = await escolherImagem(camera);
      if (imagem && montada.current) setParaRecortar(imagem);
    } catch {
      if (montada.current) setErros((antes) => ({ ...antes, capa: mensagens.perfil.fotoIlegivel }));
    }
  }

  async function enviarFoto(base64: string) {
    const novo = await cliente.enviarCapa(planoId, base64);
    aoMudar(novo);
    if (montada.current) { setConf(novo); setParaRecortar(null); }
    // Spec 14: a foto nova fica em revisão; o aviso nunca diz que ela já aparece para os outros.
    avisar(novo.capaModeracao === 'pendente' ? mensagens.seguranca.enviadaParaRevisao : k.capaSalva, { icone: 'check', som: 'salvo' });
  }

  // Ao sair da tela (Voltar, barra de baixo, voltar do aparelho), o que ficou escrito e ainda vale é salvo.
  const aoSair = useRef(() => undefined as void);
  aoSair.current = () => { sairDoTitulo(); sairDaDescricao(); };
  useEffect(() => {
    const pendentes = relogios.current;
    return () => {
      montada.current = false;
      for (const relogio of Object.values(pendentes)) clearTimeout(relogio);
      aoSair.current();
    };
  }, []);

  if (erroCarregar) {
    return (
      <Tela pagina="configuracoes" acoes={acoes} estiloConteudo={FIM_COM_BARRA}>
        <View style={confEstilos.painel}>
          <Voltar acao={voltar} />
          <Text accessibilityRole="alert" style={socialEstilos.erro}>{textoDoErro(erroCarregar)}</Text>
        </View>
      </Tela>
    );
  }

  const usados = [...normalizarResumoPerfil(descricao)].length;
  const comp = conf?.compartilhamento ?? null;
  const iconeDoNivel: NomeIcone = !comp || comp.moderacao === 'recusado' ? 'cadeado' : comp.visibilidade === 'explorar' ? 'bussola' : comp.visibilidade === 'perfil' ? 'pessoa' : 'elo';
  // Sem tema escolhido, o sugerido pelo título já vem marcado (a lista fechada do Web & API).
  const temaMarcado = conf ? conf.tema ?? conf.temaSugerido : null;

  return (
    <Tela pagina="configuracoes" acoes={acoes} estiloConteudo={FIM_COM_BARRA}>
      <View style={confEstilos.painel}>
        <View style={confEstilos.topo}>
          <Voltar acao={() => { Keyboard.dismiss(); voltar(); }} />
          <Titulo testID="titulo-configuracoes" foco>{k.titulo}</Titulo>
        </View>

        {!conf ? (
          <View style={confEstilos.secao} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Esqueleto /></View>
        ) : (
          <>
            {recebidaDe ? <Text testID="configuracoes-recebida" style={confEstilos.recebida}>{k.recebida(recebidaDe)}</Text> : null}

            <Secao titulo={k.capaENome}>
              {/* A capa na largura da seção; tocar em qualquer ponto dela abre a galeria, e "Trocar capa" mostra isso. */}
              <View>
                <Pressable testID="configuracoes-capa" accessibilityRole="button" accessibilityLabel={k.trocarCapaRotulo(nomeDaCapa(conf.capa))}
                  disabled={desativado} onPress={() => { Keyboard.dismiss(); setGaleria(true); }}
                  style={({ pressed }) => [confEstilos.previa, pressed && { opacity: 0.9 }]}>
                  <CapaDaTrilha semente={conf.semente} tema={conf.tema} capa={conf.capa} grande estilo={StyleSheet.absoluteFill} daDona={!recebidaDe} />
                  <View style={confEstilos.trocar}>
                    <Icone nome="imagem" tamanho={18} cor={cores.acaoEscura} traco={2.4} />
                    <Text style={confEstilos.trocarTexto}>{k.trocarCapa}</Text>
                  </View>
                </Pressable>
                {erros.capa && <ErroDoCampo texto={erros.capa} />}
                <AvisoMidiaEmRevisao tipo="capa" moderacao={conf.capaModeracao} />
              </View>

              <View style={confEstilos.campo}>
                <RotuloDoCampo rotulo={k.nomeRotulo} estado={estados.titulo} />
                <Campo rotulo={k.nomeRotulo} rotuloOculto erroComAlerta testID="configuracoes-nome" value={titulo} maxLength={120} autoComplete="off"
                  autoCapitalize="sentences" returnKeyType="done" submitBehavior="blurAndSubmit" editable={!desativado} erro={erros.titulo}
                  accessibilityHint={erros.titulo ? undefined : k.nomeDica}
                  onChangeText={(texto) => { setTitulo(texto); if (erros.titulo) setErros((antes) => ({ ...antes, titulo: undefined })); }}
                  onBlur={sairDoTitulo} />
                {/* A dica some enquanto o erro estiver na tela. */}
                {!erros.titulo && <Text style={confEstilos.dica}>{k.nomeDica}</Text>}
              </View>

              <View style={confEstilos.campo}>
                <RotuloDoCampo rotulo={k.descricaoRotulo} estado={estados.descricao} direita={(
                  <Text importantForAccessibility="no" accessibilityElementsHidden
                    style={[socialEstilos.contador, usados > LIMITES_COMUNIDADE.legendaMax && { color: cores.erro }]}>
                    {mensagens.perfil.resumoContador(usados, LIMITES_COMUNIDADE.legendaMax)}
                  </Text>
                )} />
                <Campo rotulo={k.descricaoRotulo} rotuloOculto erroComAlerta testID="configuracoes-descricao" value={descricao} multiline numberOfLines={2}
                  maxLength={220} editable={!desativado} erro={erros.descricao} style={confEstilos.descricao}
                  accessibilityHint={`${erros.descricao ? '' : `${k.descricaoDica} `}${mensagens.perfil.resumoContadorLeitor(LIMITES_COMUNIDADE.legendaMax - usados)}`}
                  onChangeText={(texto) => { setDescricao(texto.replace(/[\r\n]+/g, ' ')); if (erros.descricao) setErros((antes) => ({ ...antes, descricao: undefined })); }}
                  onBlur={sairDaDescricao} />
                {!erros.descricao && <Text style={confEstilos.dica}>{k.descricaoDica}</Text>}
              </View>

              <View style={confEstilos.campo}>
                <View style={confEstilos.rotuloComAjuda}>
                  <RotuloDoCampo rotulo={k.temaRotulo} estado={estados.tema} />
                  <Text style={confEstilos.dica}>{k.temaDica}</Text>
                </View>
                <View testID="configuracoes-temas" accessibilityRole="radiogroup" accessibilityLabel={k.temaRotulo} style={socialEstilos.fichas}>
                  {TEMAS.map((tema) => (
                    <Ficha key={tema} papel="radio" rotulo={mensagens.temas[tema]} marcada={temaMarcado === tema}
                      complemento={!conf.tema && tema === conf.temaSugerido ? mensagens.comunidade.temaSugerido : undefined}
                      aoTocar={() => { if (!desativado && conf.tema !== tema) void salvar('tema', { tema }); }} />
                  ))}
                </View>
                {erros.tema && <ErroDoCampo texto={erros.tema} />}
              </View>
            </Secao>

            {compartilhar && !recebidaDe && (
              <Secao titulo={k.quemPodeVer}>
                <View style={confEstilos.linha}>
                  <Icone nome={iconeDoNivel} tamanho={20} cor={cores.acao} />
                  <Text testID="configuracoes-quem" style={confEstilos.linhaTexto}>
                    {/* Em revisão, o destino "depois da aprovação"; não publicada, só a dona vê (Lead e Designer, 20/11). */}
                    {!comp || comp.moderacao === 'recusado' ? k.soVoce
                      : k.estadoCompartilhamento(comp.moderacao === 'pendente'
                        ? mensagens.seguranca.destinoDepoisDaAprovacao(mensagens.comunidade.niveis[comp.visibilidade].titulo)
                        : mensagens.comunidade.niveis[comp.visibilidade].titulo, comp.estudando, comp.valeus)}
                  </Text>
                </View>
                {comp && <EstadoDaPublicacao moderacao={comp.moderacao} testID="configuracoes-moderacao" />}
                <Botao rotulo={k.mudarCompartilhamento} iconeAntes="compartilhar" variante="secundario" testID="configuracoes-compartilhar"
                  desativado={desativado} acao={() => { Keyboard.dismiss(); mudarCompartilhamento(); }} estilo={confEstilos.botao} />
              </Secao>
            )}

            <Secao titulo={k.apagarTitulo}>
              <Text style={confEstilos.dica}>{k.apagarDica}</Text>
              <Botao rotulo={k.apagar} iconeAntes="lixeira" variante="destrutivo" testID="configuracoes-apagar" desativado={desativado}
                acao={() => { Keyboard.dismiss(); apagar(); }} estilo={confEstilos.botao} />
            </Secao>
          </>
        )}
      </View>

      {conf && (
        <GaleriaDeCapas visivel={galeria} atual={conf.capa} semente={conf.semente} tema={conf.tema} aoFechar={() => setGaleria(false)}
          // A foto usa a mesma flag da foto do perfil (com o compartilhar ligado).
          aoUsarFoto={compartilhar ? () => (toque ? setOrigemDaFoto(true) : void buscarFoto(false)) : undefined}
          aoEscolher={async (capa) => {
            const salvou = await salvar('capa', { capa });
            if (salvou) avisar(k.capaSalva, { icone: 'check', som: 'salvo' });
            return salvou;
          }} />
      )}
      <FolhaDeAcoes visivel={origemDaFoto} titulo={k.usarFoto} cancelarRotulo={mensagens.perfil.fotoMenuCancelar} testID="folha-capa-foto"
        aoFechar={() => setOrigemDaFoto(false)}
        acoes={[
          { rotulo: mensagens.perfil.fotoGaleria, icone: 'imagem', testID: 'capa-foto-galeria', aoEscolher: () => void buscarFoto(false) },
          { rotulo: mensagens.perfil.fotoCamera, icone: 'camera', testID: 'capa-foto-camera', aoEscolher: () => void buscarFoto(true) },
        ]} />
      {paraRecortar && (
        // A foto da capa: o mesmo recorte do perfil, na proporção da capa (2:1), com a área dos selos marcada.
        <RecorteImagem imagem={paraRecortar} proporcao={2} titulo={k.capaFotoTitulo} dica={k.capaFotoDica} aviso={k.capaFotoAviso} comSelos
          aoCancelar={() => setParaRecortar(null)} enviar={enviarFoto} />
      )}
    </Tela>
  );
}

/**
 * O "Voltar" do alto, como `.configuracoes__voltar`: seta de 20 e texto 800 de 16, em 48 de altura. Como todo botão de
 * texto do app (spec 04, banca da noite §9), o toque cresce 12 por fora, sem mudar o desenho: mesmo contando só a parte
 * que fica dentro da coluna (os 8 da margem negativa ficam fora dela), o alvo passa de 44 × 44.
 */
function Voltar({ acao }: { acao: () => void }) {
  return (
    <Pressable testID="configuracoes-voltar" accessibilityRole="button" onPress={acao} hitSlop={12}
      style={({ pressed }) => [confEstilos.voltar, pressed && { opacity: 0.7 }]}>
      <Icone nome="setaVoltar" tamanho={20} cor={cores.acao} />
      <Text style={confEstilos.voltarTexto}>{k.voltar}</Text>
    </Pressable>
  );
}

/**
 * A galeria de capas, numa folha do Studoo (spec 11): "Sua foto" (quando a capa é uma foto), a padrão do tema e as 12
 * prontas, em duas colunas (três a partir de 600 de largura). É um grupo de escolha única: a escolhida tem a borda azul e
 * o visto no canto; escolher salva, mostra o visto na capa nova e fecha a folha em 300 ms.
 */
function GaleriaDeCapas({ visivel, atual, semente, tema, aoFechar, aoEscolher, aoUsarFoto }: {
  /** A folha fica montada e só liga e desliga: no iPhone, o que abre depois dela (a galeria de fotos) espera a folha sair. */
  visivel: boolean;
  atual: string | null;
  semente: string;
  tema: Tema | null;
  aoFechar: () => void;
  /** "Usar uma foto": fecha a folha e abre a escolha da foto. Sem ele (compartilhar desligado), o botão não aparece. */
  aoUsarFoto?: () => void;
  /** Salva a capa escolhida; devolve se salvou (com erro, a folha continua aberta para outra tentativa). */
  aoEscolher: (capa: string | null) => Promise<boolean>;
}) {
  const margens = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const [subida] = useState(() => new Animated.Value(0));
  const [largura, setLargura] = useState(0);
  const [marcada, setMarcada] = useState<string | null>(atual);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  const aberta = useRef(visivel);
  aberta.current = visivel;
  // A cada abertura: a folha sobe de novo e mostra a capa de agora.
  useEffect(() => {
    if (!visivel) return;
    setMarcada(atual);
    setEnviando(false);
    setErro(false);
    subida.setValue(0);
    const entrada = Animated.timing(subida, { toValue: 1, duration: reduzir !== false ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    entrada.start();
    return () => entrada.stop();
    // Só ao abrir: a capa muda durante a escolha, e a folha não recomeça por isso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, reduzir, subida]);

  const opcoes: { id: string | null; nome: string; dica?: string }[] = [
    ...(ehCapaFoto(atual) ? [{ id: atual, nome: k.suaFoto }] : []),
    { id: null, nome: k.capaPadrao, dica: k.capaPadraoDoTema },
    ...CAPAS_GALERIA.map((capa) => ({ id: capa.id as string, nome: k.capas[capa.id] ?? capa.id })),
  ];
  const colunas = largura >= 600 ? 3 : 2;
  const ladoDaCapa = largura > 0 ? (largura - VAO_DA_GRADE * (colunas - 1)) / colunas : 0;

  async function escolher(id: string | null) {
    if (enviando) return;
    if (id === atual) { aoFechar(); return; }
    const inicio = Date.now();
    setErro(false);
    setMarcada(id);
    setEnviando(true);
    const salvou = await aoEscolher(id);
    if (!aberta.current) return;
    if (!salvou) { setMarcada(atual); setEnviando(false); setErro(true); return; }
    // O visto fica na capa nova pelo menos 300 ms antes de a folha fechar.
    setTimeout(() => { if (aberta.current) aoFechar(); }, Math.max(0, GALERIA_FECHA_MS - (Date.now() - inicio)));
  }

  return (
    <Modal transparent visible={visivel} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => { if (!enviando) aoFechar(); }}
      onDismiss={aoSair}>
      <View style={confEstilos.folhaFundo}>
        <Pressable testID="galeria-fundo" accessible={false} style={StyleSheet.absoluteFill} onPress={() => { if (!enviando) aoFechar(); }} />
        <Animated.View testID="galeria-capas" accessibilityViewIsModal style={[confEstilos.folha, { paddingBottom: 20 + margens.bottom, opacity: subida,
          transform: [{ translateY: reduzir !== false ? 0 : subida.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
          <View style={confEstilos.folhaAlca} />
          <View style={confEstilos.folhaTopo}>
            <Text accessibilityRole="header" style={confEstilos.folhaTitulo}>{k.capaTitulo}</Text>
            <BotaoIcone icone="fechar" rotulo={mensagens.compartilhar.fechar} testID="galeria-fechar" desativado={enviando} acao={aoFechar} />
          </View>
          {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{mensagens.erros.falha}</Text>}
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={confEstilos.folhaConteudo}>
            {aoUsarFoto && (
              // O botão ocupa a largura da folha, e a ajuda vai embaixo, numa linha só (revisão de 19/11, item 3).
              <View style={confEstilos.usarFoto}>
                <Botao rotulo={k.usarFoto} iconeAntes="camera" variante="secundario" testID="capa-usar-foto" desativado={enviando}
                  acao={() => { aoFechar(); depoisDeSair(aoUsarFoto); }} />
                <Text style={confEstilos.dica}>{k.usarFotoAjuda}</Text>
              </View>
            )}
            <View accessibilityRole="radiogroup" accessibilityLabel={k.capaTitulo} style={confEstilos.grade}
              onLayout={(evento: LayoutChangeEvent) => setLargura(evento.nativeEvent.layout.width)}>
              {ladoDaCapa > 0 && opcoes.map((opcao) => {
                const escolhida = marcada === opcao.id;
                return (
                  <Pressable key={opcao.id ?? 'padrao'} testID={`capa-${opcao.id === null ? 'padrao' : ehCapaFoto(opcao.id) ? 'foto' : opcao.id}`}
                    accessibilityRole="radio" accessibilityLabel={opcao.dica ? `${opcao.nome}, ${opcao.dica}` : opcao.nome}
                    accessibilityState={{ selected: escolhida, checked: escolhida, disabled: enviando }} disabled={enviando}
                    onPress={() => void escolher(opcao.id)} style={({ pressed }) => [{ width: ladoDaCapa }, confEstilos.opcao, pressed && { opacity: 0.85 }]}>
                    {/* O anel fica por fora do desenho: 2 de gelo; na escolhida, 3 de azul, com o visto no canto. */}
                    <View style={[confEstilos.opcaoAnel, escolhida && confEstilos.opcaoAnelMarcado]}>
                      <CapaDaTrilha semente={semente} tema={tema} capa={opcao.id} estilo={confEstilos.opcaoCapa} />
                      {escolhida && (
                        <View style={confEstilos.visto}><Icone nome="check" tamanho={16} cor="#FFFFFF" traco={3} /></View>
                      )}
                    </View>
                    <Text style={confEstilos.opcaoNome}>{opcao.nome}</Text>
                    {opcao.dica && <Text style={confEstilos.opcaoDica}>{opcao.dica}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const VAO_DA_GRADE = 12;

const confEstilos = StyleSheet.create({
  // .painel--configuracoes: 20 entre os blocos; o alto tem 2 entre o "Voltar" e o título.
  painel: { gap: 20 },
  topo: { gap: 2 },
  // .configuracoes__voltar é um botão de texto: 44 de altura e 8 dos lados, mais a borda transparente de 2 (48 e 10).
  voltar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 48, marginLeft: -8, paddingHorizontal: 10 },
  voltarTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  recebida: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: cores.ceu,
    color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 23.2,
  },
  // .configuracoes__secao: borda de 2, raio de 20 (o --raio-bloco da web), 18 de respiro e 14 entre os itens.
  secao: { gap: 14, padding: 18, borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  secaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  // A prévia da capa (revisão de 19/11, item 5): a largura da seção, em 2:1 e raio de 16.
  previa: { aspectRatio: 2, borderRadius: 16, overflow: 'hidden' },
  capa: { overflow: 'hidden' },
  // O véu só em foto, nos 45% de cima (item 6).
  capaVeu: { position: 'absolute', left: 0, right: 0, top: 0, height: '45%' },
  // "Trocar capa": pílula branca de 40, a 10 do canto de baixo à direita, com a sombra 0 2px 8px rgba(15, 23, 42, .25).
  trocar: {
    position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14,
    borderRadius: raios.pilula, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  trocarTexto: { color: cores.acaoEscura, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20 },
  // .campo da web: 8 entre o rótulo, a caixa e a ajuda. No tema, a ajuda fica a 4 do rótulo (a margem da legenda).
  campo: { gap: 8 },
  rotuloComAjuda: { gap: 4 },
  // O rótulo dos campos da web: 14/21 em 800.
  rotuloLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, minHeight: 21 },
  rotulo: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  // "Salvando…" e "Salvo": 13 px 800, verde #1F7A5A no salvo (item 2).
  estado: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  estadoTexto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  giro: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: cores.gelo, borderTopColor: cores.textoSecundario },
  dica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '400', fontSize: 14, lineHeight: 20.3 },
  // A descrição tem duas linhas de altura, como o textarea da web (72 no mínimo).
  descricao: { minHeight: 72 },
  erroLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  erroIcone: { marginTop: 2 },
  erroTexto: { flexShrink: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  // .configuracoes__linha: ícone de 20 em azul e o texto 800.
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaTexto: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  botao: { alignSelf: 'flex-start' },
  // A face do botão secundário (borda de 2 e raio de 16), num quadrado de 48.
  engrenagem: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 16, borderColor: cores.gelo, backgroundColor: cores.fundo },
  engrenagemApagada: { backgroundColor: cores.nevoa },
  // A folha da galeria (spec 11): sobe de baixo, com a alça de 40 × 5, raio de 24 no alto e até 92% da altura.
  folhaFundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  folha: {
    width: '100%', maxWidth: 640, maxHeight: '92%', alignSelf: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 16,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo,
  },
  folhaAlca: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: cores.bordaCampo },
  folhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // .folha-titulo da web: 22/27,5.
  folhaTitulo: { flexShrink: 1, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 27.5, letterSpacing: -0.33 },
  folhaConteudo: { gap: 14, paddingBottom: 4 },
  usarFoto: { gap: 6 },
  // A grade: 12 entre as colunas e 14 entre as linhas.
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: VAO_DA_GRADE, rowGap: 14 },
  opcao: { gap: 6 },
  opcaoAnel: { borderRadius: 14, borderWidth: 2, borderColor: cores.gelo, padding: 1 },
  opcaoAnelMarcado: { borderWidth: 3, borderColor: cores.acao, padding: 0 },
  opcaoCapa: { aspectRatio: 2, borderRadius: 11 },
  // O visto da capa escolhida (item 4): círculo de 24 em azul, contorno branco de 2, a 6 do canto de cima à direita.
  visto: {
    position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.acao, borderWidth: 2, borderColor: cores.fundo,
  },
  opcaoNome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 18 },
  // "Do tema", embaixo de "Padrão" (item 7): 13 px 700 em cinza.
  opcaoDica: { marginTop: -4, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
});
