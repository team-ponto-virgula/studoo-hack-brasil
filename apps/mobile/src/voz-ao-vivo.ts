import {
  estadoInicialVozAoVivo,
  textoErroVozAoVivo,
  type ClienteEstudio,
  type CodigoErroVozAoVivo,
  type EstadoSessaoVozAoVivo,
} from '@studoo/contratos';

/** O que a tela usa da conversa de voz ao vivo: o mesmo controlador de `src/app/voz-ao-vivo.ts` na web. */
export type ControladorVozAoVivo = {
  alternarMudo: () => boolean;
  encerrar: () => Promise<string>;
  descartar: () => void;
};

export type OpcoesControladorVoz = {
  licaoId: string;
  cliente: Pick<ClienteEstudio, 'iniciarVozAoVivo' | 'encerrarVozAoVivo'>;
  aoMudar: (estado: EstadoSessaoVozAoVivo) => void;
  aoTempoEsgotado: (transcricao: string) => void;
  aoErroFatal?: (codigo: CodigoErroVozAoVivo, parcial: string) => void;
  aoNivelMic?: (nivel: number) => void;
};

/**
 * No aparelho, a voz ao vivo fica escondida nesta versão: o WebRTC nativo pede um módulo (react-native-webrtc) que ainda
 * não entrou no app (spec 08, parte B; levantamento em studoo-ui-capturas/voz-ao-vivo/APP-LEVANTAMENTO.md). Só a prévia
 * web do app conversa, pelo WebRTC do navegador (`voz-ao-vivo.web.ts`).
 */
export function suporteVozAoVivo(): boolean {
  return false;
}

/** Sem suporte, a opção nem aparece. Se for chamado assim mesmo, a conversa termina como "não conectou" e a tela volta ao texto. */
export function iniciarControladorVozAoVivo({ aoMudar, aoErroFatal }: OpcoesControladorVoz): ControladorVozAoVivo {
  let descartado = false;
  void Promise.resolve().then(() => {
    if (descartado) return;
    aoMudar({ ...estadoInicialVozAoVivo(), estado: 'erro', erro: 'falhaConexao', anuncioSr: textoErroVozAoVivo('falhaConexao') });
    aoErroFatal?.('falhaConexao', '');
  });
  return {
    alternarMudo: () => false,
    encerrar: async () => '',
    descartar: () => { descartado = true; },
  };
}
