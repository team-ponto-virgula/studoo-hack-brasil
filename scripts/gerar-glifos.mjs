#!/usr/bin/env node
/*
 * Gera packages/contratos/src/glifos.ts: o contorno dos caracteres do Nunito (700 e 800, licença OFL) que o motor de desenho usa
 * para o texto das fórmulas e dos rótulos. O servidor não tem fontes instaladas e o app e a web precisam desenhar igual, então o
 * texto vira caminho (M, L, Q, Z) a partir desta tabela, nunca de uma fonte do aparelho.
 *
 * Uso: node scripts/gerar-glifos.mjs [caminho/NotoSans-Bold.ttf]
 * Fontes dos dados:
 * - public/marca/og/nunito-latin-700-normal.woff e nunito-latin-800-normal.woff: o subconjunto latino do Nunito (licença em
 *   public/marca/OFL-Nunito.txt). Os símbolos ≠ ≤ ≥ → √ não estão nele: o motor os desenha com linhas;
 * - NotoSans-Bold.ttf (Google, SIL OFL 1.1, texto em public/marca/OFL-NotoSans.txt): só o Δ e o π, que a Nunito não tem
 *   (decisão do Designer: contorno da Noto Sans Bold na mesma tabela, nunca desenhado à mão). Padrão do caminho: o da
 *   instalação do pacote fonts-noto-core do Debian.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));

function lerTabelas(caminho) {
  const b = readFileSync(caminho);
  const tabelas = {};
  if (b.toString("latin1", 0, 4) === "wOFF") {
    const total = b.readUInt16BE(12);
    for (let i = 0; i < total; i += 1) {
      const base = 44 + i * 20;
      const tag = b.toString("latin1", base, base + 4);
      const posicao = b.readUInt32BE(base + 4);
      const comprimido = b.readUInt32BE(base + 8);
      const original = b.readUInt32BE(base + 12);
      const dados = b.subarray(posicao, posicao + comprimido);
      tabelas[tag] = comprimido < original ? inflateSync(dados) : dados;
    }
    return tabelas;
  }
  const tipo = b.readUInt32BE(0);
  if (tipo !== 0x00010000 && b.toString("latin1", 0, 4) !== "true") throw new Error(`${caminho}: não é TrueType nem WOFF`);
  const total = b.readUInt16BE(4);
  for (let i = 0; i < total; i += 1) {
    const base = 12 + i * 16;
    const tag = b.toString("latin1", base, base + 4);
    tabelas[tag] = b.subarray(b.readUInt32BE(base + 8), b.readUInt32BE(base + 8) + b.readUInt32BE(base + 12));
  }
  return tabelas;
}

function lerFonte(caminho) {
  const t = lerTabelas(caminho);
  const unidades = t.head.readUInt16BE(18);
  const formatoDoLoca = t.head.readInt16BE(50);
  const glifos = t.maxp.readUInt16BE(4);
  const metricas = t.hhea.readUInt16BE(34);
  const loca = [];
  for (let i = 0; i <= glifos; i += 1) loca.push(formatoDoLoca === 0 ? t.loca.readUInt16BE(i * 2) * 2 : t.loca.readUInt32BE(i * 4));

  const avanco = (indice) => t.hmtx.readUInt16BE(Math.min(indice, metricas - 1) * 4);

  // cmap: formato 4 (BMP) da plataforma 3/1 ou 0.
  const cmap = t.cmap;
  const subtabelas = cmap.readUInt16BE(2);
  let deslocamento = -1;
  for (let i = 0; i < subtabelas; i += 1) {
    const plataforma = cmap.readUInt16BE(4 + i * 8);
    const codificacao = cmap.readUInt16BE(6 + i * 8);
    const inicio = cmap.readUInt32BE(8 + i * 8);
    if (cmap.readUInt16BE(inicio) === 4 && ((plataforma === 3 && codificacao === 1) || plataforma === 0)) deslocamento = inicio;
  }
  if (deslocamento < 0) throw new Error(`${caminho}: sem cmap de formato 4`);
  const segmentos = cmap.readUInt16BE(deslocamento + 6) / 2;
  const fim = deslocamento + 14;
  const comeco = fim + segmentos * 2 + 2;
  const delta = comeco + segmentos * 2;
  const intervalo = delta + segmentos * 2;
  const indiceDo = (codigo) => {
    for (let s = 0; s < segmentos; s += 1) {
      if (codigo > cmap.readUInt16BE(fim + s * 2)) continue;
      const primeiro = cmap.readUInt16BE(comeco + s * 2);
      if (codigo < primeiro) return 0;
      const desloc = cmap.readUInt16BE(intervalo + s * 2);
      const d = cmap.readInt16BE(delta + s * 2);
      if (desloc === 0) return (codigo + d) & 0xffff;
      const posicao = intervalo + s * 2 + desloc + (codigo - primeiro) * 2;
      const g = cmap.readUInt16BE(posicao);
      return g === 0 ? 0 : (g + d) & 0xffff;
    }
    return 0;
  };

  const pontosDoGlifo = (indice) => {
    const inicio = loca[indice];
    if (loca[indice + 1] === inicio) return [];
    const g = t.glyf;
    const contornos = g.readInt16BE(inicio);
    if (contornos >= 0) {
      const finais = [];
      for (let i = 0; i < contornos; i += 1) finais.push(g.readUInt16BE(inicio + 10 + i * 2));
      const instrucoes = g.readUInt16BE(inicio + 10 + contornos * 2);
      let p = inicio + 12 + contornos * 2 + instrucoes;
      const total = contornos === 0 ? 0 : finais[contornos - 1] + 1;
      const marcas = [];
      while (marcas.length < total) {
        const m = g[p++];
        marcas.push(m);
        if (m & 8) {
          let repete = g[p++];
          while (repete-- > 0) marcas.push(m);
        }
      }
      const eixo = (curto, igual) => {
        const valores = [];
        let v = 0;
        for (const m of marcas) {
          if (m & curto) {
            const d = g[p++];
            v += m & igual ? d : -d;
          } else if (!(m & igual)) {
            v += g.readInt16BE(p);
            p += 2;
          }
          valores.push(v);
        }
        return valores;
      };
      const xs = eixo(2, 16);
      const ys = eixo(4, 32);
      const contornosPontos = [];
      let primeiro = 0;
      for (const ultimo of finais) {
        const pontos = [];
        for (let i = primeiro; i <= ultimo; i += 1) pontos.push({ x: xs[i], y: ys[i], no: (marcas[i] & 1) === 1 });
        contornosPontos.push(pontos);
        primeiro = ultimo + 1;
      }
      return contornosPontos;
    }
    // Composto: acento + letra.
    let p = inicio + 10;
    let resultado = [];
    for (;;) {
      const marcas = g.readUInt16BE(p);
      const componente = g.readUInt16BE(p + 2);
      p += 4;
      let dx;
      let dy;
      if (marcas & 1) {
        dx = g.readInt16BE(p);
        dy = g.readInt16BE(p + 2);
        p += 4;
      } else {
        dx = g.readInt8(p);
        dy = g.readInt8(p + 1);
        p += 2;
      }
      if (!(marcas & 2)) {
        dx = 0;
        dy = 0;
      }
      let a = 1;
      let b = 0;
      let c = 0;
      let d = 1;
      if (marcas & 8) {
        a = d = g.readInt16BE(p) / 16384;
        p += 2;
      } else if (marcas & 0x40) {
        a = g.readInt16BE(p) / 16384;
        d = g.readInt16BE(p + 2) / 16384;
        p += 4;
      } else if (marcas & 0x80) {
        a = g.readInt16BE(p) / 16384;
        b = g.readInt16BE(p + 2) / 16384;
        c = g.readInt16BE(p + 4) / 16384;
        d = g.readInt16BE(p + 6) / 16384;
        p += 8;
      }
      for (const contorno of pontosDoGlifo(componente)) {
        resultado.push(contorno.map((q) => ({ x: a * q.x + c * q.y + dx, y: b * q.x + d * q.y + dy, no: q.no })));
      }
      if (!(marcas & 0x20)) break;
    }
    return resultado;
  };

  return { unidades, avanco, indiceDo, pontosDoGlifo };
}

const r = (n) => String(Math.round(n));

/** Contornos de TrueType (quadráticos, com pontos implícitos) em M, L, Q e Z, em unidades da fonte, com y para cima. */
function caminho(contornos) {
  let d = "";
  for (const pontos of contornos) {
    if (pontos.length < 2) continue;
    const n = pontos.length;
    let inicio = pontos.findIndex((q) => q.no);
    let lista;
    if (inicio >= 0) {
      lista = [...pontos.slice(inicio), ...pontos.slice(0, inicio)];
    } else {
      const meio = { x: (pontos[0].x + pontos[1].x) / 2, y: (pontos[0].y + pontos[1].y) / 2, no: true };
      lista = [meio, ...pontos.slice(1), pontos[0]];
    }
    d += `M${r(lista[0].x)} ${r(lista[0].y)}`;
    let i = 1;
    while (i <= lista.length) {
      const atual = lista[i % lista.length];
      if (i === lista.length) {
        // Fechando: se o último ponto é de controle, curva até o primeiro.
        break;
      }
      if (atual.no) {
        d += `L${r(atual.x)} ${r(atual.y)}`;
        i += 1;
      } else {
        const depois = lista[(i + 1) % lista.length];
        if (depois.no) {
          d += `Q${r(atual.x)} ${r(atual.y)} ${r(depois.x)} ${r(depois.y)}`;
          i += 2;
        } else {
          const meio = { x: (atual.x + depois.x) / 2, y: (atual.y + depois.y) / 2 };
          d += `Q${r(atual.x)} ${r(atual.y)} ${r(meio.x)} ${r(meio.y)}`;
          i += 1;
        }
      }
    }
    // O último segmento pode terminar num ponto de controle que volta ao início.
    const ultimo = lista[lista.length - 1];
    if (!ultimo.no) d += `Q${r(ultimo.x)} ${r(ultimo.y)} ${r(lista[0].x)} ${r(lista[0].y)}`;
    d += "Z";
    void n;
  }
  return d;
}

