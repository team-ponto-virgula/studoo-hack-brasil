import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  comAlturaMinima,
  comporDesenhos,
  desenharVisual,
  desenhoParaSvg,
  falarFormula,
  formulaLinear,
  lerFormula,
  normalizarResolucao,
  normalizarVisual,
  normalizarVisuais,
  passosEmTexto,
  resolucaoParaCliente,
  visualParaEnunciado,
  visualRevelado,
  type Capacidades,
  type Desenho,
  type LicaoDetalhe,
  type Recurso,
  type ResolucaoGuardada,
  type Visual,
  type VisualFigura,
  type VisualFormula,
} from "@studoo/contratos";
import type { ConteudoLicao, ExercicioInterno } from "@/dominio/aprendizado/plano";
import { comFormulasMarcadas, comTextoLinear, conteudoEhDeMatematica, temVisual } from "./formulas-na-licao";

export { comFormulasMarcadas, comTextoLinear, conteudoEhDeMatematica, temVisual } from "./formulas-na-licao";

/*
 * Visuais da lição no servidor (spec 15). Duas portas, as duas atrás do cabeçalho `X-Studoo-Capacidades`:
 * - com `visuais@1` (web nova, build 4): a lição leva `visuais`, o `visual` de cada exercício (sem a posição do procurado) e,
 *   com `resolucao@1`, a resolução até o "Sua vez" (`resolucaoParaCliente`);
 * - sem o cabeçalho (build 3, site antigo): nenhum campo novo. Nas lições de matemática com visual, o desenho vai como um PNG no
 *   lugar da foto em `recurso` (que esses clientes já desenham, com a legenda "Desenho do Studoo · …"), e a resolução vira
 *   `passos` de texto, sem "Sua vez". Se o PNG falhar, o `recurso` gravado fica como estava.
 * Lição sem visual nem resolução sai exatamente como antes.
 */

export interface OpcoesDeVisuais {
  capacidades: Capacidades;
  /** Gera o PNG do build 3 (custa CPU: só a rota da lição pede; o reforço e a voz não precisam dele). */
  desenharPng?: boolean;
}

export const SEM_CAPACIDADES: Capacidades = { visuais: 0, resolucao: 0 };

const FONTE_DO_DESENHO = "Desenho do Studoo";
/** A prancheta de 320 pontos em 4×. */
const LARGURA_DO_PNG = 1280;
/** O `src` do `recurso` imagem vale até 700.000 caracteres (`recursoValido`). */
const LIMITE_DO_SRC = 700_000;
const ALTURA_MAXIMA_DA_PRANCHETA = 352;
const DESCRICAO_MAXIMA = 140;

/* ----- Cache pequeno: a entrada mais antiga sai primeiro ----- */

class Memoria<V> {
  private readonly itens = new Map<string, V>();
  constructor(private readonly limite: number) {}
  pegar(chave: string): V | undefined {
    const valor = this.itens.get(chave);
    if (valor !== undefined) {
      this.itens.delete(chave);
      this.itens.set(chave, valor);
    }
    return valor;
  }
  guardar(chave: string, valor: V): void {
    this.itens.delete(chave);
    this.itens.set(chave, valor);
    while (this.itens.size > this.limite) this.itens.delete(this.itens.keys().next().value as string);
  }
  tirar(chave: string): void {
    this.itens.delete(chave);
  }
}

const hash = (valor: unknown): string => createHash("sha256").update(JSON.stringify(valor) ?? "").digest("hex");

/* ----- O que está guardado, limpo ----- */

export interface VisuaisLimpos {
  visuais?: Visual[];
  resolucao?: ResolucaoGuardada;
  /** O `visual` de cada exercício, na ordem dos exercícios (`undefined` onde não há ou não vale). */
  dosExercicios: (Visual | undefined)[];
}

const limpos = new Memoria<VisuaisLimpos>(200);

function exercicios(conteudo: ConteudoLicao): ExercicioInterno[] {
  return [conteudo.exercicio, ...(conteudo.extras ?? [])];
}

/**
 * Valida de novo o que a lição guarda (`conteudoValido` não olha estes campos, de propósito): o visual que não vale mais some, a
 * resolução que não vale some, e a lição segue. O resultado fica em memória, por conteúdo.
 */
