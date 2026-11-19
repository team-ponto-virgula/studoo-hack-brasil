import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  codigoDoErro, compartilharNoSistema, copiar, dataCurta, socialEstilos, temFolhaDoSistema, textoDoErro, urlDoLink, urlDoPerfil,
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
 * Tela Perfil, como `TelaPerfil` da web: o cabeçalho novo (ou o convite para completar), as trilhas que a pessoa compartilha
 * (com o nível e "Visibilidade", que abre a folha, com a comunidade), as Novidades e os cartões "Como aparece na sua página"
 * (com a comunidade), o perfil público, a conta e "Sair".
 */
export function TelaPerfil({ cliente, perfil: inicial, comunidade, acoes, aoMudarPerfil, aoMudarLink, abrirPlano, editar, sair, desativado, aoAdicionado,
  abrirPrevia, abrirPerfil }: {
  cliente: ClienteNativo;
  perfil: Perfil | null;
  comunidade: boolean;
  acoes?: ReactNode;
  aoMudarPerfil: (perfil: Perfil) => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  abrirPlano: (id: string) => void;
  editar: () => void;
  sair: () => void;
  desativado: boolean;
  /** Os cartões "Como aparece na sua página" (com a comunidade): as mesmas ações do Explorar. */
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  abrirPrevia: (codigo: string) => void;
  abrirPerfil: (perfilId: string) => void;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [parando, setParando] = useState<LinkCompartilhado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState('');
  const [statusPerfil, setStatusPerfil] = useState('');
  const [folha, setFolha] = useState<string | null>(null);
  const [cartoes, setCartoes] = useState<CartaoTrilha[] | null>(null);
  const assinaturaLinks = perfil?.links.map((link) => `${link.codigo}:${link.visibilidade ?? link.noPerfil}:${link.tema ?? ''}:${link.legenda ?? ''}`).join('|') ?? '';

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
      return { ...atual, links, publico: links.some((item) => item.noPerfil), alcance: { trilhas: links.length, pessoas: links.reduce((t, l) => t + l.adicoes, 0) } };
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

  return (
    <Tela pagina="perfil" acoes={acoes} estiloConteudo={FIM_COM_BARRA}>
      <View style={perfilEstilos.painel}>
        <Titulo testID="titulo-perfil" foco estilo={perfilEstilos.titulo}>{p.titulo}</Titulo>
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
            ) : !perfil.nome ? (
              <View testID="perfil-completar" style={perfilEstilos.completar}>
                <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false} style={perfilEstilos.completarStu} />
                <View style={perfilEstilos.completarTexto}>
                  <TituloSecao>{m.comoAparecer}</TituloSecao>
                  <Text style={estilos.texto}>{p.convitePerfil}</Text>
                  <Botao rotulo={p.completar} iconeAntes="lapis" testID="perfil-completar-botao" desativado={desativado} acao={editar} estilo={{ alignSelf: 'flex-start' }} />
                </View>
              </View>
            ) : (
              <CabecalhoPerfil nome={perfil.nome} cor={perfil.cor ?? 'azul'} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
                alcance={perfil.alcance}
                semResumo={(
                  <Pressable testID="perfil-convite" accessibilityRole="button" onPress={editar} disabled={desativado} style={socialEstilos.cabecaConvite}>
                    <Text style={socialEstilos.cabecaConviteTexto}>{p.semResumoDona}</Text>
                  </Pressable>
                )}
                acoes={<>
                  <Botao rotulo={p.editarPerfil} iconeAntes="lapis" variante="secundario" testID="perfil-editar" desativado={desativado} acao={editar} />
                  {perfil.publico && perfil.perfilId && (
                    <BotaoCompartilharPerfil perfilId={perfil.perfilId} nome={perfil.nome} aoStatus={(texto) => setStatusPerfil((anterior) => trocarStatus(anterior, texto))} />
                  )}
                  {statusPerfil !== '' && <Text accessibilityLiveRegion="polite" style={socialEstilos.status}>{statusPerfil}</Text>}
                </>} />
            )}

            {!perfil.visitante && (
              <View style={perfilEstilos.secao}>
                <TituloSecao>{p.compartilhadas}</TituloSecao>
                {perfil.links.length === 0 ? <Text style={estilos.texto}>{p.nenhuma}</Text> : (
                  <View style={perfilEstilos.links}>
                    {perfil.links.map((link) => (
                      <View key={link.codigo} testID={`perfil-link-${link.codigo}`} style={perfilEstilos.link}>
                        <Pressable accessibilityRole="button" onPress={() => abrirPlano(link.planoId)} disabled={desativado} style={perfilEstilos.linkTitulo}>
                          <Text style={perfilEstilos.linkTituloTexto}>{link.titulo}</Text>
                        </Pressable>
                        <Text style={perfilEstilos.linkMeta}>
                          {p.desde(dataCurta(link.criadoEm))} · {p.adicoes(link.adicoes)}{comunidade && link.valeus !== undefined ? ` · ${cm.valeus(link.valeus)}` : ''}
                        </Text>
                        {comunidade && link.visibilidade ? <SeloVisibilidade nivel={link.visibilidade} tema={link.tema} /> : (
                          <Chave rotulo={m.noPerfil} nomeAcessivel={`${m.noPerfil}: ${link.titulo}`} ligada={link.noPerfil} desativada={ocupado}
                            aoMudar={(valor) => void alterar(link, valor)} />
                        )}
                        <View style={perfilEstilos.linkAcoes}>
                          {comunidade && (
                            <Botao rotulo={cm.ajustar} iconeAntes="bussola" variante="secundario" nomeAcessivel={cm.ajustarRotulo(link.titulo)}
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

            {/* Com a comunidade (spec 10, C2): as Novidades da semana e os cartões como aparecem na página, antes do perfil público. */}
            {comunidade && !perfil.visitante && perfil.nome && <NovidadesDoPerfil cliente={cliente} abrirPlano={abrirPlano} />}

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
                  <Text style={perfilEstilos.emailRotulo}>{p.email}</Text>
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
          aoMudarPerfil={(novo) => { setPerfil(novo); aoMudarPerfil(novo); }}
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
 * Tela "Editar perfil", como `TelaEditarPerfil` da web: foto (escolher, tirar, remover), nome, cor, resumo com contador e
 * interesses (até 5), com a prévia "Como os outros veem" depois do formulário. A foto salva na hora (é um envio à parte); o
 * resto salva no botão, com o estado sempre à vista na barra de baixo e o erro no próprio campo. Voltar com alteração não
 * salva pede a mesma confirmação da web ("Sair sem salvar?"), também pelo voltar do Android e pelo gesto do iPhone.
 */
export function TelaEditarPerfil({ cliente, perfil, acoes, aoMudarPerfil, voltar, registrarGuarda }: {
  cliente: ClienteNativo;
  perfil: Perfil;
  acoes?: ReactNode;
  aoMudarPerfil: (perfil: Perfil) => void;
  voltar: () => void;
  /**
   * A tela registra uma guarda de saída, como na web: qualquer navegação (Voltar, a barra de cima, o voltar do aparelho e o
   * gesto do iPhone) passa por ela e, com alteração não salva, recebe a mesma confirmação. Devolve true quando segurou a saída.
   */
  registrarGuarda: (guarda: ((continuar: () => void) => boolean) | null) => void;
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
  const [removendo, setRemovendo] = useState<'perguntar' | 'removendo' | null>(null);
  const [saida, setSaida] = useState<(() => void) | null>(null);
  const campoNome = useRef<ComponentRef<typeof TextInput>>(null);
  const campoResumo = useRef<ComponentRef<typeof TextInput>>(null);
  // "Tirar foto" só em tela de toque, como na web: no aparelho, sempre; na prévia web, com ponteiro grosso.
  const toque = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);

  const nomeNormal = normalizarNomePerfil(nome);
  const resumoNormal = normalizarResumoPerfil(resumo);
  const usados = [...resumoNormal].length;
  const alterado = nomeNormal !== (salvo.nome ?? '') || cor !== (salvo.cor ?? 'azul') || resumoNormal !== (salvo.resumo ?? '')
    || interesses.join() !== salvo.interesses.join();

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
    } catch (falha) {
      setErroGeral(textoDoErro(codigoDoErro(falha)));
      setEstado('livre');
    }
  }

  /** Galeria ou câmera, com o recorte quadrado do sistema; a foto vai na hora, como o "Usar esta foto" da web. */
  async function escolherFoto(camera: boolean) {
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

  const estadoTexto = estado === 'salvando' ? p.salvando : alterado ? p.alteracoesNaoSalvas : p.tudoSalvo;
  const corEstado = estado === 'salvando' ? cores.textoSecundario : alterado ? cores.alerta : cores.sucesso;

  return (
    <Tela pagina="editar-perfil" acoes={acoes} estiloRodapeConteudo={perfilEstilos.barraConteudo}
      rodape={(
        <View testID="editar-barra" style={perfilEstilos.barra}>
          <View accessibilityLiveRegion="polite" style={perfilEstilos.estado}>
            {!alterado && estado !== 'salvando' && <Icone nome="check" tamanho={18} cor={corEstado} />}
            <Text testID="editar-estado" style={[perfilEstilos.estadoTexto, { color: corEstado }]}>{estadoTexto}</Text>
          </View>
          <Botao rotulo={estado === 'salvando' ? p.salvando : p.salvar} testID="editar-salvar" desativado={!alterado} ocupado={estado === 'salvando'}
            acao={() => void salvar()} estilo={perfilEstilos.salvar} />
          {/* Como `order: 3` da web: o erro vem numa linha só dele, depois do botão. */}
          {erroGeral && <Text accessibilityRole="alert" style={[socialEstilos.erro, perfilEstilos.barraErro]}>{erroGeral}</Text>}
        </View>
      )}>
      <View style={perfilEstilos.editar}>
        <View style={perfilEstilos.topo}>
          <Pressable testID="editar-voltar" accessibilityRole="button" accessibilityLabel={p.voltarPerfil} onPress={voltar}
            style={({ pressed }) => [perfilEstilos.voltar, pressed && { opacity: 0.7 }]}>
            <Text style={perfilEstilos.voltarTexto}><Text importantForAccessibility="no">←</Text> {p.voltarPerfil}</Text>
          </Pressable>
          <Titulo testID="titulo-editar-perfil" foco>{p.editarPerfil}</Titulo>
        </View>

        <View style={perfilEstilos.form}>
          <View style={perfilEstilos.foto}>
            <Avatar nome={nomeNormal || '?'} cor={cor} foto={salvo.foto} tamanho="g" estilo={perfilEstilos.fotoAvatar} />
            <View style={perfilEstilos.fotoCorpo}>
              <Text accessibilityRole="header" style={perfilEstilos.rotuloBloco}>{p.fotoRotulo}</Text>
              <View style={perfilEstilos.fotoAcoes}>
                <Botao rotulo={salvo.foto ? p.fotoTrocar : p.fotoEscolher} iconeAntes="imagem" variante="secundario" testID="foto-escolher"
                  desativado={enviandoFoto} acao={() => void escolherFoto(false)} />
                {toque && <Botao rotulo={p.fotoCamera} iconeAntes="camera" variante="secundario" testID="foto-camera" desativado={enviandoFoto}
                  acao={() => void escolherFoto(true)} />}
                {salvo.foto && (
                  <Pressable testID="foto-remover" accessibilityRole="button" disabled={removendo !== null || enviandoFoto}
                    onPress={() => setRemovendo('perguntar')} style={perfilEstilos.remover}>
                    <Icone nome="lixeira" tamanho={18} cor="#B3261E" />
                    <Text style={perfilEstilos.removerTexto}>{p.fotoRemover}</Text>
                  </Pressable>
                )}
              </View>
              <Text style={socialEstilos.dica}>{p.fotoDica}</Text>
              {erroFoto && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erroFoto}</Text>}
              <Status texto={statusFoto} />
            </View>
          </View>

          <View style={socialEstilos.campoComDica}>
            <Campo rotulo={m.nomeRotulo} campoRef={campoNome} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words" testID="editar-nome"
              erro={erros.nome} accessibilityHint={m.comoAparecerDica}
              onChangeText={(texto) => { setNome(texto); if (erros.nome) setErros((atual) => ({ ...atual, nome: undefined })); }} />
            <Text style={socialEstilos.dica}>{m.comoAparecerDica}</Text>
          </View>

          <CoresDoPerfil cor={cor} aoEscolher={setCor} />

          <View style={socialEstilos.campoComDica}>
            <Contador rotulo={p.resumoRotulo} usados={usados} maximo={LIMITES_PERFIL.resumoMax} />
            <Campo rotulo={p.resumoRotulo} rotuloOculto campoRef={campoResumo} value={resumo} multiline numberOfLines={3} maxLength={240} testID="editar-resumo"
              erro={erros.resumo} accessibilityHint={`${p.resumoDica} ${p.resumoContadorLeitor(LIMITES_PERFIL.resumoMax - usados)}`} style={{ minHeight: 96 }}
              onChangeText={(texto) => { setResumo(texto.replace(/[\r\n]+/g, ' ')); if (erros.resumo) setErros((atual) => ({ ...atual, resumo: undefined })); }} />
            <Text style={socialEstilos.dica}>{p.resumoDica}</Text>
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
        </View>

        <View style={perfilEstilos.previa}>
          <Text accessibilityRole="header" style={perfilEstilos.rotuloBloco}>{p.previaTitulo}</Text>
          <CabecalhoPerfil nome={nomeNormal || '…'} cor={cor} foto={salvo.foto} resumo={resumoNormal || null} interesses={interesses}
            alcance={salvo.alcance} comoTitulo={false} estilo={perfilEstilos.previaCabeca} />
          <Text style={socialEstilos.dica}>{p.fotoAviso}</Text>
        </View>
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
    </Tela>
  );
}

const perfilEstilos = StyleSheet.create({
  // .painel--perfil: grade com vão de 20; o título de 24 (.painel--perfil__titulo).
  painel: { gap: 20 },
  titulo: { fontSize: 24, lineHeight: 40, letterSpacing: -0.75 },
  secao: { gap: 10 },
  secaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 23.4, letterSpacing: -0.27 },
  cartao: { gap: 12, padding: 18, borderWidth: 2, borderColor: cores.gelo, borderRadius: 20, backgroundColor: cores.fundo },
  completar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: 18, borderWidth: 2, borderColor: cores.gelo,
    borderRadius: 20, backgroundColor: cores.ceu },
  completarStu: { width: 80, height: 88 },
  completarTexto: { flexGrow: 1, flexShrink: 1, flexBasis: 224, gap: 8, alignItems: 'flex-start' },
  links: { gap: 12 },
  link: { gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 2, borderColor: cores.gelo, borderRadius: 16 },
  linkTitulo: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  linkTituloTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 25.5, fontWeight: '900', textDecorationLine: 'underline' },
  linkMeta: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  linkAcoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8 },
  email: { gap: 2 },
  emailRotulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21, fontWeight: '800' },

  // .painel--editar-perfil: vão de 16; o formulário com vão de 22; a prévia depois dele no celular.
  editar: { gap: 16 },
  topo: { gap: 2 },
  // Os botões só de texto da web têm 48 (o respiro e a borda do .botao vencem o min-height de 44).
  voltar: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' },
  voltarTexto: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  form: { gap: 22 },
  rotuloBloco: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 16, lineHeight: 20.8 },
  foto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 18, rowGap: 16, padding: 16, borderWidth: 2, borderColor: cores.gelo,
    borderRadius: 20, backgroundColor: cores.nevoa },
  fotoAvatar: { borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#1B2A5E', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  fotoCorpo: { flexGrow: 1, flexShrink: 1, flexBasis: 240, gap: 8, minWidth: 0 },
  fotoAcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  remover: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 6 },
  removerTexto: { color: '#B3261E', fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  previa: { gap: 10, marginTop: 8 },
  previaCabeca: { shadowColor: '#1B2A5E', shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 3 },
  // .editar-perfil__barra: estado à esquerda e "Salvar" à direita (no mínimo 144 de largura), com a linha de cima.
  barraConteudo: { paddingTop: 12, paddingBottom: 12 },
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8 },
  barraErro: { flexBasis: '100%' },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  estadoTexto: { fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  salvar: { minWidth: 144 },
});
