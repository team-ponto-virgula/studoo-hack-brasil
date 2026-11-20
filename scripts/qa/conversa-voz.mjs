// Use a bancada local e o arquivo piloto.env. O navegador sempre recebe uma fala sintética, em laço com pausas.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { setTimeout as esperar } from "node:timers/promises";
import { ambiente, conferirProvedor, errar } from "./cinco-temas.mjs";
const { base, email, senha } = ambiente();
const simulada = process.argv.includes("--simulada");
const saida = process.argv.find(s=>s.startsWith("--saida="))?.slice(8) || ".studoo-local/voz-qa-" + Date.now();
const localRequire = createRequire(import.meta.url);
const cache = join(homedir(),".cache","ms-playwright");
async function navegador() {
  const interno = resolve(".studoo-local/navegador-qa/node_modules/playwright-core");
  let pw;
  if (existsSync(interno)) pw = localRequire(interno);
  else {
    try { pw = localRequire("playwright-core"); }
    catch { throw new Error("Falta o playwright-core do roteiro; veja o LEIA-ME."); }
  }
  const binarios = (await readdir(cache)).filter(p=>/^chromium-\d+$/.test(p)).sort((a,b)=>Number(b.split("-")[1])-Number(a.split("-")[1]));
  const chrome = binarios.map(p=>join(cache,p,"chrome-linux64","chrome")).find(existsSync);
  if (!chrome) throw new Error("Falta o Chromium de ensaio.");
  const audio=resolve("scripts/qa/explicacao-sintetica.wav");
  if ((await readFile(audio)).toString("ascii",0,4)!=="RIFF") throw new Error("Falta o WAV da fala sintética.");
  const env={PATH:process.env.PATH, HOME:homedir(), LANG:"C.UTF-8"};
  if (existsSync("/opt/OpenBot/app/chrome-sandbox")) env.CHROME_DEVEL_SANDBOX="/opt/OpenBot/app/chrome-sandbox";
  return pw.chromium.launch({headless:true,chromiumSandbox:true,executablePath:chrome,env,args:[
    "--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--use-file-for-fake-audio-capture="+audio,"--mute-audio"
  ]});
}
async function preencherExercicio(pagina) {
  const q = pagina.locator('.aula-quadro[data-etapa="exercicio"]');
  const tipo = await q.getAttribute("data-tipo");
  if (tipo==="multipla_escolha") await q.locator(".opcoes label").last().click();
  else if (tipo==="verdadeiro_falso") {
    await q.locator('label:has(input[name="vf-valor"])').last().click();
    await q.locator('label:has(input[name="vf-justificativa"])').last().click();
  } else if (tipo==="ordenar") {
    const b=q.locator(".ordenar-cartao__corpo"); await b.first().click(); await b.last().click();
  } else if (tipo==="associar") {
    const g=q.locator('.associar [role="group"]');
    const esquerda=g.nth(0).getByRole("button"), direita=g.nth(1).getByRole("button");
    for (let i=0;i<await esquerda.count();i++){ await esquerda.nth(i).click(); await direita.nth(i).click(); }
  } else if (tipo==="aberta") await q.locator("textarea").fill("Para comparar frações, separo partes iguais e considero quanto do inteiro cada parte representa. ".repeat(7));
  else if (tipo==="lacuna") await q.locator('input[type="text"]').fill("resposta sintética");
  else throw new Error("Formato de exercício desconhecido.");
}
async function chegarAoExplique(pagina) {
  const detalhe = pagina.locator("details.estudio-ensino summary");
  for(let passo=0;passo<48;passo++) {
    if (await detalhe.count()) { await detalhe.click(); return; }
    const rodape=pagina.locator(".aula-rodape__acoes");
    if (!(await rodape.count())) { await esperar(300); continue; }
    const verificar=rodape.locator('button[form="resposta-licao"]');
    if(await verificar.count()){
      await preencherExercicio(pagina);
      await Promise.all([pagina.waitForResponse(r=>r.url().endsWith("/avaliar")&&r.request().method()==="POST"),verificar.click()]);
      await rodape.locator('button[form="resposta-licao"]').waitFor({state:"detached"});
    } else { await rodape.getByRole("button").last().click(); }
    await esperar(180);
  }
  throw new Error("A lição não chegou ao último exercício.");
}
const relatorio={ modo:simulada?"simulada":"real", inicio:new Date().toISOString(), navegador:null, etapas:[], eventos:{}, legendas:[], segundos:null, limite:null, ensinar:null, ponte:null };
const etapa = nome => { relatorio.etapas.push({etapa:nome,ms:Math.round(performance.now()-inicio)}); console.log(nome); };
const inicio=performance.now();
let browser, contexto, id, anterior, logado=false;
async function api(nome,rota,method="GET",data) {
  const r=await contexto.request.fetch(base+rota,{method, data, headers:{origin:base},timeout:240000,maxRedirects:0});
  if(!r.ok()) throw new Error(nome + " HTTP " + r.status());
  const json=r.status()===204?null:await r.json();
  conferirProvedor(json,simulada);
  return json;
}
async function executar() {
  await mkdir(saida,{recursive:true,mode:0o700});
  browser=await navegador(); relatorio.navegador=browser.version();
  contexto=await browser.newContext({viewport:{width:390,height:844},locale:"pt-BR", reducedMotion:"reduce"});
  await contexto.grantPermissions(["microphone"],{origin:base});
  await contexto.addInitScript(()=>{
    window.qaVoz={eventos:{},legendas:[],segundos:0};
    const criar=RTCPeerConnection.prototype.createDataChannel;
    RTCPeerConnection.prototype.createDataChannel=function(...args){
      const canal=criar.apply(this,args);
      canal.addEventListener("message",({data})=>{
        try { const {type}=JSON.parse(data); if(typeof type==="string" && /^[a-z0-9_.-]{1,100}$/.test(type)){
          const e=window.qaVoz.eventos; e[type]=(e[type]??0)+1;
        } } catch {}
      });
      return canal;
    };
    const turnos=new Map();
    new MutationObserver(()=>{
      for(const el of document.querySelectorAll(".voz-ao-vivo-turno")){
        const autor=el.dataset.autor,texto=el.querySelector("span")?.textContent.trim();
        if(texto && ["usuario","stu"].includes(autor)) turnos.set(el,{autor,texto:texto.slice(0,3000)});
      }
      window.qaVoz.legendas=[...turnos.values()].slice(-200);
      const tempo=document.querySelector(".voz-ao-vivo-tempo");
      const m=tempo?.textContent.match(/(\d+):(\d+)\s*\//);
      if(m) window.qaVoz.segundos=Math.max(window.qaVoz.segundos,60*Number(m[1])+Number(m[2]));
    }).observe(document,{subtree:true,childList:true,characterData:true});
  });
  const p=await contexto.newPage(); p.setDefaultTimeout(12000);
  await p.goto(base+"/login"); await p.locator('input[name="email"]').fill(email);
  await p.locator('input[name="senha"]').fill(senha);
  await Promise.all([p.waitForURL(base+"/"),p.locator("form button[type=submit]").click()]);
  logado=true; etapa("Login na interface");
  const cfg=await api("configuração pública","/api/auth/config");
  if (simulada ? cfg.ia!=="falsa" : !cfg.vozAoVivo || cfg.ia==="falsa") throw new Error("Configuração incompatível com o modo escolhido.");
  anterior=(await api("privacidade","/api/privacidade")).consentimentoIa;
  if(anterior.necessario && !anterior.aceitoEm) await api("consentimento","/api/privacidade/consentimento-ia","POST",{versao:anterior.versao});
  const antes=await api("trilhas antes","/api/aprendizado/planos");
  if(antes.length) throw new Error("A conta de ensaio já tem uma trilha. Termine o percurso que a criou.");
  const pr=await api("proposta","/api/aprendizado/propostas","POST",{objetivo:"Frações"});
  const plano=await api("aceitar trilha","/api/aprendizado/planos","POST",{token:pr.token});
  id=plano.id;
  const l=plano.fluxos[0].licoes[0].id;
  await errar(api,l);
  relatorio.ponte=await api("ponte","/api/estudio/licoes/"+encodeURIComponent(l)+"/ponte","POST",{});
  if(relatorio.ponte?.ponte?.simulado!==simulada) throw new Error("Origem inesperada da ponte.");
  etapa("Exercício errado e JSON da ponte");
  await p.goto(base);
  const comecar=p.locator(".caminho-no__alvo").first();
  await comecar.waitFor({state:"visible"}); etapa("Mapa encontrado"); await comecar.click(); etapa("Mapa e primeira lição abertos");
  await chegarAoExplique(p); etapa("Trilha, lição e Explique abertos na interface");
  const ensinar=p.waitForResponse(r=>r.url().endsWith("/ensinar") && r.request().method()==="POST",{timeout:simulada?30000:300000});
  ensinar.catch(()=>{});
  if(simulada) {
    if(await p.getByRole("button",{name:"Conversar com o Stu"}).count()) throw new Error("A bancada simulada ofereceu uma chamada real.");
    await p.locator("#ensino-texto").fill("Para comparar frações, divido o inteiro em partes iguais e comparo as partes.");
    await p.getByRole("button",{name:"Enviar minha explicação"}).click();
    etapa("Alternativa por texto com IA falsa");
  } else {
    await p.getByRole("button",{name:"Conversar com o Stu"}).click();
    const abriu=p.waitForResponse(r=>r.url().endsWith("/voz-ao-vivo")&&r.request().method()==="POST",{timeout:60000});
    const encerrou=p.waitForResponse(r=>r.url().endsWith("/voz-ao-vivo/encerrar"),{timeout:290000});
    encerrou.catch(()=>{});
    await p.getByRole("button",{name:"Começar conversa"}).click();
    const r=await abriu;
    if(r.status()!==200) throw new Error("Negociação de voz HTTP "+r.status());
    // O Studoo devolve JSON com HTTP 200. Da sessão, apenas o limite vai para o relatório.
    const sessao=await r.json();
    if (!sessao.chamadaId || !sessao.sdpResposta?.trim()) throw new Error("Sessão de voz incompleta.");
    const limite=sessao.limiteSegundos;
    if(!Number.isFinite(limite)||limite<=0) throw new Error("A chamada não informou o limite.");
    relatorio.limite=limite; const t=performance.now();
    etapa("Conversa aberta; microfone sintético");
    const fim=await encerrou; relatorio.segundos=(performance.now()-t)/1000;
    if(!fim.ok() || relatorio.segundos<limite-2) throw new Error("A chamada não chegou ao limite.");
    etapa("Encerramento automático no limite");
  }
  const e=await ensinar;
  if(!e.ok()) throw new Error("Ensinar HTTP "+e.status());
  relatorio.ensinar=await e.json();
  if(relatorio.ensinar.simulado!==simulada) throw new Error("Origem inesperada do ensino.");
  etapa("JSON da avaliação da explicação");
  const obs=await p.evaluate(()=>window.qaVoz);
  relatorio.eventos=obs.eventos; relatorio.legendas=obs.legendas;
  if(!simulada && (!Object.keys(obs.eventos).length || !["stu","usuario"].every(autor=>obs.legendas.some(t=>t.autor===autor)))) {
    throw new Error("Faltaram eventos do canal ou legendas dos dois participantes.");
  }
  relatorio.ok=true;
}
try { await executar(); }
catch(erro) {
  // Falha sem despejar a pilha de automação (ela pode incluir valores de formulários).
  const msg=String(erro.message).split("\n")[0];
  relatorio.ok=false; relatorio.falha=logado ? msg.slice(0,150) : "Falha ao abrir o navegador ou entrar na bancada.";
  if (logado) {
    relatorio.chamada=String(erro.message).split("\n").slice(1).filter(s=>/locator|intercepts|visible|stable|scroll|outside|disabled/.test(s)).slice(-7);
    const p=contexto.pages().at(-1);
    relatorio.telaNaFalha=await p?.locator("main h1, main h2, main button").allTextContents().catch(()=>[]);
    relatorio.telaNaFalha=relatorio.telaNaFalha?.map(s=>s.trim().slice(0,100)).filter(Boolean).slice(0,24);
  }
  console.error(relatorio.falha); process.exitCode=1;
} finally {
  if(contexto){
    const p=contexto.pages().at(-1);
    const obs=await p?.evaluate(()=>window.qaVoz).catch(()=>null);
    if(obs){ relatorio.eventos=obs.eventos; relatorio.legendas=obs.legendas; }
    for(const f of [
      ()=>id && api("apagar trilha","/api/aprendizado/planos/"+encodeURIComponent(id),"DELETE"),
      ()=>anterior?.necessario && !anterior.aceitoEm && api("restaurar privacidade","/api/privacidade/consentimento-ia","DELETE"),
      ()=>logado && api("encerrar sessão","/api/sessao","DELETE")
    ]) try {await f();} catch { relatorio.ok=false; relatorio.limpeza="incompleta"; process.exitCode=1; }
  }
  await browser?.close();
  await writeFile(join(saida,"voz.json"),JSON.stringify(relatorio,null,2)+"\n",{mode:0o600});
}
