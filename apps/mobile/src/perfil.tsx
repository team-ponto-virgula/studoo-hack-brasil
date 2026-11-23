import { useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
  LIMITES_PERFIL, TEMAS, perfilComLink, linksPublicosNoPerfil, motivoNomeInvalido, motivoResumoInvalido, normalizarNomePerfil, normalizarResumoPerfil,
  type CartaoTrilha, type CorPerfil, type LinkCompartilhado, type Perfil, type Tema,
} from '@studoo/contratos';
import { sessaoInvalida, type ClienteNativo } from './api-nativa';
import { CartoesDoPerfil, FIM_COM_BARRA, NovidadesDoPerfil } from './comunidade';
import { Icone } from './icone';
import { AvisoDoApp, BaixoOcupado, Botao, CAPSULA, Campo, CartaoConfirmacao, FolhaDeAcoes, Tela, Titulo, estilos, type AcaoDaFolha } from './interface';
import { mensagens } from './mensagens';
import { RecorteImagem, escolherImagem, type ImagemParaRecortar } from './recorte';
import {
  Avatar, BotaoParar, CabecalhoPerfil, Chave, Contador, CoresDoPerfil, Esqueleto, Ficha, FolhaCompartilhar, SeloVisibilidade, Status, abrirNoNavegador,
  codigoDoErro, compartilharNoSistema, copiar, dataCurta, focarSemRolar, socialEstilos, temFolhaDoSistema, textoDoErro, urlDoLink, urlDoPerfil,
} from './social';
import { BotaoExcluirConta, SecaoPrivacidade } from './privacidade';
import { AvisoMidiaEmRevisao, EstadoDaPublicacao, SecaoAjuda, SecaoBloqueadas } from './seguranca';
import { FolhaPostarNoPerfil } from './postar-perfil';
import { SomNoPerfil } from './som';
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
function BotaoCompartilharPerfil({ perfilId, nome, aoStatus, estilo }: { perfilId: string; nome: string; aoStatus: (texto: string) => void; estilo?: object }) {
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
  return <Botao rotulo={p.compartilhar} iconeAntes="compartilhar" variante="secundario" fonte={16} nomeAcessivel={p.compartilharPerfil} testID="perfil-compartilhar"
    acao={() => void compartilhar()} estilo={estilo} />;
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
  abrirPrevia, abrirPerfil, registrarGuarda, irParaTrilhas, aoSessaoTerminada, novaTrilha, focarNome: focarNomeAoAbrir = false }: {
  /** "Nova trilha" da folha "Postar no perfil" sem trilhas (spec 10). */
  novaTrilha?: () => void;
  /** Aberto pelo "Editar perfil" da folha "Postar no perfil" (pelo "•••"): o foco vai para o campo do nome (P6). */
  focarNome?: boolean;
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
  /** A sessão terminou no servidor (conta excluída em outro aparelho, sessão revogada): volta à entrada, como as outras telas. */
  aoSessaoTerminada?: () => void;
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
  /** A folha "Postar no perfil" (spec 10, 20/11). */
  const [postando, setPostando] = useState(false);
  // Pelo convite "Conte em uma frase…", os campos abrem com o foco no resumo.
  const [focarResumo, setFocarResumo] = useState(false);
  // Pelo "Editar perfil" da folha "Postar no perfil", os campos abrem com o foco (e a tela) no nome (spec 10, P6).
  const [focarNome, setFocarNome] = useState(focarNomeAoAbrir);
  const botaoEditar = useRef<ComponentRef<typeof View>>(null);
  const { avisar } = useContext(AvisoDoApp);
  function abrirEditor(resumo = false, nome = false) {
    setFocarResumo(resumo);
    setFocarNome(nome);
    setEditando(true);
  }
  /** Salvo: os campos fecham, o aviso do app diz "Perfil salvo." e o foco vai para "Editar". */
  function aoSalvo() {
    setEditando(false);
    avisar(p.salvo, { icone: 'check', som: 'salvo' });
    setTimeout(() => focarSemRolar(botaoEditar.current), 250);
  }
  // A barra de salvar do editor fica presa embaixo, acima da barra de abas (na web, `position: sticky` no fim do bloco).
  const [rodapeDoEditor, setRodapeDoEditor] = useState<ReactNode>(null);
  // Quem precisa saber da rolagem (a linha de ações do editor, para virar bloco preso quando sai da vista) se inscreve aqui.
  const ouvintesDaRolagem = useRef(new Set<() => void>());
  const inscreverRolagem = useCallback((ouvinte: () => void) => {
    ouvintesDaRolagem.current.add(ouvinte);
    return () => { ouvintesDaRolagem.current.delete(ouvinte); };
  }, []);
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
      .catch((falha) => {
        if (!ativo) return;
        if (sessaoInvalida(falha) && aoSessaoTerminada) { aoSessaoTerminada(); return; }
        setErro(codigoDoErro(falha));
      });
    return () => { ativo = false; };
    // Recarrega ao abrir a tela (as adições e os links podem ter mudado), como na web.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarLink(antigo: LinkCompartilhado, novo: LinkCompartilhado | null) {
    setPerfil((atual) => atual && perfilComLink(atual, antigo.planoId, novo));
    aoMudarLink(antigo.planoId, novo);
  }

  /** Um link mudou na folha "Postar no perfil": troca o que já estava na lista, ou entra (o link acabou de ser criado). */
  function aplicarLink(planoId: string, novo: LinkCompartilhado) {
    setPerfil((atual) => atual && perfilComLink(atual, planoId, novo));
    aoMudarLink(planoId, novo);
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
    <Tela pagina="perfil" acoes={acoes} estiloConteudo={FIM_COM_BARRA} aoRolar={() => ouvintesDaRolagem.current.forEach((ouvinte) => ouvinte())}
      rodape={comEditor && rodapeDoEditor ? rodapeDoEditor : undefined} estiloRodapeConteudo={comEditor ? perfilEstilos.barraConteudo : undefined}
      estiloRodape={comEditor ? perfilEstilos.barraFundo : undefined}>
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
                aoSalvo={aoSalvo} focarResumo={focarResumo} focarNome={focarNome}
                definirRodape={setRodapeDoEditor} inscreverRolagem={inscreverRolagem}
                aoCancelar={perfil.nome ? () => setEditando(false) : undefined} />
            ) : (
              <>
                <CabecalhoPerfil daDona nome={perfil.nome ?? ''} cor={perfil.cor ?? 'azul'} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
                  alcance={perfil.alcance}
                  semResumo={(
                    <Pressable testID="perfil-convite" accessibilityRole="button" onPress={() => abrirEditor(true)} disabled={desativado} style={socialEstilos.cabecaConvite}>
                      <Text style={socialEstilos.cabecaConviteTexto}>{p.semResumoDona}</Text>
                    </Pressable>
                  )}
                  acoes={<>
                    {/* Ações numa fileira, metade cada, com 44 de altura: "Editar" e "Compartilhar" (só com perfil público; sem ele, "Editar" ocupa a fileira). */}
                    <View style={perfilEstilos.acoesPerfil}>
                      <View ref={botaoEditar} style={perfilEstilos.acaoPerfil}>
                        <Botao rotulo={p.editar} iconeAntes="lapis" variante="secundario" fonte={16} testID="perfil-editar" desativado={desativado} acao={() => abrirEditor()}
                          estilo={perfilEstilos.botaoMetade} />
                      </View>
                      {perfil.publico && perfil.perfilId && (
                        <View style={perfilEstilos.acaoPerfil}>
                          <BotaoCompartilharPerfil perfilId={perfil.perfilId} nome={perfil.nome ?? ''} estilo={perfilEstilos.botaoMetade}
                            aoStatus={(texto) => setStatusPerfil((anterior) => trocarStatus(anterior, texto))} />
                        </View>
                      )}
                    </View>
                    {statusPerfil !== '' && <Text accessibilityLiveRegion="polite" style={socialEstilos.status}>{statusPerfil}</Text>}
                  </>} />
                <AvisoMidiaEmRevisao tipo="foto" moderacao={perfil.fotoModeracao} />
                {/* Novidades logo abaixo do cartão: é a recompensa do social (como a web na rodada de banca). */}
                {comunidade && <NovidadesDoPerfil cliente={cliente} abrirPlano={abrirPlano} />}
              </>
            )}

            {!perfil.visitante && (
              <View style={perfilEstilos.secao}>
                {/* Spec 10, "Postar no perfil": o botão secundário de 44 ao lado do título (com trilhas) ou embaixo do estado vazio. */}
                <View style={perfilEstilos.secaoCabeca}>
                  <TituloSecao>{perfil.links.length > 0 ? p.compartilhadasTotal(perfil.links.length) : p.compartilhadas}</TituloSecao>
                  {comunidade && perfil.links.length > 0 && (
                    <Botao rotulo={p.postar.botao} testID="postar-abrir" variante="secundario" compacto desativado={desativado} acao={() => setPostando(true)} />
                  )}
                </View>
                {/* Spec 16, item 32: compartilhar é ter link; postar é aparecer no perfil (a linha diz a diferença, como a web). */}
                {perfil.links.length > 0 && (
                  <Text testID="perfil-links-linha" style={perfilEstilos.linhaSecao}>{comunidade ? p.compartilhadasLinha : p.compartilhadasLinhaSemComunidade}</Text>
                )}
                {perfil.links.length === 0 && comunidade ? (
                  <View testID="postar-vazio" style={perfilEstilos.postarVazio}>
                    <Text style={estilos.texto}>{p.postar.vazio}</Text>
                    <Botao rotulo={p.postar.botao} testID="postar-abrir" variante="secundario" compacto desativado={desativado} acao={() => setPostando(true)}
                      estilo={{ alignSelf: 'flex-start' }} />
                  </View>
                ) : perfil.links.length === 0 ? (
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
                        <EstadoDaPublicacao moderacao={link.moderacao} testID={`perfil-link-${link.codigo}-moderacao`} />
                        {/* "No Explorar" (verde) só para o que está aprovado e listado. Em revisão: o destino e o tema num chip neutro,
                            "depois da aprovação"; não publicada: nenhum chip de lugar, ela continua só com a dona (Lead e Designer, 20/11). */}
                        {comunidade && link.visibilidade && link.moderacao === 'recusado' ? null
                          : comunidade && link.visibilidade && link.moderacao === 'pendente' ? <SeloVisibilidade nivel={link.visibilidade} tema={link.tema} emRevisao />
                          : comunidade && link.visibilidade ? <SeloVisibilidade nivel={link.visibilidade} tema={link.tema} /> : (
                          <Chave rotulo={m.noPerfil} nomeAcessivel={`${m.noPerfil}: ${link.titulo}`} ligada={link.noPerfil} desativada={ocupado}
                            aoMudar={(valor) => void alterar(link, valor)} />
                        )}
                        <View style={perfilEstilos.linkAcoes}>
                          {comunidade && (
                            <Botao rotulo={cm.ajustar} iconeAntes="olho" variante="secundario" nomeAcessivel={cm.ajustarRotulo(link.titulo)}
                              testID={`perfil-visibilidade-${link.codigo}`} acao={() => setFolha(link.planoId)} />
                          )}
                          {/* Spec 14 (Designer, b874e95): em revisão ou não publicada, o link mostraria "Esta trilha não está disponível agora."
                              a qualquer outra pessoa; sem "Copiar link" até a aprovação ("Quem pode ver" e "Parar de compartilhar" ficam). */}
                          {link.moderacao !== 'pendente' && link.moderacao !== 'recusado' && (
                            <Botao rotulo={m.copiar} iconeAntes="copiar" variante="secundario" nomeAcessivel={`${m.copiar}: ${link.titulo}`} acao={() => void copiarLink(link)} />
                          )}
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
                <Text style={estilos.texto}>{perfil.publico ? p.publico(linksPublicosNoPerfil(perfil).length) : `${p.privado} ${comunidade ? p.perfilPrivadoDica : p.perfilPrivadoDicaSemComunidade}`}</Text>
                {perfil.publico && perfil.perfilId && (
                  <Botao rotulo={p.verComoOutros} variante="secundario" testID="perfil-ver-publico" acao={() => abrirNoNavegador(urlDoPerfil(perfil.perfilId!))}
                    estilo={{ alignSelf: 'flex-start' }} />
                )}
              </View>
            )}

            {/* Som, logo antes de Conta, para quem tem conta e para visitante (spec 12). */}
            <View style={perfilEstilos.secao}>
              <TituloSecao>{mensagens.som.titulo}</TituloSecao>
              <SomNoPerfil />
            </View>

            {/* Privacidade e dados, entre Som e Conta, como na web: o uso de IA, a política e "Excluir conta" (Apple 5.1.2(i) e 5.1.1(v)). */}
            <View style={perfilEstilos.secao}>
              <TituloSecao>{mensagens.privacidade.secaoTitulo}</TituloSecao>
              <SecaoPrivacidade desativado={desativado} />
            </View>

            {/* Spec 14: "Pessoas bloqueadas" (com a comunidade; vale também para visitante) e "Ajuda", antes de Conta. */}
            {comunidade && (
              <View style={perfilEstilos.secao}>
                <TituloSecao>{mensagens.seguranca.bloqueadasTitulo}</TituloSecao>
                <SecaoBloqueadas cliente={cliente} desativado={desativado} />
              </View>
            )}

            <View style={perfilEstilos.secao}>
              <TituloSecao>{mensagens.seguranca.ajudaTitulo}</TituloSecao>
              <SecaoAjuda desativado={desativado} />
            </View>

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
              <BotaoExcluirConta desativado={desativado} visitante={perfil.visitante} />
            </View>
          </>
        )}
      </View>
      {postando && perfil && !perfil.visitante && (
        <FolhaPostarNoPerfil cliente={cliente} perfil={perfil} aoFechar={() => setPostando(false)} aoMudarLink={aplicarLink}
          editarPerfil={() => { setPostando(false); abrirEditor(false, true); }} novaTrilha={() => { setPostando(false); (novaTrilha ?? irParaTrilhas)(); }} />
      )}
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

