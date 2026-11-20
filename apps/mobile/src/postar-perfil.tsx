import { useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LinkCompartilhado, Perfil, PlanoResumo, Tema } from '@studoo/contratos';
import { codigoDaFalha, type ClienteNativo } from './api-nativa';
import { CapaTrilha } from './comunidade';
import { Icone } from './icone';
import { AvisoDoApp, AvisoSobreAFolha, Botao, CartaoConfirmacao, useMovimentoReduzido } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { LinhaDasRegras, abrirPaginaDoStudoo } from './seguranca';
import { Chave, socialEstilos } from './social';
import { cores, fontes } from './tema';

/*
 * Postar no perfil (spec 10, "Postar no perfil", 20/11; pedido do dono): a pessoa escolhe quais trilhas aparecem no perfil
 * dela, numa folha da spec 11 com uma chave da spec 12 por trilha, e pelo atalho do "•••" de Minhas trilhas. Sem rota nova:
 * ligar cria o link quando falta (POST /api/aprendizado/planos/:id/compartilhar) e põe no perfil (PATCH /api/compartilhar/
 * :codigo { visibilidade: 'perfil' }); desligar volta para "Só com o link". "No Explorar" inclui o perfil (seção 5), então
 * desligar uma trilha que está no Explorar pede a confirmação azul. Textos do contrato (`mensagens.perfil.postar`).
 */

const t = mensagens.perfil.postar;
const seg = mensagens.seguranca;

export type EstadoNoPerfil = 'fora' | 'revisao' | 'perfil' | 'perfilExplorar' | 'recusada';

/** Onde a trilha está, pelo link dela: fora do perfil, em revisão, no perfil, no perfil e no Explorar, ou não publicada. */
export function estadoNoPerfil(link?: Pick<LinkCompartilhado, 'noPerfil' | 'visibilidade' | 'moderacao'> | null): EstadoNoPerfil {
  if (!link) return 'fora';
  const nivel = link.visibilidade ?? (link.noPerfil ? 'perfil' : 'link');
  if (nivel === 'link') return 'fora';
  if (link.moderacao === 'recusado') return 'recusada';
  if (link.moderacao === 'pendente') return 'revisao';
  return nivel === 'explorar' ? 'perfilExplorar' : 'perfil';
}

/** A trilha aparece (ou vai aparecer, depois da revisão) no perfil: a chave fica ligada. */
export const ligadaNoPerfil = (estado: EstadoNoPerfil) => estado !== 'fora';

/** O aviso depois de postar: pendente nunca diz que já está no perfil (spec 14). */
/** O erro de uma tentativa: o limite de publicações usa o texto de limite que já existe; o resto, "Não deu para salvar…". */
export const erroDePostar = (falha: unknown) => (codigoDaFalha(falha) === 'limite_compartilhar' ? mensagemDeErro(falha) : t.erro);

export const avisoDoPostado = (novo: LinkCompartilhado) => (novo.moderacao === 'pendente' ? seg.enviadaParaRevisao : t.aviso);

/**
 * Ligar, desligar e desfazer, com os avisos e a confirmação ao tirar do Explorar: um só lugar para a folha e para o atalho do
 * "•••". `aoMudarLink` recebe o link novo (ou o mesmo, com outro nível) para a lista e o Perfil se atualizarem.
 */
export function useAcoesDePostar({ cliente, aoMudarLink }: { cliente: ClienteNativo; aoMudarLink: (planoId: string, link: LinkCompartilhado) => void }) {
  const { avisar } = useContext(AvisoDoApp);
  const [confirmando, setConfirmando] = useState<{ link: LinkCompartilhado; resolver: (feito: boolean) => void } | null>(null);
  const [tirando, setTirando] = useState(false);

  async function ligar(planoId: string, link?: LinkCompartilhado | null) {
    const comLink = link ?? (await cliente.criarLink(planoId));
    if (!link) aoMudarLink(planoId, comLink);
    const novo = await cliente.definirVisibilidade(comLink.codigo, 'perfil');
    aoMudarLink(planoId, novo);
    avisar(avisoDoPostado(novo), { icone: 'check' });
    return novo;
  }

  /** Volta ao nível de antes (Desfazer): perfil, ou Explorar com o tema e a legenda que tinha. */
  async function voltar(planoId: string, antes: LinkCompartilhado) {
    try {
      const novo = antes.visibilidade === 'explorar' && antes.tema
        ? await cliente.definirVisibilidade(antes.codigo, 'explorar', { tema: antes.tema as Tema, legenda: antes.legenda ?? undefined })
        : await cliente.definirVisibilidade(antes.codigo, 'perfil');
      aoMudarLink(planoId, novo);
      avisar(avisoDoPostado(novo), { icone: 'check' });
    } catch (falha) {
      avisar(mensagemDeErro(falha), { icone: 'alerta' });
    }
  }

  async function tirar(planoId: string, link: LinkCompartilhado) {
    const novo = await cliente.definirVisibilidade(link.codigo, 'link');
    aoMudarLink(planoId, novo);
    avisar(t.avisoTirada, { icone: 'check', acao: { rotulo: seg.desfazer, aoTocar: () => void voltar(planoId, link) } });
    return novo;
  }

  /** Desligar: só no perfil, na hora; no Explorar, depois de "Tirar" na confirmação. Devolve null se a pessoa cancelou. */
  async function desligar(planoId: string, link: LinkCompartilhado): Promise<LinkCompartilhado | null> {
    if (link.visibilidade === 'explorar') {
      const feito = await new Promise<boolean>((resolver) => setConfirmando({ link, resolver }));
      if (!feito) return null;
    }
    return tirar(planoId, link);
  }

  const confirmacao = confirmando ? (
    <CartaoConfirmacao testID="postar-confirmacao" mensagem={t.confirmarTitulo} texto={t.confirmarTexto} confirmarRotulo={t.confirmarAcao}
      cancelarRotulo={seg.cancelar} ocupado={tirando}
      aoCancelar={() => { confirmando.resolver(false); setConfirmando(null); }}
      aoConfirmar={() => { setTirando(true); confirmando.resolver(true); setConfirmando(null); setTirando(false); }} />
  ) : null;
  return { ligar, desligar, confirmacao };
}

