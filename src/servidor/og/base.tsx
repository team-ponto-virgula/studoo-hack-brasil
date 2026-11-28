import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/*
 * O que as imagens de prévia do link (Open Graph, 1200×630) têm em comum: o tamanho, as fontes da marca em WOFF estático (public/marca/og, licença OFL, então
 * saem iguais em qualquer máquina, inclusive no contêiner sem fontes do sistema), o logo e o Stu. Este módulo NÃO toca no banco: a imagem da página de apresentação
 * sai dele sem precisar do cliente do banco (nem no teste, nem no build). Os cartões de /t e /p (cartao.tsx) usam o mesmo.
 */

export const TAMANHO_OG = { width: 1200, height: 630 } as const;
export const raiz = process.cwd();

let fontes: Promise<{ name: string; data: Buffer; weight: 700 | 800; style: "normal" }[]> | null = null;
export function carregarFontes() {
  fontes ??= Promise.all([
    readFile(join(raiz, "public/marca/og/quicksand-latin-700-normal.woff")).then((data) => ({ name: "Quicksand", data, weight: 700 as const, style: "normal" as const })),
    readFile(join(raiz, "public/marca/og/nunito-latin-700-normal.woff")).then((data) => ({ name: "Nunito", data, weight: 700 as const, style: "normal" as const })),
    readFile(join(raiz, "public/marca/og/nunito-latin-800-normal.woff")).then((data) => ({ name: "Nunito", data, weight: 800 as const, style: "normal" as const })),
  ]);
  return fontes;
}

let logo: Promise<string | null> | null = null;
/** O logo com o sorriso (o PNG que está dentro do SVG da marca), como data URL. */
export function carregarLogo() {
  logo ??= readFile(join(raiz, "public/marca/logo-com-sorriso.svg"), "utf8")
    .then((svg) => /href="(data:image\/png;base64,[^"]+)"/.exec(svg)?.[1] ?? null)
    .catch(() => null);
  return logo;
}

let stu: Promise<string | null> | null = null;
export function carregarStu() {
  // O mascote oficial (spec 13, §A2): a acolhida em PNG de 480 (o cartão do link não lê WebP e não anima).
  stu ??= readFile(join(raiz, "public/marca/stu/stu-acolhida-480.png")).then((png) => `data:image/png;base64,${png.toString("base64")}`).catch(() => null);
  return stu;
}

/** Sem cache: o proxy põe `no-store` nas rotas de /t e /p, inclusive aqui (conferido no site pelo Lead). */
export const resposta = async (conteudo: React.ReactElement) => new ImageResponse(conteudo, { ...TAMANHO_OG, fonts: await carregarFontes() });
