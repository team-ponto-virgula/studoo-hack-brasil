import { useCallback, useContext, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { origemConfigurada, type ClienteNativo } from './api-nativa';
import { Icone } from './icone';
import { AvisoDoApp, Botao, estilos } from './interface';
import * as WebBrowser from 'expo-web-browser';
import { mensagemDeErro, mensagens } from './mensagens';
import { cores, fontes } from './tema';

/*
 * Segurança da comunidade no app (spec 14, regra 1.2 da Apple), a parte que não é o bloqueio nem a denúncia dos cartões
 * (essas ficam em comunidade.tsx): a lista "Pessoas bloqueadas" e a seção "Ajuda" do Perfil, o "Precisa de ajuda?" da
 * entrada e da recuperação de senha, e o estado de revisão do que a pessoa publicou. Textos do contrato
 * (`mensagens.seguranca`). As páginas do Studoo (/suporte e /privacidade) abrem no navegador do sistema (P20 da spec 07).
 */

const s = mensagens.seguranca;
export type EstadoModeracao = 'pendente' | 'aprovado' | 'recusado' | null | undefined;

/** Uma página do Studoo na origem configurada do app (sem /api): /suporte, /privacidade, a âncora das regras. */
export function enderecoDoStudoo(caminho: string) {
  try {
    return new URL(caminho, origemConfigurada()).toString();
  } catch {
    return null;
  }
}

/** Abre a página no navegador do sistema, por cima do app (como `abrirNoNavegador` de social.tsx, sem importar a tela social). */
export function abrirPaginaDoStudoo(caminho: string) {
  const url = enderecoDoStudoo(caminho);
  if (url) void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

/** "Precisa de ajuda? Fale com o suporte": botão de texto de 44, embaixo de "Esqueci minha senha" e na recuperação. */
export function BotaoPrecisaDeAjuda({ desativado = false, testID = 'precisa-de-ajuda' }: { desativado?: boolean; testID?: string }) {
  if (!enderecoDoStudoo(s.rotas.suporte)) return null;
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityState={{ disabled: desativado }} disabled={desativado} hitSlop={{ top: 2, bottom: 2 }}
      onPress={() => abrirPaginaDoStudoo(s.rotas.suporte)} style={seg.ajudaEntrada}>
      <Text style={seg.ajudaEntradaTexto}>{s.precisaDeAjuda}</Text>
    </Pressable>
  );
}

/** Seção "Ajuda" do Perfil: suporte, regras da comunidade e política, as três no navegador do sistema. */
export function SecaoAjuda({ desativado = false }: { desativado?: boolean }) {
  const itens = [
    { rotulo: s.falarComSuporte, caminho: s.rotas.suporte, testID: 'ajuda-suporte' },
    { rotulo: s.regras, caminho: s.rotas.regras, testID: 'ajuda-regras' },
    { rotulo: s.politica, caminho: s.rotas.politica, testID: 'ajuda-politica' },
  ];
  return (
    <View testID="ajuda" style={seg.lista}>
      {itens.map((item) => (
        <Pressable key={item.testID} testID={item.testID} accessibilityRole="link" disabled={desativado} accessibilityState={{ disabled: desativado }}
          onPress={() => abrirPaginaDoStudoo(item.caminho)} style={({ pressed }) => [seg.linha, pressed && { backgroundColor: cores.nevoa }]}>
          <Text style={seg.linhaTexto}>{item.rotulo}</Text>
          <Icone nome="seta" tamanho={18} cor={cores.textoSecundario} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * "Pessoas bloqueadas" no Perfil (GET /api/bloqueios): o nome e "Desbloquear" em cada linha, sem confirmação, com o aviso
 * "Pessoa desbloqueada."; vazia, "Ninguém bloqueado.". `versao` muda quando alguém é bloqueado em outra tela.
 */
export function SecaoBloqueadas({ cliente, desativado = false, versao = 0 }: { cliente: ClienteNativo; desativado?: boolean; versao?: number }) {
  const [itens, setItens] = useState<{ id: string; nome: string; perfilId: string | null }[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const { avisar } = useContext(AvisoDoApp);
  const carregar = useCallback(() => {
    let ativo = true;
    setErro(null);
    cliente.bloqueados().then((dados) => { if (ativo) setItens(dados.itens); })
      .catch((falha) => { if (ativo) setErro(mensagemDeErro(falha)); });
    return () => { ativo = false; };
  }, [cliente]);
  useEffect(() => carregar(), [carregar, versao]);

  async function desbloquear(id: string) {
    setOcupado(id);
    try {
      await cliente.desbloquear(id);
      setItens((atual) => atual && atual.filter((item) => item.id !== id));
      avisar(s.desbloqueada, { icone: 'check' });
    } catch (falha) {
      avisar(mensagemDeErro(falha), { icone: 'alerta' });
    } finally {
      setOcupado(null);
    }
  }

  if (erro) return <Text accessibilityRole="alert" style={seg.erro}>{erro}</Text>;
  if (!itens) return <Text style={seg.carregando}>{mensagens.carregando}</Text>;
  if (itens.length === 0) return <Text testID="bloqueadas-vazia" style={estilos.texto}>{s.bloqueadasVazia}</Text>;
  return (
    <View testID="bloqueadas" style={seg.lista}>
      {itens.map((item) => (
        <View key={item.id} testID={`bloqueada-${item.id}`} style={seg.linha}>
          <Text style={seg.linhaTexto} numberOfLines={2}>{item.nome}</Text>
          <Botao rotulo={s.desbloquear} nomeAcessivel={s.desbloquearRotulo(item.nome)} variante="secundario" compacto testID={`desbloquear-${item.id}`}
            desativado={desativado || ocupado !== null} carregando={ocupado === item.id} acao={() => void desbloquear(item.id)} />
        </View>
      ))}
    </View>
  );
}

/**
 * O estado de revisão de uma publicação da própria pessoa (`moderacao` do link): "Em revisão" (selo neutro) ou "Não
 * publicada" (selo de alerta, com "Falar com o suporte"). Aprovada, ou sem o campo, não mostra nada.
 */
export function EstadoDaPublicacao({ moderacao, testID }: { moderacao: EstadoModeracao; testID?: string }) {
  if (moderacao !== 'pendente' && moderacao !== 'recusado') return null;
  const recusada = moderacao === 'recusado';
  return (
    <View testID={testID ?? `moderacao-${moderacao}`} style={seg.estado}>
      <View style={[seg.selo, recusada && seg.seloAlerta]}>
        <Text style={[seg.seloTexto, recusada && seg.seloAlertaTexto]}>{recusada ? s.seloNaoPublicada : s.seloEmRevisao}</Text>
      </View>
      <Text style={seg.estadoTexto}>{recusada ? s.naoPublicada : s.emRevisao}</Text>
      {recusada && (
        <Text accessibilityRole="link" onPress={() => abrirPaginaDoStudoo(s.rotas.suporte)} style={[seg.estadoTexto, seg.link]}>{s.falarComSuporte}</Text>
      )}
    </View>
  );
}

/** A foto do perfil ou a capa em revisão: o aviso para a dona (os outros veem a inicial ou a capa padrão). */
export function AvisoMidiaEmRevisao({ tipo, moderacao }: { tipo: 'foto' | 'capa'; moderacao: EstadoModeracao }) {
  if (moderacao !== 'pendente') return null;
  return <Text testID={`${tipo}-em-revisao`} accessibilityLiveRegion="polite" style={seg.estadoTexto}>{tipo === 'foto' ? s.fotoEmRevisao : s.capaEmRevisao}</Text>;
}

/** A linha das regras na folha de compartilhar, acima da ação que publica no perfil ou no Explorar. */
export function LinhaDasRegras() {
  return (
    <Text testID="regras-ao-publicar" style={seg.regras}>
      {s.regrasAoPublicar.antes}
      <Text accessibilityRole="link" onPress={() => abrirPaginaDoStudoo(s.rotas.regras)} style={seg.link}>{s.regrasAoPublicar.link}</Text>
      {s.regrasAoPublicar.depois}
    </Text>
  );
}

/** A recusa na hora (`conteudo_recusado`), com o link das regras. */
export function RecusaDoConteudo({ testID = 'conteudo-recusado' }: { testID?: string }) {
  return (
    <Text testID={testID} accessibilityRole="alert" style={seg.erro}>
      {`${s.recusadaNaHora} `}
      <Text accessibilityRole="link" onPress={() => abrirPaginaDoStudoo(s.rotas.regras)} style={seg.link}>{s.regras}</Text>
    </Text>
  );
}

const seg = StyleSheet.create({
  ajudaEntrada: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  ajudaEntradaTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  lista: { borderWidth: 2, borderColor: cores.gelo, borderRadius: 16, overflow: 'hidden' },
  linha: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: cores.gelo },
  linhaTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  carregando: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22 },
  erro: { color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 22 },
  estado: { gap: 6, alignItems: 'flex-start' },
  // Selo neutro da spec 10 (#F1F4FD / #5E6A85, 13 px 800) e o de alerta (#9A5B00 sobre #FFF6EA).
  selo: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#F1F4FD' },
  seloTexto: { color: '#5E6A85', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  seloAlerta: { backgroundColor: '#FFF6EA' },
  seloAlertaTexto: { color: '#9A5B00' },
  estadoTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  link: { color: cores.acao, fontWeight: '800', textDecorationLine: 'underline' },
  regras: { color: '#5E6A85', fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
});
