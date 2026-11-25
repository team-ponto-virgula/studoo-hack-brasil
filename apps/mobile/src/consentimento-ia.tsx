import { ErroStudoo } from '@studoo/contratos';
import { CAMINHO_POLITICA, consentimentoVigente, privacidadeDoErro, type EstadoPrivacidade } from '@studoo/contratos/privacidade';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { origemConfigurada, type ClienteNativo } from './api-nativa';
import { CartaoConfirmacao } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { abrirNoNavegador } from './social';
import { cores, fontes } from './tema';

/*
 * Consentimento do envio a IA de terceiros (Apple 5.1.2(i)). O servidor é quem garante (`@studoo/contratos/privacidade`):
 * sem o aceite vigente, as rotas que mandariam dados à DeepSeek ou à OpenAI respondem `consentimento_ia` (428) antes de
 * qualquer envio. O app pergunta antes, num lugar só, no cliente que usa: cada ação dessas espera a permissão e, na
 * primeira vez, abre o cartão do Studoo com quem recebe o quê ("Permitir e continuar" ou "Agora não"); com a permissão,
 * segue direto. Desligar em Perfil, Privacidade volta a trava. Se o servidor recusar mesmo assim (desligada em outro
 * aparelho, texto novo), o app pergunta de novo e repete o pedido uma vez. A correção, o reforço e o "Explique para o
 * Stu" não passam pela trava: sem permissão, o servidor responde com o retorno local. Com a IA simulada no servidor
 * (`necessario: false`), nada é pedido.
 */

const k = mensagens.privacidade;

/** As ações do cliente que o servidor recusa sem aceite (as que mandam dados a uma IA de terceiro sem alternativa local). */
const ACOES_COM_IA = [
  'gerarProposta', 'aceitarProposta', 'enviarMaterial', 'proporMaterial', 'transcrever', 'iniciarVozAoVivo',
] as const satisfies readonly (keyof ClienteNativo)[];

export const recusaDeConsentimento = (erro: unknown) => erro instanceof ErroStudoo && erro.codigo === 'consentimento_ia';

/** A permissão vale agora? Sem o estado (a leitura ainda não chegou), não. */
export const permissaoVigente = (estado: EstadoPrivacidade | null) => Boolean(estado && consentimentoVigente(estado));

type ContextoConsentimento = {
  /** null enquanto a primeira leitura não chegou (ou falhou). */
  estado: EstadoPrivacidade | null;
  permitido: boolean;
  /** Liga a permissão (Perfil, Privacidade): o mesmo aceite do cartão, sem o cartão. */
  permitir: () => Promise<void>;
  revogar: () => Promise<void>;
  /** Exclui a conta de vez; quem usa o app sai para a entrada com o aviso. */
  excluirConta: () => Promise<void>;
  /** A política pública do Studoo (web, sem login), na origem do piloto. */
  politicaUrl: string | null;
};

const Contexto = createContext<ContextoConsentimento | null>(null);

export function useConsentimentoIa() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useConsentimentoIa fora de ConsentimentoIa');
  return valor;
}

function enderecoDaPolitica(caminho: string) {
  try {
    return new URL(caminho, origemConfigurada()).toString();
  } catch {
    return null;
  }
}

type Pedido = { resolver: () => void; recusar: (erro: unknown) => void };

