import { CONFIRMACAO_EXCLUSAO, confirmacaoExclusaoValida } from '@studoo/contratos/privacidade';
import { useContext, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useConsentimentoIa } from './consentimento-ia';
import { AvisoDoApp, Botao, Campo, CartaoConfirmacao, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { Chave, abrirNoNavegador, dataCurta } from './social';
import { cores, fontes } from './tema';

/*
 * Perfil, Privacidade (Apple 5.1.2(i)): a chave "Permitir uso de IA" com a data do aceite, o que muda ao desligar (pede
 * confirmação) e o link da política. Com a IA simulada no servidor não há o que permitir: só a frase e a política. A
 * exclusão da conta (Apple 5.1.1(v)) fica em Conta, depois de Sair, com o cartão destrutivo do Studoo e o campo para
 * digitar EXCLUIR; excluída, o app volta para a entrada com o aviso. Valem para conta e para visitante.
 */

const k = mensagens.privacidade;

export function SecaoPrivacidade({ desativado }: { desativado: boolean }) {
  const { estado, permitido, permitir, revogar, politicaUrl } = useConsentimentoIa();
  const { avisar } = useContext(AvisoDoApp);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const semTerceiros = estado !== null && !estado.consentimentoIa.necessario;
  const aceitoEm = estado?.consentimentoIa.aceitoEm ?? null;

  async function mudar(ligar: boolean, fazer: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    try {
      await fazer();
      setConfirmando(false);
      // O aviso do app também é anunciado ao leitor de tela.
      avisar(ligar ? k.permitido : k.revogado, { icone: 'check' });
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View testID="privacidade" style={p.bloco}>
      {semTerceiros ? (
        <Text testID="privacidade-estado" style={estilos.texto}>{k.semTerceiros}</Text>
      ) : (
        <>
          <Chave rotulo={k.chave} ligada={permitido} desativada={desativado || ocupado || !estado}
            aoMudar={(ligar) => { if (ligar) void mudar(true, permitir); else setConfirmando(true); }} />
          {estado && (
            <Text testID="privacidade-estado" style={estilos.texto}>
              {permitido && aceitoEm ? k.ligada(dataCurta(aceitoEm)) : k.desligada}
            </Text>
          )}
        </>
      )}
      {erro && !confirmando && <Text accessibilityRole="alert" style={p.erro}>{erro}</Text>}
      {politicaUrl && (
        <Text testID="privacidade-politica" accessibilityRole="link" onPress={() => abrirNoNavegador(politicaUrl)} style={p.link}>{k.politica}</Text>
      )}
      {confirmando && (
        <CartaoConfirmacao testID="privacidade-revogar" mensagem={k.revogarTitulo} texto={k.revogarTexto} confirmarRotulo={k.revogarConfirmar}
          cancelarRotulo={k.revogarCancelar} destrutivo ocupado={ocupado} erro={erro}
          aoConfirmar={() => void mudar(false, revogar)} aoCancelar={() => { setConfirmando(false); setErro(null); }} />
      )}
    </View>
  );
}

/**
 * "Excluir conta" (em Conta, depois de Sair): o cartão destrutivo com o campo "digite EXCLUIR"; a ação só liga com a
 * palavra certa. Com erro, o cartão continua aberto com a mensagem.
 */
export function ExcluirConta({ desativado }: { desativado: boolean }) {
  const { excluirConta } = useConsentimentoIa();
  const [confirmando, setConfirmando] = useState(false);
  const [digitado, setDigitado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
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
    <View style={p.excluir}>
      <Botao rotulo={k.excluir} testID="excluir-conta" variante="perigo" desativado={desativado}
        acao={() => { setErro(null); setDigitado(''); setConfirmando(true); }} estilo={{ alignSelf: 'flex-start' }} />
      <Text style={p.dica}>{k.excluirDica}</Text>
      {confirmando && (
        <CartaoConfirmacao testID="excluir-conta-confirmacao" mensagem={k.excluirTitulo} texto={k.excluirTexto} confirmarRotulo={k.excluirConfirmar}
          cancelarRotulo={k.excluirCancelar} destrutivo ocupado={ocupado} erro={erro} confirmarDesativado={!confirmacaoExclusaoValida(digitado)}
          aoConfirmar={() => { if (confirmacaoExclusaoValida(digitado)) void excluir(); }} aoCancelar={() => setConfirmando(false)}
          extra={
            <Campo testID="excluir-conta-campo" rotulo={k.excluirDigite(CONFIRMACAO_EXCLUSAO)} value={digitado} onChangeText={setDigitado}
              autoCapitalize="characters" autoCorrect={false} autoComplete="off" spellCheck={false} editable={!ocupado}
              returnKeyType="done" onSubmitEditing={() => { if (confirmacaoExclusaoValida(digitado)) void excluir(); }} />
          } />
      )}
    </View>
  );
}

const p = StyleSheet.create({
  bloco: { gap: 10 },
  erro: { color: cores.erro, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22 },
  link: { alignSelf: 'flex-start', color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24, textDecorationLine: 'underline',
    paddingVertical: 10 },
  excluir: { gap: 6, marginTop: 8 },
  dica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 21 },
});
