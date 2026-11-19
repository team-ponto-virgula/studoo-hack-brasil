import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import sharp from "sharp";
import {
  COR_DO_TEMA,
  FUNDO_DA_COR,
  inicialDoNome,
  svgCapaTrilha,
  type CorPerfil,
  type Tema,
} from "@studoo/contratos";
import { mensagens } from "@studoo/contratos/experiencia";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { lerFoto } from "@/servidor/compartilhar/foto";
import { limitarPublico } from "@/servidor/compartilhar/servico";

/*
 * Imagens de prévia do link (Open Graph, 1200×630) para /t e /p (spec 10, etapa C1). Desenhadas pelo `next/og` com as
 * fontes da marca em WOFF estático (public/marca/og, licença OFL), então saem iguais em qualquer máquina, inclusive no
 * contêiner sem fontes do sistema. Sem e-mail; contam no limitador das páginas públicas.
 */

export const TAMANHO_OG = { width: 1200, height: 630 } as const;
const raiz = process.cwd();

let fontes: Promise<{ name: string; data: Buffer; weight: 700 | 800; style: "normal" }[]> | null = null;
function carregarFontes() {
  fontes ??= Promise.all([
    readFile(join(raiz, "public/marca/og/quicksand-latin-700-normal.woff")).then((data) => ({ name: "Quicksand", data, weight: 700 as const, style: "normal" as const })),
    readFile(join(raiz, "public/marca/og/nunito-latin-700-normal.woff")).then((data) => ({ name: "Nunito", data, weight: 700 as const, style: "normal" as const })),
    readFile(join(raiz, "public/marca/og/nunito-latin-800-normal.woff")).then((data) => ({ name: "Nunito", data, weight: 800 as const, style: "normal" as const })),
  ]);
  return fontes;
}

let logo: Promise<string | null> | null = null;
/** O logo com o sorriso (o PNG que está dentro do SVG da marca), como data URL. */
function carregarLogo() {
  logo ??= readFile(join(raiz, "public/marca/logo-com-sorriso.svg"), "utf8")
    .then((svg) => /href="(data:image\/png;base64,[^"]+)"/.exec(svg)?.[1] ?? null)
    .catch(() => null);
  return logo;
}

const seloDemo = () => (
  <span style={{ display: "flex", alignSelf: "flex-start", marginTop: 14, padding: "6px 18px", borderRadius: 999, border: "2px dashed #c9a227", background: "#fffaea", color: "#6b4a00", fontFamily: "Nunito", fontWeight: 800, fontSize: 24 }}>
    {mensagens.comunidade.perfilDemo}
  </span>
);

let stu: Promise<string | null> | null = null;
function carregarStu() {
  stu ??= readFile(join(raiz, "public/marca/stu-oi.svg")).then((svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`).catch(() => null);
  return stu;
}

const dataSvg = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** A foto (WebP no banco) em PNG para o desenho, ou null. */
async function fotoPng(token: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const png = await sharp(await lerFoto(token, "512")).resize(256, 256).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Conta no limitador das páginas públicas; estourado, a imagem sai genérica (sem ler nada do banco). */
export async function dentroDoLimite(): Promise<boolean> {
  try {
    await limitarPublico(enderecoRede(new Request("http://studoo.local/", { headers: await headers() })));
    return true;
  } catch {
    return false;
  }
}

function Avatar({ nome, cor, foto, lado }: { nome: string; cor: CorPerfil; foto: string | null; lado: number }) {
  return foto
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={foto} width={lado} height={lado} style={{ borderRadius: lado, border: `${Math.round(lado / 16)}px solid #fff` }} alt="" />
    : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: lado, height: lado, borderRadius: lado, background: FUNDO_DA_COR[cor], color: "#fff", fontFamily: "Quicksand", fontSize: lado * 0.45, border: `${Math.round(lado / 16)}px solid #fff` }}>{inicialDoNome(nome)}</div>;
}

async function rodape(texto: string) {
  const marca = await carregarLogo();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: "auto" }}>
      <span style={{ fontFamily: "Nunito", fontWeight: 700, fontSize: 26, color: "#5e6a85" }}>{texto}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {marca ? <img src={marca} width={213} height={70} alt="" /> : <span style={{ fontFamily: "Quicksand", fontSize: 48, color: "#1b2a5e" }}>studoo</span>}
    </div>
  );
}