export function ConsentimentoIa({ cliente, aoExcluida, children }: {
  cliente: ClienteNativo;
  aoExcluida: () => Promise<void>;
  children: (cliente: ClienteNativo) => ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoPrivacidade | null>(null);
  const estadoRef = useRef<EstadoPrivacidade | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pedidos = useRef<Pedido[]>([]);

  const guardar = useCallback((novo: EstadoPrivacidade | null) => {
    estadoRef.current = novo;
    setEstado(novo);
  }, []);

  const recarregar = useCallback(async () => {
    const dados = await cliente.privacidade();
    guardar(dados);
    return dados;
  }, [cliente, guardar]);

  useEffect(() => {
    let ativo = true;
    cliente.privacidade().then((dados) => { if (ativo) guardar(dados); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [cliente, guardar]);

  const aceitar = useCallback(async () => {
    const atual = estadoRef.current ?? await recarregar();
    try {
      guardar(await cliente.aceitarIa(atual.consentimentoIa.versao));
    } catch (falha) {
      // Texto novo no servidor (`invalido`): busca a versão vigente para o próximo toque valer.
      if (falha instanceof ErroStudoo && falha.codigo === 'invalido') void recarregar().catch(() => undefined);
      throw falha;
    }
  }, [cliente, guardar, recarregar]);

  /**
   * Espera a permissão: na hora, se já vale; senão, abre o cartão (um só para pedidos ao mesmo tempo). Sem conseguir ler o
   * estado, segue: o servidor decide e, se recusar, o pedido volta para cá.
   */
  const garantir = useCallback(async () => {
    let atual = estadoRef.current;
    if (!atual) {
      try { atual = await recarregar(); } catch { return; }
    }
    if (consentimentoVigente(atual)) return;
    await new Promise<void>((resolver, recusar) => {
      pedidos.current.push({ resolver, recusar });
      setErro(null);
      setPedindo(true);
    });
  }, [recarregar]);

  /** O servidor recusou: guarda o estado que veio no erro (ou busca de novo) para o cartão perguntar de novo. */
  const invalidar = useCallback(async (falha: unknown) => {
    const veio = privacidadeDoErro(falha);
    if (veio) { guardar(veio); return; }
    const atual = estadoRef.current;
    if (atual) guardar({ ...atual, consentimentoIa: { ...atual.consentimentoIa, necessario: true, aceitoEm: null } });
    await recarregar().catch(() => undefined);
  }, [guardar, recarregar]);

  function encerrarPedidos(aceito: boolean) {
    const fila = pedidos.current;
    pedidos.current = [];
    setPedindo(false);
    for (const pedido of fila) {
      if (aceito) pedido.resolver(); else pedido.recusar(new ErroStudoo('consentimento_ia'));
    }
  }

  async function aoPermitir() {
    setOcupado(true);
    setErro(null);
    try {
      await aceitar();
      encerrarPedidos(true);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  const clienteSeguro = useMemo(() => comConsentimento(cliente, garantir, invalidar), [cliente, garantir, invalidar]);
  const politicaUrl = enderecoDaPolitica(estado?.politica ?? CAMINHO_POLITICA);

  const valor = useMemo<ContextoConsentimento>(() => ({
    estado,
    permitido: permissaoVigente(estado),
    permitir: aceitar,
    revogar: async () => { guardar(await cliente.revogarIa()); },
    excluirConta: async () => {
      await cliente.excluirConta();
      await aoExcluida();
    },
    politicaUrl,
  }), [estado, aceitar, cliente, guardar, aoExcluida, politicaUrl]);

  return (
    <Contexto.Provider value={valor}>
      {children(clienteSeguro)}
      {pedindo && (
        <CartaoConfirmacao testID="consentimento-ia" mensagem={k.aceiteTitulo} texto={k.aceiteTexto}
          confirmarRotulo={ocupado ? k.permitindo : k.permitir} cancelarRotulo={k.agoraNao} ocupado={ocupado} erro={erro}
          aoConfirmar={() => void aoPermitir()} aoCancelar={() => encerrarPedidos(false)}
          extra={<ItensDoPedido estado={estado} politica={politicaUrl} />} />
      )}
    </Contexto.Provider>
  );
}

/** Quem recebe o quê, com o link da política de cada provedor e a do Studoo (.privacidade-provedores da web). Usado no cartão e no Perfil. */
export function ListaProvedores({ estado, politica }: { estado: EstadoPrivacidade; politica: string | null }) {
  return (
    <View testID="privacidade-provedores" style={c.lista}>
      {estado.consentimentoIa.provedores.map((provedor) => (
        <View key={provedor.id} testID={`consentimento-${provedor.id}`} style={c.provedor}>
          <Text style={c.nome}>{provedor.nome}</Text>
          {provedor.usos.map((uso) => (
            <View key={uso} style={c.item}>
              <Text style={c.marca} importantForAccessibility="no" accessibilityElementsHidden>•</Text>
              <Text style={c.itemTexto}>{uso}</Text>
            </View>
          ))}
          <Text accessibilityRole="link" onPress={() => abrirNoNavegador(provedor.politica)} style={c.link}>{k.politicaDe(provedor.nome)}</Text>
        </View>
      ))}
      {politica && (
        <Text testID="consentimento-politica" accessibilityRole="link" onPress={() => abrirNoNavegador(politica)} style={c.link}>{k.politica}</Text>
      )}
    </View>
  );
}

/**
 * O miolo do cartão de aceite, como a folha da web: "Quem recebe e o quê", a lista e o que segue sem permitir. Rola junto com o
 * texto no miolo do cartão (com DeepSeek e OpenAI, a lista passa da tela de 360 × 800), com o título e as ações sempre à vista.
 */
function ItensDoPedido({ estado, politica }: { estado: EstadoPrivacidade | null; politica: string | null }) {
  return (
    <View testID="consentimento-itens" style={c.itens}>
      <Text accessibilityRole="header" style={c.subtitulo}>{k.aceiteQuem}</Text>
      {estado && <ListaProvedores estado={estado} politica={politica} />}
      <Text style={c.semIa}>{k.aceiteSemIa}</Text>
    </View>
  );
}

/**
 * O cliente com a trava: cada ação de IA espera a permissão; se o servidor recusar por falta dela, pergunta e repete uma
 * vez. A geração ao vivo também: a recusa do servidor chega antes do primeiro evento (o JSON de erro de sempre, 428).
 */
export function comConsentimento(cliente: ClienteNativo, garantir: () => Promise<void>, invalidar: (falha: unknown) => Promise<void> | void): ClienteNativo {
  function travar<A extends unknown[], R>(acao: (...args: A) => Promise<R>) {
    return async (...args: A): Promise<R> => {
      await garantir();
      try {
        return await acao(...args);
      } catch (falha) {
        if (!recusaDeConsentimento(falha)) throw falha;
        await invalidar(falha);
        await garantir();
        return acao(...args);
      }
    };
  }
  const travado = { ...cliente } as Record<string, unknown>;
  for (const nome of ACOES_COM_IA) {
    travado[nome] = travar(cliente[nome] as (...args: unknown[]) => Promise<unknown>);
  }
  return {
    ...(travado as ClienteNativo),
    gerarTrilhaAoVivo: async function* (objetivo: string, sinal: AbortSignal) {
      await garantir();
      let entregou = false;
      try {
        for await (const evento of cliente.gerarTrilhaAoVivo(objetivo, sinal)) {
          entregou = true;
          yield evento;
        }
      } catch (falha) {
        if (!recusaDeConsentimento(falha) || entregou) throw falha;
        await invalidar(falha);
        await garantir();
        yield* cliente.gerarTrilhaAoVivo(objetivo, sinal);
      }
    },
  };
}

const c = StyleSheet.create({
  itens: { gap: 10 },
  subtitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  lista: { gap: 12 },
  // Cada provedor num quadro de borda gelo (.privacidade-provedores > ul > li da web).
  provedor: { gap: 8, padding: 16, borderWidth: 1.5, borderColor: cores.gelo, borderRadius: 16, backgroundColor: cores.superficieSutil },
  nome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  item: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  marca: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 23 },
  itemTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '400', fontSize: 16, lineHeight: 23 },
  semIa: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '400', fontSize: 14, lineHeight: 21 },
  link: { alignSelf: 'flex-start', color: cores.acaoEscura, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24, textDecorationLine: 'underline',
    paddingVertical: 10 },
});
