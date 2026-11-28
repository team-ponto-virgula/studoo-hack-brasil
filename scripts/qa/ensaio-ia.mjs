// No diretório da candidata compilada: node scripts/qa/ensaio-ia.mjs subir|parar PORTA.
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, closeSync, openSync } from "node:fs";
import { access, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { setTimeout as esperar } from "node:timers/promises";
import pg from "pg";

const [acao, numero] = process.argv.slice(2);
const porta = Number(numero);
if (!["subir", "parar"].includes(acao) || !/^\d{4,5}$/.test(numero ?? "") || porta > 65535) {
  console.error("Uso: node scripts/qa/ensaio-ia.mjs subir|parar PORTA (1024–65535).");
  process.exit(2);
}
if (porta < 1024) process.exit(2);
process.umask(0o077);
const raiz = await realpath(".");
const base = resolve(".studoo-local", "ensaio-ia-" + porta);
const dados = join(base, "pgdata");
const marca = join(base, "dono.json");
const local = "127.0.0.1";
const origem = "http://" + local + ":" + porta;
const bin = resolve("node_modules/@embedded-postgres/linux-x64/native/bin");
const sistema = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8" };
const salvar = (arquivo, texto) => writeFile(join(base, arquivo), texto, { mode: 0o600 });
const envTexto = obj => Object.entries(obj).map(([k,v]) => k + "=" + v).join("\n") + "\n";

async function portaLivre(preferida = 0) {
  const s = createServer();
  await new Promise((ok, falhar) => s.once("error", falhar).listen(preferida, local, ok));
  const escolhida = s.address().port;
  await new Promise(ok => s.close(ok));
  return escolhida;
}
function rodar(programa, args, env = sistema) {
  execFileSync(programa, args, { env, stdio: "ignore", timeout: 90_000 });
}
// /proc registra a hora de nascimento do processo mesmo quando seu título muda para next-server.
async function nascimento(pid) {
  try {
    const stat = await readFile("/proc/" + pid + "/stat", "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
  } catch (erro) { if (erro.code === "ENOENT") return null; throw erro; }
}
async function parar() {
  const dono = JSON.parse(await readFile(marca, "utf8"));
  if (dono.raiz !== raiz || dono.porta !== porta || await realpath(base) !== base) throw new Error("Diretório de outra bancada.");
  if (dono.pid && dono.nascimento === await nascimento(dono.pid)) {
    if (await realpath("/proc/" + dono.pid + "/cwd") !== raiz) throw new Error("Processo de outra bancada.");
    process.kill(dono.pid, "SIGTERM");
    for (let i=0; i<100 && await nascimento(dono.pid) === dono.nascimento; i++) {
      // Um filho órfão pode continuar em /proc como zumbi mesmo com os sockets fechados.
      const st = await readFile("/proc/" + dono.pid + "/stat", "utf8").catch(() => "");
      if (st.slice(st.lastIndexOf(")") + 2).startsWith("Z ")) break;
      await esperar(100);
    }
    await portaLivre(porta);
  }
  if (existsSync(join(dados, "postmaster.pid"))) rodar(join(bin,"pg_ctl"), ["-D", dados, "-m", "fast", "-w", "stop"]);
  await rm(base, { recursive: true });
}
async function subir() {
  await access(".next/BUILD_ID");
  await portaLivre(porta);
  await mkdir(resolve(".studoo-local"), { recursive: true, mode: 0o700 });
  await mkdir(base, { mode: 0o700 });
  const dono = { raiz, porta };
  await salvar("dono.json", JSON.stringify(dono));
  try {
    const dbPort = await portaLivre();
    const senhaPg = randomBytes(24).toString("hex");
    const piloto = { PORT: String(porta), STUDOO_ORIGEM: origem, STUDOO_EMAIL: "piloto-" + porta + "@example.test", STUDOO_SENHA: randomBytes(24).toString("base64url") };
    const banco = { ...piloto, DATABASE_URL: "postgresql://studoo:" + senhaPg + "@" + local + ":" + dbPort + "/studoo_local",
      STUDOO_DOMINIO_EMAIL: "example.test", STUDOO_CHAVE_ASSINATURA: randomBytes(32).toString("hex"), IA: "falsa", EMAIL: "falso" };
    await salvar("piloto.env", envTexto(piloto));
    await salvar("banco.env", envTexto(banco));
    await salvar("pg.pw", senhaPg + "\n");
    rodar(join(bin,"initdb"), ["-D", dados, "-U", "studoo", "-A", "scram-sha-256", "--pwfile=" + join(base,"pg.pw"), "--encoding=UTF8", "--locale=C"]);
    await rm(join(base,"pg.pw"));
    rodar(join(bin,"pg_ctl"), ["-D", dados, "-l", join(base,"postgres.log"), "-o", "-h 127.0.0.1 -p " + dbPort + " -c shared_buffers=16MB -c max_connections=30", "-w", "start"]);
    const admin = new pg.Client({ host: local, port: dbPort, user: "studoo", database: "postgres", password: senhaPg });
    try { await admin.connect(); await admin.query("CREATE DATABASE studoo_local"); } finally { await admin.end(); }
    const localEnv = { ...sistema, ...banco, NEXT_TELEMETRY_DISABLED:"1" };
    rodar(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], localEnv);
    rodar(process.execPath, ["--import", "tsx", "prisma/seed.ts"], localEnv);
    const extras = Object.fromEntries(Object.entries(process.env).filter(([k]) =>
      k === "IA" || /^(?:OPENAI_|STUDOO_(?:IA_|VOZ_|GERACAO_))/.test(k)));
    // Só o servidor herda a configuração dos provedores. Banco, origem, login e e-mail são do ensaio.
    const env = { ...localEnv, NODE_ENV:"production", OPENAI_API_KEY:"", ...extras, EMAIL:"falso" };
    const log = openSync(join(base,"next.log"), "a", 0o600);
    let filho;
    try { filho = spawn(process.execPath, ["node_modules/next/dist/bin/next","start","--hostname",local,"--port",String(porta)],
      { cwd:raiz, env, stdio:["ignore",log,log], detached:true }); } finally { closeSync(log); }
    filho.unref();
    dono.pid = filho.pid;
    dono.nascimento = await nascimento(filho.pid);
    await salvar("dono.json", JSON.stringify(dono));
    for (let n=0; n<100; n++) {
      const r = await fetch(origem + "/api/saude", { signal:AbortSignal.timeout(800) }).catch(() => null);
      if (r?.ok && (await r.json()).ok) return;
      if (!await nascimento(filho.pid)) break;
      await esperar(200);
    }
    throw new Error("O servidor não passou em GET /api/saude.");
  } catch (erro) { await parar(); throw erro; }
}
try {
  if (acao === "subir") { await subir(); console.log("Bancada isolada pronta em " + origem + ". Credenciais sintéticas em .studoo-local/ensaio-ia-" + porta + "/piloto.env."); }
  else { await parar(); console.log("Servidor encerrado e banco descartável removido."); }
} catch (erro) {
  // Não repetir mensagens de programas externos nem valores de ambiente.
  console.error("Falhou ao " + acao + " a bancada (" + (erro.code ?? erro.name) + "). Confira a porta, a compilação e o diretório .studoo-local/ensaio-ia-" + porta + ".");
  process.exitCode=1;
}