type Linha = { plano: PlanoResumo; link: LinkCompartilhado | null };

/**
 * A folha "Postar no perfil" (spec 11): título, texto, a linha das regras (spec 14) e a lista das trilhas da pessoa, na
 * ordem de Minhas trilhas e sem as recebidas, cada uma com a capa, o título, o estado e a chave. Sem nome no perfil, o
 * convite para escolher como aparece; sem trilhas, "Nova trilha".
 */
export function FolhaPostarNoPerfil({ cliente, perfil, aoFechar, aoMudarLink, editarPerfil, novaTrilha }: {
  cliente: ClienteNativo;
  perfil: Perfil;
  aoFechar: () => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado) => void;
  editarPerfil: () => void;
  novaTrilha: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroDe, setErroDe] = useState<Record<string, string | null>>({});
  const [otimista, setOtimista] = useState<Record<string, boolean>>({});
  const mudar = (planoId: string, link: LinkCompartilhado) => {
    setLinhas((atual) => atual && atual.map((l) => (l.plano.id === planoId ? { ...l, link } : l)));
    aoMudarLink(planoId, link);
  };
  const { ligar, desligar, confirmacao } = useAcoesDePostar({ cliente, aoMudarLink: mudar });
  const semNome = !perfil.nome?.trim();

  useEffect(() => {
    if (semNome) return;
    let ativo = true;
    cliente.listarPlanos().then((planos) => {
      if (!ativo) return;
      const porPlano = new Map(perfil.links.map((link) => [link.planoId, link]));
      setLinhas(planos.filter((plano) => !plano.recebida).map((plano) => ({ plano, link: porPlano.get(plano.id) ?? null })));
    }).catch((falha) => { if (ativo) setErroLista(mensagemDeErro(falha)); });
    return () => { ativo = false; };
    // A lista é lida uma vez ao abrir; as mudanças da própria folha entram por `mudar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, semNome]);

  async function alternar(linha: Linha, ligada: boolean) {
    const id = linha.plano.id;
    setErroDe((atual) => ({ ...atual, [id]: null }));
    setOtimista((atual) => ({ ...atual, [id]: ligada }));
    setSalvando(id);
    try {
      if (ligada) await ligar(id, linha.link);
      else if (linha.link) await desligar(id, linha.link);
    } catch (falha) {
      setErroDe((atual) => ({ ...atual, [id]: erroDePostar(falha) }));
    } finally {
      setOtimista((atual) => { const resto = { ...atual }; delete resto[id]; return resto; });
      setSalvando(null);
    }
  }

  return (
    <Modal transparent visible animationType={reduzir === false ? 'slide' : 'none'} statusBarTranslucent onRequestClose={aoFechar}>
      <View style={socialEstilos.folhaFundo}>
        <Pressable testID="postar-fundo" accessible={false} style={StyleSheet.absoluteFill} onPress={aoFechar} />
        <View testID="folha-postar" accessibilityViewIsModal role="dialog" aria-modal style={[socialEstilos.folha, { paddingBottom: 20 + insets.bottom }]}>
          <ScrollView contentContainerStyle={socialEstilos.folhaConteudo} bounces={false}>
            <View style={estilosPostar.topo}>
              <Text accessibilityRole="header" style={socialEstilos.folhaTitulo}>{t.titulo}</Text>
              <Pressable testID="postar-fechar" accessibilityRole="button" accessibilityLabel={mensagens.compartilhar.fechar} onPress={aoFechar} hitSlop={8} style={estilosPostar.fechar}>
                <Icone nome="fechar" tamanho={22} cor={cores.texto} />
              </Pressable>
            </View>
            <Text style={estilosPostar.texto}>{t.texto}</Text>
            <LinhaDasRegras />
            {semNome ? (
              <View testID="postar-sem-nome" style={estilosPostar.bloco}>
                <Text style={estilosPostar.textoForte}>{t.semNome}</Text>
                <Botao rotulo={t.editarPerfil} testID="postar-editar-perfil" variante="secundario" acao={editarPerfil} estilo={{ alignSelf: 'flex-start' }} />
              </View>
            ) : erroLista ? (
              <Text accessibilityRole="alert" style={estilosPostar.erro}>{erroLista}</Text>
            ) : !linhas ? (
              <Text style={estilosPostar.texto}>{mensagens.carregando}</Text>
            ) : linhas.length === 0 ? (
              <View testID="postar-sem-trilhas" style={estilosPostar.bloco}>
                <Text style={estilosPostar.textoForte}>{t.semTrilhas}</Text>
                <Botao rotulo={mensagens.planos.novo} testID="postar-nova-trilha" acao={novaTrilha} estilo={{ alignSelf: 'flex-start' }} />
              </View>
            ) : (
              <View testID="postar-lista" style={estilosPostar.lista}>
                {linhas.map((linha) => (
                  <LinhaDaTrilha key={linha.plano.id} linha={linha} salvando={salvando === linha.plano.id} erro={erroDe[linha.plano.id] ?? null}
                    ligadaOtimista={otimista[linha.plano.id]} desativada={salvando !== null} aoMudar={(ligada) => void alternar(linha, ligada)} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
        {/* "Trilha no seu perfil.", "Enviada para revisão…" e "Desfazer" por cima da folha, onde a pessoa os vê e toca. */}
        <AvisoSobreAFolha baixo={16 + insets.bottom} />
      </View>
      {confirmacao}
    </Modal>
  );
}

function LinhaDaTrilha({ linha, salvando, erro, ligadaOtimista, desativada, aoMudar }: {
  linha: Linha; salvando: boolean; erro: string | null; ligadaOtimista?: boolean; desativada: boolean; aoMudar: (ligada: boolean) => void;
}) {
  const estado = estadoNoPerfil(linha.link);
  const ligada = ligadaOtimista ?? ligadaNoPerfil(estado);
  const semente = linha.link?.codigo ?? linha.plano.id;
  let linhaDeEstado: ReactNode = null;
  if (salvando) linhaDeEstado = <Text style={estilosPostar.estado}>{t.salvando}</Text>;
  else if (erro) linhaDeEstado = <Text accessibilityRole="alert" style={[estilosPostar.estado, { color: cores.erro }]}>{erro}</Text>;
  else if (estado === 'revisao') linhaDeEstado = <View style={estilosPostar.selo}><Text style={estilosPostar.seloTexto}>{seg.seloEmRevisao}</Text></View>;
  else if (estado === 'perfil') linhaDeEstado = <Text style={estilosPostar.estado}>{t.estadoPerfil}</Text>;
  else if (estado === 'perfilExplorar') linhaDeEstado = <Text style={estilosPostar.estado}>{t.estadoPerfilExplorar}</Text>;
  else if (estado === 'recusada') linhaDeEstado = (
    <View style={estilosPostar.recusada}>
      <View style={[estilosPostar.selo, estilosPostar.seloAlerta]}><Text style={[estilosPostar.seloTexto, { color: '#9A5B00' }]}>{seg.seloNaoPublicada}</Text></View>
      <Text accessibilityRole="link" onPress={() => abrirPaginaDoStudoo(seg.rotas.suporte)} style={estilosPostar.link}>{seg.falarComSuporte}</Text>
    </View>
  );
  return (
    <View testID={`postar-linha-${linha.plano.id}`} style={estilosPostar.linha}>
      <View style={estilosPostar.capa}><CapaTrilha codigo={semente} tema={linha.plano.tema ?? null} capa={linha.plano.capa ?? null} /></View>
      <View style={estilosPostar.miolo}>
        <Text numberOfLines={1} style={estilosPostar.titulo}>{linha.plano.titulo}</Text>
        {linhaDeEstado}
      </View>
      <Chave rotulo={linha.plano.titulo} nomeAcessivel={`${t.titulo}: ${linha.plano.titulo}`} ligada={ligada} desativada={desativada} aoMudar={aoMudar} semTexto />
    </View>
  );
}

const estilosPostar = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  texto: { color: '#5E6A85', fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  textoForte: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  erro: { color: cores.erro, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  bloco: { gap: 12, paddingVertical: 4 },
  lista: { borderWidth: 2, borderColor: cores.gelo, borderRadius: 16, overflow: 'hidden' },
  linha: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: cores.gelo },
  capa: { width: 56, height: 40, flexShrink: 0, borderRadius: 8, overflow: 'hidden', backgroundColor: cores.gelo },
  miolo: { flex: 1, minWidth: 0, gap: 4 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  estado: { color: '#5E6A85', fontFamily: fontes.corpo, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  selo: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, backgroundColor: '#F1F4FD' },
  seloTexto: { color: '#5E6A85', fontFamily: fontes.corpo, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  seloAlerta: { backgroundColor: '#FFF6EA' },
  recusada: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  link: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 18, fontWeight: '800', textDecorationLine: 'underline' },
});
