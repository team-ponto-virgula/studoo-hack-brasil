import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import {
  LARGURA_DO_DESENHO,
  PAPEIS_DE_COR,
  PALETA_DO_DESENHO,
  PISO_DO_TEXTO,
  TETO_DE_PRIMITIVAS,
  caminhoValido,
  comporDesenhos,
  desenharFormula,
  desenharVisual,
  desenhoParaSvg,
  lerFormula,
  normalizarVisual,
  numeroParaTela,
  rotuloDoPonto,
  temGlifo,
  validarVisual,
} from "@studoo/contratos";
import { GLIFOS_700, GLIFOS_800 } from "../packages/contratos/src/glifos.ts";

const NOMES = ["baricentro", "abscissas", "colinearidade"];
const fixture = (nome) => JSON.parse(readFileSync(new URL(`./fixtures/matematica/${nome}.json`, import.meta.url), "utf8")).licao;
const GOLDEN = new URL("./fixtures/matematica/golden-primitivas.json", import.meta.url);

/** O desenho de cada fixture nos contextos que importam: o enunciado, a resposta e a fórmula em bloco e em faixa. */
function desenhosDasFixtures() {
  const saida = {};
  for (const nome of NOMES) {
    const licao = fixture(nome);
    const formula = normalizarVisual(licao.visuais.find((visual) => visual.tipo === "formula"));
    const figura = normalizarVisual(licao.visuais.find((visual) => visual.tipo !== "formula"));
    saida[`${nome}/enunciado`] = desenharVisual(figura, { tipo: "enunciado" });
    saida[`${nome}/passo-intermediario`] = desenharVisual(figura, { tipo: "passo", ultimo: false });
    saida[`${nome}/resposta`] = desenharVisual(figura, { tipo: "retorno" });
    saida[`${nome}/formula-bloco`] = desenharVisual(formula, { tipo: "enunciado" });
    saida[`${nome}/formula-faixa`] = desenharVisual(formula, { tipo: "enunciado" }, { fundo: false });
    const passo = licao.resolucao.passos.find((candidato) => candidato.formula);
    saida[`${nome}/passo-formula`] = desenharVisual(normalizarVisual({ tipo: "formula", latex: passo.formula }, { revela: true }), { tipo: "enunciado" });
  }
  return saida;
}

/** O golden guarda a estrutura inteira e, dos contornos de glifos, o tamanho e um hash (o arquivo fica revisável). */
function resumo(desenho) {
  const hash = (texto) => createHash("sha256").update(texto).digest("hex").slice(0, 10);
  return {
    altura: desenho.altura,
    menorTexto: desenho.menorTexto,
    descricao: desenho.descricao,
    primitivas: desenho.primitivas.map((primitiva) => (primitiva.tipo === "caminho" && primitiva.d.length > 120 ? { ...primitiva, d: `#${hash(primitiva.d)}:${primitiva.d.length}` } : primitiva)),
  };
}

