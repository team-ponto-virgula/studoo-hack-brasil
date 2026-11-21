import {
  contemCifraoDeLatex,
  contemFormulaMarcada,
  contemMarcaDeFormula,
  marcarFormulasSoltas,
  textoSemFormulas,
} from "@studoo/contratos";
import type { ConteudoLicao, ExercicioInterno } from "@/dominio/aprendizado/plano";
import { ehAssuntoDeMatematica } from "@/servidor/ia/matematica";

/*
 * Fórmula no texto da lição, sem imagem nem banco (spec 15): percorrer os textos que as pessoas leem, dizer se a lição é de
 * matemática e converter as marcas `$…$` (para texto linear, no cliente que não desenha; ou com os tokens soltos marcados, no que
 * desenha). Serve ao servidor da lição (`visuais.ts`) e aos geradores (`ia/comum.ts`), que limpam o texto na hora de guardar.
 */

const exercicios = (conteudo: ConteudoLicao): ExercicioInterno[] => [conteudo.exercicio, ...(conteudo.extras ?? [])].filter(Boolean);

export function temVisual(conteudo: ConteudoLicao): boolean {
  return Boolean(conteudo.visuais?.length || conteudo.resolucao || exercicios(conteudo).some((exercicio) => exercicio.visual));
}

/** Os campos que não têm texto de fórmula: respostas, termos de correção, desenhos, áudio, recurso e referências ficam como estão. */
const FICAM = new Set(["gabarito", "termos", "visuais", "visual", "resolucao", "falas", "fala", "recurso", "referencias", "comprovante", "certos"]);

/**
 * Percorre os textos da lição que as pessoas leem (menos `FICAM` e o `trecho` de código) e devolve o mesmo objeto se nada mudou.
 * `visitar` devolve o texto novo; o que ela devolver igual deixa o objeto como estava.
 */
export function transformarTextos(valor: unknown, visitar: (texto: string) => string, chave?: string, irmaos?: Record<string, unknown>): unknown {
  if (typeof valor === "string") {
    if ((chave !== undefined && FICAM.has(chave)) || (chave === "trecho" && irmaos?.trechoTipo === "codigo")) return valor;
    return visitar(valor);
  }
  if (Array.isArray(valor)) {
    const novos = valor.map((item) => transformarTextos(item, visitar, chave, irmaos));
    return novos.some((novo, posicao) => novo !== valor[posicao]) ? novos : valor;
  }
  if (valor !== null && typeof valor === "object") {
    if (chave !== undefined && FICAM.has(chave)) return valor;
    const objeto = valor as Record<string, unknown>;
    let mudou = false;
    const novo: Record<string, unknown> = {};
    for (const [campo, item] of Object.entries(objeto)) {
      const convertido = transformarTextos(item, visitar, campo, objeto);
      if (convertido !== item) mudou = true;
      novo[campo] = convertido;
    }
    return mudou ? novo : valor;
  }
  return valor;
}

/** Algum texto lido pelas pessoas satisfaz `quer`? (Mesmos campos de `transformarTextos`.) */
export function algumTexto(valor: unknown, quer: (texto: string) => boolean): boolean {
  let achou = false;
  transformarTextos(valor, (texto) => {
    if (!achou && quer(texto)) achou = true;
    return texto;
  });
  return achou;
}

/**
 * A lição é de matemática? Só nelas o texto é lido com marcas de fórmula e os tokens soltos (`x_A`) ganham a marca (spec 15,
 * seção 9). É quando a lição já tem matemática: um visual, um trecho de fórmula, uma fórmula marcada que lê (`$x_A$`), ou o assunto
 * (a regra de palavras). E NUNCA quando há trecho de código: "Em Python, use x_1 = 3 e print(x_1)." não é fórmula.
 */
export function conteudoEhDeMatematica(conteudo: ConteudoLicao): boolean {
  if (exercicios(conteudo).some((exercicio) => exercicio.trechoTipo === "codigo")) return false;
  return temVisual(conteudo) ||
    exercicios(conteudo).some((exercicio) => exercicio.trechoTipo === "formula") ||
    ehAssuntoDeMatematica(conteudo.objetivo, conteudo.conceito, conteudo.exemplo) ||
    algumTexto(conteudo, (texto) => contemFormulaMarcada(texto) || contemCifraoDeLatex(texto));
}

/**
 * Cada fórmula marcada com `$…$` nos textos vira texto linear (`x_G = (x_A + x_B + x_C) ÷ 3`), para o cliente que não desenha fórmula em
 * linha (build 3, site antigo): sem cifrão e sem LaTeX cru. O mesmo objeto quando não há marca.
 */
export function comTextoLinear<T>(valor: T): T {
  return transformarTextos(valor, (texto) => (contemMarcaDeFormula(texto) || contemCifraoDeLatex(texto) ? textoSemFormulas(texto) : texto)) as T;
}

/**
 * Para o cliente que desenha fórmula em linha (`visuais@1`), nas lições de matemática: os tokens soltos (`x_A`, `b^2`) e a conta curta
 * (`x = 3`) ganham a marca `$x_A$` e a fórmula química (`H_2O`) vira "H₂O". O cliente lê só o que está marcado, então é aqui que a
 * heurística liga, e só aqui. O LaTeX cru fora de marca vira texto linear. O mesmo objeto quando nada muda.
 */
export function comFormulasMarcadas<T>(valor: T): T {
  return transformarTextos(valor, (texto) => marcarFormulasSoltas(texto)) as T;
}
