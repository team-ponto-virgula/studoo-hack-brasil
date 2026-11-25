export const LIMITE_PERGUNTAS_DIAGNOSTICO = 4;
export const NIVEIS_DIAGNOSTICO = ['basico', 'intermediario', 'avancado'] as const;
export type NivelDiagnostico = typeof NIVEIS_DIAGNOSTICO[number];

export interface PerfilDiagnostico {
  nivel: NivelDiagnostico;
  escopo: string;
  demonstrados: string[];
  lacunas: string[];
}

export type PassoDiagnostico =
  | { tipo: 'pergunta'; id: string; numero: number; pergunta: { id: string; enunciado: string; opcoes: { id: string; texto: string }[] } }
  | { tipo: 'resultado'; id: string; perfil: PerfilDiagnostico };

export interface EstudoNoPerfil {
  trilhasConcluidas: number;
  diasSeguidos: number;
}

export function perfilDiagnosticoValido(valor: unknown): valor is PerfilDiagnostico {
  if (!valor || typeof valor !== 'object') return false;
  const p = valor as PerfilDiagnostico;
  const lista = (x: unknown) => Array.isArray(x) && x.length <= LIMITE_PERGUNTAS_DIAGNOSTICO
    && x.every(t => typeof t === 'string' && t.length > 0 && t.length <= 100);
  return NIVEIS_DIAGNOSTICO.includes(p.nivel) && typeof p.escopo === 'string'
    && p.escopo.length > 0 && p.escopo.length <= 150 && lista(p.demonstrados) && lista(p.lacunas);
}
