import { desenharFormulaEmLinha, formulaEmPecas, formulaLinear, type DesenhoEmLinha, type NoFormula, type SegmentoDeTexto } from '@studoo/contratos';

/*
 * A frase com fórmula em linha, sem React (spec 15, seções 1 e 9): o que vai desenhado e o que vai como texto. O componente
 * (`texto-com-formulas.tsx`) só monta; aqui fica o que os testes sem servidor conferem.
 */

/**
 * O peso da fórmula é o do texto em volta (spec 15, seção 10): regular (400) na aula, negrito (700) no enunciado e nos títulos.
 * O motor desenha o peso pedido (marco 2d), com as variáveis em itálico.
 */
export type PesoDaFormula = 400 | 700;

/** O peso do texto em volta: 600 ou mais é negrito; o resto, regular. */
export function pesoDoTexto(fontWeight: unknown): PesoDaFormula {
  const numero = fontWeight === 'bold' ? 700 : Number(fontWeight);
  return Number.isFinite(numero) && numero >= 600 ? 700 : 400;
}

/** O desenho de um nó em linha, ou `null` quando ele não se desenha ou não cabe em `limite` pontos (já com a escala). */
export function desenhoQueCabe(no: NoFormula, tamanho: number, escala: number, limite: number, peso: PesoDaFormula = 700): DesenhoEmLinha | null {
  try {
    const desenho = desenharFormulaEmLinha(no, tamanho, peso);
    return desenho.largura > 0 && desenho.largura * escala <= limite ? desenho : null;
  } catch {
    return null;
  }
}

/** Um item da frase: texto comum (quebra como as palavras) ou uma fórmula desenhada em linha (não quebra). */
export type ItemDaFrase = { tipo: 'texto'; texto: string } | { tipo: 'desenho'; desenho: DesenhoEmLinha };

/**
 * A frase em itens. A fórmula que cabe inteira na linha vai desenhada inteira; a que não cabe vai em PEÇAS (spec 15, seção 9,
 * `formulaEmPecas`): parênteses, sinais e o ÷ da fração composta como texto, e cada variável, índice, expoente e fração simples
 * desenhado, para nunca mostrar `_`, `^`, `\`, `{` ou `}`. O linear só entra se nem a peça se desenha (não deve ocorrer).
 */
export function itensDaFrase(trechos: readonly SegmentoDeTexto[], tamanho: number, escala: number, limite: number, peso: PesoDaFormula = 700): ItemDaFrase[] {
  const itens: ItemDaFrase[] = [];
  const texto = (valor: string) => {
    if (!valor) return;
    const ultimo = itens[itens.length - 1];
    if (ultimo?.tipo === 'texto') ultimo.texto += valor;
    else itens.push({ tipo: 'texto', texto: valor });
  };
  for (const trecho of trechos) {
    if (trecho.tipo === 'texto') { texto(trecho.texto); continue; }
    const inteiro = desenhoQueCabe(trecho.arvore, tamanho, escala, limite, peso);
    if (inteiro) { itens.push({ tipo: 'desenho', desenho: inteiro }); continue; }
    for (const peca of formulaEmPecas(trecho.arvore, (no) => desenhoQueCabe(no, tamanho, escala, limite, peso) !== null)) {
      if (typeof peca === 'string') { texto(peca); continue; }
      const desenho = desenhoQueCabe(peca, tamanho, escala, limite, peso);
      if (desenho) itens.push({ tipo: 'desenho', desenho });
      else texto(formulaLinear(peca));
    }
  }
  return itens;
}

