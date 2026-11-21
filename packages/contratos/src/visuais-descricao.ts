import { numeroParaTela, rotuloDoPonto } from "./motor-visuais";
import type { PapelPonto, TipoDerivado, VisualFigura } from "./visuais";

/*
 * A descrição que o leitor de tela lê (`alt`) depois que a resposta é revelada (spec 15, seção 12; pedido do Designer): montada pelo
 * motor a partir dos DADOS da figura, os pontos, os papéis e as coordenadas, nunca do texto da IA. O `alt` do enunciado é o da IA
 * (o validador não deixa ele trazer a posição do procurado); o do retorno, que já traz a resposta, é este, para a frase que o app
 * anuncia dizer onde o ponto está: "Plano cartesiano com A (1, 2), B (−2, 7), baricentro G (1, 3) e o vértice C (4, 0).".
 */

const DERIVADOS: Readonly<Record<TipoDerivado, { nome: string; artigo: "o" | "a" }>> = {
  baricentro: { nome: "baricentro", artigo: "o" },
  ponto_medio: { nome: "ponto médio", artigo: "o" },
  media: { nome: "média", artigo: "a" },
};

/** Acima disto a frase seria longa demais para um anúncio: vira a contagem dos pontos e o que foi achado. */
export const TAMANHO_MAXIMO_DA_DESCRICAO = 200;

const lista = (itens: readonly string[]): string => (itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`);

interface PontoLido {
  id: string;
  papel: PapelPonto;
  x?: number;
  y?: number;
  valor?: number;
  derivado?: { tipo: TipoDerivado };
}

/**
 * A frase da figura, dos dados: primeiro os pontos dados, depois os de destaque (com o nome do que são: "baricentro G"), depois o que
 * foi achado ("o vértice C (4, 0)": vértice se está num polígono, ponto médio ou baricentro se é derivado, senão ponto) e, se ainda
 * houver um procurado sem posição, "o ponto procurado C". Sem inventar nada além do que está nos pontos e nos polígonos.
 */
export function descricaoDaFigura(visual: VisualFigura): string {
  const noPoligono = new Set(visual.tipo === "plano" ? (visual.poligonos ?? []).flatMap((poligono) => poligono.pontos) : []);
  const pontos = visual.pontos as PontoLido[];
  const onde = (ponto: PontoLido): string => {
    if (visual.tipo === "plano") return ponto.x !== undefined && ponto.y !== undefined ? rotuloDoPonto(ponto.id, [ponto.x, ponto.y]) : ponto.id;
    return ponto.valor !== undefined ? `${ponto.id} em ${numeroParaTela(ponto.valor)}` : ponto.id;
  };
  const dados = pontos.filter((ponto) => ponto.papel === "dado").map(onde);
  const especiais = pontos.filter((ponto) => ponto.papel === "especial").map((ponto) => (ponto.derivado ? `${DERIVADOS[ponto.derivado.tipo].nome} ${onde(ponto)}` : onde(ponto)));
  const respostas = pontos.filter((ponto) => ponto.papel === "resposta").map((ponto) => {
    const { nome, artigo } = ponto.derivado ? DERIVADOS[ponto.derivado.tipo] : { nome: noPoligono.has(ponto.id) ? "vértice" : "ponto", artigo: "o" as const };
    return `${artigo} ${nome} ${onde(ponto)}`;
  });
  const procurados = pontos.filter((ponto) => ponto.papel === "procurado").map((ponto) => `o ${noPoligono.has(ponto.id) ? "vértice" : "ponto"} procurado ${ponto.id}`);
  const cabeca = visual.tipo === "plano" ? "Plano cartesiano" : `Reta numérica de ${numeroParaTela(visual.de)} a ${numeroParaTela(visual.ate)}`;
  const inteira = `${cabeca} com ${lista([...dados, ...especiais, ...respostas, ...procurados])}.`;
  if (inteira.length <= TAMANHO_MAXIMO_DA_DESCRICAO) return inteira;
  return `${cabeca} com ${pontos.length} pontos${respostas.length > 0 ? `, entre eles ${lista(respostas)}` : ""}.`;
}

/**
 * A figura com a descrição da resposta, quando ela traz um ponto `resposta` (o último passo da resolução, o retorno de quem acertou):
 * o `alt` passa a ser a frase montada dos dados. Figura sem resposta (um passo do meio, o enunciado) volta como está, com o `alt` dela.
 */
export function comDescricaoDaResposta<V extends VisualFigura>(visual: V): V {
  return visual.pontos.some((ponto) => ponto.papel === "resposta") ? { ...visual, alt: descricaoDaFigura(visual) } : visual;
}
