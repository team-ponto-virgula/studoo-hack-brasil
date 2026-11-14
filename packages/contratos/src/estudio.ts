import type { ExercicioPublico, PropostaPlano } from './aprendizado';

export const LIMITES_ESTUDIO = {
  arquivoBytes: 5 * 1024 * 1024,
  paginas: 6,
  texto: 24000,
  explicacao: 3000,
  audioSegundos: 60,
  csvLinhas: 200,
  csvColunas: 20,
} as const;
export type ArquivoEstudo = { nome: string; tipo: string; base64: string };
export type PaginaMaterial = {
  numero: number;
  texto: string;
  rotulo?: string;
  tabela?: string[][];
};
export type ReferenciaMaterial = {
  materialId: string;
  nome: string;
  pagina: number;
  localizacao?: string;
  trecho: string;
  leitura: 'texto' | 'ocr' | 'demonstracao';
};
export type MaterialEstudo = {
  id: string;
  nome: string;
  paginas: PaginaMaterial[];
  leitura: ReferenciaMaterial['leitura'];
  expiraEm: string;
};
export type PonteReforco = {
  motivo: string;
  conceito: string;
  exemplo: string;
  exercicio: ExercicioPublico;
  concluida: boolean;
  simulado: boolean;
};
export type FeedbackEnsino = {
  acertos: string[];
  lacuna: string;
  pergunta: string;
  proximoPasso: string;
  simulado: boolean;
};
export type ApoioEstudo = {
  erros: number;
  ponte: PonteReforco | null;
  ensino: FeedbackEnsino | null;
};
export type ClienteEstudio = {
  enviarMaterial: (arquivo: ArquivoEstudo) => Promise<MaterialEstudo>;
  materialDemo: () => Promise<MaterialEstudo>;
  excluirMaterial: (id: string) => Promise<null>;
  proporMaterial: (id: string, objetivo: string) => Promise<PropostaPlano>;
  apoioLicao: (id: string) => Promise<ApoioEstudo>;
  criarPonte: (id: string) => Promise<ApoioEstudo>;
  avaliarPonte: (
    id: string,
    resposta: string,
  ) => Promise<{ correta: boolean; feedback: string; apoio: ApoioEstudo }>;
  ensinarStu: (id: string, texto: string) => Promise<FeedbackEnsino>;
  transcrever: (arquivo: ArquivoEstudo) => Promise<{ texto: string }>;
};
