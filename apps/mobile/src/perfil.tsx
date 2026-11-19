import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  LADO_ENVIO_FOTO, LIMITES_FOTO, LIMITES_PERFIL, TEMAS, motivoNomeInvalido, motivoResumoInvalido, normalizarNomePerfil, normalizarResumoPerfil,
  type CartaoTrilha, type CorPerfil, type LinkCompartilhado, type Perfil, type Tema,
} from '@studoo/contratos';
import type { ClienteNativo } from './api-nativa';
import { CartoesDoPerfil, FIM_COM_BARRA, NovidadesDoPerfil } from './comunidade';
import { Icone } from './icone';
import { Botao, Campo, CartaoConfirmacao, Tela, Titulo, estilos } from './interface';
import { mensagens } from './mensagens';
import {
  Avatar, BotaoParar, CabecalhoPerfil, Chave, Contador, CoresDoPerfil, Esqueleto, Ficha, FolhaCompartilhar, SeloVisibilidade, Status, abrirNoNavegador,
  codigoDoErro, compartilharNoSistema, copiar, dataCurta, focarSemRolar, socialEstilos, temFolhaDoSistema, textoDoErro, urlDoLink, urlDoPerfil,
} from './social';
import { cores, fontes } from './tema';

/*
 * Perfil rico (spec 10, etapa A) no app, espelhando src/app/perfil.tsx da web em a4c70cf: a tela Perfil (cabeçalho, trilhas
 * compartilhadas com o nível de cada uma, perfil público, conta e Sair) e a tela "Editar perfil". A foto vem da galeria ou da
 * câmera com o recorte quadrado do sistema (na web, o recorte é do próprio Studoo) e sai em JPEG de até 1024 px, como na web.
 */

const m = mensagens.compartilhar;
const p = mensagens.perfil;
const cm = mensagens.comunidade;

function anunciar(texto: string) {
  setTimeout(() => AccessibilityInfo.announceForAccessibility(texto), 0);
}
const trocarStatus = (anterior: string, novo: string) => (anterior === novo ? `${novo} ` : novo);

/** "Compartilhar perfil": a folha do sistema quando existe; senão, copia o endereço de /p, como `BotaoCompartilharPerfil`. */
function BotaoCompartilharPerfil({ perfilId, nome, aoStatus }: { perfilId: string; nome: string; aoStatus: (texto: string) => void }) {
  async function compartilhar() {
    const url = urlDoPerfil(perfilId);
    if (temFolhaDoSistema()) {
      await compartilharNoSistema(p.paginaTitulo(nome), p.textoCompartilharPerfil(nome), url);
      return;
    }
    const ok = await copiar(url);
    aoStatus(ok ? p.linkPerfilCopiado : m.copiarFalhou);
    anunciar(ok ? p.linkPerfilCopiado : m.copiarFalhou);
  }
  return <Botao rotulo={p.compartilharPerfil} iconeAntes="compartilhar" variante="secundario" testID="perfil-compartilhar" acao={() => void compartilhar()} />;
}

