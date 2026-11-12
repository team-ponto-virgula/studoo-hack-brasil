import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import EmbeddedPostgres from "embedded-postgres";

const host = "127.0.0.1";
const porta = 55432;
const usuario = "studoo";
const banco = "studoo_local";
const diretorioLocal = resolve(".studoo-local");
const diretorioDados = resolve(diretorioLocal, "postgres");

async function carregarAmbiente() {
  try {
    return parseEnv(await readFile(".env", "utf8"));
  } catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
  }

  const url = new URL(`postgresql://${host}:${porta}/${banco}`);
  url.username = usuario;
  url.password = randomBytes(24).toString("hex");
  const valores = {
    DATABASE_URL: url.href,
    STUDOO_ORIGEM: "http://localhost:3000",
    STUDOO_DOMINIO_EMAIL: "example.test",
    STUDOO_EMAIL: "piloto@example.test",
    STUDOO_SENHA: randomBytes(18).toString("base64url"),
    STUDOO_CHAVE_ASSINATURA: randomBytes(32).toString("hex"),
    IA: "falsa",
    EMAIL: "falso",
  };

  const conteudo = Object.entries(valores).map(([chave, valor]) => `${chave}=${valor}`).join("\n");
  await writeFile(".env", `${conteudo}\n`, { flag: "wx", mode: 0o600 });
  console.log("Configuração e credenciais locais criadas em .env.");
  return valores;
}

function validarAmbienteLocal(ambiente) {
  const url = URL.parse(ambiente.DATABASE_URL ?? "");

  if (
    !url || url.protocol !== "postgresql:" || url.hostname !== host ||
    Number(url.port) !== porta || url.pathname !== `/${banco}` ||
    url.username !== usuario || !/^[0-9a-f]{48}$/.test(url.password) ||
    url.search || url.hash || ambiente.IA !== "falsa" || ambiente.EMAIL !== "falso" ||
    ambiente.STUDOO_EMAIL !== "piloto@example.test"
  ) {
    throw new Error("db:local requer o .env do piloto local com PostgreSQL em 127.0.0.1:55432 e adaptadores falsos.");
  }

  return url.password;
}

async function criarBancoSeAusente(postgres) {
  const cliente = postgres.getPgClient("postgres", host);

  try {
    await cliente.connect();
    const existe = await cliente.query("SELECT 1 FROM pg_database WHERE datname = $1", [banco]);

    if (!existe.rowCount) {
      await cliente.query('CREATE DATABASE "studoo_local"');
    }
  } finally {
    await cliente.end();
  }
}

async function executarScript(nome, ambiente) {
  await new Promise((resolveScript, rejectScript) => {
    const processo = spawn(process.execPath, [process.env.npm_execpath, "run", nome], {
      env: { ...process.env, ...ambiente },
      stdio: "inherit",
    });

    processo.once("error", () => rejectScript(new Error(`Falha ao iniciar ${nome}.`)));
    processo.once("exit", (codigo) => {
      if (codigo === 0) resolveScript();
      else rejectScript(new Error(`Falha em ${nome}.`));
    });
  });
}

async function preparar() {
  const ambiente = await carregarAmbiente();
  const senha = validarAmbienteLocal(ambiente);
  await mkdir(diretorioLocal, { recursive: true });

  const postgres = new EmbeddedPostgres({
    databaseDir: diretorioDados,
    port: porta,
    user: usuario,
    password: senha,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-h", host],
    onLog() {},
    onError() {},
  });

  try {
    await stat(resolve(diretorioDados, "PG_VERSION"));
  } catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
    await postgres.initialise();
  }

  try {
    await postgres.start();
  } catch {
    throw new Error(`db:local não conseguiu iniciar o PostgreSQL em ${host}:${porta}.`);
  }

  try {
    await criarBancoSeAusente(postgres);
    await executarScript("db:generate", ambiente);
    await executarScript("db:migrate", ambiente);
    await executarScript("db:seed", ambiente);
  } catch (erro) {
    await postgres.stop();
    throw erro;
  }

  console.log("PostgreSQL local pronto. Em outro terminal, execute npm run dev.");
}

try {
  await preparar();
} catch (erro) {
  console.error("Falha ao preparar o PostgreSQL local.");
  if (erro instanceof Error && erro.message.startsWith("db:local")) console.error(erro.message);
  process.exitCode = 1;
}
