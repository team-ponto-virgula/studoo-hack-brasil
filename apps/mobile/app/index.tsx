import { View } from 'react-native';
import { AppMobile } from '../src/sessao';
import type { DestinoPublico } from '../src/estudo';
import type { AcessoPeloLink } from '../src/codigo-do-link';
import { tocaSons } from '../src/sons';

/** O primeiro toque em qualquer tela libera o som de fundo salvo (spec 12; a web faz o mesmo no primeiro gesto). Não pega o toque. */
function liberarSom() {
  tocaSons.registrarGesto();
  return false;
}

export default function Inicio({ destino, acesso }: { destino?: DestinoPublico; acesso?: AcessoPeloLink } = {}) {
  return (
    <View style={{ flex: 1 }} onStartShouldSetResponderCapture={liberarSom}>
      <AppMobile destino={destino} acesso={acesso} />
    </View>
  );
}
