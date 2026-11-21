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
import { comporDesenhos, desenharVisual, desenhoParaSvg, normalizarVisual, validarResolucao } from "../../packages/contratos/src/aprendizado.ts";

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

for (const arquivo of readdirSync(dirFixtures).filter((nome) => nome.endsWith(".json"))) {
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
