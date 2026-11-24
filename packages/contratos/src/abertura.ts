import movimento from './abertura-motion.json';

/** Coreografia exclusivamente mobile. A assinatura não autentica nem aguarda a API. */
export const abertura = {
  ...movimento,
  altura: movimento.largura * movimento.fonte.altura / movimento.fonte.largura,
  curva: movimento.curva as [number, number, number, number],
} as const;

/** Escolhe o ritmo antes de mover a marca; nunca começa uma história que já não cabe. */
export function duracaoDaCoreografia(restanteMs: number): number {
  if (!Number.isFinite(restanteMs)) return 0;
  const livre = Math.min(abertura.limiteMs, restanteMs) - abertura.saidaMs - abertura.margemQuadroMs;
  return livre >= abertura.sequenciaMinimaMs ? Math.min(abertura.sequenciaMs, Math.floor(livre)) : 0;
}

/** Curva por trechos amostrada uma só vez pelo driver nativo de Animated.timing.
 * Evita um retorno à thread JS a cada marco e mantém os mesmos valores do filme.
 */
export function progressoDaCoreografia(tempo: number): number {
  if (!(tempo > 0)) return 0;
  if (tempo >= 1) return 1;
  const i = abertura.marcos.findIndex((marco) => marco >= tempo);
  const inicio = abertura.marcos[i - 1];
  const fim = abertura.marcos[i];
  const u = (tempo - inicio) / (fim - inicio);
  const [x1, y1, x2, y2] = abertura.curva;
  let inferior = 0, superior = 1;
  for (let passo = 0; passo < 28; passo++) {
    const t = (inferior + superior) / 2;
    const x = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3;
    if (x < u) inferior = t; else superior = t;
  }
  const t = (inferior + superior) / 2;
  const y = 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3;
  return inicio + (fim - inicio) * y;
}

/** Links diretos, callbacks e mensagens de retorno não recebem uma espera de marca. */
export function permiteAbertura(caminho: string, consulta = '', fragmento = ''): boolean {
  return (caminho === '/' || caminho === '/login') && !consulta && !fragmento;
}

export type FaseAbertura = 'visivel' | 'saindo' | 'concluida';
export type MotivoDaAbertura = 'pronto' | 'interacao' | 'contexto' | 'preferencia' | 'falha' | 'limite';
type Agendar = (acao: () => void, atrasoMs: number) => () => void;
const agendarPadrao: Agendar = (acao, atrasoMs) => {
  const relogio = setTimeout(acao, atrasoMs);
  return () => clearTimeout(relogio);
};

/** Prontidão e fim da coreografia podem chegar em qualquer ordem; nenhuma reinicia o teto. */
export function criarControleAbertura(
  publicar: (fase: FaseAbertura, motivo: MotivoDaAbertura) => void,
  agendar: Agendar = agendarPadrao,
  tempoRestanteMs: number = abertura.limiteMs,
) {
  let fase: FaseAbertura = 'visivel';
  let destruido = false;
  let recursosProntos = false;
  let coreografiaConcluida = false;
  let cancelarSaida: (() => void) | undefined;
  let cancelarLimite: (() => void) | undefined;
  const limpar = () => { cancelarSaida?.(); cancelarLimite?.(); };
  const concluir = (motivo: MotivoDaAbertura) => {
    if (destruido || fase === 'concluida') return;
    limpar();
    fase = 'concluida';
    publicar(fase, motivo);
  };
  // O app compartilha uma origem no módulo com a guarda do splash. Montar tarde
  // recebe só o prazo restante; nunca renova o orçamento nem estende o teto.
  const restante = Number.isFinite(tempoRestanteMs) ? Math.max(0, Math.min(abertura.limiteMs, tempoRestanteMs)) : 0;
  if (restante > 0) cancelarLimite = agendar(() => concluir('limite'), restante);
  else concluir('limite');
  const iniciarSaida = () => {
    if (destruido || fase !== 'visivel' || !recursosProntos || !coreografiaConcluida) return;
    fase = 'saindo';
    publicar(fase, 'pronto');
    cancelarSaida = agendar(() => concluir('pronto'), abertura.saidaMs);
  };
  return {
    pronto(comMovimento: boolean) {
      if (destruido || fase === 'concluida') return;
      if (!comMovimento) { concluir('pronto'); return; }
      recursosProntos = true;
      iniciarSaida();
    },
    animacaoConcluida() {
      if (destruido || fase !== 'visivel') return;
      coreografiaConcluida = true;
      iniciarSaida();
    },
    pular(motivo: Exclude<MotivoDaAbertura, 'pronto'> = 'interacao') { concluir(motivo); },
    destruir() { destruido = true; limpar(); },
    fase: () => fase,
  };
}