/**
 * Os dados do perfil, abertos ali mesmo na aba Perfil (spec 10, "Revisão do dono (19/11): perfil direto nos dados"; esboço
 * `perfil-390.png` do Designer): a frase de privacidade com o cadeado no alto, a foto (o círculo com o selo de câmera, o link
 * "Adicionar foto" ou "Trocar foto" e a dica), nome, resumo, interesses e cor, cada um com rótulo e dica. A foto salva na
 * hora (é um envio à parte); o resto salva no botão da barra presa embaixo, que só liga quando algo muda e mostra o estado
 * numa linha só. Tocar na foto abre a folha do Studoo (galeria, câmera, remover e cancelar). "Cancelar" com alteração, e
 * qualquer saída, perguntam "Sair sem salvar?". Salvar fecha os campos (quem usa mostra o aviso "Perfil salvo.").
 */
function EditorPerfil({ cliente, perfil, aoMudarPerfil, registrarGuarda, definirRodape, inscreverRolagem, aoSalvo, aoCancelar, focarResumo = false, focarNome = false }: {
  cliente: ClienteNativo;
  perfil: Perfil;
  aoMudarPerfil: (perfil: Perfil) => void;
  registrarGuarda: (guarda: ((continuar: () => void) => boolean) | null) => void;
  /** O bloco preso da tela (acima da cápsula): só com alteração e com a linha de ações fora da vista (spec 10, 56aac7e). */
  definirRodape: (rodape: ReactNode) => void;
  /** Avisa a cada rolagem da tela, para a linha conferir se ainda está à vista. */
  inscreverRolagem: (ouvinte: () => void) => () => void;
  /** Depois de salvar: os campos fecham e o cabeçalho mostra o perfil. */
  aoSalvo: () => void;
  /** Perfil com dados: "Cancelar" volta para o cabeçalho (sem dados, não há o que cancelar). */
  aoCancelar?: () => void;
  /** Aberto pelo convite "Conte em uma frase…": o foco vai para o resumo. */
  focarResumo?: boolean;
  /** Aberto pelo "Editar perfil" da folha "Postar no perfil": o foco vai para o nome, depois que a folha saiu. */
  focarNome?: boolean;
}) {
  const { width, height: alturaJanela } = useWindowDimensions();
  const [salvo, setSalvo] = useState(perfil);
  const [nome, setNome] = useState(perfil.nome ?? '');
  const [cor, setCor] = useState<CorPerfil>(perfil.cor ?? 'azul');
  const [resumo, setResumo] = useState(perfil.resumo ?? '');
  const [interesses, setInteresses] = useState<Tema[]>(perfil.interesses);
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [avisoInteresses, setAvisoInteresses] = useState('');
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [statusFoto, setStatusFoto] = useState('');
  /** A imagem escolhida na galeria ou tirada na câmera, à espera do recorte quadrado do Studoo. */
  const [paraRecortar, setParaRecortar] = useState<ImagemParaRecortar | null>(null);
  const [folhaDaFoto, setFolhaDaFoto] = useState(false);
  const [removendo, setRemovendo] = useState<'perguntar' | 'removendo' | null>(null);
  const [saida, setSaida] = useState<(() => void) | null>(null);
  const campoNome = useRef<ComponentRef<typeof TextInput>>(null);
  const campoResumo = useRef<ComponentRef<typeof TextInput>>(null);
  const privacidade = useRef<ComponentRef<typeof Text>>(null);
  // "Tirar foto" só em tela de toque, como na web: no aparelho, sempre; na prévia web, com ponteiro grosso.
  const toque = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);

  const nomeNormal = normalizarNomePerfil(nome);
  const resumoNormal = normalizarResumoPerfil(resumo);
  const usados = [...resumoNormal].length;
  const alterado = nomeNormal !== (salvo.nome ?? '') || cor !== (salvo.cor ?? 'azul') || resumoNormal !== (salvo.resumo ?? '')
    || interesses.join() !== salvo.interesses.join();
  const comErroDeCampo = Boolean(erros.nome || erros.resumo);

  // Aberto pelo "Editar", o leitor de tela vai para o alto do bloco; pelo convite do resumo, o foco vai para o resumo.
  useEffect(() => {
    const espera = setTimeout(() => {
      if (focarNome) campoNome.current?.focus();
      else if (focarResumo) campoResumo.current?.focus();
      else if (aoCancelar) focarSemRolar(privacidade.current);
    }, focarNome ? 400 : 160);
    return () => clearTimeout(espera);
    // Só ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** "Cancelar": com alteração, a mesma confirmação da saída ("Sair sem salvar?"); sem, volta para o cabeçalho. */
  function cancelar() {
    if (!aoCancelar) return;
    const fechar = () => { registrarGuarda(null); aoCancelar(); };
    if (alteradoRef.current) setSaida(() => fechar);
    else fechar();
  }

  async function salvar() {
    // Nome vazio tem a mensagem própria ("Escreva como você quer aparecer."); os outros motivos vêm do contrato.
    const motivoNome = nomeNormal === '' ? 'vazio' : motivoNomeInvalido(nomeNormal);
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
    setSalvando(true);
    try {
      const novo = await cliente.salvarPerfil(nomeNormal, cor, { resumo: resumoNormal, interesses });
      atualizarPerfil(novo);
      setNome(novo.nome ?? '');
      setResumo(novo.resumo ?? '');
      setInteresses(novo.interesses);
      registrarGuarda(null);
      aoSalvo();
    } catch {
      // Erro de rede: os campos guardam o que foi digitado e a barra diz o que houve.
      setErroGeral(p.salvarErroRede);
    } finally {
      setSalvando(false);
    }
  }

  /** Galeria ou câmera do sistema (P18); o recorte quadrado é o do Studoo, como na web. */
  async function escolherFoto(camera: boolean) {
    setErroFoto(null);
    setStatusFoto('');
    try {
      const imagem = await escolherImagem(camera);
      if (imagem) setParaRecortar(imagem);
    } catch {
      setErroFoto(p.fotoIlegivel);
    }
  }

  /** "Usar esta foto": a foto vai na hora, à parte do botão "Salvar"; o erro do envio aparece na folha do recorte. */
  async function enviarFotoRecortada(base64: string) {
    const novo = await cliente.enviarFoto(base64);
    atualizarPerfil(novo);
    setParaRecortar(null);
    // Spec 14: a foto nova fica em revisão; o aviso nunca diz que ela já aparece para os outros.
    const frase = novo.fotoModeracao === 'pendente' ? mensagens.seguranca.enviadaParaRevisao : p.fotoSalva;
    setStatusFoto(frase);
    anunciar(frase);
  }

  /** As opções da foto, na folha do Studoo: galeria, câmera (só em tela de toque) e remover (só com foto). */
  const opcoesDaFoto: AcaoDaFolha[] = [
    { rotulo: p.fotoGaleria, icone: 'imagem', testID: 'foto-galeria', aoEscolher: () => void escolherFoto(false) },
    ...(toque ? [{ rotulo: p.fotoCamera, icone: 'camera' as const, testID: 'foto-camera', aoEscolher: () => void escolherFoto(true) }] : []),
    ...(salvo.foto ? [{ rotulo: p.fotoRemover, icone: 'lixeira' as const, perigo: true, testID: 'foto-remover', aoEscolher: () => setRemovendo('perguntar') }] : []),
  ];
  /** Tocar na foto ou no link: com uma opção só (no computador, sem foto), o seletor abre direto. */
  function tocarNaFoto() {
    if (opcoesDaFoto.length === 1) opcoesDaFoto[0].aoEscolher();
    else setFolhaDaFoto(true);
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

  // As ações da linha leem o estado atual por referência (a linha e o bloco preso só são trocados quando o que mostram muda).
  const acoesDaBarra = useRef({ salvar, cancelar });
  acoesDaBarra.current = { salvar, cancelar };
  const comCancelar = Boolean(aoCancelar);
  const larguraDoBotao = comCancelar && width < 400 ? 104 : 120;
  // Com "Cancelar" e "Salvar" numa tela de até 400, o estado encurta para "Não salvo", para caber numa linha (spec 10).
  const textoNaoSalvo = comCancelar && width <= 400 ? p.naoSalvoCurto : p.alteracoesNaoSalvas;
  const erroNaBarra = comErroDeCampo ? p.corrigirCampos : erroGeral;
  // Spec 10, 56aac7e: a linha de ações (estado, "Cancelar" e "Salvar") fica no fluxo, no fim do cartão. Sem alteração, não
  // há estado, "Salvar" fica desligado e nada fica preso na tela. Com alteração (ou erro, ou salvando) e a linha fora da
  // vista, o mesmo conteúdo vira o bloco preso da spec 05, 12 acima da cápsula; volta ao lugar quando a linha aparece, e
  // some com o teclado aberto. Nunca duas cópias para o leitor de tela.
  const pendente = alterado || salvando || Boolean(erroNaBarra);
  const linha = useRef<ComponentRef<typeof View>>(null);
  const [alturaLinha, setAlturaLinha] = useState(0);
  const [foraDaVista, setForaDaVista] = useState(false);
  const [teclado, setTeclado] = useState(false);
  const baixoOcupado = useContext(BaixoOcupado);
  const preso = pendente && foraDaVista && !teclado;
  const presoAgora = useRef(preso);
  presoAgora.current = preso;
  const medida = useRef({ baixoOcupado, alturaJanela, alturaLinha });
  medida.current = { baixoOcupado, alturaJanela, alturaLinha };
  const medir = useCallback(() => {
    linha.current?.measureInWindow((_x, y, _largura, altura) => {
      const { baixoOcupado: ocupado, alturaJanela: janela, alturaLinha: propria } = medida.current;
      // O que a cápsula ocupa embaixo, sem o próprio bloco preso (que a Tela também conta quando está à vista).
      const capsula = ocupado - (presoAgora.current ? CAPSULA.acimaDaCapsula + propria + 16 : 0);
      setForaDaVista(y + altura > janela - capsula || y + altura < 0);
    });
  }, []);
  useEffect(() => inscreverRolagem(medir), [inscreverRolagem, medir]);
  useEffect(() => { medir(); }, [medir, pendente, alturaLinha, baixoOcupado, alturaJanela]);
  useEffect(() => {
    const abre = Keyboard.addListener('keyboardDidShow', () => setTeclado(true));
    const fecha = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
    return () => { abre.remove(); fecha.remove(); };
  }, []);
  const conteudoDaBarra = (
    <>
      <View accessibilityLiveRegion="polite" style={perfilEstilos.estado}>
        {salvando ? <Text testID="editar-estado" style={[perfilEstilos.estadoTexto, { color: cores.textoSecundario }]}>{p.salvando}</Text>
          : erroNaBarra ? (
            <>
              <Icone nome="alerta" tamanho={18} cor={cores.erro} />
              <Text testID="editar-estado" style={[perfilEstilos.estadoTexto, { color: cores.erro }]}>{erroNaBarra}</Text>
            </>
          ) : alterado ? (
            <>
              <View style={perfilEstilos.estadoPonto} />
              <Text testID="editar-estado" style={[perfilEstilos.estadoTexto, { color: cores.alerta }]}>{textoNaoSalvo}</Text>
            </>
          ) : null}
      </View>
      <View style={perfilEstilos.botoes}>
        {comCancelar && <Botao rotulo={p.cancelar} variante="secundario" testID="editar-cancelar" desativado={salvando}
          acao={() => acoesDaBarra.current.cancelar()} estilo={{ minWidth: larguraDoBotao }} />}
        <Botao rotulo={salvando ? p.salvando : p.salvar} testID="editar-salvar" desativado={!alterado} ocupado={salvando}
          acao={() => void acoesDaBarra.current.salvar()} estilo={{ minWidth: larguraDoBotao }} />
      </View>
    </>
  );
  useEffect(() => {
    definirRodape(preso ? <View testID="editar-barra-presa" style={perfilEstilos.barra}>{conteudoDaBarra}</View> : null);
    // O bloco é trocado quando o que ele mostra muda; as ações leem o estado atual por referência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preso, alterado, salvando, erroNaBarra, comCancelar, larguraDoBotao, textoNaoSalvo, definirRodape]);
  useEffect(() => () => definirRodape(null), [definirRodape]);

  return (
    <View testID="editor-perfil" style={perfilEstilos.editor}>
      {/* A frase de privacidade sobe para o alto dos campos, com o cadeado (no lugar de "É assim que as pessoas te veem…"). */}
      <View style={perfilEstilos.privacidade}>
        <View style={perfilEstilos.privacidadeIcone}><Icone nome="cadeado" tamanho={16} cor={cores.textoSecundario} /></View>
        <Text ref={privacidade} testID="perfil-privacidade" style={perfilEstilos.privacidadeTexto}>{p.privacidade}</Text>
      </View>

      <View style={perfilEstilos.fotoLinha}>
        {/* A foto (ou a inicial na cor; sem nome e sem foto, o desenho de pessoa) com o selo de câmera: tocar abre a folha. */}
        <Pressable testID="foto-circulo" accessibilityRole="button" accessibilityLabel={salvo.foto ? p.fotoTrocar : p.fotoAdicionar}
          disabled={salvando} onPress={tocarNaFoto} style={({ pressed }) => [perfilEstilos.circulo, pressed && { opacity: 0.85 }]}>
          <Avatar daDona nome={nomeNormal} cor={cor} foto={salvo.foto} tamanho="g" vazio={!nomeNormal} estilo={perfilEstilos.fotoAvatar} />
          <View style={perfilEstilos.selo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Icone nome="camera" tamanho={20} cor="#FFFFFF" />
          </View>
        </Pressable>
        <View style={perfilEstilos.fotoTexto}>
          <Pressable testID="foto-link" accessibilityRole="button" disabled={salvando} onPress={tocarNaFoto} hitSlop={6}
            style={({ pressed }) => [perfilEstilos.fotoLink, pressed && { opacity: 0.7 }]}>
            <Text style={perfilEstilos.fotoLinkTexto}>{salvo.foto ? p.fotoTrocar : p.fotoAdicionar}</Text>
          </Pressable>
          <Text style={perfilEstilos.dica}>{p.fotoDica}</Text>
          <AvisoMidiaEmRevisao tipo="foto" moderacao={salvo.fotoModeracao} />
          {erroFoto && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erroFoto}</Text>}
          <Status texto={statusFoto} />
        </View>
      </View>

      <View style={perfilEstilos.campo}>
        <Campo rotulo={m.nomeRotulo} erroComAlerta campoRef={campoNome} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words" testID="editar-nome"
          editable={!salvando} erro={erros.nome} accessibilityHint={erros.nome ? undefined : p.nomeDica}
          onChangeText={(texto) => { setNome(texto); setErroGeral(null); if (erros.nome) setErros((atual) => ({ ...atual, nome: undefined })); }} />
        {/* A dica some enquanto o erro estiver na tela. */}
        {!erros.nome && <Text style={perfilEstilos.dica}>{p.nomeDica}</Text>}
      </View>

      <View style={perfilEstilos.campo}>
        <Contador rotulo={p.resumoRotulo} usados={usados} maximo={LIMITES_PERFIL.resumoMax} />
        <Campo rotulo={p.resumoRotulo} rotuloOculto erroComAlerta campoRef={campoResumo} value={resumo} multiline numberOfLines={3} maxLength={240} testID="editar-resumo"
          editable={!salvando} erro={erros.resumo}
          accessibilityHint={`${erros.resumo ? '' : `${p.resumoDica} `}${p.resumoContadorLeitor(LIMITES_PERFIL.resumoMax - usados)}`} style={{ minHeight: 104 }}
          onChangeText={(texto) => { setResumo(texto.replace(/[\r\n]+/g, ' ')); setErroGeral(null); if (erros.resumo) setErros((atual) => ({ ...atual, resumo: undefined })); }} />
        {!erros.resumo && <Text style={perfilEstilos.dica}>{p.resumoDica}</Text>}
      </View>

      <View style={perfilEstilos.campo} accessibilityLabel={p.interessesCampoRotulo}>
        <Text style={perfilEstilos.rotulo}>{p.interessesCampoRotulo}</Text>
        <Text style={perfilEstilos.dica}>{p.interessesDica(LIMITES_PERFIL.interessesMax)} {p.interessesContador(interesses.length, LIMITES_PERFIL.interessesMax)}</Text>
        <View style={socialEstilos.fichas}>
          {TEMAS.map((tema) => (
            <Ficha key={tema} rotulo={mensagens.temas[tema]} marcada={interesses.includes(tema)} aoTocar={() => alternarTema(tema, !interesses.includes(tema))} />
          ))}
        </View>
        {avisoInteresses !== '' && <Text accessibilityLiveRegion="polite" style={socialEstilos.erro}>{avisoInteresses}</Text>}
      </View>

      <CoresDoPerfil cor={cor} aoEscolher={setCor} dica={p.corDica} />

      {/* A linha de ações no fim do cartão. Com o bloco preso à vista, ela fica escondida do leitor de tela (uma cópia só). */}
      <View ref={linha} testID="editar-barra" onLayout={(evento) => setAlturaLinha(evento.nativeEvent.layout.height)}
        importantForAccessibility={preso ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={preso}
        style={[perfilEstilos.barra, preso && { opacity: 0 }]} pointerEvents={preso ? 'none' : 'auto'}>
        {conteudoDaBarra}
      </View>

      <FolhaDeAcoes visivel={folhaDaFoto} titulo={p.fotoFolhaTitulo} acoes={opcoesDaFoto} cancelarRotulo={p.fotoMenuCancelar} testID="folha-foto"
        aoFechar={() => setFolhaDaFoto(false)} />
      {paraRecortar && (
        // O recorte do Studoo, quadrado, com o círculo que mostra como o avatar fica (no lugar do recorte do sistema).
        <RecorteImagem imagem={paraRecortar} aoCancelar={() => setParaRecortar(null)} enviar={enviarFotoRecortada} />
      )}
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

/**
 * Perfil sem o compartilhar (o servidor sem `compartilhar` no /api/auth/config): as seções que valem para toda conta e
 * visitante, sem a parte social e sem pedir o /api/perfil. Som, Privacidade e dados (o uso de IA, a política e "Excluir
 * conta": Apple 5.1.2(i) e 5.1.1(v)) e Conta, com Sair. Se é visitante vem de /api/sessao. Como a web na revisão do
 * TestFlight (20/11): o caminho para revogar a IA e excluir a conta nunca depende do compartilhar.
 */
export function PerfilSemSocial({ cliente, acoes, desativado, sair, aoSessaoTerminada }: {
  cliente: ClienteNativo;
  aoSessaoTerminada?: () => void;
  acoes?: ReactNode;
  desativado: boolean;
  sair: () => void;
}) {
  const [visitante, setVisitante] = useState(false);
  useEffect(() => {
    let ativo = true;
    cliente.sessao().then((dados) => { if (ativo) setVisitante(dados.visitante === true); })
      .catch((falha) => { if (ativo && sessaoInvalida(falha)) aoSessaoTerminada?.(); });
    return () => { ativo = false; };
  }, [cliente]);
  return (
    <Tela pagina="perfil" acoes={acoes} estiloConteudo={FIM_COM_BARRA}>
      <View style={perfilEstilos.painel}>
        <Titulo testID="titulo-perfil" foco>{p.titulo}</Titulo>
        <View style={perfilEstilos.secao}>
          <TituloSecao>{mensagens.som.titulo}</TituloSecao>
          <SomNoPerfil />
        </View>
        <View style={perfilEstilos.secao}>
          <TituloSecao>{mensagens.privacidade.secaoTitulo}</TituloSecao>
          <SecaoPrivacidade desativado={desativado} />
        </View>
        <View style={perfilEstilos.secao}>
          <TituloSecao>{mensagens.seguranca.ajudaTitulo}</TituloSecao>
          <SecaoAjuda desativado={desativado} />
        </View>
        <View style={perfilEstilos.secao}>
          <TituloSecao>{p.conta}</TituloSecao>
          <Botao rotulo={mensagens.sair} testID="sair" variante="secundario" desativado={desativado} acao={sair} estilo={{ alignSelf: 'flex-start' }} />
          <BotaoExcluirConta desativado={desativado} visitante={visitante} />
        </View>
      </View>
    </Tela>
  );
}

const perfilEstilos = StyleSheet.create({
  // .perfil-secao__linha da web: o texto de apoio embaixo do título da seção.
  linhaSecao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, marginTop: -4 },
  // .painel--perfil: grade com vão de 20; o título "Perfil" no tamanho de título de página (o <Titulo> de 32/40), como a web.
  painel: { gap: 20 },
  secao: { gap: 10 },
  secaoCabeca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8 },
  postarVazio: { gap: 12, alignItems: 'flex-start' },
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

  // Editor (esboço do Designer, .editor): bloco com borda de 2 e cantos de 24, respiro de 18 e 18 entre os campos.
  editor: { gap: 18, padding: 18, borderWidth: 2, borderColor: cores.gelo, borderRadius: 24, backgroundColor: cores.fundo },
  // .privacidade: o cadeado de 16 e a frase em Nunito 700 de 14/20, cinza.
  privacidade: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privacidadeIcone: { marginTop: 2 },
  privacidadeTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  // .foto-linha: o avatar de 96 e, ao lado, o link e a dica.
  fotoLinha: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  circulo: { borderRadius: 999 },
  fotoAvatar: { borderWidth: 4, borderColor: '#FFFFFF', shadowColor: cores.texto, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  // .avatar .selo: 40 × 40 na cor da ação, borda branca de 3, ícone de 20, 6 para fora no canto de baixo à direita.
  selo: { position: 'absolute', right: -6, bottom: -6, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
    borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: cores.acao,
    shadowColor: cores.texto, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  fotoTexto: { flex: 1, gap: 2, minWidth: 0 },
  fotoLink: { alignSelf: 'flex-start' },
  fotoLinkTexto: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '800' },
  // .campo: rótulo, caixa e dica com 6 entre eles; .dica em Nunito 400 de 14/20.
  campo: { gap: 6 },
  rotulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  dica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  // .barra-salvar: na largura da tela, 72 de altura (12 + 48 + 12), fundo branco e a linha de 1 em cima.
  barraFundo: { backgroundColor: cores.fundo, borderTopWidth: 1, borderTopColor: cores.gelo },
  barraConteudo: { paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  estado: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  estadoPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.alerta },
  estadoTexto: { flexShrink: 1, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  botoes: { flexDirection: 'row', gap: 8 },
  // .acoes-perfil: "Editar" e "Compartilhar" lado a lado, metade cada, com 8 entre eles.
  acoesPerfil: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  acaoPerfil: { flex: 1 },
  // .botao--44: 44 de altura, 16 de texto e 14 de folga dos lados; sem "Compartilhar", "Editar" ocupa a fileira.
  botaoMetade: { alignSelf: 'stretch', minHeight: 44, paddingHorizontal: 14 },
});
