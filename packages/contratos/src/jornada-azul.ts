/**
 * Fundamentos da Jornada Azul escolhida pelo dono do produto em 25/11/2026.
 * Valores partilhados pelo React Native e pelo CSS gerado da web. Não contém
 * regras de aprendizado, dados de pessoas ou alterações do catálogo do Stu.
 */
export const jornadaAzul = {
  id: 'jornada-azul',
  versao: 1,
  cores: {
    fundo: '#FFFFFF',
    nevoa: '#EDF3FF',
    gelo: '#DFE7F2',
    texto: '#15275B',
    textoSecundario: '#50607A',
    acao: '#2457DD',
    acaoEscura: '#173B9C',
    sucesso: '#1F7A5A',
    sucessoClaro: '#2F9E6F',
    sucessoFundo: '#EEFAF3',
    alerta: '#9A5B00',
    alertaFundo: '#FFF6EA',
    alertaBorda: '#EBC58A',
    erro: '#C23B4E',
    erroFundo: '#FFF2F4',
    ouro: '#FBBF24',
    ouroEscuro: '#E0A92E',
    ouroTexto: '#7A4A00',
    ceu: '#E9E7FF',
    bordaCampo: '#7B8AAF',
    labioNeutro: '#CDD9EE',
    faceNeutra: '#EDF3FF',
    tintaNeutra: '#50607A',
    superficieSutil: '#F7F9FF',
    destaqueBorda: '#CEDDFF',
  },
  labios: {
    neutro: '#CDD9EE', moeda: '#CDD9EE', acao: '#173B9C',
    sucesso: '#145A42', alerta: '#6E4100', ouro: '#E0A12A',
  },
  raios: { campo: 16, bloco: 24, pilula: 999 },
  espacos: { pagina: 20, controle: 16, grupo: 24, pequeno: 8, medio: 12 },
  escalaEspacos: [4, 8, 12, 16, 20, 24, 32, 44],
  medidas: { acao: 52, alvo: 44, degrau: 4, progresso: 8 },
  tipografia: {
    titulo: { tamanho: 30, entrelinha: 38, peso: 700 },
    secao: { tamanho: 24, entrelinha: 30, peso: 700 },
    corpo: { tamanho: 16, entrelinha: 24, peso: 400 },
    auxiliar: { tamanho: 14, entrelinha: 21, peso: 600 },
    metadado: { tamanho: 13, entrelinha: 20, peso: 800 },
    acao: { tamanho: 17, entrelinha: 24, peso: 800 },
  },
  motion: { micro: 160, entrada: 220, raro: 560, escalonamento: 120 },
} as const;
