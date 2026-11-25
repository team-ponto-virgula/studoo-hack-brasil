import { jornadaAzul } from '../../../packages/contratos/src/jornada-azul';

/** Jornada Azul: os mesmos tokens alimentam a web e os componentes nativos. */
export const cores = jornadaAzul.cores;

/** O relevo marca uma ação disponível; a cor semântica continua legível sem animação. */
export const labios = jornadaAzul.labios;

export const raios = jornadaAzul.raios;

/** Compatibilidade com os consumidores da escala; as medidas de papéis vêm do contrato. */
export const espacos = jornadaAzul.escalaEspacos;
export const duracoes = jornadaAzul.motion;
export const medidas = jornadaAzul.medidas;

export const fontes = {
  titulo: 'StudooTitulo',
  corpo: 'StudooCorpo',
} as const;
