/**
 * Catálogo único de efeitos sonoros (SFX) e sons de fundo do Studoo.
 * Compartilhado entre Web (`src/app/sons.ts`) e Mobile (`apps/mobile/src/sons.ts`)
 * para garantir paridade de momentos, volumes relativos e prioridades.
 */

export type IdEfeitoSonoro =
  | 'toque_opcao'
  | 'ordenar_soltar'
  | 'acerto'
  | 'erro'
  | 'ponte_abrir'
  | 'concluir_licao'
  | 'concluir_trilha'
  | 'conta_criada'
  | 'entrar'
  | 'geracao_licao'
  | 'geracao_pronta'
  | 'valeu'
  | 'seguir'
  | 'link_copiado'
  | 'salvo'
  | 'aviso'
  | 'erro_rede'
  | 'apagar'
  | 'gravacao_inicio'
  | 'gravacao_fim'
  | 'cronometro_inicio'
  | 'cronometro_fim';

export type IdSomFundo =
  | 'mudo'
  | 'foco_calmo'
  | 'chuva_suave'
  | 'lofi_estudo'
  | 'biblioteca'
  | 'brisa_natural';

export type PrioridadeSom = 'baixa' | 'media' | 'alta';

export interface DefinicaoEfeitoSonoro {
  readonly id: IdEfeitoSonoro;
  /** Nome do arquivo em `public/sons/sfx/` (web) e `apps/mobile/assets/sons/sfx/` (app). */
  readonly arquivo: string;
  readonly duracaoMs: number;
  /** Ganho relativo (0..1) aplicado pelo toca-sons. */
  readonly volume: number;
  readonly prioridade: PrioridadeSom;
  /** Intervalo mínimo entre disparos repetidos do mesmo efeito (ms). */
  readonly cooldownMs: number;
}

export interface DefinicaoSomFundo {
  readonly id: Exclude<IdSomFundo, 'mudo'>;
  readonly rotulo: string;
  readonly descricao: string;
  /** Nome do arquivo em `public/sons/fundos/` (web) e `apps/mobile/assets/sons/fundos/` (app). */
  readonly arquivo: string;
  readonly duracaoMs: number;
  /** Ganho base (0..1) para ficar bem abaixo dos efeitos e da voz. */
  readonly volume: number;
  /** Atraso típico de codificador MP3 a aparar no início/fim do laço (segundos). */
  readonly aparoInicioSeg: number;
  readonly aparoFimSeg: number;
}

export interface PreferenciasSom {
  efeitosAtivos: boolean;
  fundo: IdSomFundo;
}

export type EstadoReproducaoFundo = 'parado' | 'carregando' | 'tocando' | 'erro';

export type MotivoPausaFundo = 'nenhum' | 'sem_gesto' | 'gravando' | 'segundo_plano' | 'fora_do_app';

export interface EstadoSomSnapshot {
  efeitosAtivos: boolean;
  fundo: IdSomFundo;
  estadoFundo: EstadoReproducaoFundo;
  motivoPausa: MotivoPausaFundo;
  desbloqueado: boolean;
  erroFundo: string | null;
}

export const MENSAGEM_ERRO_FUNDO = 'Não deu para tocar agora. Toque de novo para tentar.';

export const PADRAO_PREFERENCIAS_SOM: Readonly<PreferenciasSom> = {
  efeitosAtivos: true,
  fundo: 'mudo',
};