/** Sem cache: o proxy põe `no-store` nas rotas de /t e /p, inclusive aqui (conferido no site pelo Lead). */
const resposta = async (conteudo: React.ReactElement) => new ImageResponse(conteudo, { ...TAMANHO_OG, fonts: await carregarFontes() });

/** A imagem genérica (link encerrado, perfil indisponível ou limite estourado): só a marca e o convite. */
export async function imagemGenerica() {
  const desenho = await carregarStu();
  return resposta(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: 64, background: "#eef3ff", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {desenho && <img src={desenho} width={260} height={286} style={{ position: "absolute", right: 80, top: 70 }} alt="" />}
      <span style={{ fontFamily: "Quicksand", fontSize: 72, color: "#1b2a5e", maxWidth: 760, lineHeight: 1.1 }}>Aprenda qualquer coisa, uma lição por vez.</span>
      {await rodape("Studoo")}
    </div>,
  );
}

/** /t/<código>: capa do tema à esquerda; tema, título, quem fez e a contagem à direita; a marca embaixo. */
export async function imagemDaTrilha(t: { codigo: string; titulo: string; tema: Tema | null; totalLicoes: number; dono: { nome: string; cor: CorPerfil; foto: string | null; demo?: true } }) {
  const foto = await fotoPng(t.dono.foto);
  const tamanhoTitulo = t.titulo.length > 60 ? 50 : t.titulo.length > 34 ? 60 : 70;
  return resposta(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", position: "relative", width: 420, height: "100%", background: COR_DO_TEMA[t.tema ?? "outros"] }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataSvg(svgCapaTrilha(t.codigo, t.tema).replace('viewBox="0 0 320 160"', 'viewBox="80 0 160 160"'))} width={420} height={630} style={{ objectFit: "cover" }} alt="" />
        <div style={{ display: "flex", position: "absolute", left: 40, bottom: 40 }}><Avatar nome={t.dono.nome} cor={t.dono.cor} foto={foto} lado={150} /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 56px 48px" }}>
        {t.tema && (
          <span style={{ display: "flex", alignSelf: "flex-start", padding: "8px 22px", borderRadius: 999, background: "#eef3ff", color: "#1b2a5e", fontFamily: "Nunito", fontWeight: 800, fontSize: 26 }}>
            {mensagens.temas[t.tema]}
          </span>
        )}
        <span style={{ marginTop: 24, fontFamily: "Quicksand", fontSize: tamanhoTitulo, lineHeight: 1.12, color: "#1b2a5e", letterSpacing: -1.5 }}>{t.titulo}</span>
        <span style={{ marginTop: 22, fontFamily: "Nunito", fontWeight: 800, fontSize: 32, color: "#3858d6" }}>{mensagens.comunidade.por(t.dono.nome)}</span>
        {t.dono.demo && seloDemo()}
        {await rodape(mensagens.compartilhar.totalLicoes(t.totalLicoes))}
      </div>
    </div>,
  );
}

/** /p/<id>: faixa na cor do perfil com a foto; nome, resumo e o alcance; a marca embaixo. */
export async function imagemDoPerfil(p: { nome: string; cor: CorPerfil; foto: string | null; resumo: string | null; trilhas: number; pessoas: number; demo?: boolean }) {
  const foto = await fotoPng(p.foto);
  return resposta(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fff" }}>
      <div style={{ display: "flex", width: "100%", height: 200, background: FUNDO_DA_COR[p.cor] }} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 64px 48px" }}>
        <div style={{ display: "flex", marginTop: -110 }}><Avatar nome={p.nome} cor={p.cor} foto={foto} lado={210} /></div>
        <span style={{ marginTop: 18, fontFamily: "Quicksand", fontSize: 64, color: "#1b2a5e", letterSpacing: -1.5 }}>{p.nome}</span>
        {p.demo && seloDemo()}
        {p.resumo && <span style={{ marginTop: 8, fontFamily: "Nunito", fontWeight: 700, fontSize: 30, color: "#1b2a5e", maxWidth: 1000, lineHeight: 1.3 }}>{p.resumo.length > 110 ? `${p.resumo.slice(0, 108)}…` : p.resumo}</span>}
        {await rodape(mensagens.perfil.alcanceItens(p.trilhas, p.pessoas, { semZeros: true }).join(" · "))}
      </div>
    </div>,
  );
}
