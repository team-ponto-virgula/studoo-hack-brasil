/** A assinatura de abertura é visual; não autentica nem aguarda chamadas de rede. */
export const abertura = {
  largura: 180,
  altura: 180 * 184 / 560,
  fundo: '#FFFFFF',
  acomodacaoMs: 320,
  saidaMs: 120,
  limiteMs: 900,
  escalaMaxima: 1.015,
  deslocamentoMaximo: 2,
  curva: [0.22, 1, 0.36, 1] as const,
} as const;

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

/** Mesmo ciclo nos dois renderizadores. `destruir` limpa tudo sem publicar em componente desmontado. */
export function criarControleAbertura(
  publicar: (fase: FaseAbertura, motivo: MotivoDaAbertura) => void,
  agendar: Agendar = agendarPadrao,
) {
  let fase: FaseAbertura = 'visivel';
  let destruido = false;
  let cancelarSaida: (() => void) | undefined;
  let cancelarLimite: (() => void) | undefined;
  const limpar = () => { cancelarSaida?.(); cancelarLimite?.(); };
  const concluir = (motivo: MotivoDaAbertura) => {
    if (destruido || fase === 'concluida') return;
    limpar();
    fase = 'concluida';
    publicar(fase, motivo);
  };
  cancelarLimite = agendar(() => concluir('limite'), abertura.limiteMs);
  return {
    pronto(comMovimento: boolean) {
      if (destruido || fase !== 'visivel') return;
      if (!comMovimento) { concluir('pronto'); return; }
      fase = 'saindo';
      publicar(fase, 'pronto');
      cancelarSaida = agendar(() => concluir('pronto'), abertura.saidaMs);
    },
    pular(motivo: Exclude<MotivoDaAbertura, 'pronto'> = 'interacao') { concluir(motivo); },
    destruir() { destruido = true; limpar(); },
    fase: () => fase,
  };
}
