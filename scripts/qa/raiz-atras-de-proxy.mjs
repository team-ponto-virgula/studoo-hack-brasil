// A raiz "/" atrás de um proxy HTTPS (o Traefik do Dokploy manda X-Forwarded-Proto e, em geral, o Host de fora): com e sem sessão, nos cabeçalhos de cada variação, tem de responder 200
// com o que é de cada um (a página de apresentação sem sessão, o app com sessão), nunca um 500, e sem reescrita do proxy do Next. O defeito que este roteiro guarda: com a reescrita de "/" para
// "/conheca" no proxy do Next, um X-Forwarded-Proto https fazia o Next repassar o pedido a "https://localhost:<porta>/conheca" (o servidor fala http) e a raiz dava 500 (EPROTO, "wrong version
// number"), sem sessão. Quem decide agora é a própria página (src/app/page.tsx), pelo cookie, no servidor.
//
// A entrada pela apresentação (STUDOO_ENTRADA_APRESENTACAO, desligada por padrão) decide o que é de quem NÃO tem sessão na raiz: ligada (=1), a página de apresentação em "/"; desligada,
// o redirecionamento ao /login (307, Location relativo), como era antes da página. Com sessão a raiz abre o app nos dois estados; "/conheca" e "/baixar" ficam sempre no ar.
//
// Uso, com o site de PRODUÇÃO no ar (numa cópia, para não apagar o `.next` do `next dev`): `npm run build && STUDOO_ENTRADA_APRESENTACAO=1 npx next start -p 3000 --hostname 127.0.0.1`
//   node scripts/qa/raiz-atras-de-proxy.mjs --base=http://127.0.0.1:3000 --entrada=1|0 [--origem-publica=https://127.0.0.1:3452]
// `--entrada` diz em que estado está o servidor (o padrão é o STUDOO_ENTRADA_APRESENTACAO deste processo). `--origem-publica` é o STUDOO_ORIGEM do servidor (se começar por https, o cookie
// de sessão é o "__Host-studoo-sessao"; senão, o "studoo-sessao"); o padrão é o STUDOO_ORIGEM deste processo.
// Dica: ligue o Next em 127.0.0.1 (`--hostname 127.0.0.1`) e deixe o Host dos pedidos em "localhost": era assim que a reescrita quebrava. Saída 0 se todas as variações passam, 1 se alguma falha.
import { request as pedidoHttp } from "node:http";

