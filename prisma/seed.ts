import { randomUUID } from "node:crypto";
import { banco } from "../src/servidor/banco/cliente";
import { criarHashSenha, normalizarEmail, senhaValida } from "../src/servidor/acesso/credenciais";

async function provisionar() {
  const email = normalizarEmail(process.env.STUDOO_EMAIL);
  const senha = process.env.STUDOO_SENHA;
  const dominio = process.env.STUDOO_DOMINIO_EMAIL?.toLowerCase();
  if (process.env.IA !== "falsa" || process.env.EMAIL !== "falso" || !email ||
      !dominio?.endsWith(".test") || email.split("@")[1] !== dominio || !senhaValida(senha)) {
    throw new Error("Configuração de conta sintética inválida");
  }

  const conta = await banco.usuario.findUnique({ where: { email }, select: { id: true } });
  if (!conta) {
    const senhaHash = await criarHashSenha(senha);
    await banco.usuario.upsert({
      where: { email },
      create: { id: randomUUID(), email, senhaHash, fuso: "America/Sao_Paulo" },
      update: {},
    });
  }
  await banco.tentativaLogin.deleteMany({ where: { janelaInicio: { lt: new Date(Date.now() - 60_000) } } });
}

try {
  await provisionar();
  console.log("Conta sintética pronta.");
} catch {
  console.error("Não foi possível provisionar a conta sintética. Confira a configuração local.");
  process.exitCode = 1;
} finally {
  await banco.$disconnect();
}
