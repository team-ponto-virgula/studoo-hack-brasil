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
import { comporDesenhos, desenharFormula, desenharVisual, desenhoParaSvg, lerFormula, normalizarVisual, validarResolucao } from "../../packages/contratos/src/aprendizado.ts";

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