const argumento = (nome, padrao) => process.argv.find((s) => s.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? padrao;
const base = new URL(argumento("base", "http://127.0.0.1:3000"));
const origemPublica = argumento("origem-publica", process.env.STUDOO_ORIGEM ?? "");
const entradaLigada = argumento("entrada", process.env.STUDOO_ENTRADA_APRESENTACAO ?? "0") === "1";
const nomeDoCookie = origemPublica.startsWith("https:") ? "__Host-studoo-sessao" : "studoo-sessao";
// Uma sessão qualquer no formato certo (43 letras, números, "_" e "-"): a raiz decide só pelo cookie, sem ir ao banco.
const SESSAO = `${nomeDoCookie}=${"B".repeat(43)}`;
const porta = base.port || "80";

function buscar(caminho, cabecalhos) {
  return new Promise((resolver, rejeitar) => {
    const pedido = pedidoHttp({ host: base.hostname, port: base.port, path: caminho, method: "GET", headers: cabecalhos }, (resposta) => {
      const partes = [];
      resposta.on("data", (parte) => partes.push(parte));
      resposta.on("end", () => resolver({ status: resposta.statusCode ?? 0, corpo: Buffer.concat(partes).toString("utf8"), cabecalhos: resposta.headers }));
    });
    pedido.setTimeout(20_000, () => pedido.destroy(new Error("sem resposta em 20 s")));
    pedido.on("error", rejeitar);
    pedido.end();
  });
}

const variacoes = [
  ["sem cabeçalho de proxy", {}],
  ["X-Forwarded-Proto http", { "x-forwarded-proto": "http" }],
  ["X-Forwarded-Proto https", { "x-forwarded-proto": "https" }],
  ["https com Host localhost", { "x-forwarded-proto": "https", host: `localhost:${porta}` }],
  ["https com Host 127.0.0.1", { "x-forwarded-proto": "https", host: `127.0.0.1:${porta}` }],
  ["https com Host de fora", { "x-forwarded-proto": "https", host: "studoo.exemplo.com" }],
  ["https com X-Forwarded-Host", { "x-forwarded-proto": "https", "x-forwarded-host": "studoo.exemplo.com" }],
  ["https como o Traefik (Host, X-Forwarded-Host, -Port e -For)", { "x-forwarded-proto": "https", host: "studoo.exemplo.com", "x-forwarded-host": "studoo.exemplo.com", "x-forwarded-port": "443", "x-forwarded-for": "203.0.113.7" }],
];

let falhas = 0;
for (const [nome, cabecalhos] of variacoes) {
  const linha = { nome };
  try {
    const semSessao = await buscar("/", { ...cabecalhos });
    const comSessao = await buscar("/", { ...cabecalhos, cookie: SESSAO });
    const conheca = await buscar("/conheca", { ...cabecalhos });
    const baixar = await buscar("/baixar", { ...cabecalhos, "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0 Safari/537.36" });
    const login = await buscar("/login", { ...cabecalhos });
    const ehApresentacao = (resposta) => /class="cn-pagina"/.test(resposta.corpo);
    const erros = [];
    if (entradaLigada) {
      if (semSessao.status !== 200) erros.push(`"/" sem sessão deu ${semSessao.status}`);
      else if (!ehApresentacao(semSessao)) erros.push('"/" sem sessão não trouxe a página de apresentação');
      if (semSessao.cabecalhos.location) erros.push(`"/" sem sessão redirecionou para ${semSessao.cabecalhos.location}`);
    } else {
      if (semSessao.status !== 307) erros.push(`"/" sem sessão deu ${semSessao.status} em vez de 307 para o /login`);
      else if (semSessao.cabecalhos.location !== "/login") erros.push(`"/" sem sessão foi para ${semSessao.cabecalhos.location} em vez de /login`);
      if (ehApresentacao(semSessao)) erros.push('"/" sem sessão trouxe a página de apresentação com a entrada desligada');
      if (!/no-store/.test(String(semSessao.cabecalhos["cache-control"] ?? ""))) erros.push('o redirecionamento da raiz não é "no-store"');
    }
    if (semSessao.cabecalhos["x-middleware-rewrite"]) erros.push('"/" sem sessão passou por uma reescrita do proxy');
    if (comSessao.status !== 200) erros.push(`"/" com sessão deu ${comSessao.status}`);
    else if (ehApresentacao(comSessao)) erros.push('"/" com sessão trouxe a página de apresentação em vez do app');
    if (comSessao.cabecalhos["x-middleware-rewrite"]) erros.push('"/" com sessão passou por uma reescrita do proxy');
    if (conheca.status !== 200) erros.push(`"/conheca" deu ${conheca.status}`);
    else if (!ehApresentacao(conheca)) erros.push('"/conheca" não trouxe a página de apresentação');
    if (baixar.status !== 302 || !baixar.cabecalhos.location) erros.push(`"/baixar" deu ${baixar.status} (esperado 302 com Location)`);
    if (login.status !== 200) erros.push(`"/login" deu ${login.status}`);
    linha.erros = erros;
    const marca = (resposta) => `${resposta.status}${resposta.cabecalhos["x-middleware-rewrite"] ? " COM reescrita" : ""}`;
    linha.resumo = `"/" sem sessão ${marca(semSessao)}${semSessao.cabecalhos.location ? ` → ${semSessao.cabecalhos.location}` : ""} | com sessão ${marca(comSessao)} | /conheca ${conheca.status} | /baixar ${baixar.status} | /login ${login.status}`;
  } catch (erro) {
    linha.erros = [`pedido falhou: ${erro.message}`];
    linha.resumo = "sem resposta";
  }
  if (linha.erros.length > 0) falhas += 1;
  console.log(`${linha.erros.length === 0 ? "ok    " : "FALHOU"} ${linha.nome.padEnd(58)} ${linha.resumo}${linha.erros.length > 0 ? `  → ${linha.erros.join("; ")}` : ""}`);
}
console.log(falhas === 0 ? `\nTODAS AS ${variacoes.length} VARIAÇÕES PASSAM (entrada pela apresentação ${entradaLigada ? "LIGADA" : "DESLIGADA"}; cookie de sessão: ${nomeDoCookie})` : `\n${falhas} DE ${variacoes.length} VARIAÇÕES FALHAM (entrada pela apresentação ${entradaLigada ? "LIGADA" : "DESLIGADA"})`);
process.exit(falhas === 0 ? 0 : 1);
