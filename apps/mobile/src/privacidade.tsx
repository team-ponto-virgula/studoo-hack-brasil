import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida } from '@studoo/contratos/privacidade';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ListaProvedores, useConsentimentoIa } from './consentimento-ia';
import { focarSemRolar } from './foco';
import { Botao, Campo, CartaoConfirmacao, estilos } from './interface';
import { useDepoisDeSair } from './janelas';
import { mensagemDeErro, mensagemDoCodigo, mensagens } from './mensagens';
import { abrirNoNavegador, dataCurta } from './social';
import { cores, fontes } from './tema';

/*
 * "Privacidade e dados" no Perfil, igual à web (src/app/privacidade-perfil.tsx, `mensagens.privacidade`): o estado do
 * uso de IA, "Ver quem recebe" (a lista de cada provedor com a política dele), "Parar de usar a IA" ou "Permitir o uso de
 * IA", a política do Studoo e, por último, "Excluir conta" (Apple 5.1.1(v)), que abre o cartão destrutivo do Studoo com o
 * campo para digitar EXCLUIR. Com a IA simulada no servidor, só a frase, a política e a exclusão. Vale para conta e
 * visitante (o visitante lê o texto dele na exclusão).
 */

const t = mensagens.privacidade;

export function SecaoPrivacidade({ desativado, visitante }: { desativado: boolean; visitante: boolean }) {
  const { estado, permitido, permitir, revogar, politicaUrl } = useConsentimentoIa();
  const [verQuem, setVerQuem] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const botaoExcluir = useRef<ComponentRef<typeof Pressable>>(null);
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  const ia = estado?.consentimentoIa;

  function cancelarExclusao() {
    depoisDeSair(() => requestAnimationFrame(() => focarSemRolar(botaoExcluir.current)));
    setExcluindo(false);
  }

  async function mudarAceite(ligar: boolean) {
    setOcupado(true);
    setAviso('');
    try {
      await (ligar ? permitir() : revogar());
      setAviso(ligar ? t.permitido : t.revogado);
    } catch (falha) {
      setAviso(mensagemDeErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View testID="privacidade" style={p.bloco}>
      {ia && (
        <Text testID="privacidade-estado" style={estilos.texto}>
          {!ia.necessario ? t.iaSimulada : permitido && ia.aceitoEm ? t.iaPermitida(dataCurta(ia.aceitoEm)) : t.iaNaoPermitida}
        </Text>
      )}
      {estado && ia?.necessario && verQuem && <ListaProvedores estado={estado} politica={politicaUrl} />}
      <View style={p.acoes}>
        {ia?.necessario && (
          <Botao rotulo={t.verQuem} testID="privacidade-ver-quem" variante="secundario" desativado={desativado}
            acao={() => setVerQuem((v) => !v)} estilo={p.acao} />
        )}
        {ia?.necessario && (permitido
          ? <Botao rotulo={t.revogar} testID="privacidade-revogar" variante="secundario" desativado={desativado || ocupado} acao={() => void mudarAceite(false)} estilo={p.acao} />
          : <Botao rotulo={t.permitirAgora} testID="privacidade-permitir" variante="secundario" desativado={desativado || ocupado} acao={() => void mudarAceite(true)} estilo={p.acao} />)}
        {politicaUrl && (
          <Botao rotulo={t.politica} testID="privacidade-politica" variante="secundario" desativado={desativado} acao={() => abrirNoNavegador(politicaUrl)} estilo={p.acao} />
        )}
      </View>
      {/* O aviso de "Pronto" ou o erro, anunciado ao leitor de tela (role="status" na web). */}
      {aviso ? <Text testID="privacidade-aviso" accessibilityLiveRegion="polite" style={estilos.texto}>{aviso}</Text> : null}
      <Botao rotulo={t.excluir} testID="excluir-conta" referencia={botaoExcluir} variante="destrutivo" desativado={desativado}
        acao={() => setExcluindo(true)} estilo={p.excluir} />
      <ConfirmarExclusao visivel={excluindo} visitante={visitante} aoCancelar={cancelarExclusao} aoFechar={aoSair} />
    </View>
  );
}

/** O cartão destrutivo (sem janela nativa): o texto de conta ou de visitante e o campo "digite EXCLUIR"; a ação só liga com a palavra certa. */
function ConfirmarExclusao({ visivel, visitante, aoCancelar, aoFechar }: {
  visivel: boolean; visitante: boolean; aoCancelar: () => void; aoFechar: () => void;
}) {
  const { excluirConta } = useConsentimentoIa();
  const [digitado, setDigitado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valido = confirmacaoExclusaoValida(digitado);

  function cancelar() {
    setDigitado('');
    setErro(null);
    aoCancelar();
  }

  async function excluir() {
    if (!valido) { setErro(mensagemDoCodigo('confirmacao_invalida')); return; }
    setOcupado(true);
    setErro(null);
    try {
      await excluirConta();
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setOcupado(false);
    }
  }

  return (
    <CartaoConfirmacao testID="excluir-conta-confirmacao" visivel={visivel} aoFechar={aoFechar}
      mensagem={t.excluirTitulo} texto={visitante ? t.excluirVisitante : t.excluirTexto}
      confirmarRotulo={ocupado ? t.excluindo : t.excluirConfirmar} cancelarRotulo={t.excluirCancelar} destrutivo ocupado={ocupado} erro={erro}
      confirmarDesativado={!valido} aoConfirmar={() => void excluir()} aoCancelar={cancelar}
      extra={
        <Campo testID="excluir-conta-campo" rotulo={t.excluirDigite} placeholder={CONFIRMACAO_EXCLUSAO} value={digitado}
          onChangeText={(valor) => { setDigitado(valor); setErro(null); }}
          autoCapitalize="characters" autoCorrect={false} autoComplete="off" spellCheck={false} editable={!ocupado}
          returnKeyType="done" onSubmitEditing={() => void excluir()} />
      } />
  );
}

const p = StyleSheet.create({
  bloco: { gap: 12 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  acao: { alignSelf: 'flex-start' },
  excluir: { alignSelf: 'flex-start', marginTop: 4 },
  erro: { color: cores.erro, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22 },
});
