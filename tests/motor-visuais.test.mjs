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
import { caixaDaFormula } from "../packages/contratos/src/motor-formula.ts";

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

test("nada do desenho cai fora da prancheta, e o texto nunca é menor que o piso (13)", () => {
  assert.equal(PISO_DO_TEXTO, 13);
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

test("paleta do desenho: um mapa por papel, exportado pelo pacote, com as cores finais do Designer e o contraste da spec 15, sem exceção", () => {
  assert.deepEqual(Object.keys(PALETA_DO_DESENHO).sort(), [...PAPEIS_DE_COR].sort());
  for (const [papel, hex] of Object.entries(PALETA_DO_DESENHO)) assert.match(hex, /^#[0-9A-F]{6}$/, papel);
  const P = PALETA_DO_DESENHO;
  // As cores finais (spec 15, seção 8).
  assert.equal(P.focoTexto, "#1D4ED8");
  assert.equal(P.foco, "#2563FF");
  assert.equal(P.focoFundo, "#EAF0FF");
  assert.equal(P.procurado, "#B9780F");
  assert.equal(P.procuradoTexto, "#9A5B00");
  assert.equal(P.procuradoFundo, "#FFF6EA");
  assert.equal(P.especial, "#7C5CFF");
  assert.equal(P.especialTexto, "#5B3FD9");
  assert.equal(P.resposta, "#1F7A5A");
  assert.equal(P.respostaFundo, "#E8F6EF");
  assert.equal(P.texto, "#0B1B5C");
  assert.equal(P.suave, "#5E6A85");
  assert.equal(P.grade, "#E1E7FA");
  // Texto: 4,5:1 sobre o fundo dele (7:1 para o texto principal).
  const texto = [
    ["texto", "branco", 7], ["texto", "fundo", 7], ["suave", "branco", 4.5], ["suave", "fundo", 4.5],
    ["especialTexto", "branco", 4.5], ["procuradoTexto", "branco", 4.5], ["procuradoTexto", "procuradoFundo", 4.5],
    ["respostaTexto", "branco", 4.5], ["respostaTexto", "respostaFundo", 4.5], ["focoTexto", "branco", 4.5], ["focoTexto", "focoFundo", 4.5],
  ];
  for (const [frente, fundo, minimo] of texto) assert.ok(contraste(P[frente], P[fundo]) >= minimo, `${frente} sobre ${fundo}: ${contraste(P[frente], P[fundo]).toFixed(2)}:1`);
  // O roxo só preenche; como texto usa-se especialTexto.
  assert.ok(contraste(P.especial, P.branco) < 4.5 && contraste(P.especialTexto, P.branco) >= 4.5);
  // Gráfico: 3:1 sobre o branco.
  for (const papel of ["dado", "especial", "procurado", "resposta", "segmento", "foco", "eixo", "subtrai", "soma"]) assert.ok(contraste(P[papel], P.branco) >= 3, `${papel}: ${contraste(P[papel], P.branco).toFixed(2)}:1`);
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
  // Δ e π da Noto Sans Bold a 92%, para parecerem da família da Nunito (a Bold da Noto é mais pesada e mais larga).
  assert.deepEqual([GLIFOS_700["Δ"][0], GLIFOS_700["π"][0]], [605, 680]);
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

/* ----- Parecer do Designer (spec 15, seção 8) ----- */

const numerosDeEixo = (desenho) => desenho.textos.filter((texto) => /^−?\d+$/.test(texto));

/** Um ponto cercado por oito vizinhos, na origem: não cabe rótulo inteiro nem nome sem encostar em número de eixo. */
const CERCADO = {
  tipo: "plano", alt: "Um ponto cercado por oito vizinhos.", x: [-6, 6], y: [-6, 6],
  pontos: [{ id: "A", x: 0, y: 0 }, ...[[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y], i) => ({ id: `V${i}`, x, y, rotulo: false }))],
};
/** Um ponto colado na origem, com os eixos e os números em volta. */
const NA_ORIGEM = {
  tipo: "plano", alt: "Os pontos O, P e Q perto da origem.", x: [-4, 5], y: [-3, 5],
  pontos: [{ id: "O", x: 0, y: 0 }, { id: "P", x: 1, y: 1 }, { id: "Q", x: -1, y: 2, papel: "especial" }],
  segmentos: [{ de: "O", ate: "P" }, { de: "P", ate: "Q" }],
};
/** Bate? `folga` aumenta a distância exigida; `tolerancia` perdoa o espaço lateral que o glifo deixa dentro da caixa. */
const bate = (a, b, folga = 0, tolerancia = 0) =>
  a.x - folga < b.x + b.largura - tolerancia && b.x < a.x + a.largura + folga - tolerancia &&
  a.y - folga < b.y + b.altura - tolerancia && b.y < a.y + a.altura + folga - tolerancia;

test("número de eixo nunca some: nenhum rótulo de ponto o apaga, e o rótulo procura outro lado", () => {
  for (const nome of NOMES) {
    const figura = normalizarVisual(fixture(nome).visuais.find((visual) => visual.tipo === "plano" || visual.tipo === "reta_numerica"));
    if (figura.tipo !== "plano") continue;
    const semRotulos = structuredClone(figura);
    semRotulos.pontos.forEach((ponto) => { ponto.rotulo = false; });
    for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
      const com = numerosDeEixo(desenharVisual(figura, contexto));
      const sem = numerosDeEixo(desenharVisual(semRotulos, contexto));
      assert.deepEqual(com, sem, `${nome}/${contexto.tipo}: os números do eixo são os mesmos com e sem rótulos`);
    }
  }
  // O que o Designer viu faltar: o 4 e o 8 do eixo y do baricentro e os pares do eixo x da colinearidade.
  const baricentro = numerosDeEixo(desenharVisual(normalizarVisual(fixture("baricentro").visuais[1]), { tipo: "enunciado" }));
  for (const esperado of ["1", "2", "3", "4", "5", "6", "7", "8", "0"]) assert.ok(baricentro.includes(esperado), `baricentro: falta o ${esperado}`);
  const colinearidade = numerosDeEixo(desenharVisual(normalizarVisual(fixture("colinearidade").visuais[1]), { tipo: "enunciado" }));
  for (const esperado of ["−4", "−2", "0", "2", "4", "6"]) assert.ok(colinearidade.includes(esperado), `colinearidade: falta o ${esperado}`);
  // Com os rótulos inteiros (com as coordenadas) onde cabem.
  const textos = desenharVisual(normalizarVisual(fixture("colinearidade").visuais[1]), { tipo: "enunciado" }).textos;
  assert.ok(textos.includes("A (−1, −1)") && textos.includes("B (2, 5)"));
  // Sem lado livre para o rótulo inteiro, o ponto fica só com o nome (ou sem nada, se nem o nome cabe) e as coordenadas vão para a
  // legenda, em linha própria; os números continuam todos lá.
  const desenho = desenharVisual(normalizarVisual(CERCADO), { tipo: "enunciado" });
  assert.equal(desenho.textos.lastIndexOf("A (0, 0)") > desenho.textos.findIndex((texto) => texto === "dados"), true, "as coordenadas perdidas vão para a legenda");
  assert.equal(desenho.caixas.some((caixa) => caixa.tipo === "rotulo" && caixa.texto === "A (0, 0)"), false, "e não ficam no plano");
  assert.ok(numerosDeEixo(desenho).length >= 10);
});

test("a grade é de 1 em 1 até 20 unidades no eixo (os números, de 2 em 2 acima de 12); A (1, 2) cai no cruzamento", () => {
  const plano = (x, y) => normalizarVisual({ tipo: "plano", alt: "Um ponto no plano.", x, y, pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: -2, y: 3 }] });
  const linhasDaGrade = (desenho) => desenho.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "grade");
  for (const quadro of [[[-3, 6], [-1, 8]], [[-8, 9], [-4, 8]], [[-10, 10], [-10, 10]]]) {
    const desenho = desenharVisual(plano(...quadro), { tipo: "enunciado" });
    const circulos = desenho.primitivas.filter((primitiva) => primitiva.tipo === "circulo" && primitiva.preenchimento === "dado");
    const grade = linhasDaGrade(desenho);
    for (const ponto of circulos) {
      assert.ok(grade.some((linha) => linha.x1 === linha.x2 && Math.abs(linha.x1 - ponto.cx) < 0.02), "uma linha vertical por onde passa o ponto");
      assert.ok(grade.some((linha) => linha.y1 === linha.y2 && Math.abs(linha.y1 - ponto.cy) < 0.02), "uma linha horizontal por onde passa o ponto");
    }
  }
  // Acima de 12 unidades, só os números passam a ir de 2 em 2.
  const largo = numerosDeEixo(desenharVisual(plano([-8, 9], [-4, 8]), { tipo: "enunciado" }));
  assert.ok(largo.includes("−4") && largo.includes("−2") && !largo.includes("−3") && !largo.includes("−5"), `de 2 em 2: ${largo.join(" ")}`);
  const curto = numerosDeEixo(desenharVisual(plano([-3, 6], [-1, 8]), { tipo: "enunciado" }));
  assert.ok(curto.includes("−3") && curto.includes("5"), `de 1 em 1: ${curto.join(" ")}`);
  // Acima de 20 unidades a grade deixa de ser de 1 em 1 (senão são linhas demais).
  const enorme = linhasDaGrade(desenharVisual(plano([-30, 30], [-10, 10]), { tipo: "enunciado" })).filter((linha) => linha.y1 === linha.y2);
  assert.ok(enorme.length <= 14, `${enorme.length} linhas horizontais`);
});