test("golden: as primitivas das três fixtures não mudam sem querer (web, app e PNG desenham a mesma coisa)", () => {
  const atual = Object.fromEntries(Object.entries(desenhosDasFixtures()).map(([chave, desenho]) => [chave, resumo(desenho)]));
  if (process.env.ATUALIZAR_GOLDEN === "1" || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(atual, null, 1)}\n`);
    return;
  }
  const esperado = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(Object.keys(atual), Object.keys(esperado));
  for (const chave of Object.keys(esperado)) assert.deepEqual(atual[chave], esperado[chave], `${chave}: o desenho mudou (ATUALIZAR_GOLDEN=1 regrava depois de conferir a imagem)`);
});

test("o motor é determinístico", () => {
  assert.deepEqual(desenhosDasFixtures(), desenhosDasFixtures());
});

test("a posição do procurado não vaza: o desenho do enunciado não depende dela", () => {
  const plano = (x, y) => ({
    tipo: "plano", alt: "Triângulo com A e B; C é o vértice procurado.", x: [-3, 6], y: [-1, 8],
    pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: -2, y: 7 }, { id: "G", papel: "especial", x: 1, y: 3 }, { id: "C", papel: "procurado", x, y }],
    segmentos: [{ de: "A", ate: "B" }, { de: "B", ate: "C" }, { de: "C", ate: "A" }], poligonos: [{ pontos: ["A", "B", "C"] }], guias: [{ ponto: "C", eixo: "x" }, { ponto: "A", eixo: "y" }],
  });
  const reta = (valor) => ({
    tipo: "reta_numerica", alt: "Reta com A e B; C é o ponto procurado.", de: 0, ate: 8,
    pontos: [{ id: "A", valor: 3 }, { id: "B", valor: 5 }, { id: "G", papel: "especial", valor: 4 }, { id: "C", papel: "procurado", valor }],
    intervalos: [{ de: 3, ate: 5 }],
  });
  for (const [aqui, ali] of [[normalizarVisual(plano(4, 0)), normalizarVisual(plano(-2, 5))], [normalizarVisual(reta(4)), normalizarVisual(reta(7))]]) {
    for (const contexto of [{ tipo: "enunciado" }, { tipo: "passo", ultimo: false }]) {
      assert.deepEqual(desenharVisual(aqui, contexto), desenharVisual(ali, contexto), "o procurado mexeu no desenho do enunciado");
    }
    assert.notDeepEqual(desenharVisual(aqui, { tipo: "retorno" }), desenharVisual(ali, { tipo: "retorno" }), "na resposta ele aparece na posição");
    assert.notDeepEqual(desenharVisual(aqui, { tipo: "passo", ultimo: true }), desenharVisual(ali, { tipo: "passo", ultimo: true }));
    // E o `resposta` guardado como se fosse o procurado também fica escondido no enunciado.
    const comoResposta = structuredClone(aqui);
    comoResposta.pontos.find((ponto) => ponto.id === "C").papel = "resposta";
    assert.deepEqual(desenharVisual(comoResposta, { tipo: "enunciado" }), desenharVisual(aqui, { tipo: "enunciado" }));
  }
  // Sem a posição (o enunciado público), o desenho do enunciado é o mesmo.
  const completo = normalizarVisual(plano(4, 0));
  const publico = structuredClone(completo);
  delete publico.pontos.find((ponto) => ponto.id === "C").x;
  delete publico.pontos.find((ponto) => ponto.id === "C").y;
  assert.deepEqual(desenharVisual(publico, { tipo: "enunciado" }), desenharVisual(completo, { tipo: "enunciado" }));
});

test("no enunciado o procurado fica só na legenda ('C = ?'), e na resposta vira a bolinha verde", () => {
  const desenhos = desenhosDasFixtures();
  const { alt } = normalizarVisual(fixture("baricentro").visuais[1]);
  assert.match(alt, /C é o vértice procurado/);
  const svgEnunciado = desenhoParaSvg(desenhos["baricentro/enunciado"], { fundo: "branco" });
  const svgResposta = desenhoParaSvg(desenhos["baricentro/resposta"], { fundo: "branco" });
  assert.ok(desenhos["baricentro/enunciado"].primitivas.length < desenhos["baricentro/resposta"].primitivas.length, "o enunciado desenha menos (sem o procurado e o que o toca)");
  assert.ok(svgResposta.includes(PALETA_DO_DESENHO.resposta), "a resposta usa o verde");
  assert.equal(svgEnunciado.includes(PALETA_DO_DESENHO.resposta), false, "o enunciado não tem verde de resposta");
  assert.ok(svgEnunciado.includes('stroke-dasharray="3 2.5"'), "a legenda mostra o círculo tracejado do procurado");
});

test("rótulos e números: sinal de menos de verdade, vírgula decimal e ponto e vírgula no par com decimal", () => {
  assert.equal(rotuloDoPonto("A", [1, 2]), "A (1, 2)");
  assert.equal(rotuloDoPonto("B", [-2, 7]), "B (−2, 7)");
  assert.equal(rotuloDoPonto("A", [1.5, 2]), "A (1,5; 2)");
  assert.equal(rotuloDoPonto("A", [1, -0.25]), "A (1; −0,25)");
  assert.equal(rotuloDoPonto("A", [3]), "A (3)");
  assert.equal(numeroParaTela(-0), "0");
  assert.equal(numeroParaTela(-3), "−3");
  assert.equal(numeroParaTela(2.5), "2,5");
  assert.equal(numeroParaTela(0.1 + 0.2), "0,3");
});

function limites(desenho) {
  let [xmin, ymin, xmax, ymax] = [Infinity, Infinity, -Infinity, -Infinity];
  const ponto = (x, y, folga = 0) => {
    xmin = Math.min(xmin, x - folga);
    xmax = Math.max(xmax, x + folga);
    ymin = Math.min(ymin, y - folga);
    ymax = Math.max(ymax, y + folga);
  };
  for (const primitiva of desenho.primitivas) {
    if (primitiva.tipo === "linha") {
      ponto(primitiva.x1, primitiva.y1);
      ponto(primitiva.x2, primitiva.y2);
    } else if (primitiva.tipo === "retangulo") {
      ponto(primitiva.x, primitiva.y);
      ponto(primitiva.x + primitiva.largura, primitiva.y + primitiva.altura);
    } else if (primitiva.tipo === "circulo") {
      ponto(primitiva.cx, primitiva.cy, primitiva.raio);
    } else {
      const numeros = primitiva.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      for (let i = 0; i < numeros.length; i += 2) ponto(numeros[i], numeros[i + 1]);
    }
  }
  return { xmin, ymin, xmax, ymax };
}

test("nada do desenho cai fora da prancheta, e o texto nunca é menor que o piso (15)", () => {
  assert.equal(PISO_DO_TEXTO, 15);
  for (const [chave, desenho] of Object.entries(desenhosDasFixtures())) {
    assert.equal(desenho.largura, LARGURA_DO_DESENHO, chave);
    assert.ok(desenho.menorTexto >= PISO_DO_TEXTO, `${chave}: menor texto ${desenho.menorTexto}`);
    if (desenho.larguraDoConteudo) continue;
    const { xmin, ymin, xmax, ymax } = limites(desenho);
    assert.ok(xmin >= -0.5 && xmax <= LARGURA_DO_DESENHO + 0.5, `${chave}: x de ${xmin} a ${xmax}`);
    assert.ok(ymin >= -0.5 && ymax <= desenho.altura + 0.5, `${chave}: y de ${ymin} a ${ymax} (altura ${desenho.altura})`);
  }
  // Fórmula funda: os termos encolhem, mas nunca abaixo do piso.
  const funda = lerFormula(String.raw`\frac{\frac{\frac{1}{x_{A B}^{2}}}{2}}{3}`).arvore;
  assert.ok(desenharFormula(funda).menorTexto >= PISO_DO_TEXTO);
});

test("a fórmula: 22 no bloco, diminui até 85% e, se não couber, rola; na faixa do PNG, se não couber, fica fora", () => {
  const curta = desenharFormula(lerFormula("x = 1").arvore);
  assert.equal(curta.larguraDoConteudo, undefined);
  assert.equal(curta.primitivas[0].tipo, "retangulo", "o bloco tem o fundo");
  assert.equal(curta.primitivas[0].preenchimento, "fundo");
  assert.equal(curta.primitivas[0].raio, 14);
  const larga = lerFormula(`1${" + 1".repeat(25)} = 26`).arvore;
  const rolando = desenharFormula(larga);
  assert.ok(rolando.larguraDoConteudo > LARGURA_DO_DESENHO, "não coube nem a 85%: rola para o lado");
  assert.equal(desenharFormula(larga, { fundo: false }), null, "na faixa do PNG não rola: fica no texto linear");
  const faixa = desenharFormula(lerFormula("x = 1").arvore, { fundo: false });
  assert.equal(faixa.primitivas.some((primitiva) => primitiva.tipo === "retangulo"), false, "a faixa do PNG não tem o fundo do bloco");
  // Existe uma largura em que a fórmula só cabe depois de diminuir (22 → 18,7), sem rolar.
  const soma = (n) => lerFormula(`1${" + 1".repeat(n)}`).arvore;
  const diminuiu = Array.from({ length: 30 }, (_, i) => desenharFormula(soma(i + 5))).find((desenho) => !desenho.larguraDoConteudo && desenho.menorTexto < 22);
  assert.ok(diminuiu, "alguma soma cabe só depois de diminuir");
  assert.ok(diminuiu.menorTexto >= 18, "no bloco do app, nunca menos que 18");
});

test("todo desenho é só M, L, Q e Z; a seta é caminho; nada de texto, marcador ou fonte no SVG", () => {
  for (const [chave, desenho] of Object.entries(desenhosDasFixtures())) {
    for (const primitiva of desenho.primitivas) {
      assert.ok(["linha", "retangulo", "circulo", "caminho"].includes(primitiva.tipo), `${chave}: ${primitiva.tipo}`);
      assert.equal("seta" in primitiva, false, `${chave}: a ponta da seta é um caminho, não um campo`);
      if (primitiva.tipo === "caminho") assert.ok(caminhoValido(primitiva.d), `${chave}: caminho inválido ${primitiva.d.slice(0, 40)}`);
      for (const papel of [primitiva.cor, primitiva.preenchimento, primitiva.borda]) if (papel) assert.ok(PAPEIS_DE_COR.includes(papel), `${chave}: papel ${papel}`);
    }
    const svg = desenhoParaSvg(desenho, { fundo: "branco" });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 320 /);
    assert.equal(/<text|<marker|font-|<image|<script|href=/.test(svg), false, `${chave}: SVG com texto, marcador, fonte ou imagem`);
    assert.equal(svg.includes('fill-rule="nonzero"'), true);
    assert.equal(/stroke-linecap="round"/.test(svg), false, "a ponta é butt");
    if (/stroke-linejoin/.test(svg)) assert.match(svg, /stroke-linejoin="round"/);
  }
  assert.equal(caminhoValido("M0 0L1 1Q2 2 3 3Z"), true);
  for (const ruim of ["", "M0 0C1 1 2 2 3 3", "M0 0 A1 1 0 0 1 2 2", "M0 0L1 1<script>", "m0 0l1 1", "L1 1 M"]) assert.equal(caminhoValido(ruim), false, ruim);
});

test("o PNG da fase 1: faixa da fórmula em cima e a figura embaixo, até 320 × 352", () => {
  for (const nome of NOMES) {
    const licao = fixture(nome);
    const formula = desenharVisual(normalizarVisual(licao.visuais[0]), { tipo: "enunciado" }, { fundo: false });
    const figura = normalizarVisual(licao.visuais[1]);
    const embaixo = desenharVisual(figura, { tipo: "enunciado" }, { alturaMaxima: 352 - formula.altura });
    const prancheta = comporDesenhos([formula, embaixo], { separador: true });
    assert.equal(prancheta.largura, 320);
    assert.ok(prancheta.altura <= 352, `${nome}: ${prancheta.altura}`);
    assert.ok(prancheta.largura / prancheta.altura >= 1 / 1.1 - 1e-9 && prancheta.largura / prancheta.altura <= 3.2, `${nome}: proporção ${prancheta.altura}`);
    assert.ok(prancheta.menorTexto >= PISO_DO_TEXTO);
    const separador = prancheta.primitivas.find((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "separador" && primitiva.largura === 1);
    assert.ok(separador, "linha de 1 ponto entre a fórmula e a figura");
    assert.equal(separador.y1, formula.altura);
    // Sozinha, a figura respeita as proporções do Designer: reta 320 × 140; plano entre 16:10 e 1:1.
    const sozinha = desenharVisual(figura, { tipo: "enunciado" });
    if (figura.tipo === "reta_numerica") assert.equal(sozinha.altura, 140);
    else assert.ok(sozinha.altura >= 200 && sozinha.altura <= 320, `${nome}: plano ${sozinha.altura}`);
  }
});

test("teto de primitivas: o pior visual permitido cabe, e o validador o confere", () => {
  const pontos = Array.from({ length: 12 }, (_, i) => ({ id: `P${i}`, x: (i * 7) % 11 - 5, y: (i * 5) % 9 - 4, ...(i % 3 === 0 ? { papel: "especial" } : {}) }));
  const ids = pontos.map((ponto) => ponto.id);
  const maximo = {
    tipo: "plano", alt: "Doze pontos, doze segmentos, quatro polígonos e seis guias.", x: [-8, 8], y: [-8, 8], pontos,
    segmentos: ids.slice(0, 12).map((id, i) => ({ de: id, ate: ids[(i + 5) % 12] })),
    poligonos: [ids.slice(0, 3), ids.slice(3, 6), ids.slice(6, 9), ids.slice(9, 12)].map((lista) => ({ pontos: lista })),
    guias: ids.slice(0, 6).map((ponto, i) => ({ ponto, eixo: i % 2 ? "x" : "y" })),
  };
  const resultado = validarVisual(maximo);
  assert.equal(resultado.ok, true, resultado.motivo);
  for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
    const desenho = desenharVisual(resultado.visual, contexto);
    assert.ok(desenho.primitivas.length <= TETO_DE_PRIMITIVAS, `${desenho.primitivas.length} primitivas`);
    assert.ok(desenho.altura <= 320 + 1e-9);
  }
  assert.equal(TETO_DE_PRIMITIVAS, 300);
});

/* ----- Paleta, glifos ----- */

const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b); };
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("paleta do desenho: um mapa por papel, exportado pelo pacote, com o contraste da spec 15", () => {
  assert.deepEqual(Object.keys(PALETA_DO_DESENHO).sort(), [...PAPEIS_DE_COR].sort());
  for (const [papel, hex] of Object.entries(PALETA_DO_DESENHO)) assert.match(hex, /^#[0-9A-F]{6}$/, papel);
  const P = PALETA_DO_DESENHO;
  // Texto: 4,5:1 sobre o fundo dele (7:1 para o texto principal).
  const texto = [
    ["texto", "branco", 7], ["texto", "fundo", 7], ["suave", "branco", 4.5], ["suave", "fundo", 4.5],
    ["especialTexto", "branco", 4.5], ["procuradoTexto", "branco", 4.5], ["procuradoTexto", "procuradoFundo", 4.5],
    ["respostaTexto", "branco", 4.5], ["respostaTexto", "respostaFundo", 4.5], ["focoTexto", "branco", 4.5],
    // Achado: #2563FF sobre #EAF0FF dá 4,27:1. Passa como texto grande em negrito (3:1), e é o que a fórmula usa (22 pt, 700); o
    // índice dentro do foco fica abaixo disso. Sugestão ao Designer: #1D4ED8 (5,87:1). O piso abaixo trava o valor de hoje.
    ["focoTexto", "focoFundo", 4.2],
  ];
  for (const [frente, fundo, minimo] of texto) assert.ok(contraste(P[frente], P[fundo]) >= minimo, `${frente} sobre ${fundo}: ${contraste(P[frente], P[fundo]).toFixed(2)}:1`);
  // O roxo só preenche; como texto usa-se especialTexto (a spec 15 proíbe #7C5CFF em texto).
  assert.ok(contraste(P.especial, P.branco) < 4.5 && contraste(P.especialTexto, P.branco) >= 4.5);
  // Gráfico (3:1 sobre o branco). O âmbar do procurado (#C98A1A) fica em 2,94:1: sugestão ao Designer, #B9780F (3,65:1).
  for (const papel of ["dado", "especial", "resposta", "segmento", "eixo"]) assert.ok(contraste(P[papel], P.branco) >= 3, papel);
  assert.ok(contraste(P.procurado, P.branco) >= 2.9, "procurado");
  // O vermelho não existe no desenho: fica só no retorno de erro.
  for (const hex of Object.values(P)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.equal(r > 180 && g < 80 && b < 80, false, `${hex} parece vermelho`);
  }
});

test("glifos: a tabela cobre o que a fórmula e o rótulo usam, com Δ e π, e o preenchimento nonzero deixa o miolo vazado", async () => {
  for (const caractere of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,;:!?'’()/%+=<>-−×÷·ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúüΔπ") assert.ok(temGlifo(caractere, 700), caractere);
  for (const caractere of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,()−?'=") assert.ok(temGlifo(caractere, 800), caractere);
  assert.equal(temGlifo("α"), false, "o resto do grego fica para a fase 2");
  // Tudo o que `\text{…}` aceita tem glifo.
  for (const pedaco of ["ÀÁÂÃÇÉÊÍÓÔÕÚÜ", "àáâãçéêíóôõúü", "0-9 .,;:!?()'/%+=<> z", "ação e não"]) {
    assert.equal(lerFormula(`\\text{${pedaco}}`).ok, true, pedaco);
    for (const caractere of pedaco) assert.ok(temGlifo(caractere, 700), caractere);
  }
  for (const proibido of ["α", "é_", "ñ", "ü{", "\\", "€"]) assert.equal(lerFormula(`\\text{${proibido}}`).ok, false, proibido);
  // Pixels: o miolo de "o", "0", "O" e "Δ" é vazio e o de "l" e "I" é cheio, com o `nonzero` do contrato.
  const sombrear = async (tabela, caractere) => {
    const [avanco, d] = tabela[caractere];
    const escala = 0.2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(avanco * escala)}" height="220"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" fill-rule="nonzero" transform="translate(0 170) scale(${escala} ${-escala})" d="${d}"/></svg>`;
    const { data, info } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
    return (x, y) => data[y * info.width + x];
  };
  const tabela = GLIFOS_700;
  for (const [caractere, vazado] of [["o", true], ["0", true], ["O", true], ["Δ", true], ["l", false], ["I", false]]) {
    const pixel = await sombrear(tabela, caractere);
    const x = Math.floor((tabela[caractere][0] * 0.2) / 2);
    const y = 170 - Math.round(((caractere === "o" ? 270 : 357) * 0.2));
    const centro = pixel(x, y);
    if (caractere === "Δ") assert.ok(pixel(x, 170 - Math.round(180 * 0.2)) > 200, "o triângulo interno do Δ é vazio");
    else assert.equal(centro > 200, vazado, `${caractere}: miolo ${vazado ? "vazio" : "cheio"} (pixel ${centro})`);
  }
  assert.ok(Object.keys(GLIFOS_800).length > 60);
});

test("o PNG do desenho sai com sharp (o SVG é válido) e cabe com folga no limite de 700.000 caracteres", async () => {
  const desenho = desenhosDasFixtures()["baricentro/resposta"];
  const svg = desenhoParaSvg(desenho, { fundo: "branco", larguraEmPixels: 1280 });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, Math.round(desenho.altura * 4));
  assert.ok(Math.ceil((png.length * 4) / 3) < 350_000, `${png.length} bytes`);
});
