import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { usePulinho } from './animacoes';
import { estilos } from './interface';
import { cores, fontes } from './tema';

/** Letras das opções de múltipla escolha, como na web (A, B, C…). */
export const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Opção de múltipla escolha da aula: cartão com a letra à esquerda, o texto alinhado à esquerda e os estados de marcada,
 * certa e errada. O desafio da ponte usa o mesmo cartão, como decidido no levantamento de paridade (PT5).
 */
export function Opcao({ id, letra, texto, selecionada, retorno, desativada, apagada, acao, corTextoErro = '#7A4A00' }: {
  /** Cor do texto da opção errada: âmbar na aula; no desafio da ponte, a web mantém o azul da marcada. */
  corTextoErro?: string;
  id: string;
  letra: string;
  texto: string;
  selecionada: boolean;
  retorno: 'certa' | 'errada' | null;
  desativada: boolean;
  apagada: boolean;
  acao: () => void;
}) {
  const [focada, setFocada] = useState(false);
  const pulo = usePulinho(retorno === 'certa', 1.04);
  let estado = null;
  if (retorno === 'certa') estado = opcaoEstilos.opcaoCerta;
  else if (retorno === 'errada') estado = opcaoEstilos.opcaoErrada;
  else if (selecionada) estado = opcaoEstilos.opcaoSelecionada;

  return (
    <Animated.View style={{ transform: [{ scale: pulo }], opacity: apagada ? 0.55 : 1 }}>
      {/* aria-checked além do accessibilityState: o React Native Web só lê os atributos aria-* (o leitor de tela da web precisava do estado). */}
      <Pressable testID={`opcao-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: desativada }} aria-checked={selecionada}
        accessibilityLabel={texto} disabled={desativada} onPress={acao} onFocus={() => setFocada(true)} onBlur={() => setFocada(false)}
        style={({ pressed }) => [opcaoEstilos.opcao, estado, pressed && opcaoEstilos.opcaoAfundada, focada && estilos.foco]}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[opcaoEstilos.letra, selecionada && opcaoEstilos.letraSelecionada, retorno === 'certa' && opcaoEstilos.letraCerta,
            retorno === 'errada' && opcaoEstilos.letraErrada]}>
          <Text style={[opcaoEstilos.letraTexto, (selecionada || retorno) && { color: cores.fundo }]}>{letra}</Text>
        </View>
        {/* Como na web: o texto da opção marcada fica verde no acerto e âmbar no erro. */}
        <Text style={[estilos.texto, opcaoEstilos.opcaoTexto, retorno === 'certa' && { color: cores.sucesso }, retorno === 'errada' && { color: corTextoErro }]}>{texto}</Text>
      </Pressable>
    </Animated.View>
  );
}

const opcaoEstilos = StyleSheet.create({
  opcao: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 2, borderBottomWidth: 5,
    borderColor: cores.gelo, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: cores.fundo },
  opcaoAfundada: { borderBottomWidth: 2, marginTop: 3 },
  opcaoSelecionada: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  opcaoCerta: { borderColor: cores.sucessoClaro, borderBottomColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  opcaoErrada: { borderColor: '#E3A24A', borderBottomColor: '#F2CF96', backgroundColor: '#FFF6EA' },
  opcaoTexto: { flex: 1, fontWeight: '700' },
  letra: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: cores.gelo, alignItems: 'center', justifyContent: 'center' },
  letraSelecionada: { borderColor: cores.acao, backgroundColor: cores.acao },
  letraCerta: { borderColor: cores.sucessoClaro, backgroundColor: cores.sucessoClaro },
  letraErrada: { borderColor: '#E3A24A', backgroundColor: '#E3A24A' },
  letraTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 18 },
});
