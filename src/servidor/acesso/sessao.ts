import { createHash, createHmac, randomBytes } from "node:crypto";
import { banco } from "@/servidor/banco/cliente";
import type { CanalSessao, Prisma } from "@/servidor/banco/gerado/client";
import { normalizarEmail, verificarSenha } from "./credenciais";
import { emailPermitido } from "./seguranca";
import { duracaoSessao } from "./origem";

const janelaLoginMs = 60_000;
const limiteFalhas = 5;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

type ResultadoLogin = { estado: "ok"; token: string; expiraEm: Date } | { estado: "credenciais_invalidas" | "limite_login" };

export async function entrar(emailEntrada: unknown, senha: unknown, canal: CanalSessao = "WEB"): Promise<ResultadoLogin> {
  const email = normalizarEmail(emailEntrada);
  const segredo = process.env.STUDOO_CHAVE_ASSINATURA ?? "";
  if (!/^(?:[a-fA-F0-9]{2}){32,}$/.test(segredo)) throw new Error("Configuração de autenticação ausente");

  // O servidor do marco local escuta apenas em loopback, sem IPs vindos de cabeçalhos do cliente.
  const chave = createHmac("sha256", Buffer.from(segredo, "hex"))
    .update(`login\0loopback\0${email ?? ""}`).digest("hex");

  return banco.$transaction(async (transacao): Promise<ResultadoLogin> => {
    await transacao.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
    const agora = new Date();
    const tentativa = await transacao.tentativaLogin.findUnique({ where: { chave } });
    const vigente = tentativa && agora.getTime() - tentativa.janelaInicio.getTime() < janelaLoginMs;
    if (vigente && tentativa.falhas >= limiteFalhas) return { estado: "limite_login" };

    const usuario = email && emailPermitido(email)
      ? await transacao.usuario.findUnique({ where: { email }, select: { id: true, senhaHash: true } })
      : null;
    const senhaCorreta = await verificarSenha(senha, usuario?.senhaHash ?? undefined);
    if (!usuario || !senhaCorreta) {
      const dados = vigente
        ? { falhas: tentativa.falhas + 1, janelaInicio: tentativa.janelaInicio }
        : { falhas: 1, janelaInicio: agora };
      await transacao.tentativaLogin.upsert({ where: { chave }, create: { chave, ...dados }, update: dados });
      return { estado: "credenciais_invalidas" };
    }

    await transacao.tentativaLogin.deleteMany({ where: { chave } });
    return { estado: "ok", ...await criarSessao(usuario.id, canal, transacao) };

  });
}

export async function usuarioDaSessao(token: string, canal: CanalSessao) {
  const sessao = await banco.sessao.findUnique({
    where: { tokenHash: hashToken(token), canal, expiraEm: { gt: new Date() } },
    select: { usuarioId: true },
  });
  return sessao?.usuarioId ?? null;
}

export async function revogarSessao(usuarioId: string, token: string, canal: CanalSessao) {
  await banco.sessao.deleteMany({ where: { usuarioId, tokenHash: hashToken(token), canal } });
}

export async function criarSessao(usuarioId: string, canal: CanalSessao, transacao: Prisma.TransactionClient = banco) {
  const token = randomBytes(32).toString('base64url');
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + duracaoSessao * 1000);
  await transacao.sessao.deleteMany({ where: { usuarioId, expiraEm: { lte: agora } } });
  await transacao.sessao.create({ data: { tokenHash: hashToken(token), usuarioId, canal, criadaEm: agora, expiraEm } });
  return { token, expiraEm };
}