test("respiro das fórmulas: relações com 5, + − × ÷ com 4, 6 ao lado de colchete e barra, metade no expoente e no índice", () => {
  const largura = (fonte, tamanho = 22) => caixaDaFormula(lerFormula(fonte).arvore, tamanho).l;
  const soltos = (a, op, b) => largura(a) + largura(op) + largura(b);
  for (const [operador, esperado] of [["=", 10], [String.raw`\neq`, 10], [String.raw`\leq`, 10], [String.raw`\geq`, 10], ["<", 10], [">", 10], [String.raw`\to`, 10], ["+", 8], ["-", 8], [String.raw`\times`, 8], [String.raw`\div`, 8]]) {
    const juntos = largura(`a ${operador} b`);
    assert.ok(Math.abs(juntos - soltos("a", operador, "b") - esperado) < 0.01, `${operador}: ${juntos - soltos("a", operador, "b")} em vez de ${esperado}`);
  }
  // O sinal de menos que abre o número é sinal, não operador: sem respiro.
  assert.ok(Math.abs(largura("-2") - largura("-") - largura("2")) < 0.01);
  // 6 depois de colchete ou de barra, antes do sinal ("|…| = 0", "] × [").
  const determinante = String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix}`;
  assert.ok(Math.abs(largura(`${determinante} = 0`) - largura(determinante) - largura("=") - largura("0") - (6 + 5)) < 0.01);
  const matriz = String.raw`\begin{bmatrix} 1 & 2 \end{bmatrix}`;
  assert.ok(Math.abs(largura(`${matriz} \\times ${matriz}`) - 2 * largura(matriz) - largura("\\times") - 12) < 0.01);
  // Dentro do expoente e do índice, metade: "n+1" e não "n + 1" (2 de cada lado do sinal, em vez de 4).
  const tamanhoDoExpoente = 22 * 0.65;
  const doExpoente = largura("x^{n + 1}") - largura("x") - 1;
  const esperadoDoExpoente = largura("n", tamanhoDoExpoente) + largura("+", tamanhoDoExpoente) + largura("1", tamanhoDoExpoente) + 2 * 2;
  assert.ok(Math.abs(doExpoente - esperadoDoExpoente) < 0.01, `${doExpoente} em vez de ${esperadoDoExpoente}`);
  const doIndice = largura("x_{n + 1}") - largura("x") - 1;
  assert.ok(Math.abs(doIndice - esperadoDoExpoente) < 0.01);
});

test("a seta do eixo começa uma folga depois da última marca, e o 8 da reta não fica sob a ponta", () => {
  const reta = normalizarVisual(fixture("abscissas").visuais[1]);
  const desenho = desenharVisual(reta, { tipo: "enunciado" });
  const marcas = desenho.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "eixo" && primitiva.largura === 2 && primitiva.x1 === primitiva.x2);
  const ultimaMarca = Math.max(...marcas.map((marca) => marca.x1));
  const seta = desenho.primitivas.find((primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento === "eixo");
  const xs = seta.d.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
  assert.ok(Math.min(...xs) >= ultimaMarca + 14, `a seta começa em ${Math.min(...xs)}, a última marca está em ${ultimaMarca}`);
  assert.ok(Math.max(...xs) <= 320);
  // No plano, o mesmo nos dois eixos.
  const plano = desenharVisual(normalizarVisual(fixture("baricentro").visuais[1]), { tipo: "enunciado" });
  const setas = plano.primitivas.filter((primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento === "eixo");
  assert.equal(setas.length, 2);
  const grade = plano.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "grade");
  const direitaDaGrade = Math.max(...grade.map((linha) => Math.max(linha.x1, linha.x2)));
  const topoDaGrade = Math.min(...grade.map((linha) => Math.min(linha.y1, linha.y2)));
  const pontosDasSetas = setas.map((seta) => seta.d.match(/-?\d+(?:\.\d+)?/g).map(Number));
  assert.ok(Math.min(...pontosDasSetas[0].filter((_, i) => i % 2 === 0)) >= direitaDaGrade + 14);
  assert.ok(Math.max(...pontosDasSetas[1].filter((_, i) => i % 2 === 1)) <= topoDaGrade - 14);
});

test("os tamanhos do parecer: rótulos de ponto 14 em 800, legenda 14, números dos eixos 13, tudo a partir do piso", () => {
  const baricentro = desenhosDasFixtures()["baricentro/resposta"];
  assert.equal(baricentro.menorTexto, 13, "os números dos eixos são o menor texto");
  assert.ok(baricentro.textos.includes("dados") && baricentro.textos.includes("A (1, 2)"));
  // O motor devolve os textos na ordem em que saem; nenhum é vazio.
  for (const desenho of Object.values(desenhosDasFixtures())) assert.ok(desenho.textos.every((texto) => texto.length > 0));
});

/* ----- Marco 2c: halo, nome longe dos números, coordenadas na legenda ----- */

const TODOS = () => [
  ...Object.values(desenhosDasFixtures()),
  ...[CERCADO, NA_ORIGEM].flatMap((bruto) => [{ tipo: "enunciado" }, { tipo: "retorno" }].map((contexto) => desenharVisual(normalizarVisual(bruto), contexto))),
];

test("nenhum texto do gráfico bate em outro, e rótulo só com o nome nunca encosta em número de eixo", () => {
  for (const desenho of TODOS()) {
    const caixas = desenho.caixas.filter((caixa) => caixa.tipo !== "foco");
    for (let i = 0; i < caixas.length; i += 1) {
      for (let j = i + 1; j < caixas.length; j += 1) {
        assert.equal(bate(caixas[i], caixas[j], 0, 1.5), false, `${caixas[i].texto} bate em ${caixas[j].texto}`);
      }
    }
    for (const nome of caixas.filter((caixa) => caixa.tipo === "rotulo" && !caixa.texto.includes("("))) {
      for (const numero of caixas.filter((caixa) => caixa.tipo === "numero")) {
        assert.equal(bate(nome, numero, 8), false, `o nome ${nome.texto} fica a menos de uma unidade de glifo do número ${numero.texto}`);
      }
    }
  }
});

test("as coordenadas que o rótulo perdeu vão para a legenda, em linha própria, no enunciado e na resposta", () => {
  for (const [bruto, esperado] of [[CERCADO, "A (0, 0)"], [NA_ORIGEM, "O (0, 0)"]]) {
    for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
      const desenho = desenharVisual(normalizarVisual(bruto), contexto);
      const completos = desenho.caixas.filter((caixa) => caixa.tipo === "rotulo" && caixa.texto.includes("("));
      const visual = normalizarVisual(bruto);
      for (const ponto of visual.pontos.filter((p) => p.rotulo !== false)) {
        const inteiro = `${ponto.id} (${ponto.x}, ${ponto.y})`.replace("-", "−").replace("-", "−");
        const noPlano = completos.some((caixa) => caixa.texto === inteiro);
        const naLegenda = desenho.textos.slice(desenho.textos.indexOf("dados") > 0 ? 0 : 0).filter((texto) => texto === inteiro).length;
        assert.ok(noPlano || naLegenda > 0, `${inteiro} sumiu (${contexto.tipo})`);
        assert.ok(!(noPlano && naLegenda > 1), `${inteiro} duplicado`);
      }
    }
  }
  const cercado = desenharVisual(normalizarVisual(CERCADO), { tipo: "enunciado" });
  assert.ok(cercado.textos.includes("A (0, 0)"));
  assert.equal(cercado.caixas.filter((caixa) => caixa.tipo === "rotulo").length <= 1, true);
  // A legenda cresce para as coordenadas e a figura continua cabendo na prancheta.
  assert.ok(cercado.altura <= 320 + 1e-9);
  const { xmin, xmax, ymin, ymax } = limites(cercado);
  assert.ok(xmin >= -0.5 && xmax <= 320.5 && ymin >= -0.5 && ymax <= cercado.altura + 0.5);
});

test("halo branco em todo texto do gráfico: por baixo dos textos, por cima da grade e dos traços", () => {
  const ehHalo = (primitiva) => primitiva.tipo === "caminho" && !primitiva.preenchimento && primitiva.borda === "branco" && primitiva.larguraDaBorda === 6;
  const ehTexto = (primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento && !primitiva.borda && /Texto$|^suave$|^texto$/.test(primitiva.preenchimento);
  for (const nome of ["baricentro", "colinearidade"]) {
    for (const contexto of ["enunciado", "resposta"]) {
      const desenho = desenhosDasFixtures()[`${nome}/${contexto}`];
      const ps = desenho.primitivas;
      const halos = ps.map((primitiva, i) => (ehHalo(primitiva) ? i : -1)).filter((i) => i >= 0);
      assert.equal(halos.length, 1, `${nome}/${contexto}: um halo só, por baixo de todos os textos do gráfico`);
      const ultimoTraco = Math.max(...ps.map((primitiva, i) => ((primitiva.tipo === "linha" && primitiva.cor === "segmento") ? i : -1)));
      const ultimaGrade = Math.max(...ps.map((primitiva, i) => ((primitiva.tipo === "linha" && primitiva.cor === "grade") ? i : -1)));
      assert.ok(halos[0] > ultimoTraco && halos[0] > ultimaGrade, "o halo vem depois da grade e dos segmentos");
      // O halo cobre exatamente o contorno dos textos que vêm logo depois.
      let juntos = "";
      for (let i = halos[0] + 1; i < ps.length && ehTexto(ps[i]); i += 1) juntos += ps[i].d;
      assert.equal(ps[halos[0]].d, juntos, "o halo é o contorno dos textos seguintes");
      assert.ok(juntos.length > 200);
      // Os pontos vêm depois dos textos, e a legenda (fora do gráfico) não leva halo.
      const primeiroPonto = ps.findIndex((primitiva, i) => i > halos[0] && (primitiva.tipo === "circulo" || (primitiva.tipo === "caminho" && primitiva.borda === "branco" && primitiva.larguraDaBorda === 2)));
      assert.ok(primeiroPonto > halos[0]);
      assert.equal(ps.slice(primeiroPonto).some(ehHalo), false);
    }
  }
  // A reta numérica também: números e nomes com halo; a frase da legenda sem.
  const reta = desenhosDasFixtures()["abscissas/enunciado"];
  assert.equal(reta.primitivas.filter(ehHalo).length, 1);
  // E a fórmula não: ela está sobre fundo liso.
  assert.equal(desenhosDasFixtures()["baricentro/formula-bloco"].primitivas.some(ehHalo), false);
  assert.equal(desenhosDasFixtures()["colinearidade/formula-faixa"].primitivas.some(ehHalo), false);
});

/** Os pontos do gráfico, na ordem em que o motor os desenha: centro e raio (o losango do ponto especial tem a meia-diagonal como raio). */
function pontosDesenhados(desenho) {
  const saida = [];
  for (const primitiva of desenho.primitivas) {
    if (primitiva.borda !== "branco" || primitiva.larguraDaBorda !== 2) continue;
    if (primitiva.tipo === "circulo") saida.push({ x: primitiva.cx, y: primitiva.cy, raio: primitiva.raio });
    else if (primitiva.tipo === "caminho" && primitiva.preenchimento === "especial") {
      const [x1, y1, , , x3, y3] = primitiva.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      saida.push({ x: (x1 + x3) / 2, y: (y1 + y3) / 2, raio: Math.abs(y3 - y1) / 2 });
    }
  }
  return saida;
}

/** A distância da caixa de um texto à BORDA do ponto (negativa se a caixa entra no ponto). */
const distanciaDaBorda = (caixa, ponto) =>
  Math.hypot(Math.max(caixa.x - ponto.x, 0, ponto.x - (caixa.x + caixa.largura)), Math.max(caixa.y - ponto.y, 0, ponto.y - (caixa.y + caixa.altura))) - ponto.raio;

/** Os segmentos do desenho (as linhas grossas da cor do segmento), como pares de pontos. */
const segmentosDoDesenho = (desenho) => desenho.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "segmento");
/** Algum ponto do segmento cai dentro da caixa (com `margem` de folga)? */
function segmentoPassaPelaCaixa(segmento, caixa, margem = 0) {
  const passos = Math.max(2, Math.ceil(Math.hypot(segmento.x2 - segmento.x1, segmento.y2 - segmento.y1)));
  for (let i = 0; i <= passos; i += 1) {
    const x = segmento.x1 + ((segmento.x2 - segmento.x1) * i) / passos;
    const y = segmento.y1 + ((segmento.y2 - segmento.y1) * i) / passos;
    if (x >= caixa.x - margem && x <= caixa.x + caixa.largura + margem && y >= caixa.y - margem && y <= caixa.y + caixa.altura + margem) return true;
  }
  return false;
}

/** Um ponto na origem com os outros longe: o rótulo inteiro "O (0, 0)" cabe no primeiro quadrante. */
const ORIGEM_LIVRE = {
  tipo: "plano", alt: "O ponto O na origem e dois pontos longe dele.", x: [-5, 6], y: [-4, 6],
  pontos: [{ id: "O", x: 0, y: 0 }, { id: "P", x: 4, y: 4 }, { id: "Q", x: -4, y: 3, papel: "especial" }],
  segmentos: [{ de: "P", ate: "Q" }],
};

/** Os símbolos da legenda (sem a borda branca dos pontos do gráfico): bolinha cheia, losango e bolinha tracejada. */
function simbolosDaLegenda(desenho) {
  const sem = (primitiva) => !primitiva.borda || primitiva.borda === "procurado";
  return {
    dado: desenho.primitivas.filter((p) => p.tipo === "circulo" && p.preenchimento === "dado" && sem(p)).length,
    especial: desenho.primitivas.filter((p) => p.tipo === "caminho" && p.preenchimento === "especial" && sem(p)).length,
    procurado: desenho.primitivas.filter((p) => p.tipo === "circulo" && p.borda === "procurado").length,
  };
}

test("o ponto na origem: 'O (0, 0)' no gráfico quando cabe, na legenda com o símbolo quando não, e nunca o 0 do eixo (marco 2d)", () => {
  // (b) Com espaço, o rótulo inteiro fica NO gráfico, a no máximo 8 unidades da borda do ponto, e o 0 do eixo não aparece.
  const livre = desenharVisual(normalizarVisual(ORIGEM_LIVRE), { tipo: "enunciado" });
  assert.equal(numerosDeEixo(livre).includes("0"), false, "com um ponto na origem não há 0 de eixo");
  const daOrigem = livre.caixas.find((caixa) => caixa.tipo === "rotulo" && caixa.texto === "O (0, 0)");
  assert.ok(daOrigem, "o rótulo inteiro da origem fica no gráfico");
  assert.equal(livre.textos.filter((texto) => texto === "O (0, 0)").length, 1, "e não repete na legenda");
  const origem = pontosDesenhados(livre)[0];
  assert.ok(distanciaDaBorda(daOrigem, origem) <= 8.02 && distanciaDaBorda(daOrigem, origem) >= 0, `a ${distanciaDaBorda(daOrigem, origem)} da borda`);
  // Sem ponto na origem o 0 do eixo está lá.
  assert.ok(numerosDeEixo(desenharVisual(normalizarVisual({ ...ORIGEM_LIVRE, pontos: ORIGEM_LIVRE.pontos.slice(1), segmentos: [{ de: "P", ate: "Q" }] }), { tipo: "enunciado" })).includes("0"));

  // Sem lugar a menos de 8 unidades (aqui o vizinho P e os números tomam os quadrantes), o ponto fica sem letra e as coordenadas
  // vão para a legenda, em linha própria, com o símbolo dele antes.
  const desenho = desenharVisual(normalizarVisual(NA_ORIGEM), { tipo: "enunciado" });
  for (const esperado of ["−4", "−3", "−2", "−1", "1", "2", "3", "4", "5"]) assert.ok(numerosDeEixo(desenho).includes(esperado), `falta o ${esperado}`);
  assert.equal(numerosDeEixo(desenho).includes("0"), false, "com um ponto na origem não há 0 de eixo");
  assert.equal(desenho.caixas.some((caixa) => caixa.tipo === "numero" && caixa.texto === "0"), false);
  assert.equal(desenho.caixas.some((caixa) => caixa.tipo === "rotulo" && /^O\b/.test(caixa.texto)), false, "nem a letra cabe a menos de 8 unidades do ponto");
  assert.equal(desenho.textos.filter((texto) => texto === "O (0, 0)").length, 1, "as coordenadas estão na legenda");
  assert.ok(desenho.menorTexto >= PISO_DO_TEXTO);
  // Legenda: "dados" e "especial" levam o símbolo, e a entrada "O (0, 0)" leva a bolinha de dado: duas bolinhas e um losango.
  assert.deepEqual(simbolosDaLegenda(desenho), { dado: 2, especial: 1, procurado: 0 });
  // (c) O segmento O–P é cheio: nada o corta (era o halo branco do "0" que o deixava tracejado).
  const [op] = segmentosDoDesenho(desenho);
  for (const caixa of desenho.caixas) {
    assert.equal(segmentoPassaPelaCaixa(op, caixa, 0.5), false, `${caixa.tipo} "${caixa.texto}" corta o segmento O–P`);
  }
  // Sem ponto na origem o 0 do eixo volta, e nenhum segmento passa por ele (o halo do 0 deixava o segmento tracejado). Os outros
  // números do eixo podem ter o halo sobre um segmento; o Designer aceitou.
  for (const nome of NOMES) {
    const figura = normalizarVisual(fixture(nome).visuais.find((visual) => visual.tipo === "plano"));
    if (!figura) continue;
    for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
      const feito = desenharVisual(figura, contexto);
      assert.ok(numerosDeEixo(feito).includes("0"), `${nome}: o 0 do eixo`);
      const zero = feito.caixas.find((caixa) => caixa.tipo === "numero" && caixa.texto === "0");
      for (const traco of segmentosDoDesenho(feito)) assert.equal(segmentoPassaPelaCaixa(traco, zero, 0.5), false, `${nome}/${contexto.tipo}: o 0 do eixo fica em cima de um segmento`);
    }
  }
  // Mesmo com os segmentos passando perto da origem, o 0 foge deles: o canto escolhido é o que não tem traço por baixo.
  const perto = normalizarVisual({
    tipo: "plano", alt: "Segmentos perto da origem.", x: [-4, 5], y: [-3, 5],
    pontos: [{ id: "A", x: -2, y: -2 }, { id: "B", x: 3, y: 2 }, { id: "C", x: -2, y: 3 }, { id: "D", x: 3, y: -2 }],
    segmentos: [{ de: "A", ate: "B" }, { de: "C", ate: "D" }],
  });
  const cruzado = desenharVisual(perto, { tipo: "enunciado" });
  const zeroDoCruzado = cruzado.caixas.find((caixa) => caixa.tipo === "numero" && caixa.texto === "0");
  assert.ok(zeroDoCruzado, "o 0 do eixo está lá");
  for (const traco of segmentosDoDesenho(cruzado)) assert.equal(segmentoPassaPelaCaixa(traco, zeroDoCruzado, 0.5), false, "o 0 foge dos dois segmentos que se cruzam na origem");
});

/* ----- Marco 2d: o motor respeita alturaMaxima, a letra fica a ≤ 8 do ponto, a legenda leva o símbolo ----- */

/** O pior que o validador aceita: oito pontos com rótulo e coordenadas longas, todos juntos (todos perdem as coordenadas para a legenda). */
const MAIOR_LEGENDA = {
  tipo: "plano", alt: "Oito pontos juntos, com coordenadas longas.", x: [-1000, 1000], y: [-1000, 1000],
  pontos: Array.from({ length: 8 }, (_, i) => ({ id: `P${i + 1}`, x: -123.45 - i * 0.01, y: -678.91 - i * 0.01, ...(i % 3 === 0 ? { papel: "especial" } : {}) })),
};
const ALTURAS_MAXIMAS = [158, 160, 179, 200, 201, 352];

function figurasDoTeste() {
  const daFixture = (nome, tipo) => normalizarVisual(fixture(nome).visuais.find((visual) => visual.tipo === tipo));
  return {
    baricentro: daFixture("baricentro", "plano"),
    colinearidade: daFixture("colinearidade", "plano"),
    abscissas: daFixture("abscissas", "reta_numerica"),
    "ponto na origem": normalizarVisual(NA_ORIGEM),
    "ponto cercado": normalizarVisual(CERCADO),
    "maior legenda": normalizarVisual(MAIOR_LEGENDA),
  };
}

test("o motor respeita alturaMaxima SEMPRE: altura ≤ alturaMaxima, ou o desenho sai marcado naoCabe; o texto nunca desce do piso", () => {
  for (const [nome, figura] of Object.entries(figurasDoTeste())) {
    assert.ok(figura, `${nome}: o visual vale`);
    for (const alturaMaxima of ALTURAS_MAXIMAS) {
      for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }, { tipo: "passo", ultimo: false }]) {
        const desenho = desenharVisual(figura, contexto, { alturaMaxima });
        const onde = `${nome} · ${contexto.tipo} · alturaMaxima ${alturaMaxima}`;
        assert.equal(desenho.largura, LARGURA_DO_DESENHO, onde);
        assert.ok(desenho.menorTexto >= PISO_DO_TEXTO, `${onde}: o texto desceu a ${desenho.menorTexto}`);
        if (desenho.naoCabe) {
          assert.equal(desenho.naoCabe, true);
          assert.ok(desenho.altura > alturaMaxima, `${onde}: marcado naoCabe com altura ${desenho.altura}`);
          continue;
        }
        assert.ok(desenho.altura <= alturaMaxima + 1e-9, `${onde}: altura ${desenho.altura}`);
        const { xmin, xmax, ymin, ymax } = limites(desenho);
        assert.ok(xmin >= -0.5 && xmax <= LARGURA_DO_DESENHO + 0.5 && ymin >= -0.5 && ymax <= desenho.altura + 0.5, `${onde}: nada cai fora do desenho`);
        const caixas = desenho.caixas.filter((caixa) => caixa.tipo !== "foco");
        for (let i = 0; i < caixas.length; i += 1) {
          for (let j = i + 1; j < caixas.length; j += 1) assert.equal(bate(caixas[i], caixas[j], 0, 1.5), false, `${onde}: ${caixas[i].texto} bate em ${caixas[j].texto}`);
        }
      }
    }
  }
  // A tela do iPhone pequeno (alturaMaxima 158) e as intermediárias: todas as figuras das fixtures cabem, e a escala do gráfico é que desce.
  for (const nome of ["baricentro", "colinearidade", "abscissas", "ponto na origem", "ponto cercado"]) {
    for (const alturaMaxima of [158, 160, 179, 200, 201]) {
      const desenho = desenharVisual(figurasDoTeste()[nome], { tipo: "enunciado" }, { alturaMaxima });
      assert.equal(desenho.naoCabe, undefined, `${nome} cabe em ${alturaMaxima}`);
    }
  }
  const apertado = desenharVisual(figurasDoTeste().baricentro, { tipo: "enunciado" }, { alturaMaxima: 158 });
  const folgado = desenharVisual(figurasDoTeste().baricentro, { tipo: "enunciado" }, { alturaMaxima: 352 });
  assert.ok(apertado.altura <= 158 && folgado.altura > 300);
  assert.equal(apertado.menorTexto, folgado.menorTexto, "o texto tem o mesmo tamanho nos dois: só o gráfico desceu");
  // As coordenadas que o rótulo perdeu nunca somem, mesmo quando a legenda encolhe: estão todas lá, em qualquer altura.
  for (const alturaMaxima of [158, 200, 352]) {
    const desenho = desenharVisual(figurasDoTeste()["ponto cercado"], { tipo: "enunciado" }, { alturaMaxima });
    assert.ok(desenho.textos.includes("A (0, 0)"), `alturaMaxima ${alturaMaxima}: as coordenadas de A`);
  }
});

test("a legenda mais longa que o motor aceita: oito linhas de coordenadas cabem em 320 (e no PNG), e abaixo disso o desenho diz naoCabe", () => {
  assert.equal(validarVisual(MAIOR_LEGENDA).ok, true, "o validador aceita o pior caso");
  for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
    const desenho = desenharVisual(normalizarVisual(MAIOR_LEGENDA), contexto);
    assert.equal(desenho.naoCabe, undefined);
    assert.ok(desenho.altura <= 320 + 1e-9, `altura ${desenho.altura}`);
    for (let i = 1; i <= 8; i += 1) assert.ok(desenho.textos.some((texto) => texto.startsWith(`P${i} (`)), `a coordenada de P${i} está na legenda`);
    assert.ok(desenho.menorTexto >= PISO_DO_TEXTO);
  }
  const apertado = desenharVisual(normalizarVisual(MAIOR_LEGENDA), { tipo: "enunciado" }, { alturaMaxima: 200 });
  assert.equal(apertado.naoCabe, true, "200 não comporta oito linhas de legenda: o motor não finge");
  assert.ok(apertado.altura > 200);
  // Um visual que nem em 320 cabe é inválido: o validador o recusa (o visual some e a lição segue em texto).
  const demais = { ...MAIOR_LEGENDA, pontos: MAIOR_LEGENDA.pontos.map((ponto) => ({ ...ponto, x: ponto.x - 700.12, y: ponto.y - 300.34 })) };
  assert.equal(validarVisual(demais).ok, true, "coordenadas ainda mais longas cabem em 320 (a legenda tem 8 linhas, no máximo)");
});

test("a letra do ponto fica a no máximo 8 unidades da borda dele, em qualquer das 8 direções, e a legenda leva as coordenadas que sobram", () => {
  let semente = 20261121;
  const proximo = () => (semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  let comRotulo = 0;
  let comLegenda = 0;
  let semLetra = 0;
  for (let i = 0; i < 400; i += 1) {
    const alcance = [3, 5, 8][Math.floor(proximo() * 3)];
    const quantidade = 3 + Math.floor(proximo() * 5);
    const usados = new Set();
    const pontos = [];
    for (let k = 0; pontos.length < quantidade && k < 60; k += 1) {
      const naOrigem = k === 0 && proximo() < 0.3;
      const x = naOrigem ? 0 : Math.round((proximo() * 2 - 1) * alcance);
      const y = naOrigem ? 0 : Math.round((proximo() * 2 - 1) * alcance);
      if (usados.has(`${x},${y}`)) continue;
      usados.add(`${x},${y}`);
      pontos.push({ id: `P${pontos.length + 1}`, x, y, ...(proximo() < 0.25 ? { papel: "especial" } : {}) });
    }
    const segmentos = [];
    for (let k = 0; k < Math.floor(proximo() * 3); k += 1) {
      const de = pontos[Math.floor(proximo() * pontos.length)].id;
      const ate = pontos[Math.floor(proximo() * pontos.length)].id;
      if (de !== ate) segmentos.push({ de, ate });
    }
    const bruto = { tipo: "plano", alt: "Pontos no plano.", x: [-alcance - 1, alcance + 1], y: [-alcance - 1, alcance + 1], pontos, ...(segmentos.length ? { segmentos } : {}) };
    const visual = normalizarVisual(bruto);
    if (!visual) continue;
    const alturaMaxima = [158, 200, 320][Math.floor(proximo() * 3)];
    const desenho = desenharVisual(visual, { tipo: "enunciado" }, { alturaMaxima });
    if (desenho.naoCabe) continue;
    const desenhados = pontosDesenhados(desenho);
    assert.equal(desenhados.length, visual.pontos.length, "um símbolo por ponto");
    const rotulos = desenho.caixas.filter((caixa) => caixa.tipo === "rotulo");
    visual.pontos.forEach((ponto, posicao) => {
      const rotulo = rotulos.find((caixa) => caixa.texto === ponto.id || caixa.texto.startsWith(`${ponto.id} (`));
      const inteiro = rotuloDoPonto(ponto.id, [ponto.x, ponto.y]);
      const onde = `caso ${i} (${alturaMaxima}): ${inteiro}`;
      if (rotulo) {
        comRotulo += 1;
        const distancia = distanciaDaBorda(rotulo, desenhados[posicao]);
        assert.ok(distancia >= -0.01 && distancia <= 8.02, `${onde}: a letra fica a ${distancia} da borda do ponto`);
        for (const [outro, caixaDeOutro] of desenhados.entries()) {
          if (outro !== posicao) assert.ok(distanciaDaBorda(rotulo, caixaDeOutro) >= -0.01, `${onde}: o rótulo cobre outro ponto`);
        }
        // Rótulo só com o nome: as coordenadas estão na legenda; com elas, não repetem.
        const naLegenda = desenho.textos.filter((texto) => texto === inteiro).length;
        if (rotulo.texto === ponto.id) { assert.equal(naLegenda, 1, `${onde}: coordenadas na legenda`); comLegenda += 1; }
        else assert.equal(naLegenda, 1, `${onde}: o rótulo inteiro está uma vez só`);
      } else {
        semLetra += 1;
        assert.equal(desenho.textos.filter((texto) => texto === inteiro).length, 1, `${onde}: sem letra, as coordenadas vão para a legenda`);
      }
    });
    const caixas = desenho.caixas.filter((caixa) => caixa.tipo !== "foco");
    for (let a = 0; a < caixas.length; a += 1) {
      for (let b = a + 1; b < caixas.length; b += 1) assert.equal(bate(caixas[a], caixas[b], 0, 1.5), false, `caso ${i}: ${caixas[a].texto} bate em ${caixas[b].texto}`);
    }
    // O 0 do eixo só quando não há ponto na origem.
    const haPontoNaOrigem = visual.pontos.some((ponto) => ponto.x === 0 && ponto.y === 0);
    assert.equal(numerosDeEixo(desenho).includes("0"), !haPontoNaOrigem, `caso ${i}: o 0 do eixo`);
  }
  assert.ok(comRotulo > 400 && comLegenda > 0 && semLetra > 0, `a amostra pega os três casos (${comRotulo} rótulos, ${comLegenda} só com o nome, ${semLetra} sem letra)`);
});

test("a legenda das coordenadas leva o símbolo do ponto antes: bolinha, losango, na cor do papel", () => {
  // Um ponto especial cercado: a bolinha dos dados e o losango do especial na legenda, e o losango de novo na entrada "A (0, 0)".
  const cercadoEspecial = { ...CERCADO, pontos: [{ id: "A", x: 0, y: 0, papel: "especial" }, ...CERCADO.pontos.slice(1)] };
  const desenho = desenharVisual(normalizarVisual(cercadoEspecial), { tipo: "enunciado" });
  assert.equal(desenho.caixas.some((caixa) => caixa.tipo === "rotulo" && caixa.texto.startsWith("A")), false);
  assert.equal(desenho.textos.filter((texto) => texto === "A (0, 0)").length, 1);
  assert.deepEqual(simbolosDaLegenda(desenho), { dado: 1, especial: 2, procurado: 0 }, "dados, especial e a entrada de A (losango)");
  const simples = desenharVisual(normalizarVisual(CERCADO), { tipo: "enunciado" });
  assert.deepEqual(simbolosDaLegenda(simples), { dado: 1, especial: 0, procurado: 0 }, "só a entrada de A, com a bolinha dos dados");
  // A cor do texto da entrada é a do papel do ponto (a mesma do rótulo no gráfico).
  const textoDeA = (feito) => feito.primitivas.filter((primitiva) => primitiva.tipo === "caminho" && /Texto$/.test(primitiva.preenchimento ?? ""));
  assert.ok(textoDeA(desenho).some((primitiva) => primitiva.preenchimento === "especialTexto"), "a entrada do especial é roxa");
  // Em altura apertada o gráfico desce e as linhas da legenda se juntam, e as categorias e as coordenadas continuam lá.
  const apertado = desenharVisual(normalizarVisual(cercadoEspecial), { tipo: "enunciado" }, { alturaMaxima: 158 });
  assert.equal(apertado.naoCabe, undefined);
  assert.ok(apertado.textos.includes("A (0, 0)") && apertado.textos.includes("dados") && apertado.textos.includes("especial"));
  assert.deepEqual(simbolosDaLegenda(apertado), { dado: 1, especial: 2, procurado: 0 }, "os símbolos seguem na legenda junta");
  // Só quando nem assim cabe as categorias saem (as coordenadas ficam, com o texto na cor do papel e sem o símbolo).
  const compacta = desenharVisual(normalizarVisual(MAIOR_LEGENDA), { tipo: "enunciado" });
  assert.equal(compacta.naoCabe, undefined);
  assert.equal(compacta.textos.includes("dados") || compacta.textos.includes("especial"), false);
  assert.deepEqual(simbolosDaLegenda(compacta), { dado: 0, especial: 0, procurado: 0 });
  assert.ok(compacta.primitivas.some((primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento === "especialTexto"), "a coordenada do especial segue roxa");
});

test("a escala do ponto desce com o gráfico: pontos vizinhos não encostam numa grade baixa", () => {
  const figura = figurasDoTeste().baricentro;
  const alto = pontosDesenhados(desenharVisual(figura, { tipo: "enunciado" }, { alturaMaxima: 352 }));
  const baixo = pontosDesenhados(desenharVisual(figura, { tipo: "enunciado" }, { alturaMaxima: 158 }));
  assert.ok(baixo.every((ponto, i) => ponto.raio < alto[i].raio), "na grade baixa os pontos são menores");
  assert.ok(baixo.every((ponto, i) => ponto.raio >= 0.55 * alto[i].raio - 1e-9), "mas não menos que 55%");
  // A (1, 2) e G (1, 3) ficam a uma unidade um do outro: com o raio menor as bolinhas não se cobrem.
  const [a, g] = [baixo[0], baixo[1]];
  const centros = baixo.map((ponto) => `${ponto.x},${ponto.y}`);
  assert.equal(new Set(centros).size, baixo.length);
  assert.ok(Math.hypot(a.x - g.x, a.y - g.y) >= a.raio + g.raio - 1, "os dois pontos não se cobrem");
});

test("os números do eixo x nunca se encostam, mesmo com milhares", () => {
  for (const nome of ["maior legenda", "ponto cercado"]) {
    for (const alturaMaxima of [158, 320]) {
      const desenho = desenharVisual(figurasDoTeste()[nome], { tipo: "enunciado" }, { alturaMaxima });
      const numeros = desenho.caixas.filter((caixa) => caixa.tipo === "numero").sort((a, b) => a.x - b.x);
      for (let i = 1; i < numeros.length; i += 1) {
        const mesmaLinha = Math.abs(numeros[i].y - numeros[i - 1].y) < 2;
        if (mesmaLinha) assert.ok(numeros[i].x - (numeros[i - 1].x + numeros[i - 1].largura) >= 4, `${nome} ${alturaMaxima}: ${numeros[i - 1].texto} encosta em ${numeros[i].texto}`);
      }
    }
  }
});