/** O português do Brasil: á ã â à é ê í ó ô õ ú ü ç, em minúscula e maiúscula. */
const LATINAS = "ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü";
const BASICOS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SIMBOLOS_700 = " .,;:!?'’()[]/%+=<>-−×÷·";
const SIMBOLOS_800 = " .,()−?'=";

function tabela(caminhoDoArquivo, caracteres, unidadesAlvo = 0) {
  const fonte = lerFonte(caminhoDoArquivo);
  const escala = unidadesAlvo ? unidadesAlvo / fonte.unidades : 1;
  const saida = {};
  for (const caractere of new Set(caracteres)) {
    const indice = fonte.indiceDo(caractere.codePointAt(0));
    if (indice === 0 && caractere !== " ") throw new Error(`${caminhoDoArquivo}: sem o glifo ${caractere}`);
    const contornos = fonte.pontosDoGlifo(indice).map((pontos) => pontos.map((q) => ({ ...q, x: q.x * escala, y: q.y * escala })));
    saida[caractere] = [Math.round(fonte.avanco(indice) * escala), caminho(contornos)];
  }
  const menos = fonte.pontosDoGlifo(fonte.indiceDo(0x2212)).flat();
  const eixo = menos.length ? (Math.min(...menos.map((q) => q.y)) + Math.max(...menos.map((q) => q.y))) / 2 : 0;
  const maiuscula = fonte.pontosDoGlifo(fonte.indiceDo("H".codePointAt(0))).flat();
  const minuscula = fonte.pontosDoGlifo(fonte.indiceDo("x".codePointAt(0))).flat();
  return {
    unidades: fonte.unidades,
    eixo,
    alturaMaiuscula: Math.max(...maiuscula.map((q) => q.y)),
    alturaMinuscula: Math.max(...minuscula.map((q) => q.y)),
    saida,
  };
}