/** Título de seção do Perfil (`.perfil-secao__titulo`, 18 px). */
function TituloSecao({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={perfilEstilos.secaoTitulo}>{children}</Text>;
}

/**
 * Tela Perfil, como `TelaPerfil` da web em 6122cc2 (lote 4: direto nos dados, sem tela de convite): sem nome, os campos já vêm
 * abertos ali mesmo; com nome, o cartão como os outros veem, com "Editar" (abre os mesmos campos no lugar do cartão) e
 * "Compartilhar perfil", e as Novidades logo abaixo dele (com a comunidade). Depois, as trilhas que a pessoa compartilha
 * (com o total no título), os cartões "Como os outros veem" (com a comunidade), o perfil público, a conta e "Sair".
 */
export function TelaPerfil({ cliente, perfil: inicial, comunidade, acoes, aoMudarPerfil, aoMudarLink, abrirPlano, sair, desativado, aoAdicionado,
  abrirPrevia, abrirPerfil, registrarGuarda, irParaTrilhas }: {
  cliente: ClienteNativo;
  perfil: Perfil | null;
  comunidade: boolean;
  acoes?: ReactNode;
  aoMudarPerfil: (perfil: Perfil) => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  abrirPlano: (id: string) => void;
  sair: () => void;
  desativado: boolean;
  /** Os cartões "Como os outros veem" (com a comunidade): as mesmas ações do Explorar. */
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  abrirPrevia: (codigo: string) => void;
  abrirPerfil: (perfilId: string) => void;
  /**
   * Guarda de saída do editor, como a web: qualquer navegação (a barra de baixo, o voltar do aparelho e o gesto do iPhone)
   * passa por ela e, com alteração não salva, recebe a confirmação do app. Devolve true quando segurou a saída.
   */
  registrarGuarda: (guarda: ((continuar: () => void) => boolean) | null) => void;
  /** O vazio de "Trilhas que você compartilha" leva a Minhas trilhas. */
  irParaTrilhas: () => void;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [parando, setParando] = useState<LinkCompartilhado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState('');
  const [statusPerfil, setStatusPerfil] = useState('');
  const [folha, setFolha] = useState<string | null>(null);
  const [cartoes, setCartoes] = useState<CartaoTrilha[] | null>(null);
  // Com dados, o bloco mostra o perfil como os outros veem; "Editar" abre os campos ali mesmo (como a web).
  const [editando, setEditando] = useState(false);
  // A barra de salvar do editor fica presa embaixo, acima da barra de abas (na web, `position: sticky` no fim do bloco).
  const [rodapeDoEditor, setRodapeDoEditor] = useState<ReactNode>(null);
  const assinaturaLinks = perfil?.links.map((link) => `${link.codigo}:${link.visibilidade ?? link.noPerfil}:${link.tema ?? ''}:${link.legenda ?? ''}`).join('|') ?? '';
  const comEditor = Boolean(perfil && !perfil.visitante && (!perfil.nome || editando));

  // Os cartões como aparecem na página pública (com a comunidade e perfil público); recarrega quando os links mudam. Como a web.
  useEffect(() => {
    if (!comunidade || !perfil?.publico || !perfil.perfilId) { setCartoes(null); return; }
    let ativo = true;
    cliente.perfilPublico(perfil.perfilId).then((dados) => { if (ativo) setCartoes(dados.cartoes ?? null); }).catch(() => { if (ativo) setCartoes(null); });
    return () => { ativo = false; };
  }, [cliente, comunidade, perfil?.publico, perfil?.perfilId, assinaturaLinks]);

  useEffect(() => {
    let ativo = true;
    cliente.obterPerfil().then((dados) => { if (ativo) { setPerfil(dados); aoMudarPerfil(dados); } })
      .catch((falha) => { if (ativo) setErro(codigoDoErro(falha)); });
    return () => { ativo = false; };
    // Recarrega ao abrir a tela (as adições e os links podem ter mudado), como na web.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarLink(antigo: LinkCompartilhado, novo: LinkCompartilhado | null) {
    setPerfil((atual) => {
      if (!atual) return atual;
      const links = novo ? atual.links.map((item) => (item.codigo === antigo.codigo ? novo : item)) : atual.links.filter((item) => item.codigo !== antigo.codigo);
      // O alcance do cartão é o da página pública: só as trilhas no perfil (o total vai no título da seção).
      const noPerfil = links.filter((item) => item.noPerfil);
      return { ...atual, links, publico: noPerfil.length > 0, alcance: { ...atual.alcance, trilhas: noPerfil.length, pessoas: noPerfil.reduce((t, l) => t + l.adicoes, 0) } };
    });
    aoMudarLink(antigo.planoId, novo);
  }

  async function alterar(link: LinkCompartilhado, noPerfil: boolean) {
    setOcupado(true);
    try { trocarLink(link, await cliente.alterarLink(link.codigo, noPerfil)); } catch (falha) { setErro(codigoDoErro(falha)); } finally { setOcupado(false); }
  }

  async function copiarLink(link: LinkCompartilhado) {
    const ok = await copiar(urlDoLink(link.codigo));
    setCopiado((anterior) => (ok ? trocarStatus(anterior, m.copiado) : m.copiarFalhou));
    anunciar(ok ? m.copiado : m.copiarFalhou);
  }

  async function confirmarParada() {
    if (!parando) return;
    setOcupado(true);
    try {
      await cliente.encerrarLink(parando.codigo);
      trocarLink(parando, null);
      anunciar(m.parado);
      setParando(null);
    } catch (falha) {
      setErro(codigoDoErro(falha));
      setParando(null);
    } finally {
      setOcupado(false);
    }
  }

  function mudarPerfil(novo: Perfil) {
    setPerfil(novo);
    aoMudarPerfil(novo);
  }

  return (
    <Tela pagina="perfil" acoes={acoes} estiloConteudo={FIM_COM_BARRA}
      rodape={comEditor && rodapeDoEditor ? rodapeDoEditor : undefined} estiloRodapeConteudo={comEditor ? perfilEstilos.barraConteudo : undefined}>
      <View style={perfilEstilos.painel}>
        <Titulo testID="titulo-perfil" foco>{p.titulo}</Titulo>
        {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{textoDoErro(erro)}</Text>}
        {!perfil && !erro && (
          <View style={socialEstilos.cabeca} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={[socialEstilos.cabecaFaixa, { backgroundColor: cores.gelo }]} />
            <Esqueleto estilo={{ padding: 18 }} />
          </View>
        )}
        {perfil && (
          <>
            {perfil.visitante ? (
              <View style={perfilEstilos.cartao}><Text style={estilos.texto}>{p.visitante}</Text></View>
            ) : comEditor ? (
              // Sem tela de convite: sem nome, os campos já vêm abertos; com nome, "Editar" abre os mesmos campos aqui.
              <EditorPerfil key={editando ? 'editar' : 'dados'} cliente={cliente} perfil={perfil} aoMudarPerfil={mudarPerfil} registrarGuarda={registrarGuarda}
                definirRodape={setRodapeDoEditor}
                aoFechar={perfil.nome ? () => setEditando(false) : undefined} />
            ) : (
              <>
                <CabecalhoPerfil nome={perfil.nome ?? ''} cor={perfil.cor ?? 'azul'} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
                  alcance={perfil.alcance}
                  semResumo={(
                    <Pressable testID="perfil-convite" accessibilityRole="button" onPress={() => setEditando(true)} disabled={desativado} style={socialEstilos.cabecaConvite}>
                      <Text style={socialEstilos.cabecaConviteTexto}>{p.semResumoDona}</Text>
                    </Pressable>
                  )}
                  acoes={<>
                    <Botao rotulo={p.editar} iconeAntes="lapis" variante="secundario" testID="perfil-editar" desativado={desativado} acao={() => setEditando(true)} />
                    {perfil.publico && perfil.perfilId && (
                      <BotaoCompartilharPerfil perfilId={perfil.perfilId} nome={perfil.nome ?? ''} aoStatus={(texto) => setStatusPerfil((anterior) => trocarStatus(anterior, texto))} />
                    )}
                    {statusPerfil !== '' && <Text accessibilityLiveRegion="polite" style={socialEstilos.status}>{statusPerfil}</Text>}
                  </>} />
                {/* Novidades logo abaixo do cartão: é a recompensa do social (como a web na rodada de banca). */}
                {comunidade && <NovidadesDoPerfil cliente={cliente} abrirPlano={abrirPlano} />}
              </>
            )}

            {!perfil.visitante && (
              <View style={perfilEstilos.secao}>
                <TituloSecao>{perfil.links.length > 0 ? p.compartilhadasTotal(perfil.links.length) : p.compartilhadas}</TituloSecao>
                {perfil.links.length === 0 ? (
                  <Text style={estilos.texto}>
                    {p.nenhumaAntes} <Text accessibilityRole="link" onPress={irParaTrilhas} style={perfilEstilos.linkTexto}>{p.nenhumaLink}</Text>{p.nenhumaDepois(true)}
                  </Text>
                ) : (
                  <View style={perfilEstilos.links}>
                    {perfil.links.map((link) => (
                      <View key={link.codigo} testID={`perfil-link-${link.codigo}`} style={perfilEstilos.link}>
                        <Pressable accessibilityRole="button" onPress={() => abrirPlano(link.planoId)} disabled={desativado} style={perfilEstilos.linkTitulo}>
                          <Text style={perfilEstilos.linkTituloTexto}>{link.titulo}</Text>
                        </Pressable>
                        <Text style={perfilEstilos.linkMeta}>
                          {p.desde(dataCurta(link.criadoEm))} · {link.adicoes === 0 && !link.valeus
                            ? (comunidade ? p.semNinguem : p.adicoes(0))
                            : [link.adicoes > 0 && p.adicoes(link.adicoes), comunidade && link.valeus ? cm.valeus(link.valeus) : null].filter(Boolean).join(' · ')}
                        </Text>
                        {comunidade && link.visibilidade ? <SeloVisibilidade nivel={link.visibilidade} tema={link.tema} /> : (
                          <Chave rotulo={m.noPerfil} nomeAcessivel={`${m.noPerfil}: ${link.titulo}`} ligada={link.noPerfil} desativada={ocupado}
                            aoMudar={(valor) => void alterar(link, valor)} />
                        )}
                        <View style={perfilEstilos.linkAcoes}>
                          {comunidade && (
                            <Botao rotulo={cm.ajustar} iconeAntes="olho" variante="secundario" nomeAcessivel={cm.ajustarRotulo(link.titulo)}
                              testID={`perfil-visibilidade-${link.codigo}`} acao={() => setFolha(link.planoId)} />
                          )}
                          <Botao rotulo={m.copiar} iconeAntes="copiar" variante="secundario" nomeAcessivel={`${m.copiar}: ${link.titulo}`} acao={() => void copiarLink(link)} />
                          <BotaoParar rotulo={m.parar} nomeAcessivel={`${m.parar}: ${link.titulo}`} desativado={ocupado} acao={() => setParando(link)} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                <Status texto={copiado} />
              </View>
            )}

            {cartoes && cartoes.length > 0 && (
              <CartoesDoPerfil key={assinaturaLinks} cliente={cliente} inicial={cartoes} titulo={cm.naSuaPagina}
                aoAbrir={abrirPlano} aoAdicionado={aoAdicionado} abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfil} />
            )}

            {!perfil.visitante && perfil.nome && (
              <View style={perfilEstilos.secao}>
                <TituloSecao>{p.publicoTitulo}</TituloSecao>
                <Text style={estilos.texto}>{perfil.publico ? p.publico(perfil.links.filter((link) => link.noPerfil).length) : `${p.privado} ${p.perfilPrivadoDica}`}</Text>
                {perfil.publico && perfil.perfilId && (
                  <Botao rotulo={p.verComoOutros} variante="secundario" testID="perfil-ver-publico" acao={() => abrirNoNavegador(urlDoPerfil(perfil.perfilId!))}
                    estilo={{ alignSelf: 'flex-start' }} />
                )}
              </View>
            )}

            <View style={perfilEstilos.secao}>
              <TituloSecao>{p.conta}</TituloSecao>
              {!perfil.visitante && (
                <View style={perfilEstilos.email}>
                  <View style={perfilEstilos.emailLinha}>
                    <Text style={perfilEstilos.emailRotulo}>{p.email}</Text>
                    <View style={perfilEstilos.soVoce}><Text style={perfilEstilos.soVoceTexto}>{p.soVoceVe}</Text></View>
                  </View>
                  <Text style={estilos.texto}>{perfil.email}</Text>
                </View>
              )}
              <Botao rotulo={mensagens.sair} testID="sair" variante="secundario" desativado={desativado} acao={sair} estilo={{ alignSelf: 'flex-start' }} />
            </View>
          </>
        )}
      </View>
      {folha && (
        <FolhaCompartilhar cliente={cliente} planoId={folha} visitante={false} comunidade={comunidade} aoFechar={() => setFolha(null)}
          aoMudarPerfil={mudarPerfil}
          aoMudarLink={(planoId, novo) => {
            const antigo = perfil?.links.find((item) => item.planoId === planoId);
            if (antigo) trocarLink(antigo, novo); else aoMudarLink(planoId, novo);
          }} />
      )}
      {parando && (
        <CartaoConfirmacao mensagem={m.pararTitulo} texto={m.pararTexto} confirmarRotulo={m.pararConfirmar} cancelarRotulo={m.pararCancelar} destrutivo
          ocupado={ocupado} aoConfirmar={() => void confirmarParada()} aoCancelar={() => setParando(null)} />
      )}
    </Tela>
  );
}

type ErrosCampos = { nome?: string; resumo?: string };

/** Bytes de um base64 (sem o preenchimento), para o teto de 2 MB do servidor. */
function bytesDoBase64(base64: string) {
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

/**
 * O quadrado que o sistema recortou, em JPEG de 256 a 1024 px e até 2 MB, como o recorte da web ("Usar esta foto" desenha no
 * canvas até 1024 px e tenta as qualidades 0,9, 0,8 e 0,65).
 */
async function prepararFoto(uri: string, largura: number): Promise<string | null> {
  const contexto = ImageManipulator.manipulate(uri);
  const lado = Math.max(256, Math.min(LADO_ENVIO_FOTO, Math.round(largura || LADO_ENVIO_FOTO)));
  if (largura !== lado) contexto.resize({ width: lado });
  const imagem = await contexto.renderAsync();
  for (const qualidade of [0.9, 0.8, 0.65]) {
    const salva = await imagem.saveAsync({ compress: qualidade, format: SaveFormat.JPEG, base64: true });
    if (salva.base64 && bytesDoBase64(salva.base64) <= LIMITES_FOTO.bytes) return salva.base64;
  }
  return null;
}

/**
 * Os dados do perfil, abertos ali mesmo na aba Perfil, como `EditorPerfil` da web (sem outra tela): a linha "É assim que as
 * pessoas te veem…", a foto (o círculo com o selo de câmera), nome, resumo, interesses e cor. A foto salva na hora (é um
 * envio à parte); o resto salva no botão da barra presa embaixo, que só liga quando algo muda. `aoFechar` (perfil com dados):
 * "Cancelar" e o salvar voltam para o cartão. Sair com alteração não salva pede a confirmação do app ("Sair sem salvar?").
 */
function EditorPerfil({ cliente, perfil, aoMudarPerfil, registrarGuarda, definirRodape, aoFechar }: {
  cliente: ClienteNativo;
  perfil: Perfil;
  aoMudarPerfil: (perfil: Perfil) => void;
  registrarGuarda: (guarda: ((continuar: () => void) => boolean) | null) => void;
  /** A barra de salvar vai no rodapé da tela (presa embaixo, acima da barra de abas). */
  definirRodape: (rodape: ReactNode) => void;
  aoFechar?: () => void;
}) {
  const [salvo, setSalvo] = useState(perfil);
  const [nome, setNome] = useState(perfil.nome ?? '');
  const [cor, setCor] = useState<CorPerfil>(perfil.cor ?? 'azul');
  const [resumo, setResumo] = useState(perfil.resumo ?? '');
  const [interesses, setInteresses] = useState<Tema[]>(perfil.interesses);
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'livre' | 'salvando' | 'salvo'>('livre');
  const [avisoInteresses, setAvisoInteresses] = useState('');
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [statusFoto, setStatusFoto] = useState('');
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [escolhendoFoto, setEscolhendoFoto] = useState(false);
  const [removendo, setRemovendo] = useState<'perguntar' | 'removendo' | null>(null);
  const [saida, setSaida] = useState<(() => void) | null>(null);
  const campoNome = useRef<ComponentRef<typeof TextInput>>(null);
  const campoResumo = useRef<ComponentRef<typeof TextInput>>(null);
  const linha = useRef<ComponentRef<typeof Text>>(null);
  // "Tirar foto" só em tela de toque, como na web: no aparelho, sempre; na prévia web, com ponteiro grosso.
  const toque = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);

  const nomeNormal = normalizarNomePerfil(nome);
  const resumoNormal = normalizarResumoPerfil(resumo);
  const usados = [...resumoNormal].length;
  const alterado = nomeNormal !== (salvo.nome ?? '') || cor !== (salvo.cor ?? 'azul') || resumoNormal !== (salvo.resumo ?? '')
    || interesses.join() !== salvo.interesses.join();

  // Aberto pelo "Editar", o foco do leitor de tela vai para a linha do bloco, uma vez só e sem abrir o teclado (como a web).
  useEffect(() => {
    if (!aoFechar) return;
    const espera = setTimeout(() => focarSemRolar(linha.current), 120);
    return () => clearTimeout(espera);
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (alterado && estado === 'salvo') setEstado('livre'); }, [alterado, estado]);

  const alteradoRef = useRef(alterado);
  alteradoRef.current = alterado;
  useEffect(() => {
    registrarGuarda((continuar) => {
      if (!alteradoRef.current) return false;
      setSaida(() => continuar);
      return true;
    });
    return () => registrarGuarda(null);
  }, [registrarGuarda]);

  function atualizarPerfil(novo: Perfil) {
    setSalvo(novo);
    aoMudarPerfil(novo);
  }

  function alternarTema(tema: Tema, marcado: boolean) {
    if (marcado && interesses.length >= LIMITES_PERFIL.interessesMax) {
      const aviso = p.interessesCheio(LIMITES_PERFIL.interessesMax);
      setAvisoInteresses((anterior) => trocarStatus(anterior, aviso));
      anunciar(aviso);
      return;
    }
    setAvisoInteresses('');
    setInteresses((atual) => TEMAS.filter((t) => (t === tema ? marcado : atual.includes(t))));
  }

  function cancelar() {
    setNome(salvo.nome ?? '');
    setCor(salvo.cor ?? 'azul');
    setResumo(salvo.resumo ?? '');
    setInteresses(salvo.interesses);
    setErros({});
    registrarGuarda(null);
    aoFechar?.();
  }

  async function salvar() {
    const motivoNome = motivoNomeInvalido(nomeNormal);
    const motivoResumo = motivoResumoInvalido(resumoNormal);
    const novos: ErrosCampos = {
      ...(motivoNome ? { nome: p.nomeErros[motivoNome] } : {}),
      ...(motivoResumo ? { resumo: p.resumoErros[motivoResumo] } : {}),
    };
    setErros(novos);
    setErroGeral(null);
    if (novos.nome || novos.resumo) {
      (novos.nome ? campoNome : campoResumo).current?.focus();
      anunciar(p.corrigirCampos);
      return;
    }
    setEstado('salvando');
    try {
      const novo = await cliente.salvarPerfil(nomeNormal, cor, { resumo: resumoNormal, interesses });
      atualizarPerfil(novo);
      setNome(novo.nome ?? '');
      setResumo(novo.resumo ?? '');
      setInteresses(novo.interesses);
      setEstado('salvo');
      anunciar(p.salvo);
      registrarGuarda(null);
      aoFechar?.();
    } catch (falha) {
      setErroGeral(textoDoErro(codigoDoErro(falha)));
      setEstado('livre');
    }
  }

  /** Galeria ou câmera, com o recorte quadrado do sistema; a foto vai na hora, como o "Usar esta foto" da web. */
  async function escolherFoto(camera: boolean) {
    setEscolhendoFoto(false);
    setErroFoto(null);
    let resultado: ImagePicker.ImagePickerResult;
    try {
      const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
      if (camera) {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        // Sem permissão, o próprio sistema já explicou; nada muda na tela (como o navegador na web).
        if (!permissao.granted) return;
        resultado = await ImagePicker.launchCameraAsync(opcoes);
      } else {
        resultado = await ImagePicker.launchImageLibraryAsync(opcoes);
      }
    } catch {
      setErroFoto(p.fotoIlegivel);
      return;
    }
    if (resultado.canceled || !resultado.assets[0]) return;
    const foto = resultado.assets[0];
    setEnviandoFoto(true);
    setStatusFoto(p.fotoEnviando);
    try {
      const base64 = await prepararFoto(foto.uri, Math.min(foto.width, foto.height));
      if (!base64) throw new Error('grande');
      atualizarPerfil(await cliente.enviarFoto(base64));
      setStatusFoto(p.fotoSalva);
      anunciar(p.fotoSalva);
    } catch (falha) {
      setStatusFoto('');
      setErroFoto(falha instanceof Error && falha.message === 'grande' ? p.fotoIlegivel : textoDoErro(codigoDoErro(falha)));
    } finally {
      setEnviandoFoto(false);
    }
  }

  /** O círculo: com câmera, abre as duas opções do app (galeria e câmera); sem, vai direto à galeria. Nada do sistema. */
  function tocarNaFoto() {
    if (toque) setEscolhendoFoto((aberto) => !aberto);
    else void escolherFoto(false);
  }

  async function removerFoto() {
    setRemovendo('removendo');
    try {
      atualizarPerfil(await cliente.removerFoto());
      setStatusFoto(p.fotoRemovida);
      anunciar(p.fotoRemovida);
    } catch (falha) {
      setErroFoto(textoDoErro(codigoDoErro(falha)));
    } finally {
      setRemovendo(null);
    }
  }

  // A barra presa embaixo: o estado à esquerda, "Cancelar" (com dados) e "Salvar", que só liga com mudança. As ações leem o
  // estado atual por referência (a barra só é trocada quando o que ela mostra muda).
  const acoesDaBarra = useRef({ salvar, cancelar });
  acoesDaBarra.current = { salvar, cancelar };
  const comCancelar = Boolean(aoFechar);
  useEffect(() => {
    const estadoTexto = estado === 'salvando' ? p.salvando : alterado ? p.alteracoesNaoSalvas : p.tudoSalvo;
    const corEstado = estado === 'salvando' ? cores.textoSecundario : alterado ? cores.alerta : cores.sucesso;
    definirRodape(
      <View testID="editar-barra" style={perfilEstilos.barra}>
        <View accessibilityLiveRegion="polite" style={perfilEstilos.estado}>
          {!alterado && estado !== 'salvando' && <Icone nome="check" tamanho={18} cor={corEstado} />}
          <Text testID="editar-estado" style={[perfilEstilos.estadoTexto, { color: corEstado }]}>{estadoTexto}</Text>
        </View>
        <View style={perfilEstilos.botoes}>
          {comCancelar && <Botao rotulo={p.cancelar} variante="secundario" testID="editar-cancelar" desativado={estado === 'salvando'}
            acao={() => acoesDaBarra.current.cancelar()} />}
          <Botao rotulo={estado === 'salvando' ? p.salvando : p.salvar} testID="editar-salvar" desativado={!alterado} ocupado={estado === 'salvando'}
            acao={() => void acoesDaBarra.current.salvar()} estilo={perfilEstilos.salvar} />
        </View>
        {/* Como `order: 3` da web: o erro vem numa linha só dele, depois dos botões. */}
        {erroGeral && <Text accessibilityRole="alert" style={[socialEstilos.erro, perfilEstilos.barraErro]}>{erroGeral}</Text>}
      </View>,
    );
  }, [alterado, estado, erroGeral, comCancelar, definirRodape]);
  useEffect(() => () => definirRodape(null), [definirRodape]);

  return (
    <View testID="editor-perfil" style={perfilEstilos.editor}>
      <Text ref={linha} accessibilityRole="header" style={perfilEstilos.editorLinha}>{p.editorLinha}</Text>
      <View style={perfilEstilos.form}>
        <View style={perfilEstilos.foto}>
          {/* A foto (ou a inicial na cor) num círculo com o selo de câmera: tocar escolhe a foto. */}
          <Pressable testID="foto-circulo" accessibilityRole="button" accessibilityLabel={salvo.foto ? p.fotoTrocar : p.fotoEscolher}
            accessibilityState={{ expanded: toque ? escolhendoFoto : undefined, disabled: enviandoFoto }} disabled={enviandoFoto}
            onPress={tocarNaFoto} style={({ pressed }) => [perfilEstilos.circulo, pressed && { opacity: 0.85 }]}>
            <Avatar nome={nomeNormal || '?'} cor={cor} foto={salvo.foto} tamanho="g" estilo={perfilEstilos.fotoAvatar} />
            <View style={perfilEstilos.selo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Icone nome="camera" tamanho={20} cor="#FFFFFF" />
            </View>
          </Pressable>
          <View style={perfilEstilos.fotoCorpo}>
            {escolhendoFoto && (
              // As duas origens num cartão do app (o mesmo desenho do menu "•••"), nunca a folha do sistema.
              <View testID="foto-opcoes" style={perfilEstilos.opcoes}>
                <Pressable testID="foto-escolher" accessibilityRole="button" onPress={() => void escolherFoto(false)}
                  style={({ pressed }) => [perfilEstilos.opcao, pressed && { backgroundColor: cores.nevoa }]}>
                  <Icone nome="imagem" tamanho={18} cor={cores.texto} />
                  <Text style={perfilEstilos.opcaoTexto}>{salvo.foto ? p.fotoTrocar : p.fotoEscolher}</Text>
                </Pressable>
                <Pressable testID="foto-camera" accessibilityRole="button" onPress={() => void escolherFoto(true)}
                  style={({ pressed }) => [perfilEstilos.opcao, pressed && { backgroundColor: cores.nevoa }]}>
                  <Icone nome="camera" tamanho={18} cor={cores.texto} />
                  <Text style={perfilEstilos.opcaoTexto}>{p.fotoCamera}</Text>
                </Pressable>
              </View>
            )}
            <Text style={socialEstilos.dica}>{p.fotoDica}</Text>
            {salvo.foto && (
              <Pressable testID="foto-remover" accessibilityRole="button" disabled={removendo !== null || enviandoFoto}
                onPress={() => setRemovendo('perguntar')} style={perfilEstilos.remover}>
                <Icone nome="lixeira" tamanho={18} cor="#B3261E" />
                <Text style={perfilEstilos.removerTexto}>{p.fotoRemover}</Text>
              </Pressable>
            )}
            {erroFoto && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erroFoto}</Text>}
            <Status texto={statusFoto} />
          </View>
        </View>

        <View style={socialEstilos.campoComDica}>
          <Campo rotulo={m.nomeRotulo} campoRef={campoNome} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words" testID="editar-nome"
            erro={erros.nome} accessibilityHint={erros.nome ? undefined : m.comoAparecerDica}
            onChangeText={(texto) => { setNome(texto); if (erros.nome) setErros((atual) => ({ ...atual, nome: undefined })); }} />
          {/* A dica some enquanto o erro estiver na tela (como a web). */}
          {!erros.nome && <Text style={socialEstilos.dica}>{m.comoAparecerDica}</Text>}
        </View>

        <View style={socialEstilos.campoComDica}>
          <Contador rotulo={p.resumoRotulo} usados={usados} maximo={LIMITES_PERFIL.resumoMax} />
          <Campo rotulo={p.resumoRotulo} rotuloOculto campoRef={campoResumo} value={resumo} multiline numberOfLines={3} maxLength={240} testID="editar-resumo"
            erro={erros.resumo} accessibilityHint={`${erros.resumo ? '' : `${p.resumoDica} `}${p.resumoContadorLeitor(LIMITES_PERFIL.resumoMax - usados)}`} style={{ minHeight: 96 }}
            onChangeText={(texto) => { setResumo(texto.replace(/[\r\n]+/g, ' ')); if (erros.resumo) setErros((atual) => ({ ...atual, resumo: undefined })); }} />
          {!erros.resumo && <Text style={socialEstilos.dica}>{p.resumoDica}</Text>}
        </View>

        <View style={socialEstilos.interesses} accessibilityLabel={p.interessesRotulo}>
          <Text style={[socialEstilos.legenda, socialEstilos.legendaDoGrupo]}>{p.interessesRotulo}</Text>
          <Text style={socialEstilos.dica}>{p.interessesDica(LIMITES_PERFIL.interessesMax)} {p.interessesContador(interesses.length, LIMITES_PERFIL.interessesMax)}</Text>
          <View style={socialEstilos.fichas}>
            {TEMAS.map((tema) => (
              <Ficha key={tema} rotulo={mensagens.temas[tema]} marcada={interesses.includes(tema)} aoTocar={() => alternarTema(tema, !interesses.includes(tema))} />
            ))}
          </View>
          {avisoInteresses !== '' && <Text accessibilityLiveRegion="polite" style={socialEstilos.erro}>{avisoInteresses}</Text>}
        </View>

        <CoresDoPerfil cor={cor} aoEscolher={setCor} />
      </View>

      {removendo && (
        <CartaoConfirmacao mensagem={p.fotoRemoverTitulo} texto={p.fotoRemoverTexto} confirmarRotulo={p.fotoRemover} cancelarRotulo={p.fotoRemoverCancelar}
          destrutivo ocupado={removendo === 'removendo'} aoConfirmar={() => void removerFoto()} aoCancelar={() => setRemovendo(null)} />
      )}
      {saida && (
        <CartaoConfirmacao mensagem={p.sairSemSalvarTitulo} texto={p.sairSemSalvarTexto} confirmarRotulo={p.sairSemSalvarConfirmar}
          cancelarRotulo={p.sairSemSalvarCancelar} destrutivo
          aoConfirmar={() => { const continuar = saida; registrarGuarda(null); setSaida(null); continuar(); }} aoCancelar={() => setSaida(null)} />
      )}
    </View>
  );
}

const perfilEstilos = StyleSheet.create({
  // .painel--perfil: grade com vão de 20; o título "Perfil" no tamanho de título de página (o <Titulo> de 32/40), como a web.
  painel: { gap: 20 },
  secao: { gap: 10 },
  secaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  cartao: { gap: 12, padding: 18, borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  links: { gap: 12 },
  link: { gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 2, borderColor: cores.gelo, borderRadius: 16 },
  linkTitulo: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  linkTituloTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 25.5, fontWeight: '900', textDecorationLine: 'underline' },
  linkMeta: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  linkAcoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8 },
  // .link-texto: "Abra uma trilha" no meio da frase, sublinhado na cor da ação.
  linkTexto: { color: cores.acao, fontWeight: '800', textDecorationLine: 'underline' },
  email: { gap: 2 },
  emailLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  emailRotulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  // .selo-so-voce: "Só você vê" ao lado do e-mail.
  soVoce: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: cores.nevoa },
  soVoceTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 12, lineHeight: 18, fontWeight: '800' },

  // .editor-perfil: o bloco com borda de 2 e cantos de 20, respiro de 18 e vão de 14; a linha em cinza, peso 700.
  editor: { gap: 14, padding: 18, borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  editorLinha: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24.65, fontWeight: '700' },
  form: { gap: 22 },
  // .editar-foto: a caixa em névoa com borda de 2; o círculo de 96 com borda branca de 4 e o selo de câmera.
  foto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, rowGap: 16, padding: 16, borderWidth: 2, borderColor: cores.gelo,
    borderRadius: 20, backgroundColor: cores.nevoa },
  circulo: { borderRadius: 999 },
  fotoAvatar: { borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#1B2A5E', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  // .editar-foto__selo: 40 × 40 na cor da ação, borda branca de 3, ícone de 20, 2 para fora no canto de baixo à direita.
  selo: { position: 'absolute', right: -2, bottom: -2, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
    borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: cores.acao,
    shadowColor: '#1B2A5E', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fotoCorpo: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: 8, minWidth: 0 },
  // As origens da foto no desenho do menu "•••" (.plano-cartao__opcoes): caixa branca, cantos de 12, linhas de 44.
  opcoes: { alignSelf: 'flex-start', minWidth: 176, padding: 6, borderWidth: 1, borderColor: cores.gelo, borderRadius: 12, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 8 },
  opcaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14 },
  remover: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 48, paddingHorizontal: 6 },
  removerTexto: { color: '#B3261E', fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  // .editar-perfil__barra: estado à esquerda; "Cancelar" (com dados) e "Salvar" (no mínimo 144) à direita, com a linha de cima.
  barraConteudo: { paddingTop: 12, paddingBottom: 12 },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8 },
  barraErro: { flexBasis: '100%' },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  estadoTexto: { fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' },
  salvar: { minWidth: 128 },
});
