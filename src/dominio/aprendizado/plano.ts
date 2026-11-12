import type { ExercicioPublico, Progresso } from "@studoo/contratos";

export type ExercicioInterno = ExercicioPublico & {
  gabarito: string[];
  feedbackCorreto: string;
  feedbackIncorreto: string;
};

export type ConteudoLicao = {
  objetivo: string;
  conceito: string;
  exemplo: string;
  origem: string;
  exercicio: ExercicioInterno;
};

export type LicaoInterna = ConteudoLicao & { titulo: string };

export type PlanoInterno = {
  titulo: string;
  objetivo: string;
  origem: string;
  fluxos: { titulo: string; licoes: LicaoInterna[] }[];
};

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function listaValida<T>(valor: unknown, validar: (item: unknown) => item is T): valor is T[] {
  return Array.isArray(valor) && valor.length > 0 && valor.every(validar);
}

function opcaoValida(valor: unknown): valor is { id: string; texto: string } {
  return objeto(valor) && texto(valor.id) && texto(valor.texto);
}

function exercicioValido(valor: unknown): valor is ExercicioInterno {
  if (!objeto(valor) || !texto(valor.enunciado) || !texto(valor.feedbackCorreto) ||
      !texto(valor.feedbackIncorreto) || !listaValida(valor.gabarito, texto)) {
    return false;
  }

  if ((valor.contexto !== undefined && !texto(valor.contexto)) ||
      (valor.trecho !== undefined && !texto(valor.trecho))) {
    return false;
  }

  if (valor.tipo === "lacuna") {
    return true;
  }

  if (valor.tipo !== "multipla_escolha" || !listaValida(valor.opcoes, opcaoValida) ||
      valor.opcoes.length < 2 || valor.gabarito.length !== 1) {
    return false;
  }

  const ids = new Set(valor.opcoes.map(({ id }) => id));
  return ids.size === valor.opcoes.length && ids.has(valor.gabarito[0]);
}

export function conteudoValido(valor: unknown): valor is ConteudoLicao {
  return objeto(valor) && texto(valor.objetivo) && texto(valor.conceito) &&
    texto(valor.exemplo) && texto(valor.origem) && exercicioValido(valor.exercicio);
}

function licaoValida(valor: unknown): valor is LicaoInterna {
  return objeto(valor) && texto(valor.titulo) && conteudoValido(valor);
}

function fluxoValido(valor: unknown): valor is PlanoInterno["fluxos"][number] {
  return objeto(valor) && texto(valor.titulo) && listaValida(valor.licoes, licaoValida);
}

export function planoValido(valor: unknown): valor is PlanoInterno {
  return objeto(valor) && texto(valor.titulo) && texto(valor.objetivo) && texto(valor.origem) &&
    listaValida(valor.fluxos, fluxoValido);
}

export function apresentarExercicio(exercicio: ExercicioInterno): ExercicioPublico {
  const { tipo, enunciado, contexto, trecho } = exercicio;
  if (tipo === "multipla_escolha") {
    const opcoes = exercicio.opcoes.map(({ id, texto }) => ({ id, texto }));
    return { tipo, enunciado, contexto, trecho, opcoes };
  }

  return { tipo, enunciado, contexto, trecho };
}

export function avaliarResposta(exercicio: ExercicioInterno, resposta: string) {
  const valor = resposta.trim();
  if (!valor || valor.length > 100 || /[\r\n\0]/.test(valor)) {
    return null;
  }

  if (exercicio.tipo === "multipla_escolha" && !exercicio.opcoes.some(({ id }) => id === valor)) {
    return null;
  }

  const correta = exercicio.gabarito.includes(valor);
  return { correta, feedback: correta ? exercicio.feedbackCorreto : exercicio.feedbackIncorreto };
}

export function calcularProgresso(concluidas: number, total: number): Progresso {
  return { concluidas, total, percentual: total === 0 ? null : (concluidas / total) * 100 };
}
