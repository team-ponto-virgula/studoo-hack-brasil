import { AccessibilityInfo, Platform } from 'react-native';

/**
 * O critério de `:focus-visible` da web para o anel de foco dos botões. A web desenha o anel de botões, opções, nós do mapa
 * e abre-e-fecha só com `:focus-visible`: com o teclado, sim; depois de um clique ou toque, não. Campos de texto mostram o
 * foco sempre (`:focus`), então não usam isto. No navegador (a prévia), o último jeito de interagir decide; no aparelho, o
 * foco de um botão só chega pelo teclado, pelo controle direcional ou por programa, então o anel aparece sempre.
 */
let peloTeclado = true;

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', (evento) => {
    if (!evento.metaKey && !evento.ctrlKey && !evento.altKey) peloTeclado = true;
  }, true);
  for (const tipo of ['pointerdown', 'mousedown', 'touchstart']) {
    document.addEventListener(tipo, () => { peloTeclado = false; }, true);
  }
}

/** Se o foco que acabou de chegar a um botão mostra o anel. */
export function focoVisivel() {
  return peloTeclado;
}

/**
 * Leva o foco do leitor de tela ao título, como o `focus()` da web. Na prévia web, foca sem rolar (o `focus()` do navegador
 * rolava a folha até o título e escondia a linha de cima), como a apresentação já faz.
 */
export function focarSemRolar(no: unknown) {
  if (!no) return;
  if (Platform.OS === 'web') {
    const elemento = no as HTMLElement;
    if (!elemento.hasAttribute('tabindex')) elemento.setAttribute('tabindex', '-1');
    elemento.focus({ preventScroll: true });
    return;
  }
  AccessibilityInfo.sendAccessibilityEvent(no as Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0], 'focus');
}
