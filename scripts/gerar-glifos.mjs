#!/usr/bin/env node
/*
 * Gera packages/contratos/src/glifos.ts: o contorno dos caracteres do Nunito (400, 700 e 800, licença OFL) que o motor de desenho
 * usa para o texto das fórmulas e dos rótulos. O servidor não tem fontes instaladas e o app e a web precisam desenhar igual, então o
 * texto vira caminho (M, L, Q, Z) a partir desta tabela, nunca de uma fonte do aparelho.
 *
 * Uso: node scripts/gerar-glifos.mjs [caminho/NotoSans-Bold.ttf [caminho/NotoSans-Regular.ttf]]
 * Fontes dos dados:
 * - public/marca/og/nunito-latin-700-normal.woff e nunito-latin-800-normal.woff: o subconjunto latino do Nunito (licença em
 *   public/marca/OFL-Nunito.txt). Os símbolos ≠ ≤ ≥ → √ não estão nele: o motor os desenha com linhas;
 * - public/marca/Nunito[wght].ttf (a fonte variável do app e da web, eixo wght de 200 a 1000): o peso 400 (regular), que o texto
 *   corrido da aula usa e a fórmula em linha precisa igualar. O script instancia o peso pedido lendo `fvar`, `avar` e `gvar` (deltas
 *   dos pontos, com IUP, e dos componentes dos glifos compostos, e dos pontos fantasma, que dão o avanço); a conferência está em
 *   `instanciaConfere`: o mesmo código, no peso 700, reproduz a tabela estática do 700;
 * - NotoSans-Bold.ttf e NotoSans-Regular.ttf (Google, SIL OFL 1.1, texto em public/marca/OFL-NotoSans.txt): só o Δ e o π, que a
 *   Nunito não tem (decisão do Designer: contorno da Noto Sans na mesma tabela, nunca desenhado à mão; Bold nos pesos 700, Regular
 *   no 400). Padrão do caminho: o da instalação do pacote fonts-noto-core do Debian.
 * O itálico das variáveis é o mesmo glifo inclinado pelo motor (`texto-vetorial.ts`): não há tabela de itálico.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));

import { caminho, lerFonte, r } from "./fonte-truetype.mjs";

/** O português do Brasil: á ã â à é ê í ó ô õ ú ü ç, em minúscula e maiúscula. */
const LATINAS = "ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü";
const BASICOS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SIMBOLOS_700 = " .,;:!?'’()[]/%+=<>-−×÷·";
const SIMBOLOS_800 = " .,()−?'=";

function tabela(caminhoDoArquivo, caracteres, unidadesAlvo = 0, reducao = 1, peso = null) {
  const fonte = lerFonte(caminhoDoArquivo, peso);
  const escala = (unidadesAlvo ? unidadesAlvo / fonte.unidades : 1) * reducao;
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
/** O peso 400 (regular): a fonte variável do app e da web, instanciada em wght 400, com o mesmo conjunto de caracteres do 700. */
const t400 = tabela(`${raiz}public/marca/Nunito[wght].ttf`, BASICOS + LATINAS + SIMBOLOS_700, 0, 1, 400);
if (t400.unidades !== t700.unidades) throw new Error("unidades por em diferentes no 400");

/**
 * O grego da fase 1: Δ (discriminante) e π (círculo). Contorno da Noto Sans Bold, na escala da Nunito e a 92% (parecer do
 * Designer: a Bold da Noto é mais pesada e mais larga que a Nunito; o pacote não traz a SemiBold).
 */
const caminhoDaNoto = process.argv[2] ?? "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf";
const caminhoDaNotoRegular = process.argv[3] ?? "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf";
const grego = tabela(caminhoDaNoto, "Δπ", t700.unidades, 0.92);
Object.assign(t700.saida, grego.saida);
Object.assign(t400.saida, tabela(caminhoDaNotoRegular, "Δπ", t700.unidades, 0.92).saida);
const sha256 = createHash("sha256").update(readFileSync(caminhoDaNoto)).digest("hex");
const sha256Regular = createHash("sha256").update(readFileSync(caminhoDaNotoRegular)).digest("hex");
const sha256Variavel = createHash("sha256").update(readFileSync(`${raiz}public/marca/Nunito[wght].ttf`)).digest("hex");

const linhas = (nome, dados) =>
  `export const ${nome}: Readonly<Record<string, readonly [number, string]>> = {\n${Object.entries(dados.saida)
    .map(([caractere, [avanco, d]]) => `  ${JSON.stringify(caractere)}: [${avanco}, ${JSON.stringify(d)}],`)
    .join("\n")}\n};\n`;

const conteudo = `/*
 * Gerado por scripts/gerar-glifos.mjs a partir do Nunito 400, 700 e 800 (SIL OFL 1.1, public/marca/OFL-Nunito.txt; o 400 vem da
 * fonte variável public/marca/Nunito[wght].ttf, sha256 ${sha256Variavel}, instanciada em wght 400) e, só para o Δ e o π, da Noto
 * Sans (Google, SIL OFL 1.1, public/marca/OFL-NotoSans.txt; Bold nos pesos 700 e 800, sha256 ${sha256}; Regular no 400, sha256
 * ${sha256Regular}). Não edite à mão.
 * Cada glifo é [avanço, caminho] em unidades da fonte (${t700.unidades} por em), com y para cima; o caminho só tem M, L, Q e Z.
 */
export const UNIDADES_POR_EM = ${t700.unidades};
/** Altura do centro do sinal de menos: onde ficam a barra de fração e os operadores. */
export const EIXO_MATEMATICO = ${Math.round(t700.eixo)};
export const ALTURA_MAIUSCULA = ${t700.alturaMaiuscula};
export const ALTURA_MINUSCULA = ${t700.alturaMinuscula};

${linhas("GLIFOS_400", t400)}
${linhas("GLIFOS_700", t700)}
${linhas("GLIFOS_800", t800)}`;

writeFileSync(`${raiz}packages/contratos/src/glifos.ts`, conteudo);
console.log(`glifos.ts: ${Object.keys(t400.saida).length} glifos em 400, ${Object.keys(t700.saida).length} em 700, ${Object.keys(t800.saida).length} em 800, ${conteudo.length} caracteres; eixo ${Math.round(t700.eixo)}, maiúscula ${t700.alturaMaiuscula}, minúscula ${t700.alturaMinuscula}`);