export function limparVisuais(conteudo: ConteudoLicao): VisuaisLimpos {
  const chave = hash([conteudo.visuais, conteudo.resolucao, exercicios(conteudo).map((exercicio) => exercicio.visual)]);
  const guardado = limpos.pegar(chave);
  if (guardado) return guardado;
  const visuais = normalizarVisuais(conteudo.visuais);
  const resolucao = conteudo.resolucao ? normalizarResolucao(conteudo.resolucao) ?? undefined : undefined;
  const limpo: VisuaisLimpos = {
    ...(visuais ? { visuais } : {}),
    ...(resolucao ? { resolucao } : {}),
    dosExercicios: exercicios(conteudo).map((exercicio) => (exercicio.visual ? normalizarVisual(exercicio.visual) ?? undefined : undefined)),
  };
  limpos.guardar(chave, limpo);
  return limpo;
}

/* ----- O PNG do build 3 ----- */

type Imagem = Extract<Recurso, { tipo: "imagem" }>;

function limitar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > maximo * 0.5 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.-]+$/, "")}…`;
}

/** A legenda do PNG (e o texto do leitor de tela): as legendas curtas das peças, separadas por ponto, em até 140 caracteres. */
export function descricaoDaPrancheta(formulas: readonly VisualFormula[], figura: VisualFigura | undefined): string {
  const partes = formulas.map((formula) => {
    if (formula.alt) return formula.alt;
    const lida = lerFormula(formula.latex);
    return lida.ok ? `Fórmula: ${falarFormula(lida.arvore)}` : "Fórmula";
  });
  if (figura) partes.push(figura.alt);
  return limitar(partes.map((parte) => parte.replace(/[.\s]+$/, "")).join(". ") + (figura ? "." : ""), DESCRICAO_MAXIMA);
}

/**
 * O desenho do build 3: uma prancheta de 320 pontos com a primeira figura e até duas fórmulas em faixas em cima, no modo enunciado
 * (nunca a resposta), com no máximo 320 × 352. O que não cabe fica no texto linear da lição.
 */
export function pranchetaDosVisuais(visuais: readonly Visual[]): { desenho: Desenho; formulas: VisualFormula[]; figura?: VisualFigura } | null {
  const todasAsFormulas = visuais.filter((visual): visual is VisualFormula => visual.tipo === "formula").slice(0, 2);
  const figura = visuais.find((visual): visual is VisualFigura => visual.tipo !== "formula");
  let faixas = todasAsFormulas.flatMap((formula) => {
    const desenho = desenharVisual(formula, { tipo: "enunciado" }, { fundo: false });
    return desenho ? [{ formula, desenho }] : [];
  });
  const minimoDaFigura = figura?.tipo === "reta_numerica" ? 140 : 160;
  let embaixo: Desenho | null = null;
  if (figura) {
    for (;;) {
      const alturaDasFaixas = faixas.reduce((soma, faixa) => soma + faixa.desenho.altura, 0);
      const sobra = ALTURA_MAXIMA_DA_PRANCHETA - alturaDasFaixas;
      if (sobra >= minimoDaFigura || faixas.length === 0) {
        embaixo = desenharVisual(figura, { tipo: "enunciado" }, { alturaMaxima: sobra });
        // A figura que não coube (`naoCabe`) ou que passa da prancheta cede o lugar a uma faixa; sem faixa, fica só o texto.
        if (embaixo && (embaixo.naoCabe || alturaDasFaixas + embaixo.altura > ALTURA_MAXIMA_DA_PRANCHETA) && faixas.length > 0) {
          faixas = faixas.slice(0, -1);
          continue;
        }
        if (embaixo?.naoCabe) embaixo = null;
        break;
      }
      faixas = faixas.slice(0, -1);
    }
  }
  const partes = [...faixas.map((faixa) => faixa.desenho), ...(embaixo ? [embaixo] : [])];
  if (partes.length === 0) return null;
  let desenho = comporDesenhos(partes, { separador: true });
  if (!embaixo) desenho = comAlturaMinima(desenho, 100);
  return { desenho, formulas: faixas.map((faixa) => faixa.formula), ...(embaixo && figura ? { figura } : {}) };
}

const pranchetas = new Memoria<Promise<Imagem | null>>(48);

/** O PNG em 4× como `recurso` imagem, ou `null` se algo falhar (aí o recurso gravado fica). */
export function recursoDoDesenho(visuais: readonly Visual[]): Promise<Imagem | null> {
  const chave = hash(visuais);
  const pronta = pranchetas.pegar(chave);
  if (pronta) return pronta;
  const nova = (async (): Promise<Imagem | null> => {
    try {
      const prancheta = pranchetaDosVisuais(visuais);
      if (!prancheta) return null;
      const svg = desenhoParaSvg(prancheta.desenho, { fundo: "branco", larguraEmPixels: LARGURA_DO_PNG });
      const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
      const src = `data:image/png;base64,${png.toString("base64")}`;
      if (src.length > LIMITE_DO_SRC) return null;
      return { tipo: "imagem", src, descricao: descricaoDaPrancheta(prancheta.formulas, prancheta.figura), fonte: FONTE_DO_DESENHO };
    } catch {
      return null;
    }
  })();
  pranchetas.guardar(chave, nova);
  void nova.then((imagem) => {
    if (!imagem) pranchetas.tirar(chave);
  });
  return nova;
}

/* ----- A lição ----- */

function emTexto(formula: string): string | null {
  const lida = lerFormula(formula);
  return lida.ok ? formulaLinear(lida.arvore) : null;
}

/**
 * Aplica as portas de capacidade ao que `buscarLicao` já montou. Sem visual nem resolução guardados, devolve o mesmo objeto.
 */
export async function comVisuais(detalhe: LicaoDetalhe, conteudo: ConteudoLicao, opcoes: OpcoesDeVisuais): Promise<LicaoDetalhe> {
  if (!temVisual(conteudo)) return detalhe;
  const { capacidades, desenharPng = false } = opcoes;
  const limpo = limparVisuais(conteudo);
  const saida: LicaoDetalhe = { ...detalhe };

  if (capacidades.visuais >= 1) {
    if (limpo.visuais) saida.visuais = limpo.visuais.map(visualParaEnunciado);
    if (limpo.dosExercicios.some(Boolean)) {
      saida.exercicios = detalhe.exercicios.map((exercicio, posicao) => {
        const visual = limpo.dosExercicios[posicao];
        return visual ? { ...exercicio, visual: visualParaEnunciado(visual) } : exercicio;
      });
      saida.exercicio = saida.exercicios[0];
    }
  }

  const comResolva = capacidades.visuais >= 1 && capacidades.resolucao >= 1;
  if (limpo.resolucao) {
    if (comResolva) saida.resolucao = resolucaoParaCliente(limpo.resolucao);
    // Quem não desenha o "Resolva comigo" lê o exemplo em passos de texto, sem "Sua vez".
    else if (!detalhe.passos) saida.passos = passosEmTexto(limpo.resolucao, emTexto);
  }

  // Build 3 e site antigo: o desenho no lugar da foto, só em lição de matemática com visual válido (a foto continua guardada).
  const fotoOuNada = !detalhe.recurso || detalhe.recurso.tipo === "imagem";
  if (capacidades.visuais < 1 && desenharPng && limpo.visuais && fotoOuNada) {
    const imagem = await recursoDoDesenho(limpo.visuais);
    if (imagem) saida.recurso = imagem;
  }
  return saida;
}

/** O visual do exercício com o procurado virado em resposta, para o retorno de quem acertou (só figura; só com `visuais@1`). */
export function visualDoRetorno(conteudo: ConteudoLicao, indice: number, capacidades: Capacidades): VisualFigura | undefined {
  if (capacidades.visuais < 1) return undefined;
  const visual = limparVisuais(conteudo).dosExercicios[indice];
  return visual && visual.tipo !== "formula" ? visualRevelado(visual) : undefined;
}

/* ----- Fórmula em linha: o texto linear para quem não desenha, e as marcas para quem desenha ----- */
/* Os helpers puros (percorrer os textos da lição, conteudoEhDeMatematica, comTextoLinear, comFormulasMarcadas) estão em `formulas-na-licao.ts`. */

/**
 * O texto da lição como o cliente o lê: nas lições de matemática, com `visuais@1` as fórmulas ficam marcadas (e os tokens soltos
 * ganham a marca, `comFormulasMarcadas`) e sem ele viram texto linear (`comTextoLinear`). Lição que não é de matemática passa
 * intacta, o mesmo objeto.
 */
export function comFormulasParaOCliente<T>(valor: T, conteudo: ConteudoLicao, capacidades: Capacidades): T {
  if (!conteudoEhDeMatematica(conteudo)) return valor;
  return capacidades.visuais >= 1 ? comFormulasMarcadas(valor) : comTextoLinear(valor);
}