export const CATALOGO_EFEITOS: Readonly<Record<IdEfeitoSonoro, DefinicaoEfeitoSonoro>> = {
  toque_opcao: { id: 'toque_opcao', arquivo: 'toque-opcao.wav', duracaoMs: 60, volume: 0.45, prioridade: 'baixa', cooldownMs: 45 },
  ordenar_soltar: { id: 'ordenar_soltar', arquivo: 'ordenar-soltar.wav', duracaoMs: 85, volume: 0.50, prioridade: 'baixa', cooldownMs: 50 },
  acerto: { id: 'acerto', arquivo: 'acerto.wav', duracaoMs: 360, volume: 0.78, prioridade: 'alta', cooldownMs: 120 },
  erro: { id: 'erro', arquivo: 'erro.wav', duracaoMs: 260, volume: 0.65, prioridade: 'alta', cooldownMs: 120 },
  ponte_abrir: { id: 'ponte_abrir', arquivo: 'ponte-abrir.wav', duracaoMs: 400, volume: 0.70, prioridade: 'media', cooldownMs: 250 },
  concluir_licao: { id: 'concluir_licao', arquivo: 'concluir-licao.wav', duracaoMs: 800, volume: 0.85, prioridade: 'alta', cooldownMs: 500 },
  concluir_trilha: { id: 'concluir_trilha', arquivo: 'concluir-trilha.wav', duracaoMs: 1200, volume: 0.95, prioridade: 'alta', cooldownMs: 800 },
  conta_criada: { id: 'conta_criada', arquivo: 'conta-criada.wav', duracaoMs: 720, volume: 0.80, prioridade: 'alta', cooldownMs: 800 },
  entrar: { id: 'entrar', arquivo: 'entrar.wav', duracaoMs: 260, volume: 0.62, prioridade: 'media', cooldownMs: 500 },
  geracao_licao: { id: 'geracao_licao', arquivo: 'geracao-licao.wav', duracaoMs: 140, volume: 0.38, prioridade: 'baixa', cooldownMs: 180 },
  geracao_pronta: { id: 'geracao_pronta', arquivo: 'geracao-pronta.wav', duracaoMs: 500, volume: 0.75, prioridade: 'alta', cooldownMs: 500 },
  valeu: { id: 'valeu', arquivo: 'valeu.wav', duracaoMs: 200, volume: 0.55, prioridade: 'media', cooldownMs: 120 },
  seguir: { id: 'seguir', arquivo: 'seguir.wav', duracaoMs: 190, volume: 0.52, prioridade: 'media', cooldownMs: 150 },
  link_copiado: { id: 'link_copiado', arquivo: 'link-copiado.wav', duracaoMs: 110, volume: 0.50, prioridade: 'media', cooldownMs: 200 },
  salvo: { id: 'salvo', arquivo: 'salvo.wav', duracaoMs: 200, volume: 0.50, prioridade: 'media', cooldownMs: 300 },
  aviso: { id: 'aviso', arquivo: 'aviso.wav', duracaoMs: 180, volume: 0.50, prioridade: 'media', cooldownMs: 1200 },
  erro_rede: { id: 'erro_rede', arquivo: 'erro-rede.wav', duracaoMs: 250, volume: 0.60, prioridade: 'alta', cooldownMs: 1000 },
  apagar: { id: 'apagar', arquivo: 'apagar.wav', duracaoMs: 220, volume: 0.60, prioridade: 'media', cooldownMs: 300 },
  gravacao_inicio: { id: 'gravacao_inicio', arquivo: 'gravacao-inicio.wav', duracaoMs: 120, volume: 0.65, prioridade: 'alta', cooldownMs: 300 },
  gravacao_fim: { id: 'gravacao_fim', arquivo: 'gravacao-fim.wav', duracaoMs: 120, volume: 0.60, prioridade: 'alta', cooldownMs: 300 },
  cronometro_inicio: { id: 'cronometro_inicio', arquivo: 'cronometro-inicio.wav', duracaoMs: 90, volume: 0.55, prioridade: 'media', cooldownMs: 250 },
  cronometro_fim: { id: 'cronometro_fim', arquivo: 'cronometro-fim.wav', duracaoMs: 660, volume: 0.80, prioridade: 'alta', cooldownMs: 500 },
};

export const CATALOGO_FUNDOS: readonly DefinicaoSomFundo[] = [
  {
    id: 'foco_calmo',
    rotulo: 'Foco Calmo',
    descricao: 'Acordes suaves e quentes para estudar sem distração',
    arquivo: 'foco-calmo.mp3',
    duracaoMs: 60000,
    volume: 0.24,
    aparoInicioSeg: 0.026,
    aparoFimSeg: 0.020,
  },
  {
    id: 'chuva_suave',
    rotulo: 'Chuva Suave',
    descricao: 'Chuva leve na janela para concentração contínua',
    arquivo: 'chuva-suave.mp3',
    duracaoMs: 60000,
    volume: 0.24,
    aparoInicioSeg: 0.026,
    aparoFimSeg: 0.020,
  },
  {
    id: 'lofi_estudo',
    rotulo: 'Lo-fi de Estudo',
    descricao: 'Harmonia abafada a 72 BPM sem melodia concorrente',
    arquivo: 'lofi-estudo.mp3',
    duracaoMs: 60000,
    volume: 0.22,
    aparoInicioSeg: 0.026,
    aparoFimSeg: 0.020,
  },
  {
    id: 'biblioteca',
    rotulo: 'Biblioteca',
    descricao: 'Ambiência silenciosa com harmônicos sutis para leitura',
    arquivo: 'biblioteca.mp3',
    duracaoMs: 60000,
    volume: 0.24,
    aparoInicioSeg: 0.026,
    aparoFimSeg: 0.020,
  },
  {
    id: 'brisa_natural',
    rotulo: 'Brisa Natural',
    descricao: 'Vento suave entre folhas com base harmônica calma',
    arquivo: 'brisa-natural.mp3',
    duracaoMs: 60000,
    volume: 0.24,
    aparoInicioSeg: 0.026,
    aparoFimSeg: 0.020,
  },
];

const DESCRICOES_CURTAS_FUNDO: Readonly<Record<Exclude<IdSomFundo, 'mudo'>, string>> = {
  foco_calmo: 'Acordes suaves e quentes',
  chuva_suave: 'Chuva leve na janela',
  lofi_estudo: 'Batida lenta, sem melodia',
  biblioteca: 'Ambiente quieto, bom para ler',
  brisa_natural: 'Vento suave entre as folhas',
};

export const OPCOES_FUNDO_UI: readonly { id: IdSomFundo; rotulo: string; descricao: string }[] = [
  { id: 'mudo', rotulo: 'Mudo', descricao: 'Sem som de fundo' },
  ...CATALOGO_FUNDOS.map(({ id, rotulo }) => ({
    id,
    rotulo,
    descricao: DESCRICOES_CURTAS_FUNDO[id],
  })),
];
