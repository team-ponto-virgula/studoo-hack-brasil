import { useState, type ComponentRef, type Ref } from 'react';
import { falarTextoComFormulas } from '@studoo/contratos';
import { TextoComFormulas } from './texto-com-formulas';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { usePulinho } from './animacoes';
import { degrauFora, estilos } from './interface';
import { cores, fontes } from './tema';
import { focoVisivel } from './foco';

/** Letras das opções de múltipla escolha, como na web (A, B, C…). */
export const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Opção de múltipla escolha da aula: cartão com a letra à esquerda, o texto alinhado à esquerda e os estados de marcada,
 * certa e errada. O desafio da ponte usa o mesmo cartão, como decidido no levantamento de paridade (PT5).
 */
export function Opcao({ id, letra, texto, selecionada, retorno, desativada, apagada, acao, corTextoErro = '#7A4A00', referencia }: {
  /** A opção em si, para quem leva o foco do leitor de tela até ela (o "Tentar de novo" do "Resolva comigo"). */
  referencia?: Ref<ComponentRef<typeof Pressable>>;
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
  // O degrau por fora tem a cor da sombra da web (0 4px 0): gelo; #9FB1F0 marcada; #9AD8B5 certa; #F2CF96 errada.
  let corDegrau: string = cores.gelo;
  if (retorno === 'certa') { estado = opcaoEstilos.opcaoCerta; corDegrau = '#9AD8B5'; }
  else if (retorno === 'errada') { estado = opcaoEstilos.opcaoErrada; corDegrau = '#F2CF96'; }
  else if (selecionada) { estado = opcaoEstilos.opcaoSelecionada; corDegrau = '#9FB1F0'; }

  // Spec 16, item 6: o quadrinho da letra cresce com o texto do sistema (lado de 1,75 × o tamanho da letra, no mínimo 30,
  // sempre quadrado e raio 9); o texto da opção ocupa o resto da linha e quebra ao lado dele, nunca por baixo.
  const { fontScale } = useWindowDimensions();
  const lado = ladoDaLetra(fontScale);
  return (
    <Animated.View style={{ transform: [{ scale: pulo }], opacity: apagada ? 0.55 : 1 }}>
      {/* aria-checked além do accessibilityState: o React Native Web só lê os atributos aria-* (o leitor de tela da web precisava do estado). */}
      <Pressable ref={referencia} testID={`opcao-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: desativada }} aria-checked={selecionada}
        // O texto falado (a fórmula lida pela árvore): nunca o texto cru com `$…$` (caso real cb532bb, opções só em fórmula).
        accessibilityLabel={falarTextoComFormulas(texto)} disabled={desativada} onPress={acao} onFocus={() => setFocada(focoVisivel())} onBlur={() => setFocada(false)}
        style={({ pressed }) => [degrauFora(4, 16, corDegrau, pressed), focada && estilos.foco]}>
        {/* A face: borda de 2 que fecha em volta (o degrau de 4 é o pai, por fora, como a sombra da web). */}
        <View style={[opcaoEstilos.opcao, estado]}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[opcaoEstilos.letra, { width: lado, height: lado }, selecionada && opcaoEstilos.letraSelecionada, retorno === 'certa' && opcaoEstilos.letraCerta,
            retorno === 'errada' && opcaoEstilos.letraErrada]}>
          <Text style={[opcaoEstilos.letraTexto, (selecionada || retorno) && { color: cores.fundo }]}>{letra}</Text>
        </View>
        {/* Como na web: o texto da opção marcada fica verde no acerto e âmbar no erro. */}
        {/* Marcada (antes de verificar), o texto vai para o azul escuro da web (.opcoes label:has(input:checked)). */}
        <TextoComFormulas texto={texto} estilo={[estilos.texto, opcaoEstilos.opcaoTexto, selecionada && !retorno && { color: cores.acaoEscura },
          retorno === 'certa' && { color: cores.sucesso }, retorno === 'errada' && { color: corTextoErro }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** O tamanho da letra da opção (14) e o lado do quadrinho: 1,75 × a letra já ampliada pelo sistema, no mínimo 30. */
export const LETRA_DA_OPCAO = 14;
export function ladoDaLetra(fontScale: number) {
  return Math.max(30, Math.round(1.75 * LETRA_DA_OPCAO * (fontScale > 0 ? fontScale : 1)));
}

const opcaoEstilos = StyleSheet.create({
  // .opcoes label: 60 de altura mínima, 12 × 16 de respiro, borda de 2 em volta e raio de 16.
  opcao: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 2,
    borderColor: cores.gelo, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: cores.fundo },
  opcaoSelecionada: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  opcaoCerta: { borderColor: cores.sucessoClaro, backgroundColor: '#EEFAF3' },
  opcaoErrada: { borderColor: '#E3A24A', backgroundColor: '#FFF6EA' },
  opcaoTexto: { flex: 1, fontWeight: '700' },
  letra: { width: 30, height: 30, flexShrink: 0, alignSelf: 'center', borderRadius: 9, borderWidth: 2, borderColor: cores.gelo, alignItems: 'center', justifyContent: 'center' },
  letraSelecionada: { borderColor: cores.acao, backgroundColor: cores.acao },
  letraCerta: { borderColor: cores.sucessoClaro, backgroundColor: cores.sucessoClaro },
  letraErrada: { borderColor: '#E3A24A', backgroundColor: '#E3A24A' },
  letraTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: LETRA_DA_OPCAO, lineHeight: 18, textAlign: 'center' },
});
