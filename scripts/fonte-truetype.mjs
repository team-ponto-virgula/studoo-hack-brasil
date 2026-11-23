/*
 * Leitor mínimo de fonte TrueType/WOFF para o gerador de glifos (sem dependência): contornos quadráticos, avanços e, nas fontes
 * variáveis, a instância de um peso (`fvar`, `avar`, `gvar`). O teste `tests/glifos-nunito.test.mjs` confere a instância contra as
 * fontes estáticas do repositório.
 */
import { readFileSync } from "node:fs";
import { brotliDecompressSync, inflateSync } from "node:zlib";

export function lerTabelas(caminho) {
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

/* ----- Fonte variável: o peso pedido a partir de fvar, avar e gvar ----- */

function aplicarMapa(mapa, v) {
  if (mapa.length === 0) return v;
  const achado = mapa.find(([de]) => de === v);
  if (achado) return achado[1];
  if (v < mapa[0][0]) return v + mapa[0][1] - mapa[0][0];
  if (v > mapa[mapa.length - 1][0]) return v + mapa[mapa.length - 1][1] - mapa[mapa.length - 1][0];
  for (let i = 1; i < mapa.length; i += 1) {
    if (v < mapa[i][0]) {
      const [de1, para1] = mapa[i - 1];
      const [de2, para2] = mapa[i];
      return para1 + ((v - de1) / (de2 - de1)) * (para2 - para1);
    }
  }
  return v;
}

function pontosPacotados(b, q) {
  let total = b[q++];
  if (total & 0x80) total = ((total & 0x7f) << 8) | b[q++];
  if (total === 0) return ["todos", q];
  const pontos = [];
  let ultimo = 0;
  while (pontos.length < total) {
    const controle = b[q++];
    const corrida = (controle & 0x7f) + 1;
    for (let i = 0; i < corrida; i += 1) {
      if (controle & 0x80) {
        ultimo += b.readUInt16BE(q);
        q += 2;
      } else {
        ultimo += b[q++];
      }
      pontos.push(ultimo);
    }
  }
  return [pontos, q];
}

function deltasPacotados(b, q, total) {
  const valores = [];
  while (valores.length < total) {
    const controle = b[q++];
    const corrida = (controle & 0x3f) + 1;
    for (let i = 0; i < corrida; i += 1) {
      if (controle & 0x80) valores.push(0);
      else if (controle & 0x40) {
        valores.push(b.readInt16BE(q));
        q += 2;
      } else {
        valores.push(b.readInt8(q));
        q += 1;
      }
    }
  }
  return [valores, q];
}

/** IUP: os pontos que o tuple não mexeu recebem o delta interpolado entre os vizinhos que ele mexeu, contorno a contorno. */
function interpolarNaoTocados(coords, deltas, tocados, finais) {
  let primeiro = 0;
  for (const ultimo of finais) {
    const noContorno = [];
    for (let i = primeiro; i <= ultimo; i += 1) if (tocados[i]) noContorno.push(i);
    if (noContorno.length === 1) {
      for (let i = primeiro; i <= ultimo; i += 1) deltas[i] = deltas[noContorno[0]];
    } else if (noContorno.length > 1) {
      for (let k = 0; k < noContorno.length; k += 1) {
        const a = noContorno[k];
        const b = noContorno[(k + 1) % noContorno.length];
        const entre = [];
        for (let i = a === ultimo ? primeiro : a + 1; i !== b; i = i === ultimo ? primeiro : i + 1) entre.push(i);
        let [c1, d1, c2, d2] = [coords[a], deltas[a], coords[b], deltas[b]];
        if (c1 > c2) [c1, d1, c2, d2] = [c2, d2, c1, d1];
        for (const i of entre) {
          const c = coords[i];
          if (c1 === c2) deltas[i] = d1 === d2 ? d1 : 0;
          else if (c <= c1) deltas[i] = d1;
          else if (c >= c2) deltas[i] = d2;
          else deltas[i] = d1 + ((c - c1) / (c2 - c1)) * (d2 - d1);
        }
      }
    }
    primeiro = ultimo + 1;
  }
}

function prepararVariacao(t, peso) {
  const fv = t.fvar;
  const eixosOff = fv.readUInt16BE(4);
  const nEixos = fv.readUInt16BE(8);
  const tamEixo = fv.readUInt16BE(10);
  const eixos = [];
  for (let i = 0; i < nEixos; i += 1) {
    const b = eixosOff + i * tamEixo;
    eixos.push({ tag: fv.toString("latin1", b, b + 4), min: fv.readInt32BE(b + 4) / 65536, def: fv.readInt32BE(b + 8) / 65536, max: fv.readInt32BE(b + 12) / 65536 });
  }
  let normal = eixos.map((e) => {
    const v = Math.min(Math.max(e.tag === "wght" ? peso : e.def, e.min), e.max);
    return v < e.def ? (v - e.def) / (e.def - e.min) : v > e.def ? (v - e.def) / (e.max - e.def) : 0;
  });
  if (t.avar) {
    let p = 8;
    normal = normal.map((v) => {
      const total = t.avar.readUInt16BE(p);
      p += 2;
      const mapa = [];
      for (let k = 0; k < total; k += 1) {
        mapa.push([t.avar.readInt16BE(p) / 16384, t.avar.readInt16BE(p + 2) / 16384]);
        p += 4;
      }
      return aplicarMapa(mapa, v);
    });
  }

  const gv = t.gvar;
  const eixosDoGvar = gv.readUInt16BE(4);
  const compartilhados = gv.readUInt16BE(6);
  const deslocamentoCompartilhados = gv.readUInt32BE(8);
  const glifos = gv.readUInt16BE(12);
  const longos = (gv.readUInt16BE(14) & 1) === 1;
  const inicioDosDados = gv.readUInt32BE(16);
  const deslocamentos = [];
  for (let i = 0; i <= glifos; i += 1) deslocamentos.push(longos ? gv.readUInt32BE(20 + i * 4) : gv.readUInt16BE(20 + i * 2) * 2);
  const tuplesCompartilhados = [];
  for (let k = 0; k < compartilhados; k += 1) {
    const tuple = [];
    for (let a = 0; a < eixosDoGvar; a += 1) tuple.push(gv.readInt16BE(deslocamentoCompartilhados + (k * eixosDoGvar + a) * 2) / 16384);
    tuplesCompartilhados.push(tuple);
  }
  const lerTuple = (q) => {
    const tuple = [];
    for (let a = 0; a < eixosDoGvar; a += 1) tuple.push(gv.readInt16BE(q + a * 2) / 16384);
    return tuple;
  };
  const escalar = (pico, inicio, fim) => {
    let fator = 1;
    for (let a = 0; a < eixosDoGvar; a += 1) {
      const p = pico[a];
      if (p === 0) continue;
      const v = normal[a];
      if (inicio) {
        if (v < inicio[a] || v > fim[a]) return 0;
        if (v === p) continue;
        fator *= v < p ? (v - inicio[a]) / (p - inicio[a]) : (fim[a] - v) / (fim[a] - p);
      } else {
        if (v === 0 || Math.sign(v) !== Math.sign(p) || Math.abs(v) > Math.abs(p)) return 0;
        fator *= v / p;
      }
    }
    return fator;
  };

  /** Os deltas de um glifo: `dx` e `dy` de cada ponto (e dos 4 fantasmas, depois deles). `contexto` leva o que o IUP precisa. */
  const deltas = (indice, pontos, contexto) => {
    const total = pontos + 4;
    const dx = new Array(total).fill(0);
    const dy = new Array(total).fill(0);
    const inicio = inicioDosDados + deslocamentos[indice];
    const fim = inicioDosDados + deslocamentos[indice + 1];
    if (indice >= glifos || inicio === fim) return { dx, dy };
    let p = inicio;
    const contagem = gv.readUInt16BE(p);
    const dadosEm = inicio + gv.readUInt16BE(p + 2);
    p += 4;
    const tuples = [];
    for (let i = 0; i < (contagem & 0x0fff); i += 1) {
      const tamanho = gv.readUInt16BE(p);
      const marca = gv.readUInt16BE(p + 2);
      p += 4;
      let pico;
      if (marca & 0x8000) {
        pico = lerTuple(p);
        p += eixosDoGvar * 2;
      } else {
        pico = tuplesCompartilhados[marca & 0x0fff];
      }
      let comeco = null;
      let termino = null;
      if (marca & 0x4000) {
        comeco = lerTuple(p);
        termino = lerTuple(p + eixosDoGvar * 2);
        p += eixosDoGvar * 4;
      }
      tuples.push({ tamanho, marca, pico, comeco, termino });
    }
    let q = dadosEm;
    let pontosCompartilhados = null;
    if (contagem & 0x8000) [pontosCompartilhados, q] = pontosPacotados(gv, q);
    for (const tuple of tuples) {
      const inicioDoTuple = q;
      let pontosDoTuple = pontosCompartilhados;
      if (tuple.marca & 0x2000) [pontosDoTuple, q] = pontosPacotados(gv, q);
      const quantidade = pontosDoTuple === "todos" ? total : pontosDoTuple.length;
      let vx;
      let vy;
      [vx, q] = deltasPacotados(gv, q, quantidade);
      [vy, q] = deltasPacotados(gv, q, quantidade);
      q = inicioDoTuple + tuple.tamanho;
      const fator = escalar(tuple.pico, tuple.comeco, tuple.termino);
      if (fator === 0) continue;
      const tx = new Array(total).fill(0);
      const ty = new Array(total).fill(0);
      const tocados = new Array(total).fill(false);
      if (pontosDoTuple === "todos") {
        for (let i = 0; i < total; i += 1) {
          tx[i] = vx[i];
          ty[i] = vy[i];
          tocados[i] = true;
        }
      } else {
        pontosDoTuple.forEach((ponto, k) => {
          if (ponto >= total) return;
          tx[ponto] = vx[k];
          ty[ponto] = vy[k];
          tocados[ponto] = true;
        });
        if (contexto) {
          interpolarNaoTocados(contexto.xs, tx, tocados, contexto.finais);
          interpolarNaoTocados(contexto.ys, ty, tocados, contexto.finais);
        }
      }
      for (let i = 0; i < total; i += 1) {
        dx[i] += fator * tx[i];
        dy[i] += fator * ty[i];
      }
    }
    return { dx, dy };
  };
  return { deltas };
}

export function lerFonte(caminho, peso = null) {
  const t = lerTabelas(caminho);
  const unidades = t.head.readUInt16BE(18);
  const formatoDoLoca = t.head.readInt16BE(50);
  const glifos = t.maxp.readUInt16BE(4);
  const metricas = t.hhea.readUInt16BE(34);
  const loca = [];
  for (let i = 0; i <= glifos; i += 1) loca.push(formatoDoLoca === 0 ? t.loca.readUInt16BE(i * 2) * 2 : t.loca.readUInt32BE(i * 4));

  const variacao = peso !== null && t.gvar ? prepararVariacao(t, peso) : null;
  const avancoBase = (indice) => t.hmtx.readUInt16BE(Math.min(indice, metricas - 1) * 4);
  /** Quantos pontos o glifo tem para o gvar: os do contorno, ou os componentes de um composto. */
  const contarPontos = (indice) => {
    const inicio = loca[indice];
    if (loca[indice + 1] === inicio) return 0;
    const g = t.glyf;
    const contornos = g.readInt16BE(inicio);
    if (contornos >= 0) return contornos === 0 ? 0 : g.readUInt16BE(inicio + 10 + (contornos - 1) * 2) + 1;
    let p = inicio + 10;
    let componentes = 0;
    for (;;) {
      const marcas = g.readUInt16BE(p);
      p += 4 + (marcas & 1 ? 4 : 2) + (marcas & 8 ? 2 : marcas & 0x40 ? 4 : marcas & 0x80 ? 8 : 0);
      componentes += 1;
      if (!(marcas & 0x20)) break;
    }
    return componentes;
  };
  const avanco = (indice) => {
    if (!variacao) return avancoBase(indice);
    const n = contarPontos(indice);
    const { dx } = variacao.deltas(indice, n, null);
    return avancoBase(indice) + dx[n + 1] - dx[n];
  };

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
      if (variacao) {
        const d = variacao.deltas(indice, total, { xs, ys, finais });
        for (let i = 0; i < total; i += 1) {
          xs[i] += d.dx[i];
          ys[i] += d.dy[i];
        }
      }
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
    // Composto: acento + letra. Com variação, o gvar move o deslocamento de cada componente (e os componentes variam por conta própria).
    let p = inicio + 10;
    let resultado = [];
    const deltasDoComposto = variacao ? variacao.deltas(indice, contarPontos(indice), null) : null;
    for (let numero = 0; ; numero += 1) {
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
      } else if (deltasDoComposto) {
        dx += deltasDoComposto.dx[numero];
        dy += deltasDoComposto.dy[numero];
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

export const r = (n) => String(Math.round(n));

/** Contornos de TrueType (quadráticos, com pontos implícitos) em M, L, Q e Z, em unidades da fonte, com y para cima. */
export function caminho(contornos) {
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

/* ----- Quais caracteres a fonte tem (cmap), em TTF, WOFF e WOFF2 ----- */

const TAGS_DO_WOFF2 = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp",
  "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL",
  "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx",
  "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

function tabelasDoWoff2(b) {
  const total = b.readUInt16BE(12);
  let p = 48;
  const base128 = () => {
    let valor = 0;
    for (let i = 0; i < 5; i += 1) {
      const byte = b[p++];
      valor = valor * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) break;
    }
    return valor;
  };
  const entradas = [];
  for (let i = 0; i < total; i += 1) {
    const marcas = b[p++];
    const indice = marcas & 0x3f;
    let nome;
    if (indice === 63) {
      nome = b.toString("latin1", p, p + 4);
      p += 4;
    } else {
      nome = TAGS_DO_WOFF2[indice];
    }
    const versao = marcas >> 6;
    const original = base128();
    // glyf e loca vêm transformados na versão 0; as outras tabelas só na versão diferente de 0.
    const transformada = nome === "glyf" || nome === "loca" ? versao === 0 : versao !== 0;
    entradas.push({ nome, tamanho: transformada ? base128() : original });
  }
  const dados = brotliDecompressSync(b.subarray(p, p + b.readUInt32BE(20)));
  const tabelas = {};
  let q = 0;
  for (const entrada of entradas) {
    tabelas[entrada.nome] = dados.subarray(q, q + entrada.tamanho);
    q += entrada.tamanho;
  }
  return tabelas;
}

/** O conjunto dos pontos de código (BMP e acima) que a fonte desenha. Lê o cmap de formato 4 e 12. */
export function caracteresDaFonte(caminho) {
  const b = readFileSync(caminho);
  const assinatura = b.toString("latin1", 0, 4);
  const { cmap } = assinatura === "wOF2" ? tabelasDoWoff2(b) : lerTabelas(caminho);
  const tem = new Set();
  const subtabelas = cmap.readUInt16BE(2);
  for (let i = 0; i < subtabelas; i += 1) {
    const inicio = cmap.readUInt32BE(4 + i * 8 + 4);
    const formato = cmap.readUInt16BE(inicio);
    if (formato === 4) {
      const segmentos = cmap.readUInt16BE(inicio + 6) / 2;
      const fim = inicio + 14;
      const comeco = fim + segmentos * 2 + 2;
      const delta = comeco + segmentos * 2;
      const intervalo = delta + segmentos * 2;
      for (let s = 0; s < segmentos; s += 1) {
        const ultimo = cmap.readUInt16BE(fim + s * 2);
        const primeiro = cmap.readUInt16BE(comeco + s * 2);
        for (let codigo = primeiro; codigo <= ultimo && codigo < 0xffff; codigo += 1) {
          const deslocamento = cmap.readUInt16BE(intervalo + s * 2);
          let glifo;
          if (deslocamento === 0) glifo = (codigo + cmap.readInt16BE(delta + s * 2)) & 0xffff;
          else {
            glifo = cmap.readUInt16BE(intervalo + s * 2 + deslocamento + (codigo - primeiro) * 2);
            if (glifo) glifo = (glifo + cmap.readInt16BE(delta + s * 2)) & 0xffff;
          }
          if (glifo) tem.add(codigo);
        }
      }
    } else if (formato === 12) {
      const grupos = cmap.readUInt32BE(inicio + 12);
      for (let g = 0; g < grupos; g += 1) {
        const de = cmap.readUInt32BE(inicio + 16 + g * 12);
        const ate = cmap.readUInt32BE(inicio + 20 + g * 12);
        for (let codigo = de; codigo <= ate; codigo += 1) tem.add(codigo);
      }
    }
  }
  return tem;
}