const dirOg = `${raiz}public/marca/og/`;
const t700 = tabela(`${dirOg}nunito-latin-700-normal.woff`, BASICOS + LATINAS + SIMBOLOS_700);
const t800 = tabela(`${dirOg}nunito-latin-800-normal.woff`, BASICOS + SIMBOLOS_800);
if (t700.unidades !== t800.unidades) throw new Error("unidades por em diferentes");

/** O grego da fase 1: Δ (discriminante) e π (círculo). Contorno da Noto Sans Bold, na escala da Nunito. */
const caminhoDaNoto = process.argv[2] ?? "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf";
const grego = tabela(caminhoDaNoto, "Δπ", t700.unidades);
Object.assign(t700.saida, grego.saida);
const sha256 = createHash("sha256").update(readFileSync(caminhoDaNoto)).digest("hex");

const linhas = (nome, dados) =>
  `export const ${nome}: Readonly<Record<string, readonly [number, string]>> = {\n${Object.entries(dados.saida)
    .map(([caractere, [avanco, d]]) => `  ${JSON.stringify(caractere)}: [${avanco}, ${JSON.stringify(d)}],`)
    .join("\n")}\n};\n`;

const conteudo = `/*
 * Gerado por scripts/gerar-glifos.mjs a partir do Nunito 700 e 800 (SIL OFL 1.1, public/marca/OFL-Nunito.txt) e, só para o Δ e o
 * π, da Noto Sans Bold (Google, SIL OFL 1.1, public/marca/OFL-NotoSans.txt; sha256 do arquivo lido: ${sha256}). Não edite à mão.
 * Cada glifo é [avanço, caminho] em unidades da fonte (${t700.unidades} por em), com y para cima; o caminho só tem M, L, Q e Z.
 */
export const UNIDADES_POR_EM = ${t700.unidades};
/** Altura do centro do sinal de menos: onde ficam a barra de fração e os operadores. */
export const EIXO_MATEMATICO = ${Math.round(t700.eixo)};
export const ALTURA_MAIUSCULA = ${t700.alturaMaiuscula};
export const ALTURA_MINUSCULA = ${t700.alturaMinuscula};

${linhas("GLIFOS_700", t700)}
${linhas("GLIFOS_800", t800)}`;

writeFileSync(`${raiz}packages/contratos/src/glifos.ts`, conteudo);
console.log(`glifos.ts: ${Object.keys(t700.saida).length} glifos em 700, ${Object.keys(t800.saida).length} em 800, ${conteudo.length} caracteres; eixo ${Math.round(t700.eixo)}, maiúscula ${t700.alturaMaiuscula}, minúscula ${t700.alturaMinuscula}`);
