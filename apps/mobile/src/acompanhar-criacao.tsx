import type { CriacaoPendente, EstadoCriacaoNoCliente, PlanoDetalhe } from '@studoo/contratos';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { Botao, estilos } from './interface';
import { apresentarRetomada } from './estado-da-retomada';
import { mensagens } from './mensagens';
import { cores } from './tema';
import type { CriacaoAcompanhada } from './use-criacoes-pendentes';

const t = mensagens.geracao;

export function AcompanharCriacao({ item, ocupado, mostrarTitulo, consultar, aoExpirarSessao, abrir, reenviar, ajustar, sairParaLista }: {
  item: CriacaoAcompanhada;
  ocupado: boolean;
  mostrarTitulo?: boolean;
  consultar: (pedido: CriacaoPendente) => Promise<EstadoCriacaoNoCliente>;
  aoExpirarSessao: () => void;
  abrir: (pedido: CriacaoPendente, plano: PlanoDetalhe) => void;
  reenviar: (pedido: CriacaoPendente) => void;
  ajustar: (pedido: CriacaoPendente, editar: boolean) => void;
  sairParaLista?: () => void;
}) {
  const { pedido, estado } = item;
  const [verificando, setVerificando] = useState(false);
  const { texto, acao, consultarEmMs } = apresentarRetomada(item);
  const aguardandoLimite = acao.tipo === 'tentar' && acao.desativada === true;

  useEffect(() => {
    if (acao.tipo === 'entrar') aoExpirarSessao();
  }, [acao.tipo, aoExpirarSessao]);

  useEffect(() => {
    if (ocupado || (consultarEmMs === undefined && !aguardandoLimite)) return;
    let relogio: ReturnType<typeof setTimeout> | undefined;
    function emPrimeiroPlano() {
      return AppState.currentState !== 'inactive' && AppState.currentState !== 'background';
    }
    function agendar(ms: number) {
      clearTimeout(relogio);
      if (emPrimeiroPlano()) relogio = setTimeout(() => void consultar(pedido), ms);
    }
    if (consultarEmMs !== undefined) agendar(consultarEmMs);
    const evento = AppState.addEventListener('change', atual => {
      if (atual === 'active') agendar(0);
      else clearTimeout(relogio);
    });
    return () => { clearTimeout(relogio); evento.remove(); };
  }, [aguardandoLimite, consultarEmMs, consultar, estado, ocupado, pedido]);

  async function verificar() {
    setVerificando(true);
    try { await consultar(pedido); } finally { setVerificando(false); }
  }

  let botao: { testID: string; rotulo: string; acao: () => void } = {
    testID: 'criacao-verificar', rotulo: verificando ? t.verificandoStatus : t.verificarStatus, acao: () => void verificar(),
  };
  if (acao.tipo === 'abrir') {
    botao = {
      testID: pedido.intencao === 'salvar' ? 'criacao-ver-trilha' : 'criacao-abrir-licao-1',
      rotulo: pedido.intencao === 'salvar' ? mensagens.planos.titulo : t.abrirLicao1,
      acao: () => abrir(pedido, acao.plano),
    };
  } else if (acao.tipo === 'editar') {
    botao = { testID: 'criacao-editar-tema', rotulo: mensagens.pedido.editarTema, acao: () => ajustar(pedido, true) };
  } else if (acao.tipo === 'remontar') {
    botao = { testID: 'criacao-montar-de-novo', rotulo: t.montarDeNovo, acao: () => ajustar(pedido, false) };
  } else if (acao.tipo === 'reenviar' || acao.tipo === 'tentar') {
    botao = {
      testID: 'criacao-reenviar', rotulo: acao.tipo === 'reenviar' ? t.reenviarPedido : t.tentarDeNovo,
      acao: () => { if (!aguardandoLimite) reenviar(pedido); },
    };
  }

  const anunciou = estado !== null;
  useEffect(() => {
    if (anunciou && Platform.OS === 'ios' && AppState.currentState === 'active') {
      AccessibilityInfo.announceForAccessibility(texto);
    }
  }, [anunciou, texto]);

  return (
    <View style={s.cartao}>
      {mostrarTitulo && <Text accessibilityRole="header" style={estilos.tituloBloco}>{pedido.titulo}</Text>}
      <Text testID={estado?.estado === 'em_preparo' ? 'criacao-preparando' : 'criacao-status'}
        accessibilityLiveRegion="polite" style={estilos.legenda}>{texto}</Text>
      {estado?.estado === 'em_preparo' && estado.decorridoMs >= 10_000 && !mostrarTitulo &&
        <Text style={estilos.legenda}>Você pode sair. Quando estiver pronta, a trilha aparece em Minhas trilhas.</Text>}
      <Botao plano variante={estado?.estado === 'pronto' && pedido.intencao === 'comecar' ? 'primario' : 'secundario'}
        {...botao} desativado={ocupado || verificando || aguardandoLimite} />
      {sairParaLista && botao.testID !== 'criacao-ver-trilha' &&
        <Botao compacto variante="texto" testID="criacao-minhas-trilhas" rotulo={mensagens.planos.titulo}
          desativado={ocupado} acao={sairParaLista} />}
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { borderWidth: 1, borderColor: cores.gelo, borderRadius: 16, gap: 8, padding: 12 },
});
