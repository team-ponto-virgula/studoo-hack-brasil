import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { carregarLogo, carregarStu, raiz, resposta } from "./base";

/** Uma captura do app (WebP do site) em PNG e na largura pedida, como data URL: o cartão do link não lê WebP. */
async function telaEmPng(arquivo: string, largura: number): Promise<string | null> {
  try {
    const png = await sharp(await readFile(join(raiz, "public", arquivo))).resize({ width: largura }).png({ compressionLevel: 9 }).toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * A prévia do link da página de apresentação (`/conheca` e a raiz de quem não entrou, spec 18): o herói da página, com a marca, o título, uma frase do
 * subtítulo, o celular com a trilha pronta e o Stu. O texto e a captura vêm de quem chama (os mesmos da página); aqui só o desenho. Sem número nem
 * promessa que a página não faça. Não lê o banco, então não conta no limitador: é a mesma imagem para todo mundo, gerada uma vez no build. O PNG sai
 * com paleta (256 cores, a melhor qualidade): o desenho é chapado, e o arquivo fica pequeno para o WhatsApp e os outros aplicativos mostrarem a prévia.
 */
export async function imagemDaApresentacao(d: { linhasDoTitulo: readonly string[]; linha: string; telaDoCelular: string; plataforma: "iphone" | "android"; alturaDaTela: number; larguraDaTela: number }) {
  const [marca, desenho, tela] = await Promise.all([carregarLogo(), carregarStu(), telaEmPng(d.telaDoCelular, 560)]);
  const moldura = 8;
  const larguraDoCelular = 210;
  const larguraInterna = larguraDoCelular - 2 * moldura;
  const alturaInterna = Math.round((larguraInterna * d.alturaDaTela) / d.larguraDaTela);
  const imagem = await resposta(
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#fffdf8", overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", left: 628, top: 140, width: 494, height: 339, borderRadius: 18, borderLeft: "9px solid #97ace0", background: "#edf2ff", boxShadow: "3px 10px 0 #a4b6ee", transform: "rotate(-5deg)" }}>
        {[45, 94, 143, 192, 241, 290].map(y => <div key={y} style={{ position: "absolute", top: y, width: "100%", height: 1, background: "#c4d2eb" }} />)}
        <div style={{ position: "absolute", left: 52, height: "100%", width: 2, background: "#ebadb8" }} />
        <div style={{ position: "absolute", right: 32, top: -9, width: 115, height: 32, background: "#f5d88f", transform: "rotate(12deg)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 64, top: 75, width: 512 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {marca ? <img src={marca} width={166} height={55} alt="" /> : <span style={{ fontFamily: "Quicksand", fontSize: 48, color: "#0b1b5c" }}>studoo</span>}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 52 }}>
          {d.linhasDoTitulo.map((linhaDoTitulo, indice) => (
            <span key={linhaDoTitulo} style={{ fontFamily: "Nunito", fontWeight: 800, fontSize: 76, lineHeight: 1.05, letterSpacing: -2, color: indice === 0 ? "#11205a" : "#2858ed" }}>{linhaDoTitulo}</span>
          ))}
        </div>
        <span style={{ marginTop: 30, fontFamily: "Nunito", fontWeight: 700, fontSize: 29, lineHeight: 1.34, color: "#42507a", maxWidth: 610 }}>{d.linha}</span>
      </div>
      <div style={{ display: "flex", position: "absolute", left: 671, top: 68, width: larguraDoCelular, transform: "rotate(-9deg)", borderRadius: 32, background: "#0b1b5c", padding: moldura, boxShadow: "0 24px 48px rgba(11, 27, 92, 0.22)" }}>
        <div style={{ display: "flex", position: "relative", width: larguraInterna, height: alturaInterna, borderRadius: 25, overflow: "hidden", background: "#ffffff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {tela && <img src={tela} width={larguraInterna} height={alturaInterna} alt="" />}
          {d.plataforma === "iphone"
            ? <div style={{ display: "flex", position: "absolute", top: 10, left: "50%", marginLeft: -26, width: 52, height: 12, borderRadius: 12, background: "#0b1b5c" }} />
            : <div style={{ display: "flex", position: "absolute", top: 8, left: "50%", marginLeft: -6, width: 12, height: 12, borderRadius: 12, background: "#0b1b5c" }} />}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {desenho && <img src={desenho} width={282} height={275} style={{ position: "absolute", left: 852, bottom: 128 }} alt="" />}
    </div>,
  );
  const png = await sharp(Buffer.from(await imagem.arrayBuffer())).png({ palette: true, quality: 100, effort: 10, compressionLevel: 9 }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } });
}
