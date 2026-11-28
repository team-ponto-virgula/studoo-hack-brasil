// A conta é exclusiva desta bancada. Só entram PORT, STUDOO_ORIGEM, STUDOO_EMAIL e STUDOO_SENHA.
import { setTimeout as esperar } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { candidatasErradas } from "../verificar-publicado.mjs";

export const temas = [
  "Culinária: receitas básicas", "História do Brasil para a prova", "Inglês para conversar em viagens",
  "Porcentagem no dia a dia", "Fotografia com o celular",
];
export function ambiente() {
  const { PORT, STUDOO_ORIGEM, STUDOO_EMAIL: email, STUDOO_SENHA: senha } = process.env;
  const base = "http://127.0.0.1:" + PORT;
  if (!/^\d{4,5}$/.test(PORT ?? "") || STUDOO_ORIGEM !== base || email !== "piloto-" + PORT + "@example.test" || !senha) {
    throw new Error("Use o piloto e a origem da bancada local da porta escolhida.");
  }
  return { base, email, senha };
}
function camposSimulados(valor, listar = []) {
  if (valor && typeof valor === "object") {
    for (const [chave, item] of Object.entries(valor)) {
      if (chave === "simulado") listar.push(item);
      else if (item && typeof item === "object") camposSimulados(item, listar);
    }
  }
  return listar;
}
export function conferirProvedor(dados, simulado) {
  if (!simulado && camposSimulados(dados).some(v => v !== false)) throw new Error("Resposta com simulação no modo real.");
}
export async function errar(pedir, id) {
  const rota = "/api/aprendizado/licoes/" + encodeURIComponent(id);
  const licao = await pedir("ler lição",rota);
  for (const [indice, e] of (licao.exercicios ?? [licao.exercicio]).entries()) {
    for (const resposta of candidatasErradas(e)) {
      const r = await pedir("responder exercício " + (indice + 1), rota + "/avaliar", "POST", { resposta, indice });
      if (r.correta === false) return;
    }
  }
  throw new Error("Nenhuma resposta válida resultou em erro pedagógico.");
}
export async function verificarTemas(modo) {
  if (!["real","simulada","barreira"].includes(modo)) throw new Error("Modo inesperado.");
  const { base, email, senha } = ambiente();
  const simulada = modo === "simulada";
  let cookie, anterior, basePlanos;
  let aceiteEmCurso = false;
  const criados = new Set();
  const uriConsentimento = "/api/privacidade/consentimento-ia";
  const planos = "/api/aprendizado/planos";
  const proposta = "/api/aprendizado/propostas";
  async function pedir(nome, rota, method = "GET", corpo, verificar = (r) => r.ok) {
    const inicio = performance.now();
    let status = 0, ok = false;
    try {
      const headers = { origin:base };
      if (cookie) headers.cookie = cookie;
      if (corpo !== undefined) headers["content-type"] = "application/json";
      const r = await fetch(base + rota, { method, redirect:"error", headers,
        body:corpo === undefined ? undefined : JSON.stringify(corpo), signal:AbortSignal.timeout(240_000) });
      status = r.status;
      if (rota === "/api/login" && r.ok) cookie = r.headers.getSetCookie()[0]?.split(";")[0];
      const json = status === 204 ? null : await r.json();
      if (!verificar(r,json)) throw new Error("Resposta inesperada.");
      if (r.ok) conferirProvedor(json, simulada);
      ok = true;
      return json;
    } finally { console.log(nome + " | HTTP " + status + " | " + (ok ? "ok" : "falhou") + " | " + Math.round(performance.now()-inicio) + " ms"); }
  }
  const limpar = async f => { try { await f(); } catch { process.exitCode=1; } };
  try {
    await pedir("login", "/api/login", "POST", {email,senha}, r => r.ok && Boolean(cookie));
    anterior = (await pedir("privacidade", "/api/privacidade", "GET", undefined,
      (r,j) => r.ok && Boolean(j.consentimentoIa?.versao) && j.consentimentoIa.necessario === !simulada)).consentimentoIa;
    basePlanos = new Set((await pedir("trilhas antes",planos)).map(p=>p.id));
    await pedir("revogar consentimento",uriConsentimento,"DELETE",undefined,(r,j)=>r.ok && j.consentimentoIa.aceitoEm === null);
    await pedir(simulada ? "sem aceite com IA falsa" : "bloqueio sem aceite",proposta,"POST",{objetivo:temas[0]},
      (r,j)=>simulada ? r.ok && Boolean(j.token) : r.status === 428 && j.codigo === "consentimento_ia");
    if (modo === "barreira") return;
    await pedir("aceitar versão vigente",uriConsentimento,"POST",{versao:anterior.versao},
      (r,j)=>r.ok && Boolean(j.consentimentoIa.aceitoEm) && j.consentimentoIa.versao === anterior.versao);
    for (const [i,tema] of temas.entries()) {
      const p = await pedir("propor " + tema,proposta,"POST",{objetivo:tema},(r,j)=>r.ok && Boolean(j.token)
        && (simulada || j.origem === "Conteúdo gerado pelo Studoo"));
      aceiteEmCurso = true;
      const plano = await pedir("aceitar " + tema,planos,"POST",{token:p.token},(r,j)=>r.ok && Boolean(j.id) && Boolean(j.fluxos?.[0]?.licoes?.[0]?.id));
      criados.add(plano.id);
      aceiteEmCurso = false;
      if (i===0) {
        const id=plano.fluxos[0].licoes[0].id;
        await errar(pedir,id);
        await pedir("criar ponte e verificar simulado=" + simulada,"/api/estudio/licoes/" + encodeURIComponent(id) + "/ponte","POST",{},
          (r,j)=>r.ok && Boolean(j.ponte?.exercicio?.enunciado) && j.ponte.simulado === simulada);
      }
    }
  } finally {
    if (cookie) {
      if (aceiteEmCurso && basePlanos) await limpar(async () => {
        // O servidor pode terminar um aceite depois da queda da conexão. Esta conta é exclusiva da porta.
        for (let i=0; i<16; i++) {
          const novos=(await pedir("reconciliar aceite",planos)).filter(p=>!basePlanos.has(p.id) && !criados.has(p.id));
          if (novos.length>1) throw new Error("Conta usada por outro percurso.");
          if (novos.length===1) { criados.add(novos[0].id); break; }
          await esperar(2000);
        }
      });
      for (const id of criados) await limpar(()=>pedir("apagar trilha criada",planos + "/" + encodeURIComponent(id),"DELETE"));
      if (basePlanos) await limpar(()=>pedir("conferir limpeza",planos,"GET",undefined,
        (r,j)=>r.ok && j.length===basePlanos.size && j.every(p=>basePlanos.has(p.id))));
      if (anterior) await limpar(()=>pedir("restaurar escolha inicial",uriConsentimento,anterior.aceitoEm?"POST":"DELETE",
        anterior.aceitoEm?{versao:anterior.versao}:undefined,(r,j)=>r.ok && Boolean(j.consentimentoIa.aceitoEm)===Boolean(anterior.aceitoEm)));
      await limpar(()=>pedir("encerrar sessão","/api/sessao","DELETE"));
    }
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const modo = process.argv[2] === undefined ? "real" : process.argv[2].replace(/^--/,"");
  try { await verificarTemas(modo); } catch { console.error("Ensaio incompleto. Consulte a última etapa acima."); process.exitCode=1; }
}
