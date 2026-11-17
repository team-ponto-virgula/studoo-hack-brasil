export const cores = {
  fundo: '#FFFFFF',
  nevoa: '#F1F4FD',
  gelo: '#E1E7FA',
  texto: '#1B2A5E',
  textoSecundario: '#5E6A85',
  acao: '#3858D6',
  acaoEscura: '#2A44A8',
  sucesso: '#1F7A5A',
  sucessoClaro: '#2F9E6F',
  alerta: '#9A5B00',
  erro: '#C23B4E',
  ouro: '#FFD166',
  ouroEscuro: '#E0A92E',
  ouroTexto: '#7A4A00',
  ceu: '#EEF3FF',
  bordaCampo: '#C9D1EA',
  labioNeutro: '#C8D0EA',
  faceNeutra: '#E9EDF8',
  tintaNeutra: '#7D87A6',
  // Rodada 1 de UI (docs/ui/DIRECAO-UI.md §2): superfícies e fundos semânticos, como na web.
  superficieSutil: '#F7F9FF',
  sucessoFundo: '#EEFAF3',
  alertaFundo: '#FFF6EA',
  alertaBorda: '#F2CF96',
  erroFundo: '#FFF5F6',
  /** Borda e lábio do cartão de destaque ("Seu próximo passo"), como `.plano-destaque` na web. */
  destaqueBorda: '#C3CDF2',
} as const;

/** Lábio do relevo tátil por variante (DIRECAO-UI.md §2): a face desce até ele no toque. */
export const labios = {
  neutro: '#E1E7FA',
  moeda: '#C3CBE4',
  acao: '#2A44A8',
  sucesso: '#145A42',
  alerta: '#6E4100',
  ouro: '#E0A12A',
} as const;

/** Raios da direção: campo, bloco (cartões) e pílula. */
export const raios = { campo: 14, bloco: 22, pilula: 999 } as const;

/** Escala de espaçamento da direção (4 a 44). */
export const espacos = [4, 8, 12, 16, 20, 24, 32, 44] as const;

/**
 * Durações da direção (DIRECAO-UI.md §2, em ms): entrada com mola (320–420), microinteração (140–220) e momentos raros
 * (480–700, com 120 entre peças). As curvas estão em animacoes.tsx.
 */
export const duracoes = { entrada: 360, micro: 180, raro: 560, escalonamento: 120 } as const;

export const fontes = {
  titulo: 'StudooTitulo',
  corpo: 'StudooCorpo',
} as const;
