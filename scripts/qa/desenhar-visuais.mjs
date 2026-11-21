#!/usr/bin/env node
/*
 * Desenha os visuais das fixtures de matemática (tests/fixtures/matematica) em PNG, nos contextos do enunciado e da resposta, para
 * a revisão do Designer e para olhar o motor a olho. Não usa IA, banco nem rede.
 *
 * Uso: node --import tsx scripts/qa/desenhar-visuais.mjs <pasta de saída> [escala, padrão 4]
 * Sai um PNG por visual e contexto, mais a faixa da fórmula sobre a figura (o desenho que o build 3 receberia).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  comporDesenhos, desenharFormula, desenharFormulaEmLinha, desenharVisual, desenhoParaSvg, lerFormula, marcarFormulasSoltas, normalizarVisual,
  partirTextoComFormulas, validarResolucao,
} from "../../packages/contratos/src/aprendizado.ts";
import { caminhoDoTexto, deslocarCaminho, larguraDoTexto } from "../../packages/contratos/src/texto-vetorial.ts";

const saida = process.argv[2];
const escala = Number(process.argv[3] ?? 4);
if (!saida) {
  console.error("Uso: node --import tsx scripts/qa/desenhar-visuais.mjs <pasta de saída> [escala]");
  process.exit(2);
}
mkdirSync(saida, { recursive: true });
const dirFixtures = new URL("../../tests/fixtures/matematica/", import.meta.url).pathname;

async function png(desenho, nome) {
  const svg = desenhoParaSvg(desenho, { fundo: "branco", larguraEmPixels: Math.round(desenho.largura * escala) });
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(join(saida, `${nome}.png`), buffer);
  console.log(`${nome}.png ${desenho.largura}×${desenho.altura} · ${desenho.primitivas.length} primitivas · menor texto ${desenho.menorTexto} · ${(buffer.length / 1024).toFixed(1)} KB`);
}

for (const arquivo of readdirSync(dirFixtures).filter((nome) => nome.endsWith(".json") && !nome.startsWith("golden"))) {
  const nome = arquivo.replace(".json", "");
  const { licao } = JSON.parse(readFileSync(join(dirFixtures, arquivo), "utf8"));
  const formula = normalizarVisual(licao.visuais.find((visual) => visual.tipo === "formula"));
  const figura = normalizarVisual(licao.visuais.find((visual) => visual.tipo !== "formula"));
  const faixa = desenharVisual(formula, { tipo: "enunciado" }, { fundo: false });
  const enunciado = desenharVisual(figura, { tipo: "enunciado" });
  await png(enunciado, `${nome}-enunciado`);
  await png(desenharVisual(figura, { tipo: "retorno" }), `${nome}-resposta`);
  if (faixa) {
    // O PNG do build 3: a fórmula em faixa em cima e a figura embaixo, até 320 × 352.
    const cabeNaPrancheta = desenharVisual(figura, { tipo: "enunciado" }, { alturaMaxima: 352 - faixa.altura });
    await png(comporDesenhos([faixa, cabeNaPrancheta], { separador: true }), `${nome}-png-fase1`);
  }
  const bloco = desenharVisual(formula, { tipo: "enunciado" });
  await png(bloco, `${nome}-formula-bloco`);
  const resolucao = validarResolucao(licao.resolucao).resolucao;
  for (const [i, passo] of resolucao.passos.entries()) {
    if (passo.formula) {
      const lida = normalizarVisual({ tipo: "formula", latex: passo.formula }, { revela: true });
      await png(desenharVisual(lida, { tipo: "enunciado" }), `${nome}-passo${i + 1}-formula`);
    }
    if (passo.visual) await png(desenharVisual(passo.visual, { tipo: "passo", ultimo: i === resolucao.passos.length - 1 }), `${nome}-passo${i + 1}-visual`);
  }
}

// A galeria de fórmulas: o que o motor sabe desenhar, uma abaixo da outra, no tamanho da faixa do PNG.
const galeria = [
  String.raw`\Delta = b^2 - 4ac`,
  String.raw`A = \pi r^2 = 12.5`,
  String.raw`\left(\frac{x + 1}{2}\right)^2 \geq \sqrt{\frac{a}{b}}`,
  String.raw`a \leq b \neq c \to d \geq e`,
  String.raw`\begin{bmatrix} 1 & 2 \\ 3 & x_A \end{bmatrix} \times \begin{bmatrix} 5 \\ 6 \end{bmatrix}`,
  String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} = -2`,
  String.raw`x_G = \frac{x_A + x_B + x_C}{3} = \frac{\frac{1}{2} + 3}{4}`,
  String.raw`\text{área} = \frac{1}{2} \times \text{base} \times h`,
  String.raw`\foco{x_C} = \resposta{4} \neq 5`,
  String.raw`x_{A B}^{2} + y^{n+1} - 3.5 \div 2 = (1.5, 2)`,
  String.raw`\frac{-b + \sqrt{b^2 - 4ac}}{2a}`,
];
const faixas = galeria.map((fonte) => desenharFormula(lerFormula(fonte).arvore, { fundo: false })).filter(Boolean);
await png(comporDesenhos(faixas, { separador: true }), "galeria-formulas");

// Casos de borda do plano: um ponto colado na origem e um ponto cercado, onde o rótulo não cabe e as coordenadas vão para a legenda.
const casosDeBorda = {
  "ponto-na-origem": { tipo: "plano", alt: "Os pontos O, P e Q perto da origem.", x: [-4, 5], y: [-3, 5], pontos: [{ id: "O", x: 0, y: 0 }, { id: "P", x: 1, y: 1 }, { id: "Q", x: -1, y: 2, papel: "especial" }], segmentos: [{ de: "O", ate: "P" }, { de: "P", ate: "Q" }] },
  "ponto-cercado": { tipo: "plano", alt: "Um ponto cercado por oito vizinhos.", x: [-6, 6], y: [-6, 6], pontos: [{ id: "A", x: 0, y: 0 }, ...[[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y], i) => ({ id: `V${i}`, x, y, rotulo: false }))] },
};
for (const [nome, bruto] of Object.entries(casosDeBorda)) await png(desenharVisual(normalizarVisual(bruto), { tipo: "enunciado" }), nome);

// O ponto na origem com espaço: o rótulo inteiro "O (0, 0)" no gráfico e nenhum 0 de eixo.
await png(desenharVisual(normalizarVisual({
  tipo: "plano", alt: "O ponto O na origem e dois pontos longe dele.", x: [-5, 6], y: [-4, 6],
  pontos: [{ id: "O", x: 0, y: 0 }, { id: "P", x: 4, y: 4 }, { id: "Q", x: -4, y: 3, papel: "especial" }], segmentos: [{ de: "P", ate: "Q" }],
}), { tipo: "enunciado" }), "ponto-origem-livre");

// O motor respeita a altura que o cliente dá: a figura de cada fixture em 158 (iPhone pequeno), 179, 200 e 352; só o gráfico desce.
for (const nome of ["baricentro", "colinearidade"]) {
  const { licao } = JSON.parse(readFileSync(join(dirFixtures, `${nome}.json`), "utf8"));
  const figura = normalizarVisual(licao.visuais.find((visual) => visual.tipo !== "formula"));
  for (const alturaMaxima of [158, 179, 200, 352]) {
    const desenho = desenharVisual(figura, { tipo: "enunciado" }, { alturaMaxima });
    await png(desenho, `altura-${nome}-${alturaMaxima}`);
    if (desenho.naoCabe || desenho.altura > alturaMaxima) throw new Error(`${nome}: ${desenho.altura} passa de ${alturaMaxima}`);
  }
}

// A fórmula em linha ao lado do texto, no peso do texto ao redor: 400 na aula, 700 no enunciado (o texto também é desenhado pelo motor,
// só para a comparação: o app e a web põem o texto deles e a fórmula em linha no meio, sobre a mesma linha de base).
function linhaDeFrase(texto, peso, tamanho) {
  const primitivas = [];
  const base = Math.round(tamanho * 1.5);
  let x = 6;
  for (const segmento of partirTextoComFormulas(marcarFormulasSoltas(texto))) {
    if (segmento.tipo === "texto") {
      primitivas.push({ tipo: "caminho", d: caminhoDoTexto(segmento.texto, x, base, tamanho, peso), preenchimento: "texto" });
      x += larguraDoTexto(segmento.texto, tamanho, peso);
      continue;
    }
    const caixa = desenharFormulaEmLinha(segmento.arvore, tamanho, peso);
    for (const primitiva of caixa.primitivas) {
      const dy = base - caixa.linhaDeBase;
      if (primitiva.tipo === "caminho") primitivas.push({ ...primitiva, d: deslocarCaminho(primitiva.d, x, dy) });
      else if (primitiva.tipo === "linha") primitivas.push({ ...primitiva, x1: primitiva.x1 + x, x2: primitiva.x2 + x, y1: primitiva.y1 + dy, y2: primitiva.y2 + dy });
      else if (primitiva.tipo === "retangulo") primitivas.push({ ...primitiva, x: primitiva.x + x, y: primitiva.y + dy });
      else primitivas.push({ ...primitiva, cx: primitiva.cx + x, cy: primitiva.cy + dy });
    }
    x += caixa.largura;
  }
  return { primitivas, largura: x + 6, altura: Math.round(tamanho * 2.2) };
}
const frasesEmLinha = [
  "Se x = 3, então x^2 = 9 e a + b = 5.",
  "O valor de $x_C$ é 4: $x_G = (x_A + x_B + x_C) / 3$.",
  "Metade: $1/2$ ou $\\frac{x_A}{2}$; o ponto médio é $\\frac{x_A + x_B}{2}$.",
  "Com $b^2 - 4ac = 0$ e outro, $\\Delta = b^2 - 4ac$ vale 25.",
];
const linhas = [];
for (const [peso, tamanho] of [[400, 16], [700, 16], [700, 17]]) {
  for (const frase of frasesEmLinha) linhas.push({ ...linhaDeFrase(frase, peso, tamanho), rotulo: `${peso} · ${tamanho}` });
}
const larguraDaGaleria = Math.max(...linhas.map((linha) => linha.largura)) + 60;
let yDaLinha = 0;
const primitivasDaGaleria = [];
for (const linha of linhas) {
  primitivasDaGaleria.push({ tipo: "caminho", d: caminhoDoTexto(linha.rotulo, 4, yDaLinha + 22, 13, 700), preenchimento: "suave" });
  for (const primitiva of linha.primitivas) {
    const dx = 54;
    if (primitiva.tipo === "caminho") primitivasDaGaleria.push({ ...primitiva, d: deslocarCaminho(primitiva.d, dx, yDaLinha) });
    else if (primitiva.tipo === "linha") primitivasDaGaleria.push({ ...primitiva, x1: primitiva.x1 + dx, x2: primitiva.x2 + dx, y1: primitiva.y1 + yDaLinha, y2: primitiva.y2 + yDaLinha });
    else if (primitiva.tipo === "retangulo") primitivasDaGaleria.push({ ...primitiva, x: primitiva.x + dx, y: primitiva.y + yDaLinha });
    else primitivasDaGaleria.push({ ...primitiva, cx: primitiva.cx + dx, cy: primitiva.cy + yDaLinha });
  }
  yDaLinha += linha.altura;
}
await png({ largura: larguraDaGaleria, altura: yDaLinha, primitivas: primitivasDaGaleria, descricao: "Fórmulas em linha, nos pesos 400 e 700.", menorTexto: 11, textos: [], caixas: [] }, "formulas-em-linha-peso");
